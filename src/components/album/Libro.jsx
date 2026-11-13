import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { indicesDeSpread, totalSpreads } from './albumUtils.js';
import styles from './Libro.module.css';

const DURACION = 700;

// Libro 3D hecho con transformaciones CSS (perspectiva + rotateY): la portada se abre y las hojas giran.
// - 2 páginas a la vez en pantallas anchas; 1 sola (con deslizamiento) en móvil.
// - Se maneja con botones/zonas laterales, teclado (flechas, Re Pág, Av Pág, Inicio, Fin) y deslizando.
const Libro = forwardRef(function Libro(
  { paginas, renderPagina, portada, uni, abierto, activo, clave, onCambio, onAbrirPortada },
  ref,
) {
  const [spread, setSpread] = useState(0);
  const [giro, setGiro] = useState(null); // { dir: 1 | -1, fase: 'inicio' | 'fin' }
  const [direccion, setDireccion] = useState(1);
  const raf = useRef([]);
  const esperas = useRef([]);
  const toque = useRef(null);
  const total = totalSpreads(paginas.length, uni);

  const limpiar = useCallback(() => {
    raf.current.forEach((id) => cancelAnimationFrame(id));
    esperas.current.forEach((id) => clearTimeout(id));
    raf.current = [];
    esperas.current = [];
  }, []);

  useEffect(() => () => limpiar(), [limpiar]);

  // Al cambiar de set o de filtros se vuelve al principio.
  useEffect(() => {
    limpiar();
    setGiro(null);
    setSpread(0);
  }, [clave, uni, limpiar]);

  useEffect(() => {
    setSpread((s) => Math.min(s, total - 1));
  }, [total]);

  useEffect(() => {
    if (onCambio) onCambio({ spread, total });
  }, [spread, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const pasar = useCallback(
    (dir) => {
      if (giro || !abierto) return;
      const destino = spread + dir;
      if (destino < 0 || destino >= total) return;
      if (uni) {
        setDireccion(dir);
        setSpread(destino);
        return;
      }
      setGiro({ dir, fase: 'inicio' });
      const a = requestAnimationFrame(() => {
        const b = requestAnimationFrame(() => setGiro((g) => (g ? { ...g, fase: 'fin' } : g)));
        raf.current.push(b);
      });
      raf.current.push(a);
      esperas.current.push(
        setTimeout(() => {
          setSpread(destino);
          setGiro(null);
        }, DURACION + 50),
      );
    },
    [giro, abierto, spread, total, uni],
  );

  const irA = useCallback(
    (destino) => {
      if (!abierto) return;
      limpiar();
      setGiro(null);
      setDireccion(destino > spread ? 1 : -1);
      setSpread(Math.max(0, Math.min(total - 1, destino)));
    },
    [abierto, spread, total, limpiar],
  );

  useImperativeHandle(ref, () => ({ pasar, irA }), [pasar, irA]);

  useEffect(() => {
    if (!activo) return undefined;
    function alPulsar(e) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); pasar(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); pasar(-1); }
      else if (e.key === 'Home') { e.preventDefault(); irA(0); }
      else if (e.key === 'End') { e.preventDefault(); irA(total - 1); }
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [activo, pasar, irA, total]);

  function alPresionar(e) {
    toque.current = { x: e.clientX, y: e.clientY };
  }
  function alSoltar(e) {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) pasar(dx < 0 ? 1 : -1);
  }

  const { izq, der } = indicesDeSpread(spread, uni);
  let izqEstatica = izq;
  let derEstatica = der;
  let hoja = null;
  if (!uni && giro) {
    if (giro.dir === 1) {
      derEstatica = der + 2;
      hoja = { frente: der, dorso: der + 1, desde: 0, hasta: -180 };
    } else {
      izqEstatica = izq - 2;
      hoja = { frente: der - 2, dorso: der - 1, desde: -180, hasta: 0 };
    }
  }
  const portadaVisible = !abierto || (spread === 0 && !giro);

  return (
    <div
      className={`${styles.libro} ${uni ? styles.uni : ''}`}
      onPointerDown={alPresionar}
      onPointerUp={alSoltar}
    >
      {uni ? (
        <div
          key={spread}
          className={`${styles.unica} ${direccion > 0 ? styles.desdeDerecha : styles.desdeIzquierda}`}
        >
          {renderPagina(spread)}
        </div>
      ) : (
        <div className={`${styles.cuerpo} ${abierto ? '' : styles.cerrado}`}>
          <div className={`${styles.mitad} ${styles.izquierda} ${abierto ? '' : styles.oculta}`}>
            {renderPagina(izqEstatica)}
          </div>
          <div className={`${styles.mitad} ${styles.derecha}`}>{renderPagina(derEstatica)}</div>

          {hoja && (
            <div
              className={`${styles.hoja} ${styles.hojaGiro}`}
              style={{
                transform: `rotateY(${giro.fase === 'inicio' ? hoja.desde : hoja.hasta}deg)`,
                transition: giro.fase === 'fin' ? `transform ${DURACION}ms ease-in-out` : 'none',
              }}
            >
              <div className={styles.cara}>{renderPagina(hoja.frente)}</div>
              <div className={`${styles.cara} ${styles.reverso}`}>{renderPagina(hoja.dorso)}</div>
            </div>
          )}

          <div
            className={`${styles.hoja} ${styles.hojaPortada} ${portadaVisible ? '' : styles.oculta}`}
            style={{ transform: `rotateY(${abierto ? -180 : 0}deg)` }}
          >
            <div
              className={`${styles.cara} ${styles.portada}`}
              role="button"
              tabIndex={0}
              onClick={() => { if (!abierto && onAbrirPortada) onAbrirPortada(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !abierto && onAbrirPortada) onAbrirPortada(); }}
            >
              <span className={styles.etiqueta}>ÁLBUM</span>
              <strong>{portada.titulo}</strong>
              <span>{portada.subtitulo}</span>
              <em>{portada.progreso}</em>
            </div>
            <div className={`${styles.cara} ${styles.reverso} ${styles.guardaPortada}`} />
          </div>
        </div>
      )}

      <button
        type="button"
        className={`${styles.zona} ${styles.zonaIzq}`}
        aria-label="Página anterior"
        disabled={!abierto || spread === 0}
        onClick={() => pasar(-1)}
      />
      <button
        type="button"
        className={`${styles.zona} ${styles.zonaDer}`}
        aria-label="Página siguiente"
        disabled={!abierto || spread >= total - 1}
        onClick={() => pasar(1)}
      />
    </div>
  );
});

export default Libro;
