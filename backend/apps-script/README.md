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

1. El navegador envía los datos del formulario y su origen (`iniciar`). El script abre una **sesión
   de subida reanudable** en la API de Drive dentro de la carpeta de videos, con la cabecera
   `Origin` del sitio para que Google acepte peticiones directas desde el navegador (CORS). Registra
   la fila con estado `Subiendo` y devuelve `uploadId`, radicado y la URL de la sesión.
2. **Vía directa:** el navegador hace `PUT` de bloques de 16 MB directamente a esa URL de Google con
   `Content-Range`. Apps Script no interviene. Al terminar, Google devuelve el ID del archivo.
3. **Vía de relevo (respaldo):** si el navegador no puede conectar con Google, parte el video en
   fragmentos de 8 MB en base64 y los envía a `fragmento`; el script los reenvía a la misma sesión.
4. `finalizar` recibe el ID (vía directa) y verifica que el archivo esté en la carpeta de videos con
   el nombre de la sesión; o consulta la sesión (vía relevo). Guarda ID y enlace en la hoja y pone
   `Recibido`. `estado_subida` permite reanudar: devuelve cuántos bytes tiene Drive.
5. Si se corta la conexión, el navegador guarda el avance (sessionStorage) y al volver a seleccionar
   el mismo archivo continúa desde ahí. La sesión de Drive dura hasta 7 días.

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
