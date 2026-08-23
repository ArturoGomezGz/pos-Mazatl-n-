# POS Mariscos Mazatlán

Sistema de punto de venta y gestión operativa para **Mariscos Mazatlán**, un restaurante
pequeño de mariscos. El objetivo es que el negocio pueda **administrarse solo**: diseñar
su comedor, dar de alta mesas, cambiar su menú y sacar su corte sin depender de un
proveedor externo.

> **Principio rector:** el dueño configura, el sistema obedece.
> Nada que el restaurante cambie semana a semana (mesas, menú, precios, disponibilidad,
> usuarios) debe requerir tocar código ni base de datos.

## Estado

**Fase 1 en curso.** Está funcionando el módulo que motivó el proyecto:

- ✅ **Editor de plano del comedor**: zonas, mesas y referencias visuales; arrastrar y
  redimensionar con dedo o ratón, ajuste a cuadrícula, zoom, edición numérica precisa,
  duplicar, y guardado por lote con aviso de cambios pendientes.
- ✅ **Distribuciones múltiples** ("Normal", "Temporada alta"): la misma mesa en dos
  acomodos distintos, sin duplicar mesas ni perder su identidad.
- ✅ **Vista de salón** (lo que verá el mesero): mesas por estado y color, refresco
  automático.
- ⏳ Menú, órdenes, cuentas, caja y reportes: siguientes entregas del roadmap.

## Cómo correrlo

Requiere **Node.js 20 o superior**.

```bash
npm install
npm run db:seed     # crea la base y un comedor de ejemplo
npm run dev         # API en :3001 y cliente en :5173
```

Abre <http://localhost:5173>. Desde una tablet en la misma red, usa la IP del servidor.

```bash
npm test            # pruebas del módulo salón
npm run check       # verificación de tipos
npm run build       # compila API y cliente para producción
```

## Arquitectura en una línea

Node 22 + Express 5 + TypeScript sobre SQLite (Drizzle ORM), cliente React 19 + Vite,
todo corriendo **en el propio restaurante** para poder vender sin internet.

## Estructura

```
server/    API REST, base de datos y reglas de negocio
client/    Interfaz web (editor de plano y vista de salón)
docs/      Diseño del producto: alcance, requerimientos, arquitectura, roadmap
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) | Problema, usuarios, objetivos y qué queda fuera |
| [`docs/02-requerimientos.md`](docs/02-requerimientos.md) | Requerimientos funcionales (MoSCoW) y no funcionales |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Stack, despliegue, estructura del código y módulo de salón |
| [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md) | Modelo entidad-relación completo y reglas de negocio |
| [`docs/05-flujos-y-pantallas.md`](docs/05-flujos-y-pantallas.md) | Flujos de operación y bocetos por rol |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Entregas por fases, riesgos e insumos requeridos |
| [`docs/adr/0001-stack-tecnologico.md`](docs/adr/0001-stack-tecnologico.md) | Decisión de stack y alternativas descartadas |
