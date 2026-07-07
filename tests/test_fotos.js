/*
 * test_fotos.js — B (v0.7.1): la foto de Drive aparece en la tarjeta.
 * Regresión del bug reportado con "Burgos amigo de Paco": el GET del GAS v3.6
 * trae fotos:{uuid:thumbnail}; la app debe (1) fusionar esa foto en el registro
 * y renderizar <img class="cat-hero-img">, y (2) disparar refreshFotos (POST)
 * cuando una propiedad tiene carpeta Drive pero aún no tiene miniatura.
 *
 * Uso:  node tests/test_fotos.js
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

var THUMB = 'https://drive.google.com/thumbnail?id=1bI6Bev92zKe6__iyh3dCvY9NgomtLMS5&sz=w640';
var BURGOS = {
  id: 'CAP-MR9MJMFZ-TCL86C3Q', fecha: '2026-07-01T10:00:00.000Z', capturadoEn: '2026-07-01T10:00:00.000Z',
  asesorNombre: 'Daniel', nombre: 'Burgos amigo de Paco', direccion: 'Burgos', zona: 'Burgos',
  tipo: 'Casa', oper: 'Venta', estrellas: 2, calidad: 'Publicable',
  md: '# md', estado: 'Generada', faltantes: [], copiado: false, enviado: true,
  driveUrl: 'https://drive.google.com/drive/folders/1CbwFKc8BCwl6V3wz6k5m6Wi_VLzIaUEk',
  formData: { f_precio: '2,500,000', f_moneda: 'MXN', _state: { caract: [], caractTerr: [] } }
};

/* construye la respuesta GET del GAS (capturas como filas + fotos map) */
function gasGetResponse(fotos) {
  var hdr = ['id', 'timestamp', 'tipo', 'asesor', 'estrellas', 'calidad', 'propiedad_json', 'contacto_json', 'capturadoEn', 'modificadoEn'];
  var row = ['CAP-MR9MJMFZ-TCL86C3Q', BURGOS.fecha, 'propiedad', 'Daniel', 2, 'Publicable',
    JSON.stringify(BURGOS), '', BURGOS.capturadoEn, ''];
  return { ok: true, capturas: [hdr, row], asesores: [['asesor']], fotos: fotos || {} };
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
  w.localStorage.setItem('cap_cfg', JSON.stringify({ resp: 'Daniel', endpoint: 'https://gas.test/exec' }));
  // el historial local arranca SIN fotoUrl (como en el celular del dueño)
  w.localStorage.setItem('cap_hist', JSON.stringify([BURGOS]));
  w.alert = function () {}; w.confirm = function () { return true; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w._posts = [];
  w.fetch = function (url, init) {
    if (init && init.method === 'POST') {
      var body = JSON.parse(init.body);
      w._posts.push(body);
      if (body.action === 'refreshFotos') {
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, actualizadas: 1, fotos: { 'CAP-MR9MJMFZ-TCL86C3Q': THUMB } }); } });
      }
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } });
    }
    // GET
    return Promise.resolve({ json: function () { return Promise.resolve(gasGetResponse(opts.fotos)); } });
  };
  w.eval(appSrc);
  return w;
}
function $(w, id) { return w.document.getElementById(id); }
function heroImg(w) { return w.document.querySelector('.hist-item[data-rid="CAP-MR9MJMFZ-TCL86C3Q"] img.cat-hero-img'); }

(async function main() {

  console.log('\n[P1] el GET trae fotos:{uuid} → la tarjeta renderiza <img>');
  var w = boot({ fotos: { 'CAP-MR9MJMFZ-TCL86C3Q': THUMB } });
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(60);
  var img = heroImg(w);
  assert(!!img, 'la tarjeta de Burgos tiene <img class="cat-hero-img">');
  assert(img && img.getAttribute('src') === THUMB, 'el src del img es la miniatura del GAS');
  var stored = JSON.parse(w.localStorage.getItem('cap_hist')).filter(function (r) { return r.id === BURGOS.id; })[0];
  assert(stored && stored.fotoUrl === THUMB, 'la fotoUrl se persistió en el historial local');

  console.log('\n[P2] sin foto en el GET pero con carpeta Drive → dispara refreshFotos (POST) y actualiza');
  var w2 = boot({ fotos: {} }); // GET sin fotos (columna vacía, estado inicial real)
  w2.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(80);
  var fired = w2._posts.filter(function (p) { return p.action === 'refreshFotos'; });
  assert(fired.length >= 1, 'la app dispara refreshFotos al ver una propiedad con carpeta y sin foto');
  await sleep(40);
  var img2 = heroImg(w2);
  assert(!!img2 && img2.getAttribute('src') === THUMB, 'tras refreshFotos, la tarjeta muestra la miniatura');

  console.log('\n[P3] throttle: no dispara refreshFotos si ya se pidió hace <5 min');
  var w3 = boot({ fotos: {} });
  w3.localStorage.setItem('cap_fotos_refresh_ts', String(Date.now())); // recién pedido
  w3.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(60);
  var fired3 = w3._posts.filter(function (p) { return p.action === 'refreshFotos'; });
  assert(fired3.length === 0, 'con timestamp reciente NO vuelve a llamar refreshFotos (throttle 5 min)');

  console.log('\n========================================');
  console.log('Pruebas fotos: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})();
