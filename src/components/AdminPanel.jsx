import { useCallback, useEffect, useState } from 'react';
import {
  adminListUsers, adminGiveCoins, adminSetCoins, adminGivePack, adminResetUser, listProducts,
} from '../services/gameService.js';
import styles from './AdminPanel.module.css';

const ENTERO = /^-?\d+$/;

export default function AdminPanel({ onClose, onChanged }) {
  const [busqueda, setBusqueda] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [objetivo, setObjetivo] = useState('');
  const [cantidad, setCantidad] = useState('1000');
  const [producto, setProducto] = useState('');
  const [numSobres, setNumSobres] = useState('1');
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarUsuarios = useCallback(async (texto) => {
    try {
      setUsuarios(await adminListUsers(texto));
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  }, []);

  useEffect(() => {
    cargarUsuarios('');
    listProducts()
      .then((lista) => {
        setProductos(lista);
        if (lista[0]) setProducto(lista[0].product_id);
      })
      .catch(() => {});
  }, [cargarUsuarios]);

  useEffect(() => {
    function alPulsar(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  async function ejecutar(accion, textoOk) {
    if (!objetivo.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe o elige el nombre del jugador' });
      return;
    }
    setOcupado(true);
    try {
      const resultado = await accion();
      setMensaje({ tipo: 'ok', texto: textoOk(resultado) });
      await cargarUsuarios(busqueda);
      await onChanged();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
    setOcupado(false);
  }

  function comprobarCantidad(valor, permitirNegativo) {
    if (!ENTERO.test(valor) || (!permitirNegativo && valor.startsWith('-'))) {
      setMensaje({ tipo: 'error', texto: 'Escribe un número entero válido' });
      return false;
    }
    return true;
  }

  const darMonedas = () => {
    if (!comprobarCantidad(cantidad, true)) return;
    ejecutar(() => adminGiveCoins(objetivo.trim(), cantidad), (n) => `Saldo de ${objetivo}: ${n}`);
  };
  const fijarSaldo = () => {
    if (!comprobarCantidad(cantidad, false)) return;
    ejecutar(() => adminSetCoins(objetivo.trim(), cantidad), (n) => `Saldo de ${objetivo}: ${n}`);
  };
  const darSobres = () => {
    if (!comprobarCantidad(numSobres, false)) return;
    ejecutar(
      () => adminGivePack(objetivo.trim(), producto, Number(numSobres)),
      (n) => `${objetivo} tiene ahora ${n} de ese producto`,
    );
  };
  const resetear = () => {
    if (!window.confirm(`¿Seguro que quieres RESETEAR a ${objetivo}? Se borran sus cartas y sobres.`)) return;
    ejecutar(() => adminResetUser(objetivo.trim()), () => `${objetivo} reseteado`);
  };

  return (
    <div className={styles.fondo} role="dialog" aria-label="Menú de administrador">
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h2>Menú de administrador</h2>
          <button type="button" onClick={onClose}>Cerrar (Esc)</button>
        </header>

        {mensaje && <p className={mensaje.tipo === 'ok' ? styles.ok : styles.error}>{mensaje.texto}</p>}

        <section>
          <h3>Jugadores</h3>
          <input
            placeholder="Buscar jugador..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); cargarUsuarios(e.target.value); }}
          />
          <ul className={styles.lista}>
            {usuarios.map((u) => (
              <li key={u.uid}>
                <button type="button" onClick={() => setObjetivo(u.uname)}>
                  {u.uname} {u.urole === 'admin' ? '(admin)' : ''} — {Number(u.ucoins).toLocaleString('es-ES')} monedas
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Jugador objetivo</h3>
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Nombre de usuario" />
        </section>

        <section>
          <h3>Monedas</h3>
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="numeric" />
          <div className={styles.fila}>
            <button type="button" disabled={ocupado} onClick={darMonedas}>Dar (o quitar si es negativa)</button>
            <button type="button" disabled={ocupado} onClick={fijarSaldo}>Fijar saldo</button>
          </div>
        </section>

        <section>
          <h3>Sobres / boosters / starter decks</h3>
          {productos.length === 0 ? (
            <p className={styles.nota}>Todavía no hay productos. Se crean en la Fase 7.</p>
          ) : (
            <>
              <select value={producto} onChange={(e) => setProducto(e.target.value)}>
                {productos.map((p) => (
                  <option key={p.product_id} value={p.product_id}>{p.name}</option>
                ))}
              </select>
              <input value={numSobres} onChange={(e) => setNumSobres(e.target.value)} inputMode="numeric" />
              <button type="button" disabled={ocupado} onClick={darSobres}>Dar sobres</button>
            </>
          )}
        </section>

        <section>
          <h3>Zona peligrosa</h3>
          <button type="button" className={styles.peligro} disabled={ocupado} onClick={resetear}>
            Resetear jugador
          </button>
        </section>

        <p className={styles.nota}>Dar cartas y cambiar niveles se añade en la Fase 5, junto con la economía.</p>
      </div>
    </div>
  );
}
