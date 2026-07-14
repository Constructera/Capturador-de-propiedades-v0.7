# Worker `hauser-fotos` — puente R2 de fotos

Espejo público de las fotos de las propiedades. El GAS v3.8 sube cada foto aquí
en segundos; el sitio web y el bot de Notion leen la URL pública de inmediato
(sin esperar las ~30 h que tarda Drive en hacer pública una imagen).

- **PUT `/f/<key>`** — sube (autenticado con el header `X-Hauser-Token`).
- **GET `/f/<key>`** — sirve la foto (público, sin token). Esto es lo que abre el navegador y consume el sitio.
- **HEAD `/f/<key>`** — verificación 200/404.
- **GET `/ping`** — `{ok:true, version:'r2-worker-1.0'}`.

Formato canónico de la llave (lo genera el GAS): `<uuid>/<fileId>_<slug>.jpg`
→ URL pública: `https://<tu-worker>.workers.dev/f/<uuid>/<fileId>_<slug>.jpg`

---

## A) Despliegue desde el DASHBOARD de Cloudflare (recomendado — sin npm)

### 1. Crear el bucket R2
1. Entra a <https://dash.cloudflare.com> → menú lateral **R2**.
2. La primera vez, Cloudflare pide activar R2 (plan gratuito incluye 10 GB; no pide tarjeta para empezar).
3. **Create bucket** → nombre exacto: **`hauser-fotos`** → Create.

### 2. Crear el Worker
1. Menú lateral **Workers & Pages** → **Create** → pestaña **Create Worker**.
2. Ponle un nombre (p. ej. `hauser-fotos`). Anota la URL que te asigna:
   `https://hauser-fotos.<tu-subdominio>.workers.dev`. **Esa URL la necesita el GAS.**
3. **Deploy** (despliega el código de ejemplo; lo vamos a reemplazar enseguida).
4. **Edit code** (`</>`): borra TODO el contenido del editor y pega el archivo
   **`worker.js`** completo de esta carpeta. **Save and deploy**.

### 3. Enlazar el bucket R2 al Worker (binding)
1. En el Worker → pestaña **Settings** → sección **Bindings** (o "Variables and Secrets" según versión del panel) → **Add binding**.
2. Tipo: **R2 bucket**.
3. **Variable name:** `BUCKET`  (mayúsculas, exacto — así lo llama `worker.js`).
4. **R2 bucket:** selecciona `hauser-fotos`.
5. Guarda / **Deploy**.

### 4. Agregar el Secret `HAUSER_TOKEN`
1. Mismo **Settings** → **Variables and Secrets** → **Add** → tipo **Secret**.
2. **Name:** `HAUSER_TOKEN`.
3. **Value:** inventa un token largo y aleatorio (p. ej. 32+ caracteres). **Guárdalo**:
   este MISMO valor va en la Script Property `R2_TOKEN` del GAS.
4. **Deploy**.

### 5. Verificar
1. En el navegador abre: `https://hauser-fotos.<tu-subdominio>.workers.dev/ping`
2. Debe responder: `{"ok":true,"version":"r2-worker-1.0"}`.
3. Listo. La subida real (PUT) la hará el GAS con el token; tú no necesitas probarla a mano.

> **Nota de seguridad:** el token viaja en cada PUT. Si alguna vez se filtra,
> genera uno nuevo en el Secret y actualiza `R2_TOKEN` en el GAS — nada más.

---

## B) Alternativa por CLI con wrangler (opcional, si tienes npm)

```bash
# 1. Instala wrangler (una vez)
npm install -g wrangler

# 2. Inicia sesión en Cloudflare
wrangler login

# 3. Crea el bucket (si no existe)
wrangler r2 bucket create hauser-fotos

# 4. Define el secret (te lo pide interactivamente)
wrangler secret put HAUSER_TOKEN

# 5. Despliega (usa el wrangler.toml de esta carpeta)
wrangler deploy

# 6. Verifica
#    abre https://hauser-fotos.<subdominio>.workers.dev/ping
```

El `wrangler.toml` ya trae `name`, `main`, `compatibility_date` y el binding
`BUCKET → hauser-fotos`. El secret NO se guarda en el toml (es secreto).

---

## Migración futura a dominio propio (`fotos.hauser.mx`)
En el Worker → **Settings → Domains & Routes → Add → Custom Domain**. Al cambiar
el host, las URLs pasan de `.../f/<key>` a `https://fotos.hauser.mx/f/<key>`:
cambia **solo el host**, el path `<uuid>/<fileId>_<slug>.jpg` es idéntico. En el
GAS basta actualizar la Script Property `R2_WORKER_URL`.
