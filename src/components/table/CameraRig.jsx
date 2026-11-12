import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

const posicion = new Vector3();
const mirada = new Vector3(0, 0, 0.4);
const objetivoMirada = new Vector3();

// Cámara en perspectiva. En la mesa mira desde arriba; al inspeccionar un sobre o revelar cartas
// se acerca al centro (el zoom va de 0 a 1). En pantallas estrechas se aleja.
export default function CameraRig({ modo, zoom }) {
  const { camera, size, pointer } = useThree();
  useFrame((_, delta) => {
    const aspecto = size.width / size.height;
    if (modo === 'mesa') {
      let base = [0, 5.6, 5.8];
      if (aspecto < 0.8) base = [0, 9.2, 7.2];
      else if (aspecto < 1.3) base = [0, 7, 6.2];
      posicion.set(base[0] + pointer.x * 0.6, base[1] + pointer.y * 0.25, base[2]);
      objetivoMirada.set(0, 0, 0.4);
    } else {
      const distancia = (6.2 - zoom * 3.0) * (aspecto < 0.8 ? 1.5 : 1);
      posicion.set(pointer.x * 0.15, 1.5 + pointer.y * 0.1, distancia);
      objetivoMirada.set(0, 1.5, 0);
    }
    camera.position.lerp(posicion, Math.min(1, delta * 4));
    mirada.lerp(objetivoMirada, Math.min(1, delta * 4));
    camera.lookAt(mirada);
  });
  return null;
}
