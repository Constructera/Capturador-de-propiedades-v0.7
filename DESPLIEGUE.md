# Capturador de propiedades — Despliegue y operación

Guía para poner en marcha la herramienta de captura de propiedades de **Hauser / Inmobitera**, desde archivo suelto hasta app instalable en el celular.

---

## Estructura de archivos

```
capturador/
├── index.html        ← la app (estructura + estilos)
├── app.js            ← toda la lógica
├── manifest.json     ← convierte el sitio en app instalable (PWA)
├── sw.js             ← service worker (funciona sin internet)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── backend/
    └── Code.gs       ← backend gratuito (Google Apps Script)
```

Sube **todo** a un mismo repositorio. La app funciona aunque no configures el backend (queda en modo local).

---

## Paso 1 — Subir a GitHub Pages (gratis)

1. Crea una cuenta en github.com (si no tienes).
2. Crea un repositorio nuevo, por ejemplo `capturador-hauser`. Márcalo **Public**.
3. Sube los archivos: botón **Add file → Upload files**, arrastra `index.html`, `app.js`, `manifest.json`, `sw.js` y la carpeta `icons`. Confirma con **Commit changes**.
4. Ve a **Settings → Pages**.
5. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
6. Espera 1–2 minutos. GitHub te dará una URL como:
   `https://TU_USUARIO.github.io/capturador-hauser/`

Esa URL ya es tu app en vivo.

---

## Paso 2 — Probarla en el celular

1. Abre la URL en **Chrome (Android)** o **Safari (iPhone)**.
2. Prueba lo importante en campo:
   - 📍 **Usar mi ubicación** → debe pedir permiso y llenar coordenadas + link de Maps.
   - 🗺️ **Elegir en el mapa** → abre el mapa, tocas el punto.
   - Escribir dirección → aparecen sugerencias reales.
   - Buscar zona → aparecen las existentes o la opción de crearla.

> El mapa y la ubicación **solo funcionan sobre HTTPS** (GitHub Pages ya es HTTPS) o abriendo el archivo directo en el navegador del celular. Dentro de Claude no cargan por restricción de red; eso es normal.

---

## Paso 3 — Instalarla como app (PWA)

**Android / Chrome:** menú ⋮ → **Agregar a pantalla de inicio** → Instalar.
**iPhone / Safari:** botón Compartir → **Agregar a pantalla de inicio**.

Queda con ícono propio, pantalla completa y funciona sin internet (el formulario y el historial son locales; el mapa y la IA requieren conexión).

---

## Paso 4 — Backend gratuito (opcional pero recomendado)

Sin backend, la app guarda el historial **solo en cada dispositivo** y la lectura de anuncios funciona únicamente dentro de Claude. El backend resuelve tres cosas: **historial central**, **zonas reales compartidas** y **carpetas de Drive automáticas**.

La opción más estable y 100% gratis es **Google Apps Script** (corre dentro de tu propia cuenta de Google, sin tarjeta).

### Instalación

1. Entra a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra el contenido y pega todo el archivo `backend/Code.gs`.
3. (Opcional) crea un Google Sheet vacío, copia su ID de la URL y pégalo en `SHEET_ID`. Si lo dejas vacío, el script crea uno solo la primera vez.
4. Ajusta `DRIVE_ROOT` con el nombre de tu carpeta madre de fotos.
5. **Implementar → Nueva implementación → Tipo: Aplicación web.**
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquiera**.
6. Autoriza los permisos (Drive + Sheets). Copia la **URL del /exec**.
7. En la app, ve a **⚙️ Configuración**, pega esa URL en *Endpoint del backend* y toca **Probar conexión**. Debe decir "✓ Conectado".

A partir de ahí: el historial se sincroniza a tu Sheet, el botón "Crear carpeta Drive" funciona de verdad, y las zonas se comparten entre el equipo.

> **Lectura de anuncios desde el celular:** si además pones tu `ANTHROPIC_KEY` en el backend, la app puede leer publicaciones sin estar dentro de Claude. La key queda en *tu* servidor de Apps Script, nunca en el HTML público. (Si no la pones, la lectura sigue funcionando dentro de Claude.)

---

## Conexión con Notion

El flujo actual es **con aprobación humana** (como pediste): la app genera el Markdown y tú (o quien capture) lo pega en el chat del agente de Notion, que crea la página y las relaciones. No se escribe directo en Notion todavía.

El Markdown ya viene en formato compatible con los tipos de campo reales de tu base 🏠 Propiedades, con tabla `Campo | Tipo | Valor | Nota` y reglas para relaciones (Zona, Contactos, Operaciones, Tareas).

Conectar la app **directo** a la API de Notion es el siguiente paso (ver pendientes en el otro documento).

---

## Modo local vs. modo conectado — resumen

| Función | Sin backend (local) | Con backend Apps Script |
|---|---|---|
| Capturar y generar Markdown | ✅ | ✅ |
| Historial | ✅ solo en ese celular | ✅ central en Sheets |
| Zonas inteligentes | ✅ semilla + locales | ✅ compartidas del equipo |
| Carpeta de Drive | 📝 instrucción en Markdown | ✅ creación real con link |
| Leer anuncios | solo dentro de Claude | ✅ desde el celular (con API key) |
| Mapa / ubicación | ✅ (requiere HTTPS) | ✅ |

---

## Si algo falla

- **El mapa no carga en el celular:** confirma que abriste la URL `https://…github.io/…` (no un archivo local). El HTTPS es obligatorio para geolocalización.
- **"No respondió" al probar el backend:** revisa que la implementación esté como "Cualquiera" y que copiaste la URL que termina en `/exec`.
- **No aparece "Agregar a pantalla de inicio":** recarga la página una vez ya cargada; el `manifest.json` y `sw.js` deben estar en la misma carpeta que `index.html`.
