# PENDIENTES — Capturadora Hauser v0.5

Registro de decisiones pendientes e incidencias abiertas. No implementar sin alineación con el dueño.

---

## Conflictos de esquema Notion

- **PROP-3 / TERR-**: El terreno registrado como PROP-3 en Notion tiene prefijo incorrecto según la regla v0.5 (que usa TERR-). El dueño debe decidir si renumerar el registro existente. Mientras tanto, al auto-generar el código de un nuevo terreno se usa el prefijo TERR- sin tocar PROP-3. El markdown señala el conflicto cuando aplica.

- **Campos nuevos de terreno**: `uso_de_suelo_densidad`, `estatus_legal` y `servicios_disponibles` aún no existen como propiedades en la base 🏠 Propiedades. Por ahora se registran en el campo **Notas** de forma estructurada. Pendiente confirmar si se crearán como propiedades independientes o viven en Notas.

---

## Funcionalidades pendientes de backend o plataforma

- **Lector de URL ("Leer publicación y autorrellenar")**: Solo funciona dentro de Claude.ai; depende de la API de Anthropic sin backend propio. Dependiente de la futura migración a PWA hosteada o integración de backend. No implementar en la versión estática actual.

- **Carpeta de Drive / subir fotos**: El backend de creación de carpetas y subida de imágenes sigue sin implementar. Dependiente de migración con backend (Apps Script / Worker).

---

## Geolocalización y mapa

- **"Usar mi ubicación" devolvió coordenadas en India**: Posiblemente por IP/proxy de la red durante la prueba. Verificar comportamiento y precisión en dispositivos móviles reales antes de lanzar a producción. No reproducible en red normal.

- ~~**"Elegir en el mapa" no centra en México**~~: **RESUELTO en Fase 4.5.** El mapa ya centra por defecto en Cuernavaca (18.9261, -99.2308).

---

## Mejoras futuras (evaluación)

- **Catálogo de Fuentes**: Revisar y actualizar las opciones del select. Las fuentes actuales no reflejan todas las vías reales de captación del equipo. Pendiente revisión con el equipo.

- **Migración a IndexedDB**: Actualmente se usa localStorage. Para historial grande, ranking y capturas estructuradas, evaluar migración a IndexedDB/Dexie.

- **Sincronización de ranking/capturas**: Pendiente conexión con Notion o Google Sheets como backend de datos.

- **Campo "Acuerdo comercial"**: El propósito actual es ambiguo. Evaluar en próxima versión si renombrar, dividir en campos específicos (tipo de exclusiva, plazo, condiciones) o eliminar.

- **Buscador de direcciones con autocompletado Nominatim**: Mejora al campo de dirección para sugerir desde la escritura, reduciendo dependencia de geolocalización manual.

- **Reducción de animaciones configurable en app**: Actualmente la app respeta `prefers-reduced-motion` del SO vía CSS. Pendiente agregar toggle manual en Configuración para usuarios que no quieren tocar ajustes del sistema.

---

*Última actualización: Fase 8 — Pulido final · v0.5*
