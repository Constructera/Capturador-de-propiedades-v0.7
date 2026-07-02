/*
 * test_markdown.js — Pruebas jsdom del Bloque 1 (v0.7).
 * Carga index.html + app.js reales en jsdom y verifica la generación de
 * markdown con los cambios del Bloque 1. localStorage se lee DIRECTO con
 * w.localStorage.getItem().
 *
 * Uso:  node tests/test_markdown.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;
var VirtualConsole = require('jsdom').VirtualConsole;

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '');
var appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

var passed = 0, failed = 0, failures = [];
function assert(cond, name) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.error('  ❌ ' + name); }
}

/* Levanta una instancia fresca de la app en jsdom. */
function boot(seed) {
  var vc = new VirtualConsole(); // silenciar "Not implemented" de <video> etc.
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w._alerts = [];
  w.alert = function (m) { w._alerts.push(String(m)); };
  w.confirm = function () { return true; };
  w.prompt = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error('offline-test')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  // jsdom no implementa <video>: play() debe devolver Promise como en navegador
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function setVal(w, id, v) {
  var el = $(w, id); el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function clickChip(w, gid, val) {
  var c = Array.prototype.find.call(
    w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; });
  if (!c) throw new Error('chip "' + val + '" no existe en #' + gid);
  c.click();
}
function clickZona(w, nombre) {
  var c = Array.prototype.find.call(
    w.document.querySelectorAll('#zonaChips .chip'),
    function (x) { return x.dataset.v === nombre; });
  if (!c) throw new Error('zona "' + nombre + '" no está en el chip cloud');
  c.click();
}
function siBtn(w, id) { return w.document.querySelector('.si-btn[data-for="' + id + '"]'); }
function naBtn(w, id) { return w.document.querySelector('.na-btn[data-for-na="' + id + '"]'); }
function generar(w) {
  $(w, 'btnGen').click();
  var err = w._alerts.filter(function (a) { return a.indexOf('Error generando markdown') === 0; });
  if (err.length) throw new Error('generar() falló: ' + err[0]);
  return $(w, 'mdOut').textContent;
}
/* Parse determinista del bloque META (líneas "clave: valor"). */
function parseMeta(md) {
  var m = md.match(/^<!-- META\n([\s\S]*?)\n-->/);
  if (!m) return null;
  var out = {};
  m[1].split('\n').forEach(function (l) {
    var i = l.indexOf(': ');
    if (i > 0) out[l.slice(0, i)] = l.slice(i + 2);
  });
  return out;
}
/* Extrae la fila "| Campo | Tipo | Valor | Nota |" de la tabla de la sección 2. */
function rowOf(md, campo) {
  var re = new RegExp('^\\| ' + campo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\| ([^|]*) \\| ([^|]*) \\| ([^|]*) \\|$', 'm');
  var m = md.match(re);
  return m ? { tipo: m[1].trim(), valor: m[2].trim(), nota: m[3].trim() } : null;
}

/* ============ 1. Terreno con indivisos numérico ============ */
console.log('\n[1] Terreno con indivisos numérico');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Terreno');
  setVal(w, 'f_m2t', '500');
  $(w, 'btnIndiv').click();
  setVal(w, 'f_m2t_indiv', '120');
  var md = generar(w);
  var rM2t = rowOf(md, 'm² terreno');
  var rInd = rowOf(md, 'm² terreno indivisos');
  var rTiene = rowOf(md, 'Tiene indivisos');
  assert(rM2t && rM2t.valor === '500' && rM2t.nota.indexOf('privados') !== -1, 'm² terreno = 500 (privados)');
  assert(rInd && rInd.valor === '120' && rInd.tipo === 'Number', 'm² terreno indivisos = 120 (Number)');
  assert(rTiene && rTiene.valor === 'Sí' && rTiene.tipo === 'Select', 'Tiene indivisos = Sí (Select)');
})();

/* ============ 2. Terreno con indivisos S/I (sí tiene, sin dato) ============ */
console.log('\n[2] Terreno con indivisos S/I');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Terreno');
  setVal(w, 'f_m2t', '300');
  $(w, 'btnIndiv').click();
  siBtn(w, 'f_m2t_indiv').click();
  var md = generar(w);
  var rInd = rowOf(md, 'm² terreno indivisos');
  var rTiene = rowOf(md, 'Tiene indivisos');
  assert(rInd && rInd.valor === '' && rInd.nota === 'S/I', 'm² indivisos vacío con nota S/I (nunca "S/I" en el valor numérico)');
  assert(rTiene && rTiene.valor === 'Sí', 'Tiene indivisos = Sí aunque no haya dato de m²');
})();

