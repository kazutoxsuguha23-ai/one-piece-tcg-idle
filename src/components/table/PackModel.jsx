import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, MeshStandardMaterial } from 'three';
import { getCardBackTexture, getGlowTexture } from '../../utils/cardTexture.js';

export const PACK_W = 1.1;
export const PACK_H = 1.9;
export const PACK_T = 0.1;
export const PACK_TAPA = 0.3;

const ASPECTO_SOBRE = PACK_W / PACK_H;
const SEGMENTOS = 10; // trozos en que se divide la tira de arriba para rasgarla poco a poco
const ANCHO_SEG = PACK_W / SEGMENTOS;
const BORDE = { color: '#aab1bd', metalness: 0.15, roughness: 0.4 };

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (t) => t * t * (3 - 2 * t);
const xBase = (i) => -PACK_W / 2 + (i + 0.5) * ANCHO_SEG;

// Zona de la imagen que se usa para rellenar el sobre SIN deformarla ("cover": se recorta lo que sobra
// por los lados o por arriba y abajo, centrado). Devuelve fracciones de la imagen: x, y, ancho, alto.
export function recorteCover(textura, aspecto = ASPECTO_SOBRE) {
  const img = textura.image;
  const ancho = img?.naturalWidth || img?.width || 0;
  const alto = img?.naturalHeight || img?.height || 0;
  if (!ancho || !alto) return { x: 0, y: 0, w: 1, h: 1 };
  const proporcion = ancho / alto;
  if (proporcion > aspecto) {
    const w = aspecto / proporcion; // imagen más ancha que el sobre: se recortan los lados
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = proporcion / aspecto; // imagen más alta que el sobre: se recorta arriba y abajo
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

// Una copia de la textura que solo enseña la franja desde..hasta del sobre (0 = abajo, 1 = arriba),
// con la imagen ya ajustada a la proporción del sobre.
export function cortar(textura, desde, hasta) {
  const r = recorteCover(textura);
  const t = textura.clone();
  t.repeat.set(r.w, (hasta - desde) * r.h);
  t.offset.set(r.x, r.y + desde * r.h);
  t.needsUpdate = true;
  return t;
}

// Un trozo de la tira de arriba. Las coordenadas de textura se ajustan para que cada trozo enseñe SU parte
// de la tira (caras 4 = delantera y 5 = trasera; la trasera va "al revés" en horizontal).
function crearSegmento(i) {
  const g = new BoxGeometry(ANCHO_SEG, PACK_TAPA, PACK_T);
  const uv = g.attributes.uv;
  for (let v = 16; v < 20; v += 1) uv.setX(v, (i + uv.getX(v)) / SEGMENTOS);
  for (let v = 20; v < 24; v += 1) uv.setX(v, 1 - (i + 1) / SEGMENTOS + uv.getX(v) / SEGMENTOS);
  uv.needsUpdate = true;
  return g;
}

// Sobre: el cuerpo y la tira de arriba (10 trozos que se rasgan uno tras otro). `estado` es una referencia con
// { p: progreso del rasgado 0..1, dir: -1 | 1 (hacia dónde se rasga), vuelo: 0..1 una vez roto }.
// Al rasgar: brilla el punto de corte, asoma un montón de cartas con luz y la tira sale volando.
export default function PackModel({ textura, dorso, estado }) {
  const tapa = useRef();
  const segmentos = useRef([]);
  const pila = useRef();
  const luz = useRef();
  const chispa = useRef();
  const guia = useRef();
  const fraccion = (PACK_H - PACK_TAPA) / PACK_H;

  const cuerpoFrente = useMemo(() => cortar(textura, 0, fraccion), [textura, fraccion]);
  const tapaFrente = useMemo(() => cortar(textura, fraccion, 1), [textura, fraccion]);
  const cuerpoDorso = useMemo(() => cortar(dorso, 0, fraccion), [dorso, fraccion]);
  const tapaDorso = useMemo(() => cortar(dorso, fraccion, 1), [dorso, fraccion]);

  const geometrias = useMemo(() => Array.from({ length: SEGMENTOS }, (_, i) => crearSegmento(i)), []);
  const materialesTapa = useMemo(
    () => [
      new MeshStandardMaterial(BORDE),
      new MeshStandardMaterial(BORDE),
      new MeshStandardMaterial(BORDE),
      new MeshStandardMaterial(BORDE),
      new MeshStandardMaterial({ map: tapaFrente, roughness: 0.35, metalness: 0.1 }),
      new MeshStandardMaterial({ map: tapaDorso, roughness: 0.45, metalness: 0.1 }),
    ],
    [tapaFrente, tapaDorso],
  );

  // Las cartas que asoman: solo se ve la parte de arriba del dorso de una carta.
  const dorsoCarta = useMemo(() => getCardBackTexture(), []);
  const asoman = useMemo(() => {
    const t = dorsoCarta.clone();
    t.repeat.set(1, 0.44);
    t.offset.set(0, 0.56);
    t.needsUpdate = true;
    return t;
  }, [dorsoCarta]);
  const brillo = useMemo(() => getGlowTexture(), []);

  useEffect(
    () => () => {
      [cuerpoFrente, tapaFrente, cuerpoDorso, tapaDorso, asoman].forEach((t) => t.dispose());
    },
    [cuerpoFrente, tapaFrente, cuerpoDorso, tapaDorso, asoman],
  );
  useEffect(() => () => geometrias.forEach((g) => g.dispose()), [geometrias]);
  useEffect(() => () => materialesTapa.forEach((m) => m.dispose()), [materialesTapa]);

  useFrame((reloj) => {
    const { p, vuelo } = estado.current;
    const dir = estado.current.dir || 1;
    const t = reloj.clock.elapsedTime;
    const frente = p * (SEGMENTOS + 1.5); // hasta dónde ha llegado el corte, en trozos

    // La tira entera sale volando cuando el rasgado termina.
    const g = tapa.current;
    if (g) {
      g.position.set(dir * vuelo * 2.4, PACK_H / 2 - PACK_TAPA / 2 + vuelo * 1.0, vuelo * 0.7);
      g.rotation.set(vuelo * 2.2, vuelo * 1.5, -dir * vuelo * 1.2);
      g.visible = vuelo < 1;
    }

    // Cada trozo se despega y se tuerce un poco distinto (borde irregular), según llega el corte.
    segmentos.current.forEach((m, i) => {
      if (!m) return;
      const orden = dir > 0 ? i : SEGMENTOS - 1 - i;
      const s = suave(limitar((frente - orden) / 1.5, 0, 1));
      const a = Math.sin(i * 12.9898 + 1.3);
      const b = Math.sin(i * 78.233 + 0.7);
      m.position.set(xBase(i), s * (0.12 + 0.05 * a), s * (0.1 + 0.06 * b));
      m.rotation.set(s * (0.7 + 0.25 * a), s * 0.35 * b, -dir * s * (0.35 + 0.25 * a));
    });

    // Cartas que asoman por arriba, a medida que se rasga y al salir volando la tira.
    const asoma = limitar(p * 1.1 - 0.15, 0, 1) * 0.35 + suave(vuelo) * 0.65;
    if (pila.current) {
      pila.current.visible = asoma > 0.001;
      pila.current.position.y = PACK_H / 2 - PACK_TAPA - 0.27 + asoma * 0.5;
    }
    // Resplandor por la abertura (late mientras esperamos las cartas) y destello al romperse.
    if (luz.current) {
      const op = asoma * 0.55 * (0.85 + 0.15 * Math.sin(t * 8)) + Math.sin(vuelo * Math.PI) * 0.5;
      luz.current.material.opacity = op;
      luz.current.visible = op > 0.01;
      luz.current.scale.setScalar(1 + Math.sin(vuelo * Math.PI) * 0.6);
    }
    // Chispa en el punto de corte, que avanza con el rasgado.
    if (chispa.current) {
      const x = dir > 0 ? -PACK_W / 2 + limitar(frente, 0, SEGMENTOS) * ANCHO_SEG : PACK_W / 2 - limitar(frente, 0, SEGMENTOS) * ANCHO_SEG;
      chispa.current.position.x = x;
      const op = p > 0.01 ? 0.9 * limitar(1 - vuelo / 0.3, 0, 1) : 0;
      chispa.current.material.opacity = op;
      chispa.current.visible = op > 0.01;
    }
    // Guía luminosa: indica por dónde deslizar mientras el sobre está cerrado.
    if (guia.current) {
      const op = p < 0.02 ? 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3)) : 0;
      guia.current.material.opacity = op;
      guia.current.visible = op > 0.01;
    }
  });

  return (
    <group>
      <mesh position={[0, -PACK_TAPA / 2, 0]} castShadow>
        <boxGeometry args={[PACK_W, PACK_H - PACK_TAPA, PACK_T]} />
        <meshStandardMaterial attach="material-0" {...BORDE} />
        <meshStandardMaterial attach="material-1" {...BORDE} />
        <meshStandardMaterial attach="material-2" color="#0a0a0d" />
        <meshStandardMaterial attach="material-3" {...BORDE} />
        <meshStandardMaterial attach="material-4" map={cuerpoFrente} roughness={0.35} metalness={0.1} />
        <meshStandardMaterial attach="material-5" map={cuerpoDorso} roughness={0.45} metalness={0.1} />
      </mesh>

      <mesh ref={pila}>
        <boxGeometry args={[PACK_W * 0.84, 0.55, 0.05]} />
        <meshStandardMaterial attach="material-0" color="#e8e4d8" />
        <meshStandardMaterial attach="material-1" color="#e8e4d8" />
        <meshStandardMaterial attach="material-2" color="#e8e4d8" />
        <meshStandardMaterial attach="material-3" color="#e8e4d8" />
        <meshStandardMaterial attach="material-4" map={asoman} roughness={0.6} />
        <meshStandardMaterial attach="material-5" map={asoman} roughness={0.6} />
      </mesh>

      <group ref={tapa} position={[0, PACK_H / 2 - PACK_TAPA / 2, 0]}>
        {geometrias.map((geo, i) => (
          <mesh
            key={i}
            ref={(el) => { segmentos.current[i] = el; }}
            geometry={geo}
            material={materialesTapa}
            position={[xBase(i), 0, 0]}
            castShadow
          />
        ))}
      </group>

      <mesh ref={luz} position={[0, PACK_H / 2 - PACK_TAPA + 0.25, 0.08]}>
        <planeGeometry args={[PACK_W * 1.5, 1.1]} />
        <meshBasicMaterial map={brillo} color="#ffe9a0" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={chispa} position={[0, PACK_H / 2 - PACK_TAPA, 0.09]}>
        <planeGeometry args={[0.32, 0.42]} />
        <meshBasicMaterial map={brillo} color="#fff6c8" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={guia} position={[0, PACK_H / 2 - PACK_TAPA, 0.07]}>
        <planeGeometry args={[PACK_W, 0.035]} />
        <meshBasicMaterial color="#fff3b0" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}
