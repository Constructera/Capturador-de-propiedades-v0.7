# Plan de trabajo — Capturadora Hauser v0.6

Continuación de v0.5. Se trabaja sobre la MISMA carpeta del proyecto (Claude Code conserva contexto vía CLAUDE.md y el código en disco). Las ~25 observaciones del dueño se agrupan en **8 fases temáticas**, ordenadas por prioridad.

> **Decisiones tomadas antes de planear:**
>
> - **Ranking compartido (aclaración técnica importante):** el dueño quiere que todos vean las mismas capturas y el mismo ranking al entrar al link. Esto NO se logra solo con GitHub Pages, porque GitHub Pages es de **solo lectura**: la app puede leer pero no escribir de vuelta. Para que una captura de Carlos la vea Daniel hace falta un almacén central donde escribir. La solución **gratuita y sin servidor propio** es **Google Apps Script + Google Sheets** (el dueño ya lo usó antes en este proyecto): la hoja es el almacén, un script gratuito de Google recibe y guarda las capturas, y la app las lee. Se ofrece como **Fase 2B (opcional)**. Si se activa, el ranking compartido funciona en v0.6; si no, queda para v0.7.
> - **Parche local (Fase 2A, siempre se hace):** cada captura guarda embebido el nombre del asesor que la hizo, para que el historial local no se reescriba al cambiar de usuario en el mismo dispositivo.
> - El lector de URL desde portales se separa de la captura de propiedades y se pospone (el dueño desarrolla una skill aparte para capturar desde portales).
> - Las animaciones MP4 reemplazan la mascota SVG. Claude Code debe guiar paso a paso la conversión y colocación de archivos (ver Fase 7).

---

## Criterio de priorización

| Prioridad | Significado |
|---|---|
| Alta | Corrige datos incorrectos, bugs de uso real o lógica de negocio |
| Media | Mejora funcional importante |
| Baja | Pulido visual y experiencia |

---

## FASE 1 — Lógica de negocio: rentas y comisiones (ALTA)

1. **Ganancia de renta = valor del primer mes** (igual al precio de renta), NO porcentaje. Al seleccionar Renta o Ambas, capturar la renta así.
2. **Modificar la base de Notion Propiedades** para que la ganancia de renta sea igual al precio de renta (campo o fórmula). Si no lo soporta, el markdown instruye crear/ajustar el campo.
3. **Tiempo mínimo de renta** (solo Renta o Ambas): campo con opciones 6 meses / 1 año.
4. **Comisión esperada condicional:**
   - Renta -> autocompletar con el precio de renta del primer mes (del campo de arriba), modificable.
   - Ambas -> desplegar ambas comisiones (venta % + renta = primer mes).
5. **m² terreno en Renta** -> N/A automático. En "Ambas" NO se marca N/A.

**Riesgo:** medio. Toca cálculo y esquema Notion. Confirmar el cambio en la base antes de aplicar.

---

## FASE 2A — Persistencia local del asesor (ALTA)

6. **Embeber el asesor en cada captura.** Al guardar (propiedad o contacto), grabar dentro del registro el nombre del asesor que la hizo. NO depender del asesor activo actual del dispositivo.
7. **Historial y ranking leen el asesor embebido**, no el activo. Si Daniel abre el dispositivo de Carlos, ve "capturó: Carlos".

**Riesgo:** bajo.

---

## FASE 2B — Ranking y capturas compartidas (OPCIONAL, gratuito) (MEDIA)

Solo si el dueño la activa. Logra que todos vean las mismas capturas/ranking al entrar al link, sin servidor propio.

8. **Google Sheet como almacén central.** Crear una hoja que reciba cada captura.
9. **Google Apps Script (gratuito)** publicado como Web App: recibe POST (guardar) y responde GET (leer todas las capturas/ranking).
10. **La app envía cada captura al script** al guardarla, y al abrir Historial/Ranking lee todas las capturas de todos los asesores.
11. **Modo híbrido:** si no hay conexión o el script falla, usar localStorage como respaldo; sincronizar al volver.

**Riesgo:** medio. Requiere configurar el Apps Script una vez (Claude Code guía). Sin esto, el ranking sigue siendo por dispositivo.

---

## FASE 3 — Edición de capturas + historial unificado (ALTA)

12. **Editar y actualizar capturas** (propiedades y contactos): reabrir, completar campos, recalcular estrellas para alcanzar 3 / completa.
13. **Al editar:** eliminar la original y guardar la versión actualizada. Registrar **fecha de captura original** y **fecha de última modificación** (esta solo si se editó).
14. **Capturas de contacto en el historial:** junto a las de propiedad, con edición y sistema de estrellas.

