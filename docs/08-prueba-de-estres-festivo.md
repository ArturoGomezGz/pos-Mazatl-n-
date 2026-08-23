# 08 · Prueba de estrés: un día festivo

Este documento resume una prueba deliberada de someter el sistema a un **10 de mayo**:
grupos grandes repartidos sobre varias mesas sin fusión, mesas por encima de su
capacidad, barra saturada con rotación rápida, varios meseros operando a la vez sobre
las mismas mesas y cuentas, cocina desbordada, y cierre de caja en caliente.

La prueba se hizo contra la API real, con datos sembrados desde cero, generando el
volumen de un servicio pico (39 cuentas cobradas, 3 grupos grandes, barra con doble
rotación, 26 comandas simultáneas) y forzando condiciones de carrera reales con
peticiones en paralelo (`Promise.all`), no solo secuenciales.

**Metodología:** volumen y checks automatizados vía script contra la API
(`scratchpad/festivo.mjs`, no versionado en el repo), con verificación directa en la
base de datos SQLite para confirmar o descartar cada sospecha antes de reportarla como
hallazgo. Nada de lo que sigue es especulación: cada afirmación se comprobó con datos.

---

## Veredicto en tres líneas

**El sistema aguanta un día festivo en lo que importa más: el dinero cuadra al
centavo bajo caos real, y la concurrencia de escritura está protegida por la
arquitectura, no solo por buena suerte.** Se encontró y se corrigió un defecto propio
que sí era catastrófico —una mesa cerrada por error dejaba la caja imposible de cerrar
para siempre, sin ninguna forma de repararlo desde la aplicación—, además de dos
defectos de integridad de datos silenciosos. Los tres ya están corregidos y probados.
Lo que no se corrige (fusión de mesas, mesas virtuales para la barra) se documenta
abajo como decisión consciente, no como pendiente.

---

## Bitácora del servicio simulado

| Bloque | Volumen |
|---|---|
| Grupo de 14 sobre T-1, T-2, T-5 | 3 órdenes, 3 folios, hasta 6 comandas |
| Grupo de 20 en Palapa completa | 3 órdenes, 3 folios |
| Mesas sobre-capacidad | T-3 (cap. 6) con 9 comensales; T-4 (cap. 2) con 5 |
| Barra saturada | 8 personas en 4 lugares, 2 rondas, rotación de ~20 min |
| Rotación acelerada | T-6 usada 3 veces en el mismo servicio, 3 folios distintos |
| Concurrencia real | 5 pruebas con `Promise.all`: doble apertura de mesa, cobro simultáneo a captura, envío simultáneo a cancelación, doble clic con y sin protección |
| Cocina desbordada | 26 comandas enviadas casi simultáneamente, repartidas cocina/barra |
| Movimientos a media comida | Transferencia de mesa con comanda ya enviada; ronda extra después de "pedir cuenta" |
| Agotados a media tarde | Producto agotado con una línea ya capturada sin enviar |
| Cierre en caliente | Intento de corte con mesas abiertas; cobro con turno ya cerrado |
| **Total cobrado** | **39 cuentas, $13,430.00**, tres métodos de pago |

---

## Cuadre final

| | Centavos | Pesos |
|---|---|---|
| Suma a mano de los 39 cobros exitosos | 1,343,000 | $13,430.00 |
| Reporte del sistema (`/reportes/ventas`) | 1,343,000 | $13,430.00 |
| **Diferencia** | **0** | **$0.00** |

El corte de caja, una vez corregido el defecto de cuentas huérfanas (ver abajo), cerró
con **$0.00 de diferencia** sobre un fondo inicial de $2,000.00 y todo lo cobrado en
efectivo y tarjeta.

En la repetición de la prueba tras las correcciones, una mesa quedó legítimamente
abierta al momento del cierre de turno (una comanda enviada después de que el cajero
ya había cerrado caja). El sistema **correctamente rechazó cobrarla** hasta que se
abra un nuevo turno. $13,385.00 cobrados + $45.00 legítimamente pendientes = los
$13,430.00 generados en total. Ni un peso se perdió ni se contó dos veces.

---

## Hallazgos por severidad

### Catastrófico — corregido

**Una mesa cerrada por error bloqueaba el cierre de caja para siempre, sin reparación posible.**

