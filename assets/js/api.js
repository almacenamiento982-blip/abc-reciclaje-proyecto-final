/* ==========================================================================
   Cliente del backend.
   - Si ABC_CONFIG.APPS_SCRIPT_URL está configurada: habla con el Web App de
     Google Apps Script (POST con cuerpo text/plain para evitar preflight CORS;
     Apps Script responde JSON con Access-Control-Allow-Origin: *).
   - Si no: delega en DemoStore (modo demostración, solo navegador).
   Todas las funciones devuelven una promesa con { ok, ...datos } o lanzan
   ApiError con un mensaje legible para el usuario.
   ========================================================================== */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const URL_BACKEND = (C.APPS_SCRIPT_URL || "").trim();
  const DEMO = !URL_BACKEND;

  class ApiError extends Error {
    constructor(mensaje, detalle) { super(mensaje); this.name = "ApiError"; this.detalle = detalle; }
  }

  function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function llamar(action, datos, opciones) {
    opciones = opciones || {};
    const intentos = opciones.reintentos == null ? 2 : opciones.reintentos;
    const cuerpo = JSON.stringify(Object.assign({ action }, datos || {}));
    let ultimoError;
    for (let i = 0; i <= intentos; i++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), opciones.timeoutMs || 120000);
        const resp = await fetch(URL_BACKEND, {
          method: "POST",
          body: cuerpo,                 // sin Content-Type → text/plain, sin preflight
          redirect: "follow",
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const texto = await resp.text();
        let json;
        try { json = JSON.parse(texto); }
        catch (e) {
          throw new ApiError("El servidor respondió en un formato inesperado. Revisa que la URL del Web App termine en /exec y esté publicada para 'Cualquier persona'.", texto.slice(0, 300));
        }
        if (!resp.ok && !json) throw new ApiError("Error HTTP " + resp.status);
        return json;
      } catch (err) {
        ultimoError = err;
        if (err instanceof ApiError) throw err;
        if (i < intentos) await esperar(800 * (i + 1));
      }
    }
    const esRed = ultimoError && (ultimoError.name === "TypeError" || ultimoError.name === "AbortError");
    throw new ApiError(esRed
      ? "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo; tu información no se ha perdido."
      : "Ocurrió un error inesperado al contactar el servidor.", ultimoError && ultimoError.message);
  }

  function verificar(r, mensajePorDefecto) {
    if (!r || r.ok !== true) throw new ApiError((r && r.error) || mensajePorDefecto || "El servidor devolvió un error.");
    return r;
  }

  let cacheEstado = null;
  const Api = {
    ApiError,
    esDemo: DEMO,

    async estado() {
      if (cacheEstado) return cacheEstado;
      if (DEMO) { cacheEstado = { modo: "demo", url: "" }; return cacheEstado; }
      try {
        const r = await llamar("ping", {}, { reintentos: 0, timeoutMs: 15000 });
        cacheEstado = { modo: r && r.ok ? "conectado" : "error", url: URL_BACKEND, version: r && r.version };
      } catch (e) { cacheEstado = { modo: "error", url: URL_BACKEND, error: e.message }; }
      return cacheEstado;
    },

    entregas: {
      iniciar: (p) => DEMO ? window.DemoStore.iniciar(p).then(verificar) : llamar("iniciar", p).then(verificar),
      fragmento: (p) => DEMO ? window.DemoStore.fragmento(p).then(verificar)
        : llamar("fragmento", p, { reintentos: 0, timeoutMs: 180000 }).then(verificar),
      estado: (p) => DEMO ? window.DemoStore.estadoSubida(p).then(verificar) : llamar("estado_subida", p).then(verificar),
      finalizar: (p) => DEMO ? window.DemoStore.finalizar(p).then(verificar) : llamar("finalizar", p).then(verificar),
      enlace: (p) => DEMO ? window.DemoStore.enlace(p).then(verificar) : llamar("enlace", p).then(verificar),
      consultar: (p) => DEMO ? window.DemoStore.consultar(p).then(verificar) : llamar("consultar", p).then(verificar)
    },

    arboles: {
      listar: () => DEMO ? window.DemoStore.listarArboles().then(verificar) : llamar("arboles", {}).then(verificar),
      registrar: (p) => DEMO ? window.DemoStore.registrarArbol(p).then(verificar)
        : llamar("arbol", p, { reintentos: 0, timeoutMs: 180000 }).then(verificar)
    },

    docentes: {
      listar: (p) => DEMO ? window.DemoStore.docentesListar(p).then(verificar) : llamar("docentes_listar", p).then(verificar),
      calificar: (p) => DEMO ? window.DemoStore.calificar(p).then(verificar) : llamar("calificar", p).then(verificar),
      publicarArbol: (p) => DEMO ? window.DemoStore.publicarArbol(p).then(verificar) : llamar("publicar_arbol", p).then(verificar),
      eliminar: (p) => DEMO ? window.DemoStore.eliminar(p).then(verificar) : llamar("eliminar", p).then(verificar),
      eliminarArbol: (p) => DEMO ? window.DemoStore.eliminarArbol(p).then(verificar) : llamar("eliminar_arbol", p).then(verificar),
      cambiarClave: (p) => DEMO ? Promise.resolve({ ok: false, error: "En modo demostración la clave no se puede cambiar." }).then(verificar) : llamar("cambiar_clave", p).then(verificar)
    }
  };

  window.Api = Api;
})();
