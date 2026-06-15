# Instrucciones para continuar — Capturador de propiedades (Hauser / Inmobitera)

> Para el siguiente chat dentro del proyecto **Inmobitera_Análisis de Terrenos para Inversión**. Contexto: ya existe la **v4** del Capturador (HTML + app.js + PWA + backend Apps Script). Esta versión cubre captura, historial local, CRM dinámico, zonas inteligentes, características por tipo, multi-unidad, Markdown en tabla compatible con Notion, y backend gratuito opcional. Lo que sigue son los pendientes que NO se cerraron en esta entrega.

## Estado actual (hecho)
- App de captura completa, PWA-ready, validada con Node + jsdom (5 escenarios).
- Historial local con filtros (Todos / Pendientes / Enviados / Con faltantes) y acciones por captura.
- CRM con tarjetas dinámicas, modal de persona con todos los campos, y reglas (asesor ≠ propietario legal).
- Zona como **buscador inteligente** que prepara la relación a 📍 Zonas (crea si no existe).
- Markdown final en tabla `Campo Notion | Tipo | Valor | Nota`, precio sin símbolo, moneda aparte, S/I y N/A, relaciones para Zona/Contactos/Operaciones/Tareas.
- Campos extra (lat/lng, uso de suelo, servicios, topografía, etc.) van como **contenido de página**, no como propiedades vacías de la base (decisión del usuario).
- Backend Apps Script para historial central (Sheets), zonas compartidas y carpetas de Drive reales.

## Pendientes / siguiente fase (en orden de prioridad)

### 1. Montar y probar el backend Apps Script de verdad
- Seguir `DESPLIEGUE.md` → instalar `backend/Code.gs`, publicar como app web, pegar el `/exec` en ⚙️ Configuración.
- Validar: `ping`, `saveCapture`, `listZonas`, `createFolder`. Ajustar si Google cambia permisos.
- **Decisión abierta:** ¿la `ANTHROPIC_KEY` vive en el backend (lectura de anuncios desde el celular) o se mantiene la lectura solo dentro de Claude?

### 2. Conectar la app directo a la API de Notion (quitar el paso manual)
- Hoy el flujo es Markdown → agente humano. El siguiente nivel: que el backend escriba directo en Notion vía su API.
- Requiere: integración interna de Notion + IDs de las 4 bases (Propiedades, Contactos, Zonas, Operaciones).
- **Decisión abierta:** mantener aprobación humana o permitir alta directa con un botón "Crear en Notion".

### 3. Campos nuevos recomendados en Notion (si más adelante se quieren como propiedades, no solo contenido)
- En 🏠 Propiedades faltarían como campos formales: Latitud, Longitud, Link Maps, Moneda, Negociable, Uso de suelo, Frente/Fondo, Servicios, Topografía, Estatus legal, Carpeta Drive, Responsable, Prioridad, Fecha de captura.
- **Pendiente del usuario:** crear una base separada **"Terrenos"** con esos campos y relacionarla a Propiedades (lo mencionó como plan futuro). Cuando exista, ajustar el Markdown para alimentar esa base.

### 4. Lectura de anuncios más robusta
- Hoy depende de que el portal sea legible (wiggot/inmuebles24/vivanuncios). Evaluar fallback: pedir al usuario pegar el texto del anuncio si el link se bloquea.

### 5. Historial: edición de una captura existente
- Hoy "Editar captura" no recarga el formulario con los datos. Falta: al tocar editar en el historial, repoblar todos los campos del formulario.

### 6. Íconos definitivos de la PWA
- Los íconos actuales son cuadros verdes simples. Reemplazar por el logo real de Hauser/Inmobitera en 192px y 512px.

### 7. Sincronización bidireccional de zonas
- Hoy `listZonas` existe en el backend pero la app aún no lo consume al abrir. Falta: al cargar, si hay endpoint, traer las zonas reales y fundirlas con las locales.

## Notas para quien retome
- Validar SIEMPRE el `app.js` con `node --check` y el test jsdom (`test.js`) antes de entregar. Hubo un bug histórico de CSS con `display` en v2; v3+ usa `display:'block'` explícito.
- Estética: Notion-minimal (blanco, system fonts, bordes sutiles). No introducir tarjetas corporativas ni librerías de UI pesadas.
- Defaults acordados: responsable según quién captura (Daniel/Erica/Carlos/Gabriel), estatus "Captada" → "En análisis" si faltan mínimos, comisión 4% (opción 5%), página madre = "No, solo individuales".
- Captura completa mínima = m², recámaras, baños, responsable.
