/* ==========================================================================
   Subida de archivos grandes por fragmentos.
   El navegador parte el archivo en bloques (FRAGMENTO_BYTES), los codifica en
   base64 y los envía uno a uno al backend, que los reenvía a una sesión de
   subida reanudable de Google Drive. Si un fragmento falla se reintenta; si
   todo falla, el progreso queda en sessionStorage para reanudar con el mismo
   archivo sin empezar de cero.
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

  /**
   * Sube un archivo asociado a una entrega.
   * @param {Object} o
   * @param {File}   o.archivo
   * @param {Object} o.meta        datos del formulario
   * @param {Function} o.onProgreso (fraccion 0..1, textoEstado)
   * @returns {Promise<{radicado:string, enlace:string}>}
   */
  async function subirVideo(o) {
    const archivo = o.archivo;
    const onProgreso = o.onProgreso || (() => {});
    const tam = C.FRAGMENTO_BYTES;
    const totalFragmentos = Math.max(1, Math.ceil(archivo.size / tam));

    // ¿Hay una subida pendiente de este mismo archivo? Reanudar.
    let progreso = leerProgreso();
    let uploadId, radicado, desde = 0;
    if (progreso && progreso.nombre === archivo.name && progreso.tamano === archivo.size && progreso.uploadId) {
      uploadId = progreso.uploadId; radicado = progreso.radicado; desde = progreso.siguiente || 0;
      onProgreso(desde / totalFragmentos, "Reanudando la subida desde el fragmento " + (desde + 1) + "…");
    } else {
      onProgreso(0, "Preparando la subida…");
      const ini = await window.Api.entregas.iniciar({
        meta: o.meta,
        archivo: { nombre: archivo.name, tipo: archivo.type || "video/mp4", tamano: archivo.size }
      });
      uploadId = ini.uploadId; radicado = ini.radicado;
      progreso = { uploadId, radicado, nombre: archivo.name, tamano: archivo.size, siguiente: 0 };
      guardarProgreso(progreso);
    }

    for (let i = desde; i < totalFragmentos; i++) {
      const inicio = i * tam;
      const fin = Math.min(archivo.size, inicio + tam);
      const trozo = archivo.slice(inicio, fin);
      const datos = await leerBase64(trozo);
      let intento = 0, ultimoError;
      while (intento <= C.REINTENTOS_FRAGMENTO) {
        try {
          onProgreso(i / totalFragmentos, "Subiendo fragmento " + (i + 1) + " de " + totalFragmentos + (intento ? " (reintento " + intento + ")" : "") + "…");
          await window.Api.entregas.fragmento({
            uploadId, indice: i, inicio, total: archivo.size, bytes: fin - inicio,
            tipo: archivo.type || "video/mp4", datos
          });
          ultimoError = null;
          break;
        } catch (err) {
          ultimoError = err;
          intento += 1;
          await esperar(1200 * intento);
        }
      }
      if (ultimoError) {
        progreso.siguiente = i;
        guardarProgreso(progreso);
        throw ultimoError;
      }
      progreso.siguiente = i + 1;
      guardarProgreso(progreso);
      onProgreso((i + 1) / totalFragmentos, "Fragmento " + (i + 1) + " de " + totalFragmentos + " confirmado.");
    }

    onProgreso(1, "Confirmando la entrega…");
    const fin = await window.Api.entregas.finalizar({ uploadId });
    borrarProgreso();
    return { radicado: fin.radicado || radicado, enlace: fin.enlace || "", estado: fin.estado || "Recibido" };
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
