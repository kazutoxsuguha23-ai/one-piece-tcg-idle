import { useEffect, useState } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { isConfigured } from './services/supabaseClient.js';
import styles from './App.module.css';

export default function App() {
  const [estado, setEstado] = useState({
    tipo: 'cargando',
    texto: 'Comprobando conexión con Supabase...',
  });

  useEffect(() => {
    if (!isConfigured) {
      setEstado({
        tipo: 'aviso',
        texto: 'Falta pegar tu URL y tu clave pública en src/config.js',
      });
      return undefined;
    }
    const controlador = new AbortController();
    fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controlador.signal,
    })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`Respuesta ${respuesta.status}`);
        setEstado({ tipo: 'ok', texto: 'Conexión con Supabase correcta' });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setEstado({ tipo: 'error', texto: `No se pudo conectar: ${error.message}` });
      });
    return () => controlador.abort();
  }, []);

  return (
    <main className={styles.pantalla}>
      <h1 className={styles.titulo}>One Piece TCG Idle</h1>
      <p className={styles.subtitulo}>Fase 2: estructura y configuración</p>
      <div className={`${styles.estado} ${styles[estado.tipo]}`}>{estado.texto}</div>
    </main>
  );
}
