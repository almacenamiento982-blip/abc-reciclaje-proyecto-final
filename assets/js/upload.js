/* ==========================================================================
   Subida de archivos grandes.
   Modo DIRECTO (preferido): el backend abre una sesión de subida reanudable
   en Google Drive a nombre de la cuenta del curso y devuelve su URL; el
   navegador envía los bytes directamente a Google en bloques grandes, a la
   velocidad real de la conexión. El backend solo confirma al final que el
   archivo quedó en la carpeta correcta.
   Modo RELEVO (respaldo): si el navegador no puede hablar con Google
   (bloqueo de red, CORS), los bloques se envían en base64 al backend, que
   los reenvía a Drive. Más lento, pero funciona en cualquier red.
   En ambos modos el progreso se guarda en sessionStorage para reanudar con
   el mismo archivo sin empezar de cero.
   ========================================================================== */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const CLAVE_SESION = "abc_subida_en_curso";

  function leerBase64(blob) {
    return new Promise((resolver, rechazar) => {
      const fr = new FileReader();
      fr.onerror = () => rechazar(new Error("No se pudo leer el archivo. Vuelve a seleccionarlo."));
      fr.onload = () => resolver(String(fr.result).split(",")[1] || "");
      fr.readAsDataURL(blob);
    });
  }
  function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }
  function guardarProgreso(p) { try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(p)); } catch (e) { /* ignorar */ } }
  function leerProgreso() { try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null"); } catch (e) { return null; } }
  function borrarProgreso() { try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* ignorar */ } }
  function mb(n) { return (n / 1048576).toFixed(n > 100 * 1048576 ? 0 : 1) + " MB"; }

  /**
   * Envía un bloque directamente a la sesión de Drive con XMLHttpRequest
   * (para tener progreso byte a byte).
   * Resuelve con { codigo, cuerpo }. Rechaza con Error("red") si el navegador
   * no pudo conectar (CORS, sin internet).
   */
  function putDirecto(url, blob, inicio, total, tipo, onBytes) {
    return new Promise((resolver, rechazar) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", tipo);
      xhr.setRequestHeader("Content-Range", "bytes " + inicio + "-" + (inicio + blob.size - 1) + "/" + total);
      xhr.timeout = 10 * 60 * 1000;
      xhr.upload.onprogress = ev => { if (ev.lengthComputable) onBytes(inicio + ev.loaded); };
      xhr.onload = () => resolver({ codigo: xhr.status, cuerpo: xhr.responseText });
      xhr.onerror = () => rechazar(new Error("red"));
      xhr.ontimeout = () => rechazar(new Error("tiempo"));
      xhr.send(blob);
    });
  }

  async function subirDirecto(archivo, sesion, progreso, onProgreso) {
    const total = archivo.size;
    const tam = C.DIRECTO_FRAGMENTO_BYTES;
    let desde = progreso.recibido || 0;
    if (desde > 0) {
      // Preguntar al backend cuántos bytes tiene realmente Drive antes de continuar
      const est = await window.Api.entregas.estado({ uploadId: progreso.uploadId });
      if (est.archivoId) return est.archivoId;
      desde = est.recibido || 0;
    }
    const tipo = archivo.type || "video/mp4";
    while (desde < total) {
      const fin = Math.min(total, desde + tam);
      const trozo = archivo.slice(desde, fin);
      let intento = 0, resultado = null, ultimoError = null;
      while (intento <= C.REINTENTOS_FRAGMENTO) {
        try {
          onProgreso(desde / total, "Subiendo " + mb(desde) + " de " + mb(total) + (intento ? " (reintento " + intento + ")" : "") + "…");
          resultado = await putDirecto(sesion, trozo, desde, total, tipo, bytes => {
            onProgreso(bytes / total, "Subiendo " + mb(bytes) + " de " + mb(total) + "…");
          });
          ultimoError = null;
          break;
        } catch (err) {
          ultimoError = err;
          // Si falla la primera conexión de todas, dejamos que el llamador cambie a modo relevo
          if (desde === 0 && intento === 0 && err.message === "red") throw Object.assign(new Error("directo-no-disponible"), { cambiarModo: true });
          intento += 1;
          await esperar(1500 * intento);
          // Tras un fallo, sincronizar con lo que Drive realmente recibió
          try {
            const est = await window.Api.entregas.estado({ uploadId: progreso.uploadId });
            if (est.archivoId) return est.archivoId;
            if (typeof est.recibido === "number") { desde = est.recibido; break; }
          } catch (e) { /* seguir reintentando */ }
        }
      }
      if (ultimoError && !resultado) {
        if (intento > C.REINTENTOS_FRAGMENTO) { progreso.recibido = desde; guardarProgreso(progreso); throw new Error("Se perdió la conexión con Google Drive durante la subida. Revisa tu internet y pulsa Reintentar: continuará desde " + mb(desde) + "."); }
        continue; // 'desde' fue ajustado; volver a intentar desde ahí
      }
      if (resultado.codigo === 308) {
        desde = fin;
      } else if (resultado.codigo === 200 || resultado.codigo === 201) {
        let archivoId = "";
        try { archivoId = JSON.parse(resultado.cuerpo).id || ""; } catch (e) { /* sin id */ }
        progreso.recibido = total; guardarProgreso(progreso);
        onProgreso(1, "Video recibido en Google Drive. Confirmando…");
        return archivoId;
      } else if (resultado.codigo === 404 || resultado.codigo === 410) {
        throw new Error("La sesión de subida expiró. Vuelve a enviar el video.");
      } else {
        throw new Error("Google Drive rechazó el bloque (código " + resultado.codigo + "). Pulsa Reintentar.");
      }
      progreso.recibido = desde; guardarProgreso(progreso);
    }
    return "";
  }

  async function subirPorRelevo(archivo, progreso, onProgreso) {
    const tam = C.FRAGMENTO_BYTES;
    const totalFragmentos = Math.max(1, Math.ceil(archivo.size / tam));
    const desde = progreso.siguiente || 0;
    if (desde > 0) onProgreso(desde / totalFragmentos, "Reanudando desde el fragmento " + (desde + 1) + "…");
    for (let i = desde; i < totalFragmentos; i++) {
      const inicio = i * tam, fin = Math.min(archivo.size, inicio + tam);
      const datos = await leerBase64(archivo.slice(inicio, fin));
      let intento = 0, ultimoError;
      while (intento <= C.REINTENTOS_FRAGMENTO) {
        try {
          onProgreso(i / totalFragmentos, "Subiendo fragmento " + (i + 1) + " de " + totalFragmentos + (intento ? " (reintento " + intento + ")" : "") + "…");
          const r = await window.Api.entregas.fragmento({ uploadId: progreso.uploadId, indice: i, inicio, total: archivo.size, bytes: fin - inicio, tipo: archivo.type || "video/mp4", datos });
          ultimoError = null;
          if (r.archivoId) return r.archivoId;
          break;
        } catch (err) { ultimoError = err; intento += 1; await esperar(1200 * intento); }
      }
      if (ultimoError) { progreso.siguiente = i; guardarProgreso(progreso); throw ultimoError; }
      progreso.siguiente = i + 1; guardarProgreso(progreso);
      onProgreso((i + 1) / totalFragmentos, "Fragmento " + (i + 1) + " de " + totalFragmentos + " confirmado.");
    }
    return "";
  }

  /**
   * Sube un video asociado a una entrega.
   * @returns {Promise<{radicado:string, enlace:string, estado:string}>}
   */
  async function subirVideo(o) {
    const archivo = o.archivo;
    const onProgreso = o.onProgreso || (() => {});
    let progreso = leerProgreso();
    const mismoArchivo = progreso && progreso.nombre === archivo.name && progreso.tamano === archivo.size && progreso.uploadId;
    if (!mismoArchivo) {
      onProgreso(0, "Preparando la subida…");
      const ini = await window.Api.entregas.iniciar({
        meta: o.meta,
        archivo: { nombre: archivo.name, tipo: archivo.type || "video/mp4", tamano: archivo.size },
        origen: location.origin
      });
      progreso = { uploadId: ini.uploadId, radicado: ini.radicado, sesion: ini.sesionUrl || "", nombre: archivo.name, tamano: archivo.size, recibido: 0, siguiente: 0, modo: ini.sesionUrl ? "directo" : "relevo" };
      guardarProgreso(progreso);
    }

    let archivoId = "";
    if (progreso.modo === "directo" && progreso.sesion) {
      try {
        archivoId = await subirDirecto(archivo, progreso.sesion, progreso, onProgreso);
      } catch (err) {
        if (!err.cambiarModo) throw err;
        progreso.modo = "relevo"; progreso.siguiente = 0; guardarProgreso(progreso);
        onProgreso(0, "Tu red no permite la subida directa; usando la vía alternativa…");
      }
    }
    if (progreso.modo === "relevo") {
      archivoId = await subirPorRelevo(archivo, progreso, onProgreso);
    }

    onProgreso(1, "Confirmando la entrega…");
    const fin = await window.Api.entregas.finalizar({ uploadId: progreso.uploadId, archivoId });
    borrarProgreso();
    return { radicado: fin.radicado || progreso.radicado, enlace: fin.enlace || "", estado: fin.estado || "Recibido" };
  }

  /** Reduce una imagen a FOTO_LADO_MAX_PX y la devuelve como base64 JPEG. */
  async function comprimirImagen(archivo) {
    const url = URL.createObjectURL(archivo);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("No se pudo leer la imagen. Usa un archivo JPG o PNG."));
        im.src = url;
      });
      const max = C.FOTO_LADO_MAX_PX;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", C.FOTO_CALIDAD_JPEG);
      const base64 = dataUrl.split(",")[1];
      return { datos: base64, tipo: "image/jpeg", tamano: Math.round(base64.length * 0.75), nombre: archivo.name.replace(/\.[^.]+$/, "") + ".jpg", vistaPrevia: dataUrl };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.Subida = { subirVideo, comprimirImagen, leerProgreso, borrarProgreso };
})();
