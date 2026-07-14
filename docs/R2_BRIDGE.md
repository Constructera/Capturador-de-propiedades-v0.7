# Puente R2 de fotos — Fase 1 (v1.1)

Objetivo: que cada foto que sube el asesor quede con **URL pública en segundos**,
sin cambiar el flujo actual de la app. Hoy las fotos viven en Drive y tardan hasta
**~30 h** en volverse públicas para el sitio. R2 es un **espejo** de latencia cero;
**Drive sigue siendo el destino primario**. Si R2 falla, `uploadFoto` **no falla**:
la entrada queda `pending` y la repara el reconciliador.

Todo es **aditivo**: front sin tocar, GAS de producción sin tocar. El GAS v3.8 es
una **copia de staging** (`docs/GAS_v3_8_r2.gs`) que se despliega como proyecto
GAS separado, apuntando al **mismo** Sheet y a la **misma** carpeta madre de Drive.

---

## Flujo de datos

```
                       ┌─────────────────────────────────────────────┐
   Asesor (app v1.0)   │  POST uploadFoto {uuid, dataBase64, ...}     │
        │              │  (la app NO cambia: consume la misma resp.)  │
        ▼              └─────────────────────────────────────────────┘
   GAS v3.8 (staging /exec)
        │
        ├─► Drive  (PRIMARIO) ── createFile en carpeta de la propiedad (por uuid)
        │
        └─► R2     (ESPEJO)   ── PUT /f/<uuid>/<fileId>_<slug>.jpg   [latencia cero]
                │                     │ ok      → fotosR2 += url ; manifest status:'ok'
                │                     │ falla   → manifest status:'pending' (no rompe)
                ▼
   Sheet "Markdowns"  ── columnas nuevas al final: fotosR2 (CSV) · fotosManifest (JSON)
        │
        ▼
   Bot ChatGPT 9am  ── lee fotosR2 del Sheet y escribe "Fotos (URLs)" en Notion
        │              (la Capturadora NUNCA escribe ese campo; es NEVER-WRITE)
        ▼
   Notion 🏠 Propiedades ──► Sitio web (consume las URLs públicas de R2)

   Reconciliador (trigger 6h, opcional): reintenta 'pending' + filas <24h.
   Backfill (manual): sube a R2 lo que ya está en Drive (histórico).
```

---

## Formato canónico de la URL pública  ⚠️ lo consume el chat de Página Web

```
<WORKER_HOST>/f/<uuid>/<fileId>_<slug>.jpg
```

- `<WORKER_HOST>` — p. ej. `https://hauser-fotos.<sub>.workers.dev`.
- `<uuid>` — el UUID de la captura, tipo **CAP-XXXX** (carpeta lógica). **NO** es el
  Código de Notion (PROP-/TERR-).
- `<fileId>` — id del archivo en Drive. Da **dedup intrínseca**: la misma foto
  siempre produce la misma llave; si ya existe en R2, no se re-sube.
- `<slug>` — nombre de archivo normalizado: minúsculas, sin acentos, solo
  `[a-z0-9-_.]`, extensión preservada.

**Migrar a dominio propio** (`fotos.hauser.mx`) cambia **SOLO el host**, jamás el
path. En el GAS basta actualizar la Script Property `R2_WORKER_URL`.

Ejemplo real:
`https://hauser-fotos.abc.workers.dev/f/CAP-0042/1AbcXYZ_casa-bonita.jpg`

---

## Script Properties requeridas (GAS de staging)

Configuración del proyecto → **Propiedades de la secuencia de comandos**:

| Propiedad       | Valor                                             |
|-----------------|---------------------------------------------------|
| `R2_WORKER_URL` | URL del Worker, sin `/` final (`https://…workers.dev`) |
| `R2_TOKEN`      | mismo valor que el Secret `HAUSER_TOKEN` del Worker |
| `R2_ENABLED`    | `true` para activar el puente (cualquier otra cosa = inerte) |

Con `R2_ENABLED != 'true'` el GAS se comporta **exactamente** como v3.7.1.

---

## Columnas nuevas en "Markdowns" (al final, por nombre)

- **`fotosR2`** — CSV de URLs públicas `ok`, en orden de subida.
- **`fotosManifest`** — JSON: array de
  `{fileId, key, url, name, bytes, status:'ok'|'pending', ts}`.

Se autocrean con `ensureColumns_` / `ensureCols_`. Se leen y escriben **por nombre
de encabezado, nunca por posición**. Upsert por **UUID**.

---

## Prueba end-to-end con 1 propiedad

1. Despliega el Worker (ver `r2-worker/README.md`) y verifica `/ping`.
2. Crea el proyecto GAS de staging con `docs/GAS_v3_8_r2.gs` y las 3 Script Properties.
3. `GET <exec-staging>?action=ping` → debe traer `version:"3.8.0"` y
   `r2.workerReachable:true`.
4. **Dry run** (no sube nada), con un uuid real:
   `GET <exec-staging>?action=backfillFotosR2&uuid=CAP-XXXX&dryRun=true`
   → revisa `subidas`/`saltadas`/`errores`.
5. **Real**: la misma URL sin `dryRun`:
   `GET <exec-staging>?action=backfillFotosR2&uuid=CAP-XXXX`
6. Abre en el navegador una URL de `fotosR2` (columna del Sheet o campo `url` del
   manifest): debe **mostrar la foto**.
7. (Opcional) Sube una foto nueva desde la app apuntando al `/exec` de staging: la
   respuesta trae `r2Url` no nulo y la foto abre de inmediato.

## Reconciliador (trigger de 6 h) — se crea A MANO, DESPUÉS de la prueba

En el editor del GAS de staging: **Activadores** (⏰) → **Añadir activador** →
función `reconcileFotosR2`, origen **Basado en tiempo** → **Temporizador por
horas** → **Cada 6 horas**. Reintenta `pending` y filas modificadas <24 h; solo
escribe en Logger; **no borra nada**. **No** lo crees hasta validar el flujo.

---

## Contratos que NO se rompen

- `propiedad_json` es la fuente de verdad; el markdown es apoyo humano.
- Llave primaria = **UUID**. Columnas del Sheet por **nombre**, nunca por posición.
- La Capturadora **NUNCA** escribe `Fotos (URLs)` de Notion (ni los otros 7
  never-write). Solo deja las URLs en el Sheet; ese campo lo escribe el bot.
- La respuesta de `uploadFoto` conserva su forma; solo **AÑADE** `r2Url` (o `null`).
- Los tests **nunca** escriben a producción (`tests/test_r2_key.js` es puro, sin red).
