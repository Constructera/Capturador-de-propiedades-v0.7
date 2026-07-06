/*
 * test_devfb.js — Herramienta DEV FEEDBACK (v0.7.1 Fase 0), en jsdom.
 * Valida: flag DEV_FEEDBACK on/off, long-press abre el cuadro con contexto
 * automático, tap corto y movimiento NO lo abren (no interfiere), guardado en
 * localStorage, export markdown estructurado y borrado.
 *
 * El hold real es de 5000 ms (DEVFB_HOLD_MS, configurable); aquí se acorta a
 * 120 ms reemplazando la constante para no esperar 5 s por assert.
 *
 * Uso:  node tests/test_devfb.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;
var VirtualConsole = require('jsdom').VirtualConsole;

var root = path.join(__dirname, '..');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '');
var appSrcReal = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

var passed = 0, failed = 0, failures = [];
function assert(cond, name) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.error('  ❌ ' + name); }
}
function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

function boot(appSrc) {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: '' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  w.alert = function () {};
  w._confirms = [];
  w.confirm = function (m) { w._confirms.push(String(m)); return true; };
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function press(w, el, x, y) {
  var e = new w.Event('pointerdown', { bubbles: true });
  e.clientX = x || 10; e.clientY = y || 10;
  el.dispatchEvent(e);
}
function release(w, el) {
  var e = new w.Event('pointerup', { bubbles: true });
  el.dispatchEvent(e);
}
function move(w, el, x, y) {
  var e = new w.Event('pointermove', { bubbles: true });
  e.clientX = x; e.clientY = y;
  el.dispatchEvent(e);
}

var HOLD = 120;
var appFast = appSrcReal.replace('var DEVFB_HOLD_MS=5000', 'var DEVFB_HOLD_MS=' + HOLD);

(async function () {
  console.log('\n[FB0] constante y flag');
  assert(/var DEV_FEEDBACK=true;/.test(appSrcReal), 'flag DEV_FEEDBACK=true presente y localizable');
  assert(/var DEVFB_HOLD_MS=5000;/.test(appSrcReal), 'hold de 5000 ms como constante configurable');
  assert(appFast !== appSrcReal, 'el test corre con hold acortado (120 ms)');

  console.log('\n[FB1] flag apagado = cero rastro');
  var wOff = boot(appSrcReal.replace('var DEV_FEEDBACK=true', 'var DEV_FEEDBACK=false'));
  assert(!wOff.document.querySelector('.devfb-fab'), 'sin fab con DEV_FEEDBACK=false');
  assert(!wOff.document.querySelector('.devfb-ov'), 'sin overlays con DEV_FEEDBACK=false');

  console.log('\n[FB2] long-press abre cuadro con contexto');
  var w = boot(appFast);
  var d = w.document;
  assert(!!d.querySelector('.devfb-fab'), 'fab 📋 presente con flag activo');
  // navegar a captura para contexto real
  $(w, 'btnEmpezarCaptura') && $(w, 'btnEmpezarCaptura').click();
  d.querySelector('button[data-view="viewCapture"]') && d.querySelector('button[data-view="viewCapture"]').click();
  var chips = $(w, 'tipoChips');
  press(w, chips.querySelector('.chip'));
  await sleep(HOLD + 80);
  var ov = d.querySelector('.devfb-ov');
  assert(ov.classList.contains('show'), 'overlay de comentario abierto tras el hold');
  var ctx = ov.querySelector('.devfb-ctx').textContent;
  assert(ctx.indexOf('#tipoChips') !== -1, 'contexto captura el id del elemento (#tipoChips)');
  assert(/view[A-Za-z]+/.test(ctx), 'contexto incluye la vista activa (' + ctx.split('·')[0].trim() + ')');

  console.log('\n[FB3] guardar comentario en localStorage');
  ov.querySelector('.devfb-txt').value = 'El chip Casa se ve muy apretado\nen pantallas chicas';
  ov.querySelector('.devfb-save').click();
  assert(!ov.classList.contains('show'), 'overlay se cierra al guardar');
  var list = JSON.parse(w.localStorage.getItem('cap_devfb'));
  assert(list.length === 1, 'un comentario guardado');
  assert(list[0].el === '#tipoChips' && !!list[0].ts && !!list[0].view, 'comentario con elemento, timestamp y vista');
  assert(list[0].comentario.indexOf('apretado') !== -1, 'texto del comentario íntegro');

  console.log('\n[FB4] tap corto y arrastre NO abren nada');
  press(w, chips); release(w, chips);
  await sleep(HOLD + 80);
  assert(!ov.classList.contains('show'), 'tap corto: no abre (no interfiere con taps)');
  press(w, chips, 10, 10); move(w, chips, 10, 60);
  await sleep(HOLD + 80);
  assert(!ov.classList.contains('show'), 'movimiento >12px (scroll): cancela el hold');

  console.log('\n[FB5] export markdown estructurado');
  d.querySelector('.devfb-fab').click();
  var ex = d.querySelectorAll('.devfb-ov')[1];
  assert(ex.classList.contains('show'), 'overlay de export abierto con el fab');
  var md = ex.querySelector('.devfb-pre').textContent;
  assert(md.indexOf('# 📋 Feedback dev') === 0, 'markdown con encabezado');
  assert(md.indexOf('- **Vista:**') !== -1 && md.indexOf('- **Elemento:** #tipoChips') !== -1 &&
         md.indexOf('- **Timestamp:**') !== -1, 'bloque por comentario con vista/elemento/timestamp');
  assert(md.indexOf('> El chip Casa se ve muy apretado') !== -1 &&
         md.indexOf('> en pantallas chicas') !== -1, 'comentario multilínea citado línea por línea');

  console.log('\n[FB6] borrar todos');
  ex.querySelector('.devfb-wipe').click();
  assert(JSON.parse(w.localStorage.getItem('cap_devfb')).length === 0, 'borrado deja lista vacía');
  assert(w._confirms.length === 1, 'borrado pide confirmación');

  console.log('\n========================================');
  console.log('Pruebas DEV FEEDBACK: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
