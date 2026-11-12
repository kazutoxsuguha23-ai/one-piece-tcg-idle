import { formatNumber, formatDuration } from '../utils/format.js';
import styles from './TableHud.module.css';

// Interfaz (HTML) por encima de la escena 3D. Cambia según el modo: mesa, inspección, apertura o revelado.
export default function TableHud({
  modo, nombre, monedas, produccion, pendiente, capSeg, aviso, esAdmin, calidad, sinSobres,
  pagina, totalPaginas, productoNombre, restantes, cartaActual, indice, total,
  onTienda, onColeccion, onCatalogo, onCalidad, onAdmin, onSalir,
  onPagina, onVolver, onZoom, onAbrir, onSaltar,
}) {
  return (
    <div className={styles.hud}>
      <div className={styles.arriba}>
        <div className={styles.jugador}>{nombre}</div>
        <div className={styles.monedero}>
          <span>Monedas</span>
          <strong>{formatNumber(monedas)}</strong>
        </div>
        <div className={styles.estadisticas}>
          <div><span>Producción</span><strong>{formatNumber(produccion)}/s</strong></div>
          <div><span>Pendiente</span><strong>{formatNumber(pendiente)}</strong></div>
          <div><span>Capacidad</span><strong>{formatDuration(capSeg)}</strong></div>
        </div>
      </div>

      {aviso && <div className={styles.aviso}>{aviso}</div>}
      {modo === 'mesa' && sinSobres && (
        <div className={styles.vacio}>No tienes sobres. Abre la Tienda para comprar los primeros.</div>
      )}
      {modo === 'inspeccion' && (
        <div className={styles.titulo3d}>
          <strong>{productoNombre}</strong>
          <span>Te quedan {restantes}</span>
        </div>
      )}
      {modo === 'abriendo' && <div className={styles.titulo3d}><strong>Abriendo el sobre...</strong></div>}
      {modo === 'revelado' && cartaActual && (
        <div className={styles.titulo3d}>
          <strong>{cartaActual.info.name}</strong>
          <span>{cartaActual.info.id} · {cartaActual.info.rarity} · {indice + 1}/{total}</span>
          <em className={cartaActual.esNueva ? styles.nueva : styles.repetida}>
            {cartaActual.esNueva ? '¡NUEVA!' : 'REPETIDA +1 copia'}
          </em>
        </div>
      )}

      <div className={styles.abajo}>
        {modo === 'mesa' && (
          <>
            {totalPaginas > 1 && (
              <div className={styles.botones}>
                <button type="button" disabled={pagina === 0} onClick={() => onPagina(-1)}>◀</button>
                <span className={styles.pagina}>Pág. {pagina + 1}/{totalPaginas}</span>
                <button type="button" disabled={pagina >= totalPaginas - 1} onClick={() => onPagina(1)}>▶</button>
              </div>
            )}
            <div className={styles.botones}>
              <button type="button" onClick={onTienda}>Tienda</button>
              <button type="button" disabled title="Disponible en la Fase 8">Álbum · F8</button>
              <button type="button" onClick={onColeccion}>Colección</button>
              <button type="button" disabled title="Disponible en la Fase 9">Mejoras · F9</button>
              <button type="button" onClick={onCatalogo}>Catálogo</button>
              <button type="button" onClick={onCalidad}>Calidad: {calidad}</button>
              {esAdmin && <button type="button" onClick={onAdmin}>Admin (F2)</button>}
              <button type="button" onClick={onSalir}>Salir</button>
            </div>
          </>
        )}
        {modo === 'inspeccion' && (
          <>
            <p className={styles.pista}>Arrastra para girarlo · Desliza por la parte de arriba hacia un lado para abrirlo · Rueda del ratón = zoom</p>
            <div className={styles.botones}>
              <button type="button" onClick={onVolver}>← Volver</button>
              <button type="button" onClick={() => onZoom(-0.15)}>Zoom −</button>
              <button type="button" onClick={() => onZoom(0.15)}>Zoom +</button>
              <button type="button" className={styles.principal} onClick={onAbrir}>Abrir sobre</button>
            </div>
          </>
        )}
        {modo === 'revelado' && (
          <>
            <p className={styles.pista}>Toca la carta para pasar a la siguiente · Arrastra para girarla</p>
            <div className={styles.botones}>
              <button type="button" onClick={onSaltar}>Saltar a los resultados</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
