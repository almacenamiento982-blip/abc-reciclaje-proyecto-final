/**
 * El ABC del Reciclaje · Proyecto Final — Backend en Google Apps Script
 * ---------------------------------------------------------------------
 * Se despliega como "Aplicación web" desde la cuenta de Google que posee la
 * carpeta de Drive y la hoja de cálculo (almacenamiento982@gmail.com).
 *
 *  - Recibe los videos por fragmentos y los reenvía a una sesión de subida
 *    reanudable de Google Drive (así se superan los 50 MB por petición de
 *    Apps Script y los videos quedan en la carpeta del curso).
 *  - Registra cada entrega en la hoja "Entregas".
 *  - Permite consultar la calificación por documento.
 *  - Recibe las fotos de los árboles y las publica en la hoja "Arboles".
 *  - Expone un panel docente protegido con una clave guardada en las
 *    propiedades del script (NUNCA en el código ni en el repositorio).
 *
 * Despliegue: ver backend/apps-script/README.md
 */

var CONFIG = {
  SHEET_ID: '1raH2QyFVNW_dXlPVXk85dONHI-0P3O1hhM7uFJV7JuY',
  FOLDER_VIDEOS: '1-3lazCq68sUzKSmjkHL66rA88lq-EUpm',
  FOLDER_ARBOLES: '1C2wlVNVOLoxL5b77MhKLDc-xjhB145cG',
  HOJA_ENTREGAS: 'Entregas',
  HOJA_ARBOLES: 'Arboles',
  VIDEO_MAX_BYTES: 500 * 1024 * 1024,
  FOTO_MAX_BYTES: 12 * 1024 * 1024,
  NOTA_MIN: 0,
  NOTA_MAX: 5,
  VERSION: '0.2.0'
};

var COL_ENTREGAS = ['Radicado', 'Fecha envio', 'Nombre completo', 'Documento', 'Correo', 'WhatsApp', 'Pais', 'Zona / Sede',
  'Grupo / Docente', 'Titulo del video', 'Descripcion', 'Tipo entrega', 'Archivo Drive ID', 'Enlace video', 'Tamano MB',
  'Estado', 'Nota', 'Retroalimentacion', 'Docente que califica', 'Fecha calificacion', 'Autoriza uso', 'Origen'];
var COL_ARBOLES = ['ID', 'Fecha', 'Nombre', 'Documento', 'Correo', 'Ciudad', 'Pais', 'Latitud', 'Longitud', 'Mensaje',
  'Foto Drive ID', 'Foto URL', 'Publicar', 'Origen'];

// Índices (base 0) de las columnas de Entregas
var E = { RADICADO: 0, FECHA: 1, NOMBRE: 2, DOCUMENTO: 3, CORREO: 4, WHATSAPP: 5, PAIS: 6, ZONA: 7, GRUPO: 8, TITULO: 9,
  DESCRIPCION: 10, TIPO: 11, ARCHIVO_ID: 12, ENLACE: 13, TAMANO: 14, ESTADO: 15, NOTA: 16, RETRO: 17, DOCENTE: 18,
  FECHA_CAL: 19, AUTORIZA: 20, ORIGEN: 21 };
var A = { ID: 0, FECHA: 1, NOMBRE: 2, DOCUMENTO: 3, CORREO: 4, CIUDAD: 5, PAIS: 6, LAT: 7, LNG: 8, MENSAJE: 9,
  FOTO_ID: 10, FOTO_URL: 11, PUBLICAR: 12, ORIGEN: 13 };

