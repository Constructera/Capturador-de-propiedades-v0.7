/*
 * test_propietario.js — Bloque I (v0.7.1): un solo propietario por propiedad.
 *
 * Bug: al seleccionar "Propietario directo" y capturar el dueño, cada EDICIÓN
 * añadía una ficha de propietario vacía al fondo (restoreForm redisparaba
 * onOfrece → unshift de un auto-card nuevo). Editar N veces = N fichas fantasma.
 *
 * Reglas:
 *  - Editar N veces → sigue habiendo UN solo propietario (el real).
 *  - Agregar un SEGUNDO propietario manualmente pide confirmación.
 *
 * Uso:  node tests/test_propietario.js
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

var confirmReply = true, confirmCalls = 0, lastConfirmMsg = '';
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
  confirmCalls = 0; lastConfirmMsg = '';
  w.confirm = function (m) { confirmCalls++; lastConfirmMsg = m || ''; return confirmReply; };
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}
/* nº de fichas de propietario en el CRM (por el texto del rol) */
function propCards(w) {
  return Array.prototype.filter.call(w.document.querySelectorAll('#crmCards .person-card'),
    function (c) { return /Propietario/.test(c.textContent); }).length;
}
function editFromHistory(w) {
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
}

(async function main() {

  console.log('\n[I1] captura con propietario real + editar 3 veces → 1 solo propietario');
  var w = boot();
  w.document.querySelector('.home-card.hc-property').click();
  $(w, 'btnEmpezarCaptura').click();
  await sleep(20);
  clickChip(w, 'tipoChips', 'Casa');
  clickChip(w, 'ofreceChips', 'Propietario directo'); // crea ficha auto de propietario
  await sleep(20);
  assert(propCards(w) === 1, 'al elegir "Propietario directo" hay 1 ficha de propietario');
  // completar los datos del propietario (queda touched)
  w.document.querySelector('#crmCards [data-edit]').click();
  await sleep(20);
  $(w, 'pf_nombre').value = 'Juan Dueño';
  $(w, 'pf_tel').value = '3310000000';
  $(w, 'personSave').click();
  await sleep(20);
  assert(propCards(w) === 1, 'tras completar datos sigue habiendo 1 propietario');
  $(w, 'btnGen').click();
  await sleep(40);

  // editar 3 veces
  for (var i = 1; i <= 3; i++) {
    editFromHistory(w);
    await sleep(20);
    w.document.querySelector('[data-edit-prop]').click();
    await sleep(30);
    assert(propCards(w) === 1, 'edición #' + i + ': sigue habiendo 1 solo propietario (no ficha fantasma)');
    // guardar la edición para el siguiente ciclo
    $(w, 'btnGen').click();
    await sleep(40);
  }

  console.log('\n[I2] agregar un SEGUNDO propietario manualmente pide confirmación');
  var w2 = boot();
  w2.document.querySelector('.home-card.hc-property').click();
  $(w2, 'btnEmpezarCaptura').click();
  await sleep(20);
  clickChip(w2, 'tipoChips', 'Casa');
  clickChip(w2, 'ofreceChips', 'Propietario directo');
  await sleep(20);
  w2.document.querySelector('#crmCards [data-edit]').click();
  await sleep(20);
  $(w2, 'pf_nombre').value = 'Ana Dueña';
  $(w2, 'pf_tel').value = '3311111111';
  $(w2, 'personSave').click();
  await sleep(20);
  // "+ Agregar persona" → nuevo contacto propietario
  confirmReply = false; confirmCalls = 0;
  Array.prototype.find.call(w2.document.querySelectorAll('#crmCards button'),
    function (b) { return /Agregar persona/.test(b.textContent); }).click();
  await sleep(20);
  $(w2, 'pf_nombre').value = 'Otro Propietario';
  // marcar el tipo "Propietario (B)"
  Array.prototype.find.call(w2.document.querySelectorAll('#pf_tiposChips [data-tipo]'),
    function (c) { return /Propietario/.test(c.dataset.tipo); }).click();
  $(w2, 'personSave').click();
  await sleep(20);
  assert(confirmCalls >= 1, 'guardar un segundo propietario dispara confirmación');
  assert(/duplicar el propietario/i.test(lastConfirmMsg), 'el mensaje pregunta si se quiere duplicar el propietario');
  assert(propCards(w2) === 1, 'al responder NO, no se agrega el segundo propietario (sigue 1)');

  // ahora aceptando la duplicación sí agrega el segundo
  confirmReply = true;
  Array.prototype.find.call(w2.document.querySelectorAll('#crmCards button'),
    function (b) { return /Agregar persona/.test(b.textContent); }).click();
  await sleep(20);
  $(w2, 'pf_nombre').value = 'Segundo Dueño';
  Array.prototype.find.call(w2.document.querySelectorAll('#pf_tiposChips [data-tipo]'),
    function (c) { return /Propietario/.test(c.dataset.tipo); }).click();
  $(w2, 'personSave').click();
  await sleep(20);
  assert(propCards(w2) === 2, 'al responder SÍ, se agrega el segundo propietario (2)');

  console.log('\n========================================');
  console.log('Pruebas propietario: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
