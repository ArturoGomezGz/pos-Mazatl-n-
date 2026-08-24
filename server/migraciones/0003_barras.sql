-- Grupos de "lugares de barra": una sola colocación en el plano con un número
-- de lugares: cada lugar es una mesa independiente (propia orden, propio
-- estado) numerada B-{numero}-{lugar}, para poder atender varios grupos de
-- clientes en la misma barra a la vez.

CREATE TABLE barras (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  zona_id     INTEGER NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  lugares     INTEGER NOT NULL DEFAULT 4,
  activa      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_barras_numero ON barras(numero);
CREATE INDEX idx_barras_zona ON barras(zona_id);

-- La posición depende del layout, igual que mesa_posiciones: es la posición
-- de la barra completa; cada lugar se calcula dividiéndola en partes iguales.
CREATE TABLE barra_posiciones (
  layout_id   INTEGER NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  barra_id    INTEGER NOT NULL REFERENCES barras(id) ON DELETE CASCADE,
  x           INTEGER NOT NULL DEFAULT 0,
  y           INTEGER NOT NULL DEFAULT 0,
  ancho       INTEGER NOT NULL DEFAULT 280,
  alto        INTEGER NOT NULL DEFAULT 70,
  rotacion    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (layout_id, barra_id)
);

ALTER TABLE mesas ADD COLUMN barra_id     INTEGER REFERENCES barras(id) ON DELETE CASCADE;
ALTER TABLE mesas ADD COLUMN numero_lugar INTEGER;

CREATE INDEX idx_mesas_barra ON mesas(barra_id);
