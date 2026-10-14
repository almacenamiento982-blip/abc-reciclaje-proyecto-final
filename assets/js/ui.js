/* ==========================================================================
   Utilidades de interfaz compartidas: cabecera, pie, toasts, validación.
   ========================================================================== */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;

  const PAGINAS = [
    { id: "inicio", href: "index.html", texto: "Inicio" },
    { id: "instructivo", href: "instructivo.html", texto: "1 · Instructivo" },
    { id: "envio", href: "envio.html", texto: "2 · Enviar video" },
    { id: "calificacion", href: "calificacion.html", texto: "3 · Mi calificación" },
    { id: "arboles", href: "arboles.html", texto: "Árboles sembrados" }
  ];

  function escapar(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderCabecera(activa) {
    const cont = document.querySelector("[data-cabecera]");
    if (!cont) return;
    const enlaces = PAGINAS.map(p =>
      `<li><a class="nav__enlace" href="${p.href}" ${p.id === activa ? 'aria-current="page"' : ""}>${p.texto}</a></li>`
    ).join("");
    cont.innerHTML = `
      <div class="contenedor">
        <div class="cabecera__barra">
          <a class="marca" href="index.html" aria-label="${escapar(C.CURSO)} · Inicio">
            <span class="marca__wordmark"><span class="camp">CAMP</span><span class="us">US</span></span>
            ${C.LOGO_URL ? `<img class="marca__logo" src="${escapar(C.LOGO_URL)}" alt="Fundación Internacional María Luisa de Moreno">` : ""}
            <span class="marca__sep" aria-hidden="true"></span>
            <span class="marca__curso"><small>Curso</small>${escapar(C.CURSO)}</span>
          </a>
          <div class="cabecera__acciones">
            <span data-chip-estado></span>
            <button class="menu-boton" type="button" aria-expanded="false" aria-controls="nav-principal" aria-label="Abrir menú">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
          </div>
        </div>
        <nav class="nav" id="nav-principal" aria-label="Navegación principal"><ul class="nav__lista">${enlaces}</ul></nav>
      </div>`;
    const boton = cont.querySelector(".menu-boton");
    const nav = cont.querySelector(".nav");
    boton.addEventListener("click", () => {
      const abierta = nav.classList.toggle("nav--abierta");
      boton.setAttribute("aria-expanded", String(abierta));
    });
  }

  function renderPie() {
    const cont = document.querySelector("[data-pie]");
    if (!cont) return;
    cont.innerHTML = `
      <div class="contenedor pie-pagina__filas">
        <span class="pie-pagina__marca"><img src="assets/img/logo-fimlm.png" alt="" width="36" height="36">${escapar(C.CURSO)} · ${escapar(C.ORGANIZACION)}</span>
        <span><a href="docentes.html">Panel docente</a> · Prototipo v${escapar(C.VERSION)}</span>
      </div>`;
  }

  function renderChipEstado(modo) {
    document.querySelectorAll("[data-chip-estado]").forEach(el => {
      if (modo === "demo") {
        el.innerHTML = `<span class="chip chip--demo" title="Los envíos se guardan solo en este navegador"><span class="chip__punto"></span><span class="chip__largo">Modo demostración</span><span class="chip__corto">Demo</span></span>`;
      } else if (modo === "conectado") {
        el.innerHTML = `<span class="chip chip--ok" title="Conectado al backend de Google"><span class="chip__punto"></span>Conectado</span>`;
      } else if (modo === "error") {
        el.innerHTML = `<span class="chip chip--error" title="No se pudo contactar el backend"><span class="chip__punto"></span>Sin conexión</span>`;
      } else {
        el.innerHTML = "";
      }
    });
  }

  let contToasts;
  function toast(mensaje, tipo, duracion) {
    if (!contToasts) {
      contToasts = document.createElement("div");
      contToasts.className = "toasts";
      contToasts.setAttribute("aria-live", "polite");
      document.body.appendChild(contToasts);
    }
    const t = document.createElement("div");
    t.className = "toast" + (tipo ? " toast--" + tipo : "");
    t.textContent = mensaje;
    contToasts.appendChild(t);
    setTimeout(() => t.remove(), duracion || 4200);
  }

  /* ---------- Validación ---------- */
  const reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const reUrl = /^https?:\/\/[^\s]+\.[^\s]+$/i;

  function marcarError(input, mensaje) {
    const campo = input.closest(".campo");
    const err = campo ? campo.querySelector(".error") : null;
    if (mensaje) {
      input.setAttribute("aria-invalid", "true");
      if (err) err.textContent = mensaje;
    } else {
      input.removeAttribute("aria-invalid");
      if (err) err.textContent = "";
    }
    return !mensaje;
  }

  const validar = {
    requerido(input, nombre) {
      return marcarError(input, input.value.trim() ? "" : `${nombre} no puede quedar vacío.`);
    },
    minimo(input, n, nombre) {
      const v = input.value.trim();
      if (!v) return marcarError(input, `${nombre} no puede quedar vacío.`);
      return marcarError(input, v.length >= n ? "" : `${nombre} debe tener al menos ${n} caracteres.`);
    },
    documento(input) {
      const v = input.value.trim();
      if (!v) return marcarError(input, "El número de documento es obligatorio.");
      if (!/^[A-Za-z0-9.\-]{4,20}$/.test(v)) return marcarError(input, "Escribe solo números o letras (4 a 20 caracteres), sin espacios.");
      return marcarError(input, "");
    },
    correo(input, opcional) {
      const v = input.value.trim();
      if (!v) return marcarError(input, opcional ? "" : "El correo es obligatorio.");
      return marcarError(input, reCorreo.test(v) ? "" : "Escribe un correo válido, por ejemplo nombre@correo.com.");
    },
    telefono(input) {
      const v = input.value.trim();
      if (!v) return marcarError(input, "");
      return marcarError(input, /^[+\d][\d\s\-()]{6,19}$/.test(v) ? "" : "Escribe un número válido (solo dígitos, puede iniciar con +).");
    },
    url(input) {
      const v = input.value.trim();
      if (!v) return marcarError(input, "Pega el enlace de tu video.");
      return marcarError(input, reUrl.test(v) ? "" : "El enlace debe empezar por http:// o https://.");
    },
    check(input, mensaje) {
      return marcarError(input, input.checked ? "" : mensaje);
    },
    limpiar(input) { marcarError(input, ""); }
  };

  function enfocarPrimerError(form) {
    const primero = form.querySelector('[aria-invalid="true"]');
    if (primero) { primero.focus(); primero.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  function limpiarErroresAlEscribir(form) {
    form.querySelectorAll("input, select, textarea").forEach(el => {
      el.addEventListener("input", () => validar.limpiar(el));
      el.addEventListener("change", () => validar.limpiar(el));
    });
  }

  /* ---------- Formatos ---------- */
  function formatoMB(bytes) {
    if (!bytes && bytes !== 0) return "";
    const mb = bytes / (1024 * 1024);
    return mb >= 100 ? Math.round(mb) + " MB" : mb.toFixed(1) + " MB";
  }
  function formatoFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  function claseEstado(estado) {
    const e = String(estado || "").toLowerCase();
    if (e.includes("calific")) return "estado--calificado";
    if (e.includes("revis")) return "estado--revision";
    if (e.includes("recib")) return "estado--recibido";
    if (e.includes("devuel")) return "estado--devuelto";
    return "estado--iniciado";
  }
  function llenarSelect(select, opciones, placeholder) {
    select.innerHTML = (placeholder ? `<option value="">${escapar(placeholder)}</option>` : "") +
      opciones.map(o => `<option value="${escapar(o)}">${escapar(o)}</option>`).join("");
  }

  async function iniciarPagina(activa) {
    renderCabecera(activa);
    renderPie();
    const estado = await window.Api.estado();
    renderChipEstado(estado.modo);
    return estado;
  }

  window.UI = {
    escapar, toast, validar, enfocarPrimerError, limpiarErroresAlEscribir,
    formatoMB, formatoFecha, claseEstado, llenarSelect, iniciarPagina, renderChipEstado
  };
})();
