/*
 * test_maps_star.js — Bloque H (v0.7.1): el link de Maps NO es requisito.
 *
 * Si el asesor escribe la dirección A MANO, la ausencia del link de Maps no debe
 * quitar la ⭐ de "captura completa" ni marcarla incompleta. La dirección (manual
 * o por ubicación) basta; Maps es un extra.
 *
 * Se valida por la CALIDAD guardada: s3 (completa) ⇒ calidad "Completa".
 *
 * Uso:  node tests/test_maps_star.js
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
  w.fetch = function () { return Promise.reject(new Error('offline')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function setVal(w, id, v) { var el = $(w, id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); }
function clickChip(w, gid, val) { Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'), function (x) { return x.dataset.v === val; }).click(); }
function clickZona(w, nombre) { Array.prototype.find.call(w.document.querySelectorAll('#zonaChips .chip'), function (x) { return x.dataset.v === nombre; }).click(); }

/* llena una captura Casa COMPLETA; maps: true agrega link de Maps */
async function capturaCasaCompleta(w, conMaps) {
  w.document.querySelector('.home-card.hc-property').click();
  $(w, 'btnEmpezarCaptura').click();
  await sleep(20);
  clickChip(w, 'tipoChips', 'Casa');
  var z = w.document.querySelector('#zonaChips .chip');
  if (z) z.click();
  setVal(w, 'f_direccion', 'Calle Palmira 123, Cuernavaca'); // dirección MANUAL
  if (conMaps) setVal(w, 'f_maps', 'https://maps.google.com/?q=18.9,-99.2');
  setVal(w, 'f_precio', '2500000');
  setVal(w, 'f_m2t', '200');
  setVal(w, 'f_m2c', '180');
  setVal(w, 'f_rec', '3');
  setVal(w, 'f_ban', '2');
  setVal(w, 'f_est', '2');
  // oferente propietario con nombre + teléfono (esencial + extra de ⭐3)
  clickChip(w, 'ofreceChips', 'Propietario directo');
  await sleep(20);
  w.document.querySelector('#crmCards [data-edit]').click();
  await sleep(20);
  setVal(w, 'pf_nombre', 'Juan Dueño');
  setVal(w, 'pf_tel', '3310000000');
  $(w, 'personSave').click();
  await sleep(20);
  $(w, 'btnGen').click();
  await sleep(40);
  return JSON.parse(w.localStorage.getItem('cap_hist'))[0];
}

(async function main() {

  console.log('\n[H1] Casa completa con dirección MANUAL y SIN Maps → captura Completa (⭐3)');
  var w = boot();
  var rec = await capturaCasaCompleta(w, false);
  assert(rec.calidad === 'Completa', 'calidad = "Completa" sin link de Maps (dirección manual basta) — fue: ' + rec.calidad);
  assert(rec.estrellas >= 2, 'gana la ⭐ de captura completa (' + rec.estrellas + ' estrellas)');
  assert(!(rec.faltantes || []).some(function (f) { return /maps/i.test(f); }), 'la ausencia de Maps NO aparece como faltante');

  console.log('\n[H2] la misma captura CON Maps sigue siendo Completa (Maps es extra, no cambia el requisito)');
  var w2 = boot();
  var rec2 = await capturaCasaCompleta(w2, true);
  assert(rec2.calidad === 'Completa', 'con Maps también es "Completa"');

  console.log('\n========================================');
  console.log('Pruebas Maps/estrella: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
