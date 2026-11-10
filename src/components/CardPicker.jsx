import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../services/catalogService.js';
import styles from './CardPicker.module.css';

const PAGINA = 60;
const TIPOS = [
  ['booster', 'Boosters'],
  ['extra_booster', 'Extra Boosters'],
  ['premium_booster', 'Premium Boosters'],
  ['starter_deck', 'Starter Decks'],
  ['promo', 'Promos'],
  ['don', 'DON!!'],
  ['other', 'Otros'],
];

function etiquetaVariante(c) {
  return `${c.rarity}${c.manga ? ' · Manga' : c.sp ? ' · SP' : c.alt ? ' · Alt' : ''}`;
}

// Ventana para elegir una carta del catálogo: desplegable de sets + cuadrícula con imágenes.
export default function CardPicker({ seleccionada, onSelect, onClose }) {
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState('');
  const [setId, setSetId] = useState('');
  const [texto, setTexto] = useState('');
  const [rareza, setRareza] = useState('');
  const [visibles, setVisibles] = useState(PAGINA);

  useEffect(() => {
    loadCatalog()
      .then((cat) => {
        setCatalogo(cat);
        setSetId(seleccionada?.set ?? cat.sets[0]?.id ?? '');
      })
      .catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function alPulsar(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  useEffect(() => { setVisibles(PAGINA); }, [setId, texto, rareza]);

  const gruposSets = useMemo(() => {
    if (!catalogo) return [];
    return TIPOS.map(([tipo, titulo]) => ({
      titulo,
      sets: catalogo.sets
        .filter((s) => (TIPOS.some(([t]) => t === s.kind) ? s.kind : 'other') === tipo)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    })).filter((g) => g.sets.length > 0);
  }, [catalogo]);

  const cartasDelSet = useMemo(
    () => (catalogo ? catalogo.cards.filter((c) => c.set === setId && !c.retired) : []),
    [catalogo, setId],
  );
  const rarezas = useMemo(() => [...new Set(cartasDelSet.map((c) => c.rarity))].sort(), [cartasDelSet]);
  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return cartasDelSet.filter(
      (c) => (!rareza || c.rarity === rareza)
        && (!t || c.name.toLowerCase().includes(t) || c.id.toLowerCase().includes(t)),
    );
  }, [cartasDelSet, texto, rareza]);

  const setActual = catalogo?.sets.find((s) => s.id === setId);

  return (
    <div className={styles.fondo} role="dialog" aria-label="Elegir carta">
      <div className={styles.ventana}>
        <header className={styles.cabecera}>
          <h2>Elegir carta</h2>
          <button type="button" onClick={onClose}>Cerrar (Esc)</button>
        </header>

        {error && <p className={styles.error}>{error}</p>}
        {!catalogo && !error && <p>Cargando catálogo...</p>}

        {catalogo && (
          <>
            <div className={styles.controles}>
              <select value={setId} onChange={(e) => setSetId(e.target.value)} aria-label="Set">
                {gruposSets.map((g) => (
                  <optgroup key={g.titulo} label={g.titulo}>
                    {g.sets.map((s) => (
                      <option key={s.id} value={s.id}>{s.id} · {s.name} ({s.card_count})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select value={rareza} onChange={(e) => setRareza(e.target.value)} aria-label="Rareza">
                <option value="">Todas las rarezas</option>
                {rarezas.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input
                placeholder="Filtrar por nombre o código..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <p className={styles.cuenta}>
              {setActual ? `${setActual.id} · ${setActual.name}: ` : ''}
              {filtradas.length} de {cartasDelSet.length} cartas
            </p>

            <div className={styles.cuadricula}>
              {filtradas.slice(0, visibles).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.carta} ${seleccionada?.id === c.id ? styles.marcada : ''}`}
                  onClick={() => { onSelect(c); onClose(); }}
                  title={`${c.name} · ${c.id}`}
                >
                  {c.image ? <img src={c.image} alt={c.name} loading="lazy" /> : <div className={styles.sinImagen}>Sin imagen</div>}
                  <span className={styles.nombre}>{c.name}</span>
                  <small>{c.id} · {etiquetaVariante(c)}</small>
                </button>
              ))}
            </div>
            {filtradas.length > visibles && (
              <button type="button" className={styles.mas} onClick={() => setVisibles((v) => v + PAGINA)}>
                Mostrar más ({filtradas.length - visibles} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
