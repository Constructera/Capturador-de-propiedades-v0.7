/**
 * Google Apps Script — Capturadora Hauser v3 (v0.7 Bloque 2)
 * Ranking compartido + sincronización de capturas + markdowns + CARPETAS DRIVE
 *
 * REEMPLAZA a la implementación actual (v2B extendida). Implementa el contrato
 * completo que usa app.js v0.7:
 *   POST (flat, sin action)      → upsert de captura en hoja "Capturas"
 *   POST {action:'saveMarkdown'} → upsert en hoja "Markdowns" + carpeta Drive
 *                                  (solo tipo 'propiedad') + devuelve folderUrl
 *   POST {action:'ping'}         → healthcheck
 *   GET                          → {ok, capturas:[filas con encabezado],
 *                                       asesores:[filas agregadas con encabezado]}
 *
 * NUEVO EN v3 (Bloque 2):
 *   Al guardar un markdown de propiedad se crea (o reutiliza) una carpeta en
 *   Drive dentro de la carpeta madre PARENT_FOLDER_ID con nombre
 *   "Propiedad - <Dirección>" (si no hay dirección, usa el nombre de la
 *   propiedad). La URL se guarda en la columna folderUrl de "Markdowns" y se
 *   devuelve en la respuesta como {ok:true, folderUrl:"..."}.
 *   Reutilización: primero por uuid (columna folderUrl ya llena), luego por
 *   nombre de carpeta en la carpeta madre. Nunca duplica carpetas al editar.
 *
 * NUEVO EN v3.1 (reconciliación de pestañas):
 *   getSheet_ se auto-repara: si la pestaña canónica ("Capturas"/"Markdowns")
 *   está vacía pero existe una pestaña legada CON el histórico real (p. ej.
 *   "Hoja 1"), borra la canónica vacía y RENOMBRA la legada al nombre canónico
 *   (cero pérdida de datos). También elimina pestañas "*_conflict" vacías.
 *   Nunca borra una hoja con datos. La hoja "Asesores" queda SIN USO: el
 *   ranking se deriva de las capturas reales en cada GET (borrarla es opcional).
 *
 * NUEVO EN v3.2 (fix autorización de escritura):
 *   testDrive ahora crea y trashea una subcarpeta temporal para forzar el
 *   scope completo https://www.googleapis.com/auth/drive al autorizar (leer la
 *   carpeta madre pasaba con drive.readonly y saveMarkdown seguía fallando en
 *   createFolder). Instrucciones de manifiesto appsscript.json abajo.
 *
 * INSTRUCCIONES DE DESPLIEGUE (v3.2):
 * 1. Abre script.google.com → el proyecto EXISTENTE del endpoint actual.
 * 2. Reemplaza el código por este archivo completo y GUARDA.
 * 3. ARREGLA EL MANIFIESTO (causa del error "No cuentas con el permiso para
 *    llamar a DriveApp.Folder.createFolder" aunque testDrive haya pasado):
 *    ⚙ Configuración del proyecto → marca "Mostrar el archivo de manifiesto
 *    appsscript.json" → abre appsscript.json en el editor. Si existe una lista
 *    "oauthScopes", DEBE incluir el scope COMPLETO de Drive (no el .readonly):
 *      "oauthScopes": [
 *        "https://www.googleapis.com/auth/drive",
 *        "https://www.googleapis.com/auth/spreadsheets"
 *      ]
 *    Guarda. (Si NO existe la lista "oauthScopes", no agregues nada: los
 *    scopes se detectan solos.)
 * 4. AUTORIZA: selecciona `testDrive` en el desplegable de funciones y pulsa
 *    ▶ Ejecutar. Acepta el diálogo de permisos (Avanzado → Ir a … → Permitir).
 *    testDrive ahora CREA y manda a la papelera una subcarpeta temporal, así
 *    que si el log dice "Drive escritura OK", el scope de escritura quedó
 *    concedido de verdad (leer la carpeta madre NO basta: eso funciona hasta
 *    con permiso de solo lectura).
 * 5. Menú Implementar → Administrar implementaciones → editar la implementación
 *    activa → Versión: "Nueva versión" → Implementar. (Así la URL del endpoint
 *    NO cambia y la app no necesita reconfigurarse.)
 * 6. Verificación: POST {"action":"ping"} debe responder "Hauser GAS v3.2
 *    online"; un saveMarkdown de propiedad debe devolver folderUrl no vacío.
 */

