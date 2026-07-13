# CIERRE TÉCNICO — Capturadora Hauser v1.0

**Fecha de cierre:** 13-jul-2026 · **Estado:** SELLADA · línea base estable · tag git `v1.0`

Este documento es autosuficiente: permite a cualquier IA o desarrollador futuro
entender el proyecto sin el historial de conversaciones. Para el detalle cronológico
de cambios, ver `CHANGELOG.md`; para la especificación de producto, `docs/PROMPT_MAESTRO_v0.5.md`
y `docs/spec_capturadora_v0.5.json`; para las reglas operativas vivas, `CLAUDE.md`.

---

## 1. Qué es

App **capturadora de propiedades** de la inmobiliaria Hauser / Inmobitera. Un asesor
en campo captura una propiedad (o un contacto) en el celular; la app genera un
**markdown canónico** que un agente de Notion inserta en la base 🏠 **Propiedades**,
y sincroniza capturas + fotos a un **Google Sheet + Drive** vía Google Apps Script (GAS).
Es la herramienta de entrada de datos de todo el pipeline inmobiliario (Notion →
sitio web → leads).

Diseño **mobile-first, estilo Duolingo** (mascota animada, colores vibrantes,
gamificación por estrellas y ranking de asesores).

---

## 2. Arquitectura

**Frontend estático** — HTML/CSS/JS vanilla, sin framework, servido por **GitHub Pages**.
- `index.html` — todas las vistas (SPA por `.view.active`) y modales. IDs referenciados
  desde `app.js` (validados por `tests/check_ids.js`).
- `app.js` — **un único IIFE** (`(function(){ … })();`). Toda la lógica: estado,
  navegación, timer, captura normal y rápida, generación de markdown, integración
  GAS/Drive, ranking, ficha, borrado, service worker registration. `APP_VER='v1.0'`.
  ⚠️ Si el IIFE crashea (p. ej. eliminar del DOM un elemento con listener activo),
  **muere toda la app**. Nunca quitar nodos con listeners sin remover el listener antes.
- `styles.css` — temas claro/oscuro por `[data-theme]`, variables CSS.
- `sw.js` — service worker (cache offline). `CACHE='capturador-v1.0'`.
  **Bumpear la key en CADA push** o el navegador sirve el build viejo.
- `manifest.json` — PWA.

**Backend** — Google Apps Script (`docs/GAS_v3_drive.gs`, **v3.7.1**) desplegado como
Web App `/exec`. Persiste en un **Google Sheet** (pestañas `Capturas` y `Markdowns`) y
en **Google Drive** (una carpeta por propiedad, dentro de `PARENT_FOLDER_ID`).
- Endpoint por defecto en `app.js` → `GAS_DEFAULT` (configurable en ⚙️ Configuración →
  "Endpoint"). Clave opcional `API_KEY` (hoy vacía = validación apagada).
- El GAS es de **despliegue manual del dueño** (pegar código → "Nueva versión";
  mismos scopes Drive+Sheets, no re-autoriza; el `/exec` no cambia).

**Destino final** — base Notion 🏠 **Propiedades** (Base ID
`be60a02b-18ff-838b-97ea-813e803d1c45`), alimentada por un agente que lee el markdown.
El sitio web y un bot de ChatGPT (9am) leen el Sheet.

```
[App PWA (Pages)] --markdown--> [agente Notion] --> [🏠 Propiedades]
       |  ^                                              |
       |  | GET capturas/asesores/fotos                  v
       +--+---- POST saveMarkdown/uploadFoto ----> [GAS /exec] --> [Sheet + Drive]
                                                        ^
                                       [bot 9am / sitio web leen Sheet]
```

---

## 3. Acciones del GAS v3.7.1

`doPost(e)` despacha por `body.action` (todas responden JSON `{ok, …}`):

| action | PIN | Qué hace |
|---|---|---|
| `ping` | no | Healthcheck → `"Hauser GAS v3.7.1 online"`. |
| `saveMarkdown` | no | Upsert por `uuid` en pestaña `Markdowns`; crea/reutiliza la carpeta Drive de la propiedad (`ensureDriveFolder_`); persiste `fotoUrl` (miniatura). Devuelve `folderUrl`. |
| `uploadFoto` | no | Sube una imagen (base64, comprimida ≤1920px JPEG por la app) a la carpeta Drive de la propiedad. Para iPhone, que no puede subir desde la web de Drive. Devuelve `{folderUrl, fotoUrl}`. |
| `getFoto` | no | Devuelve la foto de portada como **data URL base64** (`{dataUrl}`). La usa la ficha compartible para pintar la imagen sin CORS/canvas tainted. |
| `refreshFotos` | no | Recorre `Markdowns` con `folderUrl`, recalcula la miniatura (carpetas que recibieron fotos después de capturar) y actualiza `fotoUrl`. **Limpia** `fotoUrl` si la carpeta quedó sin fotos válidas (distingue vacía de error transitorio). La app lo dispara al abrir el historial (throttled). |
| `deleteCapture` | **1512** | Borra la fila de `Capturas` (por `id`) y la de `Markdowns` (por `uuid`). PIN validado en app **y** en GAS (doble seguro). **La carpeta Drive NO se toca** (puede tener fotos reales; se borra a mano si se desea). |
| `migrateMarkdowns` | — | Utilidad de migración de esquema (histórica). |
| `diag` | no | Radiografía de **solo lectura** del Sheet (pestañas, encabezados, conteo, anomalías fila por fila). Diagnóstico sin abrir el Sheet. |
| *(payload con `body.id`)* | no | `handleSaveCapture_`: upsert de captura plana en `Capturas`. |

