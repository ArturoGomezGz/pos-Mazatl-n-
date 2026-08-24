import path from 'node:path';
import { db } from './cliente.js';
import { usuarios } from './esquema.js';
import { hashearPin } from '../modulos/auth/auth.servicio.js';
import { migrar } from './migrar.js';

/** Datos de arranque: solo el usuario administrador inicial, para poder
 *  entrar al sistema por primera vez. Idempotente: si ya hay usuarios no
 *  inserta nada, así que se puede llamar en cada arranque del servidor. */
export function sembrar(): void {
  migrar();

  if (db.select().from(usuarios).all().length === 0) {
    db.insert(usuarios).values({ nombre: 'Administrador', rol: 'admin', pinHash: hashearPin('1234') }).run();
    console.log('Usuario administrador creado. PIN: 1234');
  }
}

// Permite ejecutarlo como script: npm run db:seed
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  sembrar();
}
