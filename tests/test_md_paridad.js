/*
 * test_md_paridad.js — El markdown del flujo RÁPIDO debe ser IDÉNTICO al del
 * flujo TRADICIONAL para la misma data (solo difieren uuid/fechas del META).
 * Uso:  node tests/test_md_paridad.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;
var VirtualConsole = require('jsdom').VirtualConsole;

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<script src="app.js"></script>', '');
var appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
var passed = 0, failed = 0, failures = [];
function assert(c, n) { if (c) { passed++; console.log('  ✅ ' + n); } else { failed++; failures.push(n); console.error('  ❌ ' + n); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function boot() {
  var vc = new VirtualConsole(); vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, { url: 'https://hauser.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: '' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  w.alert = function () {}; w.confirm = function () { return true; };
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function chip(w, gid, v) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'), function (x) { return x.dataset.v === v; }).click();
}
function setVal(w, id, v) {
  var el = $(w, id); el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
/* la MISMA data en ambos flujos */
function llenar(w) {
  chip(w, 'tipoChips', 'Casa');
  chip(w, 'operChips', 'Venta');
  setVal(w, 'f_direccion', 'Av. Paridad 123, Cuernavaca');
  setVal(w, 'f_nombre', 'Casa Paridad');
  setVal(w, 'f_fecha', '2026-07-04');
  setVal(w, 'f_zona_extra', 'Zona Paridad'); $(w, 'btnZonaAdd').click();
  setVal(w, 'f_precio', '2,500,000');
  setVal(w, 'f_m2t', '200'); setVal(w, 'f_m2c', '180');
  setVal(w, 'f_rec', '3'); setVal(w, 'f_ban', '2');
  setVal(w, 'f_seguimiento', '2026-07-04');
  chip(w, 'ofreceChips', 'Propietario directo');
}
function normalizar(md) {
  return md
    .replace(/uuid: CAP-[A-Z0-9-]+/g, 'uuid: X')
    .replace(/creado: [^\s|]+/g, 'creado: X')
    .replace(/modificado: [^\s|]+/g, 'modificado: X')
    .replace(/\| UUID Captura \| Texto? \| [^|]+\|/g, '| UUID Captura | Text | X |')
    .replace(/\| Fecha captura \| [^|]+ \| [^|]+\|/g, '| Fecha captura | Date | X |');
}

(async function main() {
  console.log('\n[PAR] paridad de markdown rápido vs tradicional');
  // TRADICIONAL
  var wt = boot();
  wt.document.querySelector('.home-card.hc-property').click();
  $(wt, 'btnEmpezarCaptura').click();
  await sleep(20);
  llenar(wt);
  $(wt, 'btnGen').click();
  await sleep(40);
  var mdT = JSON.parse(wt.localStorage.getItem('cap_hist'))[0].md;

  // RÁPIDO (mismos campos: es el mismo formulario; se genera con ⚡ del nav)
  var wq = boot();
  $(wq, 'homeQuickCard').click();
  $(wq, 'btnEmpezarCaptura').click();
  await sleep(20);
  assert(wq.document.body.classList.contains('quick-mode'), 'modo rápido activo');
  llenar(wq);
  // ir al slide final y generar vía la barra rápida
  for (var i = 0; i < 60; i++) {
    if ($(wq, 'qkNext').textContent.indexOf('Generar') !== -1) break;
    var antes = wq.document.querySelectorAll('#viewCapture .qk-hide').length;
    $(wq, 'qkNext').click();
    if (wq.document.querySelectorAll('#viewCapture .qk-hide').length === antes) $(wq, 'qkSkip').click();
  }
  assert($(wq, 'qkNext').textContent.indexOf('Generar') !== -1, 'se llegó al slide Generar por la barra rápida');
  $(wq, 'qkNext').click(); // sin faltantes esenciales → genera directo
  await sleep(40);
  var histQ = JSON.parse(wq.localStorage.getItem('cap_hist') || '[]');
  assert(histQ.length === 1, 'el flujo rápido generó la captura');
  var mdQ = histQ[0].md;

  var a = normalizar(mdT), b = normalizar(mdQ);
  assert(a.length > 1000, 'markdown tradicional completo (' + mdT.length + ' chars)');
  assert(a === b, 'MARKDOWN IDÉNTICO byte a byte (salvo uuid/fechas del META)');
  if (a !== b) {
    var la = a.split('\n'), lb = b.split('\n');
    for (var j = 0; j < Math.max(la.length, lb.length); j++) {
      if (la[j] !== lb[j]) { console.error('  DIFF L' + (j + 1) + ':\n   T: ' + la[j] + '\n   Q: ' + lb[j]); break; }
    }
  }
  console.log('\n========================================');
  console.log('Paridad MD: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
