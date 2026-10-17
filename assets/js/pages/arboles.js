/* Mapa del mundo y fotos de los árboles sembrados + registro de un árbol nuevo. */
(function () {
  "use strict";
  const C = window.ABC_CONFIG;
  const $ = s => document.querySelector(s);
  const form = $("#form-arbol");
  const campos = {
    nombre: $("#a-nombre"), documento: $("#a-documento"), especie: $("#a-especie"), ciudad: $("#a-ciudad"), pais: $("#a-pais"),
    mensaje: $("#a-mensaje"), foto: $("#a-foto"), autoriza: $("#a-autoriza")
  };
  let fotoComprimida = null;
  let coords = null;
  let mapa = null, capaMarcadores = null;
  let modo = "demo";

  UI.llenarSelect(campos.pais, C.PAISES, "Selecciona el país");
  UI.limpiarErroresAlEscribir(form);

  iniciarMapa();
  UI.iniciarPagina("arboles").then(estado => {
    modo = estado.modo;
    if (modo === "demo") {
      $("[data-aviso-modo]").innerHTML = '<div class="aviso aviso--alerta"><span class="aviso__icono">🧪</span><div><p><strong>Modo demostración.</strong> Los árboles que ves son ejemplos y los que registres se guardan solo en este navegador.</p></div></div>';
    }
    cargar();
  });

  /* ---------- Mapa ---------- */
  function iniciarMapa() {
    if (mapa || typeof L === "undefined") return;
    mapa = L.map("mapa", { scrollWheelZoom: false }).setView([5, -60], 3);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);
    capaMarcadores = L.layerGroup().addTo(mapa);
  }
  const iconoArbol = () => L.divIcon({ className: "", html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">🌳</div>', iconSize: [26, 26], iconAnchor: [13, 24] });

  function coordenadasDe(a) {
    const lat = parseFloat(a.lat), lng = parseFloat(a.lng);
    if (!isNaN(lat) && !isNaN(lng) && (lat || lng)) return [lat, lng, true];
    const c = C.CENTROIDES[a.pais];
    if (c) return [c[0] + (Math.random() - 0.5) * 0.6, c[1] + (Math.random() - 0.5) * 0.6, false];
    return null;
  }

  function fotoSrc(a) {
    return a.fotoUrl || "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e4f2dd"/><text x="200" y="170" font-size="90" text-anchor="middle">🌱</text></svg>');
  }

  function pintar(arboles) {
    const galeria = $("#galeria");
    $("#cont-arboles").textContent = arboles.length;
    if (!arboles.length && mapa) mapa.setView([5, -60], 3);
    $("#cont-paises").textContent = new Set(arboles.map(a => a.pais).filter(Boolean)).size;
    if (!arboles.length) {
      galeria.innerHTML = '<p class="texto-suave">Todavía no hay árboles registrados. ¡Sé el primero!</p>';
    } else {
      galeria.innerHTML = arboles.map(a => `
        <article class="arbol">
          <img class="arbol__foto" src="${UI.escapar(fotoSrc(a))}" alt="Árbol sembrado por ${UI.escapar(a.nombre)}" loading="lazy">
          <div class="arbol__cuerpo">
            <strong>${UI.escapar(a.nombre)}</strong>
            ${a.especie ? `<span class="arbol__especie">🌱 ${UI.escapar(a.especie)}</span>` : ""}
            <span class="arbol__lugar">📍 ${UI.escapar([a.ciudad, a.pais].filter(Boolean).join(", "))} · ${UI.escapar(UI.formatoFecha(a.fecha).split(" · ")[0])}</span>
            ${a.mensaje ? `<p class="arbol__mensaje">${UI.escapar(a.mensaje)}</p>` : ""}
          </div>
        </article>`).join("");
    }
    iniciarMapa();
    if (!mapa) return;
    capaMarcadores.clearLayers();
    const puntos = [];
    arboles.forEach(a => {
      const c = coordenadasDe(a);
      if (!c) return;
      puntos.push([c[0], c[1]]);
      L.marker([c[0], c[1]], { icon: iconoArbol() })
        .bindPopup(`<strong>${UI.escapar(a.nombre)}</strong><br>${a.especie ? "🌱 " + UI.escapar(a.especie) + "<br>" : ""}${UI.escapar([a.ciudad, a.pais].filter(Boolean).join(", "))}${c[2] ? "" : " (ubicación aproximada)"}${a.fotoUrl ? `<br><img src="${UI.escapar(a.fotoUrl)}" alt="" style="width:160px;margin-top:6px;border-radius:8px">` : ""}`)
        .addTo(capaMarcadores);
    });
    if (puntos.length) mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 6 });
  }

  async function cargar() {
    try {
      const r = await window.Api.arboles.listar();
      pintar(r.arboles || []);
    } catch (err) {
      $("#galeria").innerHTML = `<div class="aviso aviso--error"><span class="aviso__icono">⚠️</span><div><p>No se pudieron cargar los árboles. ${UI.escapar(err.message)}</p></div></div>`;
      iniciarMapa();
    }
  }

  /* ---------- Formulario ---------- */
  $("#btn-ubicacion").addEventListener("click", () => {
    const txt = $("#ubicacion-texto");
    if (!navigator.geolocation) { txt.textContent = "Tu navegador no permite compartir la ubicación."; return; }
    txt.textContent = "Obteniendo ubicación…";
    navigator.geolocation.getCurrentPosition(pos => {
      coords = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
      txt.textContent = "Ubicación capturada: " + coords.lat + ", " + coords.lng;
    }, () => { txt.textContent = "No se pudo obtener la ubicación. Ubicaremos tu árbol por país."; }, { timeout: 10000 });
  });

  campos.foto.addEventListener("change", async () => {
    const f = campos.foto.files[0];
    const errorEl = campos.foto.closest(".campo").querySelector(".error");
    errorEl.textContent = ""; fotoComprimida = null; $("#foto-previa").hidden = true;
    if (!f) return;
    if (!/^image\//.test(f.type)) { errorEl.textContent = "Selecciona una imagen JPG o PNG."; campos.foto.value = ""; return; }
    if (f.size > C.FOTO_MAX_MB * 1024 * 1024) { errorEl.textContent = "La foto pesa más de " + C.FOTO_MAX_MB + " MB."; campos.foto.value = ""; return; }
    try {
      fotoComprimida = await window.Subida.comprimirImagen(f);
      $("#foto-previa").src = fotoComprimida.vistaPrevia;
      $("#foto-previa").hidden = false;
    } catch (err) { errorEl.textContent = err.message; }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const v = UI.validar;
    let ok = true;
    ok = v.minimo(campos.nombre, 3, "El nombre") && ok;
    ok = v.documento(campos.documento) && ok;
    ok = v.minimo(campos.especie, 2, "El nombre de la planta o especie") && ok;
    ok = v.minimo(campos.ciudad, 2, "La ciudad") && ok;
    ok = v.requerido(campos.pais, "El país") && ok;
    const errorFoto = campos.foto.closest(".campo").querySelector(".error");
    if (!fotoComprimida) { errorFoto.textContent = "Selecciona la foto de tu árbol."; ok = false; }
    ok = v.check(campos.autoriza, "Debes autorizar la publicación para continuar.") && ok;
    if (!ok) { UI.enfocarPrimerError(form); return; }

    const btn = $("#btn-arbol");
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publicando…';
    const res = $("#arbol-resultado"); res.innerHTML = "";
    try {
      const meta = {
        nombre: campos.nombre.value.trim(), documento: campos.documento.value.trim(), especie: campos.especie.value.trim(), ciudad: campos.ciudad.value.trim(),
        pais: campos.pais.value, mensaje: campos.mensaje.value.trim(), lat: coords ? coords.lat : "", lng: coords ? coords.lng : "", autoriza: "SI"
      };
      const r = await window.Api.arboles.registrar({ meta, foto: { nombre: fotoComprimida.nombre, tipo: fotoComprimida.tipo, tamano: fotoComprimida.tamano, datos: fotoComprimida.datos } });
      res.innerHTML = `<div class="aviso aviso--exito"><span class="aviso__icono">🌳</span><div><p><strong>¡Tu árbol ya está en el mapa del mundo!</strong> Registro ${UI.escapar(r.id)}.</p>${modo === "demo" ? "<p>Modo demostración: se guardó solo en este navegador.</p>" : ""}</div></div>`;
      UI.toast("Árbol publicado", "exito");
      form.reset(); fotoComprimida = null; coords = null; $("#foto-previa").hidden = true; $("#ubicacion-texto").textContent = "Si no la compartes, ubicaremos tu árbol por país.";
      await cargar();
      document.getElementById("galeria").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      res.innerHTML = `<div class="aviso aviso--error"><span class="aviso__icono">⚠️</span><div><p><strong>No se pudo publicar.</strong> ${UI.escapar(err.message)}</p><p>Tus datos siguen en el formulario; inténtalo de nuevo.</p></div></div>`;
    } finally {
      btn.disabled = false; btn.textContent = "Publicar mi árbol";
    }
  });
})();
