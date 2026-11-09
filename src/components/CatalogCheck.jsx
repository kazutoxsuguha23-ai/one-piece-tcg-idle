import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../services/catalogService.js';
import styles from './CatalogCheck.module.css';

function contar(lista, clave) {
  const resultado = {};
  lista.forEach((x) => {
    const k = clave(x);
    resultado[k] = (resultado[k] ?? 0) + 1;
  });
  return resultado;
}

// Panel de comprobación de la Fase 4: confirma que el catálogo se ha importado
// y que las imágenes se pueden usar como textura 3D (CORS).
export default function CatalogCheck() {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [cors, setCors] = useState('probando');

  useEffect(() => {
    let activo = true;
    loadCatalog()
      .then((cat) => activo && setEstado({ fase: 'ok', cat }))
      .catch((e) => activo && setEstado({ fase: 'error', mensaje: e.message }));
    return () => { activo = false; };
  }, []);

  const muestra = useMemo(() => {
    if (estado.fase !== 'ok') return [];
    const { cards } = estado.cat;
    const buscadores = [
      (c) => c.manga, (c) => c.sp, (c) => c.rarity === 'SEC', (c) => c.alt,
      (c) => c.rarity === 'SR', (c) => c.rarity === 'L',
    ];
    const elegidas = [];
    buscadores.forEach((f) => {
      const carta = cards.find((c) => f(c) && c.image && !elegidas.includes(c));
      if (carta) elegidas.push(carta);
    });
    return elegidas;
  }, [estado]);

  useEffect(() => {
    if (estado.fase !== 'ok') return undefined;
    const prueba = estado.cat.cards.find((c) => c.image);
    if (!prueba) { setCors('sin imágenes'); return undefined; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setCors('ok');
    img.onerror = () => setCors('fallo');
    img.src = prueba.image;
    return () => { img.onload = null; img.onerror = null; };
  }, [estado]);

  if (estado.fase === 'cargando') return <p>Cargando catálogo...</p>;
  if (estado.fase === 'error') {
    return (
      <div className={styles.caja}>
        <strong>Catálogo no disponible todavía</strong>
        <span>{estado.mensaje}. Ejecuta en GitHub: Actions → Importar catálogo → Run workflow.</span>
      </div>
    );
  }

  const { cat } = estado;
  const porRareza = contar(cat.cards, (c) => c.rarity);
  return (
    <div className={styles.caja}>
      <strong>Catálogo: {cat.cards.length} cartas en {cat.sets.length} sets</strong>
      <span>Actualizado: {new Date(cat.generatedAt).toLocaleString('es-ES')}</span>
      <span>
        Imágenes como textura 3D (CORS):{' '}
        {cors === 'ok' && 'correcto'}
        {cors === 'fallo' && 'FALLA (usaremos el plan B)'}
        {cors === 'probando' && 'probando...'}
        {cors === 'sin imágenes' && 'no hay imágenes'}
      </span>
      <div className={styles.muestra}>
        {muestra.map((c) => (
          <figure key={c.id}>
            <img src={c.image} alt={c.name} loading="lazy" />
            <figcaption>{c.name} ({c.rarity}{c.manga ? ', Manga' : c.alt ? ', Alt' : ''})</figcaption>
          </figure>
        ))}
      </div>
      <details>
        <summary>Rarezas</summary>
        <ul>{Object.entries(porRareza).map(([r, n]) => <li key={r}>{r}: {n}</li>)}</ul>
      </details>
      <details>
        <summary>Sets</summary>
        <ul>{cat.sets.map((s) => <li key={s.id}>{s.id} · {s.name} · {s.card_count}</li>)}</ul>
      </details>
      <small>Fuente: {cat.source?.name}. {cat.source?.notice}</small>
    </div>
  );
}
