import type { ReactElement } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { reiniciarDemo } from './api/apiSimulada';
import { useSesion } from './estado/Sesion';
import { AdminConfig } from './paginas/AdminConfig';
import { AdminMenu } from './paginas/AdminMenu';
import { AdminUsuarios } from './paginas/AdminUsuarios';
import { Caja } from './paginas/Caja';
import { Cobro } from './paginas/Cobro';
import { Cocina } from './paginas/Cocina';
import { EditorPlano } from './paginas/EditorPlano';
import { MapaConsulta } from './paginas/MapaConsulta';
import { MisMesas } from './paginas/MisMesas';
import { Ingreso } from './paginas/Ingreso';
import { Reportes } from './paginas/Reportes';
import { TomaOrden } from './paginas/TomaOrden';
import { ETIQUETAS_ROL, type Rol } from './tipos';

interface Enlace {
  ruta: string;
  texto: string;
  roles: Rol[];
}

/** La navegación cambia según el rol: el mesero no necesita ver reportes y la
 *  cocina no necesita ver nada más que su pantalla. */
const ENLACES: Enlace[] = [
  { ruta: '/mesas', texto: 'Mis mesas', roles: ['admin', 'cajero', 'mesero'] },
  { ruta: '/cocina', texto: 'Cocina', roles: ['admin', 'cajero', 'cocina', 'mesero'] },
  { ruta: '/caja', texto: 'Caja', roles: ['admin', 'cajero'] },
  { ruta: '/menu', texto: 'Menú', roles: ['admin'] },
  // El editor del plano es trabajo de escritorio: configurar el salón, no atender.
  { ruta: '/comedor', texto: 'Comedor', roles: ['admin'] },
  { ruta: '/reportes', texto: 'Reportes', roles: ['admin', 'cajero'] },
  { ruta: '/equipo', texto: 'Equipo', roles: ['admin'] },
  { ruta: '/configuracion', texto: 'Configuración', roles: ['admin'] },
];

export function App() {
  const { usuario, cargando, salir, config } = useSesion();

  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!usuario) return <Ingreso />;

  const enlaces = ENLACES.filter((e) => e.roles.includes(usuario.rol));
  const inicio = usuario.rol === 'cocina' ? '/cocina' : '/mesas';

  // Guarda de ruta: si el usuario activo no tiene el rol requerido, lo manda a
  // su inicio en vez de renderizar la página. Sin esto, la URL de una sesión
  // anterior (o tecleada a mano) puede exponer una vista ajena a su rol.
  const protegida = (roles: Rol[], elemento: ReactElement) =>
    roles.includes(usuario.rol) ? elemento : <Navigate to={inicio} replace />;

  return (
    <div className="app">
      {import.meta.env.VITE_MOCK === '1' && (
        <div className="aviso-demo">
          <span>
            <strong>Modo demo.</strong> Esta versión corre sin servidor: los datos viven en tu navegador y no
            se comparten con nadie más. Recarga para seguir donde ibas, o reinicia si quieres el comedor de ejemplo.
          </span>
          <button
            className="btn chico fantasma"
            onClick={() => confirm('¿Reiniciar el demo? Se pierde todo lo capturado en esta sesión.') && reiniciarDemo()}
          >
            Reiniciar demo
          </button>
        </div>
      )}
      <header className="encabezado">
        <div className="encabezado__superior">
          <h1>
            <span className="marca">{config.negocio_nombre ?? 'Mariscos Mazatlán'}</span>
          </h1>
          <div className="sesion">
            <span>
              {usuario.nombre} <small>{ETIQUETAS_ROL[usuario.rol]}</small>
            </span>
            <button className="btn chico" onClick={salir}>Salir</button>
          </div>
        </div>
        <nav className="encabezado__nav">
          {enlaces.map((e) => (
            <NavLink key={e.ruta} to={e.ruta} className={({ isActive }) => (isActive ? 'activo' : '')}>
              {e.texto}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to={inicio} replace />} />
        <Route path="/mesas" element={protegida(['admin', 'cajero', 'mesero'], <MisMesas />)} />
        <Route path="/mapa" element={protegida(['admin', 'cajero', 'mesero'], <MapaConsulta />)} />
        <Route path="/salon" element={<Navigate to="/mesas" replace />} />
        <Route path="/orden/:mesaId" element={protegida(['admin', 'cajero', 'mesero'], <TomaOrden />)} />
        <Route path="/cobro/:ordenId" element={protegida(['admin', 'cajero', 'mesero'], <Cobro />)} />
        <Route path="/cocina" element={protegida(['admin', 'cajero', 'cocina', 'mesero'], <Cocina />)} />
        <Route path="/caja" element={protegida(['admin', 'cajero'], <Caja />)} />
        <Route path="/menu" element={protegida(['admin'], <AdminMenu />)} />
        <Route path="/comedor" element={protegida(['admin'], <EditorPlano />)} />
        <Route path="/reportes" element={protegida(['admin', 'cajero'], <Reportes />)} />
        <Route path="/equipo" element={protegida(['admin'], <AdminUsuarios />)} />
        <Route path="/configuracion" element={protegida(['admin'], <AdminConfig />)} />
        <Route path="*" element={<div className="vacio">Página no encontrada</div>} />
      </Routes>
    </div>
  );
}