La función que permite al mesero cerrar una mesa que abrió por equivocación
(`cancelar mesa`, entregada en la ronda anterior) cancelaba la orden pero dejaba viva
una cuenta asociada, "abierta" y en $0.00, para siempre. El cierre de turno cuenta
**todas** las cuentas abiertas del sistema, sin importar a qué mesa u orden
pertenezcan; una sola cuenta huérfana de estas bastaba para que el cajero no pudiera
cerrar caja al final del día, con un mensaje ("Todavía hay N cuenta(s) sin cobrar")
que no señala dónde están esas cuentas, porque no aparecen en ninguna mesa activa.

Se intentó reparar por la vía normal (`DELETE /cuentas/:id`, la función pensada para
que un admin borre una cuenta creada de más) y falló: esa función exige que la orden
conserve al menos una cuenta, y la huérfana es la única que le queda a una orden ya
cancelada. **No existía ninguna forma de arreglarlo desde la aplicación.** Habría
requerido acceso directo a la base de datos, algo que este restaurante no tiene.

En la prueba, tres mesas cerradas por error a lo largo del servicio dejaron el turno
sin poder cerrarse ni una sola vez.

*Corregido:* cancelar una mesa vacía ahora también elimina su cuenta. Probado con una
prueba de regresión y con la repetición completa del servicio simulado: el corte
cerró en `$0.00` de diferencia con las mismas tres mesas canceladas de por medio.

### Grave — corregido

**Un platillo se podía asignar a la cuenta de una mesa distinta sin ningún aviso.**

Las funciones para "pasar un platillo a otra cuenta" y "repartir un platillo entre
cuentas" no comprobaban que la línea perteneciera a la misma mesa que las cuentas
destino. Se confirmó moviendo una línea de la orden de T-2 a una cuenta de T-1: la
operación respondió `200 OK` y dejó una fila en la base de datos que asociaba ese
platillo con **dos órdenes distintas** a la vez.

En este caso no hubo pérdida de dinero porque el cálculo de cuentas siempre se agrupa
por orden, así que el cruce quedó sin efecto en los totales — pero es una corrupción
de datos real y silenciosa, exactamente el tipo de fila que un reporte futuro podría
sumar dos veces sin que nadie lo note. Hoy la interfaz no permite provocar este cruce
(los selectores solo ofrecen cuentas de la misma orden), así que el riesgo venía de
una llamada directa a la API, no de un uso normal del sistema — pero un endpoint no
debería depender de que la pantalla sea la única que lo llame correctamente.

*Corregido:* ambas funciones ahora verifican que la línea pertenezca a la misma orden
antes de mover o repartir nada, y rechazan la operación con un mensaje claro si no es
así. Dos pruebas de regresión lo cubren.

### Grave — corregido

**La pantalla de cocina acumulaba comandas de mesas que ya se habían cobrado y se habían ido.**

Marcar "listo" en cocina es un paso manual e independiente de cobrar la cuenta. Si una
mesa se cobra y se va sin que nadie haya tocado "listo" en su comanda —fácil de que
pase con el mesero corriendo entre mesas—, esa comanda se quedaba en el tablero de
cocina **para siempre**. Después de simular el servicio completo, la pantalla de
cocina mostraba 51 comandas pendientes cuando en realidad solo 26 se habían generado y
ninguna mesa seguía activa: el resto era basura de servicios ya cerrados, mezclada con
lo que de verdad hacía falta cocinar. En un festivo real, con decenas de mesas
rotando, esto vuelve el tablero de cocina inútil justo cuando más se necesita.

*Corregido:* el tablero de cocina ahora excluye las comandas de órdenes que ya no
están abiertas. Tras la corrección, con el mismo volumen del servicio simulado, el
tablero mostró exactamente 1 comanda: la única mesa real que seguía en servicio.

### Molesto — decisión de proceso, no de software

**Ninguno de los siguientes puntos se corrige con código.** Son parte de cómo opera
un restaurante pequeño, y programarlos costaría más de lo que resuelven. La discusión
completa está en la tabla de decisión estratégica más abajo.

- Grupos grandes repartidos en varias mesas generan un folio y una comanda por mesa,
  sin forma de unificarlos en una sola cuenta.
- No hay ninguna validación de capacidad: una mesa de 4 acepta 9 comensales sin aviso.
- Cada persona en la barra genera una orden, un folio y una comanda completos, aunque
  solo haya pedido una cerveza.
- Seguir agregando rondas después de que la mesa "pidió la cuenta" no está bloqueado.

---

## Lo que sí resistió bien (y por qué importa saberlo)

