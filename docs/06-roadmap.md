# 06 · Roadmap

Criterio de corte de cada fase: **el restaurante puede usar lo entregado en producción
real**. No entregamos mitades que obliguen a seguir con el sistema viejo.

---

## Fase 0 · Cimientos — **entregado**

- ✅ Monorepo, API Express con manejo central de errores y validación con Zod.
- ✅ Base SQLite con migraciones SQL versionadas que se aplican al arrancar.
- ✅ Sistema de estilos base (táctil, alto contraste).
- ✅ Pruebas automatizadas de la capa de servicio.
- ⏳ Ingreso por PIN, configuración del negocio y respaldo con un botón.

## Fase 1a · Editor del comedor — **entregado**

El módulo que motivó el proyecto, funcionando de punta a punta:

- ✅ Zonas, mesas (nombre, capacidad, forma) y referencias visuales.
- ✅ Arrastrar y redimensionar con dedo o ratón, ajuste a cuadrícula y zoom.
- ✅ Edición numérica precisa como respaldo del arrastre.
- ✅ Distribuciones múltiples, copiando una existente.
- ✅ Guardado por lote transaccional con aviso de cambios pendientes.
- ✅ Vista de salón con estados por color y refresco automático.

**Pendiente para cerrar el módulo:** unión de mesas (RF-1.7) y reservaciones (RF-1.10,
prevista para Fase 3).

---

## Fase 1b · MVP vendible — **entregado**

El restaurante ya puede operar un servicio completo sin el sistema anterior.

| Módulo | Entregado |
|---|---|
| Usuarios | ✅ Ingreso por PIN, cuatro roles, navegación distinta por rol, bitácora de acciones sensibles |
| Menú | ✅ Categorías, productos con **cuatro estilos de venta**, modificadores reutilizables, agotado del día |
| Órdenes | ✅ Abrir mesa, capturar, notas, comandas separadas por estación, envío idempotente |
| Cocina | ✅ Pantalla de comandas pendientes con alerta de demora y botón “listo” |
| Cuentas | ✅ Precuenta, división en partes iguales y por platillo, descuentos y propinas |
| Cobro | ✅ Efectivo con cambio, tarjeta, transferencia, pago mixto, cobro idempotente |
| Caja | ✅ Apertura de turno, entradas y salidas de efectivo, corte con diferencia |
| Reportes | ✅ Venta, ticket promedio, por método, más vendidos, por mesero, cancelaciones, exportación CSV |
| Configuración | ✅ Datos del negocio, IVA, propinas sugeridas y **estilo del menú con vista previa en vivo** |

**Pendiente de la fase:** impresión en impresora térmica (hoy se imprime por el
navegador) y respaldo con un botón.

## Fase 1c · El flujo del mesero en el teléfono — **entregado**

Una prueba de usabilidad recorrió los tres escenarios reales (cliente solo, grupo
que divide, mesas juntas) desde un teléfono. El dinero cuadró al centavo, pero la
interfaz no era usable en 390 px. Lo corregido:

- **El plano deja de ser el punto de entrada.** El mesero se sabe su salón; en el
  teléfono el mapa era un obstáculo (tres de siete mesas quedaban fuera de la
  pantalla y el arrastre abría mesas por error). El editor queda como herramienta
  de escritorio para el dueño y hay una vista de consulta opcional.
- **“Mis mesas”**: lista ordenada por urgencia —listo para servir, falta enviar a
  cocina, pidieron la cuenta, en servicio— con el total y el tiempo de cada mesa,
  y “+ Abrir mesa” con rejilla de códigos.
- **Captura y cobro usables en teléfono**: la orden y el cobro son hojas que suben
  desde abajo, con la acción principal anclada al pulgar.
- **Una mesa abierta por error se cierra** sin dejar la mesa ocupada para siempre.
- **Las cuentas vacías ya no cuelgan la mesa**: se descartan al cobrar la última
  cuenta con consumo.
- **Dividir salió del camino principal**: un enlace discreto al pie del ticket, con
  tres opciones en lenguaje de piso, incluida “repartir un platillo compartido”.

## Fase 1d · Prueba de estrés de día festivo — **entregado**

