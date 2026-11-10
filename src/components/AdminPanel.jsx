import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminListUsers, adminGiveCoins, adminSetCoins, adminGivePack, adminResetUser,
  adminGiveCard, adminSetCardLevel, adminRecalcAll, listProducts,
} from '../services/gameService.js';
import CardPicker from './CardPicker.jsx';
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
  const [carta, setCarta] = useState(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const pickerRef = useRef(false);
  pickerRef.current = pickerAbierto;
  const [numCartas, setNumCartas] = useState('1');
  const [nivel, setNivel] = useState('10');
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
      // Si el selector de cartas está abierto, Esc lo cierra a él (y no al menú).
      if (e.key === 'Escape' && !pickerRef.current) onClose();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  async function ejecutar(accion, textoOk, requiereObjetivo = true) {
    if (requiereObjetivo && !objetivo.trim()) {
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

  function entero(valor, permitirNegativo = false) {
    if (!ENTERO.test(valor) || (!permitirNegativo && valor.startsWith('-'))) {
      setMensaje({ tipo: 'error', texto: 'Escribe un número entero válido' });
      return false;
    }
    return true;
  }

  const darMonedas = () => {
    if (!entero(cantidad, true)) return;
    ejecutar(() => adminGiveCoins(objetivo.trim(), cantidad), (n) => `Saldo de ${objetivo}: ${n}`);
  };
  const fijarSaldo = () => {
    if (!entero(cantidad)) return;
    ejecutar(() => adminSetCoins(objetivo.trim(), cantidad), (n) => `Saldo de ${objetivo}: ${n}`);
  };
  const darSobres = () => {
    if (!entero(numSobres)) return;
    ejecutar(
      () => adminGivePack(objetivo.trim(), producto, Number(numSobres)),
      (n) => `${objetivo} tiene ahora ${n} de ese producto`,
    );
  };
  const darCarta = () => {
    if (!carta) { setMensaje({ tipo: 'error', texto: 'Busca y elige una carta' }); return; }
    if (!entero(numCartas)) return;
    ejecutar(
      () => adminGiveCard(objetivo.trim(), carta.id, Number(numCartas)),
      (n) => `${objetivo} tiene ahora ${n} copias de ${carta.name}`,
    );
  };
  const fijarNivel = () => {
    if (!carta) { setMensaje({ tipo: 'error', texto: 'Busca y elige una carta' }); return; }
    if (!entero(nivel)) return;
    ejecutar(
      () => adminSetCardLevel(objetivo.trim(), carta.id, Number(nivel)),
      () => `${carta.name} de ${objetivo} ahora es nivel ${nivel}`,
    );
  };
  const recalcular = () => {
    if (!window.confirm('¿Recalcular la producción de TODOS los jugadores? Se les paga lo pendiente antes.')) return;
    ejecutar(() => adminRecalcAll(), (n) => `Producción recalculada para ${n} jugadores`, false);
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
          <h3>Cartas</h3>
          <div className={styles.fila}>
            <button type="button" onClick={() => setPickerAbierto(true)}>Elegir carta del catálogo...</button>
          </div>
          {carta ? (
            <div className={styles.elegida}>
              {carta.image && <img src={carta.image} alt="" />}
              <span>
                <strong>{carta.name}</strong><br />
                {carta.id} · {carta.rarity}{carta.manga ? ' · Manga' : carta.sp ? ' · SP' : carta.alt ? ' · Alt' : ''}
              </span>
            </div>
          ) : (
            <p className={styles.nota}>Carta elegida: ninguna</p>
          )}
          <div className={styles.fila}>
            <input value={numCartas} onChange={(e) => setNumCartas(e.target.value)} inputMode="numeric" aria-label="Copias" />
            <button type="button" disabled={ocupado} onClick={darCarta}>Dar copias</button>
          </div>
          <div className={styles.fila}>
            <input value={nivel} onChange={(e) => setNivel(e.target.value)} inputMode="numeric" aria-label="Nivel" />
            <button type="button" disabled={ocupado} onClick={fijarNivel}>Fijar nivel (1-100)</button>
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
          <h3>Economía</h3>
          <button type="button" disabled={ocupado} onClick={recalcular}>Recalcular producción de todos</button>
          <p className={styles.nota}>Úsalo después de cambiar la clave "economy" en game_config o de editar niveles a mano.</p>
        </section>

        <section>
          <h3>Zona peligrosa</h3>
          <button type="button" className={styles.peligro} disabled={ocupado} onClick={resetear}>
            Resetear jugador
          </button>
        </section>
      </div>
      {pickerAbierto && (
        <CardPicker seleccionada={carta} onSelect={setCarta} onClose={() => setPickerAbierto(false)} />
      )}
    </div>
  );
}