**La concurrencia de escritura está protegida por la arquitectura, no por suerte.**
Se forzaron cinco condiciones de carrera reales con peticiones verdaderamente
paralelas: dos meseros abriendo la misma mesa a la vez, un cobro y una captura sobre
la misma cuenta al mismo tiempo, un envío a cocina y una cancelación de línea
simultáneos, y dos variantes de doble clic en el cobro (con y sin protección de
idempotencia). **En los cinco casos el sistema se comportó de forma segura**: nunca
hubo dos órdenes abiertas en la misma mesa, nunca hubo un cobro duplicado, y nunca se
perdió ni se contó dos veces un platillo.

La razón técnica: SQLite a través de `better-sqlite3` ejecuta cada consulta de forma
síncrona dentro de un único proceso de Node. Esto significa que dos peticiones que
llegan "al mismo tiempo" nunca se entrelazan a nivel de base de datos: una transacción
completa se ejecuta de principio a fin antes de que la siguiente pueda empezar. Es una
protección real, y es gratuita — no se escribió ningún candado explícito para
lograrla.

**Esta protección tiene una condición para seguir siendo válida**, y queda anotada
como regla de arquitectura en la sección de estrategias: mientras el servidor corra
como un único proceso Node y la base de datos siga siendo SQLite con este driver
síncrono, esta garantía se mantiene. Se pierde si el despliegue pasa a varios procesos
trabajador (por ejemplo `pm2 -i max` o balanceo entre varias instancias) o si la base
de datos migra a algo con conexiones concurrentes reales (PostgreSQL) sin agregar
bloqueos explícitos. No es una advertencia teórica: es la diferencia entre que el
corte de caja siga cuadrando o no.

**El resto de los casos también se comportó correctamente:**
- Transferir una mesa con la comanda ya enviada movió el consumo sin perderlo ni
  duplicarlo, y dejó los estados de origen y destino correctos.
- Un producto marcado agotado a media captura permitió enviar lo ya capturado (correcto:
  el cliente ya lo pidió) y bloqueó venderlo de nuevo a otra mesa.
- El corte de caja rechazó cerrarse mientras hubiera consumo real sin cobrar, y
  rechazó cobrar con el turno ya cerrado — ambas, la conducta correcta.
- La latencia de la pantalla de cocina con 26 comandas simultáneas fue de 2-3 ms: el
  volumen de un restaurante pequeño no acerca siquiera el sistema a un límite de
  rendimiento.

---

## Tabla de decisión estratégica

| Problema | ¿Software o proceso? | Forma concreta | Costo de construir | Costo de mantener/enseñar | Veredicto |
|---|---|---|---|---|---|
| Cuenta huérfana bloquea el cierre de caja | Software | Eliminar la cuenta al cancelar la orden vacía | Bajo (ya corregido) | Nulo | **Hecho** |
| Línea se puede cruzar entre órdenes distintas | Software | Validar mismo `ordenId` antes de mover/repartir | Bajo (ya corregido) | Nulo | **Hecho** |
| Cocina acumula comandas de mesas cerradas | Software | Excluir órdenes no-abiertas del tablero | Bajo (ya corregido) | Nulo | **Hecho** |
| Grupo grande sobre varias mesas sin cuenta única | Proceso | El mesero abre una cuenta "ancla" para todo el grupo y usa "repartir platillo" para lo compartido; las demás mesas quedan libres para otros clientes mientras el grupo dure | — | Una frase en la capacitación | **Ahora, como regla de operación** |
| Fusionar formalmente varias mesas en una orden | Software | `orden_padre_id` (ya existe en el modelo de datos) uniendo órdenes de mesas distintas en una sola cuenta | Alto: reescribe cómo se calculan totales, comandas y reportes cuando una orden tiene "hijas"; toca prácticamente todos los módulos | Alto: una segunda forma de pensar una orden que el equipo entero tiene que entender, para un caso que ocurre pocas veces al mes | **Nunca** para este restaurante — ver justificación abajo |
| Silla extra en una mesa (sobre-capacidad) | Proceso | El mesero abre la mesa con el número real de comensales; el sistema ya lo permite sin bloquear | — | Ninguno | **Ya funciona así** |
| Falta de aviso/reporte de sobre-ocupación | Software (opcional, bajo valor) | Un ícono o color distinto en "Mis mesas" cuando comensales > capacidad | Bajo | Bajo | **Después**, si el dueño pide medir esto; no es un problema hoy |
| Barra: una orden completa por cada bebida individual | Proceso primero | Una sola persona (el cantinero o un mesero fijo) atiende TODA la barra como si fuera una mesa grande, cobrando por consumo según se van, no por lugar asignado | — | Una regla de turno para quien trabaje la barra | **Ahora, como regla de operación** |
| Modelo de "mesas virtuales" para la barra | Software | Mesas efímeras que se crean y destruyen solas | Medio: hay que decidir cuándo nace y muere una mesa virtual, y qué pasa con su historial | Medio: una tabla de datos que existe y desaparece es más difícil de depurar que una fija | **Después**, solo si la regla de proceso de arriba resulta insuficiente en la práctica |
| Seguir agregando rondas tras "pedir cuenta" | Ninguno — es correcto así | El estado es informativo, no un candado | — | — | **No tocar** |
| Concurrencia de escritura bajo carga | Ninguno — ya protegido | Mantener un solo proceso Node y SQLite síncrono | — | Ninguno mientras no cambie el despliegue | **Documentar como restricción de arquitectura**, no como pendiente |

