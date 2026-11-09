import { useEffect, useState } from 'react';
import { isConfigured } from './services/supabaseClient.js';
import { useAuth } from './hooks/useAuth.js';
import AuthScreen from './components/AuthScreen.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import styles from './App.module.css';

// Tecla que abre/cierra el menú de administrador (solo funciona con cuenta admin).
const TECLA_ADMIN = 'F2';

export default function App() {
  const { cargando, jugador, error, refrescar, cerrarSesion } = useAuth();
  const [adminAbierto, setAdminAbierto] = useState(false);
  const esAdmin = jugador?.profile?.role === 'admin';

  useEffect(() => {
    if (!esAdmin) return undefined;
    function alPulsar(e) {
      if (e.key === TECLA_ADMIN) {
        e.preventDefault();
        setAdminAbierto((abierto) => !abierto);
      }
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [esAdmin]);

  if (!isConfigured) {
    return (
      <main className={styles.pantalla}>
        <h1 className={styles.titulo}>One Piece TCG Idle</h1>
        <div className={styles.aviso}>Falta pegar tu URL y tu clave pública en src/config.js</div>
      </main>
    );
  }
  if (cargando) {
    return (
      <main className={styles.pantalla}>
        <h1 className={styles.titulo}>One Piece TCG Idle</h1>
        <p className={styles.subtitulo}>Cargando...</p>
      </main>
    );
  }
  if (!jugador) return <AuthScreen aviso={error} />;

  return (
    <main className={styles.pantalla}>
      <h1 className={styles.titulo}>One Piece TCG Idle</h1>
      <p className={styles.subtitulo}>Fase 3: cuenta y base de datos (la mesa 3D llega en la Fase 6)</p>
      <div className={styles.datos}>
        <strong>Jugador: {jugador.profile.username}</strong>
        <span>Monedas: {Number(jugador.economy.coins).toLocaleString('es-ES')}</span>
        {esAdmin && <span>Eres administrador. Pulsa {TECLA_ADMIN} para abrir el menú.</span>}
      </div>
      <button type="button" className={styles.boton} onClick={cerrarSesion}>Cerrar sesión</button>
      {esAdmin && adminAbierto && (
        <AdminPanel onClose={() => setAdminAbierto(false)} onChanged={refrescar} />
      )}
    </main>
  );
}
