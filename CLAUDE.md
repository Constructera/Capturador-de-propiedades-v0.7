# Proyecto: Capturadora Hauser v0.7

## Qué es esto
Continuación de la app capturadora de propiedades Hauser/Inmobitera, versión v0.7.
Repo COPIA de v0.6 (carpeta Capturadora-Hauser-v0.5 = repo Capturador-de-propiedades-v0.6).
Aislado: no mezclar con otros proyectos.

## Validación obligatoria antes de entregar
1. `node --check app.js`
2. `node tests/check_ids.js` — IDs referenciados en app.js deben existir en index.html (o en HTML dinámico del propio app.js).
3. `node tests/test_markdown.js` — suite jsdom de generación de markdown (leer localStorage con `w.localStorage.getItem()` directo).
3b. `node tests/test_gas.js` (mocks GAS) y `node tests/test_drive_app.js` (flujo Drive en jsdom) — obligatorios si se toca GAS o el flujo Drive.
4. Bump del cache key del Service Worker (`sw.js` → `CACHE`) en CADA push.
5. Nunca eliminar elementos del DOM con listeners activos sin remover el listener primero — crashea el IIFE completo.
6. jsdom instalado local en `tests/` (npm install jsdom). Node en `C:\Program Files\nodejs` (agregar al PATH en Git Bash).

## Antes de hacer cualquier cosa
1. Lee docs/PROMPT_MAESTRO_v0.5.md (especificación completa, fuente de verdad).
2. Lee docs/spec_capturadora_v0.5.json (misma spec, estructurada).
3. Revisa el código existente (index.html, app.js, manifest.json, sw.js) antes de editar.

## Reglas de trabajo
- NO rehacer desde cero. Conservar la lógica inmobiliaria existente.
- Mantener app estática HTML/CSS/JS. No migrar a React sin justificarlo.
- Mantener compatibilidad con GitHub Pages.
- Mobile-first.
- No usar servicios ni APIs de pago.
- Respetar las 16 decisiones de producto (sección 18 del prompt maestro).
- Trabajar por fases. Pedir mi aprobación antes de cada fase grande.
- No tocar el repo estable original. Esto es una copia.
- **Los cambios estéticos NO deben modificar el funcionamiento de la capturadora.** Antes de aplicar cualquier cambio visual, verificar que todos los listeners JS siguen activos (especialmente los posteriores al bloque de configuración).

## Esquema destino: base de datos Notion 🏠 Propiedades
El markdown que genera la app es la interfaz de salida hacia un agente Notion. DEBE
ajustarse al esquema canónico de la base 🏠 Propiedades para garantizar integridad
referencial y evitar campos huérfanos:
- Fuente de verdad del esquema: docs/spec_capturadora_v0.5.json → clave
  "notion_property_database.parameters" (21 propiedades con su tipo y mapeo).
- Respetar nombre, tipo de dato y cardinalidad de cada propiedad. No renombrar ni
  inventar propiedades fuera del esquema.
- Propiedades de tipo relation (Zona→Zonas, Propietario→Contactos, Operaciones,
  Proyectos, Tareas) se referencian por nombre/título del registro relacionado, no
  como texto plano. Si el registro relacionado no existe, el markdown debe instruir
  su alta previa (upsert) antes de vincular.
- Propiedades select (Tipo de inmueble, Operación, Estatus, Fuente, Estatus legal):
  usar solo opciones existentes del esquema. Si el valor capturado es nuevo (p. ej.
  zona inexistente), emitir instrucción explícita de crear la nueva opción del select
  antes de asignarla.
- Campos sin dato → "S/I"; campos no aplicables → "N/A". Nunca omitir ni autocompletar
  con valores inventados.
- Generación de Código condicional por Tipo de inmueble: PROP-XX (casa/depto),
  TERR-XX (terreno).
- Estatus: default "En análisis"; transición automática a "Captada" solo con 3 estrellas.
- Campos de terreno (creados 02-jul-2026, ya en el esquema): "Uso de suelo"
  (rich text), "Estatus legal" (select: Título limpio/Con gravamen/Ejidal/
  En trámite/S-I), "Servicios disponibles" (multi-select: Agua/Luz/Drenaje/
  Pavimento/Por confirmar). El markdown los escribe como campos directos; ya
  NO se empaquetan en Notas. Registro viejo con datos en Notas sin migrar:
  "Terreno en Los Reyes 217 m2 privados" (único; ver CHANGELOG).

## Decisiones de producto CERRADAS (02-jul-2026, confirmadas por el dueño)
- **PROP-3 = excepción histórica documentada. NO recodificar.** El registro
  PROP-3 de la base 🏠 Propiedades es un TERRENO con código legado PROP-*
  (anterior a la regla TERR-). Se conserva tal cual. El agente Notion y el bot
  de duplicados deben tratarlo como excepción conocida: la regla "terreno →
  TERR-XX" aplica solo a registros nuevos; PROP-3 nunca se renombra ni se
  reasigna su número.
- **Campos de terreno = propiedades reales de Notion** (ya no van empaquetados
  en Notas): "Uso de suelo" (rich text), "Estatus legal" (select), "Servicios
  disponibles" (multi-select). Registros viejos con estos datos dentro de Notas
  NO se migran todavía (solo documentados; ver CHANGELOG).

## Reglas del Sheet compartido (bot ChatGPT de las 9am y cualquier integración)
- Leer SOLO las pestañas **"Capturas"** y **"Markdowns"**. La pestaña
  "Asesores" está **DEPRECATED** (renombrada "Asesores_DEPRECATED"): el ranking
  real se deriva de Capturas en cada GET del GAS; sus datos están congelados.
