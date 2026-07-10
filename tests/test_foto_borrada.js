/*
 * test_foto_borrada.js — Bloque N (v0.7.1): la foto borrada en Drive desaparece.
 *
 * Si el GAS (refreshFotos / GET) ya no reporta foto para un uuid, la app debe
 * LIMPIAR rec.fotoUrl (no dejar la miniatura vieja) y la tarjeta/detalle deben
 * dejar de mostrar la imagen. El botón "🔄 Actualizar foto" fuerza el refresh.
 *
 * Uso:  node tests/test_foto_borrada.js
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

var fotosResp = {}; // lo que devuelve refreshFotos
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
  w.localStorage.setItem('cap_hist', JSON.stringify([{
    id: 'CAP-BORRADA', tipo: 'Casa', oper: 'Venta', zona: 'Centro', nombre: 'Casa Con Foto',
    estrellas: 2, calidad: 'Publicable', fecha: '2026-07-09T10:00:00Z', enviado: false, faltantes: [],
    driveUrl: 'https://drive.google.com/drive/folders/FLD1',
    fotoUrl: 'https://drive.google.com/thumbnail?id=VIEJA&sz=w640',
    formData: { _state: {} }
  }]));
  w.alert = function () {}; w.confirm = function () { return true; };
  w.fetch = function (url, opts) {
    var body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    var resp = { ok: true };
    if (body.action === 'refreshFotos') resp.fotos = fotosResp;
    return Promise.resolve({ json: function () { return Promise.resolve(resp); } });
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function recFoto(w) { return JSON.parse(w.localStorage.getItem('cap_hist'))[0].fotoUrl; }

(async function main() {

  console.log('\n[N1] botón "🔄 Actualizar foto" limpia la miniatura si Drive ya no tiene fotos');
  fotosResp = {}; // la carpeta quedó vacía → refreshFotos no trae el uuid
  var w = boot();
  $(w, 'navbar').querySelector('button[data-view="viewHistory"]').click();
  await sleep(30);
  assert(w.document.querySelector('#histList .cat-hero-img') !== null, 'antes: la tarjeta muestra la foto vieja');
  // abrir detalle y forzar el refresh
  w.document.querySelector('#histList .hi-name').click();
  await sleep(20);
  var btn = w.document.querySelector('[data-reffoto="CAP-BORRADA"]');
  assert(!!btn, 'el detalle tiene el botón 🔄 Actualizar foto');
  btn.click();
  await sleep(60);
  assert(recFoto(w) === '', 'la fotoUrl vieja se LIMPIÓ en localStorage');
  assert(w.document.querySelector('#histList .cat-hero-img') === null, 'la tarjeta ya NO muestra imagen (cae al emoji)');

  console.log('\n[N2] si el refresh SÍ trae una foto nueva, la actualiza');
  fotosResp = { 'CAP-BORRADA': 'https://drive.google.com/thumbnail?id=NUEVA&sz=w640' };
  var w2 = boot();
  $(w2, 'navbar').querySelector('button[data-view="viewHistory"]').click();
  await sleep(30);
  w2.document.querySelector('#histList .hi-name').click();
  await sleep(20);
  w2.document.querySelector('[data-reffoto="CAP-BORRADA"]').click();
  await sleep(60);
  assert(recFoto(w2).indexOf('NUEVA') !== -1, 'la fotoUrl se actualizó a la nueva miniatura');

  console.log('\n========================================');
  console.log('Pruebas foto borrada: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
