# POS Mariscos Mazatlán

Sistema de punto de venta y gestión operativa para **Mariscos Mazatlán**, un
restaurante pequeño de mariscos. El objetivo del proyecto es que el negocio pueda
**administrarse solo**: dar de alta sus mesas, rediseñar su zona de comedor, cambiar
su menú y sacar su corte de caja sin depender de un proveedor externo.

## Estado

Fase de diseño. Todavía no hay código: primero se cierran alcance, requerimientos y
arquitectura.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) | Problema, usuarios, objetivos y qué queda fuera |
| [`docs/02-requerimientos.md`](docs/02-requerimientos.md) | Requerimientos funcionales (MoSCoW) y no funcionales |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Arquitectura "legacy web", despliegue y módulos |
| [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md) | Modelo entidad-relación y reglas de negocio en datos |
| [`docs/05-flujos-y-pantallas.md`](docs/05-flujos-y-pantallas.md) | Flujos de operación y bocetos de pantalla |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Entregas por fases, riesgos y criterios de aceptación |
| [`docs/adr/0001-stack-tecnologico.md`](docs/adr/0001-stack-tecnologico.md) | Decisión de stack (pendiente de confirmar) |

## Principio rector

> El dueño configura, el sistema obedece.
> Nada que el restaurante necesite cambiar semana a semana (mesas, menú, precios,
> disponibilidad, usuarios) debe requerir tocar código ni base de datos.
