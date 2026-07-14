/**
 * Cloudflare Worker — Puente R2 de fotos Hauser (r2-worker-1.0)
 * =============================================================
 * Espejo público de las fotos que hoy viven en Google Drive. El GAS v3.8 sube
 * cada foto aquí en segundos (PUT autenticado) y el sitio web / bot de Notion
 * consumen la URL pública (GET sin token) de inmediato, sin esperar las ~30h que
 * tarda Drive en volver pública una imagen.
 *
 * Rutas:
 *   PUT  /f/<key...>  → sube bytes de imagen. Exige header X-Hauser-Token.
 *                       head(key) primero: si ya existe → {ok,skipped:true}.
 *   GET  /f/<key...>  → PÚBLICO. Sirve el objeto (Content-Type/Cache-Control/ETag).
 *                       Soporta If-None-Match → 304. 404 si no existe.
 *   HEAD /f/<key...>  → PÚBLICO. Verificación 200/404 (sin cuerpo).
 *   GET  /ping        → {ok:true, version:'r2-worker-1.0'}.
 *
 * Bindings (se configuran en el Dashboard de Cloudflare — ver README.md):
 *   BUCKET       → R2 bucket real "hauser-fotos".
 *   HAUSER_TOKEN → Secret; debe coincidir con el header X-Hauser-Token del PUT.
 *
 * Llave canónica (la genera el GAS): <uuid>/<fileId>_<slug>.jpg
 *   - <uuid>   = CAP-XXXX (carpeta lógica de la propiedad, NO el Código de Notion).
 *   - <fileId> = id del archivo en Drive → dedup intrínseca (misma foto, misma llave).
 * Migrar a dominio propio (fotos.hauser.mx) cambia SOLO el host, nunca el path.
 */

const VERSION = 'r2-worker-1.0';
const IMMUTABLE = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Healthcheck
    if (path === '/ping') {
      return json({ ok: true, version: VERSION });
    }

    // Todo lo demás cuelga de /f/<key...>
    if (path === '/f/' || !path.startsWith('/f/')) {
      return json({ ok: false, error: 'ruta no encontrada' }, 404);
    }

    // La llave es todo lo que sigue a "/f/". Se decodifica (el GAS la envía con
    // encodeURI, así que espacios u otros caracteres llegan escapados).
    const rawKey = path.slice('/f/'.length);
    let key;
    try {
      key = decodeURIComponent(rawKey);
    } catch (_e) {
      key = rawKey;
    }
    if (!key) return json({ ok: false, error: 'llave vacía' }, 400);

    const publicUrl = url.origin + '/f/' + encodeURI(key);

    if (request.method === 'PUT') {
      return handlePut(request, env, key, publicUrl);
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      return handleGetOrHead(request, env, key);
    }
    if (request.method === 'OPTIONS') {
      // Preflight CORS (por si algún cliente hace fetch con headers custom).
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    return json({ ok: false, error: 'método no permitido' }, 405);
  },
};

/* ---------- PUT: subida autenticada ---------- */
async function handlePut(request, env, key, publicUrl) {
  const token = request.headers.get('X-Hauser-Token') || '';
  if (!env.HAUSER_TOKEN || token !== env.HAUSER_TOKEN) {
    return json({ ok: false, error: 'no autorizado' }, 401);
  }

  // Dedup intrínseca: si la llave ya existe, no re-subimos (mismo fileId de Drive).
  const existing = await env.BUCKET.head(key);
  if (existing) {
    return json({ ok: true, skipped: true, key, url: publicUrl });
  }

  const contentType = request.headers.get('Content-Type') || 'image/jpeg';
  const body = await request.arrayBuffer();
  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType, cacheControl: IMMUTABLE },
  });
  return json({ ok: true, skipped: false, key, url: publicUrl });
}

/* ---------- GET / HEAD: lectura pública ---------- */
async function handleGetOrHead(request, env, key) {
  const object = await env.BUCKET.get(key);
  if (!object) {
    return new Response(request.method === 'HEAD' ? null : 'not found', {
      status: 404,
      headers: corsHeaders(),
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers); // Content-Type, Cache-Control desde el objeto
  headers.set('ETag', object.httpEtag);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', IMMUTABLE);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);

  // If-None-Match → 304 (ahorra ancho de banda a sitio web y bots).
  const inm = request.headers.get('If-None-Match');
  if (inm && inm === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  if (request.method === 'HEAD') {
    if (object.size != null) headers.set('Content-Length', String(object.size));
    return new Response(null, { status: 200, headers });
  }
  return new Response(object.body, { status: 200, headers });
}

/* ---------- utilidades ---------- */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'If-None-Match, Content-Type',
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      corsHeaders()
    ),
  });
}
