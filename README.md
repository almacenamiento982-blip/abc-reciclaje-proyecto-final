# El ABC del Reciclaje · Proyecto Final

Prototipo web para que los estudiantes del curso **El ABC del Reciclaje** (Campus · Fundación
Internacional María Luisa de Moreno) entreguen el video de su proyecto final, consulten su
calificación y, al cierre del curso, compartan la foto del árbol que sembraron.

Reemplaza el Padlet que se usaba en años anteriores (300-400 videos de 2-3 minutos) por una
página propia, con la línea gráfica del curso, que guarda los videos en **Google Drive** y el
registro en **Google Sheets**.

**Demo publicada:** <https://almacenamiento982-blip.github.io/abc-reciclaje-proyecto-final/>

---

## 1. Qué se construyó

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Estudiante | Portada con los 3 pasos y acceso al muro de árboles. |
| `instructivo.html` | Estudiante | Paso 1: qué debe tener el video (texto borrador editable), requisitos técnicos, cómo enviarlo, preguntas frecuentes y las "prendas" de la estrategia de cobertura. |
| `envio.html` | Estudiante | Paso 2: formulario con validaciones, carga del video por fragmentos con barra de progreso y reanudación, o envío por enlace. Entrega un **radicado**. |
| `calificacion.html` | Estudiante | Paso 3: consulta por número de documento del estado, la nota y la retroalimentación. |
| `arboles.html` | Todos | Muro tipo Padlet + mapa (Leaflet/OpenStreetMap) con los árboles sembrados, y formulario para registrar el propio (foto comprimida en el navegador, ubicación opcional). |
| `docentes.html` | Docentes | Panel con clave: lista de entregas, filtros, enlace al video en Drive, calificación con retroalimentación, moderación del muro y descarga CSV. |

Todo es HTML, CSS y JavaScript sin dependencias ni paso de compilación, para que cualquier
persona pueda editarlo y publicarlo en GitHub Pages.

## 2. Cómo funciona (arquitectura)

```
Estudiante (celular/PC)
   │  GitHub Pages (sitio estático, público)
   ▼
assets/js/api.js ──POST JSON──▶ Google Apps Script (Web App, cuenta almacenamiento982@gmail.com)
                                   ├─ Drive: carpeta "ABC del Reciclaje - Proyecto Final 2026"
                                   │     ├─ 01 Videos proyecto final   (videos, privados)
                                   │     └─ 02 Fotos arboles sembrados (fotos, públicas por enlace)
                                   └─ Sheets: "ABC del Reciclaje - Entregas Proyecto Final 2026"
                                         ├─ Entregas (radicado, datos, estado, nota, retroalimentación)
                                         └─ Arboles
```

- **Sin servidor propio ni costos.** El único "backend" es un script de Google que corre dentro
  de la cuenta dueña del almacenamiento (5 TB). Ninguna credencial sale de Google; el sitio
  público solo conoce la URL del script, igual que conocería la URL de un Google Form.
- **Videos grandes.** El navegador parte el video en fragmentos de 8 MB y el script los reenvía a
  una *sesión de subida reanudable* de Drive. Así se superan los límites de Apps Script y, si se
  cae la conexión, la subida continúa donde iba.
- **Modo demostración.** Mientras `APPS_SCRIPT_URL` esté vacía en `assets/js/config.js`, el sitio
  lo indica con una etiqueta amarilla y guarda todo solo en el navegador. Nunca simula que algo
  llegó a Drive.

