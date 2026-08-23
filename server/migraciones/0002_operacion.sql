-- Operación completa del restaurante: usuarios, menú, órdenes, cuentas y caja.
-- Todos los importes en centavos (enteros). Las cantidades en milésimas, para
-- poder vender 1.5 kg de camarón sin usar punto flotante.

/* ── Usuarios y sesiones ─────────────────────────────────────────────── */

CREATE TABLE usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  rol        TEXT    NOT NULL DEFAULT 'mesero',   -- admin | cajero | mesero | cocina
  pin_hash   TEXT    NOT NULL,
  activo     INTEGER NOT NULL DEFAULT 1,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sesiones (
  token       TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en   TEXT    NOT NULL DEFAULT (datetime('now')),
  expira_en   TEXT    NOT NULL
);

/* ── Configuración del negocio (incluye el estilo del menú) ──────────── */

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

/* ── Menú ────────────────────────────────────────────────────────────── */

CREATE TABLE categorias (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT    NOT NULL,
  color   TEXT    NOT NULL DEFAULT '#13618c',
  orden   INTEGER NOT NULL DEFAULT 0,
  activa  INTEGER NOT NULL DEFAULT 1
);

-- tipo_venta define cómo se cobra el producto y es la pieza que permite que el
-- mismo sistema sirva a menús muy distintos:
--   simple    → un precio único
--   variantes → tamaños con precio propio (orden / media orden, chico / grande)
--   peso      → se cobra por kilo, se captura el peso en la venta
--   abierto   → precio del día, se captura al vender (pescado, mariscada)
CREATE TABLE productos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id   INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nombre         TEXT    NOT NULL,
  descripcion    TEXT    NOT NULL DEFAULT '',
  estacion       TEXT    NOT NULL DEFAULT 'cocina',   -- cocina | barra
  tipo_venta     TEXT    NOT NULL DEFAULT 'simple',
  unidad         TEXT    NOT NULL DEFAULT 'pieza',    -- pieza | kg
  orden          INTEGER NOT NULL DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  disponible_hoy INTEGER NOT NULL DEFAULT 1,
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_productos_categoria ON productos(categoria_id);

-- Todo producto tiene al menos una variante, incluso los "simples": así hay una
-- sola ruta de precio en todo el sistema.
CREATE TABLE variantes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id      INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre           TEXT    NOT NULL DEFAULT 'Único',
  precio_centavos  INTEGER NOT NULL DEFAULT 0,
  orden            INTEGER NOT NULL DEFAULT 0,
  activa           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_variantes_producto ON variantes(producto_id);

CREATE TABLE grupos_modificadores (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT    NOT NULL,
  min_selecciones  INTEGER NOT NULL DEFAULT 0,
  max_selecciones  INTEGER NOT NULL DEFAULT 1,
  orden            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE modificadores (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id               INTEGER NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  nombre                 TEXT    NOT NULL,
  precio_extra_centavos  INTEGER NOT NULL DEFAULT 0,
  orden                  INTEGER NOT NULL DEFAULT 0,
  activo                 INTEGER NOT NULL DEFAULT 1
);

-- Los grupos se reutilizan entre productos: "Término" sirve para todos los filetes.
CREATE TABLE producto_grupos (
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  grupo_id    INTEGER NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (producto_id, grupo_id)
);

/* ── Órdenes y comandas ──────────────────────────────────────────────── */

CREATE TABLE ordenes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  folio      INTEGER NOT NULL,
  mesa_id    INTEGER NOT NULL REFERENCES mesas(id),
  mesero_id  INTEGER NOT NULL REFERENCES usuarios(id),
  comensales INTEGER NOT NULL DEFAULT 1,
  estado     TEXT    NOT NULL DEFAULT 'abierta',   -- abierta | cobrada | cancelada
  abierta_en TEXT    NOT NULL DEFAULT (datetime('now')),
  cerrada_en TEXT
);

CREATE UNIQUE INDEX idx_ordenes_folio ON ordenes(folio);
CREATE INDEX idx_ordenes_mesa ON ordenes(mesa_id, estado);

CREATE TABLE comandas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id            INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  estacion            TEXT    NOT NULL,
  enviada_en          TEXT    NOT NULL DEFAULT (datetime('now')),
  lista_en            TEXT,
  clave_idempotencia  TEXT
);

