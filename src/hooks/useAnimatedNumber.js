import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Hace que un número "suba" suavemente hasta su nuevo valor (contador de monedas).
export function useAnimatedNumber(objetivo, duracion = 0.8) {
  const [valor, setValor] = useState(objetivo);
  const objeto = useRef({ v: objetivo });

  useEffect(() => {
    const animacion = gsap.to(objeto.current, {
      v: objetivo,
      duration: duracion,
      ease: 'power2.out',
      onUpdate: () => setValor(objeto.current.v),
    });
    return () => animacion.kill();
  }, [objetivo, duracion]);

  return valor;
}
