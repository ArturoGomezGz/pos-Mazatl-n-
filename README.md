# POS Mariscos Mazatlán

Sistema de punto de venta y gestión operativa para **Mariscos Mazatlán**, un restaurante
pequeño de mariscos. El objetivo es que el negocio pueda **administrarse solo**: diseñar
su comedor, definir su menú, tomar órdenes, cobrar y sacar su corte sin depender de un
proveedor externo.

> **Principio rector:** el dueño configura, el sistema obedece.
> Nada que el restaurante cambie semana a semana —mesas, menú, precios, disponibilidad,
> personal, incluso el aspecto de la pantalla de venta— debe requerir tocar código.

## Estado: MVP operativo completo

Un servicio de un sábado se puede operar de punta a punta.

- **Ingreso por PIN** con cuatro roles (dueño, cajero, mesero, cocina). Cada rol ve solo
  lo suyo.
- **Editor del comedor**: zonas, mesas y referencias visuales; arrastrar y redimensionar
  con el dedo, ajuste a cuadrícula, y distribuciones alternativas (“Normal”, “Temporada
  alta”) sin duplicar mesas.
- **Menú flexible**: cuatro estilos de venta (precio único, varios tamaños, por peso,
  precio del día), modificadores reutilizables, y **agotado del día** en un toque desde
  piso o cocina. El aspecto de la pantalla de venta se configura con vista previa en vivo.
  Ver [`docs/07-menu-flexible.md`](docs/07-menu-flexible.md).
- **Toma de orden** por mesa, con notas, y envío a **cocina y barra por separado**.
- **Pantalla de cocina** con comandas por antigüedad, alerta de demora y un solo botón.
- **Cuentas y cobro**: precuenta, división en partes iguales o por platillo, descuentos
  con autorización, propinas, efectivo con cambio, tarjeta, transferencia y pago mixto.
- **Caja**: apertura de turno, entradas y salidas de efectivo, corte con la diferencia
  registrada tal cual.
- **Reportes**: venta, ticket promedio, por método de pago, más vendidos, por mesero,
  cancelaciones y cortesías. Exportación a CSV.
- **Bitácora** de todo lo sensible: quién canceló, quién descontó, quién autorizó.

Pendiente para cerrar la fase: impresión en impresora térmica (hoy se imprime por el
navegador) y respaldo con un botón. Ver [`docs/06-roadmap.md`](docs/06-roadmap.md).

## Cómo correrlo

Requiere **Node.js 20 o superior**.

```bash
npm install
npm run db:seed     # crea la base y el usuario administrador inicial
npm run dev         # API en :3001 y cliente en :5173
```

Abre <http://localhost:5173>. Desde una tablet en la misma red, usa la IP del servidor.

PIN inicial:

| Persona | Rol | PIN |
|---|---|---|
| Administrador | Administrador | `1234` |

```bash
npm test            # pruebas de las reglas de negocio
npm run check       # verificación de tipos
npm run build       # compila API y cliente para producción
```

## Arquitectura en una línea

Node 22 + Express 5 + TypeScript sobre SQLite (Drizzle ORM), cliente React 19 + Vite,
todo corriendo **en el propio restaurante** para poder vender sin internet.

## Estructura

```
server/    API REST, base de datos y reglas de negocio
client/    Interfaz web (piso, caja, cocina y administración)
docs/      Diseño del producto: alcance, requerimientos, arquitectura, roadmap
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) | Problema, usuarios, objetivos y qué queda fuera |
| [`docs/02-requerimientos.md`](docs/02-requerimientos.md) | Requerimientos funcionales (MoSCoW) y no funcionales |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Stack, despliegue, estructura del código y módulos |
| [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md) | Modelo entidad-relación y reglas de negocio |
| [`docs/05-flujos-y-pantallas.md`](docs/05-flujos-y-pantallas.md) | Flujos de operación y bocetos por rol |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Entregas por fases, riesgos e insumos requeridos |
| [`docs/07-menu-flexible.md`](docs/07-menu-flexible.md) | Los cuatro estilos de venta y el estilo visual configurable |
| [`docs/08-prueba-de-estres-festivo.md`](docs/08-prueba-de-estres-festivo.md) | Prueba de estrés de día festivo: hallazgos, correcciones y decisiones estratégicas |
| [`docs/09-demo-github-pages.md`](docs/09-demo-github-pages.md) | Cómo funciona y se publica la demo sin servidor en GitHub Pages |
| [`docs/adr/0001-stack-tecnologico.md`](docs/adr/0001-stack-tecnologico.md) | Decisión de stack y alternativas descartadas |