### Por qué "fusionar mesas" no vale la pena para este restaurante

Es la decisión más importante de esta tabla, y la que más tienta a programarse porque
"suena bien". Se descarta por tres razones concretas:

1. **Ocurre pocas veces.** Un grupo de 14 o más que necesita mesas juntas es un evento
   de fin de semana largo o festivo, no una operación diaria. El costo de construir y
   mantener una segunda forma de calcular totales, comandas y reportes para un caso
   que pasa unas cuantas veces al mes no se paga solo.
2. **Ya existe un rodeo de un paso.** Abrir una cuenta "ancla" en una de las mesas del
   grupo y usar "repartir un platillo" (ya construido) para lo que compartieron cubre
   el 90% del caso real: una familia grande casi siempre pide para compartir y paga
   junta al final. El costo de este rodeo es explicárselo una vez al mesero, no
   mantener código para siempre.
3. **El costo de mantenimiento es desproporcionado.** `orden_padre_id` tocaría
   prácticamente todos los módulos que ya existen (menú, comandas, cuentas, caja,
   reportes) para que entiendan que una orden puede tener "hijas". Es la clase de
   funcionalidad que parece pequeña al diseñarla y se vuelve la más frágil del sistema
   con el tiempo, para el restaurante equivocado: uno pequeño, con presupuesto corto,
   que no puede pagar mantener dos veces la misma lógica.

Si el negocio creciera a un salón de eventos con grupos grandes como parte central del
negocio (no la excepción), esta decisión se revisaría. Hoy no es ese negocio.

---

## Estrategias que el sistema adopta

1. **Una acción del piso nunca debe dejar el sistema en un estado sin salida.**
   Cualquier función que un mesero o cajero pueda ejecutar por su cuenta —cerrar una
   mesa, cancelar una línea, dividir una cuenta— tiene que tener también un camino de
   reversa igual de accesible. El defecto catastrófico de esta prueba nació de una
   función con entrada pero sin salida.

2. **Los endpoints validan sus propios invariantes, no confían en que la interfaz sea
   la única que los llame bien.** El cruce de líneas entre órdenes distintas era
   imposible de provocar desde la pantalla, y aun así era un defecto real: el
   contrato de la API tiene que sostenerse solo.

3. **Ninguna pantalla operativa acumula historia indefinidamente.** Cocina, "Mis
   mesas" y cualquier tablero futuro deben mostrar solo lo que sigue vivo. Un tablero
   que no se limpia solo se vuelve ruido exactamente el día que más se necesita que
   funcione.

4. **La concurrencia se resuelve por diseño de la arquitectura, no por candados
   dispersos por el código.** Mantener el servidor como un único proceso Node con
   SQLite síncrono es, hoy, la fuente principal de seguridad ante condiciones de
   carrera. Es una restricción deliberada del despliegue (ver
   [`03-arquitectura.md`](03-arquitectura.md)), no un accidente: escalar a varios
   procesos o cambiar de base de datos exige revisar esta garantía explícitamente,
   no asumir que sigue ahí.

5. **No toda solución a un problema real es una funcionalidad nueva.** Grupos grandes
   sin mesa fusionada y la barra saturada son problemas reales de un festivo, y ambos
   se resuelven mejor con una regla de operación que con una pantalla nueva. El
   criterio para decidir entre las dos: si el caso ocurre a diario, se programa; si
   ocurre unas cuantas veces al mes y un rodeo de un paso ya lo resuelve, se enseña,
   no se construye.

6. **El presupuesto de mantenimiento es un costo real de cada funcionalidad.** Antes
   de construir algo, la pregunta no es solo "¿serviría?" sino "¿quién en este
   restaurante va a mantenerlo entendido dentro de dos años?". `orden_padre_id` sigue
   en el modelo de datos porque no estorba estar ahí sin usarse; no se implementa
   porque usarlo sí tendría un costo permanente.
