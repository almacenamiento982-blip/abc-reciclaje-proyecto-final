/* ==========================================================================
   MODO DEMOSTRACIÓN.
   Implementa el mismo contrato que el backend real (ver api.js) pero guarda
   todo en localStorage del navegador. Sirve para probar el flujo completo sin
   backend. Los videos NO se almacenan (solo sus metadatos); las fotos de los
   árboles se guardan comprimidas para que la galería tenga algo que mostrar.
   Nada de esto llega a Google Drive.
   ========================================================================== */
(function () {
  "use strict";
  const CLAVE_LS = "abc_reciclaje_demo_v1";
  const C = window.ABC_CONFIG;

  function espera(ms) { return new Promise(r => setTimeout(r, ms)); }
  function latencia() { return espera(250 + Math.random() * 450); }

  function semilla() {
    const hoy = new Date();
    const hace = d => new Date(hoy.getTime() - d * 86400000).toISOString();
    return {
      contador: 2,
      contadorArboles: 3,
      entregas: [
        {
          radicado: "ABC-2026-00001", fecha: hace(6), nombre: "Estudiante de ejemplo (demo)", documento: "1000",
          correo: "ejemplo@correo.com", whatsapp: "", pais: "Colombia", zona: "Zona de ejemplo", grupo: "",
          titulo: "Reciclando en mi barrio", descripcion: "Entrega de ejemplo cargada por el modo demostración.",
          tipo: "archivo", archivoId: "", enlace: "", tamanoMB: 145, estado: "Calificado", nota: 4.6,
          retroalimentacion: "Excelente explicación de la separación en la fuente. Para la próxima, procura mostrar también cómo se entregan los residuos aprovechables al reciclador de oficio.",
          docente: "Docente de ejemplo", fechaCalificacion: hace(2), autoriza: "SI", origen: "demo"
        },
        {
          radicado: "ABC-2026-00002", fecha: hace(1), nombre: "Segundo ejemplo (demo)", documento: "2000",
          correo: "", whatsapp: "", pais: "Argentina", zona: "Zona de ejemplo", grupo: "",
          titulo: "Compostaje en casa", descripcion: "", tipo: "enlace", archivoId: "", enlace: "https://youtube.com/watch?v=ejemplo",
          tamanoMB: "", estado: "Recibido", nota: "", retroalimentacion: "", docente: "", fechaCalificacion: "", autoriza: "SI", origen: "demo"
        }
      ],
      arboles: [
        { id: "ARB-00001", fecha: hace(10), nombre: "Ejemplo · Medellín", documento: "1000", ciudad: "Medellín", pais: "Colombia", lat: 6.2442, lng: -75.5812, mensaje: "Un guayacán para el parque del barrio.", fotoUrl: "", publicar: "SI", origen: "demo" },
        { id: "ARB-00002", fecha: hace(8), nombre: "Ejemplo · Buenos Aires", documento: "2000", ciudad: "Buenos Aires", pais: "Argentina", lat: -34.6037, lng: -58.3816, mensaje: "Sembramos un jacarandá con mi familia.", fotoUrl: "", publicar: "SI", origen: "demo" },
        { id: "ARB-00003", fecha: hace(3), nombre: "Ejemplo · Caracas", documento: "3000", ciudad: "Caracas", pais: "Venezuela", lat: 10.4806, lng: -66.9036, mensaje: "Mi primer árbol: un apamate.", fotoUrl: "", publicar: "SI", origen: "demo" }
      ],
      subidas: {}
    };
  }

  function leer() {
    try {
      const raw = localStorage.getItem(CLAVE_LS);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* almacenamiento no disponible o corrupto */ }
    const s = semilla();
    guardar(s);
    return s;
  }
  function guardar(datos) {
    try { localStorage.setItem(CLAVE_LS, JSON.stringify(datos)); }
    catch (e) { console.warn("No se pudo guardar en localStorage", e); }
  }
  function radicadoNuevo(d) {
    d.contador += 1;
    return "ABC-" + new Date().getFullYear() + "-" + String(d.contador).padStart(5, "0");
  }
  function idArbolNuevo(d) {
    d.contadorArboles += 1;
    return "ARB-" + String(d.contadorArboles).padStart(5, "0");
  }
  function normalizarDoc(v) { return String(v || "").trim().toLowerCase().replace(/[.\-\s]/g, ""); }

  const Demo = {
    modo: "demo",

    async ping() { await latencia(); return { ok: true, modo: "demo", version: C.VERSION }; },

    async iniciar({ meta, archivo }) {
      await latencia();
      const d = leer();
      const radicado = radicadoNuevo(d);
      const uploadId = "demo-" + Math.random().toString(36).slice(2, 10);
      d.entregas.push(Object.assign({}, meta, {
        radicado, fecha: new Date().toISOString(), tipo: "archivo", archivoId: "", enlace: "",
        tamanoMB: Math.round((archivo.tamano || 0) / 1048576), estado: "Subiendo", nota: "", retroalimentacion: "",
        docente: "", fechaCalificacion: "", origen: "demo"
      }));
      d.subidas[uploadId] = { radicado, recibido: 0, total: archivo.tamano, nombre: archivo.nombre };
      guardar(d);
      return { ok: true, uploadId, radicado };
    },

    async fragmento({ uploadId, inicio, total, bytes }) {
      await espera(120 + Math.random() * 200);
      const d = leer();
      const s = d.subidas[uploadId];
      if (!s) return { ok: false, error: "Sesión de subida no encontrada (demo)." };
      s.recibido = inicio + bytes;
      guardar(d);
      return { ok: true, recibido: s.recibido, completado: s.recibido >= total };
    },

    async estadoSubida({ uploadId }) {
      await latencia();
      const d = leer(); const s = d.subidas[uploadId];
      if (!s) return { ok: false, error: "Sesión de subida no encontrada (demo)." };
      return { ok: true, recibido: s.recibido, completado: s.recibido >= s.total, archivoId: "" };
    },

    async finalizar({ uploadId }) {
      await latencia();
      const d = leer();
      const s = d.subidas[uploadId];
      if (!s) return { ok: false, error: "Sesión de subida no encontrada (demo)." };
      const e = d.entregas.find(x => x.radicado === s.radicado);
      if (e) { e.estado = "Recibido"; e.archivoId = "demo-sin-archivo"; }
      delete d.subidas[uploadId];
      guardar(d);
      return { ok: true, radicado: s.radicado, estado: "Recibido", enlace: "" };
    },

    async enlace({ meta }) {
      await latencia();
      const d = leer();
      const radicado = radicadoNuevo(d);
      d.entregas.push(Object.assign({}, meta, {
        radicado, fecha: new Date().toISOString(), tipo: "enlace", archivoId: "", tamanoMB: "",
        estado: "Recibido", nota: "", retroalimentacion: "", docente: "", fechaCalificacion: "", origen: "demo"
      }));
      guardar(d);
      return { ok: true, radicado, estado: "Recibido" };
    },

    async consultar({ documento, correo }) {
      await latencia();
      const d = leer();
      const doc = normalizarDoc(documento);
      const mail = String(correo || "").trim().toLowerCase();
      const entregas = d.entregas
        .filter(e => normalizarDoc(e.documento) === doc && (!mail || String(e.correo || "").toLowerCase() === mail))
        .map(e => ({
          radicado: e.radicado, fecha: e.fecha, titulo: e.titulo, zona: e.zona, pais: e.pais, estado: e.estado,
          nota: e.estado === "Calificado" ? e.nota : "", retroalimentacion: e.estado === "Calificado" ? e.retroalimentacion : "",
          docente: e.estado === "Calificado" ? e.docente : "", fechaCalificacion: e.fechaCalificacion
        }));
      return { ok: true, entregas };
    },

    async listarArboles() {
      await latencia();
      const d = leer();
      return { ok: true, arboles: d.arboles.filter(a => a.publicar !== "NO").map(a => Object.assign({}, a, { documento: undefined })).reverse() };
    },

    async registrarArbol({ meta, foto }) {
      await latencia();
      const d = leer();
      const id = idArbolNuevo(d);
      d.arboles.push(Object.assign({}, meta, {
        id, fecha: new Date().toISOString(), publicar: "SI", origen: "demo",
        fotoUrl: foto && foto.datos ? "data:" + foto.tipo + ";base64," + foto.datos : ""
      }));
      guardar(d);
      return { ok: true, id };
    },

    async docentesListar({ clave }) {
      await latencia();
      if (clave !== C.CLAVE_DEMO) return { ok: false, error: "Clave incorrecta. En modo demostración la clave es " + C.CLAVE_DEMO + "." };
      const d = leer();
      return { ok: true, entregas: d.entregas.slice().reverse(), arboles: d.arboles.slice().reverse() };
    },

    async calificar({ clave, radicado, nota, retroalimentacion, docente, estado }) {
      await latencia();
      if (clave !== C.CLAVE_DEMO) return { ok: false, error: "Clave incorrecta." };
      const d = leer();
      const e = d.entregas.find(x => x.radicado === radicado);
      if (!e) return { ok: false, error: "No existe la entrega " + radicado + "." };
      e.nota = nota; e.retroalimentacion = retroalimentacion; e.docente = docente;
      e.estado = estado || "Calificado"; e.fechaCalificacion = new Date().toISOString();
      guardar(d);
      return { ok: true };
    },

    async publicarArbol({ clave, id, publicar }) {
      await latencia();
      if (clave !== C.CLAVE_DEMO) return { ok: false, error: "Clave incorrecta." };
      const d = leer();
      const a = d.arboles.find(x => x.id === id);
      if (!a) return { ok: false, error: "No existe el árbol " + id + "." };
      a.publicar = publicar ? "SI" : "NO";
      guardar(d);
      return { ok: true };
    },

    async eliminar({ clave, radicado }) {
      await latencia();
      if (clave !== C.CLAVE_DEMO) return { ok: false, error: "Clave incorrecta." };
      const d = leer();
      const n = d.entregas.length;
      d.entregas = d.entregas.filter(e => e.radicado !== radicado);
      if (d.entregas.length === n) return { ok: false, error: "No existe la entrega " + radicado + "." };
      guardar(d);
      return { ok: true };
    },

    async eliminarArbol({ clave, id }) {
      await latencia();
      if (clave !== C.CLAVE_DEMO) return { ok: false, error: "Clave incorrecta." };
      const d = leer();
      const n = d.arboles.length;
      d.arboles = d.arboles.filter(a => a.id !== id);
      if (d.arboles.length === n) return { ok: false, error: "No existe el árbol " + id + "." };
      guardar(d);
      return { ok: true };
    },

    reiniciar() { guardar(semilla()); }
  };

  window.DemoStore = Demo;
})();
