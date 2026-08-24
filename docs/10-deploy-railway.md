# 10 · Desplegar el sistema real en Railway

Este documento describe cómo levantar el sistema real (servidor + cliente,
hablando con SQLite de verdad) en [Railway](https://railway.app) como un solo
servicio. No es el modo demo de `docs/09-demo-github-pages.md`: aquí sí hay un
servidor Express y una base de datos persistente, igual que en el mini-PC del
restaurante.

## Cómo queda armado

Railway construye y corre **un solo servicio Node** que sirve dos cosas:

- La API real bajo `/api/*` (Express + SQLite vía Drizzle), igual que en local.
- El build estático del cliente (`client/dist`), servido por el mismo Express
  para cualquier ruta que no empiece con `/api`. Esto evita tener que correr
  dos servicios y lidiar con CORS entre ellos: el navegador pide todo al mismo
  origen.

Esto lo resuelve `server/src/app.ts`: si existe la carpeta `client/dist` junto
al servidor, la sirve con `express.static` y responde `index.html` para las
rutas de React Router (`/mesas`, `/orden/5`, etc.).

`railway.json` en la raíz del repo le dice a Railway:

- `build.buildCommand`: `npm run build` (compila servidor y cliente).
- `deploy.startCommand`: `npm run start` (corre `node server/dist/index.js`,
  que migra la base de datos al arrancar y luego levanta Express).
- `deploy.healthcheckPath`: `/api/salud`.

Railway detecta Node automáticamente (Nixpacks) y usa `package-lock.json` de
la raíz para instalar dependencias del monorepo (`npm ci`).

## Pasos para desplegar

1. En Railway: **New Project → Deploy from GitHub repo** y elige este
   repositorio (rama a desplegar: la que tenga estos cambios, o `master` una
   vez que se mergeen).
2. Railway detecta `railway.json` solo; no hace falta tocar el build/start a
   mano.
3. **Agregar un volumen** para que la base de datos sobreviva a los redeploys
   (el sistema de archivos del contenedor es efímero; sin volumen, cada deploy
   borra los datos):
   - En el servicio: **Settings → Volumes → New Volume**.
   - Mount path: `/data`.
4. **Variables de entorno** del servicio (Settings → Variables):
   - `DB_RUTA` = `/data/pos.sqlite` (para que la base viva en el volumen).
   - `NODE_ENV` = `production`.
   - Railway ya inyecta `PORT` automáticamente; el servidor lo respeta
     (`server/src/config.ts`), no hay que fijarlo a mano.
   - `CORS_ORIGEN` no es necesario: como el cliente se sirve desde el mismo
     origen que la API, no hay peticiones cross-origin que el navegador deba
     autorizar. Solo defínela si vas a consumir la API desde otro dominio.
5. Primer deploy: Railway corre `npm run build` y luego `npm run start`. Al
   arrancar, el servidor **migra y siembra la base de datos automáticamente**
   (`server/src/index.ts` llama a `migrar()` y luego a `sembrar()`), así que la
   primera vez crea las tablas y el equipo/menú/comedor de ejemplo solo, sin
   necesidad de correr nada a mano ni tener la CLI de Railway instalada.
   `sembrar()` (`server/src/db/semilla.ts`) es idempotente: revisa si ya hay
   datos antes de insertar, así que en cada reinicio o redeploy posterior no
   duplica nada — se puede llamar en cada arranque sin riesgo.
6. Abre el dominio que Railway asigna (o el dominio propio que configures) y
   entra con cualquiera de los PINs de `docs/09-demo-github-pages.md` /
   `README.md` para verificar el flujo completo: Mis mesas → tomar orden →
   enviar comanda → cocina → cobrar → caja.

## Notas

- El volumen es indispensable: sin él, cada redeploy (o reinicio del
  contenedor) empieza con una base de datos nueva y vacía.
- Si más adelante se despliega más de una réplica del mismo servicio, SQLite
  con un único archivo en un volumen no soporta escrituras concurrentes desde
  múltiples contenedores; este esquema asume **una sola instancia**, que es
  el mismo supuesto que ya tiene el sistema en el restaurante.
- `npm run db:migrate --workspace server` sigue disponible si en algún punto
  se prefiere migrar a mano en vez de dejar que el arranque lo haga solo.
