import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Table from './Table.jsx';
import CameraRig from './CameraRig.jsx';
import CoinStack, { CoinBurst } from './CoinStack.jsx';
import Card3D from './Card3D.jsx';

// Tus mejores cartas, colocadas en fila sobre la mesa (3 en pantallas estrechas, 5 en anchas).
function Escaparate({ destacadas, seleccionId, conChispas, onSelect }) {
  const size = useThree((s) => s.size);
  const cuantas = size.width / size.height < 0.9 ? 3 : 5;
  const lista = destacadas.slice(0, cuantas);
  return (
    <group>
      {lista.map((info, i) => {
        const centro = i - (lista.length - 1) / 2;
        return (
          <Card3D
            key={info.card_id}
            info={info}
            x={centro * 1.6}
            z={1.0}
            giro={centro * -0.04}
            seleccionada={seleccionId === info.card_id}
            conChispas={conChispas}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

export default function TableScene({ calidad, coins, destacadas, seleccionId, burst, onBurstDone, onSelect, onDecline }) {
  const alta = calidad === 'alta';
  return (
    <Canvas
      key={calidad}
      shadows={alta}
      dpr={alta ? [1, 1.5] : 1}
      camera={{ fov: 45, position: [0, 5.6, 5.8], near: 0.1, far: 60 }}
      gl={{ antialias: alta, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#0b0f16']} />
      <fog attach="fog" args={['#0b0f16', 14, 30]} />
      <PerformanceMonitor bounds={() => [35, 60]} onDecline={onDecline} />
      <CameraRig />

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
      <Escaparate destacadas={destacadas} seleccionId={seleccionId} conChispas={alta} onSelect={onSelect} />
    </Canvas>
  );
}