/* ============ 2b. Indivisos sin tocar → S/I · con N/A → No ============ */
console.log('\n[2b] Indivisos sin tocar / N/A');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Terreno');
  setVal(w, 'f_m2t', '300');
  var md = generar(w);
  var rT = rowOf(md, 'Tiene indivisos');
  assert(rT && rT.valor === 'S/I', 'sin tocar "+ indivisos" → Tiene indivisos = S/I');

  var w2 = boot();
  clickChip(w2, 'tipoChips', 'Terreno');
  setVal(w2, 'f_m2t', '300');
  $(w2, 'btnIndiv').click();
  naBtn(w2, 'f_m2t_indiv').click();
  var md2 = generar(w2);
  var rT2 = rowOf(md2, 'Tiene indivisos');
  var rI2 = rowOf(md2, 'm² terreno indivisos');
  assert(rT2 && rT2.valor === 'No', 'N/A en m² indivisos → Tiene indivisos = No');
  assert(rI2 && rI2.valor === '' && rI2.nota === 'N/A', 'm² indivisos vacío con nota N/A');
})();

/* ============ 3. Departamento con m² terreno N/A no marca incompleta ============ */
console.log('\n[3] Regla Departamento (m² terreno N/A o S/I)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Departamento');
  naBtn(w, 'f_m2t').click();
  var md = generar(w);
  assert(md.indexOf('Falta dato mínimo: m² terreno') === -1, 'Depto + m² terreno N/A → sin "Falta dato mínimo: m² terreno"');
  var hist = JSON.parse(w.localStorage.getItem('cap_hist'));
  var faltantes = hist[0].faltantes.join(' | ');
  assert(faltantes.indexOf('m² terreno (') === -1, 'Depto + N/A → "m² terreno" fuera de faltantes del historial');

  var w2 = boot();
  clickChip(w2, 'tipoChips', 'Departamento');
  siBtn(w2, 'f_m2t').click();
  var md2 = generar(w2);
  assert(md2.indexOf('Falta dato mínimo: m² terreno') === -1, 'Depto + m² terreno S/I → tampoco marca faltante');

  // Control: en Casa, S/I en m² terreno SÍ debe marcar faltante
  var w3 = boot();
  clickChip(w3, 'tipoChips', 'Casa');
  siBtn(w3, 'f_m2t').click();
  var md3 = generar(w3);
  assert(md3.indexOf('Falta dato mínimo: m² terreno') !== -1, 'Control: Casa + S/I sí marca "Falta dato mínimo: m² terreno"');
})();

/* ============ 4. Comisión "Otra" 1.75% sin duplicar ============ */
console.log('\n[4] Comisión "Otra" (1.75%)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  setVal(w, 'f_comision', '__otra');
  assert($(w, 'f_comision_otra').style.display !== 'none', 'al elegir "Otra" se muestra el cuadro de texto');
  setVal(w, 'f_comision_otra', '1.75%');
  var md = generar(w);
  var r = rowOf(md, 'Comisión de venta');
  assert(r && r.valor === '1.75%', 'fila "Comisión de venta" lleva exactamente el texto escrito (1.75%)');
  assert(md.indexOf('__otra') === -1, 'el valor interno "__otra" nunca aparece en el markdown');
  assert((md.match(/\| Comisión de venta \|/g) || []).length === 1, 'la fila de comisión aparece UNA sola vez (sin duplicar)');
  assert(md.indexOf('4%') === -1, 'la opción default del select (4%) no se cuela en el markdown');

  // Control: selección normal del select
  var w2 = boot();
  clickChip(w2, 'tipoChips', 'Casa');
  setVal(w2, 'f_comision', '3%');
  var md2 = generar(w2);
  var r2 = rowOf(md2, 'Comisión de venta');
  assert(r2 && r2.valor === '3%', 'control: selección normal (3%) va en la misma fila');
})();