var PARENT_FOLDER_ID = '1PTKX6TZSR94Hailc3qvWBbK_zQkE6Vhn'; // carpeta madre en Drive

/* Seguridad (opcional): si se define una clave aquí, TODA petición (POST y GET)
 * debe traerla — POST: propiedad "k" en el body JSON; GET: parámetro ?k=...
 * La misma clave se escribe en la app: Configuración → "Clave del backend".
 * Vacía ('') = validación apagada (compatible con la app sin clave). */
var API_KEY = '';

var CAP_SHEET = 'Capturas';
var CAP_HEADERS = ['id','timestamp','tipo','asesor','estrellas','calidad',
  'propiedad_json','contacto_json','capturadoEn','modificadoEn'];

var MD_SHEET = 'Markdowns';
var MD_HEADERS = ['uuid','fecha','asesor','tipo','estatus','nombre','direccion',
  'markdown_md','folderUrl','modificadoEn'];

/* ===================== entradas ===================== */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (API_KEY && String(body.k || '') !== API_KEY) return jsonOut({ok:false, error:'No autorizado'});
    if (body.action === 'ping') return jsonOut({ok:true, msg:'Hauser GAS v3.2 online'});
    if (body.action === 'saveMarkdown') return handleSaveMarkdown_(body);
    if (body.id) return handleSaveCapture_(body); // payload plano de captura
    return jsonOut({ok:false, error:'Payload no reconocido'});
  } catch (err) {
    return jsonOut({ok:false, error:err.toString()});
  }
}

function doGet(e) {
  try {
    if (API_KEY && String((e && e.parameter && e.parameter.k) || '') !== API_KEY) {
      return jsonOut({ok:false, error:'No autorizado'});
    }
    var sh = getSheet_(CAP_SHEET, CAP_HEADERS);
    var hdr = headers_(sh);
    var n = sh.getLastRow();
    var rows = n > 1 ? sh.getRange(2, 1, n - 1, hdr.length).getValues() : [];
    return jsonOut({ok:true,
      capturas: [hdr].concat(rows),
      asesores: buildAsesores_(hdr, rows)});
  } catch (err) {
    return jsonOut({ok:false, error:err.toString()});
  }
}

/* ===================== capturas ===================== */

function handleSaveCapture_(p) {
  var sh = getSheet_(CAP_SHEET, CAP_HEADERS);
  upsert_(sh, 'id', p);
  return jsonOut({ok:true});
}

/* ===================== markdowns + Drive ===================== */

function handleSaveMarkdown_(p) {
  if (!p.uuid) return jsonOut({ok:false, error:'saveMarkdown sin uuid'});
  var sh = getSheet_(MD_SHEET, MD_HEADERS);
  var folderUrl = '';
  if (p.tipo === 'propiedad') folderUrl = ensureDriveFolder_(sh, p);
  upsert_(sh, 'uuid', {
    uuid: p.uuid,
    fecha: p.fecha || new Date().toISOString(),
    asesor: p.asesor || 'S/I',
    tipo: p.tipo || '',
    estatus: p.estatus || '',
    nombre: p.nombre || '',
    direccion: p.direccion || '',
    markdown_md: p.markdown_md || '',
    folderUrl: folderUrl,
    modificadoEn: new Date().toISOString()
  });
  return jsonOut({ok:true, folderUrl: folderUrl});
}

