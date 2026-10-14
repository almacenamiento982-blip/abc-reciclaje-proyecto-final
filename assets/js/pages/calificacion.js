/* Página de consulta de calificación. */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const $ = s => document.querySelector(s);
  const form = $("#form-consulta");
  const doc = $("#documento");
  const correo = $("#correo");
  const resultados = $("#resultados");
  UI.limpiarErroresAlEscribir(form);

  UI.iniciarPagina("calificacion").then(estado => {
    if (estado.modo !== "demo") form.querySelector(".acciones .texto-suave").remove();
    const params = new URLSearchParams(location.search);
    if (params.get("documento")) { doc.value = params.get("documento"); consultar(); }
  });

  function tarjetaEntrega(e) {
    const calificada = /calific/i.test(e.estado || "");
    const notaHtml = calificada && e.nota !== "" && e.nota != null
      ? `<div class="nota">${UI.escapar(e.nota)} <small>/ ${C.NOTA_MAX}</small></div>` : "";
    const retroHtml = calificada && e.retroalimentacion
      ? `<div><h3>Retroalimentación</h3><div class="retro">${UI.escapar(e.retroalimentacion)}</div></div>`
      : `<div class="aviso aviso--info"><span class="aviso__icono">⏳</span><div><p>Tu video fue recibido y está pendiente de revisión por parte de tus profesores. Vuelve a consultar más adelante.</p></div></div>`;
    return `
      <article class="tarjeta resultado-calificacion">
        <div class="resultado-calificacion__cabecera">
          <div>
            <h2 class="mb-0">${UI.escapar(e.titulo || "Proyecto final")}</h2>
            <div class="meta"><span>Radicado <strong>${UI.escapar(e.radicado)}</strong></span><span>Enviado ${UI.escapar(UI.formatoFecha(e.fecha))}</span>${e.zona ? `<span>${UI.escapar(e.zona)}</span>` : ""}</div>
          </div>
          <span class="estado ${UI.claseEstado(e.estado)}">${UI.escapar(e.estado || "Recibido")}</span>
        </div>
        ${notaHtml}
        ${retroHtml}
        ${calificada ? `<div class="meta">${e.docente ? `<span>Calificó: <strong>${UI.escapar(e.docente)}</strong></span>` : ""}${e.fechaCalificacion ? `<span>${UI.escapar(UI.formatoFecha(e.fechaCalificacion))}</span>` : ""}</div>` : ""}
      </article>`;
  }

  async function consultar() {
    if (!UI.validar.documento(doc) || !UI.validar.correo(correo, true)) { UI.enfocarPrimerError(form); return; }
    const btn = $("#btn-consultar");
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Consultando…';
    resultados.innerHTML = "";
    try {
      const r = await window.Api.entregas.consultar({ documento: doc.value.trim(), correo: correo.value.trim() });
      if (!r.entregas || !r.entregas.length) {
        resultados.innerHTML = `<div class="aviso aviso--alerta"><span class="aviso__icono">🔎</span><div>
          <p><strong>No encontramos entregas con ese documento.</strong></p>
          <p>Revisa que el número esté bien escrito, sin puntos ni espacios. Si acabas de enviar tu video, espera unos minutos. Si aún no lo has enviado, <a href="envio.html">hazlo aquí</a>.</p></div></div>`;
      } else {
        resultados.innerHTML = r.entregas.map(tarjetaEntrega).join("");
      }
    } catch (err) {
      resultados.innerHTML = `<div class="aviso aviso--error"><span class="aviso__icono">⚠️</span><div><p><strong>No se pudo consultar.</strong></p><p>${UI.escapar(err.message)}</p></div></div>`;
    } finally {
      btn.disabled = false; btn.textContent = "Consultar";
    }
  }

  form.addEventListener("submit", e => { e.preventDefault(); consultar(); });
})();
