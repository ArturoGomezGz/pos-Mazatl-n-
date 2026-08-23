import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProveedorSesion } from './estado/Sesion';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el nodo raíz');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