`doGet(e)` → `{capturas:[hdr,…rows], asesores: buildAsesores_(…), fotos: {uuid:fotoUrl}}`.
El ranking de asesores se **deriva en cada GET** de `Capturas` (no se lee de disco).

`firstImageUrl_`: prefiere la primera imagen `image/*`; si no hay, cae al primer
`application/pdf` (Drive genera miniatura PNG de los PDF por el mismo endpoint
`/thumbnail`). Constantes clave: `PARENT_FOLDER_ID`, `API_KEY` (vacía), `DELETE_PIN='1512'`.

---

## 4. Mapa de datos (Sheet ↔ Notion)

### Sheet — pestañas vivas
Mapear columnas **SIEMPRE por nombre de encabezado, nunca por posición** (el GAS
agrega columnas al final). Leer **solo** `Capturas` y `Markdowns`. La pestaña
`Asesores` está **DEPRECATED** (renombrada `Asesores_DEPRECATED`, datos congelados;
el ranking real se deriva de `Capturas`). Las pestañas `Markdowns_backup_*` son
respaldos de migración (no parsear).

- **`Capturas`** — `id, timestamp, tipo, asesor, estrellas, calidad, propiedad_json,
  contacto_json, capturadoEn, modificadoEn`.
- **`Markdowns`** (canónico v3.4, minúsculas) — `uuid, fecha, asesor, tipo, estatus,
  nombre, direccion, markdown_md, folderUrl, modificadoEn, editadoPor, fotoUrl`.
  - **`asesor` = captador ORIGINAL, inmutable.** Quien edita queda en `editadoPor`.
    El GAS lo garantiza aunque un cliente viejo mande al editor como asesor.

### Notion — base 🏠 Propiedades
El markdown mapea al esquema canónico (fuente de verdad:
`docs/spec_capturadora_v0.5.json` → `notion_property_database.parameters`, 21+ props).
- **Título** = "Propiedad". Código condicional por tipo: `PROP-XX` (casa/depto),
  `TERR-XX` (terreno). **Excepción histórica: `PROP-3` es un terreno con código legado
  PROP- y NO se recodifica jamás.**
- **Estatus** default "En análisis"; pasa a "Captada" **solo con 3 estrellas**.
- **Relations** (Zona→Zonas, Propietario/Asesor→Contactos, Operaciones, Proyectos,
  Tareas) se referencian por nombre del registro; si no existe, el markdown instruye
  el alta previa (upsert) antes de vincular.
- **Selects** solo con opciones existentes; valor nuevo → instrucción explícita de
  crear la opción antes de asignar. Excepción: **"Amigo"** como Fuente se normaliza a
  **"Referido"** con nota del original (no es opción válida en la base).
- Campos sin dato → `"S/I"`; no aplicables → `"N/A"`. **Nunca "S/I" en campos numéricos**
  (numérico vacío + nota). Nunca inventar ni autocompletar.
- Campos nuevos (creados 01-jul-2026, nombres EXACTOS): `m² terreno indivisos`,
  `Tiene indivisos`, `Cuota de mantenimiento`, `Medios baños` ("Baños"=completos),
  `Comisión de venta`, `Carpeta Drive`, `UUID Captura`, `Fecha captura`,
  `Revisión duplicado`, `Observaciones captura`.
- Campos de terreno como propiedades reales (ya NO en Notas): `Uso de suelo`,
  `Estatus legal`, `Servicios disponibles`.
- `Estatus de captura` / `Estatus de propiedad` son tipo **Status**; `Operación` es
  **multi-select**; `Publicable` es **checkbox** (markdown: "Sí"=marcar / "No"=desmarcar).
- **Relación `Asesor` (→ 👥 Contactos)** = captador ORIGINAL. **El sitio web enruta
  leads con esta relación** → es crítica; en ediciones se usa `asesorNombre` original,
  nunca `editadoPor`.
- **Etapas de 🤝 Operaciones (7):** `Captación, Preparación, Ofertando, Publicada,
  Descartada, Comprada, Visita` (default). El markdown sugiere la etapa (Ofertando si
  hay comprador; Captación/Visita si recién se captó).

