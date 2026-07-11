/*
 * test_timer.js — Bloque A (v0.7.1): timer pausa al salir + conserva tiempo.
 * A1: al navegar fuera de la captura el timer se pausa (no corre ni suena);
 *     al volver a la misma captura (vía continuar borrador) se reanuda.
 * A2: el borrador guarda el tiempo restante y al continuar se restaura.
 *
 * Observa el DOM (clases del widget + #timerDisplay) — comportamiento real,
 * porque las variables del timer viven en el closure del IIFE.
 *
 * Uso:  node tests/test_timer.js
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

function boot() {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
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
function nav(w, view) { w.document.querySelector('#navbar button[data-view="' + view + '"]').click(); }
function goCard(w, sel) { w.document.querySelector(sel).click(); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
/* estado del timer leído del DOM (updateTimerUI: 'running' + opcional 'paused') */
function tstate(w) {
  var cl = $(w, 'timerWidget').classList;
  if (cl.contains('paused')) return 'paused';
  if (cl.contains('running')) return 'running';
  return 'ready';
}
function tsecs(w) {
  var m = String($(w, 'timerDisplay').textContent).match(/(\d+):(\d+)/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function entrarQuick(w) { goCard(w, '#homeQuickCard'); $(w, 'btnEmpezarCaptura').click(); }

(async function main() {

  console.log('\n[T1] A1: entrar por modo rápido arranca el timer');
  var w = boot();
  entrarQuick(w);
  await sleep(30);
  assert(tstate(w) === 'running', 'el timer corre dentro de la captura');

  console.log('\n[T2] A1: navegar fuera pausa el timer y NO sigue corriendo');
  nav(w, 'viewHome');
  await sleep(20);
  assert(tstate(w) === 'paused', 'al salir a Inicio el timer queda en pausa');
  var secsAtLeave = tsecs(w);
  await sleep(1300); // > 1 tick: si el intervalo siguiera vivo, el display bajaría
  assert(tsecs(w) === secsAtLeave, 'el display NO avanza fuera de la captura (intervalo detenido, sin tick/sonido)');

  console.log('\n[T3+T5] A1/A2: continuar borrador reanuda el timer desde el tiempo restante');
  var w2 = boot();
  entrarQuick(w2);
  await sleep(20);
  clickChip(w2, 'tipoChips', 'Casa');
  $(w2, 'f_nombre').value = 'Casa Timer';
  await sleep(2600); // dejar correr ~2-3 s para que baje de 05:00
  var antesSalir = tsecs(w2);
  assert(antesSalir < 300, 'el timer bajó de 300s mientras se capturaba (' + antesSalir + 's)');
  $(w2, 'qkMenu').click(); // vuelve al menú guardando borrador
  await sleep(20);
  var draft = JSON.parse(w2.localStorage.getItem('cap_draft'));
  assert(draft && draft.timer && draft.timer.remaining === antesSalir, 'el borrador guarda el tiempo restante exacto (' + (draft && draft.timer && draft.timer.remaining) + 's)');
  entrarQuick(w2);
  await sleep(20);
  assert($(w2, 'draftOverlay').classList.contains('show'), 'aparece el prompt "¿Continuar captura?"');
  $(w2, 'draftContinue').click();
  await sleep(30);
  assert(tstate(w2) === 'running', 'al continuar, el timer se reanuda (running)');
  var alContinuar = tsecs(w2);
  assert(alContinuar <= antesSalir && alContinuar >= antesSalir - 2, 'reanuda desde ~el tiempo guardado (' + alContinuar + 's), NO reinicia a 300');

  console.log('\n[T4] A2: tras generar, el timer queda DETENIDO conservando el tiempo (no reinicia)');
  var w4 = boot();
  goCard(w4, '.home-card.hc-property'); $(w4, 'btnEmpezarCaptura').click(); // captura tradicional
  await sleep(20);
  $(w4, 'btnIniciarCaptura').click(); // arranca el timer manualmente
  await sleep(20);
  assert(tstate(w4) === 'running', 'timer corriendo antes de generar');
  var antesGen = tsecs(w4);
  clickChip(w4, 'tipoChips', 'Casa');
  $(w4, 'btnGen').click(); // generar (traditional: genera sin importar completitud)
  await sleep(40);
  assert(tstate(w4) === 'paused', 'timer DETENIDO (paused) tras generar, no reiniciado a ready');
  var trasGen = tsecs(w4);
  assert(trasGen <= antesGen && trasGen >= antesGen - 3, 'conserva el tiempo restante (' + trasGen + 's), NO vuelve al límite completo');
  // A2: entrar a "completar faltantes" NO lo reanuda ni lo reinicia
  $(w4, 'resBtnCompletar').click();
  await sleep(40);
  assert(tstate(w4) === 'paused', 'sigue detenido al entrar a completar faltantes (no vuelve a correr)');
  assert(tsecs(w4) === trasGen, 'el tiempo no cambió al entrar a completar faltantes');

  console.log('\n[T6] A3: al EDITAR una propiedad el timer NO corre ni da estrella de tiempo');
  var w6 = boot();
  // captura tradicional SIN arrancar el timer (elapsed=0 → nunca ganó la ⭐ de tiempo)
  goCard(w6, '.home-card.hc-property'); $(w6, 'btnEmpezarCaptura').click();
  await sleep(20);
  clickChip(w6, 'tipoChips', 'Casa');
  $(w6, 'btnGen').click(); // genera y guarda en el historial (elapsed 0)
  await sleep(60);
  nav(w6, 'viewHistory');
  await sleep(30);
  var editBtn = w6.document.querySelector('[data-edit-prop]');
  assert(!!editBtn, 'aparece el botón "Editar" en el historial');
  editBtn.click();
  await sleep(40);
  assert($(w6, 'timerWidget').style.display === 'none', 'el widget del timer se oculta en modo edición');
  // interactuar con el formulario NO debe arrancar el timer
  $(w6, 'f_nombre').value = 'Casa Editada';
  $(w6, 'f_nombre').dispatchEvent(new w6.Event('input', { bubbles: true }));
  $(w6, 'f_direccion').dispatchEvent(new w6.Event('click', { bubbles: true }));
  await sleep(40);
  assert(tstate(w6) !== 'running', 'editar el formulario NO arranca el timer');
  // generar en edición: la ⭐ de tiempo NO se gana (elapsed original era 0)
  $(w6, 'btnGen').click();
  await sleep(700);
  assert(!$(w6, 'resStar1').classList.contains('earned'), 'no se gana la ⭐ de tiempo al editar');

  console.log('\n========================================');
  console.log('Pruebas timer: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
