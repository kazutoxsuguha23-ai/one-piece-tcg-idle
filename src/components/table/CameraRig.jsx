import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

const objetivo = new Vector3();

// Cámara en perspectiva: se aleja en pantallas estrechas (móvil) y sigue levemente al ratón.
export default function CameraRig() {
  const { camera, size, pointer } = useThree();
  useFrame((_, delta) => {
    const aspecto = size.width / size.height;
    let base = [0, 5.6, 5.8];
    if (aspecto < 0.8) base = [0, 9.2, 7.2];
    else if (aspecto < 1.3) base = [0, 7, 6.2];
    objetivo.set(base[0] + pointer.x * 0.6, base[1] + pointer.y * 0.25, base[2]);
    camera.position.lerp(objetivo, Math.min(1, delta * 3));
    camera.lookAt(0, 0, 0.4);
  });
  return null;
}