-- El Wi-Fi de una terraza falla: si la misma comanda llega dos veces, se guarda una.
CREATE UNIQUE INDEX idx_comandas_idempotencia ON comandas(clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

-- Los nombres y el precio se congelan en la línea: el ticket de hace tres meses
-- sigue siendo verdad aunque el producto ya no exista o haya cambiado de precio.
CREATE TABLE orden_lineas (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id                 INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  comanda_id               INTEGER REFERENCES comandas(id),
  producto_id              INTEGER REFERENCES productos(id),
  variante_id              INTEGER REFERENCES variantes(id),
  producto_nombre          TEXT    NOT NULL,
  variante_nombre          TEXT    NOT NULL DEFAULT '',
  estacion                 TEXT    NOT NULL DEFAULT 'cocina',
  unidad                   TEXT    NOT NULL DEFAULT 'pieza',
  precio_unitario_centavos INTEGER NOT NULL,
  cantidad_milesimas       INTEGER NOT NULL DEFAULT 1000,
  nota                     TEXT    NOT NULL DEFAULT '',
  estado                   TEXT    NOT NULL DEFAULT 'pendiente', -- pendiente|enviada|lista|servida|cancelada
  es_cortesia              INTEGER NOT NULL DEFAULT 0,
  motivo_cancelacion       TEXT,
  cancelada_por_id         INTEGER REFERENCES usuarios(id),
  creado_en                TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lineas_orden ON orden_lineas(orden_id);
CREATE INDEX idx_lineas_comanda ON orden_lineas(comanda_id);

CREATE TABLE linea_modificadores (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  linea_id              INTEGER NOT NULL REFERENCES orden_lineas(id) ON DELETE CASCADE,
  modificador_id        INTEGER REFERENCES modificadores(id),
  nombre                TEXT    NOT NULL,
  precio_extra_centavos INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_linea_mod ON linea_modificadores(linea_id);

/* ── Caja ────────────────────────────────────────────────────────────── */

CREATE TABLE turnos_caja (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
  abierto_en              TEXT    NOT NULL DEFAULT (datetime('now')),
  fondo_inicial_centavos  INTEGER NOT NULL DEFAULT 0,
  cerrado_en              TEXT,
  declarado_centavos      INTEGER,
  esperado_centavos       INTEGER,
  diferencia_centavos     INTEGER,
  estado                  TEXT    NOT NULL DEFAULT 'abierto'  -- abierto | cerrado
);

CREATE TABLE movimientos_caja (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  turno_id       INTEGER NOT NULL REFERENCES turnos_caja(id) ON DELETE CASCADE,
  tipo           TEXT    NOT NULL,   -- entrada | retiro | gasto | propina_pagada
  monto_centavos INTEGER NOT NULL,
  concepto       TEXT    NOT NULL DEFAULT '',
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ── Cuentas y pagos ─────────────────────────────────────────────────── */

CREATE TABLE cuentas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id            INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  nombre              TEXT    NOT NULL DEFAULT 'Cuenta 1',
  estado              TEXT    NOT NULL DEFAULT 'abierta',  -- abierta | cobrada | cancelada
  subtotal_centavos   INTEGER NOT NULL DEFAULT 0,
  descuento_centavos  INTEGER NOT NULL DEFAULT 0,
  motivo_descuento    TEXT    NOT NULL DEFAULT '',
  autorizado_por_id   INTEGER REFERENCES usuarios(id),
  impuesto_centavos   INTEGER NOT NULL DEFAULT 0,
  propina_centavos    INTEGER NOT NULL DEFAULT 0,
  total_centavos      INTEGER NOT NULL DEFAULT 0,
  turno_id            INTEGER REFERENCES turnos_caja(id),
  cerrada_en          TEXT,
  creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cuentas_orden ON cuentas(orden_id);

-- proporcion_milesimas permite partir un platillo entre dos cuentas (la botana
-- que compartieron) sin inventar líneas falsas: 500 = mitad.
CREATE TABLE cuenta_lineas (
  cuenta_id            INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  linea_id             INTEGER NOT NULL REFERENCES orden_lineas(id) ON DELETE CASCADE,
  proporcion_milesimas INTEGER NOT NULL DEFAULT 1000,
  PRIMARY KEY (cuenta_id, linea_id)
);

CREATE TABLE pagos (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  cuenta_id          INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  turno_id           INTEGER NOT NULL REFERENCES turnos_caja(id),
  metodo             TEXT    NOT NULL,  -- efectivo | tarjeta | transferencia
  monto_centavos     INTEGER NOT NULL,
  referencia         TEXT    NOT NULL DEFAULT '',
  recibido_centavos  INTEGER,
  cambio_centavos    INTEGER,
  clave_idempotencia TEXT,
  creado_en          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_pagos_idempotencia ON pagos(clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

CREATE INDEX idx_pagos_turno ON pagos(turno_id);

/* ── Bitácora (solo inserciones, nunca se edita ni se borra) ─────────── */

CREATE TABLE bitacora (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id),
  accion      TEXT    NOT NULL,
  entidad     TEXT    NOT NULL DEFAULT '',
  entidad_id  INTEGER,
  detalle     TEXT    NOT NULL DEFAULT '',
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bitacora_fecha ON bitacora(creado_en);