Detalle del backend y del despliegue: [backend/apps-script/README.md](backend/apps-script/README.md)
y [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## 3. Dónde quedan los datos

| Dato | Dónde |
|---|---|
| Video del proyecto final | Drive → `01 Videos proyecto final`, nombre `ABC-2026-00001 - Nombre - Documento.mp4` |
| Datos del formulario, estado, nota, retroalimentación | Sheet → pestaña `Entregas` (una fila por entrega) |
| Fotos de árboles | Drive → `02 Fotos arboles sembrados` (compartidas "cualquiera con el enlace" para el muro) |
| Registro de árboles | Sheet → pestaña `Arboles` (columna `Publicar` para moderar) |
| Clave del panel docente | Propiedades del script de Apps Script (no está en el código) |

Los docentes pueden calificar desde el panel web **o** directamente en la hoja de cálculo: el
paso 3 lee la hoja.

## 4. Pruebas realizadas (13-oct-2026, modo demostración, Chromium vía Playwright)

- Carga de las 6 páginas sin errores en consola; escritorio (1280 px) y móvil (390 px) sin
  desplazamiento horizontal; menú móvil funcional.
- Validación del formulario de envío: 8 mensajes de error con el formulario vacío, foco en el
  primer campo con error, mensajes claros por campo (correo, documento, teléfono, enlace, autorización).
- Envío completo con un video MP4 de 2,8 MB: progreso por fragmentos, confirmación con
  radicado `ABC-2026-00003`, borrador local eliminado al terminar, aviso explícito de modo demo.
- Consulta de calificación: entrega calificada muestra nota y retroalimentación; entrega
  pendiente muestra el aviso de "en revisión"; documento inexistente muestra guía.
- Panel docente: clave incorrecta rechazada; con la clave de demo lista 3 entregas y 3 árboles,
  filtros por zona/estado, calificación guardada (nota 4,8) y reflejada en el paso 3.
- Muro de árboles: foto de 2400×1800 px reducida a 1600×1200 (≈17 KB), registro publicado,
  contador y mapa actualizados (4 marcadores).

## 5. Estado de cada funcionalidad

| Funcionalidad | Estado |
|---|---|
| Interfaz completa, responsive, con la línea gráfica del banner | ✅ Implementada y probada |
| Validaciones, mensajes de éxito/error, borrador local, reanudación de subida | ✅ Implementada y probada (modo demo) |
| Carpetas de Drive y hoja de cálculo creadas en la cuenta de 5 TB | ✅ Creadas con Composio (IDs en `Code.gs`) |
| Backend Apps Script (subida a Drive, registro, consulta, panel) | ✅ Escrito · ⏳ **Pendiente de publicar** (requiere iniciar sesión en Google; ver más abajo) |
| Almacenamiento real de videos en Drive | ⏳ Depende del punto anterior. Hasta entonces: modo demostración |
| Publicación en GitHub Pages | ✅ Publicado |
| Google Form de respaldo | ⏳ Opcional. Composio no tiene Google Forms conectado y la API de Forms no permite crear preguntas de carga de archivos: se crea a mano y se pega en `FORM_RESPALDO_URL` |
| Dominio propio / Render | ⏳ No necesario por ahora (ver `docs/DESPLIEGUE.md`) |

## 6. Qué falta para activar el almacenamiento real (10 minutos)

1. Con la cuenta `almacenamiento982@gmail.com`, crear el proyecto en <https://script.google.com>
   y pegar `backend/apps-script/Code.gs` y `appsscript.json`.
2. Ejecutar `configurar()` una vez (autorizar permisos; copiar la clave docente del registro).
3. Implementar como **Aplicación web** (Ejecutar como: Yo · Acceso: Cualquier usuario) y copiar la URL `/exec`.
4. Pegar la URL en `assets/js/config.js` → `APPS_SCRIPT_URL` y subir el cambio al repositorio.
5. Probar un envío real y comprobar el archivo en Drive y la fila en la hoja.

Guía paso a paso: [backend/apps-script/README.md](backend/apps-script/README.md).

## 7. Pendientes y decisiones que corresponden al equipo del curso

- Redactar el contenido definitivo del instructivo (sección marcada como *borrador editable*).
- Confirmar la escala de calificación (`NOTA_MAX` en `config.js` y `Code.gs`, por defecto 0 a 5).
- Confirmar fecha límite de entrega (`FECHA_LIMITE`) y lista de zonas si se quiere un desplegable.
- Entregar el logo de la fundación para la cabecera (`LOGO_URL`).
- Decidir si el muro de árboles se publica desde ya o solo al cierre del curso (basta con quitar el enlace del menú en `assets/js/ui.js`).

## 8. Estructura del código

```
abc-reciclaje-proyecto-final/
├── index.html · instructivo.html · envio.html · calificacion.html · arboles.html · docentes.html
├── assets/
│   ├── css/styles.css          # línea gráfica (variables de color, componentes)
│   ├── img/                    # favicon e ilustración SVG
│   └── js/
│       ├── config.js           # configuración pública (URL del script, límites, países)
│       ├── api.js              # cliente del backend (o modo demo)
│       ├── demo-store.js       # modo demostración en localStorage
│       ├── upload.js           # subida por fragmentos y compresión de fotos
│       ├── ui.js               # cabecera, pie, toasts, validación
│       └── pages/              # lógica de cada página
├── backend/apps-script/        # Code.gs, appsscript.json y guía de despliegue
├── docs/DESPLIEGUE.md          # GitHub Pages, Render, dominio
└── .nojekyll                   # GitHub Pages sirve los archivos tal cual
```
