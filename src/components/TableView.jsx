import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../services/catalogService.js';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import { formatNumber } from '../utils/format.js';
import TableHud from './TableHud.jsx';
import ModalPanel from './ModalPanel.jsx';
import EconomyPanel from './EconomyPanel.jsx';
import CatalogCheck from './CatalogCheck.jsx';
import SceneBoundary from './SceneBoundary.jsx';
import styles from './TableView.module.css';

// La escena 3D (Three.js) pesa bastante: se descarga solo cuando ya has iniciado sesión.
const TableScene = lazy(() => import('./table/TableScene.jsx'));

function leerCalidad() {
  try {
    return window.localStorage.getItem('opi_calidad') === 'baja' ? 'baja' : 'alta';
  } catch {
    return 'alta';
  }
}
function guardarCalidad(valor) {
  try {
    window.localStorage.setItem('opi_calidad', valor);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export default function TableView({ jugador, economia, esAdmin, onAdmin, onSalir }) {
  const [calidad, setCalidad] = useState(leerCalidad);
  const [panel, setPanel] = useState(null);
  const [seleccionId, setSeleccionId] = useState(null);
  const [burst, setBurst] = useState(null);
  const [aviso, setAviso] = useState('');
  const [catalogo, setCatalogo] = useState(null);

  const { coins, produccion, totalPendiente, filas, capSeg, ocupado, ultimaRecogida, recogerTodo, recogerCarta } = economia;
  const monedasAnimadas = useAnimatedNumber(coins);

  useEffect(() => {
    loadCatalog().then(setCatalogo).catch(() => setCatalogo(null));
  }, []);

  // Lluvia de monedas cada vez que recoges algo.
  useEffect(() => {
    if (ultimaRecogida && ultimaRecogida.cantidad > 0) setBurst({ id: ultimaRecogida.id });
  }, [ultimaRecogida]);

  // Las 5 cartas que más producen. Solo se recalcula si cambian las cartas o sus niveles
  // (no cada medio segundo, que es lo que cambia el "pendiente").
  const clave = filas.slice(0, 5).map((f) => `${f.card_id}:${f.level}`).join('|');
  const destacadas = useMemo(() => {
    if (!catalogo) return [];
    return filas
      .slice(0, 5)
      .map((f) => {
        const info = catalogo.byId.get(f.card_id);
        return info ? { ...info, card_id: f.card_id } : null;
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, catalogo]);

  const seleccionada = seleccionId ? filas.find((f) => f.card_id === seleccionId) : null;
  const infoSeleccionada = seleccionada && catalogo ? catalogo.byId.get(seleccionada.card_id) : null;

  function cambiarCalidad() {
    const nueva = calidad === 'alta' ? 'baja' : 'alta';
    setCalidad(nueva);
    guardarCalidad(nueva);
    setAviso('');
  }

  function bajarCalidadAuto() {
    if (calidad === 'alta') {
      setCalidad('baja');
      guardarCalidad('baja');
      setAviso('Calidad reducida automáticamente para que vaya más fluido. Puedes volver a subirla abajo.');
    }
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.escena}>
        <SceneBoundary
          fallback={<div className={styles.sin3d}>No se pudo iniciar el 3D en este navegador (WebGL). El resto del juego funciona: abre «Colección».</div>}
        >
          <Suspense fallback={<div className={styles.sin3d}>Cargando mesa...</div>}>
            <TableScene
              calidad={calidad}
              coins={monedasAnimadas}
              destacadas={destacadas}
              seleccionId={seleccionId}
              burst={burst}
              onBurstDone={() => setBurst(null)}
              onSelect={setSeleccionId}
              onDecline={bajarCalidadAuto}
            />
          </Suspense>
        </SceneBoundary>
      </div>

      <TableHud
        nombre={jugador.profile.username}
        monedas={monedasAnimadas}
        produccion={produccion}
        pendiente={totalPendiente}
        capSeg={capSeg}
        ocupado={ocupado}
        sinCartas={filas.length === 0}
        esAdmin={esAdmin}
        calidad={calidad}
        aviso={aviso || economia.aviso?.texto}
        onRecogerTodo={recogerTodo}
        onColeccion={() => setPanel('coleccion')}
        onCatalogo={() => setPanel('catalogo')}
        onCalidad={cambiarCalidad}
        onAdmin={onAdmin}
        onSalir={onSalir}
      />

      {seleccionada && (
        <div className={styles.detalle}>
          <strong>{infoSeleccionada?.name ?? seleccionada.card_id}</strong>
          <span>
            {infoSeleccionada?.id} · {infoSeleccionada?.rarity} · Nv. {seleccionada.level} · x{seleccionada.copies}
          </span>
          <span>
            {formatNumber(seleccionada.production_per_sec)}/s · pendiente +{formatNumber(seleccionada.pendiente)}
          </span>
          <div className={styles.filaBotones}>
            <button type="button" disabled={ocupado || seleccionada.pendiente < 1} onClick={() => recogerCarta(seleccionada.card_id)}>
              Recoger
            </button>
            <button type="button" onClick={() => setSeleccionId(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {panel === 'coleccion' && (
        <ModalPanel titulo="Colección" onClose={() => setPanel(null)}>
          <EconomyPanel economia={economia} />
        </ModalPanel>
      )}
      {panel === 'catalogo' && (
        <ModalPanel titulo="Estado del catálogo" onClose={() => setPanel(null)}>
          <CatalogCheck />
        </ModalPanel>
      )}
    </div>
  );
}
