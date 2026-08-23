import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../../db/cliente.js';
import { bitacora, sesiones, usuarios, type ROLES } from '../../db/esquema.js';
import { ErrorHttp, conflicto, noEncontrado } from '../../http/errores.js';

export type Rol = (typeof ROLES)[number];
export type Usuario = typeof usuarios.$inferSelect;
export type UsuarioPublico = Omit<Usuario, 'pinHash'>;

const HORAS_SESION = 16; // un turno largo de restaurante, sin más

/* ── PIN ─────────────────────────────────────────────────────────────── */

export function hashearPin(pin: string): string {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(pin, sal, 64).toString('hex')}`;
}

function pinCorrecto(pin: string, hash: string): boolean {
  const [sal, esperado] = hash.split(':');
  if (!sal || !esperado) return false;
  const calculado = scryptSync(pin, sal, 64);
  const guardado = Buffer.from(esperado, 'hex');
  return calculado.length === guardado.length && timingSafeEqual(calculado, guardado);
}

/* ── Usuarios ────────────────────────────────────────────────────────── */

const sinPin = ({ pinHash: _p, ...resto }: Usuario): UsuarioPublico => resto;

export function listarUsuarios(soloActivos = false): UsuarioPublico[] {
  const filas = soloActivos
    ? db.select().from(usuarios).where(eq(usuarios.activo, true)).orderBy(asc(usuarios.nombre)).all()
    : db.select().from(usuarios).orderBy(asc(usuarios.nombre)).all();
  return filas.map(sinPin);
}

export function obtenerUsuario(id: number): UsuarioPublico {
  const usuario = db.select().from(usuarios).where(eq(usuarios.id, id)).get();
  if (!usuario) throw noEncontrado('Usuario');
  return sinPin(usuario);
}

export function crearUsuario(datos: { nombre: string; rol: Rol; pin: string }): UsuarioPublico {
  return sinPin(
    db.insert(usuarios).values({ nombre: datos.nombre, rol: datos.rol, pinHash: hashearPin(datos.pin) }).returning().get(),
  );
}

export function actualizarUsuario(id: number, cambios: { nombre?: string; rol?: Rol; pin?: string; activo?: boolean }) {
  const set: Partial<typeof usuarios.$inferInsert> = {};
  if (cambios.nombre !== undefined) set.nombre = cambios.nombre;
  if (cambios.rol !== undefined) set.rol = cambios.rol;
  if (cambios.activo !== undefined) set.activo = cambios.activo;
  if (cambios.pin !== undefined) set.pinHash = hashearPin(cambios.pin);

  // Nunca dejar el sistema sin administrador: quedaría inutilizable.
  if (set.activo === false || (set.rol && set.rol !== 'admin')) {
    const admins = db
      .select({ n: sql<number>`count(*)` })
      .from(usuarios)
      .where(and(eq(usuarios.rol, 'admin'), eq(usuarios.activo, true)))
      .get()?.n ?? 0;
    const actual = db.select().from(usuarios).where(eq(usuarios.id, id)).get();
    if (actual?.rol === 'admin' && actual.activo && admins <= 1) {
      throw conflicto('Debe quedar al menos un administrador activo');
    }
  }

  if (Object.keys(set).length === 0) return obtenerUsuario(id);
  const actualizado = db.update(usuarios).set(set).where(eq(usuarios.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Usuario');
  return sinPin(actualizado);
}

/* ── Sesión ──────────────────────────────────────────────────────────── */

export function ingresar(usuarioId: number, pin: string) {
  const usuario = db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).get();
  if (!usuario || !usuario.activo || !pinCorrecto(pin, usuario.pinHash)) {
    throw new ErrorHttp(401, 'PIN incorrecto');
  }
  const token = randomBytes(24).toString('hex');
  const expira = new Date(Date.now() + HORAS_SESION * 3600_000).toISOString();
  db.insert(sesiones).values({ token, usuarioId: usuario.id, expiraEn: expira }).run();
  registrar(usuario.id, 'ingreso', 'usuario', usuario.id);
  return { token, usuario: sinPin(usuario) };
}

export function salir(token: string) {
  db.delete(sesiones).where(eq(sesiones.token, token)).run();
}

export function usuarioDeToken(token: string): UsuarioPublico | null {
  const fila = db
    .select()
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.token, token), gt(sesiones.expiraEn, new Date().toISOString())))
    .get();
  if (!fila || !fila.usuarios.activo) return null;
  return sinPin(fila.usuarios);
}

/** Valida un PIN de autorización puntual: cancelar, descontar, reabrir.
 *  No abre sesión; solo confirma que alguien con permiso estuvo presente. */
export function autorizar(pin: string, rolesPermitidos: Rol[]): UsuarioPublico {
  const candidatos = db.select().from(usuarios).where(eq(usuarios.activo, true)).all();
  const encontrado = candidatos.find((u) => rolesPermitidos.includes(u.rol) && pinCorrecto(pin, u.pinHash));
  if (!encontrado) throw new ErrorHttp(403, 'PIN de autorización inválido');
  return sinPin(encontrado);
}

/* ── Bitácora ────────────────────────────────────────────────────────── */

/** Registro inmutable de acciones sensibles. Solo se inserta, nunca se edita. */
export function registrar(usuarioId: number | null, accion: string, entidad = '', entidadId?: number, detalle = '') {
  db.insert(bitacora).values({ usuarioId, accion, entidad, entidadId, detalle }).run();
}

export function listarBitacora(limite = 200) {
  return db
    .select({
      id: bitacora.id,
      accion: bitacora.accion,
      entidad: bitacora.entidad,
      entidadId: bitacora.entidadId,
      detalle: bitacora.detalle,
      creadoEn: bitacora.creadoEn,
      usuario: usuarios.nombre,
    })
    .from(bitacora)
    .leftJoin(usuarios, eq(usuarios.id, bitacora.usuarioId))
    .orderBy(sql`${bitacora.id} desc`)
    .limit(limite)
    .all();
}
