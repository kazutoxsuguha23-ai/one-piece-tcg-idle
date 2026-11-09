import { useEffect, useState } from 'react';
import { login, registerAccount, fetchPublicConfig } from '../services/authService.js';
import { validateUsername, validatePassword } from '../utils/authRules.js';
import styles from './AuthScreen.module.css';

export default function AuthScreen({ aviso }) {
  const [modo, setModo] = useState('login');
  const [registroAbierto, setRegistroAbierto] = useState(true);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(aviso || '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetchPublicConfig()
      .then((cfg) => {
        if (cfg.registration_open === false) setRegistroAbierto(false);
      })
      .catch(() => {});
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    const errUsuario = validateUsername(usuario);
    if (errUsuario) return setError(errUsuario);
    if (modo === 'registro') {
      const errClave = validatePassword(clave);
      if (errClave) return setError(errClave);
      if (clave !== clave2) return setError('Las contraseñas no coinciden');
    } else if (!clave) {
      return setError('Escribe tu contraseña');
    }
    setEnviando(true);
    try {
      if (modo === 'registro') {
        await registerAccount({ username: usuario.trim(), password: clave, inviteCode: codigo });
      }
      await login(usuario.trim(), clave);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
    return undefined;
  }

  return (
    <main className={styles.pantalla}>
      <h1 className={styles.titulo}>One Piece TCG Idle</h1>
      <form className={styles.tarjeta} onSubmit={enviar}>
        <div className={styles.pestanas}>
          <button
            type="button"
            className={modo === 'login' ? styles.activa : ''}
            onClick={() => { setModo('login'); setError(''); }}
          >
            Entrar
          </button>
          {registroAbierto && (
            <button
              type="button"
              className={modo === 'registro' ? styles.activa : ''}
              onClick={() => { setModo('registro'); setError(''); }}
            >
              Crear cuenta
            </button>
          )}
        </div>

        <label>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)}
                 autoComplete="username" maxLength={20} />
        </label>
        <label>
          Contraseña
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
                 autoComplete={modo === 'registro' ? 'new-password' : 'current-password'} />
        </label>
        {modo === 'registro' && (
          <>
            <label>
              Repite la contraseña
              <input type="password" value={clave2} onChange={(e) => setClave2(e.target.value)}
                     autoComplete="new-password" />
            </label>
            <label>
              Código de invitación (si lo tienes)
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.enviar} disabled={enviando}>
          {enviando ? 'Un momento...' : modo === 'registro' ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