**Riesgo:** medio. Cambia estructura del historial (timestamps + reescritura).

---

## FASE 4 — Captura de contactos rediseñada (ALTA)

La más extensa. Hacer por sub-pasos con validación visual.

15. **Tipo de contacto = selección múltiple.** Puede ser vendedor Y comprador a la vez. Al marcar ambos, desplegar campos de los dos.
16. **Familia "relacionado con la propiedad"** (vendedor, arquitecto, desarrollador, propietario, maestro de obra): campos específicos de la operación + **zona de operación** (dónde opera).
17. **Comprador:** producto buscado, zona(s) de interés (multi, ligada a Zonas), presupuesto máximo, forma de pago (crédito/recurso propio), ocupación, amenidades (características rápidas, incluir "recámara en PB"), uso (vivir/negocio), número de habitantes, fuente de contacto.
18. **Otros (notario, contador, abogado, etc.):** solo parámetros básicos de contacto.
19. **WhatsApp se autorrellena con el teléfono**, modificable si difieren.
20. **Zonas en contactos:** zona de operación (vendedor/otros) y zonas de interés (comprador, multi). Ambas sugieren desde la base Zonas.

**Riesgo:** alto. Reconstrucción del formulario de contactos.

---

## FASE 5 — Mejoras al flujo de captura de propiedad (MEDIA)

21. **Mascota en el resultado:** 2-3 estrellas -> celebrando (encima de las estrellas); 1 estrella -> idle; 0 estrellas -> agotada + mensaje de que la captura no sirve sin los datos mínimos, listando faltantes.
22. **Temporizador automático:** si no se pica "Iniciar captura", arranca solo al ingresar el primer parámetro, respetando el tiempo elegido/default.
23. **Pausa por toque en el timer:** picar el recuadro lo pausa y lo pone naranja; se reanuda al volver a picar o al continuar.
24. **Unidades múltiples (quitar "iguales" del texto):** al indicar cuántas propiedades se ofrecen, abrir captura individual + botón "Igualar todas desde valores globales". Al picarlo, cerrar las opciones individuales. Si NO son iguales, dejar la captura individual abierta.
25. **Eliminar "crear página madre del conjunto".**
26. **Características rápidas ampliadas:** mínimo ~50 opciones, todas positivas.

**Riesgo:** medio.

---

## FASE 6 — Limpieza de interfaz y textos (BAJA)

27. **Mascota idle en la pantalla de inicio**, hasta arriba.
28. **Quitar "Hauser · alimenta la base..."** al entrar a captura. Solo textos necesarios.
29. **Foto/Drive hasta abajo** y marcado pendiente (no conectado a Drive aún).
30. **Sugerencia de dirección más rápida** (reducir delay del autocompletado).

**Riesgo:** bajo.

---

## FASE 7 — Animaciones MP4 + sonido + vibración (MEDIA) ✅ COMPLETA

Claude Code DEBE guiar paso a paso al dueño para mover/renombrar/convertir los MP4.

31. **Integrar los MP4** reemplazando la mascota SVG. Respetar solo el tamaño del contenedor. Cambiar de animación según estado/tiempo.
32. **Sonido más fuerte y mejor.** Subir volumen base y probar tonos más perceptibles o muestras cortas en /assets/sounds/.
33. **Vibración** al terminar captura (Vibration API).

### Guía paso a paso para los MP4 (Claude Code la ejecuta con el dueño)

**Problema:** MP4 no tiene fondo transparente. La mascota se vería dentro de un recuadro. Para fondo transparente hay que convertir a **WebM con canal alpha** (o a Lottie/GIF según el caso).

Claude Code debe:

1. **Pedir al dueño la ruta completa de la carpeta** donde están los MP4 (sin nombres específicos).
2. **Listar los archivos** y pedir al dueño que confirme qué animación es cada uno (idle, walking, jogging, running, sad, celebrating).
3. **Guiar el renombrado** a nombres estándar: mascot-idle.mp4, mascot-walking.mp4, etc. Indicar el comando o acción manual exacta.
4. **Verificar si los MP4 tienen transparencia.** La mayoría NO. Si no la tienen:
   - Opción A (recomendada): convertir a WebM con alpha. Claude Code provee el comando ffmpeg exacto y guía la instalación de ffmpeg si falta. Ejemplo a adaptar:
     ffmpeg -i mascot-idle.mp4 -c:v libvpx-vp9 -pix_fmt yuva420p mascot-idle.webm
     (solo funciona si el MP4 ya trae alpha; si el fondo es sólido, ver opción B).
   - Opción B: si el MP4 tiene fondo sólido (p. ej. blanco), Claude Code guía a quitar el fondo (croma) o aceptar el recuadro, o regenerar como GIF transparente, o poner la mascota en una tarjeta con el mismo color de fondo.
