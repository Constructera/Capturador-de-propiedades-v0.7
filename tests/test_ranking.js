/*
 * test_ranking.js — Ranking con filtros fecha/asesor y paginación (v0.7), jsdom.
 * Stub del GET del GAS con capturas sintéticas de 12 asesores en 3 rangos de
 * fecha (hoy / hace 5 días / hace 40 días).
 *
 * Uso:  node tests/test_ranking.js
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

/* capturas sintéticas: filas con encabezado, contrato del GAS */
var HDR = ['id','timestamp','tipo','asesor','estrellas','calidad','propiedad_json','contacto_json','capturadoEn','modificadoEn'];
function iso(daysAgo) { return new Date(Date.now() - daysAgo * 864e5).toISOString(); }
function makeRows() {
  var rows = [HDR];
  // 12 asesores con una captura de HOY cada uno (A01..A12), estrellas variadas
  for (var i = 1; i <= 12; i++) {
    var n = 'A' + (i < 10 ? '0' + i : i);
    rows.push(['CAP-H' + i, iso(0), 'propiedad', n, (i % 3) + 1, i % 3 === 2 ? 'Completa' : 'Esencial',
      JSON.stringify({elapsed: 100 + i}), '', iso(0), iso(0)]);
  }
  // A01 con una captura extra de hace 5 días y otra de hace 40 días
  rows.push(['CAP-5D', iso(5), 'propiedad', 'A01', 3, 'Completa', JSON.stringify({elapsed: 90}), '', iso(5), iso(5)]);
  rows.push(['CAP-40D', iso(40), 'propiedad', 'A01', 2, 'Publicable', JSON.stringify({elapsed: 80}), '', iso(40), iso(40)]);
  // un contacto (no debe contar)
  rows.push(['CT-1', iso(0), 'contacto', 'A01', 0, '', '', '{}', iso(0), iso(0)]);
  return rows;
}

function boot(gasRows) {
  var vc = new VirtualConsole();
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
  w.fetch = function (url, opts) {
    if (opts && opts.method === 'POST') return Promise.resolve({json: function () { return Promise.resolve({ok:true}); }});
    if (gasRows) return Promise.resolve({json: function () { return Promise.resolve({ok:true, capturas: gasRows}); }});
    return Promise.reject(new Error('offline'));
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function cards(w) { return w.document.querySelectorAll('#rankingList .rank-card').length; }
function chipFecha(w, v) {
  Array.prototype.find.call(w.document.querySelectorAll('#rankingFiltros .chip'),
    function (c) { return c.dataset.v === v; }).click();
}
function chipAsesor(w, a) {
  Array.prototype.find.call(w.document.querySelectorAll('#rankingAsesores .chip'),
    function (c) { return (c.dataset.a || '') === a; }).click();
}

(async function main() {

  console.log('\n[R1] modo nube: paginación de 10 + Ver más');
  var w = boot(makeRows());
  w.document.querySelector('.home-card.hc-ranking').click();
  await sleep(50);
  assert($(w, 'rankingFiltros').style.display !== 'none', 'los filtros se muestran en modo nube');
  assert(cards(w) === 10, 'se muestran 10 tarjetas (RANK_PAGE)');
  var more = w.document.querySelector('[data-rank-more]');
  assert(!!more && more.textContent.indexOf('2 restantes') !== -1, 'botón "Ver más (2 restantes)"');
  more.click();
  assert(cards(w) === 12, 'Ver más muestra las 12');
  assert(w.document.querySelector('[data-rank-more]') === null, 'el botón desaparece al agotar la lista');

  console.log('\n[R2] filtro de fecha');
  chipFecha(w, '7d');
  var modo = $(w, 'rankingModo').textContent;
  assert(modo.indexOf('13 capturas') !== -1, '7 días: 12 de hoy + 1 de hace 5 días = 13 (la de 40 días queda fuera)');
  chipFecha(w, 'hoy');
  assert($(w, 'rankingModo').textContent.indexOf('12 capturas') !== -1, 'Hoy: solo las 12 de hoy');
  chipFecha(w, 'todo');
  assert($(w, 'rankingModo').textContent.indexOf('14 capturas') !== -1, 'Todo: las 14 de propiedad (el contacto no cuenta)');

  console.log('\n[R3] filtro por asesor');
  var chipsA = w.document.querySelectorAll('#rankingAsesores .chip');
  assert(chipsA.length === 13, 'chips de asesor: Todos + 12 asesores');
  chipAsesor(w, 'A01');
  assert(cards(w) === 1, 'filtrando por A01 queda una tarjeta');
  var body = w.document.querySelector('#rankingList .rank-body');
  assert(body.textContent.indexOf('3 cap') !== -1, 'A01 acumula sus 3 capturas de propiedad');
  chipFecha(w, 'hoy');
  body = w.document.querySelector('#rankingList .rank-body');
  assert(body.textContent.indexOf('1 cap') !== -1, 'A01 + Hoy: 1 captura');
  chipAsesor(w, '');
  chipFecha(w, 'todo');
  assert(cards(w) === 10, 'quitar filtros regresa a la lista completa paginada');

  console.log('\n[R4] modo local: sin filtros, comportamiento previo');
  var wl = boot(null); // GAS caído → fallback local
  wl.document.querySelector('.home-card.hc-ranking').click();
  await sleep(50);
  assert($(wl, 'rankingFiltros').style.display === 'none', 'filtros ocultos en modo local');
  assert($(wl, 'rankingModo').textContent.indexOf('local') !== -1, 'leyenda de ranking local');

  console.log('\n========================================');
  console.log('Pruebas ranking: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