/* =========================================================================
   Puntos de entrada
   ========================================================================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'consultar') return json_(consultar_(p));
    if (p.action === 'arboles') return json_(listarArboles_());
    return json_({ ok: true, version: CONFIG.VERSION, modo: 'conectado', hora: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: mensajeError_(err) });
  }
}

function doPost(e) {
  var datos = {};
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Cuerpo de la petición inválido (se esperaba JSON).' });
  }
  try {
    switch (datos.action) {
      case 'ping': return json_({ ok: true, version: CONFIG.VERSION, modo: 'conectado' });
      case 'iniciar': return json_(iniciarSubida_(datos));
      case 'fragmento': return json_(recibirFragmento_(datos));
      case 'estado_subida': return json_(estadoSubida_(datos));
      case 'finalizar': return json_(finalizarSubida_(datos));
      case 'enlace': return json_(registrarEnlace_(datos));
      case 'consultar': return json_(consultar_(datos));
      case 'arboles': return json_(listarArboles_());
      case 'arbol': return json_(registrarArbol_(datos));
      case 'docentes_listar': return json_(docentesListar_(datos));
      case 'calificar': return json_(calificar_(datos));
      case 'publicar_arbol': return json_(publicarArbol_(datos));
      case 'eliminar': return json_(eliminarEntrega_(datos));
      case 'eliminar_arbol': return json_(eliminarArbol_(datos));
      default: return json_({ ok: false, error: 'Acción no reconocida: ' + datos.action });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: mensajeError_(err) });
  }
}

/* =========================================================================
   Configuración inicial (ejecutar UNA vez a mano desde el editor)
   ========================================================================= */
function configurar() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  asegurarHoja_(ss, CONFIG.HOJA_ENTREGAS, COL_ENTREGAS);
  asegurarHoja_(ss, CONFIG.HOJA_ARBOLES, COL_ARBOLES);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DOCENTE_CLAVE')) {
    var clave = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    props.setProperty('DOCENTE_CLAVE', clave);
    Logger.log('Clave del panel docente generada: ' + clave + '  (puedes cambiarla en Configuración del proyecto > Propiedades del script)');
  } else {
    Logger.log('La clave del panel docente ya existe: ' + props.getProperty('DOCENTE_CLAVE'));
  }
  // Forzar la autorización de Drive y UrlFetch
  DriveApp.getFolderById(CONFIG.FOLDER_VIDEOS).getName();
  DriveApp.getFolderById(CONFIG.FOLDER_ARBOLES).getName();
  Logger.log('Configuración lista. Ahora publica el script como aplicación web.');
}

