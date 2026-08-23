import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { EditorPlano } from './paginas/EditorPlano';
import { VistaSalon } from './paginas/VistaSalon';

export function App() {
  return (
    <div className="app">
      <header className="encabezado">
        <h1>
          <span className="marca">Mariscos Mazatlán</span> · Punto de venta
        </h1>
        <nav className="navegacion">
          <NavLink to="/salon" className={({ isActive }) => (isActive ? 'activo' : '')}>
            Salón
          </NavLink>
          <NavLink to="/editor" className={({ isActive }) => (isActive ? 'activo' : '')}>
            Editar comedor
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/salon" replace />} />
        <Route path="/salon" element={<VistaSalon />} />
        <Route path="/editor" element={<EditorPlano />} />
        <Route path="*" element={<div className="vacio">Página no encontrada</div>} />
      </Routes>
    </div>
  );
}
