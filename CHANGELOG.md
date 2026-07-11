# CHANGELOG — Capturadora Hauser

Historial de versiones y fases de desarrollo del capturador de propiedades Hauser / Inmobitera.

---

## v0.7.1 (en desarrollo) — correcciones post-testing + coordinación sitio web / bot Notion

### r21 (11-jul-2026) — T1/T2 (navbar en "¿Quién captura?", barra en modo normal) + F4 recalibrada
Confirmado por el dueño en dispositivo real: P1/P2/Q2/C2/A2 de r20 quedaron bien.
- **T1 — navbar oculto en "¿Quién captura?" (viewAdvisor):** esta pantalla es paso
  previo a AMBOS flujos (normal y rápida) y el navbar no debe verse ahí. En E2 (r20)
  solo se verificó que no hubiera overlap; ahora el dueño pide ocultarlo. Mismo
  patrón que `body.capture-active`: clase `advisor-active` en showView + CSS
  `body.advisor-active .navbar{display:none!important}`. La CTA sticky baja al
  fondo real (`bottom:0` + safe-area) y el body pierde el padding del navbar.
  Verificado en render real 390px: bodyClass=advisor-active, navbar display:none,
  CTA bottom=844 (borde de pantalla).
- **T2 — barra de progreso cortada en modo NORMAL:** mismo patrón que P1/P2 pero en
  el flujo tradicional: `.timer-widget.running .timer-top` (mascota fija en esquina
  sup-der, 96px + 1rem, z100) tapaba el extremo derecho de la barra de progreso
  (sticky z10, ancho completo). Fix quirúrgico sin tocar la mascota de la esquina
  (ese diseño es correcto en modo normal): `body:not(.quick-mode)
  .timer-widget.running+.progress-wrap{padding-right:122px}` — la barra termina
  antes de la columna de la mascota SOLO mientras el timer corre y SOLO fuera del
  modo rápido. Verificado en render real: barra right=248 vs mascota left=276.
