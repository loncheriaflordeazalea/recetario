# Recetario Flor de Azalea

Consultor de referencia rápida para el personal de cocina de Lonchería Flor
de Azalea. El empleado busca una receta, revisa el checklist de
ingredientes a reunir y luego sigue los pasos de preparación uno por uno,
estilo wizard.

No tiene login ni guarda progreso por empleado — es solo consulta.

- **Frontend**: HTML/CSS/JS vanilla, sin build step, hosteado en GitHub Pages.
- **Backend**: Google Apps Script Web App conectado a un Google Sheet (sin
  base de datos externa, sin costo).
- **Fuente de verdad del recetario**: el Google Sheet. El código no tiene
  recetas hardcodeadas más allá del seed inicial que lo puebla la primera vez.

## Estructura del repo

```
index.html        Pantallas: configuración, inicio, ingredientes, pasos, completado
app.js             Lógica de la app (fetch al backend, buscador/filtro, checklist, wizard)
styles.css         Estilos mobile-first (paleta ámbar/terracota)
apps-script/
  Code.gs          Código del backend (referencia — se despliega con clasp)
  appsscript.json  Manifiesto del proyecto de Apps Script
```

## 1. El Google Sheet (tabs)

El Apps Script crea y llena estas 3 pestañas automáticamente la primera vez
que alguien llama al backend (función `ensureSetup_` en `Code.gs`, invocada
dentro de `doGet`). Tú solo editas el contenido después — no hay interfaz
de administración en el frontend:

- **Recetas**: `receta_id, nombre, categoria, porciones, tiempo_prep, notas`
  - `categoria` es `Aguas` o `Cocina base` (el filtro del frontend usa estos
    dos valores; si agregas una categoría nueva, agrega también su botón en
    `index.html` / `app.js`).
- **Ingredientes**: `receta_id, ingrediente, cantidad, unidad`
  - Varias filas por `receta_id`, una por ingrediente.
- **Preparacion**: `receta_id, paso_num, instruccion`
  - Varias filas por `receta_id`, ordenadas por `paso_num`. El wizard del
    frontend las muestra en ese orden, una a la vez.

Para agregar, editar o quitar una receta, edita directamente estas tres
pestañas del Sheet — el frontend siempre lee desde ahí en cada carga.

## 2. Publicar el Apps Script

El proyecto ya está creado y desplegado con `clasp` (ver `apps-script/`).
Para volver a desplegar tras un cambio en `Code.gs`:

```bash
cd apps-script
clasp push
clasp deploy --description "descripción del cambio"
```

Configuración del Web App (ya definida en `appsscript.json`):
- **Ejecutar como**: Yo (el dueño del script)
- **Acceso**: Cualquiera

### Autorización manual (una sola vez)

La primera vez que el script accede al Spreadsheet, Google requiere que el
dueño autorice los permisos manualmente (esto **no** se puede automatizar
por API). Este mismo paso puebla el Sheet con las 29 recetas del seed,
porque `doGet` llama a `ensureSetup_` automáticamente. Pasos, con la sesión
de `loncheriaflordeazalea@gmail.com`:

1. Abre el proyecto en el editor de Apps Script.
2. En el menú de funciones (arriba), selecciona `doGet`.
3. Haz clic en **Ejecutar**.
4. Aparecerá "Se requiere autorización" → **Revisar permisos** → elige la
   cuenta `loncheriaflordeazalea@gmail.com` → si aparece "Google no verificó
   esta app", haz clic en **Avanzado** → **Ir a Recetario Flor de Azalea
   (no seguro)** → **Permitir**.
5. Después de esto, la URL del Web App (`.../exec`) queda accesible para
   cualquiera sin pedir login, y ya sirve JSON con las 3 tablas en vez de
   una página de "Acceso denegado".

Repite esto solo si el script se borra y se vuelve a crear desde cero.

## 3. Configurar la URL del backend (sin exponerla en el repo)

El repo **nunca** contiene la URL real del Web App — es un secreto de
despliegue, no del código fuente. La app la pide una sola vez por
dispositivo/navegador:

1. Abre la página del sitio (GitHub Pages) en el navegador.
2. Como no hay URL guardada todavía, verás la pantalla **"Configuración
   inicial"**.
3. Pega ahí la URL del Web App (`https://script.google.com/macros/s/AAAA.../exec`).
4. Se guarda en `localStorage` de ese navegador y no se vuelve a pedir.

Si necesitas resetear la URL en un dispositivo (por ejemplo, si rotaste el
deployment), abre la consola del navegador y ejecuta:

```js
localStorage.removeItem('far_backend_url');
```

## 4. Activar GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from
a branch → Branch: `main` / `/ (root)` → Save**.

El sitio queda publicado en `https://loncheriaflordeazalea.github.io/recetario/`.

## Categorías válidas

`Aguas`, `Cocina base`.