/* ============ 5. Multi-zona: 3 zonas separadas por coma ============ */
console.log('\n[5] Multi-zona (3 zonas)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  clickZona(w, 'Lomas de Cortés');
  clickZona(w, 'Rancho Tetela');
  clickZona(w, 'Palmira');
  var md = generar(w);
  var r = rowOf(md, 'Zona');
  assert(!!r, 'existe la fila Zona');
  assert(r && r.valor === 'Lomas de Cortés, Rancho Tetela, Palmira', 'las 3 zonas listadas separadas por coma en orden de selección');
})();

/* ============ 6. Medios baños = 2 + baños completos ============ */
console.log('\n[6] Baños completos / Medios baños');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  setVal(w, 'f_ban', '2');
  setVal(w, 'f_ban_medios', '2');
  var md = generar(w);
  var rB = rowOf(md, 'Baños');
  var rM = rowOf(md, 'Medios baños');
  assert(rB && rB.valor === '2' && rB.nota.indexOf('completos') !== -1, 'Baños (completos) = 2');
  assert(rM && rM.valor === '2' && rM.tipo === 'Number', 'Medios baños = 2 (Number)');

  // En terreno ambas filas quedan N/A y no aparecen (condicionadas a !esTerreno)
  var w2 = boot();
  clickChip(w2, 'tipoChips', 'Terreno');
  var md2 = generar(w2);
  assert(rowOf(md2, 'Medios baños') === null, 'en Terreno no se emite fila Medios baños');
})();

/* ============ 7. Cuota de mantenimiento ============ */
console.log('\n[7] Cuota de mantenimiento');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  setVal(w, 'f_cuota', '1500');
  var md = generar(w);
  var r = rowOf(md, 'Cuota de mantenimiento');
  assert(r && r.valor === '1500' && r.tipo === 'Number', 'Cuota de mantenimiento = 1500 (Number)');

  var w2 = boot();
  clickChip(w2, 'tipoChips', 'Casa');
  siBtn(w2, 'f_cuota').click();
  var md2 = generar(w2);
  var r2 = rowOf(md2, 'Cuota de mantenimiento');
  assert(r2 && r2.valor === '' && r2.nota === 'S/I', 'cuota S/I → valor numérico vacío, nota S/I');
})();

/* ============ 8. Bloque META + trazabilidad en tabla ============ */
console.log('\n[8] Trazabilidad (META + campos Notion)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  var md = generar(w);
  var meta = parseMeta(md);
  assert(!!meta, 'el markdown inicia con bloque <!-- META ... -->');
  assert(meta && /^CAP-/.test(meta.uuid), 'META.uuid tiene formato CAP-…');
  assert(meta && !isNaN(Date.parse(meta.creado)), 'META.creado es ISO-8601 parseable');
  assert(meta && meta.creado === meta.modificado, 'captura nueva: creado === modificado');
  assert(meta && meta.ediciones === '0', 'captura nueva: ediciones = 0');
  var rU = rowOf(md, 'UUID Captura');
  assert(rU && rU.valor === meta.uuid, 'fila "UUID Captura" coincide con META.uuid');
  var rF = rowOf(md, 'Fecha captura');
  assert(rF && rF.valor === meta.creado, 'fila "Fecha captura" = META.creado');
  var rR = rowOf(md, 'Revisión duplicado');
  assert(rR && rR.valor === 'Sin revisar', 'fila "Revisión duplicado" = Sin revisar');
  assert(rowOf(md, 'Carpeta Drive') !== null, 'fila "Carpeta Drive" presente (pendiente Bloque 2)');
  assert(rowOf(md, 'Observaciones captura') !== null, 'fila "Observaciones captura" presente');
})();

/* ============ 9. Edición: ediciones incrementa, creado se conserva ============ */
console.log('\n[9] Flujo de edición (META.ediciones)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  setVal(w, 'f_ban', '2');
  var md1 = generar(w);
  var meta1 = parseMeta(md1);
  // abrir historial y editar la captura recién creada
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  var editBtn = w.document.querySelector('[data-edit-prop="' + meta1.uuid + '"]');
  assert(!!editBtn, 'el historial muestra botón Editar de la captura');
  editBtn.click();
  assert($(w, 'editBanner').style.display !== 'none', 'se abre en modo edición (banner visible)');
  setVal(w, 'f_ban_medios', '1');
  var md2 = generar(w);
  var meta2 = parseMeta(md2);
  assert(meta2 && meta2.uuid === meta1.uuid, 'la edición conserva el UUID');
  assert(meta2 && meta2.creado === meta1.creado, 'la edición conserva la fecha de creación');
  assert(meta2 && meta2.ediciones === '1', 'la edición incrementa ediciones a 1');
  assert(meta2 && Date.parse(meta2.modificado) >= Date.parse(meta2.creado), 'modificado ≥ creado');
  var hist = JSON.parse(w.localStorage.getItem('cap_hist'));
  var recs = hist.filter(function (r) { return r.id === meta1.uuid; });
  assert(recs.length === 1, 'el historial mantiene UN solo registro tras editar (upsert)');
  assert(recs[0].ediciones === 1, 'el registro del historial guarda ediciones = 1');
  var rObs = rowOf(md2, 'Observaciones captura');
  assert(rObs && rObs.valor.indexOf('Editada 1 vez') === 0, '"Observaciones captura" refleja la edición');
})();

