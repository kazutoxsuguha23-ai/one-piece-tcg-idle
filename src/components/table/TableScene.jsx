import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Table from './Table.jsx';
import CameraRig from './CameraRig.jsx';
import CoinStack, { CoinBurst } from './CoinStack.jsx';
import PackPile from './PackPile.jsx';
import InspectPack from './InspectPack.jsx';
import RevealStage from './RevealStage.jsx';

const COLUMNAS = 6;
const SEPARACION = 1.55;
const FILAS_Z = [-0.6, 1.75];

// Pilas de sobres sobre la mesa, en 2 filas de hasta 6.
function Pilas({ pilas, onSelect }) {
  return (
    <group>
      {pilas.map((pila, i) => {
        const fila = Math.floor(i / COLUMNAS);
        const columna = i % COLUMNAS;
        const enFila = Math.min(COLUMNAS, pilas.length - fila * COLUMNAS);
        return (
          <PackPile
            key={pila.producto.product_id}
            producto={pila.producto}
            cantidad={pila.cantidad}
            x={(columna - (enFila - 1) / 2) * SEPARACION}
            z={FILAS_Z[fila] ?? FILAS_Z[1]}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

export default function TableScene({
  calidad, coins, modo, pilas, productoActivo, claveSobre, zoom, ordenAbrir, resultado,
  burst, onBurstDone, onSelectPack, onTear, onAdvance, onDecline,
}) {
  const alta = calidad === 'alta';
  const mostrarSobre = productoActivo && (modo === 'inspeccion' || modo === 'abriendo' || modo === 'revelado');
  return (
    <Canvas
      key={calidad}
      shadows={alta}
      dpr={alta ? [1, 1.25] : 1}
      camera={{ fov: 45, position: [0, 5.6, 5.8], near: 0.1, far: 60 }}
      gl={{ antialias: alta, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0b0f16']} />
      <fog attach="fog" args={['#0b0f16', 14, 30]} />
      <PerformanceMonitor bounds={() => [25, 60]} flipflops={1} onDecline={onDecline} />
      <CameraRig modo={modo} zoom={zoom} />

      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#bcd6ff', '#2a1a0a', 0.35]} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={2.2}
        castShadow={alta}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      <directionalLight position={[-6, 4, -2]} intensity={0.5} color="#ffd9a8" />

      <Table />
      <CoinStack coins={coins} />
      {burst && <CoinBurst key={burst.id} onDone={onBurstDone} />}

      {modo === 'mesa' && <Pilas pilas={pilas} onSelect={onSelectPack} />}
      {mostrarSobre && (
        <InspectPack
          key={`${productoActivo.product_id}-${claveSobre}`}
          producto={productoActivo}
          modo={modo}
          ordenAbrir={ordenAbrir}
          onTear={onTear}
        />
      )}
      {modo === 'revelado' && resultado && (
        <RevealStage cartas={resultado.cartas} indice={resultado.indice} onAvanzar={onAdvance} conEfectos={alta} />
      )}
    </Canvas>
  );
}
