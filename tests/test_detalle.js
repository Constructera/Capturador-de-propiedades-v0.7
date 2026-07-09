/*
 * test_detalle.js — Bloque D (v0.7.1): detalle de propiedad rediseñado tipo ficha.
 *
 * El detalle (tap en la tarjeta) ya NO muestra el markdown crudo: muestra portada
 * (foto si hay), precio grande, dirección con link a Maps y botones de acción
 * (subir fotos, abrir Drive, compartir ficha, copiar markdown). Sigue siendo de
 * solo lectura (sin inputs).
 *
 * Uso:  node tests/test_detalle.js
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

function boot(rec) {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: '' }));
  w.localStorage.setItem('cap_asesor_activo', JSON.stringify({ id: 'as_daniel', nombre: 'Daniel' }));
  w.localStorage.setItem('cap_hist', JSON.stringify([rec]));
  w.alert = function () {}; w.confirm = function () { return true; };
  w.fetch = function () { return Promise.reject(new Error('offline')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }

var baseRec = {
  id: 'CAP-DET', tipo: 'Casa', oper: 'Venta', zona: 'Palmira', nombre: 'Casa Detalle',
  estrellas: 3, calidad: 'Completa', fecha: '2026-07-08T10:00:00Z', enviado: false,
  faltantes: [], direccion: 'Calle Palmira 123, Cuernavaca',
  maps: 'https://maps.google.com/?q=18.9,-99.2',
  driveUrl: 'https://drive.google.com/drive/folders/FLD1',
  fotoUrl: 'https://drive.google.com/thumbnail?id=IMGX&sz=w640',
  md: '# Markdown crudo que NO debe verse en el detalle',
  formData: { _state: {}, f_rec: '3', f_ban: '2', f_m2c: '180', f_precio: '2500000', f_moneda: 'MXN' }
};

(async function main() {

  console.log('\n[D1] el detalle de propiedad es una ficha, sin markdown crudo');
  var w = boot(baseRec);
  $(w, 'navbar').querySelector('button[data-view="viewHistory"]').click();
  await sleep(30);
  // abrir detalle tapeando el nombre de la tarjeta (fuera de botones)
  w.document.querySelector('#histList .hi-name').click();
  await sleep(20);
  var body = $(w, 'histDetailBody');
  assert($(w, 'histDetailOverlay').classList.contains('show'), 'el detalle se abre');
  assert(body.querySelector('pre.hd-md') === null, 'NO hay markdown crudo (<pre>) en el detalle de propiedad');
  assert(body.textContent.indexOf('Markdown crudo que NO') === -1, 'el texto del markdown no aparece en el detalle');
  assert(body.textContent.indexOf('solo lectura') !== -1, 'sigue avisando que es solo lectura');
  assert(body.querySelector('input,textarea,select') === null, 'no hay campos editables');

  console.log('\n[D2] portada, precio y dirección con link a Maps');
  assert(body.querySelector('.hd-hero img') !== null, 'muestra la foto de portada');
  assert(body.querySelector('.hd-hero img').src.indexOf('IMGX') !== -1, 'la portada usa la fotoUrl de la propiedad');
  assert(/\$\s?2[,.]?500[,.]?000/.test(body.querySelector('.hd-price').textContent), 'precio grande visible');
  assert(body.textContent.indexOf('Calle Palmira 123') !== -1, 'muestra la dirección escrita');
  var mapsLink = body.querySelector('.hd-maps-link');
  assert(mapsLink && mapsLink.getAttribute('href') === baseRec.maps, 'link a Maps con la URL correcta');

  console.log('\n[D3] botones de acción (subir fotos, Drive, ficha, copiar)');
  assert(body.querySelector('[data-fotoup="CAP-DET"]') !== null, 'botón 📷 Subir fotos');
  assert(body.querySelector('[data-drive="CAP-DET"]') !== null, 'botón 🗂 Abrir Drive');
  assert(body.querySelector('[data-ficha="CAP-DET"]') !== null, 'botón 🖼 Compartir ficha');
  var copyBtn = body.querySelector('[data-copymd="CAP-DET"]');
  assert(copyBtn !== null, 'botón Copiar markdown');
  copyBtn.click();
  await sleep(10);
  assert(copyBtn.textContent.indexOf('Copiado') !== -1, 'al copiar, el botón confirma "Copiado ✓"');

  console.log('\n[D4] propiedad sin foto → portada con emoji (no rompe)');
  var noFoto = Object.assign({}, baseRec, { id: 'CAP-NOFOTO', fotoUrl: '', driveUrl: '' });
  var w2 = boot(noFoto);
  $(w2, 'navbar').querySelector('button[data-view="viewHistory"]').click();
  await sleep(30);
  w2.document.querySelector('#histList .hi-name').click();
  await sleep(20);
  var body2 = $(w2, 'histDetailBody');
  assert(body2.querySelector('.hd-hero-emoji') !== null, 'sin foto → hero con emoji del tipo');
  assert(body2.querySelector('[data-drive]') === null, 'sin carpeta Drive no aparece el botón Abrir Drive');

  console.log('\n========================================');
  console.log('Pruebas detalle ficha: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
