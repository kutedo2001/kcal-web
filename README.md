# Balanç

Web app de calorías, macros y actividad. Sin cuentas, sin pagos, sin servidor.
Los datos se guardan en el propio móvil de cada persona.

## Publicarla (5 minutos)

**Opción rápida — Netlify Drop**
1. Entra en `app.netlify.com/drop`.
2. Arrastra esta carpeta entera.
3. Te da una URL con HTTPS. Ya está.

**Opción estable — GitHub Pages**
1. Crea un repo, sube estos archivos a la raíz.
2. Settings → Pages → Source: `main` / `/root`.
3. Queda en `https://TUUSUARIO.github.io/REPO/`.

Hace falta **HTTPS** obligatoriamente: la cámara del escáner no funciona en `http://`.

## Instalarla en el móvil (importante)

**iPhone:** abrir la URL en Safari → botón compartir → *Añadir a pantalla de inicio*.
No es un capricho estético: Safari borra los datos de una web normal a los 7 días
sin usarla, pero respeta los de una web añadida a la pantalla de inicio.

**Android:** Chrome → menú → *Instalar aplicación*.

Cada móvil lleva sus propios datos. Tú y tu pareja usáis la misma URL pero cada
uno tiene su historial: no se ven entre vosotros. Si algún día quieres eso,
haría falta un backend (Supabase gratis, por ejemplo).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | estructura |
| `styles.css` | estilos |
| `app.js` | toda la lógica |
| `foods.js` | **base de alimentos y reglas de cocción — el que querrás tocar** |
| `sw.js` | caché para que abra sin conexión |
| `manifest.webmanifest` | metadatos de instalación |

## Añadir alimentos a la base

En `foods.js`, dentro del array `FOODS`:

```js
{ id:'lomo_adobado', n:'Lomo adobado', cl:'carne', kcal:150, p:22, c:1, f:6.5,
  units:[{n:'Filete (90 g)', g:90}] },
```

- `kcal, p, c, f` → por 100 g **del producto crudo o tal como se compra**.
- `cl` → clase de cocción: `simple`, `huevo`, `carne`, `pescado`, `cereal`,
  `arroz`, `legumbre`, `patata`, `verdura`.
- `units` → piezas típicas, para no tener que pesar.

Las reglas de cocción están arriba del mismo archivo, en `COOK_BY_CLASS`.
`y` es el rendimiento (peso cocinado ÷ peso crudo) y `oil` los gramos de aceite
que absorbe por cada 100 g en crudo. Si ves que algo no cuadra con tu sartén,
cambia el número ahí y afecta a todos los alimentos de esa clase.

Después de tocar cualquier archivo, sube el número de `CACHE` en `sw.js`
(`balanc-v1` → `balanc-v2`) o el móvil seguirá con la versión antigua.

## Copias de seguridad

Ajustes → *Descargar copia de seguridad*. Genera un `.json` con todo.
Hazlo una vez al mes y guárdalo donde quieras.

## Lo que no puede hacer una web

- **Leer Salud de Apple.** No existe API web para eso. Los pasos se escriben a
  mano: son cinco segundos al día y la app ya calcula las calorías.
- **Leer Symmetry.** No tiene exportación. El entrenamiento se apunta con tipo y
  minutos, y las calorías salen del MET y tu peso.
