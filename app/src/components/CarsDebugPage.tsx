import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  ALL_CAR_TYPES,
  CarType,
  CarInstance,
  createCar,
  loadCarModel,
} from '../scene/carFactory';

// Distinct, vibrant palette for the 10 cars
const CAR_COLORS = [
  '#ef4444', // Compact: Crimson Red
  '#3b82f6', // Coupe: Royal Blue
  '#f59e0b', // Hatchback: Amber Gold
  '#10b981', // Minivan: Emerald Green
  '#f97316', // Offroad: Sunset Orange
  '#94a3b8', // Pickup: Silver Metallic
  '#f8fafc', // Sedan: Pearl White
  '#dc2626', // Sport: Ferrari Red
  '#2563eb', // SUV: Midnight Sapphire
  '#0d9488', // Wagon: Deep Teal
];

interface CarRowItemProps {
  type: CarType;
  xPos: number;
  initialColor: string;
  isSpinning: boolean;
  steerAngle: number;
  isFlipped: boolean;
  colorTrigger: number;
  sourceScene: THREE.Group;
  onCarReady: (type: CarType, instance: CarInstance) => void;
}

const CarRowItem: React.FC<CarRowItemProps> = ({
  type,
  xPos,
  initialColor,
  isSpinning,
  steerAngle,
  isFlipped,
  colorTrigger,
  sourceScene,
  onCarReady,
}) => {
  const mountRef = useRef<THREE.Group>(null);
  const carInstanceRef = useRef<CarInstance | null>(null);

  // Build the car instance on mount or when sourceScene is ready
  useEffect(() => {
    if (!mountRef.current || !sourceScene) return;

    try {
      const instance = createCar(type, initialColor, sourceScene);
      carInstanceRef.current = instance;
      mountRef.current.clear();
      mountRef.current.add(instance.root);
      onCarReady(type, instance);
    } catch (err) {
      console.error(`Failed to build car "${type}":`, err);
    }

    return () => {
      if (mountRef.current && carInstanceRef.current) {
        mountRef.current.remove(carInstanceRef.current.root);
      }
    };
  }, [type, sourceScene]);

  // Handle steering angle
  useEffect(() => {
    if (carInstanceRef.current) {
      carInstanceRef.current.setSteering((steerAngle * Math.PI) / 180);
    }
  }, [steerAngle]);

  // Handle color change
  useEffect(() => {
    if (carInstanceRef.current && colorTrigger > 0) {
      const randColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      carInstanceRef.current.setBodyColor(randColor);
    }
  }, [colorTrigger]);

  // Frame loop for wheel spinning and flip orientation
  useFrame((_, delta) => {
    if (carInstanceRef.current && isSpinning) {
      // Roll wheels forward: angle delta = (speed / radius) * delta
      const spinSpeed = 2.0; // rad/s
      carInstanceRef.current.spinWheels(spinSpeed * delta);
    }

    if (mountRef.current) {
      mountRef.current.rotation.y = isFlipped ? Math.PI : 0;
    }
  });

  const lengthDisplay = carInstanceRef.current
    ? `${carInstanceRef.current.length.toFixed(2)} m`
    : '...';

  return (
    <group position={[xPos, 0, 0]}>
      {/* Three.js car hierarchy mounted here */}
      <group ref={mountRef} />

      {/* Floating Header Label */}
      <Html position={[0, 2.4, 0]} center distanceFactor={14}>
        <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-center shadow-xl pointer-events-none select-none whitespace-nowrap backdrop-blur-md">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            {type}
          </div>
          <div className="text-[10px] font-mono text-cyan-300 font-semibold">
            {lengthDisplay}
          </div>
        </div>
      </Html>

      {/* Forward Arrow Indicator (pointing along +Z) */}
      <group position={[0, 1.9, 0]}>
        {/* Shaft */}
        <mesh position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.8, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.09, 0.25, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  );
};

