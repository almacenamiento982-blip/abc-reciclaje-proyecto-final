/* ==========================================================================
   Configuración pública del prototipo.
   Aquí NO va ninguna credencial. La URL del Web App de Apps Script es pública
   por diseño (cualquiera con el enlace puede enviar), igual que un Google Form.
   ========================================================================== */
window.ABC_CONFIG = {
  // URL del Web App de Google Apps Script (termina en /exec).
  // Mientras esté vacía, el sitio funciona en MODO DEMOSTRACIÓN: los envíos se
  // guardan solo en el navegador y NO llegan a Google Drive.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby-epPMyQ5z3oieq80_UhuteFj3S4GCznR-YVtVqtBnf9GJo983GwL2hxbrrsMrPwPJOg/exec",

  // Enlace opcional a un Google Form de respaldo (carga de archivos). Si se
  // configura, se ofrece cuando la subida falla repetidamente.
  FORM_RESPALDO_URL: "",

  // Logo opcional de la organización (ruta relativa o URL). Vacío = no se muestra.
  LOGO_URL: "assets/img/logo-fimlm.png",

  // Nombre del curso y de la organización (textos visibles).
  CURSO: "El ABC del Reciclaje",
  ORGANIZACION: "Campus · Fundación Internacional María Luisa de Moreno",

  // La calificación y la retroalimentación se gestionan en otra plataforma.
  // false = se ocultan el paso 3, la consulta y la calificación en el panel docente.
  MOSTRAR_CALIFICACION: false,

  // Fecha límite de entrega (ISO). Vacío = no se muestra.
  FECHA_LIMITE: "",

  // Límites del video del proyecto final.
  VIDEO_MAX_MB: 500,
  VIDEO_DURACION_TEXTO: "mínimo 1 minuto y máximo 4 minutos",
  VIDEO_TIPOS: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp", "video/x-matroska"],
  VIDEO_EXTENSIONES: [".mp4", ".mov", ".webm", ".m4v", ".3gp", ".mkv"],

  // Foto del árbol sembrado.
  FOTO_MAX_MB: 15,
  FOTO_LADO_MAX_PX: 1600,
  FOTO_CALIDAD_JPEG: 0.82,

  // Tamaño de cada fragmento enviado al backend (bytes). 8 MB en binario
  // equivale a ~10.7 MB en base64, por debajo del límite de 50 MB de Apps Script.
  FRAGMENTO_BYTES: 8 * 1024 * 1024,
  // Tamaño de bloque en la subida DIRECTA navegador → Drive (múltiplo de 256 KiB).
  DIRECTO_FRAGMENTO_BYTES: 16 * 1024 * 1024,
  REINTENTOS_FRAGMENTO: 3,

  // Escala de calificación que usa el panel docente.
  NOTA_MIN: 0,
  NOTA_MAX: 5,

  // Zonas o países y sus grupos (día y hora de clase), tomados del formulario
  // oficial "Entrega de Video del Curso ABC del Reciclaje". Editar aquí si
  // cambian los grupos.
  ZONAS: [
    { nombre: "Zona Sur y Llanos", pais: "Colombia", grupos: [
      "Miércoles 9:00am-10:30am (G-4246)", "Sábado 8:00am-9:30am (G-4248)", "Jueves 21:00pm-22:30pm (G-4873)"] },
    { nombre: "Zona de Antioquia y Eje Cafetero", pais: "Colombia", grupos: [
      "Sábado 9:30-11:00am (G-5103)", "Viernes 3:00-4:30pm (G-4739)"] },
    { nombre: "Zona de Bogotá y Cundinamarca", pais: "Colombia", grupos: [
      "Lunes 10:00-11:30am (G-4848)", "Martes 7:00-8:30pm (G-4849)", "Sábado 8:00-9:30am (G-4850)",
      "Sábado 9:00-10:30am (G-4851)", "Viernes 3:00-4:30pm (G-4911)"] },
    { nombre: "Zona de Santanderes y Boyacá", pais: "Colombia", grupos: [
      "Sábado 9:00-10:30am (G-4372)"] },
    { nombre: "Zona Pacífico", pais: "Colombia", grupos: [
      "Martes 20:00-21:30pm (G-4258)", "Jueves 20:00-21:30pm (G-4259)"] },
    { nombre: "Zona Caribe", pais: "Colombia", grupos: [
      "Viernes 16:30-18:00pm (G-4710)"] },
    { nombre: "País España", pais: "España", grupos: [
      "Sábados HORA ESPAÑA 10:00-11:30am (Grupo 4584)"] },
    { nombre: "País Suiza", pais: "Suiza", grupos: [
      "Martes HORA SUIZA 21:00 (G-4409)"] }
  ],

  // Países sugeridos en el formulario de árboles (el Padlet de referencia incluye
  // Colombia, Argentina, Venezuela, Reino Unido y Suiza).
  PAISES: [
    "Colombia", "Argentina", "Venezuela", "Reino Unido", "Suiza",
    "Bolivia", "Brasil", "Chile", "Costa Rica", "Ecuador", "El Salvador", "España", "Estados Unidos",
    "Guatemala", "Honduras", "México", "Nicaragua", "Panamá", "Paraguay", "Perú", "Puerto Rico",
    "República Dominicana", "Uruguay", "Otro"
  ],

  // Coordenadas aproximadas por país para ubicar en el mapa los árboles que
  // no tengan geolocalización exacta.
  CENTROIDES: {
    "Colombia": [4.57, -74.30], "Argentina": [-34.60, -58.38], "Venezuela": [10.48, -66.88],
    "Reino Unido": [51.51, -0.13], "Suiza": [46.95, 7.45], "Bolivia": [-16.50, -68.15], "Brasil": [-15.79, -47.88],
    "Chile": [-33.45, -70.66], "Costa Rica": [9.93, -84.08], "Ecuador": [-0.18, -78.47], "El Salvador": [13.69, -89.19],
    "España": [40.42, -3.70], "Estados Unidos": [38.90, -77.04], "Guatemala": [14.63, -90.51], "Honduras": [14.07, -87.19],
    "México": [19.43, -99.13], "Nicaragua": [12.11, -86.24], "Panamá": [8.98, -79.52], "Paraguay": [-25.26, -57.58],
    "Perú": [-12.05, -77.04], "Puerto Rico": [18.47, -66.11], "República Dominicana": [18.49, -69.93], "Uruguay": [-34.90, -56.16]
  },

  // Clave del panel docente SOLO para el modo demostración. En producción la
  // clave real vive en las propiedades del script de Apps Script, nunca aquí.
  CLAVE_DEMO: "demo2026",

  VERSION: "0.1.0"
};
