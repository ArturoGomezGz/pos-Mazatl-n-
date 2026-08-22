# 06 · Roadmap

Criterio de corte de cada fase: **el restaurante puede usar lo entregado en producción
real**. No entregamos mitades que obliguen a seguir con el sistema viejo.

---

## Fase 0 · Cimientos (1 semana)

- Esqueleto de la aplicación, enrutador, sesión y roles.
- Migraciones SQL versionadas.
- Ingreso por PIN.
- Configuración del negocio y respaldo con un botón.
- Hoja de estilos base con las tres pieles (piso, caja, administración).

**Entregable:** se puede entrar al sistema y configurar los datos del negocio.

---

## Fase 1 · MVP vendible (3–4 semanas)

Lo mínimo para que el restaurante **deje de usar lo que usa hoy**.

| Módulo | Alcance |
|---|---|
| Comedor | Zonas, mesas, editor de plano con arrastre, estados por color |
| Menú | Categorías, productos, variantes de precio, marcar agotado |
| Órdenes | Abrir mesa, capturar, enviar comanda, cancelar con autorización |
| Cuentas | Precuenta, cobro efectivo/tarjeta/transferencia, ticket impreso |
| Caja | Abrir y cerrar turno con arqueo y diferencia |
| Reportes | Venta del día, por método de pago |
| Seguridad | Roles, bitácora de acciones sensibles |

**Criterios de aceptación**
- El dueño monta el plano completo del comedor sin ayuda.
- Un servicio completo de un sábado se opera sin volver al sistema anterior.
- El corte de caja cuadra con el conteo físico.
- Se puede vender con el internet desconectado.

---

## Fase 2 · Operación fina (2–3 semanas)

- Modificadores y notas por platillo.
- División de cuentas (por partes y por platillo) y pago mixto.
- Propinas por mesero.
- Pantalla de cocina y comandas por estación.
- Unión de mesas.
- Descuentos y cortesías con autorización.
- Reportes: productos más vendidos, venta por mesero, cancelaciones.
- Exportación a CSV.

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
