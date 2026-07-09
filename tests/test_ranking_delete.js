/*
 * test_ranking_delete.js — Bloque K (v0.7.1): al borrar una captura sus estrellas
 * se restan del ranking del asesor.
 *
 * updateAsesorStats solo SUMA; al borrar, las estrellas seguían contando en el
 * ranking local. Ahora tras deleteCapture se recalculan las estadísticas locales
 * a partir del historial restante. (El ranking en la nube ya se deriva de las
 * Capturas del GAS en cada GET.)
 *
 * Uso:  node tests/test_ranking_delete.js
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

function rec(id, estrellas, calidad, elapsed) {
  return {
    id: id, tipo: 'Casa', oper: 'Venta', zona: 'Centro', nombre: 'Casa ' + id,
    asesorId: 'as_daniel', asesorNombre: 'Daniel', estrellas: estrellas, calidad: calidad,
    elapsed: elapsed, fecha: '2026-07-08T10:00:00Z', enviado: false, faltantes: [],
    formData: { _state: {} }
  };
}
function boot() {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: 'https://mock.test/gas' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  // ranking local acumulado (2 capturas: una Completa 3⭐, una Publicable 2⭐)
  w.localStorage.setItem('cap_asesores', JSON.stringify([
    { id: 'as_daniel', nombre: 'Daniel', totalCapturas: 2, totalEstrellas: 5,
      capturasEsenciales: 2, capturasCompletas: 1, mejorTiempo: 120 }
  ]));
  w.localStorage.setItem('cap_hist', JSON.stringify([
    rec('CAP-A', 3, 'Completa', 120),
    rec('CAP-B', 2, 'Publicable', 0)
  ]));
  w.alert = function () {}; w.confirm = function () { return true; };
  w.fetch = function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function daniel(w) { return JSON.parse(w.localStorage.getItem('cap_asesores'))[0]; }

(async function main() {

  console.log('\n[K1] borrar una captura resta sus estrellas del ranking del asesor');
  var w = boot();
  var pre = daniel(w);
  assert(pre.totalEstrellas === 5 && pre.totalCapturas === 2, 'antes: Daniel tiene 2 capturas y 5 estrellas');

  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  // borrar CAP-B (2⭐, Publicable) con PIN
  w.document.querySelector('[data-del2="CAP-B"]').click();
  $(w, 'pinInput').value = '1512';
  $(w, 'pinOk').click();
  await sleep(40);

  var post = daniel(w);
  assert(post.totalCapturas === 1, 'después: 1 sola captura (se restó la borrada) — ' + post.totalCapturas);
  assert(post.totalEstrellas === 3, 'después: 3 estrellas (5 − 2 de la captura borrada) — ' + post.totalEstrellas);
  assert(post.capturasCompletas === 1, 'la captura Completa que quedó se conserva en el conteo');
  assert(post.capturasEsenciales === 1, 'esenciales recalculadas (solo la que quedó)');
  assert(post.mejorTiempo === 120, 'mejor tiempo recalculado desde el historial restante');

  console.log('\n[K2] borrar la última también deja el conteo en cero');
  w.document.querySelector('[data-del2="CAP-A"]').click();
  $(w, 'pinInput').value = '1512';
  $(w, 'pinOk').click();
  await sleep(40);
  var z = daniel(w);
  assert(z.totalCapturas === 0 && z.totalEstrellas === 0, 'sin capturas → 0 estrellas en el ranking');
  assert(z.capturasCompletas === 0 && (z.mejorTiempo === null || z.mejorTiempo === undefined), 'completas 0 y mejor tiempo vacío');

  console.log('\n========================================');
  console.log('Pruebas ranking/borrado: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