### Lista NEVER-WRITE
El markdown **NO** escribe estos campos (los calcula/gestiona Notion, el sitio o el
bot; escribirlos rompe la integración) — el markdown emite la lista como nota al agente:
`Precio/m²`, `Precio/m² (terreno)`, `Código`, `Lugar`, `Etiqueta comercial`,
`Fecha cambio estatus`, `Publicado en web`, `Fotos (URLs)`.

---

## 5. Flujos

1. **Captura normal** — Home → "Capturar propiedad" → selector de asesor ("¿Quién
   captura?") → formulario largo por secciones. Un **timer** corre (gamificación:
   más estrellas por rapidez y calidad). Al generar: se arma el markdown, se hace
   `POST saveMarkdown` (crea carpeta Drive + fila Markdowns), se suma la captura al
   ranking. Salir de la vista pausa el timer; editar NO corre el timer ni suma estrellas.

2. **Captura rápida** — mismo formulario en **slides estilo Duolingo** (`body.quick-mode`),
   mascota grande y timer como **barra de progreso**. Pensada para capturar en <60 s.
   Aislada del flujo normal (limpieza garantizada al entrar/salir). Genera el mismo
   markdown y usa el mismo `saveMarkdown`.

3. **Fotos** — tras capturar, la carpeta Drive existe vacía. El asesor sube fotos:
   Android desde la web de Drive; **iPhone desde la app** (`uploadFoto`, comprime
   ≤1920px JPEG). La miniatura (`fotoUrl`) aparece en el catálogo; `refreshFotos`
   (al abrir historial) actualiza/limpia miniaturas. Foto borrada en Drive → desaparece
   de la tarjeta.

4. **Ficha** — detalle de propiedad tipo ficha (portada vía `getFoto` base64, precio,
   dirección, sin markdown crudo). Exportable como **imagen compartible** y **vCard** del contacto.

5. **Borrado** — en el detalle, botón de borrar → PIN **1512** → `deleteCapture`
   (borra Capturas + Markdowns; carpeta Drive intacta) → recalcula el ranking local
   (resta estrellas) → animación de explosión (~3.8 s, en try/catch para que un fallo
   visual nunca bloquee el borrado).

**Regla de oro para tests:** NUNCA escribir al Sheet/Drive de **producción**. Los tests
de GAS/Drive usan siempre mocks (`test_gas.js` mockea `SpreadsheetApp/DriveApp/ContentService`;
`test_drive_app.js` intercepta `fetch`). Prohibido apuntar `CFG.endpoint` al endpoint real.

---

## 6. Validación (obligatoria antes de cada entrega)

1. `node --check app.js`
2. `node tests/check_ids.js` — IDs de `app.js` existen en `index.html` (o en HTML dinámico).
3. Suite jsdom: `tests/test_*.js` (24 archivos). Los de markdown leen `localStorage`
   con `w.localStorage.getItem()` directo. Node en `C:\Program Files\nodejs`; jsdom y
   puppeteer-core en `tests/node_modules`.
4. **Bumpear `sw.js` CACHE en CADA push.**
5. Verificación de render **real a 390px** con puppeteer-core (Chrome instalado) para
   cambios visuales — jsdom no basta.

Estado en el cierre: `node --check` OK · check_ids sin huérfanos · **24/24 tests verde** ·
screenshot real 390px del home confirmando `v1.0` y ausencia del FAB de DEV_FEEDBACK
(`docs/verificacion-v1.0/`).

---

## 7. Backlog v-next (roadmap posterior a v1.0)

**v1.1 — foto principal + performance + seguridad**
- Elegir/marcar la **foto principal** de la propiedad (hoy la portada es la primera imagen).
- **Performance:** carga del catálogo, throttling de `refreshFotos`, tamaño de `app.js`.
- **Seguridad GAS:** validar origen de las peticiones al `/exec` (activar `API_KEY`,
  CORS/origin allowlist).

**v1.2 — pipeline R2**
- Subir fotos también a **Cloudflare R2** para alimentar el campo `Fotos (URLs)` del
  sitio web (hoy NEVER-WRITE). `handleUploadFoto_` ya deja el gancho previsto; el
  contrato app↔GAS no cambia.

**v2 — plataforma**
- **Mascota vectorial** (reemplazar los MP4 sin alpha; hoy hay recuadro/chroma pendiente,
  autoplay iOS limitado).
- **Formulario público** de captación (leads externos).
- **Lector de anuncios** (parsear publicaciones y prellenar la captura).
- **Marketplace gamificado**.

**Deuda menor / diferidos** (ver "Pendientes v0.7" en `CLAUDE.md`): ranking con
paginación y filtros por fecha/asesor; verificar markdown multi-zonas con el agente
Notion; easter eggs por hitos; polish visual Duolingo completo.

---

*v1.0 sellada. El trabajo siguiente se planea en sesiones nuevas partiendo de esta base.*
