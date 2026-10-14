/* Página de envío: validación, subida con progreso, confirmación y errores. */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const CLAVE_BORRADOR = "abc_borrador_envio";
  const $ = s => document.querySelector(s);

  const form = $("#form-envio");
  const campos = {
    nombre: $("#nombre"), documento: $("#documento"), correo: $("#correo"), whatsapp: $("#whatsapp"),
    pais: $("#pais"), zona: $("#zona"), grupo: $("#grupo"), titulo: $("#titulo"), descripcion: $("#descripcion"),
    enlace: $("#enlace"), autoriza: $("#autoriza"), archivo: $("#archivo")
  };
  const zonaArchivo = $("#zona-archivo");
  const cajaArchivo = $("#archivo-seleccionado");
  const panelProgreso = $("#panel-progreso");
  const panelError = $("#panel-error");
  const panelExito = $("#panel-exito");
  let archivoActual = null;
  let subiendo = false;
  let modo = "demo";

  /* ---------- Inicio ---------- */
  UI.llenarSelect(campos.pais, C.PAISES, "Selecciona tu país");
  document.querySelectorAll("[data-peso]").forEach(el => el.textContent = C.VIDEO_MAX_MB + " MB");
  UI.limpiarErroresAlEscribir(form);
  restaurarBorrador();

  UI.iniciarPagina("envio").then(estado => {
    modo = estado.modo;
    const aviso = $("[data-aviso-modo]");
    if (modo === "demo") {
      aviso.innerHTML = '<div class="aviso aviso--alerta"><span class="aviso__icono">🧪</span><div><p><strong>Modo demostración.</strong> Puedes probar el formulario completo; el video <strong>no se enviará a Google Drive</strong> hasta que se conecte el backend.</p></div></div>';
    } else if (modo === "error") {
      aviso.innerHTML = '<div class="aviso aviso--error"><span class="aviso__icono">⚠️</span><div><p><strong>El servidor de envíos no responde en este momento.</strong> Puedes llenar el formulario; tus datos se guardan en este navegador y podrás reintentar.</p></div></div>';
    }
    const pendiente = window.Subida.leerProgreso();
    if (pendiente && pendiente.nombre) {
      UI.toast("Tienes una subida pendiente de " + pendiente.nombre + ". Selecciona el mismo archivo y envía para continuar.", "alerta", 7000);
    }
  });

  /* ---------- Tipo de entrega ---------- */
  form.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const tipo = form.tipo.value;
      document.querySelectorAll(".opcion").forEach(o => o.classList.toggle("opcion--activa", o.dataset.opcion === tipo));
      $("#campo-archivo").hidden = tipo !== "archivo";
      $("#campo-enlace").hidden = tipo !== "enlace";
    });
  });

  /* ---------- Archivo ---------- */
  function extensionValida(nombre) {
    const n = nombre.toLowerCase();
    return C.VIDEO_EXTENSIONES.some(ext => n.endsWith(ext));
  }
  function asignarArchivo(f) {
    const errorEl = $("#campo-archivo .error");
    errorEl.textContent = "";
    if (!f) return;
    if (!(C.VIDEO_TIPOS.includes(f.type) || extensionValida(f.name))) {
      errorEl.textContent = "Ese archivo no parece un video. Formatos aceptados: " + C.VIDEO_EXTENSIONES.join(", ") + ".";
      campos.archivo.value = ""; archivoActual = null; cajaArchivo.hidden = true; return;
    }
    if (f.size > C.VIDEO_MAX_MB * 1024 * 1024) {
      errorEl.textContent = "El video pesa " + UI.formatoMB(f.size) + " y el máximo es " + C.VIDEO_MAX_MB + " MB. Grábalo en menor calidad o envía un enlace.";
      campos.archivo.value = ""; archivoActual = null; cajaArchivo.hidden = true; return;
    }
    archivoActual = f;
    cajaArchivo.hidden = false;
    cajaArchivo.querySelector("[data-nombre]").textContent = f.name;
    cajaArchivo.querySelector("[data-detalle]").textContent = UI.formatoMB(f.size) + " · " + (f.type || "video");
  }
  campos.archivo.addEventListener("change", () => asignarArchivo(campos.archivo.files[0]));
  $("#quitar-archivo").addEventListener("click", () => { campos.archivo.value = ""; archivoActual = null; cajaArchivo.hidden = true; });
  ["dragenter", "dragover"].forEach(ev => zonaArchivo.addEventListener(ev, e => { e.preventDefault(); zonaArchivo.classList.add("zona-archivo--sobre"); }));
  ["dragleave", "drop"].forEach(ev => zonaArchivo.addEventListener(ev, e => { e.preventDefault(); zonaArchivo.classList.remove("zona-archivo--sobre"); }));
  zonaArchivo.addEventListener("drop", e => { if (e.dataTransfer.files && e.dataTransfer.files[0]) asignarArchivo(e.dataTransfer.files[0]); });

  /* ---------- Borrador local (nunca el video) ---------- */
  function leerMeta() {
    return {
      nombre: campos.nombre.value.trim(), documento: campos.documento.value.trim(), correo: campos.correo.value.trim(),
      whatsapp: campos.whatsapp.value.trim(), pais: campos.pais.value, zona: campos.zona.value.trim(), grupo: campos.grupo.value.trim(),
      titulo: campos.titulo.value.trim(), descripcion: campos.descripcion.value.trim(),
      tipo: form.tipo.value, enlace: campos.enlace.value.trim(), autoriza: campos.autoriza.checked ? "SI" : "NO"
    };
  }
  function guardarBorrador() { try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(leerMeta())); } catch (e) { /* ignorar */ } }
  function borrarBorrador() { try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* ignorar */ } }
  function restaurarBorrador() {
    let b = null;
    try { b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || "null"); } catch (e) { /* ignorar */ }
    if (!b) return;
    ["nombre", "documento", "correo", "whatsapp", "zona", "grupo", "titulo", "descripcion", "enlace"].forEach(k => { if (b[k]) campos[k].value = b[k]; });
    if (b.pais) campos.pais.value = b.pais;
    if (b.tipo === "enlace") { form.querySelector('input[value="enlace"]').checked = true; form.querySelector('input[value="enlace"]').dispatchEvent(new Event("change")); }
    UI.toast("Recuperamos los datos que habías escrito.", "", 3500);
  }
  form.addEventListener("input", guardarBorrador);
  form.addEventListener("change", guardarBorrador);

  /* ---------- Validación ---------- */
  function validarFormulario() {
    const v = UI.validar;
    let ok = true;
    ok = v.minimo(campos.nombre, 3, "El nombre") && ok;
    ok = v.documento(campos.documento) && ok;
    ok = v.correo(campos.correo, false) && ok;
    ok = v.telefono(campos.whatsapp) && ok;
    ok = v.requerido(campos.pais, "El país") && ok;
    ok = v.minimo(campos.zona, 2, "La zona o sede") && ok;
    ok = v.minimo(campos.titulo, 3, "El título") && ok;
    if (form.tipo.value === "archivo") {
      const errorEl = $("#campo-archivo .error");
      if (!archivoActual) { errorEl.textContent = "Selecciona el archivo de tu video."; ok = false; }
    } else {
      ok = v.url(campos.enlace) && ok;
    }
    ok = v.check(campos.autoriza, "Debes autorizar el uso del video para continuar.") && ok;
    if (!ok) UI.enfocarPrimerError(form);
    return ok;
  }

  /* ---------- Envío ---------- */
  function mostrarProgreso(fraccion, texto) {
    $("#progreso-relleno").style.width = Math.round(fraccion * 100) + "%";
    $("#progreso-porcentaje").textContent = Math.round(fraccion * 100) + "%";
    if (texto) $("#progreso-estado").textContent = texto;
  }
  function bloquear(b) {
    subiendo = b;
    $("#btn-enviar").disabled = b;
    form.querySelectorAll("input, select, textarea, button").forEach(el => { if (el.id !== "btn-enviar") el.disabled = b; });
  }
  window.addEventListener("beforeunload", e => { if (subiendo) { e.preventDefault(); e.returnValue = ""; } });

  async function enviar() {
    if (subiendo) return;
    if (!validarFormulario()) return;
    const meta = leerMeta();
    panelError.hidden = true; panelExito.hidden = true;
    bloquear(true);
    try {
      let resultado;
      if (meta.tipo === "archivo") {
        panelProgreso.hidden = false;
        mostrarProgreso(0, "Preparando…");
        panelProgreso.scrollIntoView({ behavior: "smooth", block: "center" });
        resultado = await window.Subida.subirVideo({ archivo: archivoActual, meta, onProgreso: mostrarProgreso });
      } else {
        $("#btn-enviar").innerHTML = '<span class="spinner"></span> Enviando…';
        resultado = await window.Api.entregas.enlace({ meta });
      }
      mostrarExito(resultado, meta);
    } catch (err) {
      console.error(err);
      panelProgreso.hidden = true;
      $("#error-mensaje").textContent = err.message || "Error desconocido.";
      const respaldo = $("#enlace-respaldo");
      if (C.FORM_RESPALDO_URL) { respaldo.href = C.FORM_RESPALDO_URL; respaldo.hidden = false; }
      panelError.hidden = false;
      panelError.scrollIntoView({ behavior: "smooth", block: "center" });
      UI.toast("No se pudo enviar. Revisa el mensaje y reintenta.", "error");
    } finally {
      bloquear(false);
      $("#btn-enviar").textContent = "Enviar mi proyecto";
    }
  }

  function mostrarExito(r, meta) {
    panelProgreso.hidden = true;
    form.hidden = true;
    $("#radicado").textContent = r.radicado;
    $("#exito-detalle").innerHTML = "Entrega de <strong>" + UI.escapar(meta.nombre) + "</strong> · documento " + UI.escapar(meta.documento) +
      (meta.tipo === "archivo" && archivoActual ? " · " + UI.escapar(archivoActual.name) + " (" + UI.formatoMB(archivoActual.size) + ")" : " · enlace") +
      ". Estado: <strong>" + UI.escapar(r.estado || "Recibido") + "</strong>.";
    $("#exito-demo").hidden = modo !== "demo";
    panelExito.hidden = false;
    panelExito.focus();
    panelExito.scrollIntoView({ behavior: "smooth", block: "start" });
    borrarBorrador();
    UI.toast("¡Entrega recibida! Radicado " + r.radicado, "exito", 6000);
  }

  form.addEventListener("submit", e => { e.preventDefault(); enviar(); });
  $("#btn-reintentar").addEventListener("click", () => { panelError.hidden = true; enviar(); });
  $("#btn-otro").addEventListener("click", () => {
    panelExito.hidden = true;
    form.hidden = false;
    campos.titulo.value = ""; campos.descripcion.value = ""; campos.enlace.value = "";
    campos.archivo.value = ""; archivoActual = null; cajaArchivo.hidden = true;
    campos.autoriza.checked = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
