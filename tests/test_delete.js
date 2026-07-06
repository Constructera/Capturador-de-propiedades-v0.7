/*
 * test_delete.js — Borrado del historial con PIN (v0.7 B4), en jsdom.
 * Valida: PIN incorrecto no borra (con feedback), PIN correcto borra local +
 * llama deleteCapture en el GAS, error de red no rompe la UI (queda en cola),
 * y el tombstone evita que el sync de nube reviva la captura borrada.
 *
 * Uso:  node tests/test_delete.js
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

var CAP_HEADERS = ['id','timestamp','tipo','asesor','estrellas','calidad',
  'propiedad_json','contacto_json','capturadoEn','modificadoEn'];

function rec(id, nombre) {
  return { id: id, fecha: '2026-07-01T10:00:00.000Z', capturadoEn: '2026-07-01T10:00:00.000Z',
    asesorNombre: 'Daniel', nombre: nombre, direccion: '', zona: 'Centro', tipo: 'Casa',
    oper: 'Venta', estrellas: 2, calidad: 'Publicable', md: '# md', estado: 'Generada',
    faltantes: [], copiado: false, enviado: false,
    formData: { f_precio: '1,000,000', f_moneda: 'MXN', _state: { caract: [], caractTerr: [] } } };
}

function boot(opts) {
  opts = opts || {};
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: opts.endpoint === undefined ? 'https://gas.test/exec' : opts.endpoint }));
  w.localStorage.setItem('cap_hist', JSON.stringify(opts.hist || [rec('CAP-DEL', 'Casa Borrable'), rec('CAP-KEEP', 'Casa Fija')]));
  if (opts.ctHist) w.localStorage.setItem('cap_ct_hist', JSON.stringify(opts.ctHist));
  if (opts.tomb) w.localStorage.setItem('cap_del_pend', JSON.stringify(opts.tomb));
  w._gasPosts = [];
  w.alert = function () {}; w.confirm = function () { throw new Error('confirm() ya no debe usarse para borrar'); };
  w.fetch = function (url, o) {
    if (o && o.method === 'POST') {
      var body = JSON.parse(o.body);
      w._gasPosts.push(body);
      if (opts.red === 'off') return Promise.reject(new Error('sin red'));
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, deleted: { capturas: true, markdowns: true } }); } });
    }
    // GET del sync de nube
    if (opts.cloud) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, capturas: opts.cloud, asesores: [[]] }); } });
    return Promise.reject(new Error('sin GET'));
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function openHist(w) { w.document.querySelector('#navbar button[data-view="viewHistory"]').click(); }
function clickBorrar(w, id) { w.document.querySelector('[data-del2="' + id + '"]').click(); }
function hist(w) { return JSON.parse(w.localStorage.getItem('cap_hist') || '[]'); }
function tomb(w) { return JSON.parse(w.localStorage.getItem('cap_del_pend') || '[]'); }
function queue(w) { return JSON.parse(w.localStorage.getItem('cap_gasqueue') || '[]'); }
function delPosts(w) { return w._gasPosts.filter(function (p) { return p.action === 'deleteCapture'; }); }

(async function main() {

  /* ============ P1. PIN incorrecto: no borra, feedback claro ============ */
  console.log('\n[P1] PIN incorrecto');
  var w = boot({ cloud: null });
  openHist(w);
  await sleep(30);
  clickBorrar(w, 'CAP-DEL');
  assert($(w, 'pinOverlay').classList.contains('show'), 'el modal de PIN se abre (ya no hay confirm())');
  $(w, 'pinInput').value = '0000';
  $(w, 'pinOk').click();
  assert($(w, 'pinMsg').style.display !== 'none', 'feedback visible: PIN incorrecto');
  assert($(w, 'pinOverlay').classList.contains('show'), 'el modal sigue abierto para reintentar');
  assert(hist(w).length === 2, 'NO se borró nada del localStorage');
  assert(delPosts(w).length === 0, 'NO se llamó deleteCapture en el GAS');
  assert($(w, 'pinInput').value === '', 'el input se limpia para reintentar');

  /* ============ P2. Cancelar cierra sin borrar ============ */
  console.log('\n[P2] cancelar');
  $(w, 'pinCancel').click();
  assert(!$(w, 'pinOverlay').classList.contains('show'), 'cancelar cierra el modal');
  assert(hist(w).length === 2, 'cancelar no borra');

  /* ============ P3. PIN correcto: borra local + GAS ============ */
  console.log('\n[P3] PIN correcto');
  clickBorrar(w, 'CAP-DEL');
  $(w, 'pinInput').value = '1512';
  $(w, 'pinOk').click();
  await sleep(500); // 1c v0.7.1: el cierre se retrasa ~420ms por la explosión del botón
  assert(!$(w, 'pinOverlay').classList.contains('show'), 'el modal se cierra (tras la animación de explosión)');
  var h = hist(w);
  assert(h.length === 1 && h[0].id === 'CAP-KEEP', 'la captura se borró del localStorage (solo la pedida)');
  assert(w.document.querySelector('[data-rid="CAP-DEL"]') === null, 'la tarjeta desapareció de la lista');
  assert(w.document.querySelector('[data-rid="CAP-KEEP"]') !== null, 'las demás siguen visibles');
  var dp = delPosts(w);
  assert(dp.length === 1 && dp[0].uuid === 'CAP-DEL' && dp[0].pin === '1512', 'deleteCapture enviado al GAS con uuid + PIN');
  assert(tomb(w).length === 0, 'GAS confirmó → tombstone limpiado');

  /* ============ P4. Error de red: UI intacta + cola de reintento ============ */
  console.log('\n[P4] sin red');
  var w4 = boot({ red: 'off', cloud: null });
  openHist(w4);
  await sleep(30);
  clickBorrar(w4, 'CAP-DEL');
  $(w4, 'pinInput').value = '1512';
  $(w4, 'pinOk').click();
  await sleep(50);
  assert(hist(w4).length === 1, 'sin red: el borrado local sí se aplica');
  assert(w4.document.querySelector('[data-rid="CAP-DEL"]') === null, 'sin red: la tarjeta desaparece igual');
  var q4 = queue(w4).filter(function (p) { return p.action === 'deleteCapture' && p.uuid === 'CAP-DEL'; });
  assert(q4.length === 1, 'el deleteCapture quedó en la cola de reintento');
  assert(tomb(w4).indexOf('CAP-DEL') !== -1, 'el tombstone se conserva mientras el Sheet no confirme');
  // la UI sigue viva: otro borrado funciona
  clickBorrar(w4, 'CAP-KEEP');
  assert($(w4, 'pinOverlay').classList.contains('show'), 'la UI sigue funcionando tras el error de red');
  $(w4, 'pinCancel').click();

  /* ============ P5. Tombstone: el sync de nube no revive la captura ============ */
  console.log('\n[P5] tombstone vs sync de nube');
  var cloudRow = function (id) {
    var r = rec(id, 'Nube ' + id);
    return [id, r.fecha, 'propiedad', 'Daniel', 2, 'Publicable', JSON.stringify(r), '', r.fecha, r.fecha];
  };
  var w5 = boot({ hist: [rec('CAP-KEEP', 'Casa Fija')], tomb: ['CAP-GONE'],
    cloud: [CAP_HEADERS, cloudRow('CAP-GONE'), cloudRow('CAP-KEEP')] });
  openHist(w5);
  await sleep(60);
  assert(w5.document.querySelector('[data-rid="CAP-GONE"]') === null, 'la captura borrada NO revive aunque la nube aún la traiga');
  assert(hist(w5).filter(function (r) { return r.id === 'CAP-GONE'; }).length === 0, 'tampoco vuelve al localStorage');
  assert(w5.document.querySelector('[data-rid="CAP-KEEP"]') !== null, 'las no borradas sí sincronizan');
  assert(tomb(w5).indexOf('CAP-GONE') !== -1, 'tombstone se conserva mientras siga en la nube');
  // cuando la nube ya no la trae, el tombstone se purga solo
  var w6 = boot({ hist: [rec('CAP-KEEP', 'Casa Fija')], tomb: ['CAP-GONE'],
    cloud: [CAP_HEADERS, cloudRow('CAP-KEEP')] });
  openHist(w6);
  await sleep(60);
  assert(tomb(w6).length === 0, 'borrado confirmado en nube → tombstone purgado');

  /* ============ P6. Contactos también piden PIN ============ */
  console.log('\n[P6] contactos');
  var w7 = boot({ hist: [], ctHist: [{ id: 'CT-1', nombre: 'Juan', tipo: 'Propietario',
    fecha: '2026-07-01T09:00:00.000Z', asesor: 'Daniel', md: '# ct', enviado: false }], cloud: null });
  openHist(w7);
  await sleep(30);
  w7.document.querySelector('[data-del-ct="CT-1"]').click();
  assert($(w7, 'pinOverlay').classList.contains('show'), 'borrar contacto también abre el modal de PIN');
  $(w7, 'pinInput').value = '1512';
  $(w7, 'pinOk').click();
  await sleep(50);
  assert(JSON.parse(w7.localStorage.getItem('cap_ct_hist')).length === 0, 'contacto borrado del localStorage');
  var dp7 = delPosts(w7);
  assert(dp7.length === 1 && dp7[0].uuid === 'CT-1', 'deleteCapture del contacto enviado al GAS');

  /* ============ resumen ============ */
  console.log('\n========================================');
  console.log('Pruebas borrado PIN: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