- **F4 — explosión recalibrada (~3.8 s) según feedback:** (1) FUERA el shake visual
  sostenido de 3 escalones (se veía mal) → queda UNA sacudida sutil de ±4px/0.45s
  solo al detonar; (2) vibración FÍSICA del teléfono: tick de 30ms al armar +
  navigator.vibrate([420,90,180,80,120,70,80]) al detonar (golpe largo + réplicas
  decrecientes; Android/Chrome — iOS Safari no soporta vibrate); (3) FLASH AMARILLO
  cegador de pantalla completa (radial #fffde7→#ffee58→#ffc400, 950ms) + resplandor
  amarillo-naranja que persiste ~3s; (4) "¡ELIMINADA!" más grande (2.7rem, glow
  ámbar) sostenido de ~0.8s a ~3.4s. Hongo ☢️, 4 ondas, 💥 y escombros con física
  (2 oleadas) se mantienen; humo más breve. Limpieza total a los 3.8s. Sigue en
  try/catch.
- SW `capturador-v0.7.1-r21` · APP_VER `v0.7.1-r21`. Suite completa verde.

### r20 (10-jul-2026) — P1/P2 causa raíz real (cascada CSS), Q2/C2, A2, F3, U1–U3
**Contexto:** P1/P2/P3/Q1/C-CRM se habían reportado "resueltos" 2-3 veces y seguían mal
en el celular. PASO 0 verificado: Pages SÍ servía el build r19 (SW key en producción =
commit) → el problema NO era el deploy, era que los fixes no funcionaban de verdad.
Esta ronda se verificó con Chrome REAL a 390px (puppeteer-core manejando el Chrome
instalado), no solo jsdom.
- **P1/P2 — CAUSA RAÍZ (la regla vieja que nunca se quitó):** `.timer-widget.running
  .timer-top` (styles.css, bloque RUNNING) pone `position:fixed;top:1rem;right:1rem;
  width:96px;z-index:100`. En modo rápido el timer SIEMPRE corre → `.running` activo →
  esa regla (especificidad 0,3,0) le GANABA al fix `body.quick-mode .timer-top` (0,2,1):
  la mascota de 150px quedaba clavada en la esquina sup. derecha dentro de una caja
  fija de 96px, saliéndose de la pantalla (right=435 con viewport de 390 — medido en
  producción r19), y las barras quedaban despegadas arriba. Fix: selector
  `body.quick-mode .timer-widget.running .timer-top` (0,4,1) que neutraliza position/
  width/fondo/borde/sombra. Verificado en render real: mascota centrada (x 120–270),
  en flujo, barras integradas debajo, sin scroll horizontal.
- **P3 — navbar en modo rápido: NO reproducible en r19.** Verificado en el DOM real de
  producción: `body.quick-mode` se aplica y `.navbar` queda `display:none`. Si en el
  celular se sigue viendo, es SW/caché viejo del dispositivo (cerrar todas las pestañas
  de la app o "Borrar datos del sitio" y recargar).
- **E2 — navbar en viewAdvisor: NO reproducible en r19.** En render real el navbar está
  visible (top 788) y la barra `.advisor-cta` (sticky, z51) termina exactamente donde
  empieza el navbar, sin taparlo ni ocultarlo. No se tocó nada.
- **Q2+C2 — "Personas involucradas" en UNA slide:** los `<h2>` "¿Quién ofrece la
  propiedad?" y "Personas involucradas / CRM" eran hijos directos de #viewCapture, y
  cada hijo directo = slide en qkCollectSlides → seguían siendo 3-5 pasos. Ahora hay UN
  `<h2>Personas involucradas</h2>` + un `.qk-group` que envuelve ofreceChips + crmChips
  + btnPickContact + crmCards → una sola slide con los 3 bloques (verificado: 27→23
  slides; screenshot muestra todo junto). En captura normal se ve igual que antes
  (el .qk-group no tiene CSS).
- **A2 — timer ya no se reinicia al completar faltantes:** generate() llamaba
  `resetTimerToReady()` → el timer quedaba en 10:00 fresco. Nueva `stopTimerFinished()`:
  detiene conservando el tiempo restante y `_timerAutoPaused=false` evita que
  timerAutoResume() lo reanude al entrar a "completar faltantes". El reset a fresco
  queda SOLO al empezar captura nueva (doReset/btnEmpezarCaptura/qkStart).
  test_timer.js T4 actualizado al comportamiento nuevo (17/17).
- **F3 — explosión ~5 s con más drama:** fases carga → destello cegador → onda
  expansiva (4 anillos) → hongo grande → lluvia de escombros en 2 oleadas con física
  rAF → humo que se disipa. Sacudida de pantalla intensa y SOSTENIDA en 3 escalones
  decrecientes (~3.9 s total, clases `.nuke-shake`→`-mid`→`-soft` con animación
  infinita retirada por tiempo) + `navigator.vibrate` largo. Sigue llamada en
  try/catch y limpieza garantizada a los 5 s.
- **U1 — dirección: identificación rápida de calles (tipo wiggot):** ahora Photon
  (komoot, gratis) como buscador primario — autocomplete real de prefijos con sesgo a
  Cuernavaca — y Nominatim como fallback, ahora con `addressdetails=1` (sin él,
  `it.address` llegaba vacío y la zona NUNCA se autollenaba desde sugerencias),
  limit 8 y sin duplicar la ciudad si ya la escribiste. Mínimo 3 letras (antes 5),
  debounce 250 ms, caché de sesión y guard anti-respuestas fuera de orden.
- **U2 — características:** fuera "Cocina americana" y "Baño en suite" de la lista
  rápida de casa (pedido del dueño). Los alias de anuncios siguen normalizando.
- **U3 — botón Siguiente encima del modal de contacto (escritorio):** `.overlay`
  tenía z-index 100 y la barra del modo rápido `.qk-nav` 300 → el Siguiente se pintaba
  ENCIMA del modal de persona. Overlay ahora z-index 340 (verificado en render real:
  el modal tapa la barra).
- SW `capturador-v0.7.1-r20` · APP_VER `v0.7.1-r20`. Suite completa verde
  (75+17+37+40+22+5+131+27 + check_ids).

### Bloques A–D (07-jul-2026) — push, diagnóstico fotos, tema claro
- **A — push de v0.7.1:** las 8 fases estaban commiteadas pero SIN pushear (por eso el dueño no las veía en el celular). Pusheadas a `origin/main`. SW final del empuje: `v0.7.1-r9`.
- **B — fotos de Drive: causa raíz REAL.** GAS v3.6 funciona correctamente (verificado con GET/POST reales): `firstImageUrl_` detecta el JPG de "Burgos amigo de Paco", persiste `fotoUrl` y el GET devuelve `fotos:{uuid:thumbnail}`; la miniatura es pública (curl anónimo → 200 image/jpeg). La foto NO aparecía porque **la app en Pages era la versión vieja (B7): no lee `data.fotos` ni dispara `refreshFotos`**. Además `refreshFotos` nunca había corrido, así que la columna estaba vacía (se pobló al dispararlo). **Fix = desplegar v0.7.1 (Bloque A).** El frontend (Fase -1) ya fusiona `data.fotos` y dispara `refreshFotos` (throttle 5 min) al abrir historial. `gasPost` usa `fetch` POST (el navegador sigue el redirect de Apps Script bien; el problema de "POST pierde el body" era solo de curl con `-L`). Test de regresión: `tests/test_fotos.js` (6 asserts: render de `<img>` desde `data.fotos`, disparo de refreshFotos con carpeta sin foto, throttle). **Drive:** el archivo de Burgos ya es accesible sin login; si una foto NO carga, verificar en Drive que el archivo tenga permiso "Cualquiera con el enlace (Lector)".
- **C — botón "Captura Rápida" invisible en light mode:** el selector `.home-card[class*="hc-"] .home-label/.home-icon{color:#fff}` pintaba el texto de blanco para todas las tarjetas hc-*, pero `hc-quick` solo tenía fondo naranja en dark → en light quedaba texto blanco sobre fondo claro (invisible). Fix: fondo naranja en AMBOS temas (como hc-property/hc-contact). Revisados los demás componentes con `#fff`: todos tienen override dark correcto; hc-quick era el único roto. Verificado visualmente en Edge (light).
- **D — recordatorio:** TODO de eliminar DEV_FEEDBACK antes del release documentado al inicio de CLAUDE.md (sigue activo por pedido del dueño).

### Fase -1 (06-jul-2026) — la foto Drive del catálogo por fin aparece (GAS v3.6)
**Diagnóstico end-to-end (sin asumir nada):**
1. Ping real al endpoint: respondía "Hauser GAS v3.5 online" → el despliegue del dueño estaba BIEN.
2. saveMarkdown real re-enviado para Casa Paridad (carpeta con archivos): `fotoUrl:""` → el bug estaba en el GAS, no en el despliegue ni en el frontend.
3. Inspección de las carpetas reales: la de Casa Paridad contiene SOLO `Archivo_escaneado_20260705-1351.pdf` (mimeType `application/pdf`, que `firstImageUrl_` descartaba por filtrar solo `image/*`); la de Casa 87 está VACÍA.
4. Defecto de diseño de v3.5: `fotoUrl` solo se calculaba al generar el markdown (carpeta recién creada = vacía; las fotos se suben DESPUÉS), no se persistía en el Sheet y el GET no lo devolvía → aunque hubiera JPGs, la foto solo aparecía si se editaba y regeneraba la captura después de subir fotos.

**Fix (GAS v3.6 + app.js):**
- `firstImageUrl_` acepta `application/pdf` como fallback (Drive genera miniatura PNG de los PDF con el mismo endpoint `/thumbnail` — verificado con curl: 200, image/png 640×841). Las imágenes `image/*` siguen teniendo prioridad.
- Columna nueva `fotoUrl` en Markdowns (autocreada al final; mapear por nombre). saveMarkdown la persiste; recálculo vacío no pisa una miniatura previa buena.
- GET devuelve `fotos:{uuid:fotoUrl}` leído del Sheet (0 llamadas a Drive).
- Nueva action `refreshFotos`: recalcula miniaturas de filas con folderUrl (carpetas que recibieron fotos tarde) y actualiza el Sheet. La app la dispara al abrir el historial si hay registros con carpeta y sin foto (throttle 5 min, `cap_fotos_refresh_ts`).
- app.js: el mapa `fotos` del GET manda sobre el `fotoUrl` viejo de `propiedad_json`.
- **Tests:** G12 en `test_gas.js` (+11 asserts: persistencia, PDF fallback, prioridad imagen, refresh idempotente, GET, docx ignorado). GAS: 106/106.
- **⚠️ Acción del dueño:** pegar GAS v3.6 y "Nueva versión" (mismos scopes, NO pide re-autorizar). SW: `v0.7.1-F1-r1`.

### Fase 6 (06-jul-2026) — catálogo y ficha compartible
- **6a — legibilidad de las tarjetas:** nombre de la propiedad más grande y con más peso (1.08rem/800), resumen tipo·operación·zona en color suave, specs 🛏🛁📐🌱 más grandes (0.92rem/600). (Iteración fina pendiente del feedback del dueño vía la herramienta de la Fase 0.)
- **6b — ficha técnica como imagen compartible:** nuevo botón **"🖼 Compartir ficha"** en cada tarjeta de propiedad. Renderiza en `canvas` (1080×1350) una ficha con foto (o ícono del tipo), precio grande, nombre, tipo·operación·zona, recámaras/baños/m², top-4 características y el asesor, y la comparte con **Web Share API adjuntando el PNG** (share sheet nativo → WhatsApp, etc.); sin soporte cae a descarga del PNG con toast. La foto de Drive se intenta con `crossOrigin='anonymous'` (si Drive no manda CORS, `onerror` → hero con gradiente+emoji, el canvas no queda *tainted* y `toBlob` funciona). Tests: `tests/test_ficha.js` (11 asserts, canvas/share stubeados) + verificación visual real (`docs/verificacion-v0.7.1/F6-ficha-tecnica.png`). SW: `v0.7.1-r8`.

### Fase 5 (06-jul-2026) — markdown v0.7.1 (coordinación sitio web + bot Notion)
- **5a — relación "Asesor" (CRÍTICO):** el markdown ahora emite `| Asesor | Relación → 👥 Contactos | <asesor> |` con el captador (Erica/Carlos/Daniel/Gabriel ya existen). En ediciones usa el asesor **original** (`asesorNombre`), nunca `editadoPor`. **El sitio web enruta leads con esta relación.**
- **5b — lista NEVER-WRITE ampliada:** el markdown emite una nota ⛔ al agente con los 8 campos que NO debe escribir (los calcula Notion/el sitio/el bot): Precio/m², Precio/m² (terreno), Código, Lugar, Etiqueta comercial, Fecha cambio estatus, Publicado en web, Fotos (URLs). Documentado también en CLAUDE.md.
- **5c — "Publicable" es Checkbox:** el markdown lo emite como `Checkbox` con "Sí"=marcar / "No"=desmarcar (antes se trataba como select).
- **5d — Fuente "Amigo":** al no existir en el select de Notion, la nota instruye normalizar a "Referido" (el bot ya lo maneja así) conservando el original; otras fuentes nuevas mantienen la mecánica "OPCIÓN NUEVA".
- **5e — etapas de Operaciones:** el markdown usa el vocabulario real de los 7 estados (Captación, Preparación, Ofertando, Publicada, Descartada, Comprada, Visita=default): Ofertando si hay comprador, Captación/Visita si recién se captó.
- Tests: +8 asserts en `test_markdown.js` (fila Asesor, checkbox Publicable, Amigo→Referido, 8 never-write, 7 etapas, asesor original en edición). Paridad byte a byte preservada. SW: `v0.7.1-r7`.

### Fase 4 (06-jul-2026) — home y contactos
- **4a — CTAs siempre visibles:** en el selector de asesor, "+ Agregar asesor" y "Empezar captura →" viven ahora en una barra `sticky bottom` (`.advisor-cta`), visibles sin scroll aunque la lista de asesores crezca.
- **4b — aire al picker:** "📇 Elegir de mis contactos" pasó de `margin-bottom:8px` a `margin:14px 0 8px` (ya no se encima con lo de arriba), en CRM y en captura de contacto.
- **4c — fallback iOS del Contact Picker:** verificado que la Contact Picker API sigue **sin soporte en Safari iOS/iPadOS** (solo Chrome/Android sobre HTTPS). Detección de plataforma (`_isIOS`, contempla iPadOS 13+ que se hace pasar por Mac): en iOS se muestra una **nota clara** ("En iPhone/iPad no se pueden importar contactos… escribe el nombre y teléfono abajo") en vez de un botón muerto; en desktop sin soporte los botones siguen ocultos en silencio; con soporte aparecen normal. Tests: `tests/test_home.js` (12 asserts). SW: `v0.7.1-r6`.

### Fase 3 (06-jul-2026) — características estilo Wiggot
- **Se reemplazó la nube de chips (que "mareaba" al reflowear) por una LISTA:** una característica por fila, botón ancho con **checkbox** al final. Se muestran ~12 (rango 10-15).
- **Al marcar:** la fila se pone verde con ✓ y **se reemplaza EN SITIO** por la siguiente característica oculta — las demás filas NO se recorren (posición estable, sin salto visual). Si se agota el pool, la fila se retira sin reemplazo.
- **Debajo de la lista:** "Ver más" (expande a todas), "↻ Refrescar" (baraja las no seleccionadas) y el cuadro de texto con "+" para agregar una nueva (persistente).
- **Las seleccionadas viven HASTA ABAJO** bajo el rótulo "Seleccionadas" (tags con ✕), para que elegir no mueva la lista. Quitar una la regresa al pool.
- Mismo tratamiento para las características de terreno (sección aparte). El markdown y la persistencia (`cap_caractCustom`) no cambian. Tests: `tests/test_caract.js` (16 asserts) + selectores actualizados en `test_markdown.js`. Verificado visualmente (`docs/verificacion-v0.7.1/F3-caracteristicas-wiggot.png`). SW: `v0.7.1-r5`.

### Fase 2 (06-jul-2026) — UX de Captura Rápida
- **2a — se llenó el hueco del header:** en modo rápido el timer deja de ser anillo y pasa a **barra de progreso** (se rellena con lo transcurrido; verde→ámbar→rojo según urgencia, con el tiempo restante encima), y la **mascota crece a 150px** ocupando el espacio donde estaban casita+timer. El anillo se oculta; composición sin scroll vertical. Fix de layout: la mascota se salía a la derecha (el canvas chroma es `position:absolute; inset:0` y su wrap no tenía ancho) → caja fija 150px/70vw centrada, y `overflow-x:hidden` en `body.quick-mode` como garantía anti-scroll. Verificado en Edge real (`docs/verificacion-v0.7.1/F2-modo-rapido-barra-timer.png`).
- **2b — slide de zona:** ARRIBA el cuadro de texto con botón **+** para escribir/agregar la zona; DEBAJO las zonas comunes como chips (antes al revés). Aplica a ambos modos (mismo DOM, listeners intactos).
- **2c — borrador + "¿Continuar captura?":** botón **← Menú (guarda borrador)** en la barra rápida guarda un snapshot del formulario al volver al menú (también al salir por navbar/← Menú en modo normal). Al reentrar a CUALQUIER modo de captura aparece la tarjeta **"Tienes una captura sin terminar"** con un botón grande **▶ Continuar captura** (muestra nombre · tipo · precio · cuándo) y uno chico **Empezar una nueva** (descarta). Continuar restaura los datos y reanuda el modo del borrador (rápido si aplica). Editar NO genera borrador; generar lo limpia. Tests: `tests/test_draft.js` (22 asserts) + `tests/test_quick_exit.js` (40).
- SW: `v0.7.1-r4`.

### Fase 1 (06-jul-2026) — bugs críticos
- **1a — el modo rápido se filtraba a la captura normal y a la edición:** el aislamiento dependía de flags JS (`qkOn`) y del atributo `hidden`, que se desincronizaban; `.qk-nav` tenía `display:flex` fijo que pisaba a `[hidden]`. Ahora **`body.quick-mode` es la ÚNICA fuente de verdad**: `.qk-nav` base es `display:none` y solo `body.quick-mode .qk-nav` la muestra. `qkStop()` es idempotente (sin early-return por flag: repara aunque el estado se corrompa) y `showView` lo llama en CUALQUIER navegación que no entre al modo rápido → limpieza garantizada por las 4 rutas (guardar, salir, editar, navegar). Tests: `tests/test_quick_exit.js` (40 asserts, las 4 rutas + captura normal + estado corrupto).
- **1b — limpieza de pruebas en producción:** borradas las 9 capturas "Casa Paridad" de prueba del Sheet real vía `deleteCapture` (PIN 1512), verificadas uuid por uuid antes (todas de Daniel, dir. "Av. Paridad 123", 04-jul). Quedan 11 capturas reales intactas. **Regla nueva en CLAUDE.md (validación #7):** los tests NUNCA escriben al Sheet/Drive de producción (mocks o staging).
- **1c — botón del modal PIN:** decía "Borrar definitivamente" y se desbordaba → ahora solo **"Borrar"**, texto negro sobre rojo pleno (`#e53935`), + **explosión** al confirmar (burst de escala + 10 partículas CSS radiales + vibración). El cierre del modal se retrasa ~420 ms para que se vea la animación (el borrado ocurre igual, síncrono).
- **1d — vCard roto en Android/Chrome:** el `catch` vacío del `navigator.share` se tragaba el fallo y "no pasaba nada". Ahora si `share` rechaza por algo que no sea `AbortError` (usuario canceló) cae a **descarga del blob `text/vcard`** con un **toast** de confirmación ("ábrelo para añadir el contacto"). `canShare` también prueba `text/x-vcard`.
- SW: `v0.7.1-r3`.

### Fase 0 (06-jul-2026) — herramienta de feedback dev (TEMPORAL)
- **Long-press de 5 s** (constante `DEVFB_HOLD_MS`) sobre cualquier elemento → cuadro de comentario con contexto automático: vista activa, slide del modo rápido (n/m + título), id del elemento (o tag) y timestamp. Guarda en `cap_devfb` (localStorage).
- **Fab 📋** (abajo-izquierda, con badge de conteo) → export de TODOS los comentarios como markdown estructurado para Claude Code (bloque por comentario: vista / slide / elemento / timestamp / texto citado), botón copiar (clipboard + fallback execCommand) y borrar todos (con confirmación).
- Todo detrás de **`DEV_FEEDBACK=true`** (app.js, bloque delimitado "DEV FEEDBACK") + bloque CSS `.devfb-` en styles.css. **QUITAR ambos bloques antes del release final.** DOM creado dinámicamente: cero rastro en index.html.
- No interfiere con la app: nunca hace `preventDefault`; el hold se cancela al soltar, mover >12 px o hacer scroll. Tests: `tests/test_devfb.js` (21 asserts). SW: `v0.7.1-r2`.

---

## v0.7 (en desarrollo) — Bloque 1: campos Notion nuevos, trazabilidad y historial solo lectura

### Bloque 1 (02-jul-2026)
- **Baños divididos:** "Baños completos" (`f_ban`, mapea a campo Notion "Baños") y "Medios baños" (`f_ban_medios`, campo nuevo "Medios baños").
- **Cuota de mantenimiento:** campo numérico con S/I y N/A → campo Notion "Cuota de mantenimiento" (MXN/mes).
- **Indivisos:** botón "+ indivisos" bajo m² terreno; m² numérico o S/I (sí tiene, sin dato) o N/A (no tiene). Mapea a "m² terreno indivisos" (number) y "Tiene indivisos" (Sí/No/S-I). "m² terreno" queda como m² privados.
- **Regla Departamento/Penthouse:** con Tipo = Departamento o Penthouse, m² terreno en S/I o N/A no es obligatorio ni marca la captura como incompleta (Penthouse agregado en B1-r2 por indicación del dueño).
- **Comisión "Otra":** opción al final del select que abre texto libre (ej. 1.75%); el markdown lleva un único valor en "Comisión de venta" (text), nunca duplicado.
- **Características:** "Alberca climatizada" y "Pádel" en catálogo; botón "+" para características personalizadas que persisten en localStorage (`cap_caractCustom`).
- **Historial ver/editar:** tap directo en una captura = detalle SOLO LECTURA (overlay); editar solo con el botón ✏️ explícito.
- **Trazabilidad:** bloque `<!-- META uuid/creado/modificado/ediciones -->` al inicio de cada markdown (propiedades y contactos); cada edición conserva UUID y fecha de creación e incrementa el contador. Filas Notion nuevas: "UUID Captura", "Fecha captura", "Revisión duplicado" (Sin revisar), "Observaciones captura", "Carpeta Drive" (pendiente Bloque 2).
- **Multi-zona verificada** con prueba automatizada (3 zonas separadas por coma).
- **Tests:** `tests/check_ids.js` (IDs huérfanos JS↔HTML) y `tests/test_markdown.js` (61 asserts jsdom).
- SW cache: `capturador-v0.7-B1-r1` → `B1-r2` (regla Penthouse).

### Bloque 2 (02-jul-2026) — Integración Drive vía GAS
- **GAS v3 (`docs/GAS_v3_drive.gs`):** reemplazo completo del Apps Script (el `GAS_v2B.gs` documentado estaba desactualizado respecto a lo desplegado; el v3 implementa el contrato real de app.js reconstruido del cliente). Al recibir `saveMarkdown` de una propiedad crea (o reutiliza, por uuid y por nombre) una carpeta **"Propiedad - \<Dirección\>"** dentro de la carpeta madre de Drive (`1PTKX6TZSR94Hailc3qvWBbK_zQkE6Vhn`), guarda `folderUrl` en la hoja Markdowns y la devuelve en la respuesta. Hojas header-driven (agrega columnas sin romper datos). **PENDIENTE: desplegarlo manualmente en script.google.com (instrucciones en el header del .gs).**
- **App:** `gasSaveMarkdown` ahora envía la dirección y procesa la respuesta: guarda `driveUrl` en el registro del historial y re-sube la captura para que la nube no lo pierda al sincronizar. En el historial, el botón **"📷 Fotos Drive"** reemplaza a "Copiar MD" cuando la carpeta existe (sin carpeta, Copiar MD se conserva) y abre la carpeta en Drive. Al editar, la fila "Carpeta Drive" del markdown lleva la URL real.
- **Tests:** `tests/test_gas.js` (33 asserts, mocks de SpreadsheetApp/DriveApp) y `tests/test_drive_app.js` (16 asserts jsdom async).
- SW cache: `capturador-v0.7-B2-r1`.

### Retoma 02-jul-2026 (tarde) — reconciliación Sheet + decisiones de producto
- **GAS v3.1 (reconciliación de pestañas):** getSheet_ se auto-repara — adopta la pestaña legada con el histórico real ("Hoja 1" → renombrada a "Capturas", cero pérdida), borra la canónica vacía y las "*_conflict" vacías; nunca elimina hojas con datos. La hoja "Asesores" queda como legado SIN USO: el ranking se deriva de las capturas reales en cada GET (borrar una captura baja el conteo solo). +12 asserts (escenario real). **Requiere redesplegar el GAS + autorizar Drive con testDrive() (instrucciones en el .gs).**
- **PROP-3:** decisión cerrada — excepción histórica documentada en CLAUDE.md, NO se recodifica.
- **Campos de terreno como propiedades reales de Notion (decisión cerrada):** creadas vía API el 02-jul: "Uso de suelo" (rich text), "Estatus legal" (select: Título limpio/Con gravamen/Ejidal/En trámite/S-I), "Servicios disponibles" (multi-select: Agua/Luz/Drenaje/Pavimento/Por confirmar). El markdown de terrenos los escribe como filas directas; Notas vuelve a ser solo notas de campo. **Registros viejos con datos en Notas (sin migrar, documentado): solo 1 — "Terreno en Los Reyes 217 m2 privados" (servicios pavimento/drenaje/luz/agua, uso habitacional, estatus legal S/I).** Tests: 67/67 markdown. SW: B2-r5.

### Mascota: chroma key con canvas (02-jul-2026) — pendiente v0.6 resuelto
- Los MP4 se renderizan en un canvas y el fondo (blanco/gris) se vuelve transparente por flood fill desde los bordes: la panza blanca de la casita queda protegida por su contorno. Erosión 3x3 (cierra huecos de anti-aliasing) + dilatación 2px (sin halo). Umbral calibrado: brillo ≥200, saturación ≤16 (el glow verde del teléfono hacía puente con umbrales laxos).
- Resuelve los DOS pendientes de mascota de v0.6: fondos grises de running/sad (verificado visualmente en dark mode) y autoplay iOS (listener de primer toque que re-arranca los videos + fallback automático al <video> si canvas falla, p. ej. en file://).
- En dark mode ya no se fuerza tarjeta blanca ni mix-blend-mode cuando el chroma está activo. SW: B3-r1.

### Verificación E2E Drive (02-jul-2026, noche) — GAS v3.2
- **Verificado contra el endpoint real:** ping OK (v3.1 online), GET devuelve el histórico completo (6 capturas reconciliadas desde "Hoja 1") y el ranking de asesores cuadra 1:1 con las capturas (Daniel 3/3⭐, Carlos 1/3⭐, Gabriel 1/2⭐, Erica 1/1⭐).
- **saveMarkdown AÚN FALLA en Drive:** `createFolder` devuelve "Permisos necesarios: auth/drive". Causa: `testDrive` v3.1 solo LEÍA la carpeta madre, así que la autorización quedó con alcance de lectura; crear carpetas exige el scope completo. Nada se escribió en el Sheet (el error corta antes del upsert).
- **GAS v3.2:** `testDrive` ahora crea y trashea una subcarpeta temporal (fuerza el scope de escritura al autorizar y lo verifica de verdad); instrucciones de manifiesto `appsscript.json` (oauthScopes con `auth/drive` completo) en el header. Ping responde "v3.2". **Requiere: pegar v3.2 + revisar manifiesto + re-ejecutar testDrive + Nueva versión.**
- **✅ DRIVE INTEGRATION FUNCIONAL (02-jul-2026, redespliegue v3.2 del dueño):** verificado E2E con la captura real "Casa 87" — saveMarkdown devuelve `folderUrl`, la carpeta "Propiedad - Hacienda de los Casillas…" existe en Drive dentro de la carpeta madre (confirmado por ID vía conector Drive), segundo POST devuelve la MISMA URL (no duplica), backfill de `driveUrl` en la captura persiste en la nube y el ranking sigue cuadrando 1:1. Sin datos de prueba: se usó una captura real precisamente porque el endpoint no expone borrado (la carpeta creada es producción útil).

### Catálogo filtrable + polish UI (02-jul-2026, noche) — Bloque 3
- **Historial → catálogo tipo galería:** cada propiedad es una tarjeta con jerarquía visual — hero arriba (emoji por tipo de inmueble + pill de estado + badge 📷 si hay carpeta Drive), precio grande en verde (venta, o renta como "$X /mes"; parsea con `parseNumeroES` desde `formData`), y datos secundarios (nombre, estrellas, tipo · operación · zona · asesor · fecha) debajo. Los contactos conservan su tarjeta simple. Botones de acción y tap-para-detalle intactos (delegación en #histList sin cambios).
- **"+ filtros" combinables por manipulación directa:** panel con grupos en contenedores (💰 Precio venta/renta con rangos fijos, 🏠 Tipo, 📍 Zonas y ✨ Amenidades derivados de las capturas reales ordenados por frecuencia, top 12 amenidades). OR dentro de tipo/zona, AND en amenidades, precio de selección única. Chips activos removibles (✕) con animación de entrada, badge con conteo en el botón, contador "N de M capturas" con pulso, botón Limpiar. Contactos se ocultan mientras haya filtros de catálogo (no tienen precio/zona/amenidades). Filtros de estado (Pendientes/Enviados/…) se combinan con los de catálogo. Estado en memoria de sesión (no persiste al recargar).
- **Polish Duolingo:** flash verde de confirmación (`.flash-ok`) en Copiar MD/Copiar contacto y en el pill de estado al marcar enviada/pendiente; micro-animaciones del panel y chips; todo respeta `prefers-reduced-motion`. Dark mode: tarjetas más claras que el fondo sin bordes de alto contraste.
- **Tests:** `tests/test_catalogo.js` (39 asserts jsdom). Total suites: 225 asserts verdes. SW: B3-r3.

### Bloque 4 (02-jul-2026, noche) — fixes post-revisión del dueño
- **Fix regresión mascota contactos:** el chroma key de v0.7 agregaba `.chroma-on{position:relative}` al float `#ctMascotFloat` y pisaba su `position:fixed` (misma especificidad, regla posterior) — la mascota caía al fondo de la página. Regla compuesta `.ct-mascot-float.chroma-on{position:fixed}` restaura el comportamiento fijo de v0.6.
- **Borrado con PIN (1512) + propagación al Sheet:** borrar del historial (propiedades Y contactos) abre un modal con input de PIN dedicado. PIN incorrecto: feedback claro + shake, no borra nada. PIN correcto: borra de localStorage y del Sheet vía **GAS v3.3 `deleteCapture`** (el PIN se revalida en el GAS como doble seguro; borra la fila de Capturas y la de Markdowns; **la carpeta Drive nunca se toca** — puede tener fotos reales). Sin red: borrado local aplica, deleteCapture queda en cola de reintento. **Tombstones (`del_pend`):** el sync de nube no revive capturas borradas mientras el Sheet no confirme; se purgan solos al confirmarse. Reemplaza y supera la propuesta `deleteTest`.
- **GAS v3.3 también incluye `action:'diag'`** (solo lectura): pestañas, encabezados, orden canónico y anomalías fila por fila — para diagnosticar corrimientos de columnas sin abrir el Sheet. **Requiere pegar v3.3 + Nueva versión (sin re-autorizar: no hay scopes nuevos).**
- **Diagnóstico del Sheet (reporte "columnas movidas"):** verificación celda por celda vía GET — la pestaña Capturas está 100% consistente: orden canónico exacto, 6/6 filas válidas (ids, ISO dates, JSON parseable, cero celdas corridas). Pendiente: radiografía de Markdowns/Asesores con `diag` tras redesplegar v3.3. El bot de las 9am debe leer la pestaña "Capturas" mapeando columnas POR NOMBRE de encabezado (no por posición) — así es determinista aunque se agreguen columnas al final.
- **Tests:** `tests/test_delete.js` (27 asserts jsdom) y +14 asserts en `test_gas.js` (deleteCapture PIN bueno/malo/idempotente, diag detecta anomalías y es solo lectura). Total: 266 asserts verdes en 8 suites. SW: B4-r1.

### Bloque 5 (03-jul-2026) — Sheet unificado + asesor inmutable (GAS v3.4)
- **Reparación de datos ejecutada YA (vía v3.2, sin esperar redespliegue):** (1) asesor de "Casa en Tlaltenango" restaurado a **Erica** en Capturas (columna + `propiedad_json.asesorNombre`; el editor quedó en `json.editadoPor='Daniel'`) — el ranking volvió a cuadrar (Daniel 3, Erica 1). (2) Los 6 markdowns migrados al bloque canónico de Markdowns vía replays de `saveMarkdown` con el asesor ORIGINAL: 6 carpetas Drive únicas (Casa 87 conservó la suya; **Kloster** compartía dirección con Casa 87 y se le reservó carpeta propia con un POST sin dirección + reuso por uuid). (3) `driveUrl` backfilled en las 6 capturas → botón "📷 Fotos Drive" para todas.
- **GAS v3.4** (`docs/GAS_v3_drive.gs`, pendiente pegar + Nueva versión):
  - `migrateMarkdowns` (PIN): **backup completo en pestaña nueva** → fusiona los DOS bloques paralelos de Markdowns (A-H legado "UUID/Asesor/…" + I-R canónico, bug de `ensureCols_` v3.2 que agregó los canónicos como columnas nuevas por diferencia de mayúsculas) en un solo bloque canónico en minúsculas; en duplicados por uuid gana la fila nueva pero **el asesor original legado se conserva** (editor → `editadoPor`) y el conflicto se propaga a Capturas; marca "Asesores" como DEPRECATED (aviso fila 1 + renombre). Idempotente; nunca borra sin backup.
  - Columna nueva **`editadoPor`** en Markdowns; **guard de asesor inmutable** en `saveMarkdown` (aunque un cliente viejo cacheado mande al editor como asesor, el original no se pisa).
  - **Carpetas Drive nombre-first:** "Propiedad - \<Nombre\>" en vez de dirección (dos propiedades del mismo condominio compartían dirección → habrían compartido carpeta; caso real Casa 87/Kloster). Carpetas existentes se reusan por uuid.
  - `diag` ahora reporta `headersDuplicados` (detector de bloques paralelos).
- **App:** en ediciones `saveCapture` conserva `asesorNombre`/`asesorId` originales y registra `editadoPor`; `gasSaveMarkdown` envía asesor original + `editadoPor`.
- **CLAUDE.md:** reglas del Sheet para el bot de las 9am (solo Capturas/Markdowns, por nombre de encabezado, asesor inmutable, Asesores deprecated).
- **Tests:** G10 migración con el escenario real (23 asserts: backup, fusión, headers únicos, conflicto Erica/Daniel, idempotencia, shape del GET) + G11 guard (5) + D7 app (6). GAS 96/96, Drive app 26/26. SW: B4-r2.
- **Hallazgo de despliegue:** `testDrive` en el editor corre el código GUARDADO, pero el web app sirve la VERSIÓN DESPLEGADA — el ping seguía en v3.2 aunque el dueño creyó desplegar v3.3. Verificación fiable = `{"action":"ping"}` al endpoint.

### Migración ejecutada en producción (03-jul-2026) — Sheet limpio ✅
- **v3.4 confirmado desplegado** (ping). `migrateMarkdowns` corrió con éxito: backup `Markdowns_backup_20260703_2047` (16 filas, TODO el estado previo), Markdowns unificada en bloque canónico único (11 columnas, `ordenCanonico:true`, sin headers duplicados, cero anomalías), "Asesores" → `Asesores_DEPRECATED` con aviso en fila 1.
- **El equipo ya captura en producción:** 5 capturas nuevas del 03-jul (4× "Jacarandas" de Erica — comparten carpeta Drive por ser el mismo nombre de propiedad, probablemente reintentos; + "Ponton" 3⭐ de Carlos). Backfill de `driveUrl` completado para las 11 capturas. GET verificado: 11 filas shape uniforme, ranking cuadra (Daniel 3/3⭐, Carlos 2/6⭐, Gabriel 1/2⭐, Erica 5/4⭐).
- Pendiente sugerido al dueño: depurar los 3 duplicados de "Jacarandas" con el borrado PIN desde la app, y borrar la pestaña backup cuando la haya revisado.

### Bloque 6 (03-jul-2026) — Modo Captura Rápida (slides Duolingo)
Lineamientos del dueño (03-jul): mismo formulario completo navegado en slides; esenciales bloqueantes con S/I-N/A explícito; resto saltable libre; convive con el tradicional; timer 5 min como referencia visual, no límite duro.
- **Tarjeta "⚡ Captura Rápida" en Home** (convive con "Capturar propiedad"; mismo paso de asesor). El modo particiona el MISMO `viewCapture` en ~28 slides (cada bloque de campos = 1 slide, títulos de sección en la barra): **cero duplicación de DOM y listeners intactos** (solo clases `.qk-hide`), así que markdown, historial, GAS y edición son idénticos al flujo tradicional.
- **Barra fija inferior:** sección + contador "N / M", ← Atrás, **Saltar** y **Siguiente →** (en el último slide: "⚡ Generar Markdown" → dispara el `btnGen` de siempre). Salida manual con "✕ Salir del modo rápido" restaura el formulario completo con todo lo capturado.
- **Esenciales bloqueantes** (los mismos de `updateProgress`, condicionados por tipo/operación): tipo (duro, sin S/I), zona, dirección/nombre, precio venta/renta, m² terreno (exención Depto/Penthouse), m² construcción, recámaras, baños; terreno: uso de suelo y frente. Siguiente muestra aviso de qué falta; **Saltar en slide esencial pide consentimiento y MARCA S/I** (nunca se salta en silencio). Slides ocultos por tipo/operación (renta, terreno, unidades) se brincan solos.
- **Timer:** arranca solo en 5 min como meta visual (mascota/estados de siempre); al salir del modo se restaura la preferencia guardada del asesor.
- **Tests:** `tests/test_quick.js` (32 asserts jsdom: entrada, esencial duro, S/I con consentimiento, opcionales libres, generación por el mismo pipeline, salida limpia, flujo tradicional intacto). Total: **332 asserts verdes en 9 suites**. SW: B6-r1.

### Bloque 7 (04-jul-2026) — revisión móvil del dueño (A-G)
- **A1:** editar desde el historial NUNCA hereda el modo rápido (quickPending solo sobrevive Home⚡→Asesor→Captura). **A2:** modal PIN contenido en móvil.
- **B:** en modo rápido se ocultan navbar, header, fabs y pausa del timer; barra de slides fija abajo (z-300) sin overlaps; botones compactos; "Salir" mínimo y discreto (conserva datos).
- **C:** slides reagrupados 1-3 campos (dirección+maps; nombre+fecha+fuente; precio+moneda+negociable; rec/baños/medios/est con **steppers −/+** que también dejan teclear; estado+características; próxima+fuertes; riesgos+notas); pregunta del slide visible en contenido (C2).
- **D (ambos flujos):** chips de características — el pool solo muestra NO seleccionadas (las elegidas viven arriba como tags ✕ con entrada animada), salida con animación suave y relleno del hueco, "Ver más" solo si hay ocultas, "↻ Refrescar" baraja de verdad.
- **E:** tarjeta final "Faltaron estos datos principales" (esenciales vacíos o en S/I) con "Rellenar los que faltaron" (salta al primero) o "Guardar sin esos datos"; solo si aplica.
- **F:** tarjetas del catálogo = resumen de la PROPIEDAD (precio grande, tipo·oper·zona, 🛏🛁📐🌱, top-3 características) — sin markdown crudo ni links de texto (Drive es botón); metadatos de captura (pill+fecha+asesor+✏️editor) pequeños al fondo; **foto real de Drive como hero** cuando existe (GAS v3.5: `saveMarkdown` devuelve `fotoUrl` = miniatura de la primera imagen de la carpeta; fallback emoji). **v3.5 pendiente de pegar+Nueva versión (sin re-autorizar).**
- **G:** botón "📇 Elegir de mis contactos" (Contact Picker API) en CRM de propiedades y en capturadora de contactos; trae nombre+teléfono; sin soporte del navegador queda oculto.
- **Verificación de paridad:** `tests/test_md_paridad.js` — la MISMA data por flujo rápido y tradicional produce **markdown idéntico byte a byte** (4,322 chars; solo difieren uuid/fecha del META). Total: **344 asserts verdes en 10 suites.** SW: B6-r2.

### Easter eggs / logros (02-jul-2026)
- 6 hitos por asesor derivados del historial local: 🎉 primera captura, 🔥 10, 🏆 25, 💎 5 perfectas (3⭐), ⚡ racha 3 días, 🌟 racha 7 días. Celebración con confetti + sonido + vibración tras la animación de estrellas; cola si se desbloquean varios; persisten en cap_logros (nunca se repiten; editar no re-otorga). Tests: tests/test_logros.js (14 asserts). SW: B3-r2.

### Pendientes v0.7 adelantados (02-jul-2026, madrugada)
- **Ranking limpio multi-dispositivo:** filtros por fecha (Todo/Hoy/7 días/30 días) y por asesor en el ranking compartido, agregando client-side desde las capturas de la nube; paginación de 10 tarjetas con "Ver más". En modo local (sin nube) los filtros se ocultan y el comportamiento previo se conserva. Tests: `tests/test_ranking.js` (15 asserts). SW: `B2-r4`.
- **Seguridad GAS (clave compartida):** `API_KEY` opcional en el GAS v3 (vacía = apagada, retrocompatible). Con clave activa, todo POST debe traer `k` en el body y todo GET `?k=`; la app la envía desde Configuración → "Clave del backend" (`CFG.gasKey`). Tests: +9 asserts en `test_gas.js`, +4 en `test_drive_app.js`. SW: `B2-r3`.
- **vCard de contactos ("Contactos al celular"):** exportar/compartir la ficha como `.vcf` (vCard 3.0 con teléfono, WhatsApp, email, empresa, puesto y nota con tipo+asesor). Compartir nativo en móvil (`navigator.canShare` con archivo) con fallback a descarga. Botones: "📇 Guardar en contactos" tras generar, "📇 vCard" en ambos historiales. Tests: `tests/test_vcard.js` (16 asserts). SW: `B2-r2`.

---

## v0.5 (en desarrollo) — Gamificación, asesores, temporizador, capturadora de contactos

### Fase 1 — Menú principal y nueva navegación
- Pantalla de inicio tipo app con 6 tarjetas: Capturar propiedad, Capturar cliente/socio, Ranking, Historial, Configuración, Ayuda.
- Barra de navegación inferior (navbar) persistente.
- Badge de versión v0.5 en todas las vistas.
- Navegación por `data-view` sin recarga de página.

### Fase 2 — Módulo de asesores
- Selección de asesor activo antes de iniciar cualquier captura.
- Lista inicial con 4 asesores: Daniel, Erica, Carlos, Gabriel.
- Agregar asesor nuevo desde la pantalla de selección.
- Recordar automáticamente el último asesor en el dispositivo (localStorage).
- Badge de asesor activo visible durante la captura.

### Fase 3 — Temporizador gamificado
- Pantalla de preparación: selección de tiempo (5/10/15/20 min) e inicio de captura.
- Anillo SVG de cuenta regresiva con progreso visual.
- Estados del temporizador: listo / en marcha / pausado / expirado.
- Botón de pausa y reanudación con registro de pausa.

### Fase 3.5 — Mascota expresiva v1
- Casita SVG animada (Casita Hauser) integrada arriba del formulario.
- Estados iniciales: idle, dancing, focused, angry, sad, celebrating.

### Fase 4 — Sonidos con Web Audio API
- 8 sonidos sintéticos: click, chip, avance de paso, error, estrella ganada, captura completada, urgente, tiempo agotado.
- Activar/desactivar desde Configuración; control de volumen con slider.
- Sonidos condicionados a la primera interacción del usuario (norma de navegadores).

### Fase 4.5 — Mascota kawaii rediseñada
- Rediseño completo de la casita: paleta verde Hauser, brazos blob, piernas stubby, mejillas, puerta arqueada, ventana con rejilla.
- Animaciones enriquecidas: walking, jogging, running, gotas de sudor en estado urgent.
- 7 estados visuales distintos cubiertos con CSS puro.

### Fase 5 — Sistema de 3 estrellas y pantalla de resultado gamificada
- **Estrella 1 — Velocidad:** tiempo total de captura ≤ 300 segundos (5 min).
- **Estrella 2 — Datos esenciales:** tipo, operación, dirección, zona, precio, m² terreno, m² construcción (ambos), fuente, quién ofrece, asesor; campos de terreno si aplica (servicios, uso de suelo).
- **Estrella 3 — Captura completa:** todos los campos relevantes completos o marcados explícitamente como S/I / N/A.
- Pantalla de resultado: estrellas animadas en secuencia, badge de calidad (Incompleta / Esencial / Publicable / Completa), lista de datos faltantes, botones de acción.
- Confetti solo con 3 estrellas; mascota en estado "celebrating".
- Auto-avance de estatus a "Captada" con 3 estrellas (Decisión de producto 14).
- Corrección de timing: mascota celebrating con `setTimeout(100ms)` para esperar el DOM.

### Fase 6 — Ranking de asesores con podio
- Vista de ranking: top-3 con podio (🥇🥈🥉) y tarjetas de stats.
- Métricas por asesor: estrellas totales, capturas totales, capturas esenciales, capturas completas, mejor tiempo, última captura.
- Orden: más estrellas → mayor promedio → menor tiempo.
- Datos guardados en localStorage; estructura preparada para sincronización futura.

### Fase 7 — Capturadora de clientes / socios
- Vista completa para alta de contactos en la base Contactos / CRM de Notion.
- 11 tipos de contacto: Propietario, Comprador, Desarrollador, Arquitecto, Notario, Maestro de obra, Broker, Asesor inmobiliario, Inversionista, Referido, Otro.
- Secciones condicionales por tipo: búsqueda (Comprador/Inversionista), oferta (Propietario/Desarrollador), servicio (Aliados).
- Generación de markdown compatible con la base Contactos / CRM.
- Historial de contactos capturados con estados Generado / Enviado.
- Badge de pendientes por enviar.

### Fase 8 — Pulido final (actual)
- `CHANGELOG.md` creado con historial completo de 8 fases.
- `PENDIENTES.md` actualizado: bug de centrado de mapa resuelto (ya estaba en código), pendientes vigentes reorganizados.
- Ayuda rápida ampliada: de 6 a 11 preguntas frecuentes (sistema de estrellas, S/I vs N/A, datos de terreno, códigos PROP-/TERR-, captura de contactos).
- Checklist de 26 acceptance tests documentado (ver abajo).
- Verificación de integridad del markdown: 21 campos del esquema 🏠 Propiedades confirmados.

---

## Checklist de 26 acceptance tests (v0.5)

Ejecutar en orden. Marcar ✅ al pasar, ❌ con descripción del fallo.

### AT-01 al AT-04 — Navegación y UI

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-01 | App abre | Menú principal visible con 6 tarjetas y badge "v0.5" en esquina |
| AT-02 | 6 tarjetas del menú | Cada tarjeta navega a su vista correcta sin error |
| AT-03 | Botón ← Inicio | Funciona desde captura, contacto, historial, config, ayuda y ranking |
| AT-04 | Navbar inferior | Resalta el ícono de la vista activa correctamente |

### AT-05 al AT-07 — Asesores

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-05 | Lista inicial | Aparecen Daniel, Erica, Carlos y Gabriel |
| AT-06 | Seleccionar asesor | Activa "Empezar captura"; badge de captura muestra el nombre |
| AT-07 | Agregar asesor | El asesor nuevo aparece en lista, queda activo y persiste al recargar |

### AT-08 al AT-10 — Temporizador

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-08 | Chips de tiempo | 5/10/15/20 min cambian el tiempo antes de iniciar |
| AT-09 | Anillo SVG | Al iniciar, el arco se vacía progresivamente de lleno a 0 |
| AT-10 | Pausar / Reanudar | Botón cambia de texto; cronómetro se detiene y retoma sin saltos |

### AT-11 al AT-12 — Mascota y animaciones

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-11 | Estados de mascota | idle→dancing (inicio)→focused (≤5 min)→angry (≤2 min)→sad (agotado)→celebrating (3 ⭐) |
| AT-12 | prefers-reduced-motion | Con la preferencia activa en el SO, animaciones CSS reducidas/eliminadas |

### AT-13 al AT-14 — Sonidos

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-13 | Sonidos activos | Se escuchan tras la primera interacción (click en cualquier botón) |
| AT-14 | Silenciar | Desactivar en Configuración → ningún sonido se reproduce |

### AT-15 al AT-20 — Captura de propiedad

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-15 | Captura esencial | Llenar tipo, operación, dirección, zona, precio, m²T, m²C, fuente, quién ofrece, asesor → sin error al generar |
| AT-16 | Estrella 1 — Velocidad | Terminar en ≤ 5 min → ⭐ Velocidad ganada en pantalla de resultado |
| AT-17 | Estrella 2 — Esencial | Datos esenciales completos → ⭐ Datos esenciales ganada |
| AT-18 | Estrella 3 — Completa | Todos los campos completados o marcados S/I/N/A → ⭐ Captura completa ganada |
| AT-19 | 3 estrellas | Estatus = "Captada" en markdown; confetti visible; mascota en "celebrating" |
| AT-20 | Código de propiedad | El markdown NO escribe código; Notion lo asigna automáticamente (auto-incremental) |

### AT-21 al AT-22 — Markdown de propiedad

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-21 | 21 campos Notion | Tabla en sección 2 del markdown cubre los 21 parámetros del esquema 🏠 Propiedades |
| AT-22 | Reglas de relaciones | Dirección con instrucción de geolocalizar; zona nueva con [CREAR y relacionar]; S/I/N/A nunca vacíos |

### AT-23 al AT-24 — Captura de cliente / socio

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-23 | Tipo Comprador | Sección búsqueda visible; markdown incluye presupuesto, zona de interés y urgencia |
| AT-24 | Tipo Propietario | Sección oferta visible; campo propiedad relacionada con instrucción de vincular |

### AT-25 al AT-26 — Ranking, historial y exportación

| ID | Test | Criterio de éxito |
|---|---|---|
| AT-25 | Ranking | Se actualiza con estrellas, capturas y mejor tiempo del asesor tras cada captura |
| AT-26 | Historial y exportación | Captura guardada en historial; "Exportar historial (JSON)" descarga el archivo |

---

## Verificación del esquema Notion (21 campos)

Confirmación de que el markdown de la sección "2. Campos de la base 🏠 Propiedades" cubre los 21 parámetros:

| # | Parámetro Notion | Tipo | Cubierto en markdown |
|---|---|---|---|
| 1 | Propiedad (título) | Title | ✅ fila Nombre |
| 2 | Código | Text | ✅ Auto-incremental en Notion; el markdown NO lo escribe (Notion lo asigna) |
| 3 | Tipo de inmueble | Select | ✅ fila Tipo de inmueble |
| 4 | Operación | Select | ✅ fila Operación |
| 5 | Precio | Number | ✅ fila Precio (+ fila Precio renta si aplica) |
| 6 | Precio / m² | Fórmula | ✅ fila Precio / m² (nota: lo calcula Notion) |
| 7 | m² terreno | Number | ✅ fila m² terreno |
| 8 | m² construcción | Number | ✅ fila m² construcción (N/A en terreno sin construcción) |
| 9 | Recámaras | Number | ✅ fila Recámaras (N/A en terreno) |
| 10 | Baños | Text | ✅ fila Baños (N/A en terreno) |
| 11 | Estacionamientos | Number | ✅ fila Estacionamientos (N/A en terreno) |
| 12 | Dirección | Text | ✅ fila Dirección + instrucción de geolocalizar |
| 13 | Zona | Relación → 📍 Zonas | ✅ fila Zona con [buscar/CREAR y relacionar] |
| 14 | Estatus | Select | ✅ fila Estatus (auto "Captada" con 3 ⭐) |
| 15 | Fuente | Select | ✅ fila Fuente (nota si es opción nueva) |
| 16 | Propietario | Relación → 👥 Contactos | ✅ fila Propietario + sección 4 CRM |
| 17 | Publicable | Checkbox | ✅ fila Publicable |
| 18 | Operaciones | Relación → 🤝 Operaciones | ✅ sección 5 (solo si hay comprador) |
| 19 | Proyectos | Relación → 📁 Proyectos | ✅ sección 3 reglas de relaciones |
| 20 | Tareas | Relación → ✅ Tareas | ✅ sección 6 tareas de seguimiento |
| 21 | Notas | Texto | ✅ fila Notas (terreno: incluye servicios, uso de suelo, estatus legal) |

---

## Pendientes abiertos (no bloqueantes para v0.5)

Ver `PENDIENTES.md` para el estado completo de los ítems abiertos.

---

*Capturadora Hauser v0.5 · Hauser / Inmobitera · CHANGELOG generado en Fase 8 — Pulido final*
