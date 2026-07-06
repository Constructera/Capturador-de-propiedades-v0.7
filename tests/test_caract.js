/*
 * test_caract.js — Fase 3 (v0.7.1): características estilo Wiggot.
 * Lista de filas con checkbox; al marcar una, se reemplaza EN SITIO por otra
 * oculta (las demás no se recorren) y la seleccionada baja a los tags del final.
 *
 * Uso:  node tests/test_caract.js
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
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function rows(w) { return Array.prototype.slice.call(w.document.querySelectorAll('#caractChips .caract-row')); }
function rowText(r) { return r.querySelector('.caract-lbl').textContent; }
function tags(w) { return Array.prototype.map.call(w.document.querySelectorAll('#caractTags .tag'), function (t) { return t.textContent.replace('✕', ''); }); }
function clickChip(w, gid, val) {
  Array.prototype.find.call(w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; }).click();
}

(async function main() {
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  await sleep(10);

  console.log('\n[C1] lista de filas con checkbox (10-15 visibles)');
  var r = rows(w);
  assert(r.length >= 10 && r.length <= 15, 'muestra entre 10 y 15 filas (' + r.length + ')');
  assert(!!r[0].querySelector('.caract-box'), 'cada fila tiene checkbox (.caract-box)');
  assert($(w, 'caractTags').children.length === 0, 'sin seleccionadas al inicio');
  assert($(w, 'caractSelLbl').style.display === 'none', 'la etiqueta "Seleccionadas" está oculta al inicio');

  console.log('\n[C2] al marcar: baja a seleccionadas y se reemplaza EN SITIO');
  var count0 = r.length;
  var texto2 = rowText(r[2]);
  var texto0 = rowText(r[0]), texto1 = rowText(r[1]), texto3 = rowText(r[3]);
  r[2].click();
  assert(r[2].classList.contains('caract-on'), 'la fila marcada se pone verde/checked de inmediato');
  assert(tags(w).indexOf(texto2) !== -1, 'la característica baja a "Seleccionadas" (tags abajo)');
  assert($(w, 'caractSelLbl').style.display !== 'none', 'aparece la etiqueta "Seleccionadas"');
  await sleep(260); // esperar el reemplazo en sitio
  var r2 = rows(w);
  assert(r2.length === count0, 'la lista mantiene la misma cantidad de filas (hueco rellenado)');
  assert(rowText(r2[0]) === texto0 && rowText(r2[1]) === texto1 && rowText(r2[3]) === texto3,
    'las demás filas NO se recorrieron (posiciones 0,1,3 intactas)');
  assert(rowText(r2[2]) !== texto2 && tags(w).indexOf(rowText(r2[2])) === -1,
    'la posición 2 ahora tiene una característica oculta nueva (no seleccionada)');

  console.log('\n[C3] quitar una seleccionada la regresa al pool');
  var elegido = texto2;
  var x = Array.prototype.find.call(w.document.querySelectorAll('#caractTags .tag'),
    function (t) { return t.textContent.replace('✕', '') === elegido; }).querySelector('button');
  x.click();
  assert(tags(w).indexOf(elegido) === -1, 'la característica sale de seleccionadas');
  await sleep(10);

  console.log('\n[C4] "Ver más" expande y "Refrescar" baraja las no seleccionadas');
  var antesMas = rows(w).length;
  $(w, 'btnCaractMas').click();
  assert(rows(w).length > antesMas, 'Ver más muestra más filas');
  $(w, 'btnCaractMas').click();
  assert(rows(w).length <= 15, 'Ver menos vuelve a colapsar');
  var antesRefresh = rows(w).map(rowText).join('|');
  var intento = 0, cambio = false;
  while (intento < 8 && !cambio) { $(w, 'btnCaractRefresh').click(); cambio = rows(w).map(rowText).join('|') !== antesRefresh; intento++; }
  assert(cambio, 'Refrescar cambia el orden/selección de filas visibles');

  console.log('\n[C5] agregar por el input "+" cae en seleccionadas y no en la lista');
  $(w, 'f_caract_buscar').value = 'Cava de vinos';
  $(w, 'btnCaractAdd').click();
  assert(tags(w).indexOf('Cava de vinos') !== -1, 'la nueva va a seleccionadas');
  assert(rows(w).map(rowText).indexOf('Cava de vinos') === -1, 'la nueva no aparece como fila (ya está seleccionada)');

  console.log('\n========================================');
  console.log('Pruebas características: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
