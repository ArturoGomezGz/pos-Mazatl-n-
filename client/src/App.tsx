import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './estado/Sesion';
import { AdminConfig } from './paginas/AdminConfig';
import { AdminMenu } from './paginas/AdminMenu';
import { AdminUsuarios } from './paginas/AdminUsuarios';
import { Caja } from './paginas/Caja';
import { Cobro } from './paginas/Cobro';
import { Cocina } from './paginas/Cocina';
import { EditorPlano } from './paginas/EditorPlano';
import { Ingreso } from './paginas/Ingreso';
import { Reportes } from './paginas/Reportes';
import { TomaOrden } from './paginas/TomaOrden';
import { VistaSalon } from './paginas/VistaSalon';
import { ETIQUETAS_ROL, type Rol } from './tipos';

interface Enlace {
  ruta: string;
  texto: string;
  roles: Rol[];
}

/** La navegación cambia según el rol: el mesero no necesita ver reportes y la
 *  cocina no necesita ver nada más que su pantalla. */
const ENLACES: Enlace[] = [
  { ruta: '/salon', texto: 'Salón', roles: ['admin', 'cajero', 'mesero'] },
  { ruta: '/cocina', texto: 'Cocina', roles: ['admin', 'cajero', 'cocina', 'mesero'] },
  { ruta: '/caja', texto: 'Caja', roles: ['admin', 'cajero'] },
  { ruta: '/menu', texto: 'Menú', roles: ['admin'] },
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
  const inicio = usuario.rol === 'cocina' ? '/cocina' : '/salon';

  return (
    <div className="app">
      <header className="encabezado">
        <h1>
          <span className="marca">{config.negocio_nombre ?? 'Mariscos Mazatlán'}</span>
        </h1>
        <nav className="navegacion">
          {enlaces.map((e) => (
            <NavLink key={e.ruta} to={e.ruta} className={({ isActive }) => (isActive ? 'activo' : '')}>
              {e.texto}
            </NavLink>
          ))}
        </nav>
        <div className="sesion">
          <span>
            {usuario.nombre} <small>{ETIQUETAS_ROL[usuario.rol]}</small>
          </span>
          <button className="btn chico" onClick={salir}>Salir</button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to={inicio} replace />} />
        <Route path="/salon" element={<VistaSalon />} />
        <Route path="/orden/:mesaId" element={<TomaOrden />} />
        <Route path="/cobro/:ordenId" element={<Cobro />} />
        <Route path="/cocina" element={<Cocina />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/menu" element={<AdminMenu />} />
        <Route path="/comedor" element={<EditorPlano />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/equipo" element={<AdminUsuarios />} />
        <Route path="/configuracion" element={<AdminConfig />} />
        <Route path="*" element={<div className="vacio">Página no encontrada</div>} />
      </Routes>
    </div>
  );
}
