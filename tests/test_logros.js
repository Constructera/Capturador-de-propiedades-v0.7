/*
 * test_logros.js — Easter eggs / logros por hitos (v0.7), jsdom.
 * Uso:  node tests/test_logros.js
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

function boot(seed) {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.prompt = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error('offline')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
/* registro sintético del historial para el asesor Daniel */
function rec(id, diasAtras, estrellas) {
  var f = new Date(Date.now() - diasAtras * 864e5).toISOString();
  return {id: id, fecha: f, capturadoEn: f, asesorNombre: 'Daniel', resp: 'Daniel',
    nombre: 'Seed ' + id, tipo: 'Casa', oper: 'Venta', zona: 'X', estrellas: estrellas || 1,
    calidad: '', md: '# seed', faltantes: [], enviado: true, formData: null};
}
function logrosDe(w) {
  var l = JSON.parse(w.localStorage.getItem('cap_logros') || '{}');
  return l['Daniel'] || [];
}

(async function main() {

  console.log('\n[L1] primera captura desbloquea 🎉');
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  $(w, 'btnGen').click();
  assert(logrosDe(w).indexOf('primera') !== -1, '"primera" guardado en cap_logros al generar');
  assert(!$(w, 'logroOverlay').classList.contains('show'), 'la celebración espera a que terminen las estrellas');
  await sleep(1800);
  assert($(w, 'logroOverlay').classList.contains('show'), 'overlay del logro visible tras la animación');
  assert($(w, 'logroTitulo').textContent === '¡Primera captura!', 'muestra el título del logro');
  $(w, 'logroCerrar').click();
  assert(!$(w, 'logroOverlay').classList.contains('show'), 'el botón cierra la celebración');

  console.log('\n[L2] 10 capturas + cola de logros múltiples');
  var seedH = [];
  for (var i = 1; i <= 9; i++) seedH.push(rec('S' + i, 30 + i, 1)); // 9 viejas, días salteados
  var w2 = boot({cap_hist: JSON.stringify(seedH)});
  clickChip(w2, 'tipoChips', 'Casa');
  $(w2, 'btnGen').click();
  var l2 = logrosDe(w2);
  assert(l2.indexOf('primera') !== -1 && l2.indexOf('cap10') !== -1, 'décima captura otorga "primera" y "cap10" juntos (migración)');
  await sleep(1800);
  assert($(w2, 'logroOverlay').classList.contains('show'), 'muestra el primero de la cola');
  var t1 = $(w2, 'logroTitulo').textContent;
  $(w2, 'logroCerrar').click();
  await sleep(500);
  var t2 = $(w2, 'logroTitulo').textContent;
  assert($(w2, 'logroOverlay').classList.contains('show') && t1 !== t2, 'al cerrar muestra el siguiente de la cola');

  console.log('\n[L3] racha de 3 días');
  var w3 = boot({cap_hist: JSON.stringify([rec('A1', 1, 1), rec('A2', 2, 1)])}); // ayer y antier
  clickChip(w3, 'tipoChips', 'Casa');
  $(w3, 'btnGen').click();
  assert(logrosDe(w3).indexOf('racha3') !== -1, 'capturar hoy con ayer+antier en historial → racha3');
  assert(logrosDe(w3).indexOf('racha7') === -1, 'racha7 NO se otorga con 3 días');

  console.log('\n[L4] no se repiten logros ya otorgados');
  var w4 = boot({cap_logros: JSON.stringify({Daniel: ['primera']})});
  clickChip(w4, 'tipoChips', 'Casa');
  $(w4, 'btnGen').click();
  await sleep(1800);
  assert(!$(w4, 'logroOverlay').classList.contains('show'), 'logro ya otorgado no se vuelve a celebrar');
  assert(logrosDe(w4).length === 1, 'cap_logros no duplica entradas');

  console.log('\n[L5] editar una captura no re-otorga hitos de conteo');
  var w5 = boot();
  clickChip(w5, 'tipoChips', 'Casa');
  $(w5, 'btnGen').click();
  await sleep(1800);
  $(w5, 'logroCerrar').click();
  // editar la misma captura (upsert: total sigue en 1)
  w5.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  w5.document.querySelector('[data-edit-prop]').click();
  $(w5, 'btnGen').click();
  await sleep(1800);
  assert(!$(w5, 'logroOverlay').classList.contains('show'), 'editar no dispara celebración repetida');
  var hist5 = JSON.parse(w5.localStorage.getItem('cap_hist'));
  assert(hist5.length === 1, 'el historial sigue con 1 captura tras editar');

  console.log('\n========================================');
  console.log('Pruebas logros: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
