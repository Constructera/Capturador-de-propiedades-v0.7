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
 * NUEVO EN v3.4 (unificación Markdowns + asesor inmutable):
 *   - POST {action:'migrateMarkdowns', pin} → repara la pestaña Markdowns que
 *     quedó con DOS bloques de columnas paralelos (A-H con headers viejos
 *     "UUID/Asesor/Fecha/…/Markdown/Última actualización" y I-R con los
 *     canónicos v3.2). Hace BACKUP completo en una pestaña nueva, fusiona
 *     todo al bloque canónico (en duplicados por uuid gana la fila nueva,
 *     pero el asesor ORIGINAL de la fila legada se conserva y el editor pasa
 *     a editadoPor), reescribe la hoja con SOLO las columnas canónicas y
 *     también corrige el asesor en Capturas si hubo conflicto. Idempotente.
 *   - Columna nueva "editadoPor" en Markdowns.
 *   - saveMarkdown ya NO permite pisar el asesor de una fila existente: si
 *     llega un asesor distinto, se conserva el original y el entrante queda
 *     como editadoPor (regla de producto: el editor no reemplaza al captador).
 *   - Carpetas Drive: el nombre ahora prefiere el NOMBRE de la propiedad
 *     ("Propiedad - Casa 87") en vez de la dirección — dos propiedades del
 *     mismo condominio compartían dirección y habrían compartido carpeta.
 *     Las carpetas ya creadas se reusan por uuid (no se duplica nada).
 *   - migrateMarkdowns además marca la pestaña "Asesores" como DEPRECATED
 *     (fila 1 de aviso + renombrada a "Asesores_DEPRECATED"): el ranking real
 *     se deriva de Capturas en cada GET; ningún bot debe leerla.
 *
 * NUEVO EN v3.3 (borrado con PIN + diagnóstico):
 *   POST {action:'deleteCapture', uuid, pin} → borra la fila de "Capturas"
 *   (por id) y la de "Markdowns" (por uuid). El PIN se valida AQUÍ además de
 *   en la app (doble seguro). La carpeta Drive NO se toca: puede tener fotos
 *   reales; borrarla sería pérdida de datos (se hace a mano si se desea).
 *   POST {action:'diag'} → radiografía de SOLO LECTURA del spreadsheet:
 *   pestañas, encabezados, conteo de filas y anomalías fila por fila
 *   (ids con formato raro, JSON que no parsea, celdas clave vacías). Para
 *   diagnosticar corrimientos de columnas sin abrir el Sheet.
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

/* PIN de borrado (v3.3): deleteCapture exige este PIN aunque la app ya lo
 * haya pedido — doble seguro contra borrados accidentales o requests sueltos. */
var DELETE_PIN = '1512';

var CAP_SHEET = 'Capturas';
var CAP_HEADERS = ['id','timestamp','tipo','asesor','estrellas','calidad',
  'propiedad_json','contacto_json','capturadoEn','modificadoEn'];

var MD_SHEET = 'Markdowns';
var MD_HEADERS = ['uuid','fecha','asesor','tipo','estatus','nombre','direccion',
  'markdown_md','folderUrl','modificadoEn','editadoPor'];

