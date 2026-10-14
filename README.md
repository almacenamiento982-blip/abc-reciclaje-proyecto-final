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
| `instructivo.html` | Estudiante | Paso 1: el instructivo oficial del curso ("CAMPUS Paso 1: Instrucciones"): ejemplos de proyecto, las 4 preguntas del video, los 5 pasos, duración de 1 a 4 minutos, detalles técnicos, preguntas frecuentes y las "prendas" de la estrategia de cobertura. |
| `envio.html` | Estudiante | Paso 2: los mismos campos del formulario oficial de Google (nombre, correo del CAMPUS, zona o país con sus 8 opciones, grupo por día y hora con su código, video, "¿cómo te sentiste?" y comentario adicional), más documento y nombre del proyecto opcionales. Subida directa a Drive con progreso y reanudación, o envío por enlace. Entrega un **radicado** y el mensaje de cierre con el recordatorio del árbol. |
| `calificacion.html` | Estudiante | Paso 3: consulta de nota y retroalimentación. **Desactivado** (`MOSTRAR_CALIFICACION: false` en `config.js`) porque la calificación se gestiona en Campus; el menú, el paso 3 y la calificación en el panel docente quedan ocultos y pueden reactivarse con ese interruptor. |
| `arboles.html` | Todos | Muro tipo Padlet + mapa (Leaflet/OpenStreetMap) con los árboles sembrados, y formulario para registrar el propio (foto comprimida en el navegador, ubicación opcional). |
| `docentes.html` | Docentes | Panel con clave: lista de entregas, filtros, enlace al video en Drive, calificación con retroalimentación, eliminación de entregas (el video va a la papelera de Drive), moderación y eliminación en el muro, y descarga CSV. |

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
- **Videos grandes, a velocidad real.** El script abre una *sesión de subida reanudable* en Drive
  autorizada para el dominio del sitio y el navegador envía los bytes **directamente a Google** en
  bloques de 16 MB (20 MB en ~11 s en la prueba). Apps Script no toca los bytes; solo confirma al
  final que el archivo quedó en la carpeta con el nombre esperado. Si la red del estudiante bloquea
  la conexión directa, el sitio cambia solo a la vía de relevo (fragmentos de 8 MB vía Apps Script,
  más lenta). En ambos casos, si se cae la conexión la subida continúa donde iba.
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

## 4. Pruebas realizadas (13 y 14-oct-2026, Chromium vía Playwright)

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
- **Con el backend real (sitio publicado):** `ping`, `arboles` y `consultar` responden JSON; envío de un
  MP4 de 20,6 MB por relevo (≈70 s) y después por **subida directa (11 s)**; en ambos casos el archivo
  en Drive tiene el mismo MD5 y tamaño que el original; fila completa en la hoja; calificación 4,5
  guardada desde el panel docente y mostrada al estudiante en el paso 3; eliminación desde el panel
  borra la fila y manda el video a la papelera de Drive.

## 5. Estado de cada funcionalidad

| Funcionalidad | Estado |
|---|---|
| Interfaz completa, responsive, con la línea gráfica del banner | ✅ Implementada y probada |
| Validaciones, mensajes de éxito/error, borrador local, reanudación de subida | ✅ Implementada y probada (modo demo) |
| Carpetas de Drive y hoja de cálculo creadas en la cuenta de 5 TB | ✅ Creadas con Composio (IDs en `Code.gs`) |
| Backend Apps Script (subida a Drive, registro, consulta, panel) | ✅ Publicado con clasp (implementación `v1 - prototipo`) y autorizado por el dueño de la cuenta |
| Almacenamiento real de videos en Drive | ✅ Probado el 14-oct-2026: video de 20,6 MB subido en 3 fragmentos desde el sitio publicado, MD5 idéntico al original en `01 Videos proyecto final`, fila `ABC-2026-00001` en la hoja, calificación desde el panel y visible en el paso 3 |
| Publicación en GitHub Pages | ✅ Publicado |
| Google Form de respaldo | ✅ Existe el formulario oficial "Entrega de Video del Curso ABC del Reciclaje" (requiere iniciar sesión en Google). Si se quiere ofrecer como respaldo cuando falle la subida, pegar su enlace en `FORM_RESPALDO_URL` |
| Dominio propio / Render | ⏳ No necesario por ahora (ver `docs/DESPLIEGUE.md`) |

## 6. Backend publicado

- Proyecto de Apps Script: `ABC Reciclaje - Entregas Proyecto Final` (dentro de la carpeta del proyecto en Drive).
- Implementación activa: `v2 - subida directa y eliminar` (misma URL que la v1). La URL `/exec` está en `assets/js/config.js`.
- La clave del panel docente se generó al ejecutar `configurar()` y está en *Configuración del proyecto → Propiedades del script → `DOCENTE_CLAVE`*. Compártela solo con el equipo docente.
- Para publicar cambios del script: editar `backend/apps-script/Code.gs` y ejecutar
  `npx @google/clasp push -f` y luego `npx @google/clasp deploy -i <deploymentId> -d "v2"` desde esa carpeta
  (requiere `clasp login` con la cuenta dueña). Guía completa: [backend/apps-script/README.md](backend/apps-script/README.md).
- Las entregas de prueba (`ABC-2026-00001`, documento 900100200) se pueden borrar de la hoja y de Drive antes de abrir a los estudiantes.

## 7. Pendientes y decisiones que corresponden al equipo del curso

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
