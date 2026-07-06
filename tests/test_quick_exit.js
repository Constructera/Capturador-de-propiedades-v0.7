/*
 * test_quick_exit.js — 1a (v0.7.1): aislamiento del modo rápido.
 * body.quick-mode es la ÚNICA fuente de verdad visual; la barra/botones quick
 * NUNCA aparecen en la captura normal ni al editar. Cubre las 4 rutas de
 * salida (guardar, salir, editar, navegar) + estado corrupto reparado.
 *
 * Uso:  node tests/test_quick_exit.js
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
var cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

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
function limpio(w, nombreRuta) {
  assert(!w.document.body.classList.contains('quick-mode'), nombreRuta + ': body SIN quick-mode');
  assert($(w, 'qkNav').hidden === true, nombreRuta + ': qkNav con hidden=true');
  assert(!w.document.querySelector('#viewCapture .qk-hide'), nombreRuta + ': ningún slide oculto con .qk-hide');
  assert($(w, 'qkResumen').hidden === true, nombreRuta + ': resumen de faltantes oculto');
}
function entrarQuick(w) {
  $(w, 'homeQuickCard').click();
  $(w, 'btnEmpezarCaptura').click();
}
function slideActual(w) {
  return Array.prototype.filter.call(
    w.document.querySelectorAll('#viewCapture > *'),
    function (el) {
      if (el.id === 'qkNav' || el.id === 'outputArea' || el.id === 'qkTitle' || el.tagName === 'H2') return false;
      var cl = el.classList;
      if (cl.contains('view-header') || cl.contains('doc-title') || cl.contains('doc-sub') ||
          cl.contains('progress-wrap') || cl.contains('timer-widget')) return false;
      return !cl.contains('qk-hide') && el.style.display !== 'none' && !el.hidden;
    })[0];
}
function clickChipIn(w, gid, val) {
  Array.prototype.find.call(
    w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
function avanzarHasta(w, pred, max) {
  for (var i = 0; i < (max || 60); i++) {
    var cur = slideActual(w);
    if (pred(cur)) return cur;
    $(w, 'qkNext').click();
    var cur2 = slideActual(w);
    if (cur2 === cur) $(w, 'qkSkip').click();
    if (slideActual(w) === cur) return null;
  }
  return null;
}

(async function main() {

  console.log('\n[E0] la fuente de verdad es CSS: gate por body.quick-mode');
  assert(/\.qk-nav\{display:none\}/.test(cssSrc), 'CSS: .qk-nav base display:none (no puede aparecer fuera del modo)');
  assert(/body\.quick-mode \.qk-nav\{[^}]*display:flex/.test(cssSrc), 'CSS: solo body.quick-mode .qk-nav la muestra');

  console.log('\n[E1] captura NORMAL nueva: cero UI quick');
  var w = boot();
  w.document.querySelector('.home-card.hc-property').click(); // Home → Asesor
  $(w, 'btnEmpezarCaptura').click(); // Asesor → Captura (flujo normal)
  await sleep(20);
  assert($(w, 'viewCapture').classList.contains('active'), 'estamos en viewCapture (flujo normal)');
  limpio(w, 'captura normal');

  console.log('\n[E2] ruta SALIR (✕ Salir del modo rápido)');
  var w2 = boot();
  entrarQuick(w2);
  await sleep(20);
  assert(w2.document.body.classList.contains('quick-mode'), 'quick activo antes de salir');
  $(w2, 'qkExit').click();
  limpio(w2, 'salir');
  assert($(w2, 'viewCapture').classList.contains('active'), 'salir conserva el formulario completo (misma vista)');

  console.log('\n[E3] ruta NAVEGAR (menú inferior / cualquier vista)');
  var w3 = boot();
  entrarQuick(w3);
  await sleep(20);
  w3.document.querySelector('#navbar button[data-view="viewHome"]').click();
  limpio(w3, 'navegar');
  // y re-entrar a captura NORMAL después de haber usado quick
  $(w3, 'btnEmpezarCaptura').click();
  limpio(w3, 'captura normal post-quick');

  console.log('\n[E4] ruta GUARDAR (⚡ Generar Markdown al final)');
  var w4 = boot();
  entrarQuick(w4);
  await sleep(20);
  var tipoSlide = avanzarHasta(w4, function (el) { return el && el.querySelector && !!el.querySelector('#tipoChips'); });
  clickChipIn(w4, 'tipoChips', 'Casa');
  var genSlide = avanzarHasta(w4, function (el) { return el && el.classList && el.classList.contains('actions'); });
  assert(!!genSlide, 'se llega al slide final ¡Listo!');
  $(w4, 'qkNext').click(); // ⚡ Generar Markdown
  await sleep(30);
  if (!$(w4, 'qkResumen').hidden) $(w4, 'qkResSave').click(); // E1: guardar aunque falten datos
  await sleep(80);
  var hist4 = JSON.parse(w4.localStorage.getItem('cap_hist') || '[]');
  assert(hist4.length === 1, 'la captura quedó guardada en el historial');
  assert($(w4, 'viewResult').classList.contains('active'), 'tras generar navega a viewResult');
  limpio(w4, 'guardar');

  console.log('\n[E5] ruta EDITAR desde historial (el bug reportado 2 veces)');
  // mismo w4: hay una captura; entrar de nuevo en QUICK y, sin salir, editar
  w4.document.querySelector('button[data-view="viewHome"]').click();
  entrarQuick(w4);
  await sleep(20);
  assert(w4.document.body.classList.contains('quick-mode'), 'quick activo otra vez');
  w4.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(20);
  var editBtn = w4.document.querySelector('[data-edit-prop]');
  assert(!!editBtn, 'botón Editar visible en el historial');
  editBtn.click();
  await sleep(20);
  assert($(w4, 'viewCapture').classList.contains('active'), 'editar abre viewCapture');
  limpio(w4, 'editar');
  assert($(w4, 'btnGen').textContent.indexOf('Actualizar') !== -1, 'modo edición real (botón Actualizar captura)');

  console.log('\n[E6] estado corrupto se auto-repara (qkStop idempotente)');
  var w6 = boot();
  // corrupción simulada: clase y atributo desincronizados sin qkOn
  w6.document.body.classList.add('quick-mode');
  $(w6, 'qkNav').hidden = false;
  w6.document.querySelector('button[data-view="viewHome"]').click(); // cualquier navegación
  limpio(w6, 'reparación');

  console.log('\n========================================');
  console.log('Pruebas salida quick: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
