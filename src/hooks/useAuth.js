import { useCallback, useEffect, useState } from 'react';
import { isConfigured } from '../services/supabaseClient.js';
import { logout, onAuthChange } from '../services/authService.js';
import { bootstrapSession } from '../services/gameService.js';

// Gestiona la sesión: la recupera al recargar, carga los datos del jugador y permite cerrar sesión.
export function useAuth() {
  const [sesion, setSesion] = useState(undefined); // undefined = todavía comprobando
  const [jugador, setJugador] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigured) {
      setSesion(null);
      return undefined;
    }
    return onAuthChange((nueva) => setSesion(nueva));
  }, []);

  const idUsuario = sesion?.user?.id ?? null;

  useEffect(() => {
    if (!idUsuario) {
      setJugador(null);
      return undefined;
    }
    let activo = true;
    bootstrapSession()
      .then((datos) => {
        if (activo) setJugador(datos);
      })
      .catch(async (e) => {
        if (!activo) return;
        setError(e.message);
        await logout();
      });
    return () => {
      activo = false;
    };
  }, [idUsuario]);

  const refrescar = useCallback(async () => {
    setJugador(await bootstrapSession());
  }, []);

  const cargando = sesion === undefined || (sesion !== null && jugador === null);
  return { cargando, jugador, error, refrescar, cerrarSesion: logout };
}
