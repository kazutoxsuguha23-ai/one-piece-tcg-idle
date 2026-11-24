import { useCallback, useEffect, useMemo, useState } from 'react';
import { collectAll, collectCard, fetchMyCards } from '../services/economyService.js';
import { fetchPublicConfig } from '../services/authService.js';

// Economía en pantalla. El SERVIDOR decide el saldo: aquí solo se muestra una estimación
// que avanza cada segundo y se corrige con la respuesta del servidor al recoger.
// El reloj se detiene mientras la pestaña está oculta (no gasta batería ni CPU en segundo plano).
export function useEconomy(jugador) {
  const [coins, setCoins] = useState(0);
  const [cartas, setCartas] = useState([]);
  const [config, setConfig] = useState({});
  const [desfase, setDesfase] = useState(0); // reloj del servidor - reloj del navegador (ms)
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [ultimaRecogida, setUltimaRecogida] = useState(null);

  const idJugador = jugador?.profile?.id ?? null;

  const cargarCartas = useCallback(async () => {
    if (!idJugador) return;
    setCartas(await fetchMyCards(idJugador));
  }, [idJugador]);

  useEffect(() => {
    if (!jugador) {
      setCartas([]);
      return;
    }
    setCoins(Number(jugador.economy.coins));
    setDesfase(Date.parse(jugador.server_time) - Date.now());
    cargarCartas().catch((e) => setAviso({ tipo: 'error', texto: e.message }));
    fetchPublicConfig().then(setConfig).catch(() => {});
  }, [jugador, cargarCartas]);

  useEffect(() => {
    let id = null;
    const parar = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const iniciar = () => {
      if (id !== null) return;
      setAhora(Date.now());
      id = setInterval(() => setAhora(Date.now()), 1000);
    };
    const alCambiarVisibilidad = () => (document.hidden ? parar() : iniciar());
    alCambiarVisibilidad();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, []);

  const capSeg =
    Number(config.offline_cap_seconds ?? 28800) +
    Number(jugador?.progress?.upgrades?.storage_bonus_seconds ?? 0);

  const filas = useMemo(() => {
    const reloj = ahora + desfase;
    return cartas
      .map((c) => {
        const segundos = Math.min(Math.max((reloj - Date.parse(c.last_collected_at)) / 1000, 0), capSeg);
        return { ...c, pendiente: Math.floor(Number(c.production_per_sec) * segundos) };
      })
      .sort((a, b) => Number(b.production_per_sec) - Number(a.production_per_sec));
  }, [cartas, ahora, desfase, capSeg]);

  const produccion = useMemo(
    () => cartas.reduce((suma, c) => suma + Number(c.production_per_sec), 0),
    [cartas],
  );
  const totalPendiente = useMemo(() => filas.reduce((suma, c) => suma + c.pendiente, 0), [filas]);

  const ejecutar = useCallback(
    async (accion) => {
      setOcupado(true);
      setAviso(null);
      try {
        const r = await accion();
        setCoins(Number(r.coins));
        setDesfase(Date.parse(r.server_time) - Date.now());
        await cargarCartas();
        setUltimaRecogida({ cantidad: Number(r.collected), id: Date.now() });
      } catch (e) {
        setAviso({ tipo: 'error', texto: e.message });
      }
      setOcupado(false);
    },
    [cargarCartas],
  );

  const recogerTodo = useCallback(() => ejecutar(() => collectAll()), [ejecutar]);
  const recogerCarta = useCallback((id) => ejecutar(() => collectCard(id)), [ejecutar]);

  // Para que la tienda y la apertura de sobres actualicen la pantalla con lo que dice el servidor.
  const aplicarSaldo = useCallback((valor) => setCoins(Number(valor)), []);

  return {
    coins, produccion, totalPendiente, filas, capSeg, ocupado, aviso, ultimaRecogida,
    recogerTodo, recogerCarta, aplicarSaldo, recargarCartas: cargarCartas,
  };
}
