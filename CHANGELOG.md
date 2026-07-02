# CHANGELOG — Capturadora Hauser

Historial de versiones y fases de desarrollo del capturador de propiedades Hauser / Inmobitera.

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
