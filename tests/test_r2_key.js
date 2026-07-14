/*
 * test_r2_key.js — Asserts puros de r2Slug / r2Key del puente R2 (GAS v3.8).
 * Sin red, sin jsdom, sin tocar producción. Vigila que la llave canónica
 * <uuid>/<fileId>_<slug> sea estable ante acentos, espacios, mayúsculas,
 * extensiones y nombres duplicados.
 *
 * Uso:  node tests/test_r2_key.js
 */
'use strict';
var r2 = require('./r2_helpers.js');

var passed = 0, failed = 0, failures = [];
function eq(got, want, name) {
  if (got === want) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.error('  ❌ ' + name + '\n      got:  ' + got + '\n      want: ' + want); }
}
function ok(cond, name) { eq(!!cond, true, name); }

console.log('r2Slug — normalización de nombre de archivo');
eq(r2.r2Slug('Foto.jpg'), 'foto.jpg', 'minúsculas');
eq(r2.r2Slug('Casa Bonita.JPG'), 'casa-bonita.jpg', 'espacios → guion, extensión en minúscula');
eq(r2.r2Slug('Fachada Ñoño áéíóú.png'), 'fachada-nono-aeiou.png', 'acentos y ñ');
eq(r2.r2Slug('a   b    c.jpeg'), 'a-b-c.jpeg', 'espacios múltiples colapsan a un guion');
eq(r2.r2Slug('  raro__nombre--.jpg  '), 'raro__nombre-.jpg', 'trim de espacios; "_" se conserva, "--" colapsa a "-"');
eq(r2.r2Slug('foto(1)[final]!.jpg'), 'foto-1-final-.jpg', 'caracteres inválidos → guion');
eq(r2.r2Slug('árbol.webp'), 'arbol.webp', 'acento inicial + webp');
eq(r2.r2Slug('IMG_1234.HEIC'), 'img_1234.heic', 'guion bajo y extensión heic');
eq(r2.r2Slug(''), 'foto', 'vacío → "foto"');
eq(r2.r2Slug('...'), 'foto', 'solo puntos → "foto" (no llave degenerada)');
eq(r2.r2Slug('中文.jpg'), 'jpg', 'nombre 100% no-ASCII: el trim inicial come el "." → queda "jpg" (determinista)');
ok(/^[a-z0-9\-_.]*$/.test(r2.r2Slug('Ünïçödé Ñame 2024!.JPG')), 'salida solo [a-z0-9-_.]');

console.log('\nr2Key — llave canónica <uuid>/<fileId>_<slug>');
eq(r2.r2Key('CAP-0042', '1AbcXYZ', 'Casa Bonita.JPG'), 'CAP-0042/1AbcXYZ_casa-bonita.jpg', 'forma completa');
ok(r2.r2Key('CAP-1', 'F1', 'x.jpg').startsWith('CAP-1/'), 'uuid es el prefijo de carpeta');
ok(r2.r2Key('CAP-1', 'F1', 'x.jpg').indexOf('F1_') !== -1, 'fileId antes del "_"');

console.log('\nDedup: mismo fileId → misma llave (nombre distinto no la cambia)');
eq(r2.r2Key('CAP-9', 'FID', 'primera.jpg'), r2.r2Key('CAP-9', 'FID', 'primera.jpg'), 'idéntica llave para mismos args');
ok(r2.r2Key('CAP-9', 'FID', 'A.jpg') !== r2.r2Key('CAP-9', 'FID', 'B.jpg'), 'distinto nombre → distinta llave (no colisiona en R2)');
ok(r2.r2Key('CAP-9', 'FID1', 'x.jpg') !== r2.r2Key('CAP-9', 'FID2', 'x.jpg'), 'distinto fileId → distinta llave');

console.log('\nNombres duplicados en la MISMA propiedad no se pisan (fileId distingue)');
var a = r2.r2Key('CAP-5', 'aaa', 'foto.jpg');
var b = r2.r2Key('CAP-5', 'bbb', 'foto.jpg');
ok(a !== b, 'dos "foto.jpg" con fileId distinto → llaves distintas');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.error('FALLOS: ' + failures.join(' | ')); process.exit(1); }
