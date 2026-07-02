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
        if (id !== '1PTKX6TZSR94Hailc3qvWBbK_zQkE6Vhn') throw new Error('Folder id inesperado: ' + id);
        return {
          getFoldersByName: function (name) {
            var found = driveFolders.filter(function (f) { return f.name === name; });
            var i = 0;
            return { hasNext: function () { return i < found.length; },
                     next: function () { return found[i++].api; } };
          },
          createFolder: function (name) {
            var f = {name: name, id: 'FLD' + (driveFolders.length + 1)};
            f.api = {
              getUrl: function () { return 'https://drive.google.com/drive/folders/' + f.id; },
              getId: function () { return f.id; },
              getName: function () { return f.name; }
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
  assert(g._drive[0].name === 'Propiedad - Av. Palmira 123, Cuernavaca', 'nombre "Propiedad - <Dirección>"');
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
  var rc = g.post({action:'saveMarkdown', uuid:'CT-1', tipo:'contacto', nombre:'Juan Pérez', markdown_md:'#'});
  assert(rc.ok === true && rc.folderUrl === '', 'contacto: ok sin carpeta (folderUrl vacía)');
  assert(g._drive.length === 1, 'contacto no creó carpeta');
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

/* ============ resumen ============ */
console.log('\n========================================');
console.log('Pruebas GAS: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
process.exit(0);
