# Despliegue, dominio y decisiones de infraestructura

## 1. GitHub Pages (interfaz)

- Repositorio: `almacenamiento982-blip/abc-reciclaje-proyecto-final` (cuenta **almacenamiento982**).
- Rama `main`, carpeta raíz `/`. Archivo `.nojekyll` para que Pages no procese nada.
- URL: `https://almacenamiento982-blip.github.io/abc-reciclaje-proyecto-final/`
- Todas las rutas del sitio son relativas (`assets/...`, `envio.html`), por lo que funciona en
  un subdirectorio de GitHub Pages y también en un dominio propio sin cambios.

Para publicar un cambio:

```bash
git add -A
git commit -m "Descripción del cambio"
git push
```

GitHub Pages se actualiza en 1-2 minutos. Si el navegador muestra la versión vieja, recargar con
Ctrl+F5.

## 2. Backend (Google Apps Script)

Ver [`backend/apps-script/README.md`](../backend/apps-script/README.md). Resumen de por qué se
eligió esta opción frente a las demás:

| Opción | Costo | Credenciales | Videos de 100-500 MB | Esfuerzo |
|---|---|---|---|---|
| **Apps Script en la cuenta dueña del Drive (elegida)** | $0 | Ninguna fuera de Google | Sí, vía subida reanudable | 10 min de despliegue manual |
| Google Form con pregunta de archivo | $0 | Ninguna | Sí, hasta 10 GB por archivo | Obliga a los estudiantes a iniciar sesión en Google; no es "visual"; no se puede crear por API |
| Backend en Render con OAuth de Google | $0-7/mes | Hay que crear un proyecto en Google Cloud, consentimiento OAuth y guardar el refresh token en Render | Sí, pero el tráfico pasaría por Render (100 GB/mes en el plan gratuito) o se necesitaría la misma lógica de sesión reanudable | Alto |
| Composio desde el navegador | — | **Inviable**: la clave de Composio quedaría expuesta en el sitio público | — | — |

Composio sí se usó, desde esta máquina, para crear las carpetas de Drive y la hoja de cálculo.
No puede usarse en tiempo de ejecución desde una página pública.

## 3. Render y dominio profesional

**Decisión: no usar Render por ahora.**

- Render no regala dominios personalizados: su plan gratuito ofrece una URL `*.onrender.com`,
  que no es más "profesional" que `*.github.io`, y los servicios gratuitos se apagan tras 15
  minutos sin tráfico (primer acceso lento).
- No es posible "asignar" una URL de Render a un sitio alojado en GitHub Pages: Render solo
  enruta a servicios que corren en Render.
- La solución no necesita servidor: el backend vive en Google.

**Cuando exista un dominio** (por ejemplo `reciclaje.fundacion.org`), GitHub Pages lo soporta
gratis con HTTPS:

1. En el DNS del dominio crear un registro `CNAME` → `almacenamiento982-blip.github.io`.
2. En el repositorio: *Settings → Pages → Custom domain* → escribir el dominio y activar
   *Enforce HTTPS* (GitHub crea el archivo `CNAME` en la raíz).
3. Esperar la propagación (minutos a horas). Las rutas relativas del sitio no cambian.

Si en el futuro se quisiera que Campus muestre la herramienta embebida, cada página puede
incrustarse en un `<iframe>`; GitHub Pages no envía cabeceras que lo impidan.

## 4. Seguridad y datos sensibles

- El repositorio es público y **no contiene** tokens de Composio, credenciales de Google ni la
  clave docente. Los únicos identificadores presentes son los IDs de carpetas y hoja (no dan
  acceso por sí solos; el script corre con los permisos del dueño).
- `.gitignore` excluye audios, videos y archivos de credenciales.
- El material original del proyecto (notas de voz, capturas) queda fuera del repositorio, en la
  carpeta local `D:\ABC DEL RECICLAJE SOFIA\`.
- `docentes.html` lleva `noindex` y la clave viaja solo en el cuerpo de las peticiones POST
  (nunca en la URL). Para mayor seguridad futura se puede mover el panel a una página solo para
  usuarios de Google del equipo (Apps Script `access: DOMAIN`/usuarios concretos).

## 5. Pruebas en el entorno publicado

Después de cada publicación, comprobar:

1. La portada carga y muestra la etiqueta de estado (amarilla = demo, verde = conectado).
2. `envio.html` valida campos vacíos y permite un envío de prueba.
3. `calificacion.html` responde a una consulta.
4. `arboles.html` muestra el mapa (requiere acceso a `tile.openstreetmap.org` y `cdnjs.cloudflare.com`).
5. Consola del navegador sin errores (F12 → Console).