/* Crea o reutiliza la carpeta Drive de una propiedad. Nunca duplica. */
function ensureDriveFolder_(sh, p) {
  // 1. reusar por uuid: si la fila del markdown ya tiene folderUrl, esa manda
  var hdr = headers_(sh);
  var kU = hdr.indexOf('uuid'), kF = hdr.indexOf('folderUrl');
  var n = sh.getLastRow();
  if (n > 1 && kU > -1 && kF > -1) {
    var data = sh.getRange(2, 1, n - 1, hdr.length).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][kU]) === String(p.uuid) && data[i][kF]) return String(data[i][kF]);
    }
  }
  // 2. nombre de carpeta: "Propiedad - <Dirección>" (fallback: nombre, uuid)
  var base = (p.direccion && String(p.direccion).trim()) || (p.nombre && String(p.nombre).trim()) || p.uuid;
  var name = 'Propiedad - ' + base;
  var parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  // 3. reusar por nombre dentro de la carpeta madre (por si la hoja se limpió)
  var it = parent.getFoldersByName(name);
  var folder = it.hasNext() ? it.next() : parent.createFolder(name);
  return folder.getUrl();
}

/* ===================== ranking (asesores agregados) ===================== */

function buildAsesores_(hdr, rows) {
  var iA = hdr.indexOf('asesor'), iE = hdr.indexOf('estrellas'), iC = hdr.indexOf('calidad'),
      iT = hdr.indexOf('timestamp'), iTipo = hdr.indexOf('tipo'), iPJ = hdr.indexOf('propiedad_json');
  var map = {};
  rows.forEach(function (r) {
    if (String(r[iTipo]) !== 'propiedad') return;
    var a = String(r[iA] || 'S/I');
    var m = map[a] || (map[a] = {asesor:a, totalCapturas:0, totalEstrellas:0,
      capturasCompletas:0, capturasEsenciales:0, mejorTiempo:'', ultimaCaptura:''});
    m.totalCapturas++;
    m.totalEstrellas += parseInt(r[iE], 10) || 0;
    var cal = String(r[iC] || '');
    if (cal === 'Completa') m.capturasCompletas++;
    if (cal === 'Completa' || cal === 'Publicable' || cal === 'Esencial') m.capturasEsenciales++;
    var elapsed = 0;
    try { elapsed = parseInt(JSON.parse(r[iPJ]).elapsed, 10) || 0; } catch (_e) {}
    if (elapsed > 0 && (m.mejorTiempo === '' || elapsed < m.mejorTiempo)) m.mejorTiempo = elapsed;
    var ts = String(r[iT] || '');
    if (ts && (!m.ultimaCaptura || ts > m.ultimaCaptura)) m.ultimaCaptura = ts;
  });
  var H = ['asesor','totalCapturas','totalEstrellas','capturasCompletas','capturasEsenciales','mejorTiempo','ultimaCaptura'];
  var out = [H];
  Object.keys(map).forEach(function (k) {
    var m = map[k];
    out.push(H.map(function (h) { return m[h]; }));
  });
  return out;
}

/* ===================== helpers de hoja ===================== */

/* Columnas clave que identifican a una hoja legada como "la de verdad" cuando
   el histórico quedó en una pestaña con otro nombre (p. ej. "Hoja 1"). */
var KEY_COLS = {};
KEY_COLS[CAP_SHEET] = ['id', 'asesor', 'propiedad_json'];
KEY_COLS[MD_SHEET] = ['uuid', 'markdown_md'];

/* Devuelve la hoja canónica con auto-reconciliación (v3.1):
   1. Si la hoja canónica existe Y tiene datos → se usa tal cual.
   2. Si está vacía o falta, busca una hoja legada CON datos cuyos encabezados
      contengan las columnas clave (p. ej. "Hoja 1" con el histórico real):
      borra la canónica vacía y RENOMBRA la legada al nombre canónico
      (renombrar no toca ni una celda: cero pérdida de datos).
   3. Borra pestañas "<nombre>_conflict*" solo si están vacías (≤1 fila).
   4. Si no hay nada, la crea con los encabezados canónicos.
   Nunca se elimina una hoja que tenga datos. Idempotente: tras la primera
   llamada, todo cae en el caso 1. */