/* ============ 10. Característica personalizada persiste en localStorage ============ */
console.log('\n[10] Característica personalizada (+)');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  $(w, 'f_caract_buscar').value = 'Cava de vinos';
  $(w, 'btnCaractAdd').click();
  var stored = JSON.parse(w.localStorage.getItem('cap_caractCustom') || '[]');
  assert(stored.indexOf('Cava de vinos') !== -1, 'la característica nueva se guarda en localStorage (cap_caractCustom)');
  var tags = Array.prototype.map.call(w.document.querySelectorAll('#caractTags .tag'),
    function (t) { return t.textContent.replace('✕', ''); });
  assert(tags.indexOf('Cava de vinos') !== -1, 'la característica queda como chip seleccionado');
  var md = generar(w);
  assert(md.indexOf('Cava de vinos') !== -1, 'la característica aparece en el markdown');

  // catálogo: existe de fábrica Alberca climatizada y Pádel
  var w2 = boot({ cap_caractCustom: JSON.stringify(['Cava de vinos']) });
  clickChip(w2, 'tipoChips', 'Casa');
  var chipTexts = Array.prototype.map.call(w2.document.querySelectorAll('#caractChips .chip'),
    function (c) { return c.textContent; });
  assert(chipTexts.indexOf('Alberca climatizada') !== -1, '"Alberca climatizada" está en el catálogo visible');
  $(w2, 'btnCaractMas').click();
  chipTexts = Array.prototype.map.call(w2.document.querySelectorAll('#caractChips .chip'),
    function (c) { return c.textContent; });
  assert(chipTexts.indexOf('Pádel') !== -1, '"Pádel" está en el catálogo (Ver más)');
  assert(chipTexts.indexOf('Cava de vinos') !== -1, 'una captura futura ofrece la característica personalizada persistida');
})();

/* ============ 11. Historial: tap = solo lectura, Editar = explícito ============ */
console.log('\n[11] Historial solo lectura');
(function () {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  var md1 = generar(w);
  var meta1 = parseMeta(md1);
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  var item = w.document.querySelector('.hist-item[data-rid="' + meta1.uuid + '"]');
  assert(!!item, 'la tarjeta del historial lleva data-rid');
  item.querySelector('.hi-name').click(); // tap en la tarjeta (no en un botón)
  var ov = $(w, 'histDetailOverlay');
  assert(ov.classList.contains('show'), 'tap directo abre el detalle SOLO LECTURA');
  assert($(w, 'histDetailBody').textContent.indexOf('solo lectura') !== -1, 'el detalle avisa que es solo lectura');
  assert($(w, 'histDetailBody').querySelector('input,textarea,select') === null, 'el detalle no tiene inputs editables');
  assert($(w, 'editBanner').style.display === 'none', 'tap directo NO entra a modo edición');
  // desde el detalle, Editar sí abre edición
  $(w, 'histDetailEditar').click();
  assert(!ov.classList.contains('show'), 'al pulsar Editar se cierra el detalle');
  assert($(w, 'editBanner').style.display !== 'none', 'Editar explícito abre el modo edición');
  // los botones de la tarjeta siguen funcionando sin abrir el detalle
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  var copyBtn = w.document.querySelector('[data-copy="' + meta1.uuid + '"]');
  copyBtn.click();
  assert(!ov.classList.contains('show'), 'los botones de la tarjeta no disparan el detalle');
})();

/* ============ resumen ============ */
console.log('\n========================================');
console.log('Pruebas: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
process.exit(0);
