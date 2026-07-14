/**
 * Espejo testeable de los helpers de llave R2 del GAS v3.8 (docs/GAS_v3_8_r2.gs).
 *
 * NO se importa dentro del GAS (Apps Script no usa require). Es una copia FIEL de
 * r2Slug_ y r2Key_ para poder aserverlos sin red y sin tocar producción. Si se
 * cambia la lógica en el GAS, cambiar aquí también (test_r2_key.js lo vigila).
 */

/* minúsculas, sin acentos, solo [a-z0-9-_.], extensión preservada. */
function r2Slug(filename) {
  var s = String(filename || 'foto')
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\-_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return s || 'foto';
}

/* Llave canónica: <uuid>/<fileId>_<slug>. */
function r2Key(uuid, fileId, filename) {
  return String(uuid) + '/' + String(fileId) + '_' + r2Slug(filename);
}

module.exports = { r2Slug: r2Slug, r2Key: r2Key };
