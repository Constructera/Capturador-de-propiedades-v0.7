/*
 * test_gas.js — Pruebas del Google Apps Script v3 (docs/GAS_v3_drive.gs)
 * ejecutadas en Node con mocks de SpreadsheetApp / DriveApp / ContentService.
 * Valida el contrato completo que consume app.js + la creación de carpetas
 * Drive del Bloque 2.
 *
 * Uso:  node tests/test_gas.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var gasSrc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'GAS_v3_drive.gs'), 'utf8');

var passed = 0, failed = 0, failures = [];
function assert(cond, name) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.error('  ❌ ' + name); }
}

/* ============ mocks del entorno GAS ============ */
function MockSheet(name) {
  this._name = name;
  this._rows = []; // matriz de valores, fila 0 = encabezados
}
MockSheet.prototype.getName = function () { return this._name; };
MockSheet.prototype.setName = function (n) { this._name = n; };
MockSheet.prototype.appendRow = function (row) { this._rows.push(row.slice()); };
MockSheet.prototype.setFrozenRows = function () {};
MockSheet.prototype.deleteRow = function (rowIdx) { this._rows.splice(rowIdx - 1, 1); };
MockSheet.prototype.clear = function () { this._rows = []; };
MockSheet.prototype.insertRowBefore = function (rowIdx) { this._rows.splice(rowIdx - 1, 0, []); };
MockSheet.prototype.copyTo = function (ss) {
  var c = ss.insertSheet(this._name + '_copy' + Math.random().toString(36).slice(2, 6));
  c._rows = this._rows.map(function (r) { return r.slice(); });
  return c;
};
MockSheet.prototype.getLastRow = function () { return this._rows.length; };
MockSheet.prototype.getLastColumn = function () {
  return this._rows.length ? Math.max.apply(null, this._rows.map(function (r) { return r.length; })) : 0;
};
MockSheet.prototype.getRange = function (row, col, numRows, numCols) {
  numRows = numRows || 1; numCols = numCols || 1;
  var self = this;
  return {
    getValues: function () {
      var out = [];
      for (var r = 0; r < numRows; r++) {
        var src = self._rows[row - 1 + r] || [];
        var line = [];
        for (var c = 0; c < numCols; c++) line.push(src[col - 1 + c] !== undefined ? src[col - 1 + c] : '');
        out.push(line);
      }
      return out;
    },
    setValues: function (vals) {
      for (var r = 0; r < vals.length; r++) {
        var tr = row - 1 + r;
        while (self._rows.length <= tr) self._rows.push([]);
        for (var c = 0; c < vals[r].length; c++) {
          var tc = col - 1 + c;
          while (self._rows[tr].length <= tc) self._rows[tr].push('');
          self._rows[tr][tc] = vals[r][c];
        }
      }
    }
  };
};

