/*
 * test_quick.js — Modo Captura Rápida (v0.7 B6), en jsdom.
 * Valida: entrada por tarjeta Home, slides sobre el MISMO formulario,
 * esenciales bloqueantes (valor o S/I explícito), Saltar con consentimiento,
 * generación del mismo markdown/historial, salida limpia del modo, y que el
 * flujo tradicional queda intacto.
 *
 * Uso:  node tests/test_quick.js
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
  w._confirms = [];
  w.alert = function () {};
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
function visibleSlides(w) {
  // hijos de viewCapture que son slides y NO están ocultos por .qk-hide
  return Array.prototype.filter.call(
    w.document.querySelectorAll('#viewCapture > *'),
    function (el) {
      if (el.id === 'qkNav' || el.id === 'outputArea' || el.id === 'qkTitle' || el.tagName === 'H2') return false;
      var cl = el.classList;
      if (cl.contains('view-header') || cl.contains('doc-title') || cl.contains('doc-sub') ||
          cl.contains('progress-wrap') || cl.contains('timer-widget')) return false;
      return !cl.contains('qk-hide') && el.style.display !== 'none' && !el.hidden;
    });
}
function slideActual(w) { return visibleSlides(w)[0]; }
function entrarQuick(w) {
  $(w, 'homeQuickCard').click(); // marca quickPending y navega a viewAdvisor
  $(w, 'btnEmpezarCaptura').click(); // flujo real: asesor → viewCapture
}
function clickChipIn(w, gid, val) {
  var c = Array.prototype.find.call(
    w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; });
  c.click();
}
function avanzarHasta(w, pred, max) {
  // avanza con Siguiente; si bloquea por esencial, usa Saltar (confirm=true)
  for (var i = 0; i < (max || 60); i++) {
    var cur = slideActual(w);
    if (pred(cur)) return cur;
    $(w, 'qkNext').click();
    var cur2 = slideActual(w);
    if (cur2 === cur) $(w, 'qkSkip').click();
    if (slideActual(w) === cur) return null; // atorado
  }
  return null;
}

(async function main() {

  /* ============ Q1. Entrada al modo rápido ============ */
  console.log('\n[Q1] entrada');
  var w = boot();
  entrarQuick(w);
  await sleep(20);
  assert(w.document.body.classList.contains('quick-mode'), 'body.quick-mode activo al entrar por la tarjeta ⚡');
  assert(!$(w, 'qkNav').hidden, 'barra de navegación visible');
  assert(visibleSlides(w).length === 1, 'exactamente UN slide visible a la vez');
  assert($(w, 'timerRunningCtrl').style.display !== 'none', 'el timer arranca solo (referencia visual)');
  assert($(w, 'qkCount').textContent.indexOf('/') !== -1, 'contador de slides visible');
  var vc = $(w, 'viewCapture');
  assert(vc.classList.contains('active'), 'seguimos sobre el MISMO viewCapture (sin duplicar formulario)');

  /* ============ Q2. Esencial duro: tipo bloquea Siguiente y Saltar ============ */
  console.log('\n[Q2] esencial duro (tipo)');
  var tipoSlide = avanzarHasta(w, function (el) { return el && el.querySelector && !!el.querySelector('#tipoChips'); });
  assert(!!tipoSlide, 'se llega al slide de tipo de inmueble');
  $(w, 'qkNext').click();
  assert(slideActual(w) === tipoSlide, 'Siguiente NO avanza sin tipo elegido');
  assert(!$(w, 'qkMsg').hidden, 'aviso visible explicando qué falta');
  $(w, 'qkSkip').click();
  assert(slideActual(w) === tipoSlide, 'Saltar tampoco brinca el tipo (esencial duro)');
  clickChipIn(w, 'tipoChips', 'Casa');
  $(w, 'qkNext').click();
  assert(slideActual(w) !== tipoSlide, 'con tipo elegido, Siguiente avanza');

  /* ============ Q3. Esencial con S/I: precio se salta solo con consentimiento ============ */
  console.log('\n[Q3] esencial saltable con S/I explícito');
  var precioSlide = avanzarHasta(w, function (el) { return el && el.querySelector && !!el.querySelector('#f_precio'); });
  assert(!!precioSlide, 'se llega al slide de precio');
  $(w, 'qkNext').click();
  assert(slideActual(w) === precioSlide, 'Siguiente no avanza con precio vacío');
  var confAntes = w._confirms.length;
  $(w, 'qkSkip').click();
  assert(w._confirms.length === confAntes + 1, 'Saltar pide consentimiento explícito (confirm)');
  assert(slideActual(w) !== precioSlide, 'tras aceptar, avanza');
  var siBtn = w.document.querySelector('.si-btn[data-for="f_precio"]');
  assert(siBtn.classList.contains('active'), 'el S/I de precio quedó MARCADO (no se saltó en silencio)');

  /* ============ Q4. Campo opcional se salta sin fricción ============ */
  console.log('\n[Q4] opcionales libres');
  var notasSlide = avanzarHasta(w, function (el) { return el && el.querySelector && !!el.querySelector('#f_notas'); });
  assert(!!notasSlide, 'se llega al slide de notas (opcional)');
  var confAntes4 = w._confirms.length;
  $(w, 'qkSkip').click();
  assert(slideActual(w) !== notasSlide && w._confirms.length === confAntes4, 'opcional: Saltar avanza sin confirmaciones');
  $(w, 'qkPrev').click();
  assert(slideActual(w) === notasSlide, '← Atrás regresa al slide anterior');
  $(w, 'qkSkip').click();

  /* ============ Q5. Generar: mismo pipeline, mismo historial ============ */
  console.log('\n[Q5] generación');
  var genSlide = avanzarHasta(w, function (el) { return el && el.querySelector && !!el.querySelector('#btnGen'); });
  assert(!!genSlide, 'el último slide es Generar');
  assert($(w, 'qkNext').textContent.indexOf('Generar') !== -1, 'el botón principal cambia a ⚡ Generar Markdown');
  $(w, 'qkNext').click();
  await sleep(60);
  var hist = JSON.parse(w.localStorage.getItem('cap_hist') || '[]');
  assert(hist.length === 1, 'la captura quedó en el MISMO historial');
  assert(hist[0].tipo === 'Casa', 'con el tipo elegido en los slides');
  assert(hist[0].md.indexOf('| Propiedad |') !== -1 || hist[0].md.length > 500, 'markdown completo generado por el pipeline tradicional');
  assert(!w.document.body.classList.contains('quick-mode'), 'al llegar al resultado, el modo rápido se apaga');
  assert($(w, 'qkNav').hidden, 'la barra rápida se oculta');
  var conHide = w.document.querySelectorAll('#viewCapture .qk-hide').length;
  assert(conHide === 0, 'el formulario completo queda restaurado (sin .qk-hide)');

  /* ============ Q6. Salir del modo restaura el formulario ============ */
  console.log('\n[Q6] salida manual');
  var w6 = boot();
  entrarQuick(w6);
  await sleep(20);
  $(w6, 'qkExit').click();
  assert(!w6.document.body.classList.contains('quick-mode'), '✕ Salir apaga el modo');
  assert(w6.document.querySelectorAll('#viewCapture .qk-hide').length === 0, 'todos los campos visibles de nuevo (formulario tradicional)');

  /* ============ Q7. El flujo tradicional NO se ve afectado ============ */
  console.log('\n[Q7] flujo tradicional intacto');
  var w7 = boot();
  w7.document.querySelector('.home-card.hc-property').click(); // flujo tradicional
  $(w7, 'btnEmpezarCaptura').click();
  await sleep(20);
  assert(!w7.document.body.classList.contains('quick-mode'), 'entrar por navbar NO activa el modo rápido');
  assert($(w7, 'qkNav').hidden, 'sin barra rápida en el flujo tradicional');
  clickChipIn(w7, 'tipoChips', 'Casa');
  $(w7, 'btnGen').click();
  await sleep(60);
  var h7 = JSON.parse(w7.localStorage.getItem('cap_hist') || '[]');
  assert(h7.length === 1, 'el flujo tradicional genera y guarda igual que siempre');

  /* ============ resumen ============ */
  console.log('\n========================================');
  console.log('Pruebas Captura Rápida: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
