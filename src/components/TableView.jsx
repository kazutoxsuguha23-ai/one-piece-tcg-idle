import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCatalog } from '../services/catalogService.js';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import { usePacks } from '../hooks/usePacks.js';
import TableHud from './TableHud.jsx';
import ModalPanel from './ModalPanel.jsx';
import EconomyPanel from './EconomyPanel.jsx';
import CatalogCheck from './CatalogCheck.jsx';
import ShopPanel from './ShopPanel.jsx';
import ResultsPanel from './ResultsPanel.jsx';
import MejorasPanel from './MejorasPanel.jsx';
import AlbumView from './album/AlbumView.jsx';
import SceneBoundary from './SceneBoundary.jsx';
import styles from './TableView.module.css';

// La escena 3D (R3F, drei) pesa bastante: se descarga solo cuando hace falta.
const TableScene = lazy(() => import('./table/TableScene.jsx'));

const POR_PAGINA = 12;
const RETRASO_SIGUIENTE_MS = 450;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

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

// Modos: mesa -> inspeccion -> abriendo -> revelado -> resultados -> mesa
// Con "Abrir todos" hay un `lote`: al terminar las cartas de un sobre se rasga solo el siguiente,
// y los resultados de todos se juntan en una única pantalla final.
export default function TableView({ jugador, economia, esAdmin, onAdmin, onSalir, onRefrescar }) {
  const [calidad, setCalidad] = useState(leerCalidad);
  const [panel, setPanel] = useState(null); // 'tienda' | 'coleccion' | 'mejoras' | 'catalogo' | null
  const [albumAbierto, setAlbumAbierto] = useState(false);
  const [modo, setModo] = useState('mesa');
  const [productoId, setProductoId] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [zoom, setZoom] = useState(0.35);
  const [ordenAbrir, setOrdenAbrir] = useState(0);
  const [claveSobre, setClaveSobre] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [lote, setLote] = useState(null); // { total, hechos, acumuladas } | null
  const [burst, setBurst] = useState(null);
  const [aviso, setAviso] = useState('');
  const [catalogo, setCatalogo] = useState(null);

  const loteRef = useRef(null);
  loteRef.current = lote;

  const packs = usePacks(jugador);
  const { coins, produccion, totalPendiente, capSeg, ultimaRecogida } = economia;
  const monedasAnimadas = useAnimatedNumber(coins);

  useEffect(() => {
    loadCatalog().then(setCatalogo).catch(() => setCatalogo(null));
  }, []);

  // Lluvia de monedas cada vez que recoges algo (desde la Colección).
  useEffect(() => {
    if (ultimaRecogida && ultimaRecogida.cantidad > 0) setBurst({ id: ultimaRecogida.id });
  }, [ultimaRecogida]);

  const pilas = useMemo(() => {
    const porId = new Map(packs.productos.map((p) => [p.product_id, p]));
    return packs.misSobres
      .map((s) => ({ producto: porId.get(s.product_id), cantidad: s.quantity }))
      .filter((x) => x.producto)
      .sort((a, b) => a.producto.sort_order - b.producto.sort_order);
  }, [packs.productos, packs.misSobres]);

  const totalPaginas = Math.max(1, Math.ceil(pilas.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const pilasPagina = pilas.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA);

  const productoActivo = productoId ? packs.productos.find((p) => p.product_id === productoId) ?? null : null;
  const restantes = productoId ? packs.misSobres.find((s) => s.product_id === productoId)?.quantity ?? 0 : 0;
  const cartaActual = resultado ? resultado.cartas[resultado.indice] : null;

  // Convierte la respuesta del servidor en cartas con su información del catálogo.
  const construirCartas = useCallback(
    (r) => (r.cards ?? []).map((c) => ({
      info: catalogo?.byId.get(c.card_id) ?? {
        id: c.card_id, name: c.card_id, rarity: '?', image: '', type: '', color: null, cost: null, power: null,
      },
      esNueva: Boolean(c.is_new),
    })),
    [catalogo],
  );

  const seleccionarPila = useCallback((id) => {
    setProductoId(id);
    setAviso('');
    setLote(null);
    setOrdenAbrir(0);
    setClaveSobre((k) => k + 1);
    setModo('inspeccion');
  }, []);

  const volver = useCallback(() => {
    setModo('mesa');
    setProductoId(null);
    setLote(null);
    setAviso('');
  }, []);

  // El sobre se ha rasgado: se pide al servidor que genere las cartas.
  const abrirSobre = useCallback(async () => {
    if (!productoActivo) return;
    if (!catalogo) {
      setAviso('El catálogo aún no ha cargado, espera un momento.');
      setLote(null);
      setClaveSobre((k) => k + 1);
      setOrdenAbrir(0);
      return;
    }
    setModo('abriendo');
    setAviso('');
    try {
      const r = await packs.abrir(productoActivo.product_id);
      const cartas = construirCartas(r);
      // Si falla el refresco de la colección no pasa nada: las cartas ya están guardadas en el servidor.
      await economia.recargarCartas().catch(() => {});
      setLote((l) => (l ? { ...l, hechos: l.hechos + 1, acumuladas: [...l.acumuladas, ...cartas] } : l));
      setResultado({ cartas, indice: 0 });
      setModo('revelado');
    } catch (e) {
      setAviso(e.message);
      const l = loteRef.current;
      if (l && l.acumuladas.length > 0) {
        setResultado(null);
        setModo('resultados');
      } else {
        setLote(null);
        setClaveSobre((k) => k + 1);
        setOrdenAbrir(0);
        setModo('inspeccion');
      }
    }
  }, [productoActivo, catalogo, packs, economia, construirCartas]);

  const abrirUno = useCallback(() => {
    setLote(null);
    setOrdenAbrir((n) => n + 1);
  }, []);

  const abrirTodos = useCallback(() => {
    if (restantes < 1) return;
    setLote({ total: restantes, hechos: 0, acumuladas: [] });
    setOrdenAbrir((n) => n + 1);
  }, [restantes]);

  const avanzar = useCallback(() => {
    setResultado((r) => (r ? { ...r, indice: r.indice + 1 } : r));
  }, []);

  // Al terminar de ver las cartas de un sobre: si hay lote, se rasga solo el siguiente; si no, resultados.
  useEffect(() => {
    if (modo !== 'revelado' || !resultado || resultado.indice < resultado.cartas.length) return;
    if (lote && lote.hechos < lote.total && restantes > 0) {
      setResultado(null);
      setClaveSobre((k) => k + 1);
      setModo('inspeccion'); // `ordenAbrir` sigue activo: el nuevo sobre se rasga solo
    } else {
      setModo('resultados');
    }
  }, [modo, resultado, lote, restantes]);

  // "Saltar este sobre": termina su revelado (en lote pasa al siguiente; solo, va a resultados).
  const saltarEste = useCallback(() => {
    if (loteRef.current && loteRef.current.total > 1) {
      setResultado((r) => (r ? { ...r, indice: r.cartas.length } : r));
    } else {
      setModo('resultados');
    }
  }, []);

  // "Saltar todos": abre el resto de sobres del lote de golpe, sin animaciones, y va a los resultados.
  const saltarTodo = useCallback(async () => {
    const l = loteRef.current;
    if (!l || !productoActivo) return;
    setModo('abriendo');
    setAviso('');
    let hechos = l.hechos;
    let acumuladas = l.acumuladas;
    try {
      while (hechos < l.total) {
        const r = await packs.abrir(productoActivo.product_id);
        acumuladas = [...acumuladas, ...construirCartas(r)];
        hechos += 1;
        setLote((x) => (x ? { ...x, hechos, acumuladas } : x));
      }
    } catch (e) {
      setAviso(e.message);
    }
    await economia.recargarCartas().catch(() => {});
    setResultado(null);
    setModo('resultados');
  }, [productoActivo, packs, economia, construirCartas]);

  // Seguridad: detiene la apertura en masa. Si ya se abrió algún sobre, enseña lo conseguido.
  const detenerLote = useCallback(() => {
    const l = loteRef.current;
    if (l && l.acumuladas.length > 0) {
      setResultado(null);
      setModo('resultados');
    } else {
      volver();
    }
  }, [volver]);

  useEffect(() => {
    if (modo !== 'inspeccion' || panel || lote) return undefined;
    function alPulsar(e) {
      if (e.key === 'Escape') volver();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [modo, panel, lote, volver]);

  const cerrarResultados = useCallback(() => {
    setResultado(null);
    setLote(null);
    setProductoId(null);
    setOrdenAbrir(0);
    setModo('mesa');
  }, []);

  const abrirOtro = useCallback(() => {
    setResultado(null);
    setLote(null);
    setOrdenAbrir(0);
    setClaveSobre((k) => k + 1);
    setModo('inspeccion');
  }, []);

  async function comprar(productId, cantidad) {
    const r = await packs.comprar(productId, cantidad);
    economia.aplicarSaldo(r.coins);
    return r;
  }

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

  const cartasResultado = lote ? lote.acumuladas : resultado?.cartas ?? [];
  const sobresAbiertos = lote ? lote.hechos : 1;

  return (
    <div
      className={styles.contenedor}
      onWheel={(e) => {
        if (modo !== 'mesa' && !panel) setZoom((z) => limitar(z - e.deltaY * 0.001, 0, 1));
      }}
    >
      <div className={styles.escena}>
        <SceneBoundary
          fallback={<div className={styles.sin3d}>No se pudo iniciar el 3D en este navegador (WebGL). El resto del juego funciona: abre «Colección».</div>}
        >
          <Suspense fallback={<div className={styles.sin3d}>Cargando mesa...</div>}>
            <TableScene
              calidad={calidad}
              coins={monedasAnimadas}
              modo={modo}
              pilas={pilasPagina}
              productoActivo={productoActivo}
              claveSobre={claveSobre}
              zoom={zoom}
              ordenAbrir={ordenAbrir}
              retrasoAbrir={lote && lote.hechos > 0 ? RETRASO_SIGUIENTE_MS : 0}
              resultado={resultado}
              burst={burst}
              onBurstDone={() => setBurst(null)}
              onSelectPack={seleccionarPila}
              onTear={abrirSobre}
              onAdvance={avanzar}
              onDecline={bajarCalidadAuto}
              pausada={albumAbierto}
            />
          </Suspense>
        </SceneBoundary>
      </div>

      <TableHud
        modo={modo}
        nombre={jugador.profile.username}
        monedas={monedasAnimadas}
        produccion={produccion}
        pendiente={totalPendiente}
        capSeg={capSeg}
        aviso={aviso || economia.aviso?.texto || (modo === 'mesa' ? packs.error : '')}
        esAdmin={esAdmin}
        calidad={calidad}
        sinSobres={pilas.length === 0}
        pagina={paginaSegura}
        totalPaginas={totalPaginas}
        productoNombre={productoActivo?.name ?? ''}
        restantes={restantes}
        cartaActual={cartaActual}
        indice={resultado?.indice ?? 0}
        total={resultado?.cartas.length ?? 0}
        lote={lote}
        onTienda={() => setPanel('tienda')}
        onAlbum={() => setAlbumAbierto(true)}
        onColeccion={() => setPanel('coleccion')}
        onMejoras={() => setPanel('mejoras')}
        onCatalogo={() => setPanel('catalogo')}
        onCalidad={cambiarCalidad}
        onAdmin={onAdmin}
        onSalir={onSalir}
        onPagina={(d) => setPagina(limitar(paginaSegura + d, 0, totalPaginas - 1))}
        onVolver={volver}
        onZoom={(d) => setZoom((z) => limitar(z + d, 0, 1))}
        onAbrir={abrirUno}
        onAbrirTodos={abrirTodos}
        onSaltar={saltarEste}
        onSaltarTodo={saltarTodo}
        onDetener={detenerLote}
      />

      {albumAbierto && (
        <AlbumView catalogo={catalogo} economia={economia} onCerrar={() => setAlbumAbierto(false)} />
      )}

      {panel === 'tienda' && (
        <ModalPanel titulo="Tienda de sobres" onClose={() => setPanel(null)}>
          <ShopPanel
            productos={packs.productos}
            coins={coins}
            ocupado={packs.ocupado}
            error={packs.error}
            onComprar={comprar}
          />
        </ModalPanel>
      )}
      {panel === 'coleccion' && (
        <ModalPanel titulo="Colección" onClose={() => setPanel(null)}>
          <EconomyPanel economia={economia} />
        </ModalPanel>
      )}
      {panel === 'mejoras' && (
        <ModalPanel titulo="Mejoras" onClose={() => setPanel(null)}>
          <MejorasPanel coins={coins} economia={economia} onRefrescar={onRefrescar} />
        </ModalPanel>
      )}
      {panel === 'catalogo' && (
        <ModalPanel titulo="Estado del catálogo" onClose={() => setPanel(null)}>
          <CatalogCheck />
        </ModalPanel>
      )}
      {modo === 'resultados' && cartasResultado.length > 0 && (
        <ResultsPanel
          cartas={cartasResultado}
          sobres={sobresAbiertos}
          restantes={restantes}
          onCerrar={cerrarResultados}
          onOtro={abrirOtro}
        />
      )}
    </div>
  );
}