Una simulación de un 10 de mayo (grupos grandes, mesas sobre-capacidad, barra
saturada, varios meseros en paralelo, cocina desbordada, cierre en caliente) contra
la API real, con concurrencia forzada de verdad. Dictamen completo en
[`08-prueba-de-estres-festivo.md`](08-prueba-de-estres-festivo.md). Resumen:

- **Corregido, catastrófico:** cerrar una mesa abierta por error dejaba una cuenta
  huérfana que bloqueaba el cierre de caja para siempre, sin reparación posible desde
  la aplicación.
- **Corregido, grave:** un platillo se podía asociar a la cuenta de una mesa distinta
  sin aviso (validación ausente en "pasar a…" y "repartir…").
- **Corregido, grave:** la pantalla de cocina acumulaba comandas de mesas ya cobradas
  o canceladas para siempre.
- **Confirmado que resiste:** cinco condiciones de carrera reales (doble apertura de
  mesa, cobro y captura simultáneos, doble clic con y sin protección) se comportaron
  de forma segura gracias a que SQLite síncrono en un solo proceso serializa toda
  escritura — una restricción de arquitectura que hay que preservar, no un accidente.
- **Decisión consciente de no programar:** fusión formal de mesas y "mesas virtuales"
  para la barra. Ambas se resuelven con reglas de operación más baratas de mantener
  que el código que las reemplazaría. Justificación completa en el documento.
- Cuadre verificado: $13,430.00 generados en el servicio simulado, $0.00 de
  diferencia entre la suma manual y el reporte del sistema.
- 26 pruebas de reglas de negocio en verde (5 nuevas de esta ronda).

## Fase 2 · Cerrar la operación (2 semanas)

- **Impresión térmica** de comandas, precuenta, ticket y corte (validar antes el modelo).
- **Respaldo con un botón** y restauración asistida.
- Unión de mesas y transferencia de orden desde la interfaz.
- Reabrir cuenta cobrada desde la pantalla de cobro.
- Cortesías desde piso (el servicio ya existe; falta el botón).
- Propinas por mesero repartidas en el corte.

---

## Fase 3 · Inteligencia del negocio (a evaluar con datos reales)

- Distribuciones alternativas del comedor y elementos decorativos.
- Precio del día / venta por peso.
- Venta por hora y por día de la semana.
- Inventario ligero de insumos críticos (camarón, pulpo, cerveza) con descuento por
  venta y alerta de mínimos.
- Reservaciones.

---

## Fase 4 · Opcionales según decisión del cliente

- Facturación CFDI 4.0 con PAC (solo si el cliente factura).
- Consulta de reportes desde fuera del local (requiere exponer el servidor con cuidado).
- Segunda sucursal.

---

## Riesgos y cómo los atacamos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El personal rechaza el sistema en pleno servicio | Alto | Capacitación en horario muerto; una semana de operación en paralelo con el método actual |
| Corte de luz a media venta | Alto | UPS en servidor y router; escritura confirmada en disco antes de responder |
| Wi-Fi débil en terraza | Medio | Repetidor; idempotencia para que el reintento no duplique comandas ni cobros |
| Impresora térmica incompatible | Medio | Validar el modelo exacto **antes** de la Fase 1; salida alterna en pantalla |
| El alcance crece sin control | Medio | MoSCoW acordado por escrito; todo lo nuevo entra a Fase 3 |
| El equipo del local se moja o lo roban | Alto | Respaldo diario fuera del local; procedimiento de restauración probado |
| Se pide facturación a última hora | Medio | Modelo de datos ya guarda lo necesario; se cotiza aparte |

---

## Lo que necesitamos del cliente para arrancar

1. **Foto o croquis del comedor** con medidas aproximadas y número de mesas por zona.
2. **Menú completo actual** con precios, y cuáles tienen media orden o tamaños.
3. **Cuántas tablets y qué modelo**, y qué PC tienen en caja.
4. **Modelo de impresora** de tickets, si ya tienen una.
5. **Cómo cobran hoy**: ¿aceptan tarjeta?, ¿transferencia?, ¿cómo reparten propinas?
6. **Quién es el responsable del corte** y a qué hora cierran turno.
7. **¿Facturan?** Si sí, régimen fiscal y si ya tienen proveedor de timbrado.
