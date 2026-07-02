/*
 * check_ids.js — Validador de integridad de IDs entre app.js e index.html.
 *
 * Recorre app.js, extrae todos los IDs referenciados con $('id') o
 * getElementById('id') (solo literales de cadena) y verifica que cada uno
 * exista como id="..." en index.html O en HTML generado dinámicamente por
 * el propio app.js (cadenas id="..." dentro del JS, p. ej. los pf_* del
 * overlay de persona). Reporta cualquier ID huérfano.
 *
 * Uso:  node tests/check_ids.js
 * Sale con código 1 si hay huérfanos, 0 si todo está bien.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
var htmlSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* 1. IDs referenciados en app.js: $('...') y getElementById('...') */
var refs = {}; // id -> [línea, ...]
var lines = appSrc.split('\n');
var reRef = /(?:\$\(|getElementById\()\s*(['"])([A-Za-z_][\w-]*)\1\s*\)/g;
lines.forEach(function (line, i) {
  var m;
  reRef.lastIndex = 0;
  while ((m = reRef.exec(line)) !== null) {
    var id = m[2];
    if (!refs[id]) refs[id] = [];
    refs[id].push(i + 1);
  }
});

/* 2. IDs declarados en index.html */
var declared = {};
var reId = /\bid\s*=\s*(['"])([A-Za-z_][\w-]*)\1/g;
var m;
while ((m = reId.exec(htmlSrc)) !== null) declared[m[2]] = 'index.html';

/* 3. IDs declarados en HTML dinámico dentro de app.js (id="..." en cadenas JS).
 * Cubre tanto id="pf_nombre" (comillas dobles dentro de cadena simple) como
 * id=\'x\' — y también los construidos con concatenación conocida no se
 * detectan: esos se listan aparte como "dinámicos" si el prefijo coincide. */
reId.lastIndex = 0;
while ((m = reId.exec(appSrc)) !== null) {
  declared[m[2]] = 'app.js (HTML dinámico)';
}

/* Prefijos de IDs que app.js construye por concatenación (id="md_'+r.id+'").
 * Un ref literal jamás los producirá, pero se documentan por claridad. */

/* 4. Comparar */
var orphans = [];
Object.keys(refs).sort().forEach(function (id) {
  if (!declared[id]) orphans.push(id);
});

var totalRefs = Object.keys(refs).length;
console.log('check_ids: ' + totalRefs + ' IDs únicos referenciados en app.js; ' +
  Object.keys(declared).length + ' IDs declarados (index.html + HTML dinámico).');

if (orphans.length) {
  console.error('\n❌ IDs HUÉRFANOS (referenciados en app.js pero sin id="..." en index.html ni en HTML dinámico):');
  orphans.forEach(function (id) {
    console.error('  - "' + id + '"  → app.js línea(s): ' + refs[id].join(', '));
  });
  process.exit(1);
} else {
  console.log('✅ Sin IDs huérfanos.');
  process.exit(0);
}
