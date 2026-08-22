# 02 · Requerimientos

Prioridad con **MoSCoW**: `M` imprescindible (MVP), `S` importante, `C` deseable,
`W` no ahora.

---

## RF-1 · Gestión del comedor (el diferenciador del proyecto)

| ID | Requerimiento | Prio |
|---|---|---|
| RF-1.1 | El administrador puede crear, renombrar y eliminar **zonas** (Terraza, Salón, Barra, Palapa) | M |
| RF-1.2 | El administrador puede crear mesas con **nombre/número, capacidad y forma** (redonda, cuadrada, rectangular, barra) | M |
| RF-1.3 | El administrador puede **arrastrar mesas sobre un plano** y guardar su posición | M |
| RF-1.4 | El plano se ajusta a una **cuadrícula** para que quede alineado sin esfuerzo | M |
| RF-1.5 | Cada mesa muestra su **estado por color**: libre, ocupada, cuenta pedida, por limpiar, reservada | M |
| RF-1.6 | El administrador puede **desactivar** una mesa sin borrarla (temporada baja) | S |
| RF-1.7 | El mesero puede **juntar mesas** en una sola cuenta y separarlas después | S |
| RF-1.8 | Se pueden guardar **distribuciones alternativas** del comedor (ej. "Normal", "Evento", "Temporada alta") y cambiar entre ellas | C |
| RF-1.9 | El plano acepta **elementos decorativos no vendibles** (barra, baño, cocina, escalón) para orientar al mesero | C |
| RF-1.10 | Reservaciones con nombre, hora y mesa asignada | W |

**Nota de diseño:** este módulo es el que justifica el proyecto. Debe funcionar con el
dedo en una tablet, no solo con mouse.

---

## RF-2 · Menú y catálogo

| ID | Requerimiento | Prio |
|---|---|---|
| RF-2.1 | Categorías ordenables (Botanas, Cocteles, Filetes, Bebidas, Cervezas...) | M |
| RF-2.2 | Productos con nombre, categoría, precio, descripción corta y estación de preparación (cocina / barra) | M |
| RF-2.3 | **Variantes de tamaño** con precio propio: chico / mediano / grande, orden / media orden | M |
| RF-2.4 | **Marcar producto como agotado del día** en un toque, desde piso o cocina | M |
| RF-2.5 | **Modificadores** agrupados: término, sin cebolla, extra limón, aguacate extra (+$), estilo de preparación | S |
| RF-2.6 | Precio por temporada / precio variable ("precio del día" para pescado y camarón) | S |
| RF-2.7 | Producto de venta por peso o precio abierto (mariscada del día) | S |
| RF-2.8 | Paquetes o combos | C |
| RF-2.9 | Foto del producto | C |
| RF-2.10 | Historial de cambios de precio | C |

---

## RF-3 · Toma de orden y comandas

| ID | Requerimiento | Prio |
|---|---|---|
| RF-3.1 | Abrir mesa indicando número de comensales y mesero responsable | M |
| RF-3.2 | Agregar productos a la orden con cantidad, variante y modificadores | M |
| RF-3.3 | Nota libre por platillo ("sin sal", "para la niña") | M |
| RF-3.4 | Enviar orden a cocina/barra: genera **comanda** y bloquea edición de esas líneas | M |
| RF-3.5 | Agregar productos en rondas sucesivas a la misma orden | M |
| RF-3.6 | Cancelar un platillo enviado, con **motivo y autorización de cajero/admin** | M |
| RF-3.7 | Pantalla de cocina con comandas pendientes y botón "listo" | S |
| RF-3.8 | Impresión de comanda por estación (cocina / barra) | S |
| RF-3.9 | Marcar platillo como cortesía o merma | S |
| RF-3.10 | Transferir la orden a otra mesa | S |
| RF-3.11 | Tiempos de preparación y alerta de comanda demorada | C |

---

## RF-4 · Cuentas y cobro

| ID | Requerimiento | Prio |
|---|---|---|
| RF-4.1 | Ver la cuenta de la mesa con subtotal y total | M |
| RF-4.2 | Imprimir precuenta (no fiscal) | M |
| RF-4.3 | Cobrar en efectivo con cálculo de cambio | M |
| RF-4.4 | Cobrar con tarjeta y transferencia; registrar referencia | M |
| RF-4.5 | **Pago mixto** (parte efectivo, parte tarjeta) | S |
| RF-4.6 | **Dividir cuenta**: por partes iguales y por selección de platillos | S |
| RF-4.7 | Registrar propina (monto o %) y a qué mesero corresponde | S |
| RF-4.8 | Descuentos con motivo y autorización | S |
| RF-4.9 | Reabrir una cuenta cerrada (con autorización y bitácora) | S |
| RF-4.10 | Ticket con datos del negocio, folio, mesa, mesero y desglose | M |

