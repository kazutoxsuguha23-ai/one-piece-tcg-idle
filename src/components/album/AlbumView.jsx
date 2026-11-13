import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from '../../utils/format.js';
import {
  POR_PAGINA, dividirEnPaginas, filtrarYOrdenar, rotuloPaginas, spreadDePagina,
} from './albumUtils.js';
import Libro from './Libro.jsx';
import Pagina from './Pagina.jsx';
import CartaDetalle from './CartaDetalle.jsx';
import styles from './AlbumView.module.css';

const TIPOS = [
  ['booster', 'Boosters'],
  ['extra_booster', 'Extra Boosters'],
  ['premium_booster', 'Premium Boosters'],
  ['starter_deck', 'Starter Decks'],
  ['promo', 'Promos'],
  ['don', 'DON!!'],
  ['other', 'Otros'],
];
const ORDENES = [
  ['codigo', 'Orden del set'],
  ['rareza', 'Rareza (mayor primero)'],
  ['produccion', 'Producción (mayor primero)'],
  ['nivel', 'Nivel (mayor primero)'],
  ['copias', 'Copias (más primero)'],
  ['nombre', 'Nombre (A-Z)'],
];

function usarPantallaEstrecha() {
  const consulta = '(max-width: 720px)';
  const [estrecha, setEstrecha] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const cambiar = (e) => setEstrecha(e.matches);
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, []);
  return estrecha;
}

