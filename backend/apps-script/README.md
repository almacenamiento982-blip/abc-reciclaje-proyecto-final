# Backend · Google Apps Script

Este script es el único "servidor" de la solución. Corre gratis dentro de la cuenta de Google que
posee la carpeta de Drive y la hoja de cálculo, por lo que **ninguna credencial sale de Google** y
el sitio público solo necesita la URL del script.

Recursos ya creados (cuenta `almacenamiento982@gmail.com`):

| Recurso | ID |
|---|---|
| Carpeta raíz `ABC del Reciclaje - Proyecto Final 2026` | `1pvYhmmpdduaqYGIMoh0a_maNlXeu-kLU` |
| Subcarpeta `01 Videos proyecto final` | `1-3lazCq68sUzKSmjkHL66rA88lq-EUpm` |
| Subcarpeta `02 Fotos arboles sembrados` | `1C2wlVNVOLoxL5b77MhKLDc-xjhB145cG` |
| Hoja `ABC del Reciclaje - Entregas Proyecto Final 2026` | `1raH2QyFVNW_dXlPVXk85dONHI-0P3O1hhM7uFJV7JuY` |

Los IDs ya están escritos en `Code.gs` (`CONFIG`). Si se despliega desde otra cuenta, hay que crear
carpetas y hoja en esa cuenta y reemplazar los IDs.

## Despliegue (10 minutos, una sola vez)

1. Inicia sesión en Google con la cuenta dueña de la carpeta y abre <https://script.google.com>.
2. **Nuevo proyecto**. Ponle nombre, por ejemplo `ABC Reciclaje - Entregas`.
3. En el editor, borra el contenido de `Código.gs` y pega el contenido completo de `Code.gs`.
4. Activa **Configuración del proyecto (⚙️) → Mostrar el archivo de manifiesto "appsscript.json"**,
   ábrelo y reemplaza su contenido con el `appsscript.json` de esta carpeta. Guarda.
5. En el editor selecciona la función `configurar` y pulsa **Ejecutar**. Autoriza los permisos
   (Drive, Hojas de cálculo y conexiones externas). Al terminar, abre **Registro de ejecución**:
   ahí aparece la **clave del panel docente** generada. Guárdala; se puede cambiar en
   *Configuración del proyecto → Propiedades del script → `DOCENTE_CLAVE`*.
6. **Implementar → Nueva implementación → Tipo: Aplicación web**:
   - Descripción: `v1`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** (necesario para que los estudiantes envíen sin iniciar sesión)
   - Implementar → copia la **URL de la aplicación web** (termina en `/exec`).
7. Pega esa URL en `assets/js/config.js` → `APPS_SCRIPT_URL` y publica el sitio.
8. Prueba: abre la URL `/exec` en el navegador; debe responder `{"ok":true,"version":"0.1.0","modo":"conectado",...}`.

> Cada vez que cambies `Code.gs`, hay que crear una **nueva versión** de la implementación
> (Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva). La URL no cambia.

## Cómo funciona la subida de videos

1. El navegador envía los datos del formulario (`iniciar`). El script abre una **sesión de subida
   reanudable** en la API de Drive dentro de la carpeta de videos, registra la fila en la hoja con
   estado `Subiendo` y devuelve un `uploadId` y el radicado.
2. El navegador parte el video en fragmentos de 8 MB, los codifica en base64 y los envía uno a uno
   (`fragmento`). El script los decodifica y los reenvía a Drive con `Content-Range`.
3. Al llegar el último fragmento Drive responde con el archivo creado; el script guarda el ID y el
   enlace en la hoja y cambia el estado a `Recibido`. `finalizar` confirma y devuelve el radicado.
4. Si se corta la conexión, el navegador guarda en qué fragmento iba (sessionStorage) y al volver a
   seleccionar el mismo archivo continúa desde ahí. La sesión de Drive dura hasta 7 días.

## Límites a tener en cuenta (cuenta Gmail gratuita)

- Petición a Apps Script: máximo 50 MB (por eso 8 MB binarios ≈ 10,7 MB base64 por fragmento).
- Ejecuciones simultáneas: 30 por script. Con 300-400 estudiantes repartidos en varios días es
  suficiente; si muchos envían en el mismo minuto, algunos verán "Reintentar" y la subida continúa.
- Tiempo por ejecución: 6 minutos (cada fragmento tarda segundos).
- El script no envía correos. Si se quiere confirmación por correo, MailApp permite 100/día en
  cuentas gratuitas, insuficiente para 300-400 entregas en un solo día.

## Seguridad

- La clave docente vive en *Propiedades del script*, nunca en el código ni en GitHub.
- Los videos quedan privados en Drive (solo el dueño de la cuenta y a quien él comparta la carpeta).
- Las fotos de árboles se publican como "cualquier persona con el enlace" para poder mostrarlas en
  el muro; el panel docente puede ocultarlas.
- La URL `/exec` es pública igual que lo sería un Google Form. Un atacante podría enviar basura;
  el panel docente permite identificarla y la hoja conserva el historial. Si hace falta, se puede
  añadir un código de curso obligatorio en `validarMeta_`.
