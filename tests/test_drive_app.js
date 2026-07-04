/*
 * test_drive_app.js — Flujo Drive del lado app (v0.7 Bloque 2), en jsdom.
 * Stub de fetch que simula el GAS v3: saveMarkdown responde folderUrl.
 * Valida: driveUrl persiste en historial, botón 📷 Fotos Drive reemplaza a
 * Copiar MD, el tap abre la carpeta, y la edición lleva la URL al markdown.
 *
 * Uso:  node tests/test_drive_app.js
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

var FOLDER_URL = 'https://drive.google.com/drive/folders/FLDTEST99';

function boot(seed) {
  var vc = new VirtualConsole();
  vc.on('jsdomError', function () {});
  var dom = new JSDOM(htmlSrc, {
    url: 'https://hauser.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w._alerts = []; w._opened = []; w._gasPosts = [];
  w.alert = function (m) { w._alerts.push(String(m)); };
  w.confirm = function () { return true; };
  w.prompt = function () { return null; };
  w.open = function (url) { w._opened.push(url); return null; };
  // Stub del GAS v3: saveMarkdown → folderUrl; capturas planas → ok; GET → sin datos
  w.fetch = function (url, opts) {
    if (opts && opts.method === 'POST') {
      var body = JSON.parse(opts.body);
      w._gasPosts.push(body);
      var resp = body.action === 'saveMarkdown'
        ? {ok:true, folderUrl: body.tipo === 'propiedad' ? FOLDER_URL : ''}
        : {ok:true};
      return Promise.resolve({json: function () { return Promise.resolve(resp); }});
    }
    return Promise.resolve({json: function () { return Promise.resolve({ok:false}); }});
  };
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
function clickChip(w, gid, val) {
  var c = Array.prototype.find.call(
    w.document.querySelectorAll('#' + gid + ' .chip'),
    function (x) { return x.dataset.v === val; });
  c.click();
}

(async function main() {

  /* ============ D1. driveUrl llega del GAS y persiste en historial ============ */
  console.log('\n[D1] folderUrl del GAS → driveUrl en historial');
  var w = boot();
  clickChip(w, 'tipoChips', 'Casa');
  setVal(w, 'f_direccion', 'Av. Palmira 123, Cuernavaca');
  $(w, 'btnGen').click();
  await sleep(60); // esperar la respuesta simulada del GAS
  var hist = JSON.parse(w.localStorage.getItem('cap_hist'));
  assert(hist[0].driveUrl === FOLDER_URL, 'rec.driveUrl guardado en localStorage (cap_hist)');
  var smd = w._gasPosts.filter(function (p) { return p.action === 'saveMarkdown'; });
  assert(smd.length === 1, 'se envió UN saveMarkdown al GAS');
  assert(smd[0].direccion === 'Av. Palmira 123, Cuernavaca', 'el payload saveMarkdown incluye la dirección para nombrar la carpeta');
  var resub = w._gasPosts.filter(function (p) { return !p.action && p.propiedad_json && p.propiedad_json.indexOf(FOLDER_URL) !== -1; });
  assert(resub.length >= 1, 'la captura se re-subió con driveUrl (la nube no lo perderá al sincronizar)');

  /* ============ D2. Botón 📷 Fotos Drive reemplaza a Copiar MD y abre la carpeta ============ */
  console.log('\n[D2] botón Fotos Drive en historial');
  w.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  var uuid = hist[0].id;
  var item = w.document.querySelector('.hist-item[data-rid="' + uuid + '"]');
  var driveBtn = item.querySelector('[data-drive="' + uuid + '"]');
  assert(!!driveBtn, 'el botón 📷 Fotos Drive existe en la tarjeta');
  assert(driveBtn.textContent.indexOf('Fotos Drive') !== -1, 'con el texto "📷 Fotos Drive"');
  assert(item.querySelector('[data-copy="' + uuid + '"]') !== null, 'Copiar MD convive con Fotos Drive (F2: rediseño catálogo)');
  driveBtn.click();
  assert(w._opened.length === 1 && w._opened[0] === FOLDER_URL, 'el tap abre la carpeta Drive (window.open con folderUrl)');
  assert(!$(w, 'histDetailOverlay').classList.contains('show'), 'el botón no dispara el detalle solo lectura');

  /* ============ D3. Edición: la URL entra al markdown y driveUrl sobrevive ============ */
  console.log('\n[D3] edición con carpeta ya creada');
  item.querySelector('[data-edit-prop="' + uuid + '"]').click();
  $(w, 'btnGen').click();
  await sleep(60);
  var md2 = $(w, 'mdOut').textContent;
  var mDrive = md2.match(/^\| Carpeta Drive \| URL \| ([^|]*) \|/m);
  assert(!!mDrive && mDrive[1].trim() === FOLDER_URL, 'la fila "Carpeta Drive" del markdown editado lleva la URL real');
  var hist2 = JSON.parse(w.localStorage.getItem('cap_hist'));
  assert(hist2.length === 1 && hist2[0].driveUrl === FOLDER_URL, 'driveUrl sobrevive a la edición (upsert)');
  var smd2 = w._gasPosts.filter(function (p) { return p.action === 'saveMarkdown'; });
  assert(smd2.length === 2 && smd2[1].uuid === uuid, 'la edición reenvía saveMarkdown con el mismo uuid (el GAS reutiliza la carpeta)');

  /* ============ D4. Capturas sin driveUrl conservan Copiar MD ============ */
  console.log('\n[D4] retrocompatibilidad');
  var w2 = boot();
  // endpoint vacío = GAS apagado → nunca llega folderUrl
  w2.eval("localStorage.setItem('cap_cfg',JSON.stringify({resp:'Daniel',endpoint:''}))");
  var w3 = boot();
  w3.fetch = function () { return Promise.reject(new Error('offline')); }; // GAS caído
  clickChip(w3, 'tipoChips', 'Casa');
  $(w3, 'btnGen').click();
  await sleep(60);
  w3.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  var it3 = w3.document.querySelector('.hist-item');
  assert(!!it3.querySelector('[data-copy]'), 'sin driveUrl el botón sigue siendo Copiar MD');
  assert(it3.querySelector('[data-drive]') === null, 'no aparece botón Drive sin carpeta');
  var h3 = JSON.parse(w3.localStorage.getItem('cap_hist'));
  assert(h3[0].driveUrl === '', 'driveUrl queda vacío cuando el GAS no responde');

  /* ============ D5. Contactos no reciben carpeta ============ */
  console.log('\n[D5] contactos');
  var smdCt = w._gasPosts.filter(function (p) { return p.action === 'saveMarkdown' && p.tipo === 'contacto'; });
  assert(smdCt.length === 0, 'ningún saveMarkdown de contacto disparado en el flujo de propiedad');

  /* ============ D6. Clave compartida: la app la envía en POST y GET ============ */
  console.log('\n[D6] clave compartida del backend');
  var w6 = boot({cap_cfg: JSON.stringify({resp:'Daniel', endpoint:'https://gas.test/exec', gasKey:'clave-equipo-2026'})});
  var getUrls = [];
  var origFetch = w6.fetch;
  w6.fetch = function (url, opts) {
    if (!opts || !opts.method) getUrls.push(String(url));
    return origFetch.call(this, url, opts);
  };
  clickChip(w6, 'tipoChips', 'Casa');
  $(w6, 'btnGen').click();
  await sleep(60);
  var withKey = w6._gasPosts.filter(function (p) { return p.k === 'clave-equipo-2026'; });
  assert(w6._gasPosts.length > 0 && withKey.length === w6._gasPosts.length, 'todos los POST llevan k (clave compartida)');
  w6.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  assert(getUrls.some(function (u) { return u.indexOf('k=clave-equipo-2026') !== -1; }), 'el GET del historial lleva ?k=');
  assert($(w6, 'cfg_gaskey').value === 'clave-equipo-2026', 'el campo de Config muestra la clave guardada');
  // sin clave configurada, el payload no lleva k (retrocompatible con GAS viejo)
  var noKey = w._gasPosts.filter(function (p) { return p.hasOwnProperty('k'); });
  assert(noKey.length === 0, 'sin clave configurada, los POST no llevan k');

  /* ============ D7. Editar NO pisa al asesor original (v0.7 B4) ============ */
  console.log('\n[D7] trazabilidad del asesor original en ediciones');
  var w8 = boot({cap_asesor_activo: JSON.stringify({id:'as_erica', nombre:'Erica'})});
  clickChip(w8, 'tipoChips', 'Casa');
  setVal(w8, 'f_direccion', 'Av. Zapata 55, Tlaltenango');
  $(w8, 'btnGen').click();
  await sleep(60);
  var h8 = JSON.parse(w8.localStorage.getItem('cap_hist'));
  assert(h8[0].asesorNombre === 'Erica' && (h8[0].editadoPor || '') === '', 'captura nueva: asesor = Erica, sin editadoPor');
  var smd8 = w8._gasPosts.filter(function (p) { return p.action === 'saveMarkdown'; });
  assert(smd8[0].asesor === 'Erica', 'saveMarkdown inicial lleva a Erica');
  // cambia el asesor activo a Daniel (como pasó en producción) y edita
  setVal(w8, 'cfg_resp', 'Daniel');
  w8.document.querySelector('#navbar button[data-view="viewHistory"]').click();
  await sleep(30);
  var uuid8 = h8[0].id;
  w8.document.querySelector('[data-edit-prop="' + uuid8 + '"]').click();
  $(w8, 'btnGen').click();
  await sleep(60);
  var h8b = JSON.parse(w8.localStorage.getItem('cap_hist'));
  assert(h8b.length === 1 && h8b[0].asesorNombre === 'Erica', 'tras editar con Daniel activo: asesor sigue siendo Erica');
  assert(h8b[0].editadoPor === 'Daniel', 'el editor queda en rec.editadoPor');
  var smd8b = w8._gasPosts.filter(function (p) { return p.action === 'saveMarkdown'; });
  assert(smd8b.length === 2 && smd8b[1].asesor === 'Erica' && smd8b[1].editadoPor === 'Daniel',
    'el saveMarkdown de la edición manda asesor original + editadoPor');
  var flat8 = w8._gasPosts.filter(function (p) { return !p.action && p.id === uuid8; });
  assert(flat8.length >= 2 && flat8[flat8.length - 1].asesor === 'Erica', 'la captura re-subida conserva asesor Erica en la columna');

  /* ============ resumen ============ */
  console.log('\n========================================');
  console.log('Pruebas Drive app: ' + (passed + failed) + ' · ✅ ' + passed + ' · ❌ ' + failed);
  if (failed) { console.error('Fallas:\n - ' + failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function (e) { console.error('ERROR FATAL: ' + e.stack); process.exit(1); });