// Álbum: libro 3D por sets, con filtros, búsqueda, orden, ficha de carta y reclamación de monedas.
export default function AlbumView({ catalogo, economia, onCerrar }) {
  const { filas, ocupado, totalPendiente, recogerCarta, recogerTodo, ultimaRecogida } = economia;
  const uni = usarPantallaEstrecha();
  const libro = useRef(null);

  const [setId, setSetId] = useState('');
  const [rareza, setRareza] = useState('');
  const [estado, setEstado] = useState('todas');
  const [orden, setOrden] = useState('codigo');
  const [texto, setTexto] = useState('');
  const [detalleId, setDetalleId] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState({ spread: 0, total: 1 });
  const [irPagina, setIrPagina] = useState('');

  const poseidas = useMemo(() => new Map(filas.map((f) => [f.card_id, f])), [filas]);

  const totalesPorSet = useMemo(() => {
    const mapa = new Map();
    if (catalogo) catalogo.cards.forEach((c) => { if (!c.retired) mapa.set(c.set, (mapa.get(c.set) ?? 0) + 1); });
    return mapa;
  }, [catalogo]);

  const descubiertasPorSet = useMemo(() => {
    const mapa = new Map();
    if (catalogo) {
      filas.forEach((f) => {
        const info = catalogo.byId.get(f.card_id);
        if (info) mapa.set(info.set, (mapa.get(info.set) ?? 0) + 1);
      });
    }
    return mapa;
  }, [filas, catalogo]);

  // Al cargar el catálogo se elige el set donde más cartas tienes (o el primero).
  useEffect(() => {
    if (!catalogo || setId) return;
    let mejor = catalogo.sets[0]?.id ?? '';
    let max = -1;
    catalogo.sets.forEach((s) => {
      const n = descubiertasPorSet.get(s.id) ?? 0;
      if (n > max) { max = n; mejor = s.id; }
    });
    setSetId(mejor);
  }, [catalogo, setId, descubiertasPorSet]);

  // La portada se cierra y se vuelve a abrir al cambiar de set: el libro "se abre" cada vez.
  useEffect(() => {
    setAbierto(false);
    if (!setId) return undefined;
    const id = setTimeout(() => setAbierto(true), 450);
    return () => clearTimeout(id);
  }, [setId]);

  const gruposSets = useMemo(() => {
    if (!catalogo) return [];
    return TIPOS.map(([tipo, titulo]) => ({
      titulo,
      sets: catalogo.sets
        .filter((s) => (TIPOS.some(([t]) => t === s.kind) ? s.kind : 'other') === tipo)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    })).filter((g) => g.sets.length > 0);
  }, [catalogo]);

  const setActual = catalogo?.sets.find((s) => s.id === setId) ?? null;
  const cartasDelSet = useMemo(
    () => (catalogo ? catalogo.cards.filter((c) => c.set === setId && !c.retired) : []),
    [catalogo, setId],
  );
  const rarezas = useMemo(() => [...new Set(cartasDelSet.map((c) => c.rarity))].sort(), [cartasDelSet]);

  useEffect(() => { setRareza(''); }, [setId]);

  const lista = useMemo(
    () => filtrarYOrdenar(cartasDelSet, poseidas, { rareza, estado, texto, orden }),
    [cartasDelSet, poseidas, rareza, estado, texto, orden],
  );
  const paginas = useMemo(() => dividirEnPaginas(lista, POR_PAGINA), [lista]);

  const descubiertas = descubiertasPorSet.get(setId) ?? 0;
  const total = totalesPorSet.get(setId) ?? 0;
  const porcentaje = total ? Math.round((descubiertas / total) * 100) : 0;

  const abrirDetalle = useCallback((item) => setDetalleId(item.info.id), []);
  const indiceDetalle = detalleId ? lista.findIndex((x) => x.info.id === detalleId) : -1;
  const itemDetalle = indiceDetalle >= 0 ? lista[indiceDetalle] : null;

  const moverDetalle = useCallback(
    (d) => {
      if (lista.length === 0) return;
      const i = indiceDetalle < 0 ? 0 : (indiceDetalle + d + lista.length) % lista.length;
      setDetalleId(lista[i].info.id);
      // Lleva el libro a la página de esa carta
      libro.current?.irA(spreadDePagina(Math.floor(i / POR_PAGINA), uni));
    },
    [lista, indiceDetalle, uni],
  );

  // Si el filtro actual esconde la carta abierta, se cierra la ficha.
  useEffect(() => {
    if (detalleId && indiceDetalle < 0) setDetalleId(null);
  }, [detalleId, indiceDetalle]);

  useEffect(() => {
    if (detalleId) return undefined;
    function alPulsar(e) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [detalleId, onCerrar]);

  const renderPagina = useCallback(
    (i) => (
      <Pagina
        items={i >= 0 && i < paginas.length ? paginas[i] : null}
        numero={i + 1}
        onAbrir={abrirDetalle}
        onRecoger={recogerCarta}
        ocupado={ocupado}
      />
    ),
    [paginas, abrirDetalle, recogerCarta, ocupado],
  );

  function saltarAPagina(e) {
    e.preventDefault();
    const n = parseInt(irPagina, 10);
    if (!Number.isFinite(n) || paginas.length === 0) return;
    const indice = Math.max(0, Math.min(paginas.length - 1, n - 1));
    libro.current?.irA(spreadDePagina(indice, uni));
    setIrPagina('');
  }

  if (!catalogo) {
    return (
      <div className={styles.fondo}>
        <p className={styles.cargando}>Cargando catálogo...</p>
        <button type="button" className={styles.volver} onClick={onCerrar}>← Mesa</button>
      </div>
    );
  }

  return (
    <div className={styles.fondo}>
      <div className={styles.barra}>
        <button type="button" className={styles.volver} onClick={onCerrar}>← Mesa</button>
        <select value={setId} onChange={(e) => setSetId(e.target.value)} aria-label="Set">
          {gruposSets.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.name} ({descubiertasPorSet.get(s.id) ?? 0}/{totalesPorSet.get(s.id) ?? 0})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={rareza} onChange={(e) => setRareza(e.target.value)} aria-label="Rareza o variante">
          <option value="">Todas las rarezas</option>
          {rarezas.map((r) => <option key={r} value={`r:${r}`}>{r}</option>)}
          <option value="v:alt">Arte alternativo</option>
          <option value="v:manga">Manga</option>
          <option value="v:sp">SP</option>
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="todas">Todas</option>
          <option value="descubiertas">Descubiertas</option>
          <option value="desconocidas">Sin descubrir</option>
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por">
          {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <input
          type="search"
          placeholder="Buscar nombre o código..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      <div className={styles.info}>
        <span>
          <strong>{descubiertas}</strong> de <strong>{total}</strong> descubiertas ({porcentaje}%)
          {lista.length !== cartasDelSet.length && ` · mostrando ${lista.length}`}
        </span>
        <span className={styles.reclamar}>
          Pendiente: <strong>+{formatNumber(totalPendiente)}</strong>
          <button type="button" disabled={ocupado || totalPendiente < 1} onClick={recogerTodo}>Recoger todo</button>
          {ultimaRecogida && ultimaRecogida.cantidad > 0 && (
            <em key={ultimaRecogida.id} className={styles.flota}>+{formatNumber(ultimaRecogida.cantidad)}</em>
          )}
        </span>
      </div>

      <div className={styles.zonaLibro}>
        {paginas.length === 0 ? (
          <p className={styles.vacio}>No hay cartas que coincidan con los filtros.</p>
        ) : (
          <Libro
            ref={libro}
            paginas={paginas}
            renderPagina={renderPagina}
            portada={{
              titulo: setActual?.name ?? '',
              subtitulo: setActual?.id ?? '',
              progreso: `${descubiertas}/${total} · ${porcentaje}%`,
            }}
            uni={uni}
            abierto={abierto}
            activo={!detalleId}
            clave={`${setId}|${rareza}|${estado}|${orden}|${texto}`}
            onCambio={setVista}
            onAbrirPortada={() => setAbierto(true)}
          />
        )}
      </div>

      <div className={styles.pie}>
        <button type="button" disabled={vista.spread === 0} onClick={() => libro.current?.pasar(-1)}>◀</button>
        <span>{rotuloPaginas(vista.spread, paginas.length, uni)}</span>
        <button type="button" disabled={vista.spread >= vista.total - 1} onClick={() => libro.current?.pasar(1)}>▶</button>
        <form onSubmit={saltarAPagina} className={styles.ir}>
          <input
            type="number"
            min="1"
            max={Math.max(1, paginas.length)}
            placeholder="Ir a pág."
            value={irPagina}
            onChange={(e) => setIrPagina(e.target.value)}
            aria-label="Ir a la página"
          />
        </form>
      </div>
      <p className={styles.ayuda}>
        Flechas del teclado o desliza para pasar de página · Pulsa una carta para verla en grande y girarla
      </p>

      {itemDetalle && (
        <CartaDetalle
          item={itemDetalle}
          nombreSet={setActual?.name ?? ''}
          onClose={() => setDetalleId(null)}
          onPrev={() => moverDetalle(-1)}
          onNext={() => moverDetalle(1)}
          onRecoger={recogerCarta}
          ocupado={ocupado}
        />
      )}
    </div>
  );
}