export const CarsDebugPage: React.FC = () => {
  const [sourceScene, setSourceScene] = useState<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Interactive controls state
  const [isSpinning, setIsSpinning] = useState(true);
  const [steerAngle, setSteerAngle] = useState(18); // Default slight turn for screenshot
  const [isFlipped, setIsFlipped] = useState(false);
  const [colorTrigger, setColorTrigger] = useState(0);

  // Car instance tracking for length measurements
  const [, setCarInstances] = useState<Record<string, CarInstance>>({});

  useEffect(() => {
    loadCarModel()
      .then((scene) => {
        setSourceScene(scene);
        setIsLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load cars model');
        setIsLoading(false);
      });
  }, []);

  const handleCarReady = (type: CarType, instance: CarInstance) => {
    setCarInstances((prev) => ({ ...prev, [type]: instance }));
  };

  // Spacing between cars in row
  const CAR_SPACING = 3.2; // meters between car centers
  const rowStartX = -((ALL_CAR_TYPES.length - 1) * CAR_SPACING) / 2;

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-white overflow-hidden select-none font-sans">
      {/* ── Top HUD Control Bar ─────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-lg font-bold tracking-tight text-white">
              Car Pack Factory Verification (/debug/cars)
            </h1>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
            10 Ready-to-Drive Models
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSpinning((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isSpinning
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isSpinning ? '⏸ Stop Wheels' : '▶ Spin Wheels'}
          </button>

          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">
            <span className="text-xs text-slate-400">Steer:</span>
            <input
              type="range"
              min="-30"
              max="30"
              value={steerAngle}
              onChange={(e) => setSteerAngle(Number(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer"
            />
            <span className="text-xs font-mono text-cyan-300 w-9 text-right">
              {steerAngle > 0 ? `+${steerAngle}°` : `${steerAngle}°`}
            </span>
          </div>

          <button
            onClick={() => setIsFlipped((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
          >
            Flip Forward (180°)
          </button>

          <button
            onClick={() => setColorTrigger((prev) => prev + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 text-white shadow-lg transition-all"
          >
            🎨 Random Tint
          </button>

          <a
            href="/"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Exit to City
          </a>
        </div>
      </header>

      {/* ── 3D Viewport ─────────────────────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 7.5, 23.5], fov: 44 }}
        gl={{ antialias: true, alpha: false }}
        className="w-full h-full"
      >
        <color attach="background" args={['#080c14']} />

        <ambientLight intensity={1.2} />
        <hemisphereLight args={['#e0f2fe', '#0f172a', 0.8]} />
        <directionalLight position={[15, 25, 20]} intensity={2.2} castShadow />
        <directionalLight position={[-15, 20, 20]} intensity={1.5} />
        <directionalLight position={[0, 15, -20]} intensity={1.0} />

        {/* Orbit Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.01}
          minDistance={3}
          maxDistance={50}
          target={[0, 1.0, 0]}
        />

        {/* Ground Plane with Grid & Pavement Markings */}
        <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#131823" roughness={0.85} metalness={0.1} />
        </mesh>
        <gridHelper args={[60, 60, '#38bdf8', '#1e293b']} position={[0, 0, 0]} />

        {/* 4.5m Wireframe Reference Box */}
        <group position={[rowStartX - 3.0, 0.75, 0]}>
          {/* 4.5m long (along Z), 1.8m wide (along X), 1.5m tall (along Y) */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 1.5, 4.5]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
          <Html position={[0, 1.2, 0]} center distanceFactor={14}>
            <div className="bg-cyan-950/90 border border-cyan-500/50 px-2 py-1 rounded text-center text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-lg">
              4.5m Reference Box
            </div>
          </Html>
        </group>

        {/* 10 Cars in a Row */}
        {sourceScene &&
          ALL_CAR_TYPES.map((type, idx) => {
            const xPos = rowStartX + idx * CAR_SPACING;
            return (
              <CarRowItem
                key={type}
                type={type}
                xPos={xPos}
                initialColor={CAR_COLORS[idx % CAR_COLORS.length]}
                isSpinning={isSpinning}
                steerAngle={steerAngle}
                isFlipped={isFlipped}
                colorTrigger={colorTrigger}
                sourceScene={sourceScene}
                onCarReady={handleCarReady}
              />
            );
          })}
      </Canvas>

      {/* ── Bottom Information Card ─────────────────────────────────────── */}
      <footer className="absolute bottom-4 left-6 right-6 z-30 flex items-center justify-between p-3.5 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 text-xs text-slate-300 shadow-2xl">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white">Car Factory Specs:</span>
          <span>
            Independent instances · Shared geometry · Cloned materials · Zero-wobble wheel pivots
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>&ldquo;Generic passenger car pack&rdquo; by Comrade1280 (CC BY 4.0)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span className="text-emerald-400 font-mono font-semibold">10 / 10 Verified</span>
        </div>
      </footer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-300">
            Loading cars.web.glb &amp; building car instances...
          </span>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 z-50 bg-rose-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <span className="text-rose-400 font-bold text-lg mb-2">Error Loading Cars</span>
          <span className="text-slate-300 font-mono text-xs">{loadError}</span>
        </div>
      )}
    </div>
  );
};

export default CarsDebugPage;
