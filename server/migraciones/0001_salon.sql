-- Módulo salón: zonas, mesas y distribuciones del comedor.
-- Las coordenadas del plano se guardan en unidades del lienzo (1 unidad ≈ 1 px
-- a zoom 100%). El cliente decide la escala visual; el servidor solo persiste.

CREATE TABLE zonas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  activa      INTEGER NOT NULL DEFAULT 1,
  ancho       INTEGER NOT NULL DEFAULT 1200,
  alto        INTEGER NOT NULL DEFAULT 800,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE layouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  activo      INTEGER NOT NULL DEFAULT 0,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE mesas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  zona_id     INTEGER NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  capacidad   INTEGER NOT NULL DEFAULT 4,
  forma       TEXT    NOT NULL DEFAULT 'cuadrada',
  activa      INTEGER NOT NULL DEFAULT 1,
  estado      TEXT    NOT NULL DEFAULT 'libre',
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_mesas_nombre ON mesas(nombre);
CREATE INDEX idx_mesas_zona ON mesas(zona_id);

-- La posición depende del layout: cambiar de distribución no reconstruye el comedor.
CREATE TABLE mesa_posiciones (
  layout_id   INTEGER NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  mesa_id     INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  x           INTEGER NOT NULL DEFAULT 0,
  y           INTEGER NOT NULL DEFAULT 0,
  ancho       INTEGER NOT NULL DEFAULT 100,
  alto        INTEGER NOT NULL DEFAULT 100,
  rotacion    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (layout_id, mesa_id)
);

-- Referencias visuales no vendibles: barra, cocina, baño, muros, textos.
CREATE TABLE elementos_plano (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  layout_id   INTEGER NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  zona_id     INTEGER NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL DEFAULT 'muro',
  etiqueta    TEXT    NOT NULL DEFAULT '',
  x           INTEGER NOT NULL DEFAULT 0,
  y           INTEGER NOT NULL DEFAULT 0,
  ancho       INTEGER NOT NULL DEFAULT 160,
  alto        INTEGER NOT NULL DEFAULT 60,
  rotacion    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_elementos_layout_zona ON elementos_plano(layout_id, zona_id);