function asegurarHoja_(ss, nombre, columnas) {
  var hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  if (hoja.getLastRow() === 0 || hoja.getRange(1, 1).getValue() !== columnas[0]) {
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

/** Borra sesiones de subida abandonadas (más de 2 días). Opcional: programar con un disparador diario. */
function limpiarSesiones() {
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var limite = Date.now() - 2 * 86400000;
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('up_') !== 0) return;
    try { if (JSON.parse(todas[k]).creado < limite) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/* =========================================================================
   Entregas: subida por fragmentos
   ========================================================================= */
function iniciarSubida_(d) {
  var meta = validarMeta_(d.meta || {});
  var archivo = d.archivo || {};
  var tamano = Number(archivo.tamano) || 0;
  if (tamano <= 0) throw new Error('El archivo está vacío.');
  if (tamano > CONFIG.VIDEO_MAX_BYTES) throw new Error('El video supera el tamaño máximo permitido.');
  var mime = limpiar_(archivo.tipo, 100) || 'video/mp4';
  var ext = (String(archivo.nombre || '').match(/\.[A-Za-z0-9]{2,5}$/) || ['.mp4'])[0].toLowerCase();

  var radicado = nuevoRadicado_();
  var nombreDrive = radicado + ' - ' + meta.nombre + ' - ' + meta.documento + ext;

  // Sesión reanudable en Drive
  // Si el navegador indica su origen, la sesión se abre con esa cabecera
  // "Origin": así Google acepta que ESE sitio suba los bytes directamente
  // (CORS), sin pasar por Apps Script. Si no, se usa la vía de relevo.
  var origen = String(d.origen || '').trim();
  if (!/^https:\/\/[A-Za-z0-9.\-]+(:\d+)?$/.test(origen) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen)) origen = '';
  var cabeceras = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    'X-Upload-Content-Type': mime,
    'X-Upload-Content-Length': String(tamano)
  };
  if (origen) cabeceras.Origin = origen;
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: cabeceras,
    payload: JSON.stringify({ name: nombreDrive, parents: [CONFIG.FOLDER_VIDEOS], description: 'Proyecto final · ' + meta.titulo }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo abrir la sesión de subida en Drive (' + res.getResponseCode() + ').');
  var headers = res.getAllHeaders();
  var uri = headers.Location || headers.location;
  if (!uri) throw new Error('Drive no devolvió la URL de subida.');

  // Comprobar que Google aceptó el origen (devuelve Access-Control-Allow-Origin)
  var permiteDirecto = !!origen && String(headers['Access-Control-Allow-Origin'] || headers['access-control-allow-origin'] || '') === origen;

  var uploadId = Utilities.getUuid();
  var sesion = { uri: uri, radicado: radicado, mime: mime, total: tamano, nombre: nombreDrive, creado: Date.now(), archivoId: '' };
  guardarSesion_(uploadId, sesion);

  var fila = filaEntrega_(meta, radicado, 'archivo', '', '', Math.round(tamano / 1048576), 'Subiendo');
  hojaEntregas_().appendRow(fila);

  return { ok: true, uploadId: uploadId, radicado: radicado, sesionUrl: permiteDirecto ? uri : '' };
}

function recibirFragmento_(d) {
  var s = leerSesion_(d.uploadId);
  var bytes = Utilities.base64Decode(String(d.datos || ''));
  if (!bytes.length) throw new Error('Fragmento vacío.');
  var inicio = Number(d.inicio) || 0;
  var fin = inicio + bytes.length - 1;

  var res = UrlFetchApp.fetch(s.uri, {
    method: 'put',
    contentType: s.mime,
    headers: { 'Content-Range': 'bytes ' + inicio + '-' + fin + '/' + s.total },
    payload: bytes,
    muteHttpExceptions: true,
    followRedirects: false
  });
  var code = res.getResponseCode();
  if (code === 308) {
    var rango = res.getAllHeaders().Range || res.getAllHeaders().range || '';
    var recibido = rango ? Number(rango.split('-')[1]) + 1 : fin + 1;
    return { ok: true, completado: false, recibido: recibido };
  }
  if (code === 200 || code === 201) {
    var archivo = JSON.parse(res.getContentText());
    s.archivoId = archivo.id;
    guardarSesion_(d.uploadId, s);
    marcarArchivo_(s.radicado, archivo.id);
    return { ok: true, completado: true, recibido: s.total, archivoId: archivo.id };
  }
  if (code === 404 || code === 410) throw new Error('La sesión de subida expiró. Vuelve a enviar el video.');
  throw new Error('Drive rechazó el fragmento (' + code + '). Reintenta.');
}

/** Pregunta a Drive cuántos bytes tiene la sesión. */
function consultarSesion_(s) {
  var res = UrlFetchApp.fetch(s.uri, {
    method: 'put', headers: { 'Content-Range': 'bytes */' + s.total }, muteHttpExceptions: true, followRedirects: false
  });
  var code = res.getResponseCode();
  if (code === 200 || code === 201) {
    var archivo = JSON.parse(res.getContentText());
    return { recibido: s.total, completado: true, archivoId: archivo.id };
  }
  if (code === 308) {
    var rango = res.getAllHeaders().Range || res.getAllHeaders().range || '';
    return { recibido: rango ? Number(rango.split('-')[1]) + 1 : 0, completado: false, archivoId: '' };
  }
  if (code === 404 || code === 410) throw new Error('La sesión de subida expiró. Vuelve a enviar el video.');
  throw new Error('No se pudo consultar el estado de la subida (' + code + ').');
}

function estadoSubida_(d) {
  var s = leerSesion_(d.uploadId);
  if (s.archivoId) return { ok: true, recibido: s.total, completado: true, archivoId: s.archivoId };
  var est = consultarSesion_(s);
  if (est.completado) { s.archivoId = est.archivoId; guardarSesion_(d.uploadId, s); marcarArchivo_(s.radicado, s.archivoId); }
  return { ok: true, recibido: est.recibido, completado: est.completado, archivoId: est.archivoId };
}

function finalizarSubida_(d) {
  var s = leerSesion_(d.uploadId);
  if (!s.archivoId && d.archivoId) {
    // El navegador subió directo a Drive y nos entrega el ID: verificar que
    // el archivo es el de esta sesión (nombre y carpeta) antes de aceptarlo.
    var idCliente = String(d.archivoId).replace(/[^A-Za-z0-9_\-]/g, '');
    try {
      var f = DriveApp.getFileById(idCliente);
      var enCarpeta = false, padres = f.getParents();
      while (padres.hasNext()) if (padres.next().getId() === CONFIG.FOLDER_VIDEOS) enCarpeta = true;
      if (enCarpeta && f.getName() === s.nombre) { s.archivoId = idCliente; guardarSesion_(d.uploadId, s); marcarArchivo_(s.radicado, s.archivoId); }
    } catch (e) { /* se comprueba abajo con la sesión */ }
  }
  if (!s.archivoId) {
    var est = consultarSesion_(s);
    if (est.completado) {
      s.archivoId = est.archivoId;
      marcarArchivo_(s.radicado, s.archivoId);
    } else {
      throw new Error('La subida está incompleta (' + Math.round(est.recibido / 1048576) + ' MB recibidos). Selecciona de nuevo el mismo archivo para continuar.');
    }
  }
  var url = '';
  try { url = DriveApp.getFileById(s.archivoId).getUrl(); } catch (e) { /* sin enlace */ }
  borrarSesion_(d.uploadId);
  return { ok: true, radicado: s.radicado, estado: 'Recibido', enlace: url };
}

function marcarArchivo_(radicado, archivoId) {
  var hoja = hojaEntregas_();
  var fila = buscarFila_(hoja, E.RADICADO, radicado);
  if (!fila) return;
  var url = '';
  try { url = DriveApp.getFileById(archivoId).getUrl(); } catch (e) { url = 'https://drive.google.com/file/d/' + archivoId + '/view'; }
  hoja.getRange(fila, E.ARCHIVO_ID + 1, 1, 2).setValues([[archivoId, url]]);
  hoja.getRange(fila, E.ESTADO + 1).setValue('Recibido');
}

function registrarEnlace_(d) {
  var meta = validarMeta_(d.meta || {});
  var enlace = limpiar_(meta.enlace, 500);
  if (!/^https?:\/\//i.test(enlace)) throw new Error('El enlace del video no es válido.');
  var radicado = nuevoRadicado_();
  hojaEntregas_().appendRow(filaEntrega_(meta, radicado, 'enlace', '', enlace, '', 'Recibido'));
  return { ok: true, radicado: radicado, estado: 'Recibido' };
}

function filaEntrega_(meta, radicado, tipo, archivoId, enlace, tamanoMB, estado) {
  var fila = [];
  fila[E.RADICADO] = radicado; fila[E.FECHA] = new Date(); fila[E.NOMBRE] = meta.nombre; fila[E.DOCUMENTO] = meta.documento;
  fila[E.CORREO] = meta.correo; fila[E.WHATSAPP] = meta.whatsapp; fila[E.PAIS] = meta.pais; fila[E.ZONA] = meta.zona;
  fila[E.GRUPO] = meta.grupo; fila[E.TITULO] = meta.titulo; fila[E.DESCRIPCION] = meta.descripcion; fila[E.TIPO] = tipo;
  fila[E.ARCHIVO_ID] = archivoId; fila[E.ENLACE] = enlace; fila[E.TAMANO] = tamanoMB; fila[E.ESTADO] = estado;
  fila[E.NOTA] = ''; fila[E.RETRO] = ''; fila[E.DOCENTE] = ''; fila[E.FECHA_CAL] = ''; fila[E.AUTORIZA] = meta.autoriza; fila[E.ORIGEN] = 'web';
  return fila;
}

/* =========================================================================
   Consulta del estudiante
   ========================================================================= */
function consultar_(d) {
  var doc = normalizarDoc_(d.documento);
  if (doc.length < 4) throw new Error('Documento inválido.');
  var correo = String(d.correo || '').trim().toLowerCase();
  var filas = hojaEntregas_().getDataRange().getValues().slice(1);
  var entregas = filas.filter(function (f) {
    return normalizarDoc_(f[E.DOCUMENTO]) === doc && (!correo || String(f[E.CORREO]).toLowerCase() === correo);
  }).map(function (f) {
    var calificada = /calific/i.test(String(f[E.ESTADO]));
    return {
      radicado: f[E.RADICADO], fecha: iso_(f[E.FECHA]), titulo: f[E.TITULO], zona: f[E.ZONA], pais: f[E.PAIS],
      estado: f[E.ESTADO] || 'Recibido',
      nota: calificada ? f[E.NOTA] : '', retroalimentacion: calificada ? f[E.RETRO] : '',
      docente: calificada ? f[E.DOCENTE] : '', fechaCalificacion: calificada ? iso_(f[E.FECHA_CAL]) : ''
    };
  });
  return { ok: true, entregas: entregas };
}

/* =========================================================================
   Árboles
   ========================================================================= */
function listarArboles_() {
  var filas = hojaArboles_().getDataRange().getValues().slice(1);
  var arboles = filas.filter(function (f) { return f[A.ID] && String(f[A.PUBLICAR]).toUpperCase() !== 'NO'; })
    .map(function (f) {
      return { id: f[A.ID], fecha: iso_(f[A.FECHA]), nombre: f[A.NOMBRE], ciudad: f[A.CIUDAD], pais: f[A.PAIS],
        lat: f[A.LAT], lng: f[A.LNG], mensaje: f[A.MENSAJE], fotoUrl: f[A.FOTO_URL] };
    }).reverse();
  return { ok: true, arboles: arboles };
}

function registrarArbol_(d) {
  var m = d.meta || {};
  var meta = {
    nombre: limpiar_(m.nombre, 120), documento: limpiar_(m.documento, 20), correo: limpiar_(m.correo, 120),
    ciudad: limpiar_(m.ciudad, 80), pais: limpiar_(m.pais, 60), mensaje: limpiar_(m.mensaje, 300),
    lat: m.lat === '' || m.lat == null ? '' : Number(m.lat), lng: m.lng === '' || m.lng == null ? '' : Number(m.lng)
  };
  if (meta.nombre.length < 3) throw new Error('El nombre es obligatorio.');
  if (normalizarDoc_(meta.documento).length < 4) throw new Error('El documento es obligatorio.');
  if (!meta.ciudad || !meta.pais) throw new Error('Ciudad y país son obligatorios.');
  var foto = d.foto || {};
  if (!foto.datos) throw new Error('Falta la foto.');
  var bytes = Utilities.base64Decode(String(foto.datos));
  if (bytes.length > CONFIG.FOTO_MAX_BYTES) throw new Error('La foto es demasiado grande.');

  var id = nuevoIdArbol_();
  var blob = Utilities.newBlob(bytes, limpiar_(foto.tipo, 50) || 'image/jpeg', id + ' - ' + meta.nombre + '.jpg');
  var archivo = DriveApp.getFolderById(CONFIG.FOLDER_ARBOLES).createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fotoUrl = 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w1200';

  var fila = [];
  fila[A.ID] = id; fila[A.FECHA] = new Date(); fila[A.NOMBRE] = meta.nombre; fila[A.DOCUMENTO] = meta.documento; fila[A.CORREO] = meta.correo;
  fila[A.CIUDAD] = meta.ciudad; fila[A.PAIS] = meta.pais; fila[A.LAT] = meta.lat; fila[A.LNG] = meta.lng; fila[A.MENSAJE] = meta.mensaje;
  fila[A.FOTO_ID] = archivo.getId(); fila[A.FOTO_URL] = fotoUrl; fila[A.PUBLICAR] = 'SI'; fila[A.ORIGEN] = 'web';
  hojaArboles_().appendRow(fila);
  return { ok: true, id: id, fotoUrl: fotoUrl };
}

/* =========================================================================
   Panel docente
   ========================================================================= */
function verificarClave_(clave) {
  var real = PropertiesService.getScriptProperties().getProperty('DOCENTE_CLAVE');
  if (!real) throw new Error('El panel docente no está configurado: ejecuta configurar() en el editor del script.');
  if (String(clave || '') !== real) throw new Error('Clave incorrecta.');
}

function docentesListar_(d) {
  verificarClave_(d.clave);
  var entregas = hojaEntregas_().getDataRange().getValues().slice(1).filter(function (f) { return f[E.RADICADO]; }).map(function (f) {
    return {
      radicado: f[E.RADICADO], fecha: iso_(f[E.FECHA]), nombre: f[E.NOMBRE], documento: f[E.DOCUMENTO], correo: f[E.CORREO],
      whatsapp: f[E.WHATSAPP], pais: f[E.PAIS], zona: f[E.ZONA], grupo: f[E.GRUPO], titulo: f[E.TITULO], descripcion: f[E.DESCRIPCION],
      tipo: f[E.TIPO], archivoId: f[E.ARCHIVO_ID], enlace: f[E.ENLACE], tamanoMB: f[E.TAMANO], estado: f[E.ESTADO],
      nota: f[E.NOTA], retroalimentacion: f[E.RETRO], docente: f[E.DOCENTE], fechaCalificacion: iso_(f[E.FECHA_CAL]), autoriza: f[E.AUTORIZA]
    };
  }).reverse();
  var arboles = hojaArboles_().getDataRange().getValues().slice(1).filter(function (f) { return f[A.ID]; }).map(function (f) {
    return { id: f[A.ID], fecha: iso_(f[A.FECHA]), nombre: f[A.NOMBRE], documento: f[A.DOCUMENTO], ciudad: f[A.CIUDAD], pais: f[A.PAIS],
      mensaje: f[A.MENSAJE], fotoUrl: f[A.FOTO_URL], publicar: String(f[A.PUBLICAR] || 'SI').toUpperCase() };
  }).reverse();
  return { ok: true, entregas: entregas, arboles: arboles };
}

function calificar_(d) {
  verificarClave_(d.clave);
  var hoja = hojaEntregas_();
  var fila = buscarFila_(hoja, E.RADICADO, limpiar_(d.radicado, 30));
  if (!fila) throw new Error('No existe la entrega ' + d.radicado + '.');
  var estado = ['Calificado', 'En revisión', 'Devuelto', 'Recibido'].indexOf(d.estado) >= 0 ? d.estado : 'Calificado';
  var nota = d.nota === '' || d.nota == null ? '' : Number(d.nota);
  if (estado === 'Calificado' && (nota === '' || isNaN(nota) || nota < CONFIG.NOTA_MIN || nota > CONFIG.NOTA_MAX)) {
    throw new Error('La nota debe estar entre ' + CONFIG.NOTA_MIN + ' y ' + CONFIG.NOTA_MAX + '.');
  }
  hoja.getRange(fila, E.ESTADO + 1, 1, 5).setValues([[estado, nota, limpiar_(d.retroalimentacion, 2000), limpiar_(d.docente, 80), new Date()]]);
  return { ok: true };
}

function publicarArbol_(d) {
  verificarClave_(d.clave);
  var hoja = hojaArboles_();
  var fila = buscarFila_(hoja, A.ID, limpiar_(d.id, 30));
  if (!fila) throw new Error('No existe el árbol ' + d.id + '.');
  hoja.getRange(fila, A.PUBLICAR + 1).setValue(d.publicar ? 'SI' : 'NO');
  return { ok: true };
}

function eliminarEntrega_(d) {
  verificarClave_(d.clave);
  var hoja = hojaEntregas_();
  var radicado = limpiar_(d.radicado, 30);
  var fila = buscarFila_(hoja, E.RADICADO, radicado);
  if (!fila) throw new Error('No existe la entrega ' + radicado + '.');
  var archivoId = String(hoja.getRange(fila, E.ARCHIVO_ID + 1).getValue() || '');
  var papelera = false;
  if (archivoId) { try { DriveApp.getFileById(archivoId).setTrashed(true); papelera = true; } catch (e) { /* ya no existe */ } }
  hoja.deleteRow(fila);
  return { ok: true, radicado: radicado, videoEnPapelera: papelera };
}

function eliminarArbol_(d) {
  verificarClave_(d.clave);
  var hoja = hojaArboles_();
  var id = limpiar_(d.id, 30);
  var fila = buscarFila_(hoja, A.ID, id);
  if (!fila) throw new Error('No existe el árbol ' + id + '.');
  var fotoId = String(hoja.getRange(fila, A.FOTO_ID + 1).getValue() || '');
  if (fotoId) { try { DriveApp.getFileById(fotoId).setTrashed(true); } catch (e) { /* ya no existe */ } }
  hoja.deleteRow(fila);
  return { ok: true, id: id };
}

/* =========================================================================
   Utilidades
   ========================================================================= */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function mensajeError_(err) { return (err && err.message) ? err.message : String(err); }
function hojaEntregas_() { return SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.HOJA_ENTREGAS); }
function hojaArboles_() { return SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.HOJA_ARBOLES); }
function iso_(v) { return v instanceof Date ? v.toISOString() : (v ? String(v) : ''); }
function normalizarDoc_(v) { return String(v || '').trim().toLowerCase().replace(/[.\-\s]/g, ''); }

/** Recorta, quita caracteres de control y evita que Sheets interprete fórmulas. */
function limpiar_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (max && s.length > max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = ' ' + s;
  return s;
}

function validarMeta_(m) {
  var meta = {
    nombre: limpiar_(m.nombre, 120), documento: limpiar_(m.documento, 20), correo: limpiar_(m.correo, 120),
    whatsapp: limpiar_(m.whatsapp, 20), pais: limpiar_(m.pais, 60), zona: limpiar_(m.zona, 80), grupo: limpiar_(m.grupo, 80),
    titulo: limpiar_(m.titulo, 120), descripcion: limpiar_(m.descripcion, 600), enlace: limpiar_(m.enlace, 500),
    autoriza: String(m.autoriza).toUpperCase() === 'SI' ? 'SI' : 'NO'
  };
  if (meta.nombre.length < 3) throw new Error('El nombre es obligatorio.');
  if (normalizarDoc_(meta.documento).length < 4) throw new Error('El documento es obligatorio.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(meta.correo)) throw new Error('El correo no es válido.');
  if (!meta.pais || !meta.zona) throw new Error('País y zona son obligatorios.');
  if (meta.titulo.length < 3) throw new Error('El título es obligatorio.');
  if (meta.autoriza !== 'SI') throw new Error('Debes autorizar el uso del video.');
  return meta;
}

function buscarFila_(hoja, colIndice, valor) {
  var valores = hoja.getRange(1, colIndice + 1, Math.max(hoja.getLastRow(), 1), 1).getValues();
  for (var i = 1; i < valores.length; i++) if (String(valores[i][0]) === String(valor)) return i + 1;
  return 0;
}

function nuevoRadicado_() { return 'ABC-' + new Date().getFullYear() + '-' + String(incrementar_('CONTADOR_RADICADO')).padStart(5, '0'); }
function nuevoIdArbol_() { return 'ARB-' + String(incrementar_('CONTADOR_ARBOL')).padStart(5, '0'); }
function incrementar_(clave) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty(clave) || 0) + 1;
    props.setProperty(clave, String(n));
    return n;
  } finally { lock.releaseLock(); }
}

function guardarSesion_(id, s) {
  var txt = JSON.stringify(s);
  CacheService.getScriptCache().put('up_' + id, txt, 21600);
  PropertiesService.getScriptProperties().setProperty('up_' + id, txt);
}
function leerSesion_(id) {
  if (!id || !/^[A-Za-z0-9\-]{8,}$/.test(String(id))) throw new Error('Identificador de subida inválido.');
  var txt = CacheService.getScriptCache().get('up_' + id) || PropertiesService.getScriptProperties().getProperty('up_' + id);
  if (!txt) throw new Error('La sesión de subida no existe o expiró. Vuelve a enviar el video.');
  return JSON.parse(txt);
}
function borrarSesion_(id) {
  CacheService.getScriptCache().remove('up_' + id);
  PropertiesService.getScriptProperties().deleteProperty('up_' + id);
}
