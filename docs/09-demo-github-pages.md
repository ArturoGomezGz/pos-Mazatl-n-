# 09 · Demo publicable en GitHub Pages

Para poder ver y usar la interfaz sin instalar nada, existe un **build de solo
demostración** del cliente: la misma interfaz, con una **API simulada que corre
enteramente en el navegador** en vez de hablar con el servidor real.

## Por qué existe

GitHub Pages solo sirve archivos estáticos: no hay Node, no hay Express, no hay
SQLite ahí. El sistema real (`server/` + `client/` hablando entre sí) no puede
vivir en Pages tal cual. Pero se puede compilar el cliente contra una implementación
alterna del mismo contrato de API (`client/src/api/apiSimulada.ts`) que reproduce las
mismas reglas de negocio del servidor —dinero en centavos, reparto sin perder
centavos, autorización por PIN, idempotencia, cierre de caja— sobre datos en memoria
persistidos en `localStorage` del navegador de quien lo visita.

**No es el sistema real.** Es una maqueta fiel: sirve para ver y probar el flujo
completo con la interfaz de verdad, no para operar un restaurante. Cada visitante
tiene su propia copia de los datos, aislada en su navegador; nada se comparte ni
llega a ningún servidor.

## Qué funciona igual que en producción

Todo el flujo del mesero, caja y cocina responde de verdad al hacer clic:

- Ingreso por PIN con el mismo equipo de ejemplo (ver `docs/06-roadmap.md`).
- "Mis mesas", abrir mesa, capturar los cuatro estilos de venta, enviar comanda.
- Pantalla de cocina con las comandas reales que se acaban de enviar.
- Cobro, propina, dividir cuenta, repartir un platillo compartido.
- Caja: abrir turno, movimientos, corte con diferencia.
- Reportes calculados sobre lo que se haya capturado en esa sesión del navegador.
- Administración de menú, usuarios, configuración y estilo de la pantalla de venta.

## Qué es distinto a propósito

- **Los datos viven en el navegador de cada visitante**, vía `localStorage`. Cerrar
  la pestaña no borra nada; usar otro navegador o modo incógnito empieza de cero.
- Hay un aviso visible de "Modo demo" con un botón **Reiniciar demo** que borra los
  datos de ese navegador y vuelve a sembrar el comedor y menú de ejemplo.
- No hay red real: no se puede tumbar por Wi-Fi, ni observar latencia real, ni
  probar qué pasa si dos dispositivos físicos distintos chocan al mismo tiempo — la
  concurrencia entre pestañas del mismo navegador no está simulada.
- El editor del plano del comedor no se probó exhaustivamente en este modo; el
  camino principal (Mis mesas → tomar orden → cobrar → cocina → caja) es el que
  se verificó de punta a punta.

## Cómo se publica

`.github/workflows/pages.yml` compila `client` con `npm run build:mock` (que activa
`VITE_MOCK=1` vía `client/.env.mock`) y publica `client/dist` como página de
GitHub Pages en cada push a las ramas configuradas, o manualmente desde la pestaña
Actions del repositorio.

**Antes de que el link funcione, hay que activarlo una vez en el repositorio:**
Settings → Pages → Source → "GitHub Actions". Esto no lo puede hacer un push;
es un ajuste de configuración del repositorio.

Un detalle técnico necesario: GitHub Pages no reescribe rutas del lado del cliente.
Como esta aplicación usa React Router con rutas reales (`/orden/5`, `/cobro/12`),
recargar la página en una de esas rutas —o compartir el enlace directo— daría 404
sin ayuda. El workflow copia `index.html` como `404.html` después de compilar: es
el mecanismo estándar para que Pages sirva la aplicación completa en cualquier ruta,
con encabezado HTTP 404 pero contenido correcto (el navegador ve un 404 en la
pestaña de red y aun así renderiza la app con normalidad — es el comportamiento
esperado de este truco, no un error).

## Cómo correrlo localmente

```bash
npm run build:mock --workspace client
npx serve client/dist   # o cualquier servidor de archivos estáticos
```

## Mantenimiento

El menú, el comedor y el equipo de ejemplo de `apiSimulada.ts` reflejan exactamente
los mismos datos que siembra `server/src/db/semilla.ts`. Si el menú o el comedor de
ejemplo cambian en el servidor real, hay que reflejar el mismo cambio aquí para que
la demo no se desalinee de lo que el resto de la documentación describe.
