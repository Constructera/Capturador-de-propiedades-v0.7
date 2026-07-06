/*
 * test_home.js — Fase 4 (v0.7.1): home y contactos.
 * 4a: CTAs del selector de asesor en barra fija (.advisor-cta con ambos botones).
 * 4b: el botón "Elegir de mis contactos" tiene aire arriba (margin-top).
 * 4c: en iOS (sin Contact Picker) se muestra una nota clara en vez de botón muerto;
 *     en no-iOS sin soporte los botones quedan ocultos y sin nota.
 *
 * Uso:  node tests/test_home.js
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

function boot(opts) {
  opts = opts || {};
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'outside-only',
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
  // simular plataforma / soporte de Contact Picker ANTES de correr la app
  if (opts.ua) Object.defineProperty(w.navigator, 'userAgent', { value: opts.ua, configurable: true });
  if (opts.contacts) w.navigator.contacts = { select: function () { return Promise.resolve([]); } };
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }

/* ============ 4a — barra de CTAs ============ */
console.log('\n[H1] 4a: CTAs del selector de asesor en barra fija');
(function () {
  var w = boot();
  var cta = w.document.querySelector('.advisor-cta');
  assert(!!cta, 'existe la barra .advisor-cta');
  assert(!!cta && !!cta.querySelector('#btnEmpezarCaptura'), 'contiene "Empezar captura"');
  assert(!!cta && !!cta.querySelector('#btnAgregarAsesor'), 'contiene "+ Agregar asesor"');
})();

/* ============ 4b — aire sobre el botón de contactos ============ */
console.log('\n[H2] 4b: el botón "Elegir de mis contactos" tiene margen arriba');
(function () {
  var w = boot();
  var b = $(w, 'btnPickContact');
  assert(!!b, 'existe el botón del picker en CRM');
  // margin declarado en el style inline: "14px 0 8px" (arriba 14px)
  assert(/margin:\s*14px/.test(b.getAttribute('style') || ''), 'tiene margin-top de 14px (aire arriba)');
})();

/* ============ 4c — fallback iOS ============ */
console.log('\n[H3] 4c: iOS sin Contact Picker muestra nota clara');
(function () {
  var w = boot({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' });
  var n = $(w, 'pickNote'), nc = $(w, 'pickNoteCt');
  assert(n.style.display !== 'none' && /iPhone|iPad/.test(n.textContent), 'nota visible en CRM explicando la limitación de iOS');
  assert(nc.style.display !== 'none', 'nota visible también en captura de contacto');
  assert($(w, 'btnPickContact').style.display === 'none', 'el botón muerto NO se muestra en iOS');
})();

console.log('\n[H4] 4c: navegador sin soporte NO-iOS (desktop) — oculto y silencioso');
(function () {
  var w = boot({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' });
  assert($(w, 'btnPickContact').style.display === 'none', 'botón oculto sin soporte');
  assert($(w, 'pickNote').style.display === 'none', 'sin nota en desktop (degradación silenciosa)');
})();

console.log('\n[H5] 4c: con Contact Picker soportado, el botón aparece');
(function () {
  var w = boot({ ua: 'Mozilla/5.0 (Linux; Android 13) Chrome/120', contacts: true });
  assert($(w, 'btnPickContact').style.display !== 'none', 'botón visible cuando hay soporte');
  assert($(w, 'pickNote').style.display === 'none', 'sin nota cuando hay soporte');
})();

console.log('\n========================================');
console.log('Pruebas home/contactos: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
process.exit(0);
