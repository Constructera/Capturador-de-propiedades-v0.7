/*
 * test_dup.js — Bloque G (v0.7.1): completar faltantes NO duplica la captura.
 *
 * Al terminar una captura incompleta aparece "Completar faltantes →". Al rellenar
 * y volver a generar, debe ACTUALIZARSE la MISMA captura (mismo UUID): 1 sola fila
 * en localStorage y 1 solo uuid enviado al Sheet (upsert), con el markdown regenerado.
 * Antes se creaba una COPIA (genUUID nuevo) y se duplicaba el markdown.
 *
 * Mock del GAS: fetch interceptado en jsdom (NUNCA toca el endpoint real; regla
 * v0.7.1 de CLAUDE.md). Se registran los POST para verificar uuids.
 *
 * Uso:  node tests/test_dup.js
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
function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

var posts = []; // {url, body}
function boot() {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  // endpoint MOCK (no real): el GAS se simula con fetch interceptado
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: 'https://mock.test/gas' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  w.alert = function () {}; w.confirm = function () { return true; };
  posts = [];
  w.fetch = function (url, opts) {
    var body = null;
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) { body = {}; }
    posts.push({ url: url, body: body });
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } });
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function goCard(w, sel) { w.document.querySelector(sel).click(); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
function propRecords(w) {
  var h = JSON.parse(w.localStorage.getItem('cap_hist') || '[]');
  return h.filter(function (r) { return !r._isCt && r.tipo; });
}
function mdUuids(w) {
  return posts.filter(function (p) { return p.body && p.body.action === 'saveMarkdown'; })
    .map(function (p) { return p.body.uuid; });
}

(async function main() {

  console.log('\n[G1] completar faltantes actualiza la MISMA captura (no duplica)');
  var w = boot();
  goCard(w, '.home-card.hc-property'); $(w, 'btnEmpezarCaptura').click();
  await sleep(20);
  // captura INCOMPLETA: solo tipo + nombre (faltan precio, zona, m², etc.)
  clickChip(w, 'tipoChips', 'Casa');
  $(w, 'f_nombre').value = 'Casa Duplicada';
  $(w, 'f_nombre').dispatchEvent(new w.Event('input', { bubbles: true }));
  $(w, 'btnGen').click();
  await sleep(60);
  var recs1 = propRecords(w);
  assert(recs1.length === 1, 'tras la 1ª generación hay 1 sola captura (' + recs1.length + ')');
  var uuid1 = recs1[0] && recs1[0].id;
  var md1 = recs1[0] && recs1[0].md;

  // "Completar faltantes →" vuelve al formulario para rellenar
  assert($(w, 'resBtnCompletar') != null, 'existe el botón "Completar faltantes"');
  $(w, 'resBtnCompletar').click();
  await sleep(30);
  // rellenar un dato faltante y regenerar
  $(w, 'f_precio').value = '2500000';
  $(w, 'f_precio').dispatchEvent(new w.Event('input', { bubbles: true }));
  $(w, 'btnGen').click();
  await sleep(60);

  var recs2 = propRecords(w);
  assert(recs2.length === 1, 'tras completar sigue habiendo 1 sola captura, NO 2 (' + recs2.length + ')');
  var uuid2 = recs2[0] && recs2[0].id;
  assert(uuid2 === uuid1, 'la captura conserva el MISMO UUID (' + uuid1 + ' → ' + uuid2 + ')');
  assert(recs2[0].md !== md1 && /2\s?500\s?000|2500000/.test(recs2[0].md), 'el markdown se REGENERÓ con el dato nuevo (no duplicado)');

  var uuids = mdUuids(w);
  assert(uuids.length >= 2, 'se enviaron ≥2 saveMarkdown al Sheet (' + uuids.length + ')');
  var uniq = uuids.filter(function (u, i) { return uuids.indexOf(u) === i; });
  assert(uniq.length === 1 && uniq[0] === uuid1, 'todos los saveMarkdown usan el MISMO uuid → upsert, 1 fila en el Sheet');

  console.log('\n[G2] "Empezar captura" limpia editId → una captura nueva no sobrescribe la anterior');
  // desde el resultado, iniciar OTRA captura por la vía del asesor
  $(w, 'btnEmpezarCaptura').click(); // limpia editId
  await sleep(20);
  clickChip(w, 'tipoChips', 'Terreno');
  $(w, 'f_nombre').value = 'Terreno Nuevo';
  $(w, 'f_nombre').dispatchEvent(new w.Event('input', { bubbles: true }));
  $(w, 'btnGen').click();
  await sleep(60);
  var recs3 = propRecords(w);
  assert(recs3.length === 2, 'ahora hay 2 capturas distintas (' + recs3.length + ')');
  var ids = recs3.map(function (r) { return r.id; });
  assert(ids[0] !== ids[1], 'la nueva captura tiene UUID propio (no sobrescribió a la anterior)');

  console.log('\n========================================');
  console.log('Pruebas duplicación: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
