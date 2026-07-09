/*
 * test_fotoupload.js — Bloque M (v0.7.1): subir fotos desde la app (cliente).
 *
 * El botón "📷 Subir fotos" de cada propiedad abre el input file; al elegir
 * imágenes la app las envía al GAS (action 'uploadFoto', base64 + uuid) y, al
 * responder con fotoUrl, actualiza la miniatura de la tarjeta. GAS mockeado con
 * fetch interceptado (nunca toca el endpoint real).
 *
 * Uso:  node tests/test_fotoupload.js
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

var posts = [];
function boot() {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {}); // silencia "getContext not implemented"
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: 'https://mock.test/gas' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  // una propiedad ya capturada, con carpeta Drive, sin miniatura todavía
  w.localStorage.setItem('cap_hist', JSON.stringify([{
    id: 'CAP-FOTO1', tipo: 'Casa', oper: 'Venta', zona: 'Centro', nombre: 'Casa Fotos',
    estrellas: 2, calidad: 'Publicable', md: '# md', fecha: '2026-07-08T10:00:00Z',
    driveUrl: 'https://drive.google.com/drive/folders/FLD1', fotoUrl: '',
    enviado: false, faltantes: [], formData: { _state: {} }
  }]));
  w.alert = function () {}; w.confirm = function () { return true; };
  posts = [];
  w.fetch = function (url, opts) {
    var body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    posts.push(body);
    var resp = { ok: true };
    if (body.action === 'uploadFoto') { resp.fotoUrl = 'https://drive.google.com/thumbnail?id=IMGX&sz=w640'; resp.folderUrl = 'https://drive.google.com/drive/folders/FLD1'; }
    if (body.action === 'refreshFotos') { resp.fotos = { 'CAP-FOTO1': 'https://drive.google.com/thumbnail?id=IMGX&sz=w640' }; }
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

(async function main() {

  console.log('\n[M1] el botón "Subir fotos" está en la tarjeta de la propiedad');
  var w = boot();
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  var btn = w.document.querySelector('[data-fotoup]');
  assert(!!btn, 'la tarjeta muestra el botón 📷 Subir fotos');
  assert(btn.dataset.fotoup === 'CAP-FOTO1', 'el botón apunta al uuid de la propiedad');

  console.log('\n[M2] elegir imágenes → POST uploadFoto al GAS con base64 y uuid');
  btn.click(); // fotoPick: fija uuid y abre el input
  await sleep(10);
  var inp = $(w, 'fotoUploadInput');
  // inyectar dos archivos (el input file no se puede llenar por interacción real)
  var f1 = new w.File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], 'a.jpg', { type: 'image/jpeg' });
  var f2 = new w.File([new Uint8Array([1, 2, 3, 4, 5])], 'b.jpg', { type: 'image/jpeg' });
  Object.defineProperty(inp, 'files', { configurable: true, value: [f1, f2] });
  inp.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(300); // FileReader + posts encadenados

  var ups = posts.filter(function (p) { return p.action === 'uploadFoto'; });
  assert(ups.length === 2, 'se enviaron 2 uploadFoto (una por imagen) — ' + ups.length);
  assert(ups[0].uuid === 'CAP-FOTO1', 'el POST lleva el uuid de la propiedad');
  assert(!!ups[0].dataBase64 && ups[0].dataBase64.length > 0, 'el POST lleva la imagen en base64');
  assert(/^image\//.test(ups[0].mime || ''), 'el POST declara el mime de la imagen');

  console.log('\n[M3] tras subir, se refresca la miniatura y se guarda en la tarjeta');
  assert(posts.some(function (p) { return p.action === 'refreshFotos'; }), 'se dispara refreshFotos tras subir');
  var rec = JSON.parse(w.localStorage.getItem('cap_hist'))[0];
  assert(rec.fotoUrl === 'https://drive.google.com/thumbnail?id=IMGX&sz=w640', 'la miniatura quedó guardada en la propiedad');

  console.log('\n[M4] el input file abre cámara/galería en iOS (accept=image/* + multiple)');
  assert(inp.getAttribute('accept') === 'image/*', 'input accept="image/*" (iOS ofrece cámara y galería)');
  assert(inp.hasAttribute('multiple'), 'input multiple (varias fotos de una vez)');
  assert(inp.type === 'file', 'input type=file');

  console.log('\n========================================');
  console.log('Pruebas subir fotos: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
