# ADR-0001 · Stack tecnológico

- **Estado:** propuesto — pendiente de confirmación del equipo
- **Fecha:** 2026-08-22

## Contexto

El sistema debe cumplir RNF-1 (web clásica renderizada en servidor), RNF-2 (navegadores
y hardware viejos), RNF-3 (operar sin internet, servidor en el local), RNF-8
(instalación por alguien no técnico) y RNF-11 (mantenible por un solo desarrollador).

El presupuesto es bajo y no habrá soporte técnico presencial. El costo dominante del
proyecto no es escribir el código: es **mantenerlo vivo durante años en un mini-PC bajo
la barra de un restaurante**.

## Opciones consideradas

### A. PHP 8 + MariaDB (recomendada)

| A favor | En contra |
|---|---|
| Modelo de ejecución por petición: encaja exactamente con la arquitectura multi-página | Lenguaje con mala fama heredada de versiones viejas |
| Sin proceso residente que se caiga y haya que reiniciar | Requiere disciplina para no escribir SQL suelto en las vistas |
| Instalación trivial en Windows o Linux; hosting compartido de $3 USD si algún día se mueve fuera | |
| Enorme cantidad de desarrolladores disponibles en México si el cliente cambia de proveedor | |
| Vida útil demostrada: código PHP de hace 15 años sigue corriendo | |

### B. Python + Flask + SQLite/PostgreSQL

| A favor | En contra |
|---|---|
| Lenguaje agradable, buenas plantillas (Jinja) | Necesita un proceso residente y un supervisor que lo levante |
| Bueno si después se quieren reportes o análisis de datos | Entornos virtuales y dependencias: más piezas que se rompen sin soporte técnico |

### C. Node.js + Express + plantillas

| A favor | En contra |
|---|---|
| Un solo lenguaje en todo el proyecto | El ecosistema envejece rápido: dependencias que en 3 años ya no instalan |
| | Proceso residente, igual que B |

## Decisión propuesta

**Opción A: PHP 8.3 + MariaDB**, con plantillas propias, SQL explícito y migraciones
versionadas. Sin framework pesado; a lo sumo un enrutador mínimo.

El criterio decisivo no es la elegancia del lenguaje sino **la probabilidad de que el
sistema siga funcionando dentro de cinco años sin nosotros**. Ahí PHP gana claramente
para este contexto: sin proceso residente, sin entorno virtual, sin cadena de build,
y con la mayor disponibilidad de relevo técnico en el mercado local.

**SQLite vs MariaDB:** SQLite basta técnicamente para 30 mesas y sería aún más simple de
respaldar (un archivo). Se propone MariaDB solo por concurrencia de escritura con varias
tablets simultáneas y por herramientas de respaldo conocidas. **Es una decisión
reversible** y se puede cambiar a SQLite si se prefiere máxima simplicidad.

## Consecuencias

- El servidor del local necesita PHP y MariaDB: se resuelve con un instalador único
  (XAMPP en Windows, o paquetes del sistema en Linux).
- No habrá recarga en vivo ni herramientas modernas de desarrollo: se compensa con
  pruebas automatizadas del dominio.
- Si más adelante se requiere tiempo real fuerte (pantalla de cocina con muchas
  estaciones), habrá que agregar un componente aparte. No aplica hoy.

## Pendiente de confirmar

1. ¿Se confirma la interpretación de "legacy web" del documento de arquitectura?
2. ¿Hay preferencia o experiencia previa del equipo con algún lenguaje?
3. ¿El servidor del local será Windows o Linux?
4. ¿MariaDB o SQLite?