function getSheet_(name, canonical) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 3. limpiar pestañas _conflict vacías (las genera Sheets en conflictos de edición)
  ss.getSheets().forEach(function (s) {
    if (s.getName().indexOf(name + '_conflict') === 0 && s.getLastRow() <= 1) ss.deleteSheet(s);
  });

  var sh = ss.getSheetByName(name);
  if (sh && sh.getLastRow() > 1) { ensureCols_(sh, canonical); return sh; } // 1

  // 2. adoptar hoja legada con datos y columnas clave
  var keys = KEY_COLS[name] || [];
  var legacy = null;
  ss.getSheets().forEach(function (s) {
    if (legacy || s.getName() === name) return;
    if (s.getName().indexOf('_conflict') !== -1) return;
    if (s.getLastRow() <= 1) return;
    var hdr = headers_(s);
    var tieneClaves = keys.length && keys.every(function (k) { return hdr.indexOf(k) !== -1; });
    if (tieneClaves) legacy = s;
  });
  if (legacy) {
    if (sh) ss.deleteSheet(sh); // solo se borra la canónica VACÍA
    legacy.setName(name);
    ensureCols_(legacy, canonical);
    return legacy;
  }

  // 4. crear desde cero
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(canonical);
    sh.setFrozenRows(1);
    return sh;
  }
  ensureCols_(sh, canonical);
  return sh;
}

/* Agrega al final las columnas canónicas que falten (aditivo). */
function ensureCols_(sh, canonical) {
  var hdr = headers_(sh);
  var missing = canonical.filter(function (h) { return hdr.indexOf(h) === -1; });
  if (missing.length) sh.getRange(1, hdr.length + 1, 1, missing.length).setValues([missing]);
}

/* Ejecuta esta función UNA VEZ desde el editor (▶ Ejecutar) para forzar el
   diálogo de autorización de Drive con scope de ESCRITURA. Leer la carpeta
   madre no basta (funciona con drive.readonly); por eso además crea una
   subcarpeta temporal y la manda a la papelera. Si el log termina en
   "Drive escritura OK", saveMarkdown ya puede crear carpetas. */
function testDrive() {
  var f = DriveApp.getFolderById(PARENT_FOLDER_ID);
  Logger.log('Carpeta madre OK: ' + f.getName() + ' (' + f.getUrl() + ')');
  var tmp = f.createFolder('__test_autorizacion__ (se borra sola)');
  tmp.setTrashed(true);
  Logger.log('Drive escritura OK: createFolder + papelera funcionaron.');
}

function headers_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter(function (h) { return h !== ''; });
}

/* Inserta o actualiza (por columna clave) mapeando el objeto a los encabezados
   reales de la hoja. Claves del payload que no existan como columna se ignoran;
   columnas sin dato conservan su valor previo (en update) o quedan vacías. */
function upsert_(sh, keyName, obj) {
  var hdr = headers_(sh);
  var keyIdx = hdr.indexOf(keyName);
  if (keyIdx === -1) throw new Error('Columna clave "' + keyName + '" no existe en ' + sh.getName());
  var rowIdx = -1;
  var n = sh.getLastRow();
  if (n > 1) {
    var keys = sh.getRange(2, keyIdx + 1, n - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(obj[keyName])) { rowIdx = i + 2; break; }
    }
  }
  var existing = rowIdx > 0 ? sh.getRange(rowIdx, 1, 1, hdr.length).getValues()[0] : null;
  var row = hdr.map(function (h, idx) {
    return obj.hasOwnProperty(h) ? obj[h] : (existing ? existing[idx] : '');
  });
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, hdr.length).setValues([row]);
  else sh.appendRow(row);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