/* ===================== entradas ===================== */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (API_KEY && String(body.k || '') !== API_KEY) return jsonOut({ok:false, error:'No autorizado'});
    if (body.action === 'ping') return jsonOut({ok:true, msg:'Hauser GAS v3.4 online'});
    if (body.action === 'saveMarkdown') return handleSaveMarkdown_(body);
    if (body.action === 'deleteCapture') return handleDeleteCapture_(body);
    if (body.action === 'migrateMarkdowns') return handleMigrateMarkdowns_(body);
    if (body.action === 'diag') return jsonOut(diag_());
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
  // v3.4: el asesor original NUNCA se pisa. Si llega uno distinto para una
  // fila existente, se conserva el original y el entrante queda en editadoPor.
  var asesor = p.asesor || 'S/I';
  var editadoPor = p.editadoPor || '';
  var prev = findByKey_(sh, 'uuid', p.uuid);
  if (prev && prev.asesor && String(prev.asesor) !== String(asesor)) {
    if (!editadoPor) editadoPor = asesor;
    asesor = String(prev.asesor);
  }
  upsert_(sh, 'uuid', {
    uuid: p.uuid,
    fecha: p.fecha || new Date().toISOString(),
    asesor: asesor,
    tipo: p.tipo || '',
    estatus: p.estatus || '',
    nombre: p.nombre || '',
    direccion: p.direccion || '',
    markdown_md: p.markdown_md || '',
    folderUrl: folderUrl,
    modificadoEn: new Date().toISOString(),
    editadoPor: editadoPor
  });
  return jsonOut({ok:true, folderUrl: folderUrl});
}

/* Devuelve la fila (como objeto header→valor) cuya celda clave coincida. */
function findByKey_(sh, keyName, val) {
  var hdr = headers_(sh);
  var k = hdr.indexOf(keyName);
  if (k === -1) return null;
  var n = sh.getLastRow();
  if (n < 2) return null;
  var data = sh.getRange(2, 1, n - 1, hdr.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][k]) === String(val)) {
      var o = {_row: i + 2};
      hdr.forEach(function (h, j) { o[h] = data[i][j]; });
      return o;
    }
  }
  return null;
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
  // 2. nombre de carpeta (v3.4): "Propiedad - <Nombre>" — el nombre es único por
  //    propiedad; la dirección puede repetirse (condominios) y colisionar carpetas
  var base = (p.nombre && String(p.nombre).trim()) || (p.direccion && String(p.direccion).trim()) || p.uuid;
  var name = 'Propiedad - ' + String(base).slice(0, 100);
  var parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  // 3. reusar por nombre dentro de la carpeta madre (por si la hoja se limpió)
  var it = parent.getFoldersByName(name);
  var folder = it.hasNext() ? it.next() : parent.createFolder(name);
  return folder.getUrl();
}

/* ===================== borrado con PIN (v3.3) ===================== */

function handleDeleteCapture_(p) {
  if (String(p.pin || '') !== DELETE_PIN) return jsonOut({ok:false, error:'PIN incorrecto'});
  if (!p.uuid) return jsonOut({ok:false, error:'deleteCapture sin uuid'});
  var delCap = deleteRowByKey_(getSheet_(CAP_SHEET, CAP_HEADERS), 'id', p.uuid);
  var delMd = deleteRowByKey_(getSheet_(MD_SHEET, MD_HEADERS), 'uuid', p.uuid);
  // La carpeta Drive se conserva a propósito (puede tener fotos reales).
  return jsonOut({ok:true, deleted:{capturas:delCap, markdowns:delMd}});
}

/* Borra la primera fila cuya celda clave coincida. false si no existe. */
function deleteRowByKey_(sh, keyName, val) {
  var hdr = headers_(sh);
  var k = hdr.indexOf(keyName);
  if (k === -1) return false;
  var n = sh.getLastRow();
  if (n < 2) return false;
  var keys = sh.getRange(2, k + 1, n - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(val)) { sh.deleteRow(i + 2); return true; }
  }
  return false;
}

/* ===================== unificación Markdowns (v3.4) ===================== */

/* Headers legados (v2B) → canónicos. Se comparan normalizados (minúsculas,
   sin acentos) pero solo se consideran LEGADOS los que no son idénticos al
   canónico (así "uuid" es canónico y "UUID" es legado). */
var LEGACY_MD_MAP = {
  'uuid':'uuid', 'asesor':'asesor', 'fecha':'fecha', 'tipo':'tipo',
  'estatus':'estatus', 'nombre':'nombre', 'markdown':'markdown_md',
  'markdown_md':'markdown_md', 'direccion':'direccion', 'folderurl':'folderUrl',
  'ultima actualizacion':'modificadoEn', 'modificadoen':'modificadoEn',
  'editadopor':'editadoPor'
};
function normHdr_(h) {
  return String(h).toLowerCase()
    .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o').replace(/[úù]/g, 'u').replace(/\s+/g, ' ').trim();
}

