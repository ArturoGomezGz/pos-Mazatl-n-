# 01 · Visión y alcance

## 1. El problema

Mariscos Mazatlán opera hoy con herramientas que no se adaptan a cómo funciona
realmente un restaurante de mariscos pequeño:

1. **No pueden gestionar sus mesas.** Dar de alta una mesa, quitarla, juntar dos para
   un grupo de 8 o mover la terraza en temporada alta requiere pedirle el cambio a
   alguien más. La distribución física del local cambia y el sistema no.
2. **No pueden rediseñar su zona.** No existe un plano del comedor: el mesero trabaja
   con una lista de números que no corresponde a lo que ve.
3. **Dependencia externa.** Cualquier cambio de menú, precio o personal implica un
   tercero. Eso cuesta dinero, tiempo y les quita autonomía.
4. **Producto perecedero y variable.** El pescado del día cambia; los precios de camarón
   y jaiba se mueven; hay platillos que se agotan a media tarde. Un catálogo rígido no
   sirve.

## 2. La visión

Un sistema web sencillo, que corre en el propio local, donde **el dueño es el
administrador**: dibuja su comedor, define su menú, da de alta a sus meseros y saca su
corte. Los meseros toman la orden desde una tablet tocando la mesa en el plano. La
cocina ve la comanda. La caja cobra y cierra el turno.

El parteaguas no es "cobrar más rápido": es **independencia operativa**.

## 3. Usuarios

| Rol | Quién es | Qué necesita | Contexto de uso |
|---|---|---|---|
| **Administrador / Dueño** | Dueño o encargado | Configurar todo: plano, menú, precios, usuarios, ver reportes | Oficina o caja, ratos libres |
| **Cajero** | Encargado de turno | Abrir/cerrar caja, cobrar, dividir cuentas, aplicar descuentos, cancelar | PC de caja, prisa, con cliente enfrente |
| **Mesero** | Personal de piso | Abrir mesa, tomar orden, agregar platillos, pedir la cuenta | Tablet o celular, de pie, manos mojadas, sol |
| **Cocina / Barra** | Cocinero, barman | Ver comandas pendientes, marcar listo, marcar agotado | Pantalla fija o ticket impreso, ambiente húmedo |

**Perfil real:** personal con rotación alta y poca familiaridad con software. La
interfaz tiene que enseñarse en 10 minutos.

## 4. Objetivos medibles

| Objetivo | Métrica de éxito |
|---|---|
| Autonomía de configuración | El dueño reconfigura el plano del comedor sin ayuda técnica, en menos de 15 min |
| Velocidad de toma de orden | Abrir mesa + capturar 6 platillos en menos de 90 segundos |
| Cero pérdida de comandas | Ninguna orden se pierde ante corte de luz o caída de red (ver NFR de resiliencia) |
| Corte de caja confiable | Cuadre de caja en menos de 5 min al cierre, con diferencia explicada |
| Curva de aprendizaje | Un mesero nuevo toma órdenes solo después de una demostración de 10 min |

## 5. Alcance

### Dentro (visión completa del producto)

- Editor visual del comedor: zonas, mesas, forma, capacidad, posición.
- Catálogo de menú administrable: categorías, productos, variantes, modificadores,
  disponibilidad del día.
- Toma de orden por mesa, con comandas a cocina y barra.
- Cuentas: una o varias por mesa, división por persona o por platillo.
- Cobro multi-método (efectivo, tarjeta, transferencia) y propinas.
- Corte de caja por turno.
- Reportes básicos de venta.
- Usuarios, roles y bitácora de acciones sensibles.
- Impresión de comanda y ticket en impresora térmica.

### Fuera (por ahora, y con razón)

| Fuera de alcance | Por qué |
|---|---|
| Facturación CFDI 4.0 / timbrado SAT | Requiere PAC, certificados y régimen fiscal; se integra en fase posterior si el cliente factura |
| Inventario con costeo y recetas | Complejidad alta, valor bajo para el tamaño actual; se evalúa en Fase 3 |
| App móvil nativa | La web responsiva cubre el caso; una app agrega distribución y mantenimiento |
| Pedidos en línea / delivery propio | No es el dolor actual |
| Nómina y control de asistencia | Producto distinto |
| Multi-sucursal | Un solo local hoy; el modelo de datos no lo bloquea |

## 6. Restricciones conocidas

- **Presupuesto bajo.** No hay para licencias por terminal ni SaaS caro por mes.
- **Hardware modesto.** Tablets Android económicas, posiblemente viejas; una PC de caja.
- **Internet inestable.** El sistema debe seguir vendiendo sin internet.
- **Ambiente hostil.** Humedad, manos mojadas, sol directo en terraza, ruido.
- **Sin personal técnico.** Nadie va a "reiniciar el servicio" ni leer un log.
