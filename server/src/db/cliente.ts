import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as esquema from './esquema.js';

fs.mkdirSync(path.dirname(config.dbRuta), { recursive: true });

export const sqlite = new Database(config.dbRuta);

// WAL permite lecturas concurrentes mientras se escribe: varias tablets a la vez.
sqlite.pragma('journal_mode = WAL');
// FULL sincroniza cada commit a disco. Es más lento, y es exactamente lo que
// queremos: un corte de luz no debe perder una comanda ya enviada (RNF-6).
sqlite.pragma('synchronous = FULL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema: esquema });
