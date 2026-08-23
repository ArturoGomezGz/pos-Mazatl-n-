import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { MenuVenta } from '../componentes/MenuVenta';
import { useSesion } from '../estado/Sesion';
import { leerEstiloMenu, type Categoria, type Config } from '../tipos';

/** Configuración del negocio y **estilo del menú**. El estilo se ve en vivo:
 *  el dueño decide cómo quiere su pantalla de venta sin pedirle nada a nadie. */
export function AdminConfig() {
  const { config, recargarConfig } = useSesion();
  const [borrador, setBorrador] = useState<Config>(config);
  const [menu, setMenu] = useState<Categoria[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => setBorrador(config), [config]);
  useEffect(() => {
    api.menu().then(setMenu).catch(() => {});
  }, []);

  const cambiar = (clave: string, valor: string) => {
    setBorrador((previo) => ({ ...previo, [clave]: valor }));
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarConfig(borrador);
      await recargarConfig();
      setGuardado(true);
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const estilo = leerEstiloMenu(borrador);
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(config);

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Configuración</strong>
        <span className="empuje" />
        {guardado && <span className="tenue">Guardado ✓</span>}
        {hayCambios && <span className="marcador-sucio">Cambios sin guardar</span>}
        <button className="btn primario" disabled={!hayCambios || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo">
        <aside className="panel ancho">
          <div className="grupo">
            <h2>Negocio</h2>
            <Campo etiqueta="Nombre" clave="negocio_nombre" borrador={borrador} onCambio={cambiar} />
            <Campo etiqueta="Dirección" clave="negocio_direccion" borrador={borrador} onCambio={cambiar} />
            <Campo etiqueta="Teléfono" clave="negocio_telefono" borrador={borrador} onCambio={cambiar} />
            <Campo etiqueta="Pie del ticket" clave="ticket_pie" borrador={borrador} onCambio={cambiar} />
          </div>

          <div className="grupo">
            <h2>Impuestos y propina</h2>
            <Campo etiqueta="IVA (%)" clave="impuesto_tasa" borrador={borrador} onCambio={cambiar} tipo="number" />
            <div className="campo">
              <label>¿Los precios del menú ya incluyen IVA?</label>
              <div className="opciones">
                <button
                  className={`opcion${borrador.impuesto_incluido !== '0' ? ' elegida' : ''}`}
                  onClick={() => cambiar('impuesto_incluido', '1')}
                >
                  Sí, incluido
                </button>
                <button
                  className={`opcion${borrador.impuesto_incluido === '0' ? ' elegida' : ''}`}
                  onClick={() => cambiar('impuesto_incluido', '0')}
                >
                  No, se suma
                </button>
              </div>
              <p className="tenue">Lo normal en un restaurante mexicano es que el precio del menú ya lo incluya.</p>
            </div>
            <Campo
              etiqueta="Propinas sugeridas (%) separadas por coma"
              clave="propina_sugerida"
              borrador={borrador}
              onCambio={cambiar}
            />
          </div>

          <div className="grupo">
            <h2>Estilo del menú</h2>
            <p className="tenue">
              Así se verá la pantalla donde el mesero toma la orden. Cambia lo que quieras y míralo a la derecha.
            </p>

            <Eleccion
              etiqueta="Presentación"
              clave="menu_vista"
              valor={borrador.menu_vista ?? 'cuadricula'}
              opciones={[['cuadricula', 'Cuadrícula'], ['lista', 'Lista']]}
              onCambio={cambiar}
            />
            {estilo.vista === 'cuadricula' && (
              <Eleccion
                etiqueta="Columnas"
                clave="menu_columnas"
                valor={borrador.menu_columnas ?? '3'}
                opciones={[['2', '2'], ['3', '3'], ['4', '4']]}
                onCambio={cambiar}
              />
            )}
            <Eleccion
              etiqueta="Tamaño de los botones"
              clave="menu_tamano_boton"
              valor={borrador.menu_tamano_boton ?? 'grande'}
              opciones={[['grande', 'Grandes'], ['comodo', 'Cómodos']]}
              onCambio={cambiar}
            />
            <Eleccion
              etiqueta="Mostrar precios"
              clave="menu_mostrar_precios"
              valor={borrador.menu_mostrar_precios ?? '1'}
              opciones={[['1', 'Sí'], ['0', 'No']]}
              onCambio={cambiar}
            />
            <Eleccion
              etiqueta="Mostrar descripción"
              clave="menu_mostrar_descripcion"
              valor={borrador.menu_mostrar_descripcion ?? '0'}
              opciones={[['1', 'Sí'], ['0', 'No']]}
              onCambio={cambiar}
            />
            <Eleccion
              etiqueta="Color por categoría"
              clave="menu_color_por_categoria"
              valor={borrador.menu_color_por_categoria ?? '1'}
              opciones={[['1', 'Sí'], ['0', 'No']]}
              onCambio={cambiar}
            />
            <Eleccion
              etiqueta="Productos agotados"
              clave="menu_agotados"
              valor={borrador.menu_agotados ?? 'atenuar'}
              opciones={[['atenuar', 'Mostrarlos apagados'], ['ocultar', 'Ocultarlos']]}
              onCambio={cambiar}
            />
            <p className="tenue">
              Mostrarlos apagados evita que el mesero los busque una y otra vez; ocultarlos deja la pantalla más limpia.
            </p>
          </div>
        </aside>

        <div className="columna-menu vista-previa">
          <div className="etiqueta-previa">Vista previa de la pantalla de venta</div>
          <MenuVenta categorias={menu} estilo={estilo} onElegir={() => {}} />
        </div>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  clave,
  borrador,
  onCambio,
  tipo = 'text',
}: {
  etiqueta: string;
  clave: string;
  borrador: Config;
  onCambio: (clave: string, valor: string) => void;
  tipo?: string;
}) {
  return (
    <div className="campo">
      <label htmlFor={`cfg-${clave}`}>{etiqueta}</label>
      <input id={`cfg-${clave}`} type={tipo} value={borrador[clave] ?? ''} onChange={(e) => onCambio(clave, e.target.value)} />
    </div>
  );
}

function Eleccion({
  etiqueta,
  clave,
  valor,
  opciones,
  onCambio,
}: {
  etiqueta: string;
  clave: string;
  valor: string;
  opciones: [string, string][];
  onCambio: (clave: string, valor: string) => void;
}) {
  return (
    <div className="campo">
      <label>{etiqueta}</label>
      <div className="opciones">
        {opciones.map(([v, texto]) => (
          <button key={v} className={`opcion${valor === v ? ' elegida' : ''}`} onClick={() => onCambio(clave, v)}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
