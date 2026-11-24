import { useEffect, useRef, useState } from 'react';

// Hace que un número "suba" suavemente hasta su nuevo valor (contador de monedas).
// Sin librerías: requestAnimationFrame con frenado suave al final (como "power2.out").
export function useAnimatedNumber(objetivo, duracion = 0.8) {
  const [valor, setValor] = useState(objetivo);
  const actual = useRef(objetivo);

  useEffect(() => {
    const desde = actual.current;
    if (desde === objetivo) return undefined;
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - inicio) / (duracion * 1000));
      const suave = 1 - (1 - k) ** 2;
      actual.current = desde + (objetivo - desde) * suave;
      setValor(actual.current);
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [objetivo, duracion]);

  return valor;
}
