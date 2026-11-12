import { useCallback, useEffect, useRef, useState } from 'react';
import { buyPack, fetchMyPacks, fetchProducts, openPack } from '../services/packService.js';

// Productos de la tienda + sobres sin abrir del jugador. Cada compra/apertura lleva un
// identificador único: si repites una operación que falló por la red, el servidor no la duplica.
export function usePacks(jugador) {
  const idJugador = jugador?.profile?.id ?? null;
  const [productos, setProductos] = useState([]);
  const [misSobres, setMisSobres] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const pendiente = useRef({ compra: null, apertura: null });

  const cargar = useCallback(async () => {
    if (!idJugador) return;
    const [lista, mios] = await Promise.all([fetchProducts(), fetchMyPacks(idJugador)]);
    setProductos(lista);
    setMisSobres(mios);
  }, [idJugador]);

  useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [cargar, jugador]);

  const comprar = useCallback(
    async (productId, cantidad) => {
      const clave = `${productId}:${cantidad}`;
      if (pendiente.current.compra?.clave !== clave) {
        pendiente.current.compra = { clave, id: crypto.randomUUID() };
      }
      setOcupado(true);
      setError('');
      try {
        const r = await buyPack(productId, cantidad, pendiente.current.compra.id);
        pendiente.current.compra = null;
        await cargar();
        return r;
      } catch (e) {
        setError(e.message);
        throw e;
      } finally {
        setOcupado(false);
      }
    },
    [cargar],
  );

  const abrir = useCallback(
    async (productId) => {
      if (pendiente.current.apertura?.clave !== productId) {
        pendiente.current.apertura = { clave: productId, id: crypto.randomUUID() };
      }
      const r = await openPack(productId, pendiente.current.apertura.id);
      pendiente.current.apertura = null;
      await cargar();
      return r;
    },
    [cargar],
  );

  return { productos, misSobres, ocupado, error, comprar, abrir, recargar: cargar };
}
