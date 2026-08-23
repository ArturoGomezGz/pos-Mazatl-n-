# ADR-0001 · Stack tecnológico

- **Estado:** aceptado
- **Fecha:** 2026-08-23

## Contexto

El sistema debe operar sin internet con el servidor en el propio local (RNF-3), correr
en tablets económicas (RNF-2), instalarse sin personal técnico (RNF-8) y ser mantenible
por un solo desarrollador (RNF-11). El presupuesto es bajo.

Una nota sobre el arranque del proyecto: la conversación inicial mencionó "legacy web" y
el primer boceto se diseñó como aplicación clásica renderizada en servidor. Fue un
malentendido: la decisión del equipo es **web moderna**. Este ADR refleja la decisión
real y reemplaza aquel enfoque.

## Decisión

**Node.js 22 + Express 5 + TypeScript** en el servidor, **React 19 + Vite 8** en el
cliente, **SQLite con Drizzle ORM** como base de datos y **Zod 4** para validar toda
entrada.

### Por qué Express

Elegido por el equipo. Es un framework mínimo y estable, con el ecosistema más grande de
Node: lo que se necesita para un API REST de este tamaño. Frente a alternativas más
opinadas (NestJS, Fastify) gana en simplicidad y en cantidad de gente que puede
mantenerlo si el cliente cambia de proveedor.

### Por qué React en el cliente

El editor de plano es interfaz con estado real: selección, arrastre, cambios pendientes,
deshacer. Renderizar eso en el servidor sería pelearse con la herramienta. React resuelve
exactamente este problema y Vite da un entorno de desarrollo inmediato.

### Por qué SQLite y no PostgreSQL

| A favor | En contra |
|---|---|
| La base es **un archivo**: respaldar es copiarlo; restaurar es pegarlo | Escrituras serializadas (irrelevante con 30 mesas y 5 terminales) |
| Sin servicio extra que instalar, monitorear ni reiniciar en el mini-PC | Menos herramientas de análisis que Postgres |
| Con `WAL` + `synchronous = FULL` da durabilidad real ante corte de luz | |
| Un restaurante pequeño genera decenas de miles de renglones al año, no millones | |

**Es una decisión reversible.** Drizzle habla también con PostgreSQL; si algún día hay
segunda sucursal o reportes pesados, se migra el dialecto sin reescribir la aplicación.

### Por qué Drizzle y no Prisma

Drizzle es una capa fina sobre SQL: sin proceso de generación de cliente, sin motor
binario aparte, y las consultas se leen como las consultas que son. Para un sistema que
debe seguir compilando dentro de cinco años en un mini-PC, menos maquinaria es mejor.

### Por qué migraciones SQL propias

Se descartó `drizzle-kit` (además, arrastraba dependencias con vulnerabilidades conocidas
en el momento de instalar). El migrador propio son 30 líneas: aplica en orden los
archivos `.sql` pendientes y los registra. El SQL queda legible y revisable para siempre,
y se ejecuta solo al arrancar el servidor porque en el restaurante nadie va a correr
comandos de mantenimiento.

### Por qué CSS propio y no un framework de UI

Las reglas de este producto son específicas: 48 px mínimos de área táctil, alto contraste
para sol directo, colores de estado que se aprenden en un turno. Un framework genérico
habría que pelearlo más de lo que ayuda. El sistema de diseño cabe en un archivo con
variables CSS.

## Consecuencias

- El servidor del local necesita **solo Node.js**. Instalación: copiar la carpeta,
  `npm ci`, `npm run build`, arrancar como servicio.
- En producción, un único proceso Node sirve el API y los archivos compilados del cliente.
- Respaldo = copiar `data/pos.sqlite` (y su `-wal`). Simple de automatizar y de explicar.
- Si el negocio crece a varias sucursales, el cambio a PostgreSQL es un cambio de
  dialecto, no una reescritura.

## Pendientes que este ADR no resuelve

1. ¿El servidor del local será Windows o Linux? (afecta al instalador, no al código)
2. Modelo exacto de impresora térmica: define la biblioteca de impresión.
3. ¿Cómo se publica el sistema en la red local? (`pos.local` por mDNS o IP fija)
