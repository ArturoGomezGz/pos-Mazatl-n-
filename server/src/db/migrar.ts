import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlite } from './cliente.js';

/** Migrador mínimo: aplica en orden los archivos .sql de `migraciones/` que
 *  todavía no se han aplicado y deja constancia en la tabla `migraciones`.
 *  Sin herramientas externas: las migraciones son SQL que cualquiera puede leer. */
const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirMigraciones = path.resolve(aqui, '../../migraciones');

export function migrar(): string[] {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS migraciones (
      nombre     TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const aplicadas = new Set(
    sqlite.prepare('SELECT nombre FROM migraciones').all().map((f) => (f as { nombre: string }).nombre),
  );

  const pendientes = fs
    .readdirSync(dirMigraciones)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !aplicadas.has(f));

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(dirMigraciones, archivo), 'utf8');
    const aplicar = sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO migraciones (nombre) VALUES (?)').run(archivo);
    });
    aplicar();
    console.log(`  ✓ migración aplicada: ${archivo}`);
  }

  return pendientes;
}

// Permite ejecutarlo como script: npm run db:migrate
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const aplicadas = migrar();
  console.log(aplicadas.length ? `${aplicadas.length} migración(es) aplicada(s).` : 'Base de datos al día.');
}
