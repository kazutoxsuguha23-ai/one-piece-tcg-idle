import { useEffect, useState } from 'react';
import { isConfigured } from './services/supabaseClient.js';
import { useAuth } from './hooks/useAuth.js';
import { useEconomy } from './hooks/useEconomy.js';
import AuthScreen from './components/AuthScreen.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import TableView from './components/TableView.jsx';
import styles from './App.module.css';

// Tecla que abre/cierra el menú de administrador (solo funciona con cuenta admin).
const TECLA_ADMIN = 'F2';

export default function App() {
  const { cargando, jugador, error, refrescar, cerrarSesion } = useAuth();
  const economia = useEconomy(jugador);
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
    <>
      <TableView
        jugador={jugador}
        economia={economia}
        esAdmin={esAdmin}
        onAdmin={() => setAdminAbierto((abierto) => !abierto)}
        onSalir={cerrarSesion}
      />
      {esAdmin && adminAbierto && (
        <AdminPanel onClose={() => setAdminAbierto(false)} onChanged={refrescar} />
      )}
    </>
  );
}