---

## RF-5 · Caja y turnos

| ID | Requerimiento | Prio |
|---|---|---|
| RF-5.1 | Abrir turno con fondo de caja y usuario responsable | M |
| RF-5.2 | Registrar entradas y salidas de efectivo (retiros, gastos, propinas pagadas) | S |
| RF-5.3 | Cerrar turno: total esperado por método, conteo declarado y **diferencia** | M |
| RF-5.4 | Imprimir corte de caja (X = parcial, Z = cierre) | S |
| RF-5.5 | Impedir cobrar con el turno cerrado | M |

---

## RF-6 · Reportes

| ID | Requerimiento | Prio |
|---|---|---|
| RF-6.1 | Venta del día: total, número de cuentas, ticket promedio | M |
| RF-6.2 | Venta por método de pago | M |
| RF-6.3 | Productos más vendidos (día / semana / mes) | S |
| RF-6.4 | Venta por mesero y propinas acumuladas | S |
| RF-6.5 | Cancelaciones, descuentos y cortesías, con quién autorizó | S |
| RF-6.6 | Venta por hora (para decidir horarios y personal) | C |
| RF-6.7 | Exportar a CSV / Excel | S |

---

## RF-7 · Usuarios y seguridad

| ID | Requerimiento | Prio |
|---|---|---|
| RF-7.1 | Roles: administrador, cajero, mesero, cocina | M |
| RF-7.2 | Acceso rápido con **PIN de 4-6 dígitos** por usuario (no escribir contraseñas con las manos mojadas) | M |
| RF-7.3 | El mesero solo ve sus mesas; el cajero ve todas | S |
| RF-7.4 | Acciones sensibles (cancelar, descontar, reabrir, cambiar precio) exigen PIN de un rol autorizado | M |
| RF-7.5 | **Bitácora** de acciones sensibles: quién, qué, cuándo | M |
| RF-7.6 | Baja de usuario sin borrar su historial de ventas | M |

---

## RF-8 · Configuración del negocio

| ID | Requerimiento | Prio |
|---|---|---|
| RF-8.1 | Datos del negocio: nombre, dirección, teléfono, logo del ticket | M |
| RF-8.2 | Configurar impuestos y si los precios ya los incluyen | M |
| RF-8.3 | Configurar impresoras por estación | S |
| RF-8.4 | Respaldo de base de datos con un botón y restauración asistida | M |

---

## Requerimientos no funcionales

| ID | Requerimiento | Criterio verificable |
|---|---|---|
| RNF-1 **Legacy web** | Aplicación web renderizada en servidor, multi-página, sin dependencia de frameworks pesados ni de un build complejo | Funciona con JavaScript limitado; cada acción crítica tiene equivalente en formulario HTML |
| RNF-2 **Compatibilidad** | Debe correr en navegadores de tablets Android económicas y PCs viejas | Chrome/WebView 80+, sin APIs modernas obligatorias |
| RNF-3 **Operación sin internet** | El servicio corre en la red local del restaurante | Se puede vender con el módem desconectado |
| RNF-4 **Rendimiento** | Respuesta percibida < 1 s en acciones de piso | Medido en la tablet más lenta del local, con 30 mesas y 5000 productos-línea |
| RNF-5 **Usabilidad táctil** | Botones ≥ 48×48 px, alto contraste, legible bajo sol | Prueba con el personal real |
| RNF-6 **Resiliencia** | Un corte de luz no debe perder órdenes ya enviadas | Toda comanda enviada está confirmada en disco antes de responder |
| RNF-7 **Respaldos** | Respaldo automático diario y copia fuera del equipo | Restauración probada al menos una vez por trimestre |
| RNF-8 **Instalación simple** | Instalable por una persona no técnica siguiendo un instructivo | Guion de instalación de un solo comando |
| RNF-9 **Idioma y formato** | Español mexicano, moneda MXN, zona horaria America/Mazatlan | — |
| RNF-10 **Auditabilidad** | Ninguna venta se borra: se cancela dejando rastro | Registros de venta inmutables tras el cierre |
| RNF-11 **Mantenibilidad** | Un desarrollador nuevo entiende el sistema en una tarde | Código sin capas innecesarias, documentado aquí |