- Mapear columnas **POR NOMBRE de encabezado, nunca por posición** (el GAS
  agrega columnas nuevas al final; por nombre es determinista).
- Markdowns canónico (v3.4, minúsculas): uuid, fecha, asesor, tipo, estatus,
  nombre, direccion, markdown_md, folderUrl, modificadoEn, editadoPor.
- **"asesor" = captador ORIGINAL, inmutable.** Quien edita queda en
  "editadoPor" (regla de producto 03-jul-2026). El GAS lo garantiza aunque un
  cliente viejo mande al editor como asesor.
- Borrado real solo vía `deleteCapture` con PIN; las pestañas
  "Markdowns_backup_*" son respaldos de migración (no parsear, borrables por
  el dueño cuando quiera).

## Estado v0.7
- **Bloque 1 (02-jul-2026): COMPLETO, pendiente de aprobación del dueño.** Baños completos/medios, cuota de mantenimiento, indivisos, regla Departamento, comisión "Otra", características nuevas (+persistentes), historial solo lectura, bloque META de trazabilidad, campos Notion nuevos en el markdown. Ver CHANGELOG.md.
- **Bloque 2 (siguiente): integración Drive/GAS.** El campo "Carpeta Drive" ya sale en el markdown como pendiente.

## Campos NUEVOS en Notion 🏠 Propiedades (creados 01-jul-2026, NO modificar la base)
Base ID: be60a02b-18ff-838b-97ea-813e803d1c45. El markdown ya los mapea con estos nombres EXACTOS:
- "m² terreno indivisos" (number, nullable) — "m² terreno" existente = m² privados, NO se renombró
- "Tiene indivisos" (select: Sí / No / S/I)
- "Cuota de mantenimiento" (number, MXN, nullable)
- "Medios baños" (number) — "Baños" existente = baños completos
- "Comisión de venta" (text libre, ej. "3%" o "1.75%")
- "Carpeta Drive" (url), "UUID Captura" (text), "Fecha captura" (date), "Revisión duplicado" (select: Sin revisar/Revisado/Posible duplicado/Fusionado), "Observaciones captura" (text)
Reglas vigentes: título = "Propiedad"; "Estatus de captura" y "Estatus de propiedad" son tipo Status; nunca escribir Precio/m², Precio/m² (terreno) ni Código; Operación es multi-select; nunca escribir "S/I" en campos numéricos (numérico vacío + nota).

## Pendientes v0.7
Los siguientes puntos surgieron durante el desarrollo de v0.6 y quedan diferidos:

- **Mascota iOS:** autoplay MP4 sin interacción previa del usuario no funciona en Safari/iOS; solución correcta es reexportar MP4 con fondo blanco puro o implementar chroma key con canvas.
- **Fondos running/sad:** `multiply`/`darken` no eliminan el fondo gris de esos MP4; pendiente reexportar o chroma key en canvas.
- **Captura rápida estilo Duolingo:** flujo condensado para capturar propiedades en <60 s desde la pantalla de inicio.
- **Campos terreno privados/indivisos:** uso de suelo/densidad, estatus legal, servicios disponibles — decidir si van como propiedades Notion o en campo Notas (ver sección Pendientes abiertos).
- **Conflicto de código PROP-3 vs TERR-:** pendiente decisión de producto (heredado de v0.5).
- **Ranking limpio multi-dispositivo:** el ranking compartido vía GAS funciona, pero la UI de ranking necesita paginación y filtros por fecha/asesor.
- **Polish UI / visual Duolingo completo:** tipografía Nunito, paleta vibrante, botones con sombra 3D, tema claro/oscuro refinado.
- **Drive integration real:** subida de fotos a Google Drive (actualmente marcada como pendiente en la app).
- **Easter eggs:** animaciones/recompensas ocultas al alcanzar hitos (ej. 10 capturas, 3 días seguidos, etc.).
- **Seguridad GAS:** validar origen de las peticiones al endpoint de Apps Script.
- **Contactos al celular:** exportar/compartir ficha de contacto como vCard desde la app.
- **Verificar markdown multi-zonas:** probar con el agente Notion que las zonas separadas por coma se vinculan correctamente como multi-relation.

## Animaciones MP4 de la mascota (para Fase 7)
Ruta de los archivos: D:\respaldo\TODO EN UNO\1.-ESCRITORIO\ESCRITORIO\CLAUDE\Mascota
Archivos MP4 disponibles y su mapeo a estados:
- "Idle.mp4"        -> estado idle (esperando)
- "1 caminando.mp4" -> estado walking-happy (>5 min) Y TAMBIEN se usa como celebrating (no hay animacion de celebracion propia)
- "2 apurado.mp4"   -> estado jogging-focused (2-5 min)
- "3 nervioso.mp4"  -> estado running-urgent (<2 min)
- "4 cansado.mp4"   -> estado sad / expired (tiempo agotado / 0 estrellas)
Notas:
- NO existe animacion de celebracion; usar "1 caminando.mp4" para celebrating.
- Los MP4 NO tienen fondo transparente; en Fase 7 evaluar conversion a WebM con alpha (ffmpeg) o aceptar recuadro.
- Mapeo de estados de resultado: 2-3 estrellas -> celebrating (1 caminando), 1 estrella -> idle, 0 estrellas -> sad (4 cansado).
