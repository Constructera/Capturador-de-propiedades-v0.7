/*
 * test_catalogo.js — Catálogo filtrable del historial (v0.7 B3), en jsdom.
 * Valida: tarjetas tipo galería (hero + precio grande), panel "+ filtros",
 * filtros combinables (precio/tipo/zona/amenidades), chips activos removibles,
 * conteo con feedback y limpieza de filtros.
 *
 * Uso:  node tests/test_catalogo.js
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

function rec(over) {
  return Object.assign({
    id: 'CAP-TEST', fecha: '2026-07-01T10:00:00.000Z', capturadoEn: '2026-07-01T10:00:00.000Z',
    asesorNombre: 'Daniel', nombre: 'Sin nombre', direccion: '', zona: 'S/I',
    tipo: 'Casa', oper: 'Venta', estrellas: 2, calidad: 'Publicable',
    md: '# md', estado: 'Generada', faltantes: [], copiado: false, enviado: false,
    formData: { f_precio: '', f_precio_renta: '', f_moneda: 'MXN', _state: { caract: [], caractTerr: [] } }
  }, over);
}

var HIST = [
  rec({ id: 'CAP-A', nombre: 'Casa 87', tipo: 'Casa', oper: 'Venta', zona: 'Lomas / Centro',
    enviado: true, estrellas: 3, calidad: 'Completa', driveUrl: 'https://drive.google.com/drive/folders/X',
    formData: { f_precio: '3,700,000', f_precio_renta: '', f_moneda: 'MXN',
      _state: { caract: ['Alberca', 'Jardín privado'], caractTerr: [] } } }),
  rec({ id: 'CAP-B', nombre: 'Depto Centro', tipo: 'Departamento', oper: 'Renta', zona: 'Centro',
    fecha: '2026-07-01T09:00:00.000Z',
    formData: { f_precio: '', f_precio_renta: '15,000', f_moneda: 'MXN',
      _state: { caract: ['Alberca'], caractTerr: [] } } }),
  rec({ id: 'CAP-C', nombre: 'Terreno Los Reyes', tipo: 'Terreno', oper: 'Venta', zona: 'Los Reyes',
    fecha: '2026-07-01T08:00:00.000Z', faltantes: ['precio confirmado'],
    formData: { f_precio: '900,000', f_precio_renta: '', f_moneda: 'MXN',
      _state: { caract: [], caractTerr: ['Barda perimetral'] } } })
];
var CT = [{ id: 'CT-1', nombre: 'Juan Pérez', tipo: 'Propietario', fecha: '2026-07-01T07:00:00.000Z',
  asesor: 'Daniel', md: '# ct', enviado: false }];

function boot() {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  // endpoint vacío: sin sync de nube, el historial sembrado queda intacto
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: '' }));
  w.localStorage.setItem('cap_hist', JSON.stringify(HIST));
  w.localStorage.setItem('cap_ct_hist', JSON.stringify(CT));
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
function chipIn(w, boxId, label) {
  return Array.prototype.find.call(
    w.document.querySelectorAll('#' + boxId + ' .chip'),
    function (c) { return c.dataset.cv === label || c.textContent === label; });
}
function cards(w) { return w.document.querySelectorAll('#histList .hist-item'); }
function cardIds(w) {
  return Array.prototype.map.call(cards(w), function (c) { return c.dataset.rid; }).join(',');
}
function filtrosBtn(w) {
  return Array.prototype.find.call(
    w.document.querySelectorAll('#histFilters .chip'),
    function (c) { return c.textContent.indexOf('filtros') !== -1; });
}

(async function main() {

  /* ============ C1. Tarjetas tipo galería ============ */
  console.log('\n[C1] tarjetas de catálogo');
  var w = boot();
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  assert(cards(w).length === 4, '4 tarjetas (3 propiedades + 1 contacto)');
  var cardA = w.document.querySelector('.hist-item[data-rid="CAP-A"]');
  assert(cardA.classList.contains('cat-card'), 'la tarjeta de propiedad usa layout de catálogo');
  assert(cardA.querySelector('.cat-hero') !== null, 'hero visual arriba');
  assert(cardA.querySelector('.cat-hero').textContent.indexOf('🏡') !== -1, 'emoji según tipo (Casa → 🏡)');
  assert(cardA.querySelector('.cat-price').textContent.indexOf('3,700,000') !== -1, 'precio grande visible');
  assert(cardA.querySelector('.cat-hero .hi-state') !== null, 'pill de estado dentro del hero');
  assert(cardA.querySelector('.cat-hero-badge') !== null, 'badge 📷 cuando hay carpeta Drive');
  var cardB = w.document.querySelector('.hist-item[data-rid="CAP-B"]');
  assert(cardB.querySelector('.cat-price').textContent.indexOf('/mes') !== -1, 'renta se muestra como $X /mes');
  var cardCt = w.document.querySelector('.hist-item[data-rid="CT-1"]');
  assert(cardCt !== null && !cardCt.classList.contains('cat-card'), 'los contactos conservan su tarjeta simple');
  assert($(w, 'catCount').textContent === '4 capturas', 'conteo inicial sin filtros');
  // los botones de acción siguen vivos tras el rediseño
  assert(cardA.querySelector('[data-drive="CAP-A"]') !== null, 'botón Fotos Drive presente');
  assert(cardB.querySelector('[data-copy="CAP-B"]') !== null, 'botón Copiar MD presente');

  /* ============ C2. Panel de filtros ============ */
  console.log('\n[C2] panel "+ filtros"');
  var fb = filtrosBtn(w);
  assert(!!fb, 'existe el botón + filtros en la fila de chips');
  fb.click();
  assert(!$(w, 'catPanel').hidden, 'el panel se despliega');
  assert($(w, 'cgPrecioVenta').querySelectorAll('.chip').length === 4, '4 rangos de precio venta');
  assert(!!chipIn(w, 'cgTipo', 'Casa') && !!chipIn(w, 'cgTipo', 'Terreno'), 'tipos derivados de las capturas');
  assert(!!chipIn(w, 'cgZona', 'Centro') && !!chipIn(w, 'cgZona', 'Lomas'), 'zonas multi separadas (Lomas / Centro)');
  assert(!!chipIn(w, 'cgAmen', 'Alberca') && !!chipIn(w, 'cgAmen', 'Barda perimetral'), 'amenidades incluyen caract y caractTerr');

  /* ============ C3. Filtro simple + feedback ============ */
  console.log('\n[C3] filtro de tipo con feedback');
  chipIn(w, 'cgTipo', 'Casa').click();
  assert(chipIn(w, 'cgTipo', 'Casa').classList.contains('sel'), 'chip marcado como activo');
  assert(cardIds(w) === 'CAP-A', 'solo la Casa queda en la lista');
  assert($(w, 'catCount').textContent === '1 de 4 capturas', 'conteo "1 de 4"');
  assert($(w, 'catActive').querySelectorAll('.tag').length === 1, 'chip de filtro aplicado visible');
  assert(fb.querySelector('.cat-fbadge').textContent === '1', 'badge del botón + filtros = 1');
  assert(w.document.querySelector('#histList .hist-item-ct') === null, 'contactos ocultos con filtros activos');

  /* ============ C4. Filtros combinables y quitar desde el chip activo ============ */
  console.log('\n[C4] combinación y remoción');
  chipIn(w, 'cgZona', 'Centro').click();
  assert(cardIds(w) === 'CAP-A', 'Casa + zona Centro → sigue CAP-A (zona multi)');
  assert(fb.querySelector('.cat-fbadge').textContent === '2', 'badge = 2 filtros combinados');
  var rmTipo = w.document.querySelector('#catActive [data-rmcg="tipos"]');
  rmTipo.click();
  assert(cardIds(w) === 'CAP-A,CAP-B', 'al quitar tipo queda solo zona Centro → A y B');
  assert($(w, 'catCount').textContent === '2 de 4 capturas', 'conteo actualizado al remover');

  /* ============ C5. Precio venta / renta ============ */
  console.log('\n[C5] rangos de precio');
  chipIn(w, 'cgPrecioVenta', '$3–5M').click();
  assert(cardIds(w) === 'CAP-A', 'venta $3–5M + zona Centro → solo CAP-A');
  chipIn(w, 'cgPrecioRenta', '$10–20k').click();
  assert(!chipIn(w, 'cgPrecioVenta', '$3–5M').classList.contains('sel'), 'precio único: renta deselecciona venta');
  assert(cardIds(w) === 'CAP-B', 'renta $10–20k + zona Centro → solo CAP-B');

  /* ============ C6. Limpiar filtros ============ */
  console.log('\n[C6] limpiar');
  $(w, 'catClear').click();
  assert(cards(w).length === 4, 'todas las tarjetas de regreso');
  assert($(w, 'catCount').textContent === '4 capturas', 'conteo sin filtros');
  assert($(w, 'catActive').querySelectorAll('.tag').length === 0, 'sin chips activos');
  assert(fb.querySelector('.cat-fbadge').style.display === 'none', 'badge oculto');

  /* ============ C7. Amenidades en AND + precio < $1M ============ */
  console.log('\n[C7] amenidades AND y rango bajo');
  chipIn(w, 'cgAmen', 'Alberca').click();
  assert(cardIds(w) === 'CAP-A,CAP-B', 'Alberca → A y B');
  chipIn(w, 'cgAmen', 'Jardín privado').click();
  assert(cardIds(w) === 'CAP-A', 'Alberca AND Jardín privado → solo A');
  $(w, 'catClear').click();
  chipIn(w, 'cgPrecioVenta', '< $1M').click();
  assert(cardIds(w) === 'CAP-C', 'venta < $1M → el terreno de $900,000');

  /* ============ C8. Combina con los filtros de estado ============ */
  console.log('\n[C8] estado + catálogo');
  $(w, 'catClear').click();
  var chipPend = Array.prototype.find.call(
    w.document.querySelectorAll('#histFilters .chip[data-estado]'),
    function (c) { return c.dataset.f === 'Pendientes'; });
  chipPend.click();
  chipIn(w, 'cgTipo', 'Departamento').click();
  assert(cardIds(w) === 'CAP-B', 'Pendientes + tipo Departamento → CAP-B');

  /* ============ resumen ============ */
  console.log('\n========================================');
  console.log('Pruebas catálogo: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