function freshEnv() {
  var sheets = {};
  var driveFolders = []; // carpetas creadas en la carpeta madre
  var ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: function () {
        return {
          getSheetByName: function (n) {
            var found = null;
            Object.keys(sheets).forEach(function (k) { if (sheets[k]._name === n) found = sheets[k]; });
            return found;
          },
          insertSheet: function (n) { sheets[n] = new MockSheet(n); return sheets[n]; },
          getSheets: function () { return Object.keys(sheets).map(function (k) { return sheets[k]; }); },
          deleteSheet: function (sh) {
            Object.keys(sheets).forEach(function (k) { if (sheets[k] === sh) delete sheets[k]; });
          }
        };
      }
    },
    DriveApp: {
      _folders: driveFolders,
      getFolderById: function (id) {
        // v3.6: también se piden por id las carpetas de propiedades (getFiles)
        var own = driveFolders.filter(function (f) { return f.id === id; })[0];
        if (own) return own.api;
        if (id !== '1PTKX6TZSR94Hailc3qvWBbK_zQkE6Vhn') throw new Error('Folder id inesperado: ' + id);
        return {
          getFoldersByName: function (name) {
            var found = driveFolders.filter(function (f) { return f.name === name; });
            var i = 0;
            return { hasNext: function () { return i < found.length; },
                     next: function () { return found[i++].api; } };
          },
          createFolder: function (name) {
            var f = {name: name, id: 'FLD' + (driveFolders.length + 1), files: []};
            f.api = {
              getUrl: function () { return 'https://drive.google.com/drive/folders/' + f.id; },
              getId: function () { return f.id; },
              getName: function () { return f.name; },
              getFiles: function () {
                var i = 0;
                return { hasNext: function () { return i < f.files.length; },
                         next: function () {
                           var file = f.files[i++];
                           function blob(mime) { return { getContentType: function () { return mime; }, getBytes: function () { return file.bytes || [0, 1, 2, 3]; } }; }
                           return { getId: function () { return file.id; },
                                    getMimeType: function () { return file.mime; },
                                    getName: function () { return file.name; },
                                    // v3.7.1 (Bloque O): getFoto → base64 desde miniatura/blob
                                    getThumbnail: function () { return blob('image/png'); },
                                    getBlob: function () { return blob(file.mime); } };
                         } };
              },
              _addFile: function (name, mime, id) { f.files.push({name: name, mime: mime, id: id}); },
              // v3.7 (Bloque M): subir foto → crear archivo en la carpeta
              createFile: function (blob) {
                var id = 'FILE' + Math.random().toString(36).slice(2, 8);
                f.files.push({name: blob._name, mime: blob._mime, id: id, bytes: blob._bytes});
                return { getId: function () { return id; }, getName: function () { return blob._name; },
                         getUrl: function () { return 'https://drive.google.com/file/d/' + id; } };
              }
            };
            driveFolders.push(f);
            return f.api;
          }
        };
      }
    },
    ContentService: {
      MimeType: {JSON: 'application/json'},
      createTextOutput: function (s) {
        return { _content: s, setMimeType: function () { return this; }, getContent: function () { return this._content; } };
      }
    },
    Utilities: {
      base64Decode: function (s) { return { _b64: String(s), length: String(s).length }; },
      newBlob: function (bytes, mime, name) { return { _bytes: bytes, _mime: mime, _name: name }; },
      base64Encode: function (bytes) { return 'B64(' + (bytes && bytes.length ? bytes.length : 0) + ')'; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(gasSrc, ctx);
  ctx._sheets = sheets;
  ctx._drive = driveFolders;
  ctx.post = function (obj) {
    var out = ctx.doPost({postData: {contents: JSON.stringify(obj)}});
    return JSON.parse(out.getContent());
  };
  ctx.get = function () { return JSON.parse(ctx.doGet({}).getContent()); };
  return ctx;
}

/* ============ 1. saveMarkdown crea carpeta Drive y devuelve folderUrl ============ */
console.log('\n[G1] saveMarkdown de propiedad crea carpeta y devuelve folderUrl');
(function () {
  var g = freshEnv();
  var r = g.post({action:'saveMarkdown', uuid:'CAP-TEST1', asesor:'Daniel',
    fecha:'2026-07-02T08:00:00Z', tipo:'propiedad', estatus:'sin terminar',
    nombre:'Casa Palmira', direccion:'Av. Palmira 123, Cuernavaca', markdown_md:'# md1'});
  assert(r.ok === true, 'respuesta ok');
  assert(r.folderUrl === 'https://drive.google.com/drive/folders/FLD1', 'devuelve folderUrl en la misma respuesta');
  assert(g._drive.length === 1, 'se creó exactamente UNA carpeta en Drive');
  assert(g._drive[0].name === 'Propiedad - Casa Palmira', 'nombre "Propiedad - <Nombre>" (v3.4: el nombre no colisiona entre propiedades del mismo condominio)');
  var md = g._sheets['Markdowns']._rows;
  var hdr = md[0];
  assert(hdr.indexOf('folderUrl') !== -1, 'hoja Markdowns tiene columna folderUrl');
  assert(md[1][hdr.indexOf('folderUrl')] === r.folderUrl, 'folderUrl guardada en la hoja');
  assert(md[1][hdr.indexOf('markdown_md')] === '# md1', 'markdown guardado');
})();

/* ============ 2. Reedición: reutiliza carpeta, no duplica ============ */
console.log('\n[G2] editar el mismo uuid reutiliza la carpeta (sin duplicar)');
(function () {
  var g = freshEnv();
  var r1 = g.post({action:'saveMarkdown', uuid:'CAP-X', tipo:'propiedad',
    nombre:'Casa A', direccion:'Calle 1 #10', markdown_md:'# v1'});
  var r2 = g.post({action:'saveMarkdown', uuid:'CAP-X', tipo:'propiedad',
    nombre:'Casa A', direccion:'Calle 1 #10', markdown_md:'# v2 editado'});
  assert(r2.ok && r2.folderUrl === r1.folderUrl, 'misma folderUrl en la reedición');
  assert(g._drive.length === 1, 'sigue habiendo UNA sola carpeta');
  var md = g._sheets['Markdowns']._rows;
  assert(md.length === 2, 'upsert: una sola fila por uuid en Markdowns');
  assert(md[1][md[0].indexOf('markdown_md')] === '# v2 editado', 'la fila se actualizó con el markdown editado');
})();

/* ============ 3. Sin dirección usa nombre; contacto no crea carpeta ============ */
console.log('\n[G3] fallbacks de nombre y contactos');
(function () {
  var g = freshEnv();
  var r = g.post({action:'saveMarkdown', uuid:'CAP-Y', tipo:'propiedad', nombre:'Depto Centro', direccion:'', markdown_md:'#'});
  assert(g._drive[0] && g._drive[0].name === 'Propiedad - Depto Centro', 'sin dirección → usa el nombre de la propiedad');
  var rSin = g.post({action:'saveMarkdown', uuid:'CAP-SN', tipo:'propiedad', nombre:'', direccion:'Calle Sola 77', markdown_md:'#'});
  assert(rSin.ok && g._drive[1] && g._drive[1].name === 'Propiedad - Calle Sola 77', 'sin nombre → cae a la dirección');
  var rc = g.post({action:'saveMarkdown', uuid:'CT-1', tipo:'contacto', nombre:'Juan Pérez', markdown_md:'#'});
  assert(rc.ok === true && rc.folderUrl === '', 'contacto: ok sin carpeta (folderUrl vacía)');
  assert(g._drive.length === 2, 'contacto no creó carpeta');
  // carpeta huérfana con mismo nombre → se reutiliza aunque la hoja no la tenga
  var g2 = freshEnv();
  g2.DriveApp.getFolderById('1PTKX6TZSR94Hailc3qvWBbK_zQkE6Vhn').createFolder('Propiedad - Casa B');
  var rb = g2.post({action:'saveMarkdown', uuid:'CAP-Z', tipo:'propiedad', nombre:'Casa B', direccion:'', markdown_md:'#'});
  assert(g2._drive.length === 1 && rb.folderUrl.indexOf('FLD1') !== -1, 'reutiliza carpeta existente por nombre');
})();

/* ============ 4. Capturas: upsert por id + contrato GET ============ */
console.log('\n[G4] capturas planas y GET (capturas + asesores)');
(function () {
  var g = freshEnv();
  var cap = {id:'CAP-1', timestamp:'2026-07-02T08:00:00Z', tipo:'propiedad', asesor:'Daniel',
    estrellas:2, calidad:'Esencial', propiedad_json:JSON.stringify({id:'CAP-1', elapsed:200}),
    contacto_json:'', capturadoEn:'2026-07-02T08:00:00Z', modificadoEn:'2026-07-02T08:00:00Z'};
  assert(g.post(cap).ok === true, 'POST captura plana ok');
  cap.estrellas = 3; cap.calidad = 'Completa';
  cap.propiedad_json = JSON.stringify({id:'CAP-1', elapsed:150});
  g.post(cap);
  var caps = g._sheets['Capturas']._rows;
  assert(caps.length === 2, 'upsert por id: una sola fila tras reenvío (edición)');
  g.post({id:'CAP-2', timestamp:'2026-07-02T09:00:00Z', tipo:'propiedad', asesor:'Erica',
    estrellas:1, calidad:'Incompleta', propiedad_json:JSON.stringify({elapsed:400}), contacto_json:'',
    capturadoEn:'2026-07-02T09:00:00Z', modificadoEn:'2026-07-02T09:00:00Z'});
  g.post({id:'CT-9', timestamp:'2026-07-02T09:30:00Z', tipo:'contacto', asesor:'Erica',
    estrellas:0, calidad:'', propiedad_json:'', contacto_json:'{}',
    capturadoEn:'2026-07-02T09:30:00Z', modificadoEn:'2026-07-02T09:30:00Z'});

  var res = g.get();
  assert(res.ok === true, 'GET ok');
  assert(Array.isArray(res.capturas) && res.capturas.length === 4, 'capturas = encabezado + 3 filas');
  assert(res.capturas[0].indexOf('propiedad_json') !== -1, 'encabezado incluye propiedad_json (contrato parseGasRows)');
  var aH = res.asesores[0];
  var daniel = res.asesores.filter(function (r) { return r[aH.indexOf('asesor')] === 'Daniel'; })[0];
  var erica = res.asesores.filter(function (r) { return r[aH.indexOf('asesor')] === 'Erica'; })[0];
  assert(!!daniel && !!erica, 'asesores agregados presentes');
  assert(daniel[aH.indexOf('totalCapturas')] === 1 && daniel[aH.indexOf('totalEstrellas')] === 3, 'Daniel: 1 captura, 3 estrellas (tras edición)');
  assert(daniel[aH.indexOf('capturasCompletas')] === 1, 'Daniel: 1 completa');
  assert(daniel[aH.indexOf('mejorTiempo')] === 150, 'mejorTiempo desde propiedad_json.elapsed');
  assert(erica[aH.indexOf('totalCapturas')] === 1, 'Erica: el contacto NO cuenta en ranking de propiedades');
  assert(erica[aH.indexOf('capturasEsenciales')] === 0, 'Erica: Incompleta no cuenta como esencial');
})();

/* ============ 5. Robustez ============ */
console.log('\n[G5] robustez');
(function () {
  var g = freshEnv();
  assert(g.post({action:'ping'}).ok === true, 'ping ok');
  assert(g.post({action:'saveMarkdown', tipo:'propiedad'}).ok === false, 'saveMarkdown sin uuid → error controlado');
  assert(g.post({foo:'bar'}).ok === false, 'payload no reconocido → error controlado');
  var out = JSON.parse(g.doPost({postData:{contents:'no-es-json'}}).getContent());
  assert(out.ok === false, 'body inválido → {ok:false} sin excepción');
  // hoja vieja sin columna folderUrl → getSheet_ la agrega sin romper filas
  var g2 = freshEnv();
  g2._sheets['Markdowns'] = new MockSheet('Markdowns');
  g2._sheets['Markdowns'].appendRow(['uuid','fecha','asesor','tipo','estatus','nombre','markdown_md']);
  g2._sheets['Markdowns'].appendRow(['CAP-OLD','2026-06-01','Carlos','propiedad','completa','Casa vieja','# old']);
  var r = g2.post({action:'saveMarkdown', uuid:'CAP-OLD', tipo:'propiedad', nombre:'Casa vieja', direccion:'Calle Vieja 5', markdown_md:'# old v2'});
  assert(r.ok && r.folderUrl !== '', 'hoja legada: agrega columnas nuevas y crea carpeta');
  var hdr = g2._sheets['Markdowns']._rows[0];
  assert(hdr.indexOf('folderUrl') !== -1 && hdr.indexOf('direccion') !== -1, 'columnas folderUrl y direccion agregadas al final');
  assert(g2._sheets['Markdowns']._rows.length === 2, 'la fila legada se actualizó (no se duplicó)');
})();

/* ============ 6. Seguridad: API_KEY opcional ============ */
console.log('\n[G6] clave compartida (API_KEY)');
(function () {
  var g = freshEnv();
  g.API_KEY = 'clave-equipo-2026';
  assert(g.post({action:'ping'}).ok === false, 'con API_KEY activa, POST sin clave → rechazado');
  assert(g.post({action:'ping', k:'incorrecta'}).ok === false, 'clave incorrecta → rechazado');
  assert(g.post({action:'ping', k:'clave-equipo-2026'}).ok === true, 'clave correcta → aceptado');
  var out = JSON.parse(g.doGet({parameter:{}}).getContent());
  assert(out.ok === false, 'GET sin ?k= → rechazado');
  var out2 = JSON.parse(g.doGet({parameter:{k:'clave-equipo-2026'}}).getContent());
  assert(out2.ok === true, 'GET con ?k= correcta → aceptado');
  var r = g.post({action:'saveMarkdown', k:'clave-equipo-2026', uuid:'CAP-SEC', tipo:'propiedad', nombre:'Casa Sec', direccion:'X 1', markdown_md:'#'});
  assert(r.ok && r.folderUrl !== '', 'saveMarkdown con clave funciona igual (carpeta creada)');
  var hdr = g._sheets['Markdowns']._rows[0];
  assert(hdr.indexOf('k') === -1, 'la clave "k" NO se guarda como columna en la hoja');
  // API_KEY vacía (default) = todo abierto, retrocompatible
  var g2 = freshEnv();
  assert(g2.post({action:'ping'}).ok === true, 'API_KEY vacía → sin validación (retrocompatible)');
  assert(JSON.parse(g2.doGet({}).getContent()).ok === true, 'GET sin parámetros también pasa con API_KEY vacía');
})();

/* ============ 7. Reconciliación de pestañas (escenario real 02-jul) ============ */
console.log('\n[G7] reconciliación: histórico en "Hoja 1", "Capturas" vacía, conflict vacía');
(function () {
  function sheetNames(g) { return Object.keys(g._sheets).map(function (k) { return g._sheets[k]._name; }).sort(); }
  function byName(g, n) { var r = null; Object.keys(g._sheets).forEach(function (k) { if (g._sheets[k]._name === n) r = g._sheets[k]; }); return r; }
  var CAPH = ['id','timestamp','tipo','asesor','estrellas','calidad','propiedad_json','contacto_json','capturadoEn','modificadoEn'];

  var g = freshEnv();
  // estado real reportado por el dueño:
  var hoja1 = new MockSheet('Hoja 1');
  hoja1.appendRow(CAPH);
  [['CAP-R1','2026-06-20T10:00:00Z','propiedad','Daniel',3,'Completa',JSON.stringify({elapsed:120}),'','2026-06-20T10:00:00Z','2026-06-20T10:00:00Z'],
   ['CAP-R2','2026-06-21T10:00:00Z','propiedad','Carlos',2,'Esencial',JSON.stringify({elapsed:200}),'','2026-06-21T10:00:00Z','2026-06-21T10:00:00Z'],
   ['CAP-R3','2026-06-22T10:00:00Z','propiedad','Gabriel',1,'Incompleta',JSON.stringify({}),'','2026-06-22T10:00:00Z','2026-06-22T10:00:00Z'],
   ['CAP-R4','2026-06-23T10:00:00Z','propiedad','Erica',3,'Completa',JSON.stringify({elapsed:90}),'','2026-06-23T10:00:00Z','2026-06-23T10:00:00Z'],
   ['CAP-R5','2026-06-24T10:00:00Z','propiedad','Daniel',2,'Publicable',JSON.stringify({elapsed:250}),'','2026-06-24T10:00:00Z','2026-06-24T10:00:00Z'],
   ['CT-R6','2026-06-25T10:00:00Z','contacto','Daniel',0,'','','{}','2026-06-25T10:00:00Z','2026-06-25T10:00:00Z']
  ].forEach(function (r) { hoja1.appendRow(r); });
  g._sheets['Hoja 1'] = hoja1;
  var capVacia = new MockSheet('Capturas'); capVacia.appendRow(CAPH);
  g._sheets['Capturas'] = capVacia;
  var conflict = new MockSheet('Capturas_conflict1200737492'); conflict.appendRow(CAPH);
  g._sheets['Capturas_conflict1200737492'] = conflict;
  var asesores = new MockSheet('Asesores');
  asesores.appendRow(['asesor','totalCapturas']); asesores.appendRow(['Daniel', 99]); // desincronizada
  g._sheets['Asesores'] = asesores;

  var res = g.get();
  assert(res.ok === true, 'GET ok tras reconciliación');
  assert(res.capturas.length === 7, 'GET devuelve el histórico REAL (encabezado + 6 filas de Hoja 1)');
  assert(byName(g, 'Capturas') === hoja1, '"Hoja 1" fue RENOMBRADA a "Capturas" (mismos datos, cero pérdida)');
  assert(byName(g, 'Hoja 1') === null, 'ya no existe pestaña "Hoja 1"');
  assert(sheetNames(g).indexOf('Capturas_conflict1200737492') === -1, 'la pestaña _conflict VACÍA fue eliminada');
  assert(byName(g, 'Asesores') === asesores && asesores._rows[1][1] === 99, 'la hoja "Asesores" NO se toca (queda como legado sin uso)');
  assert(hoja1._rows.length === 7, 'ninguna fila del histórico se perdió');

  // idempotencia
  var res2 = g.get();
  assert(res2.capturas.length === 7 && byName(g, 'Capturas') === hoja1, 'segunda llamada: estable, sin duplicar hojas');

  // una captura nueva cae en la hoja adoptada (upsert)
  g.post({id:'CAP-R7', timestamp:'2026-07-02T10:00:00Z', tipo:'propiedad', asesor:'Daniel',
    estrellas:3, calidad:'Completa', propiedad_json:JSON.stringify({elapsed:100}), contacto_json:'',
    capturadoEn:'2026-07-02T10:00:00Z', modificadoEn:'2026-07-02T10:00:00Z'});
  assert(hoja1._rows.length === 8, 'las escrituras nuevas caen en la hoja adoptada');

  // punto 3: asesores SIEMPRE derivado — borrar una captura baja el conteo solo
  var aH = res2.asesores[0];
  var daniel = res2.asesores.filter(function (r) { return r[aH.indexOf('asesor')] === 'Daniel'; })[0];
  assert(daniel[aH.indexOf('totalCapturas')] === 2, 'Daniel = 2 (derivado de capturas reales, no del 99 de la hoja Asesores)');
  hoja1._rows = hoja1._rows.filter(function (r) { return r[0] !== 'CAP-R5'; }); // "borrado manual" de una fila
  var res3 = g.get();
  var aH3 = res3.asesores[0];
  var daniel3 = res3.asesores.filter(function (r) { return r[aH3.indexOf('asesor')] === 'Daniel'; })[0];
  assert(daniel3[aH3.indexOf('totalCapturas')] === 2, 'tras borrar CAP-R5 a mano: Daniel = 2 (CAP-R1 + CAP-R7) — el conteo baja solo');

  // seguridad extra: si la canónica tiene datos, NUNCA se adopta otra hoja
  var g2 = freshEnv();
  var capData = new MockSheet('Capturas'); capData.appendRow(CAPH);
  capData.appendRow(['CAP-A','2026-07-01T00:00:00Z','propiedad','Erica',1,'Esencial','{}','','','']);
  g2._sheets['Capturas'] = capData;
  var otra = new MockSheet('Hoja 1'); otra.appendRow(CAPH);
  otra.appendRow(['CAP-B','2026-07-01T00:00:00Z','propiedad','Carlos',1,'Esencial','{}','','','']);
  g2._sheets['Hoja 1'] = otra;
  g2.get();
  assert(byName(g2, 'Capturas') === capData && byName(g2, 'Hoja 1') === otra, 'con canónica con datos, ninguna hoja se renombra ni se borra');
})();

/* ============ 8. Borrado con PIN (v3.3) ============ */
console.log('\n[G8] deleteCapture con PIN');
(function () {
  var g = freshEnv();
  // sembrar: captura + su markdown con carpeta
  g.post({id:'CAP-DEL', timestamp:'2026-07-02T10:00:00Z', tipo:'propiedad', asesor:'Daniel',
    estrellas:2, calidad:'Esencial', propiedad_json:'{}', contacto_json:'',
    capturadoEn:'2026-07-02T10:00:00Z', modificadoEn:'2026-07-02T10:00:00Z'});
  g.post({id:'CAP-KEEP', timestamp:'2026-07-02T11:00:00Z', tipo:'propiedad', asesor:'Erica',
    estrellas:3, calidad:'Completa', propiedad_json:'{}', contacto_json:'',
    capturadoEn:'2026-07-02T11:00:00Z', modificadoEn:'2026-07-02T11:00:00Z'});
  g.post({action:'saveMarkdown', uuid:'CAP-DEL', tipo:'propiedad', nombre:'Casa Borrable', direccion:'Calle 9', markdown_md:'#'});

  var bad = g.post({action:'deleteCapture', uuid:'CAP-DEL', pin:'0000'});
  assert(bad.ok === false && /PIN/.test(bad.error), 'PIN incorrecto → rechazado con error claro');
  assert(g._sheets['Capturas']._rows.length === 3, 'PIN incorrecto: NO se borró nada de Capturas');
  assert(g.post({action:'deleteCapture', pin:'1512'}).ok === false, 'sin uuid → error controlado');

  var okDel = g.post({action:'deleteCapture', uuid:'CAP-DEL', pin:'1512'});
  assert(okDel.ok === true, 'PIN correcto → ok');
  assert(okDel.deleted.capturas === true && okDel.deleted.markdowns === true, 'reporta borrado en Capturas y Markdowns');
  var ids = g._sheets['Capturas']._rows.slice(1).map(function (r) { return r[0]; });
  assert(ids.length === 1 && ids[0] === 'CAP-KEEP', 'solo se borró la fila pedida; CAP-KEEP intacta');
  assert(g._sheets['Markdowns']._rows.length === 1, 'fila de Markdowns eliminada (solo queda encabezado)');
  assert(g._drive.length === 1, 'la carpeta Drive NO se toca (fotos a salvo)');

  var again = g.post({action:'deleteCapture', uuid:'CAP-DEL', pin:'1512'});
  assert(again.ok === true && again.deleted.capturas === false, 'borrar dos veces: idempotente (segunda vez no encuentra fila)');
})();

/* ============ 9. Diagnóstico solo lectura (v3.3) ============ */
console.log('\n[G9] diag');
(function () {
  var g = freshEnv();
  g.post({id:'CAP-OK', timestamp:'2026-07-02T10:00:00Z', tipo:'propiedad', asesor:'Daniel',
    estrellas:2, calidad:'Esencial', propiedad_json:'{}', contacto_json:'',
    capturadoEn:'2026-07-02T10:00:00Z', modificadoEn:'2026-07-02T10:00:00Z'});
  // fila corrupta simulada (json roto + id raro), como la vería un corrimiento
  g._sheets['Capturas'].appendRow(['sin-prefijo','2026-07-02','propiedad','X','1','','{roto','','','']);
  var d = g.post({action:'diag'});
  assert(d.ok === true, 'diag ok');
  var cap = d.sheets.filter(function (s) { return s.name === 'Capturas'; })[0];
  assert(!!cap && cap.ordenCanonico === true, 'reporta orden canónico de Capturas');
  assert(cap.filas === 2, 'conteo de filas correcto');
  assert(cap.anomalias.length === 2 && /id raro/.test(cap.anomalias[0]) && /no parsea/.test(cap.anomalias[1]),
    'detecta id raro y JSON roto con número de fila');
  var antes = JSON.stringify(g._sheets['Capturas']._rows);
  g.post({action:'diag'});
  assert(JSON.stringify(g._sheets['Capturas']._rows) === antes, 'diag es solo lectura (no modifica nada)');
})();

/* ============ 10. migrateMarkdowns: unificación de bloques paralelos (v3.4) ============ */
console.log('\n[G10] migrateMarkdowns — escenario real (bloques A-H legado + I-R canónico)');
(function () {
  var g = freshEnv();
  // reproducir el Sheet real reportado por el dueño: DOS bloques paralelos
  var md = new MockSheet('Markdowns');
  var LEG = ['UUID','Asesor','Fecha','Tipo','Estatus','Nombre','Markdown','Última actualización'];
  var CAN = ['uuid','fecha','asesor','tipo','estatus','nombre','direccion','markdown_md','folderUrl','modificadoEn'];
  md.appendRow(LEG.concat(CAN));
  var v = function (leg, can) { return leg.concat(can); };
  var vac = ['','','','','','','','','',''];
  // filas 2-6: solo bloque legado
  md.appendRow(v(['CAP-H1','Daniel','2026-06-26','propiedad','sin terminar','Jacarandas','# md h1','2026-06-26'], vac));
  md.appendRow(v(['CAP-H2','Daniel','2026-06-26','propiedad','sin terminar','Casa','# md h2','2026-06-26'], vac));
  md.appendRow(v(['CAP-H3','Carlos','2026-06-30','propiedad','completa','Casa 87','# md h3 viejo','2026-06-30'], vac));
  md.appendRow(v(['CAP-H4','Gabriel','2026-06-30','propiedad','sin terminar','Kloster','# md h4','2026-06-30'], vac));
  md.appendRow(v(['CAP-H5','Erica','2026-06-30','propiedad','sin terminar','Tlaltenango','# md h5 de Erica','2026-06-30'], vac));
  // filas 7-8: solo bloque canónico (re-subidas por el flujo Drive)
  md.appendRow(v(['','','','','','','',''], ['CAP-H3','2026-06-30','Carlos','propiedad','completa','Casa 87','Dir 87','# md h3 nuevo','https://drive/f87','2026-07-02']));
  md.appendRow(v(['','','','','','','',''], ['CAP-H5','2026-07-02','Daniel','propiedad','sin terminar','Tlaltenango','Av. Zapata','# md h5 editado','https://drive/ftl','2026-07-02']));
  g._sheets['Markdowns'] = md;
  // Capturas con el asesor pisado (como pasó en producción) + hoja Asesores legada
  var cap = new MockSheet('Capturas');
  cap.appendRow(['id','timestamp','tipo','asesor','estrellas','calidad','propiedad_json','contacto_json','capturadoEn','modificadoEn']);
  cap.appendRow(['CAP-H5','2026-06-30','propiedad','Daniel',1,'Incompleta',JSON.stringify({id:'CAP-H5',asesorNombre:'Daniel'}),'','2026-06-30','2026-07-02']);
  g._sheets['Capturas'] = cap;
  var ase = new MockSheet('Asesores');
  ase.appendRow(['asesor','totalCapturas']); ase.appendRow(['Daniel', 99]);
  g._sheets['Asesores'] = ase;

  assert(g.post({action:'migrateMarkdowns', pin:'0000'}).ok === false, 'PIN incorrecto → no migra');
  var r = g.post({action:'migrateMarkdowns', pin:'1512'});
  assert(r.ok === true, 'migración ok');
  assert(!!r.backup, 'se creó backup antes de tocar nada: ' + r.backup);
  var bk = null;
  Object.keys(g._sheets).forEach(function (k) { if (g._sheets[k]._name === r.backup) bk = g._sheets[k]; });
  assert(!!bk && bk._rows.length === 8 && bk._rows[0].length === 18, 'el backup conserva TODAS las filas y columnas originales');

  var hdr = md._rows[0].map(String);
  assert(hdr.length === 12 && hdr[0] === 'uuid' && hdr[10] === 'editadoPor' && hdr[11] === 'fotoUrl', 'un solo bloque canónico (12 columnas, con editadoPor y fotoUrl v3.6)');
  // headers únicos sin duplicados por capitalización (pedido explícito del dueño)
  var norm = {}; var unicos = true;
  hdr.forEach(function (h) { var k = h.toLowerCase(); if (norm[k]) unicos = false; norm[k] = 1; });
  assert(unicos, 'headers únicos: sin duplicados con distinta capitalización');

  var rows = md._rows.slice(1).map(function (row) {
    var o = {}; hdr.forEach(function (h, i) { o[h] = row[i]; }); return o;
  });
  assert(rows.length === 5, '5 filas únicas (5 históricas; Casa 87 y Tlaltenango fusionadas con sus re-subidas)');
  assert(rows.every(function (o) { return String(o.uuid).indexOf('CAP-') === 0; }), 'todas las filas tienen uuid en la columna canónica');
  var h3 = rows.filter(function (o) { return o.uuid === 'CAP-H3'; })[0];
  assert(h3.markdown_md === '# md h3 nuevo' && h3.folderUrl === 'https://drive/f87', 'en duplicados gana la fila nueva (markdown + folderUrl)');
  assert(h3.asesor === 'Carlos', 'asesor coincidente se mantiene sin conflicto');
  var h5 = rows.filter(function (o) { return o.uuid === 'CAP-H5'; })[0];
  assert(h5.asesor === 'Erica', 'CONFLICTO: el asesor ORIGINAL (Erica) se conserva sobre el editor');
  assert(h5.editadoPor === 'Daniel', 'el editor queda registrado en editadoPor');
  assert(h5.markdown_md === '# md h5 editado', 'el contenido editado (más nuevo) sí gana');
  var h1 = rows.filter(function (o) { return o.uuid === 'CAP-H1'; })[0];
  assert(h1.markdown_md === '# md h1' && h1.asesor === 'Daniel', 'filas solo-legado migradas campo por campo');

  // propagación del conflicto a Capturas
  var capRow = cap._rows[1];
  assert(capRow[3] === 'Erica', 'Capturas: columna asesor restaurada a Erica');
  var pj = JSON.parse(capRow[6]);
  assert(pj.asesorNombre === 'Erica' && pj.editadoPor === 'Daniel', 'Capturas: propiedad_json.asesorNombre restaurado + editadoPor');

  // Asesores deprecada
  var aseNow = null;
  Object.keys(g._sheets).forEach(function (k) { if (g._sheets[k]._name === 'Asesores_DEPRECATED') aseNow = g._sheets[k]; });
  assert(!!aseNow && String(aseNow._rows[0][0]).indexOf('DEPRECATED') === 0, 'hoja Asesores renombrada y marcada DEPRECATED en fila 1');

  // idempotencia: segunda corrida no cambia nada ni crea otro backup
  var antes = JSON.stringify(md._rows);
  var r2 = g.post({action:'migrateMarkdowns', pin:'1512'});
  assert(r2.ok && !r2.backup, 'segunda corrida: nada que migrar (sin backup nuevo)');
  assert(JSON.stringify(md._rows) === antes, 'idempotente: la hoja no cambia');

  // GET post-migración: shape determinista (todas las filas con las columnas del encabezado)
  var res = g.get();
  var nCols = res.capturas[0].length;
  assert(res.capturas.slice(1).every(function (row) { return row.length === nCols; }), 'GET: todas las filas con el mismo shape que el encabezado');

  // diag detecta bloques paralelos ANTES y limpio DESPUÉS
  var g2 = freshEnv();
  var md2 = new MockSheet('Markdowns');
  md2.appendRow(['UUID','Asesor','uuid','asesor']);
  md2.appendRow(['CAP-1','Daniel','','']);
  g2._sheets['Markdowns'] = md2;
  var d2 = g2.post({action:'diag'});
  var infoMd = d2.sheets.filter(function (s) { return s.name === 'Markdowns'; })[0];
  assert(!!infoMd.headersDuplicados && infoMd.headersDuplicados.length === 2, 'diag reporta headers duplicados (bloques paralelos)');
  var dPost = g.post({action:'diag'});
  var infoPost = dPost.sheets.filter(function (s) { return s.name === 'Markdowns'; })[0];
  assert(!infoPost.headersDuplicados, 'diag post-migración: sin headers duplicados');
})();

/* ============ 11. saveMarkdown no pisa al asesor original (v3.4) ============ */
console.log('\n[G11] asesor inmutable en saveMarkdown');
(function () {
  var g = freshEnv();
  g.post({action:'saveMarkdown', uuid:'CAP-AS', tipo:'propiedad', asesor:'Erica', nombre:'Casa E', direccion:'', markdown_md:'# v1'});
  // un editor distinto re-sube (app vieja cacheada que aún manda al editor como asesor)
  var r = g.post({action:'saveMarkdown', uuid:'CAP-AS', tipo:'propiedad', asesor:'Daniel', nombre:'Casa E', direccion:'', markdown_md:'# v2'});
  assert(r.ok === true, 'resave ok');
  var hdr = g._sheets['Markdowns']._rows[0];
  var row = g._sheets['Markdowns']._rows[1];
  assert(row[hdr.indexOf('asesor')] === 'Erica', 'el asesor original NO se pisa');
  assert(row[hdr.indexOf('editadoPor')] === 'Daniel', 'el editor queda en editadoPor');
  assert(row[hdr.indexOf('markdown_md')] === '# v2', 'el contenido sí se actualiza');
  // editadoPor explícito del app nuevo tiene prioridad
  g.post({action:'saveMarkdown', uuid:'CAP-AS', tipo:'propiedad', asesor:'Erica', editadoPor:'Carlos', nombre:'Casa E', direccion:'', markdown_md:'# v3'});
  var row2 = g._sheets['Markdowns']._rows[1];
  assert(row2[hdr.indexOf('asesor')] === 'Erica' && row2[hdr.indexOf('editadoPor')] === 'Carlos', 'editadoPor explícito se respeta');
})();

/* ============ 12. Foto del catálogo (v3.6 — Fase -1 v0.7.1) ============ */
console.log('\n[G12] fotoUrl: persistencia, PDF fallback, refreshFotos y GET');
(function () {
  var g = freshEnv();
  // 1) captura nueva: carpeta recién creada VACÍA → fotoUrl '' (el caso real)
  var r1 = g.post({action:'saveMarkdown', uuid:'CAP-F1', tipo:'propiedad',
    asesor:'Daniel', nombre:'Casa Foto', direccion:'', markdown_md:'#'});
  assert(r1.ok && r1.fotoUrl === '', 'carpeta vacía al capturar → fotoUrl vacía (no inventa)');
  var hdr = g._sheets['Markdowns']._rows[0];
  assert(hdr.indexOf('fotoUrl') !== -1, 'hoja Markdowns tiene columna fotoUrl');
  // 2) el asesor sube fotos DESPUÉS (el flujo real del negocio)
  g._drive[0].api._addFile('escaneo.pdf', 'application/pdf', 'PDF1');
  g._drive[0].api._addFile('fachada.jpg', 'image/jpeg', 'IMG1');
  // 3) refreshFotos las descubre sin re-guardar la captura
  var rf = g.post({action:'refreshFotos'});
  assert(rf.ok && rf.actualizadas === 1, 'refreshFotos actualizó 1 miniatura');
  assert(rf.fotos['CAP-F1'] === 'https://drive.google.com/thumbnail?id=IMG1&sz=w640',
    'imagen image/* gana sobre el PDF aunque el PDF esté primero');
  var row = g._sheets['Markdowns']._rows[1];
  assert(row[hdr.indexOf('fotoUrl')] === rf.fotos['CAP-F1'], 'fotoUrl PERSISTIDA en el Sheet');
  // 4) GET devuelve el mapa fotos desde el Sheet (para el catálogo multi-dispositivo)
  var got = g.get();
  assert(got.fotos && got.fotos['CAP-F1'] === rf.fotos['CAP-F1'], 'GET incluye fotos:{uuid:fotoUrl}');
  // 5) re-guardar (editar) conserva la miniatura y no la pierde
  var r2 = g.post({action:'saveMarkdown', uuid:'CAP-F1', tipo:'propiedad',
    asesor:'Daniel', nombre:'Casa Foto', direccion:'', markdown_md:'# v2'});
  assert(r2.fotoUrl === rf.fotos['CAP-F1'], 'reedición devuelve la fotoUrl vigente');
  // 6) PDF-only: los escaneos de fotos (application/pdf) sí dan miniatura
  var r3 = g.post({action:'saveMarkdown', uuid:'CAP-F2', tipo:'propiedad',
    asesor:'Erica', nombre:'Casa Escaneada', direccion:'', markdown_md:'#'});
  g._drive[1].api._addFile('Archivo_escaneado_20260705-1351.pdf', 'application/pdf', 'PDF9');
  var rf2 = g.post({action:'refreshFotos'});
  assert(rf2.fotos['CAP-F2'] === 'https://drive.google.com/thumbnail?id=PDF9&sz=w640',
    'carpeta solo-PDF → miniatura del PDF (caso Casa Paridad real)');
  // 7) idempotencia: segundo refresh sin cambios no escribe nada
  var rf3 = g.post({action:'refreshFotos'});
  assert(rf3.actualizadas === 0, 'refresh sin cambios: 0 escrituras');
  // 8) archivos no-imagen/no-pdf se ignoran
  var r4 = g.post({action:'saveMarkdown', uuid:'CAP-F3', tipo:'propiedad',
    asesor:'Carlos', nombre:'Casa Docs', direccion:'', markdown_md:'#'});
  g._drive[2].api._addFile('notas.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOC1');
  var rf4 = g.post({action:'refreshFotos'});
  assert(!rf4.fotos['CAP-F3'], 'docx no cuenta como foto');
})();

/* ============ 13. uploadFoto (v3.7 — Bloque M: subir fotos desde la app) ============ */
console.log('\n[G13] uploadFoto guarda en la carpeta de la propiedad y devuelve miniatura');
(function () {
  var g = freshEnv();
  assert(g.post({action:'ping'}).msg === 'Hauser GAS v3.7.1 online', 'ping responde v3.7.1');
  g.post({action:'saveMarkdown', uuid:'CAP-UP1', tipo:'propiedad',
    asesor:'Daniel', nombre:'Casa Subida', direccion:'', markdown_md:'#'});
  assert(g._drive.length === 1, 'saveMarkdown creó la carpeta');
  var up = g.post({action:'uploadFoto', uuid:'CAP-UP1', dataBase64:'AAECAwQF',
    mime:'image/jpeg', nombreArchivo:'foto-1.jpg', nombre:'Casa Subida', direccion:''});
  assert(up.ok === true, 'uploadFoto responde ok');
  assert(g._drive.length === 1, 'NO se duplicó la carpeta (reutiliza la del uuid)');
  assert(g._drive[0].files.length === 1 && g._drive[0].files[0].name === 'foto-1.jpg', 'el archivo se creó en la carpeta de la propiedad');
  assert(up.fotoUrl === 'https://drive.google.com/thumbnail?id=' + g._drive[0].files[0].id + '&sz=w640', 'devuelve la miniatura de la foto recién subida');
  var hdr = g._sheets['Markdowns']._rows[0];
  var rowUp = g._sheets['Markdowns']._rows.filter(function (r) { return r[hdr.indexOf('uuid')] === 'CAP-UP1'; })[0];
  assert(rowUp[hdr.indexOf('fotoUrl')] === up.fotoUrl, 'fotoUrl persistida en la fila de Markdowns');
  g.post({action:'uploadFoto', uuid:'CAP-UP1', dataBase64:'BgcICQ==', mime:'image/png', nombreArchivo:'foto-2.png'});
  assert(g._drive.length === 1 && g._drive[0].files.length === 2, 'segunda foto → misma carpeta, 2 archivos');
  var up3 = g.post({action:'uploadFoto', uuid:'CAP-UP2', dataBase64:'AAEC', mime:'image/jpeg',
    nombre:'Casa Sin Captura', direccion:'Calle 1'});
  assert(up3.ok === true && g._drive.length === 2, 'uploadFoto standalone crea la carpeta de la propiedad');
  assert(up3.fotoUrl.indexOf('thumbnail?id=') > -1, 'standalone también devuelve miniatura');
  assert(g.post({action:'uploadFoto', dataBase64:'AA'}).ok === false, 'uploadFoto sin uuid → error');
  assert(g.post({action:'uploadFoto', uuid:'X'}).ok === false, 'uploadFoto sin datos → error');
})();

/* ============ 14. refreshFotos limpia fotoUrl al vaciarse la carpeta (Bloque N) ============ */
console.log('\n[G14] refreshFotos LIMPIA fotoUrl cuando la carpeta queda sin fotos');
(function () {
  var g = freshEnv();
  g.post({action:'saveMarkdown', uuid:'CAP-N1', tipo:'propiedad', asesor:'Daniel', nombre:'Casa N', direccion:'', markdown_md:'#'});
  g._drive[0].api._addFile('foto.jpg', 'image/jpeg', 'IMGN');
  var rf = g.post({action:'refreshFotos'});
  assert(rf.fotos['CAP-N1'] === 'https://drive.google.com/thumbnail?id=IMGN&sz=w640', 'primero: la foto aparece en el mapa');
  var hdr = g._sheets['Markdowns']._rows[0];
  function rowN() { return g._sheets['Markdowns']._rows.filter(function (r) { return r[hdr.indexOf('uuid')] === 'CAP-N1'; })[0]; }
  assert(rowN()[hdr.indexOf('fotoUrl')] === rf.fotos['CAP-N1'], 'fotoUrl persistida');
  // el dueño borra la foto directamente en Drive
  g._drive[0].files.length = 0;
  var rf2 = g.post({action:'refreshFotos'});
  assert(!rf2.fotos['CAP-N1'], 'tras borrar la foto, el GET ya no la trae (fotos sin ese uuid)');
  assert(rowN()[hdr.indexOf('fotoUrl')] === '', 'fotoUrl quedó VACÍO en el Sheet (no URL muerta)');
  assert(rf2.actualizadas === 1, 'la limpieza cuenta como actualización');
  // el GET expone fotos:{} para ese uuid
  var got = g.get();
  assert(!got.fotos['CAP-N1'], 'GET.fotos ya no incluye el uuid sin foto');
  // idempotente: segundo refresh no reescribe
  assert(g.post({action:'refreshFotos'}).actualizadas === 0, 'refresh sin cambios: 0 escrituras');
})();

/* ============ 15. getFoto: foto de portada como base64 (Bloque O) ============ */
console.log('\n[G15] getFoto devuelve la portada como data URL base64');
(function () {
  var g = freshEnv();
  assert(g.post({action:'ping'}).msg === 'Hauser GAS v3.7.1 online', 'ping responde v3.7.1');
  g.post({action:'saveMarkdown', uuid:'CAP-O1', tipo:'propiedad', asesor:'Daniel', nombre:'Casa O', direccion:'', markdown_md:'#'});
  // sin fotos aún
  assert(g.post({action:'getFoto', uuid:'CAP-O1'}).dataUrl === '', 'carpeta vacía → dataUrl vacío');
  g._drive[0].api._addFile('portada.jpg', 'image/jpeg', 'IMGO');
  var r = g.post({action:'getFoto', uuid:'CAP-O1'});
  assert(r.ok === true, 'getFoto responde ok');
  assert(/^data:image\/png;base64,B64\(/.test(r.dataUrl), 'devuelve un data URL base64 (miniatura del archivo)');
  // uuid inexistente → sin foto, sin romper
  assert(g.post({action:'getFoto', uuid:'NOPE'}).dataUrl === '', 'uuid sin carpeta → dataUrl vacío');
  assert(g.post({action:'getFoto'}).ok === false, 'getFoto sin uuid → error');
})();

/* ============ resumen ============ */
console.log('\n========================================');
console.log('Pruebas GAS: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
process.exit(0);