5. **Colocar los archivos finales** en /assets/mascot/ dentro del repo.
6. **Escribir el código** que carga el video correcto según el estado (elemento video con autoplay loop muted playsinline, cambiando el src por estado), respetando prefers-reduced-motion.
7. **Verificar en navegador** que cada estado muestra su animación.

**Riesgo:** medio-alto. La transparencia es el punto delicado; Claude Code verifica el formato real antes de decidir la ruta de conversión.

**Lo que entró (F7-r1 → r4):** 5 MP4 en `mascota/` (idle, walking, jogging, running, sad, celebrating); `_setMascotVideo()` cambia src+load+play; `mix-blend-mode:multiply` + `darken` para running/sad; `data-state` para brightness por estado; `realElapsed()` para estrella 1 con tiempo real; mascota 160×160 en home y resultado; `preload=auto` + `muted` antes de play para iOS.

**Diferido a v0.7 (no más parches sobre blend-mode):**
- iOS Safari (iPhone 12 / iOS 26.5): autoplay manual requiere interacción — solución correcta es reexportar MP4 con fondo blanco limpio (o chroma key con canvas).
- Running y sad: fondo gris persistente — el fondo de esos MP4 no es blanco puro; `multiply`/`darken` no lo eliminan del todo. Solución en v0.7: reexportar con fondo #FFFFFF puro, o implementar chroma key con canvas + `getImageData`.
- Items 32 (sonido) y 33 (vibración) de esta fase no se implementaron.

---

## FASE 8 — Visual estilo Duolingo + modo oscuro (BAJA)

34. **Botón modo claro/oscuro** en el menú de inicio (sol/luna).
35. **Botones grandes, redondos, con color y efecto 3D** (sombra inferior sólida estilo Duolingo).
36. **Más animación y microinteracciones.**
37. **Soniditos** consistentes (ligado a Fase 7).
38. **Tipografía redondeada bold (Nunito), paleta vibrante, cards con borde físico.**

**Riesgo:** bajo en lógica, alto en volumen de CSS. No toca app.js.

---

## Orden de ejecución recomendado

1. Fase 1 (rentas/comisiones) — confirmar cambio en Notion primero.
2. Fase 2A (persistencia del asesor).
3. Fase 2B (ranking compartido) — solo si se activa.
4. Fase 3 (edición + historial unificado).
5. Fase 4 (contactos rediseñados) — por sub-pasos.
6. Fase 5 (flujo de captura).
7. Fase 6 (limpieza de textos).
8. Fase 7 (MP4 + sonido + vibración).
9. Fase 8 (visual Duolingo + dark mode).

---

## Estado de las fases

| Fase | Tema | Estado |
|---|---|---|
| 1 | Rentas y comisiones | ✅ Completa |
| 2A | Persistencia local del asesor | ✅ Completa |
| 2B | Ranking compartido (GAS) | ✅ Completa |
| 3 | Edición de capturas + historial | ✅ Completa |
| 4 | Contactos rediseñados | ✅ Completa |
| 5 | Flujo de captura | ✅ Completa |
| 6 | Limpieza de interfaz | ✅ Completa |
| 7 | Animaciones MP4 | ✅ Completa (iOS y fondos diferidos a v0.7) |
| 8 | Visual Duolingo + dark mode | ✅ Completa (microinteracciones Bloque 4; polish diferido a v0.7) |

---

## Pendientes que NO entran en v0.6 (para v0.7+)

- Lector de URL / captura desde portales como módulo aparte (skill propia del dueño).
- Conexión real con Google Drive para fotos.
- Conflicto de código PROP-3 (decisión pendiente desde v0.5).
- Campos de terreno (uso de suelo, estatus legal, servicios) como propiedades Notion vs. Notas.
- Si NO se activa la Fase 2B: ranking compartido entre dispositivos.

---

## Cambios que tocan la base de Notion Propiedades (confirmar antes)

- Ganancia de renta = precio de renta (campo o fórmula nueva).
- Tiempo mínimo de renta (6 meses / 1 año) — campo nuevo.
- Comisión de renta autocompletada con el primer mes.

---

> **v0.6 cerrada el 26 de junio de 2026. Pendientes diferidos a v0.7 documentados en CLAUDE.md.**
