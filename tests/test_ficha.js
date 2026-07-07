/*
 * test_ficha.js — 6b (v0.7.1): ficha técnica como imagen compartible.
 * jsdom no pinta canvas; se stubea getContext/toBlob y navigator.share/canShare
 * para verificar el WIRING: botón en la tarjeta, generación del PNG, share
 * nativo con archivo cuando existe, y fallback a descarga cuando no.
 *
 * Uso:  node tests/test_ficha.js
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

/* stub de canvas 2d: registra las llamadas de dibujo para comprobar contenido */
function stubCanvas(w, draws) {
  var proto = w.HTMLCanvasElement.prototype;
  proto.getContext = function () {
    return {
      fillRect: function () {}, drawImage: function () {}, fillText: function (t) { draws.push(String(t)); },
      measureText: function (t) { return { width: String(t).length * 20 }; },
      createLinearGradient: function () { return { addColorStop: function () {} }; },
      set font(v) {}, get font() { return ''; }, set fillStyle(v) {}, get fillStyle() { return ''; },
      set textAlign(v) {}, set textBaseline(v) {}
    };
  };
  proto.toBlob = function (cb) { cb({ _png: true, size: 1234, type: 'image/png' }); };
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
  w._draws = [];
  stubCanvas(w, w._draws);
  w._shared = null;
  w._File = function (parts, name, o) { this.name = name; this.type = o && o.type; };
  Object.defineProperty(w, 'File', { value: w._File, configurable: true });
  if (opts.share) {
    w.navigator.canShare = function (d) { return !!(d && d.files); };
    w.navigator.share = function (d) { w._shared = d; return Promise.resolve(); };
  }
  w._downloadClicks = 0;
  var realCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) {
    var el = realCreate(tag);
    if (String(tag).toLowerCase() === 'a') {
      var origClick = el.click.bind(el);
      el.click = function () { if (el.download) w._downloadClicks++; };
    }
    return el;
  };
  w.URL.createObjectURL = function () { return 'blob:x'; };
  w.URL.revokeObjectURL = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
function crearCaptura(w) {
  clickChip(w, 'tipoChips', 'Casa');
  $(w, 'f_nombre').value = 'Casa Ficha Bonita';
  $(w, 'f_direccion').value = 'Calle Luna 10';
  $(w, 'f_precio').value = '4200000';
  $(w, 'f_rec').value = '3';
  $(w, 'f_ban').value = '2';
  $(w, 'btnGen').click();
}

(async function main() {

  console.log('\n[F1] botón "Compartir ficha" en la tarjeta de propiedad');
  var w = boot();
  crearCaptura(w);
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(20);
  var btn = w.document.querySelector('[data-ficha]');
  assert(!!btn, 'la tarjeta tiene botón data-ficha');
  assert(/ficha/i.test(btn.textContent), 'el botón dice "Compartir ficha"');

  console.log('\n[F2] con Web Share: comparte un archivo PNG (no descarga)');
  var w2 = boot({ share: true });
  crearCaptura(w2);
  w2.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(20);
  w2.document.querySelector('[data-ficha]').click();
  await sleep(60);
  assert(w2._shared && w2._shared.files && w2._shared.files.length === 1, 'navigator.share recibió 1 archivo');
  assert(w2._shared.files[0].type === 'image/png' && /\.png$/.test(w2._shared.files[0].name), 'el archivo es PNG con nombre .png');
  assert(w2._shared.files[0].name.indexOf('Casa Ficha Bonita') !== -1, 'el nombre del archivo usa el nombre de la propiedad');
  assert(w2._downloadClicks === 0, 'con share nativo NO se dispara descarga');
  assert(w2._draws.some(function (t) { return t.indexOf('$4,200,000') !== -1; }), 'la ficha dibuja el precio');
  assert(w2._draws.some(function (t) { return t.indexOf('Casa Ficha Bonita') !== -1; }), 'la ficha dibuja el nombre');
  assert(w2._draws.some(function (t) { return t.indexOf('Daniel') !== -1; }), 'la ficha dibuja el asesor');

  console.log('\n[F3] sin Web Share: cae a descarga del PNG');
  var w3 = boot({ share: false });
  crearCaptura(w3);
  w3.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(20);
  w3.document.querySelector('[data-ficha]').click();
  await sleep(60);
  assert(w3._downloadClicks === 1, 'sin share nativo se descarga el PNG (1 click de <a download>)');
  assert(!!w3.document.querySelector('.cap-toast'), 'muestra un toast de confirmación');

  console.log('\n========================================');
  console.log('Pruebas ficha: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