function handleMigrateMarkdowns_(p) {
  if (String(p.pin || '') !== DELETE_PIN) return jsonOut({ok:false, error:'PIN incorrecto'});
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = {ok:true, acciones:[], conflictosAsesor:[]};
  var sh = ss.getSheetByName(MD_SHEET);

  if (sh && sh.getLastRow() > 0) {
    var lastCol = sh.getLastColumn();
    var all = sh.getRange(1, 1, sh.getLastRow(), Math.max(lastCol, 1)).getValues();
    var hdr = all[0].map(String);

    // columnas canónicas = primera aparición EXACTA de cada header canónico
    var canonCols = {};
    MD_HEADERS.forEach(function (h) {
      var idx = hdr.indexOf(h);
      if (idx !== -1) canonCols[h] = idx;
    });
    // columnas legadas = normalizadas que mapean a un canónico pero NO son la exacta
    var legacyCols = {};
    hdr.forEach(function (h, idx) {
      if (canonCols[h] === idx) return;
      var canon = LEGACY_MD_MAP[normHdr_(h)];
      if (canon && legacyCols[canon] === undefined) legacyCols[canon] = idx;
    });
    var hayLegado = Object.keys(legacyCols).length > 0;

    if (hayLegado) {
      // 1. BACKUP completo antes de tocar nada (cero riesgo de pérdida)
      var backupName = MD_SHEET + '_backup_' + new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 13);
      var bk = sh.copyTo(ss);
      bk.setName(backupName);
      res.backup = backupName;
      res.acciones.push('backup creado: ' + backupName);

      // 2. extraer registros de ambos bloques
      var canonRecs = [], legacyRecs = [];
      all.slice(1).forEach(function (row) {
        var c = {}, l = {};
        Object.keys(canonCols).forEach(function (h) { c[h] = row[canonCols[h]]; });
        Object.keys(legacyCols).forEach(function (h) { l[h] = row[legacyCols[h]]; });
        if (String(c.uuid || '').trim()) canonRecs.push(c);
        if (String(l.uuid || '').trim()) legacyRecs.push(l);
      });

      // 3. fusionar por uuid: gana la fila canónica (más nueva, con folderUrl),
      //    pero el asesor ORIGINAL legado se conserva; el entrante → editadoPor
      var porUuid = {}, orden = [];
      legacyRecs.forEach(function (r) { porUuid[String(r.uuid)] = r; orden.push(String(r.uuid)); });
      canonRecs.forEach(function (r) {
        var id = String(r.uuid);
        var prev = porUuid[id];
        if (prev) {
          if (prev.asesor && r.asesor && String(prev.asesor) !== String(r.asesor)) {
            if (!r.editadoPor) r.editadoPor = r.asesor;
            r.asesor = prev.asesor;
            res.conflictosAsesor.push({uuid:id, asesorOriginal:String(prev.asesor), editadoPor:String(r.editadoPor)});
          }
        } else orden.push(id);
        porUuid[id] = prev ? Object.assign({}, prev, r, {asesor:r.asesor}) : r;
      });

      // 4. reescribir la hoja SOLO con columnas canónicas
      sh.clear();
      var salida = [MD_HEADERS];
      orden.forEach(function (id) {
        var r = porUuid[id];
        salida.push(MD_HEADERS.map(function (h) { return r[h] !== undefined ? r[h] : ''; }));
      });
      sh.getRange(1, 1, salida.length, MD_HEADERS.length).setValues(salida);
      sh.setFrozenRows(1);
      res.acciones.push('Markdowns unificada: ' + (salida.length - 1) + ' filas en bloque canónico único');

      // 5. propagar conflictos de asesor a la hoja Capturas (columna + json)
      res.conflictosAsesor.forEach(function (cf) {
        var shc = ss.getSheetByName(CAP_SHEET);
        if (!shc) return;
        var fila = findByKey_(shc, 'id', cf.uuid);
        if (!fila) return;
        var hdrC = headers_(shc);
        var iA = hdrC.indexOf('asesor'), iPJ = hdrC.indexOf('propiedad_json');
        if (iA !== -1) shc.getRange(fila._row, iA + 1, 1, 1).setValues([[cf.asesorOriginal]]);
        if (iPJ !== -1) {
          try {
            var pj = JSON.parse(fila.propiedad_json);
            pj.asesorNombre = cf.asesorOriginal;
            if (!pj.editadoPor) pj.editadoPor = cf.editadoPor;
            shc.getRange(fila._row, iPJ + 1, 1, 1).setValues([[JSON.stringify(pj)]]);
          } catch (_e) {}
        }
        res.acciones.push('Capturas: asesor de ' + cf.uuid + ' restaurado a ' + cf.asesorOriginal);
      });
    } else {
      res.acciones.push('Markdowns ya está en bloque canónico único: nada que migrar');
    }
  } else res.acciones.push('sin hoja Markdowns con datos');

  // 6. deprecar la hoja Asesores (ranking real se deriva de Capturas)
  var sa = ss.getSheetByName('Asesores');
  if (sa) {
    sa.insertRowBefore(1);
    sa.getRange(1, 1, 1, 1).setValues([['DEPRECATED — no leer; el ranking real se deriva de la pestaña Capturas en cada GET']]);
    sa.setName('Asesores_DEPRECATED');
    res.acciones.push('hoja Asesores marcada DEPRECATED y renombrada');
  }
  return jsonOut(res);
}

