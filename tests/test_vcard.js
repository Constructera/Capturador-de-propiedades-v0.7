/*
 * test_vcard.js — vCard de contactos (v0.7), en jsdom.
 * Sin navigator.canShare en jsdom, shareVCard cae a la ruta de descarga:
 * interceptamos URL.createObjectURL para leer el blob generado.
 *
 * Uso:  node tests/test_vcard.js
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
  w._alerts = []; w._blobs = []; w._downloads = [];
  w.alert = function (m) { w._alerts.push(String(m)); };
  w.confirm = function () { return true; };
  w.prompt = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error('offline')); };
  w.URL.createObjectURL = function (b) { w._blobs.push(b); return 'blob:hauser/' + w._blobs.length; };
  w.URL.revokeObjectURL = function () {};
  // registrar descargas: click en <a download>
  w.HTMLAnchorElement.prototype.click = function () { w._downloads.push({href: this.href, name: this.download}); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function setVal(w, id, v) {
  var el = $(w, id); el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function blobText(b) { return b.text(); } // jsdom Blob soporta .text()

(async function main() {

  console.log('\n[V1] generar contacto y exportar vCard desde el output');
  var w = boot();
  setVal(w, 'ct_nombre', 'Juan Pérez López');
  setVal(w, 'ct_tel', '7771234567');
  setVal(w, 'ct_email', 'juan@example.com');
  setVal(w, 'ct_empresa', 'Inmobiliaria JP');
  var chip = Array.prototype.find.call(
    w.document.querySelectorAll('#ctTipoChips .chip'),
    function (c) { return /Propietario/.test(c.dataset.v || ''); });
  chip.click();
  $(w, 'ctBtnGenerar').click();
  await sleep(30);
  assert(w._alerts.length === 0, 'genContact sin alertas de validación');
  $(w, 'ctBtnVcard').click();
  assert(w._downloads.length === 1, 'el botón 📇 del output dispara la descarga del .vcf');
  assert(/\.vcf$/.test(w._downloads[0].name), 'nombre de archivo termina en .vcf');
  var vcf = await blobText(w._blobs[0]);
  assert(vcf.indexOf('BEGIN:VCARD') === 0 && vcf.indexOf('END:VCARD') !== -1, 'estructura VCARD válida');
  assert(vcf.indexOf('VERSION:3.0') !== -1, 'VERSION:3.0');
  assert(vcf.indexOf('FN:Juan Pérez López') !== -1, 'FN con el nombre completo');
  assert(vcf.indexOf('TEL;TYPE=CELL:7771234567') !== -1, 'TEL con el teléfono');
  assert(vcf.indexOf('EMAIL:juan@example.com') !== -1, 'EMAIL presente');
  assert(vcf.indexOf('ORG:Inmobiliaria JP') !== -1, 'ORG con la empresa (desde formData)');
  assert(vcf.indexOf('Capturado por:') !== -1, 'NOTE con el asesor');

  console.log('\n[V2] vCard desde el historial de contactos (viewContact)');
  var hist = JSON.parse(w.localStorage.getItem('cap_ct_hist'));
  var id = hist[0].id;
  var btn = w.document.querySelector('#ctHistList [data-ct-vcard="' + id + '"]');
  assert(!!btn, 'botón 📇 vCard en el historial de contactos');
  btn.click();
  assert(w._downloads.length === 2, 'descarga el .vcf desde el historial');

  console.log('\n[V3] vCard desde el historial mixto (viewHistory)');
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  var btn2 = w.document.querySelector('#histList [data-vcard2-ct="' + id + '"]');
  assert(!!btn2, 'botón 📇 vCard en el historial mixto');
  btn2.click();
  assert(w._downloads.length === 3, 'descarga el .vcf desde el historial mixto');
  var vcf3 = await blobText(w._blobs[2]);
  assert(vcf3 === vcf, 'mismo contenido vCard desde cualquier punto de entrada');

  console.log('\n[V4] escape de caracteres especiales');
  var w2 = boot();
  setVal(w2, 'ct_nombre', 'Ana; López, "Tester"');
  setVal(w2, 'ct_tel', '5550001111');
  var chip2 = Array.prototype.find.call(
    w2.document.querySelectorAll('#ctTipoChips .chip'),
    function (c) { return /Comprador/.test(c.dataset.v || ''); });
  chip2.click();
  $(w2, 'ctBtnGenerar').click();
  await sleep(30);
  $(w2, 'ctBtnVcard').click();
  var vcf4 = await blobText(w2._blobs[0]);
  assert(vcf4.indexOf('FN:Ana\\; López\\, "Tester"') !== -1, '";" y "," escapados según RFC (vCard 3.0)');

  console.log('\n========================================');
  console.log('Pruebas vCard: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
