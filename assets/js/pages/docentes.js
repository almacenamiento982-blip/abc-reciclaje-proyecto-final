/* Panel docente: listado, filtros, calificación y moderación del mapa de árboles. */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const $ = s => document.querySelector(s);
  const formClave = $("#form-clave");
  const panel = $("#panel");
  let clave = "", docente = "";
  let entregas = [], arboles = [];
  let actual = null;

  try { clave = sessionStorage.getItem("abc_docente_clave") || ""; docente = localStorage.getItem("abc_docente_nombre") || ""; } catch (e) { /* ignorar */ }
  $("#clave").value = clave; $("#docente").value = docente;
  $("#m-escala").textContent = C.NOTA_MIN + " a " + C.NOTA_MAX;
  $("#m-nota").min = C.NOTA_MIN; $("#m-nota").max = C.NOTA_MAX;
  UI.limpiarErroresAlEscribir(formClave);
  UI.limpiarErroresAlEscribir($("#form-calificar"));

  UI.iniciarPagina("docentes").then(estado => {
    if (estado.modo === "demo") $("#clave-ayuda").innerHTML = "Modo demostración · clave: <strong>" + UI.escapar(C.CLAVE_DEMO) + "</strong>";
    if (clave) cargar();
  });

  /* ---------- Carga ---------- */
  async function cargar() {
    const btn = $("#btn-entrar");
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Cargando…';
    try {
      const r = await window.Api.docentes.listar({ clave });
      entregas = r.entregas || []; arboles = r.arboles || [];
      try { sessionStorage.setItem("abc_docente_clave", clave); localStorage.setItem("abc_docente_nombre", docente); } catch (e) { /* ignorar */ }
      panel.hidden = false;
      llenarZonas(); pintarEntregas(); pintarArboles();
    } catch (err) {
      UI.validar.limpiar($("#clave"));
      $("#clave").setAttribute("aria-invalid", "true");
      $("#clave").closest(".campo").querySelector(".error").textContent = err.message;
      panel.hidden = true;
    } finally { btn.disabled = false; btn.textContent = "Entrar"; }
  }
  formClave.addEventListener("submit", e => {
    e.preventDefault();
    clave = $("#clave").value.trim(); docente = $("#docente").value.trim();
    if (!clave) { UI.validar.requerido($("#clave"), "La clave"); return; }
    cargar();
  });
  $("#btn-recargar").addEventListener("click", cargar);

  /* ---------- Entregas ---------- */
  function llenarZonas() {
    const zonas = [...new Set(entregas.map(e => e.zona).filter(Boolean))].sort();
    const sel = $("#f-zona"); const valor = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + zonas.map(z => `<option>${UI.escapar(z)}</option>`).join("");
    sel.value = valor;
  }
  const CAL = C.MOSTRAR_CALIFICACION;
  function filtradas() {
    const t = $("#f-texto").value.trim().toLowerCase();
    const est = CAL && $("#f-estado") ? $("#f-estado").value : ""; const zona = $("#f-zona").value;
    return entregas.filter(e =>
      (!est || e.estado === est) && (!zona || e.zona === zona) &&
      (!t || [e.nombre, e.documento, e.radicado, e.titulo, e.correo].some(v => String(v || "").toLowerCase().includes(t)))
    );
  }
  function enlaceVideo(e) {
    if (e.tipo === "enlace" && e.enlace) return `<a href="${UI.escapar(e.enlace)}" target="_blank" rel="noopener">Abrir enlace ↗</a>`;
    if (e.enlace) return `<a href="${UI.escapar(e.enlace)}" target="_blank" rel="noopener">Ver en Drive ↗</a>`;
    if (e.archivoId && e.archivoId !== "demo-sin-archivo") return `<a href="https://drive.google.com/file/d/${UI.escapar(e.archivoId)}/view" target="_blank" rel="noopener">Ver en Drive ↗</a>`;
    if (e.archivoId === "demo-sin-archivo") return '<span class="texto-suave">Demo · sin archivo</span>';
    return '<span class="texto-suave">' + UI.escapar(e.estado === "Subiendo" ? "Subida incompleta" : "Sin archivo") + "</span>";
  }
  function pintarEntregas() {
    const lista = filtradas();
    $("#c-total").textContent = entregas.length;
    if (CAL) {
      $("#c-calificadas").textContent = entregas.filter(e => e.estado === "Calificado").length;
      $("#c-pendientes").textContent = entregas.filter(e => e.estado === "Recibido" || e.estado === "En revisión").length;
    }
    const tb = $("#tabla-entregas");
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="7" class="texto-suave">No hay entregas que coincidan.</td></tr>'; return; }
    tb.innerHTML = lista.map(e => `
      <tr>
        <td data-etiqueta="Radicado"><span><strong>${UI.escapar(e.radicado)}</strong><br><small class="texto-suave">${UI.escapar(UI.formatoFecha(e.fecha))}</small></span></td>
        <td data-etiqueta="Estudiante"><span>${UI.escapar(e.nombre)}<br><small class="texto-suave">${e.documento ? "Doc. " + UI.escapar(e.documento) + (e.correo ? " · " : "") : ""}${e.correo ? UI.escapar(e.correo) : ""}</small></span></td>
        <td data-etiqueta="Zona"><span>${UI.escapar(e.zona || "")}<br><small class="texto-suave">${UI.escapar(e.grupo || e.pais || "")}</small></span></td>
        <td data-etiqueta="Video"><span>${UI.escapar(e.titulo || "")}${e.titulo ? "<br>" : ""}<small>${enlaceVideo(e)}${e.tamanoMB ? ` <span class="texto-suave">· ${UI.escapar(e.tamanoMB)} MB</span>` : ""}</small>${e.sentimiento || e.descripcion ? `<details class="mt-1"><summary style="cursor:pointer;font-size:.8rem;color:var(--verde-600)">Ver respuestas</summary><small>${e.sentimiento ? `<strong>¿Cómo te sentiste?</strong> ${UI.escapar(e.sentimiento)}<br>` : ""}${e.descripcion ? `<strong>Adicional:</strong> ${UI.escapar(e.descripcion)}` : ""}</small></details>` : ""}</span></td>
        <td data-etiqueta="Estado"><span class="estado ${UI.claseEstado(e.estado)}">${UI.escapar(e.estado)}</span></td>
        ${CAL ? `<td data-etiqueta="Nota">${e.nota !== "" && e.nota != null ? "<strong>" + UI.escapar(e.nota) + "</strong>" : "–"}</td>` : ""}
        <td><div class="acciones" style="gap:6px;flex-wrap:nowrap">${CAL ? `<button type="button" class="btn btn--primario btn--pequeno" data-calificar="${UI.escapar(e.radicado)}">${e.estado === "Calificado" ? "Editar" : "Calificar"}</button>` : ""}<button type="button" class="btn btn--peligro btn--pequeno" data-eliminar="${UI.escapar(e.radicado)}" title="Eliminar esta entrega y su video">Eliminar</button></div></td>
      </tr>`).join("");
    tb.querySelectorAll("[data-calificar]").forEach(b => b.addEventListener("click", () => abrirModal(b.dataset.calificar)));
    tb.querySelectorAll("[data-eliminar]").forEach(b => b.addEventListener("click", () => eliminarEntrega(b.dataset.eliminar, b)));
  }
  ["f-texto", "f-estado", "f-zona"].forEach(id => { const el = $("#" + id); if (el) el.addEventListener("input", pintarEntregas); });

  async function eliminarEntrega(radicado, boton) {
    const e = entregas.find(x => x.radicado === radicado);
    if (!e) return;
    const ok = window.confirm("¿Eliminar la entrega " + radicado + " de " + e.nombre + "? Se borrará la fila del registro y el video pasará a la papelera de Drive. Esta acción no se puede deshacer desde aquí.");
    if (!ok) return;
    boton.disabled = true; boton.textContent = "Eliminando…";
    try {
      await window.Api.docentes.eliminar({ clave, radicado });
      entregas = entregas.filter(x => x.radicado !== radicado);
      llenarZonas(); pintarEntregas();
      UI.toast("Entrega " + radicado + " eliminada", "exito");
    } catch (err) {
      UI.toast(err.message, "error", 6000);
      boton.disabled = false; boton.textContent = "Eliminar";
    }
  }

  /* ---------- Modal ---------- */
  const modal = $("#modal");
  function abrirModal(radicado) {
    actual = entregas.find(e => e.radicado === radicado);
    if (!actual) return;
    $("#modal-sub").textContent = actual.radicado + " · " + actual.nombre + " · Doc. " + actual.documento;
    $("#modal-video").innerHTML = `<div class="aviso aviso--info"><span class="aviso__icono">🎬</span><div><p><strong>${UI.escapar(actual.titulo || "")}</strong> ${enlaceVideo(actual)}</p>${actual.descripcion ? `<p>${UI.escapar(actual.descripcion)}</p>` : ""}</div></div>`;
    $("#m-nota").value = actual.nota != null ? actual.nota : "";
    $("#m-estado").value = actual.estado === "Calificado" || actual.estado === "Devuelto" || actual.estado === "En revisión" ? actual.estado : "Calificado";
    $("#m-retro").value = actual.retroalimentacion || "";
    modal.hidden = false;
    $("#m-nota").focus();
  }
  function cerrarModal() { modal.hidden = true; actual = null; }
  $("#modal-cerrar").addEventListener("click", cerrarModal);
  $("#m-cancelar").addEventListener("click", cerrarModal);
  modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) cerrarModal(); });

  $("#form-calificar").addEventListener("submit", async e => {
    e.preventDefault();
    if (!actual) return;
    const notaEl = $("#m-nota"), retroEl = $("#m-retro"), estado = $("#m-estado").value;
    let ok = true;
    const nota = notaEl.value.trim() === "" ? "" : parseFloat(notaEl.value);
    if (estado === "Calificado") {
      if (nota === "" || isNaN(nota) || nota < C.NOTA_MIN || nota > C.NOTA_MAX) {
        notaEl.setAttribute("aria-invalid", "true"); notaEl.closest(".campo").querySelector(".error").textContent = "Escribe una nota entre " + C.NOTA_MIN + " y " + C.NOTA_MAX + "."; ok = false;
      }
      if (retroEl.value.trim().length < 10) {
        retroEl.setAttribute("aria-invalid", "true"); retroEl.closest(".campo").querySelector(".error").textContent = "Escribe una retroalimentación de al menos 10 caracteres."; ok = false;
      }
    }
    if (!ok) return;
    const btn = $("#m-guardar");
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Guardando…';
    try {
      await window.Api.docentes.calificar({ clave, radicado: actual.radicado, nota, retroalimentacion: retroEl.value.trim(), docente: docente || "Equipo docente", estado });
      actual.nota = nota; actual.retroalimentacion = retroEl.value.trim(); actual.estado = estado; actual.docente = docente; actual.fechaCalificacion = new Date().toISOString();
      UI.toast("Calificación guardada para " + actual.radicado, "exito");
      cerrarModal(); pintarEntregas();
    } catch (err) {
      UI.toast(err.message, "error", 6000);
    } finally { btn.disabled = false; btn.textContent = "Guardar calificación"; }
  });

  /* ---------- Árboles ---------- */
  function pintarArboles() {
    const tb = $("#tabla-arboles");
    if (!arboles.length) { tb.innerHTML = '<tr><td colspan="6" class="texto-suave">No hay árboles registrados.</td></tr>'; return; }
    tb.innerHTML = arboles.map(a => `
      <tr>
        <td data-etiqueta="ID"><span>${UI.escapar(a.id)}<br><small class="texto-suave">${UI.escapar(UI.formatoFecha(a.fecha))}</small></span></td>
        <td data-etiqueta="Nombre"><span>${UI.escapar(a.nombre)}<br><small class="texto-suave">Doc. ${UI.escapar(a.documento || "")}</small></span></td>
        <td data-etiqueta="Especie · Lugar"><span>${a.especie ? "🌱 " + UI.escapar(a.especie) + "<br>" : ""}<small class="texto-suave">${UI.escapar([a.ciudad, a.pais].filter(Boolean).join(", "))}</small></span></td>
        <td data-etiqueta="Mensaje"><span>${UI.escapar(a.mensaje || "")}${a.fotoUrl ? ` <a href="${UI.escapar(a.fotoUrl)}" target="_blank" rel="noopener">foto ↗</a>` : ""}</span></td>
        <td data-etiqueta="Visible"><span class="estado ${a.publicar === "NO" ? "estado--devuelto" : "estado--calificado"}">${a.publicar === "NO" ? "Oculto" : "Visible"}</span></td>
        <td><div class="acciones" style="gap:6px;flex-wrap:nowrap"><button type="button" class="btn btn--secundario btn--pequeno" data-arbol="${UI.escapar(a.id)}" data-publicar="${a.publicar === "NO" ? "1" : "0"}">${a.publicar === "NO" ? "Mostrar" : "Ocultar"}</button><button type="button" class="btn btn--peligro btn--pequeno" data-eliminar-arbol="${UI.escapar(a.id)}">Eliminar</button></div></td>
      </tr>`).join("");
    tb.querySelectorAll("[data-eliminar-arbol]").forEach(b => b.addEventListener("click", async () => {
      const a = arboles.find(x => x.id === b.dataset.eliminarArbol);
      if (!a || !window.confirm("¿Eliminar el árbol " + a.id + " de " + a.nombre + "? La foto pasará a la papelera de Drive.")) return;
      b.disabled = true;
      try {
        await window.Api.docentes.eliminarArbol({ clave, id: a.id });
        arboles = arboles.filter(x => x.id !== a.id); pintarArboles(); UI.toast("Árbol eliminado", "exito");
      } catch (err) { UI.toast(err.message, "error"); b.disabled = false; }
    }));
    tb.querySelectorAll("[data-arbol]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await window.Api.docentes.publicarArbol({ clave, id: b.dataset.arbol, publicar: b.dataset.publicar === "1" });
        const a = arboles.find(x => x.id === b.dataset.arbol); if (a) a.publicar = b.dataset.publicar === "1" ? "SI" : "NO";
        pintarArboles(); UI.toast("Mapa actualizado", "exito");
      } catch (err) { UI.toast(err.message, "error"); b.disabled = false; }
    }));
  }

  /* ---------- Cambiar clave ---------- */
  $("#form-clave-nueva").addEventListener("submit", async e => {
    e.preventDefault();
    const nueva = $("#clave-nueva").value.trim();
    const el = $("#clave-nueva");
    if (nueva.length < 4) { el.setAttribute("aria-invalid", "true"); el.closest(".campo").querySelector(".error").textContent = "La clave debe tener al menos 4 caracteres."; return; }
    const btn = $("#btn-clave-nueva"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Guardando…';
    try {
      await window.Api.docentes.cambiarClave({ clave, nueva });
      clave = nueva; $("#clave").value = nueva; el.value = "";
      try { sessionStorage.setItem("abc_docente_clave", clave); } catch (err) { /* ignorar */ }
      UI.toast("Clave actualizada. Compártela solo con el equipo docente.", "exito", 6000);
    } catch (err) { UI.toast(err.message, "error", 6000); }
    finally { btn.disabled = false; btn.textContent = "Cambiar clave"; }
  });

  /* ---------- CSV ---------- */
  $("#btn-csv").addEventListener("click", () => {
    const cols = ["radicado", "fecha", "nombre", "documento", "correo", "pais", "zona", "grupo", "titulo", "sentimiento", "descripcion", "tipo", "enlace", "archivoId", "tamanoMB", "estado"].concat(CAL ? ["nota", "retroalimentacion", "docente", "fechaCalificacion"] : []);
    const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "﻿" + cols.join(";") + "\n" + filtradas().map(e => cols.map(c => esc(e[c])).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "entregas-abc-reciclaje.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
})();
