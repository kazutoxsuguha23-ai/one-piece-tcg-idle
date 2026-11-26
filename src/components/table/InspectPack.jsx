import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import PackModel, { PACK_H, PACK_TAPA, PACK_W } from './PackModel.jsx';
import { getPackArtTexture, getPackBackTexture, loadRealPackTexture } from '../../utils/packTexture.js';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const ALTURA = 1.5;
const ESCALA = 1.25;

// Sobre en el centro, como un objeto que inspeccionas: arrastra para girarlo; si empiezas
// arrastrando por la parte de arriba hacia un lado, se rasga (poco a poco, siguiendo tu dedo) y se abre.
export default function InspectPack({ producto, modo, ordenAbrir, retraso = 0, onTear }) {
  const { camera, size } = useThree();
  const grupo = useRef();
  const estado = useRef({ p: 0, objetivoP: 0, dir: 1, abierto: false, vuelo: 0, rapidez: 14 });
  const giro = useRef({ x: 0.08, y: -0.4, visX: 0.08, visY: -0.4 });
  const avisado = useRef(false);
  const hundir = useRef(0);
  const [textura, setTextura] = useState(() => getPackArtTexture(producto));
  const [dorso] = useState(() => getPackBackTexture(producto));

  useEffect(() => {
    let vivo = true;
    loadRealPackTexture(producto).then((t) => {
      if (vivo && t) setTextura(t);
    });
    return () => { vivo = false; };
  }, [producto]);

  // Botón "Abrir sobre" / apertura en masa (alternativa al gesto). `retraso` deja ver el sobre un instante
  // antes de que se rasgue solo. Se rasga un poco más despacio que con el gesto para que se vea el efecto.
  useEffect(() => {
    if (!(ordenAbrir > 0 && modo === 'inspeccion')) return undefined;
    const id = setTimeout(() => {
      if (estado.current.abierto) return;
      estado.current.dir = 1;
      estado.current.rapidez = 9;
      estado.current.objetivoP = 1;
      estado.current.abierto = true;
      if (!avisado.current) {
        avisado.current = true;
        onTear();
      }
    }, retraso);
    return () => clearTimeout(id);
  }, [ordenAbrir]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((reloj, delta) => {
    const g = grupo.current;
    if (!g) return;
    const e = estado.current;
    const r = giro.current;
    const k = Math.min(1, delta * 12);
    r.visX += (r.x - r.visX) * k;
    r.visY += (r.y - r.visY) * k;
    g.rotation.set(r.visX, r.visY, 0);

    e.p += (e.objetivoP - e.p) * Math.min(1, delta * e.rapidez);
    // La tira sale volando solo cuando el rasgado está casi completo.
    if (e.abierto && e.p > 0.93) e.vuelo = Math.min(1, e.vuelo + delta / 0.7);

    let altura = ALTURA + Math.sin(reloj.clock.elapsedTime * 1.2) * 0.03;
    if (modo === 'abriendo') altura += Math.sin(reloj.clock.elapsedTime * 28) * 0.012;
    let escala = ESCALA;
    if (modo === 'revelado') {
      hundir.current += delta;
      escala = Math.max(0.0001, ESCALA * (1 - hundir.current / 0.5));
      altura -= hundir.current * 1.2;
    }
    g.position.set(0, altura, 0);
    g.scale.setScalar(escala);
  });

  // Ancho en píxeles que ocupa ahora el sobre en pantalla: así el corte avanza al ritmo del dedo.
  function anchoDelSobreEnPantalla() {
    const izquierda = grupo.current.localToWorld(new Vector3(-PACK_W / 2, PACK_H / 2 - PACK_TAPA, 0)).project(camera);
    const derecha = grupo.current.localToWorld(new Vector3(PACK_W / 2, PACK_H / 2 - PACK_TAPA, 0)).project(camera);
    return Math.abs(derecha.x - izquierda.x) * 0.5 * size.width;
  }

  function alPresionar(ev) {
    if (modo !== 'inspeccion' || estado.current.abierto) return;
    ev.stopPropagation();
    const local = grupo.current.worldToLocal(ev.point.clone());
    const zonaSuperior = local.y > PACK_H / 2 - PACK_TAPA * 1.8;
    const deFrente = Math.abs(Math.cos(giro.current.y)) > 0.45;
    const inicio = { x: ev.nativeEvent.clientX, y: ev.nativeEvent.clientY };
    const umbral = Math.max(90, anchoDelSobreEnPantalla());
    let ultimo = inicio;
    let tipo = null;
    let sentido = 1;

    const mover = (m) => {
      const dx = m.clientX - inicio.x;
      const dy = m.clientY - inicio.y;
      if (!tipo && Math.hypot(dx, dy) > 8) {
        tipo = zonaSuperior && deFrente && Math.abs(dx) > Math.abs(dy) * 1.2 ? 'rasgar' : 'rotar';
        if (tipo === 'rasgar') {
          sentido = Math.sign(dx) || 1; // el sentido del rasgado se fija al empezar
          estado.current.dir = sentido;
          estado.current.rapidez = 14;
        }
      }
      if (tipo === 'rotar') {
        giro.current.y += (m.clientX - ultimo.x) * 0.012;
        giro.current.x = limitar(giro.current.x + (m.clientY - ultimo.y) * 0.008, -0.9, 0.9);
      } else if (tipo === 'rasgar') {
        estado.current.objetivoP = limitar((dx * sentido) / umbral, 0, 1);
      }
      ultimo = { x: m.clientX, y: m.clientY };
    };

    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      if (tipo !== 'rasgar') return;
      if (estado.current.objetivoP >= 0.85) {
        estado.current.objetivoP = 1;
        estado.current.abierto = true;
        if (!avisado.current) {
          avisado.current = true;
          onTear();
        }
      } else {
        estado.current.objetivoP = 0;
      }
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }

  return (
    <group
      ref={grupo}
      onPointerDown={alPresionar}
      onPointerOver={() => { if (modo === 'inspeccion') document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <PackModel textura={textura} dorso={dorso} estado={estado} />
    </group>
  );
}