/* ===================== diagnóstico solo lectura (v3.3) ===================== */

function diag_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = {ok:true, sheets:[]};
  ss.getSheets().forEach(function (s) {
    var hdr = headers_(s);
    var n = s.getLastRow();
    var info = {name:s.getName(), filas:Math.max(0, n - 1), headers:hdr, anomalias:[]};
    // headers duplicados con distinta capitalización = bloques paralelos (bug v3.2)
    var vistos = {};
    hdr.forEach(function (h) {
      var k = normHdr_(h);
      if (vistos[k]) {
        info.headersDuplicados = info.headersDuplicados || [];
        info.headersDuplicados.push(vistos[k] + ' / ' + h);
      } else vistos[k] = h;
    });
    var canon = s.getName() === CAP_SHEET ? CAP_HEADERS : (s.getName() === MD_SHEET ? MD_HEADERS : null);
    if (canon) {
      info.ordenCanonico = JSON.stringify(hdr) === JSON.stringify(canon);
      if (n > 1) {
        var data = s.getRange(2, 1, n - 1, Math.max(hdr.length, 1)).getValues();
        data.forEach(function (row, idx) {
          var fila = idx + 2;
          var o = {};
          hdr.forEach(function (h, i) { o[h] = row[i]; });
          if (s.getName() === CAP_SHEET) {
            if (!/^(CAP|CT)-/.test(String(o.id || ''))) info.anomalias.push('fila ' + fila + ': id raro "' + o.id + '"');
            if (['propiedad', 'contacto'].indexOf(String(o.tipo)) === -1) info.anomalias.push('fila ' + fila + ': tipo "' + o.tipo + '"');
            if (String(o.tipo) === 'propiedad') {
              try { JSON.parse(o.propiedad_json); } catch (_e) { info.anomalias.push('fila ' + fila + ': propiedad_json no parsea'); }
            }
          } else {
            if (!String(o.uuid || '')) info.anomalias.push('fila ' + fila + ': uuid vacío');
            if (o.folderUrl && String(o.folderUrl).indexOf('http') !== 0) info.anomalias.push('fila ' + fila + ': folderUrl rara "' + String(o.folderUrl).slice(0, 30) + '"');
          }
        });
      }
    }
    out.sheets.push(info);
  });
  return out;
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
