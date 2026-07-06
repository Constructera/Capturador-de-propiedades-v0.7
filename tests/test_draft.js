/*
 * test_draft.js — 2c (v0.7.1): borrador de captura + "¿Continuar captura?".
 * Cubre: guardar borrador al volver al menú (rápido y normal), prompt al
 * reentrar, Continuar restaura los datos, Nueva descarta, editar NO genera
 * borrador, generar limpia el borrador.
 *
 * Uso:  node tests/test_draft.js
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
function draft(w) { var v = w.localStorage.getItem('cap_draft'); return v ? JSON.parse(v) : null; }
function goHomeCard(w) { w.document.querySelector('.home-card.hc-property').click(); }
function goQuickCard(w) { $(w, 'homeQuickCard').click(); }
function empezar(w) { $(w, 'btnEmpezarCaptura').click(); }
function nav(w, view) { w.document.querySelector('#navbar button[data-view="' + view + '"]').click(); }
function clickChipIn(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}

(async function main() {

  console.log('\n[D1] captura NORMAL con datos → volver al menú guarda borrador');
  var w = boot();
  goHomeCard(w); empezar(w);
  await sleep(20);
  clickChipIn(w, 'tipoChips', 'Casa');
  $(w, 'f_nombre').value = 'Casa Borrador';
  $(w, 'f_precio').value = '2500000';
  nav(w, 'viewHome'); // volver al menú por el navbar
  await sleep(20);
  var d = draft(w);
  assert(!!d, 'se guardó un borrador al salir al menú');
  assert(d && d.nombre === 'Casa Borrador' && d.tipo === 'Casa', 'el borrador guarda nombre y tipo');
  assert(d && d.precio === '2500000', 'el borrador guarda el precio');

  console.log('\n[D2] reentrar a captura → aparece "¿Continuar captura?"');
  goHomeCard(w); empezar(w);
  await sleep(20);
  assert($(w, 'draftOverlay').classList.contains('show'), 'overlay de continuar visible al reentrar');
  assert($(w, 'draftInfo').textContent.indexOf('Casa Borrador') !== -1, 'muestra los datos básicos del borrador');

  console.log('\n[D3] Continuar restaura los datos');
  $(w, 'draftContinue').click();
  await sleep(20);
  assert(!$(w, 'draftOverlay').classList.contains('show'), 'overlay se cierra al continuar');
  assert($(w, 'f_nombre').value === 'Casa Borrador', 'nombre restaurado en el formulario');
  assert($(w, 'f_precio').value === '2500000', 'precio restaurado');
  assert(draft(w) === null, 'el borrador se consume al continuar');

  console.log('\n[D4] Nueva captura descarta el borrador');
  var w2 = boot();
  goHomeCard(w2); empezar(w2);
  await sleep(20);
  clickChipIn(w2, 'tipoChips', 'Departamento');
  $(w2, 'f_nombre').value = 'Depto Viejo';
  nav(w2, 'viewHome');
  await sleep(20);
  assert(!!draft(w2), 'hay borrador antes de reentrar');
  goHomeCard(w2); empezar(w2);
  await sleep(20);
  $(w2, 'draftNew').click();
  await sleep(20);
  assert(draft(w2) === null, 'Nueva captura borra el borrador');
  assert($(w2, 'f_nombre').value === '', 'formulario limpio tras Nueva');
  assert(w2.document.getElementById('tipoChips').querySelector('.chip.sel') === null, 'sin tipo seleccionado tras Nueva');

  console.log('\n[D5] modo RÁPIDO: volver al menú guarda borrador quick y reentrada resume rápido');
  var w3 = boot();
  goQuickCard(w3); empezar(w3);
  await sleep(30);
  assert(w3.document.body.classList.contains('quick-mode'), 'entró en modo rápido');
  clickChipIn(w3, 'tipoChips', 'Casa');
  $(w3, 'f_nombre').value = 'Casa Rápida';
  $(w3, 'qkMenu').click(); // ← Menú (guarda borrador)
  await sleep(20);
  var dq = draft(w3);
  assert(dq && dq.quick === true, 'el borrador queda marcado como quick');
  assert(!w3.document.body.classList.contains('quick-mode'), 'salió del modo rápido al ir al menú');
  goQuickCard(w3); empezar(w3);
  await sleep(20);
  assert($(w3, 'draftOverlay').classList.contains('show'), 'prompt al reentrar en rápido');
  $(w3, 'draftContinue').click();
  await sleep(30);
  assert($(w3, 'f_nombre').value === 'Casa Rápida', 'datos del borrador rápido restaurados');
  assert(w3.document.body.classList.contains('quick-mode'), 'continuar reanuda el modo rápido');

  console.log('\n[D6] editar NO genera borrador, y generar limpia el borrador');
  var w4 = boot();
  // crear una captura para editar
  goHomeCard(w4); empezar(w4);
  await sleep(20);
  clickChipIn(w4, 'tipoChips', 'Casa');
  $(w4, 'f_nombre').value = 'Casa Guardada';
  $(w4, 'btnGen').click();
  await sleep(60);
  assert(draft(w4) === null, 'generar no deja borrador');
  // editar desde historial
  nav(w4, 'viewHistory');
  await sleep(20);
  var editBtn = w4.document.querySelector('[data-edit-prop]');
  assert(!!editBtn, 'hay captura para editar');
  editBtn.click();
  await sleep(20);
  $(w4, 'f_nombre').value = 'Casa Guardada (editada)';
  nav(w4, 'viewHome'); // salir de la edición sin generar
  await sleep(20);
  assert(draft(w4) === null, 'editar y salir NO crea borrador (editId activo)');

  console.log('\n========================================');
  console.log('Pruebas borrador: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
