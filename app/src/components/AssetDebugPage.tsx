import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Pre-configure MeshoptDecoder on GLTFLoader for compressed models
useGLTF.preload('/models/city.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

// Human-readable labels mapped from rig node names
export const CHARACTER_LABELS: Record<string, string> = {
  'metarig.009_38': 'Business man (Host Character)',
  'metarig.010_77': 'Male Customer (Casual)',
  'metarig.011_116': 'Female Customer',
  'metarig.007_160': 'Child (Short Stature)',
  'metarig.008_199': 'Teen',
  'metarig.004_238': 'Male Customer (Coat)',
  'metarig.005_277': 'Husband 30s',
  'metarig.006_316': 'Husband 30s (Alternate)',
  'metarig_355': 'MC 18 (Young Male)',
  'metarig.001_394': 'MC 20s (Male)',
  'metarig.002_433': 'Female (Formal)',
  'metarig.003_472': 'MC 50s (Mature Male)',
};

export function matchCharacterLabel(nodeName: string): string {
  const clean = nodeName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const [key, label] of Object.entries(CHARACTER_LABELS)) {
    const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (clean === cleanKey || clean.includes(cleanKey) || cleanKey.includes(clean)) {
      return label;
    }
  }
  return nodeName;
}

// ── Tab 1: City Model Inspector ──────────────────────────────────────────────
interface CityModelProps {
  wireframe: boolean;
  grounded: boolean;
  modelUrl: string;
}

const CityModelViewer: React.FC<CityModelProps> = ({ wireframe, grounded, modelUrl }) => {
  const gltf = useGLTF(modelUrl, true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const cityScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.wireframe = wireframe;
          mat.needsUpdate = true;
        }
      }
    });
    return clone;
  }, [gltf, wireframe]);

  // Compute bounding box
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cityScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { box, size };
  }, [cityScene]);

  // If grounded is true, raise the model so its lowest point rests at Y = 0
  const yOffset = grounded ? -bounds.box.min.y : 0;

  return (
    <group position={[0, yOffset, 0]}>
      <primitive object={cityScene} />
      {/* Visual Bounding Box Wireframe */}
      <box3Helper args={[bounds.box, new THREE.Color(0x38bdf8)]} />
    </group>
  );
};

// ── Tab 2: 12 Characters Row Inspector ───────────────────────────────────────
interface CharactersRowProps {
  wireframe: boolean;
  modelUrl: string;
}

interface IsolatedCharacter {
  id: number;
  originalName: string;
  label: string;
  object: THREE.Object3D;
  height: number;
  xPos: number;
}

const CharactersRowViewer: React.FC<CharactersRowProps> = ({ wireframe, modelUrl }) => {
  const gltf = useGLTF(modelUrl, true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const isolatedCharacters = useMemo<IsolatedCharacter[]>(() => {
    // Find all 12 metarig roots in the gltf scene
    const metarigNodes: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        metarigNodes.push(obj);
      }
    });

    return metarigNodes.map((rigRoot, index) => {
      // Clone the entire scene to keep skeletons intact, then keep only this metarig
      const fullClone = SkeletonUtils.clone(gltf.scene);
      const otherRigs: THREE.Object3D[] = [];

      fullClone.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
          if (obj.name !== rigRoot.name) {
            otherRigs.push(obj);
          }
        }
      });

      // Remove the other 11 rigs so each character has only its own skeleton and mesh
      otherRigs.forEach((r) => {
        if (r.parent) r.parent.remove(r);
      });

      // Measure character bounding box
      const box = new THREE.Box3().setFromObject(fullClone);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const height = box.max.y - box.min.y;

      // Position side-by-side in a single row along X
      const spacing = 2.4;
      const xPos = (index - 5.5) * spacing;
      fullClone.position.set(xPos - center.x, -box.min.y, -center.z);

      if (wireframe) {
        fullClone.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            (child.material as THREE.MeshStandardMaterial).wireframe = true;
          }
        });
      }

      return {
        id: index,
        originalName: rigRoot.name,
        label: matchCharacterLabel(rigRoot.name),
        object: fullClone,
        height,
        xPos,
      };
    });
  }, [gltf, wireframe]);

  return (
    <group>
      {isolatedCharacters.map((char) => (
        <group key={char.id}>
          <primitive object={char.object} />
          {/* HTML Label above character head */}
          <Html position={[char.xPos, char.height + 0.35, 0]} center distanceFactor={15}>
            <div className="bg-slate-900/90 border border-cyan-500/60 rounded-md px-2.5 py-1 text-center shadow-lg pointer-events-none whitespace-nowrap backdrop-blur-sm">
              <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                #{char.id} {char.label}
              </div>
              <div className="text-[9px] font-mono text-slate-300">
                Node: <span className="text-amber-300">{char.originalName}</span>
              </div>
              <div className="text-[8px] font-mono text-slate-400">
                Height: {char.height.toFixed(2)} units
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// ── Main Asset Debug Page ───────────────────────────────────────────────────
export const AssetDebugPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'city' | 'characters'>('city');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [grounded, setGrounded] = useState<boolean>(true);
  const [useOpt, setUseOpt] = useState<boolean>(true);

  // Keyboard shortcut to switch tabs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '1') setActiveTab('city');
      if (e.key === '2') setActiveTab('characters');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const cityUrl = useOpt ? '/models/city.opt.glb' : '/models/city.glb';
  const charUrl = useOpt ? '/models/characters.opt.glb' : '/models/characters.glb';

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden select-none">
      {/* Top Header & Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
          >
            ← Back to Portfolio
          </a>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Asset Debug Inspector
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                /debug/assets
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Interactive 3D verification for Sketchfab city and rigged character models
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab('city')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'city'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🏙️ City Model (Tab 1)
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'characters'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            👥 12 Characters (Tab 2)
          </button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 text-xs">
          {activeTab === 'city' && (
            <button
              onClick={() => setGrounded(!grounded)}
              className={`px-2.5 py-1.5 rounded border transition-colors ${
                grounded
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Align model base to Y=0 ground plane vs raw Y position"
            >
              {grounded ? '✓ Base Grounded (Y=0)' : 'Raw Origin'}
            </button>
          )}

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-2.5 py-1.5 rounded border transition-colors ${
              wireframe
                ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Wireframe: {wireframe ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setUseOpt(!useOpt)}
            className={`px-2.5 py-1.5 rounded border font-mono transition-colors ${
              useOpt
                ? 'bg-purple-950 border-purple-700 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle between meshopt-optimized and original raw GLB"
          >
            {useOpt ? 'Using .opt.glb' : 'Using raw .glb'}
          </button>
        </div>
      </header>

      {/* 3D WebGL Canvas */}
      <Canvas
        camera={
          activeTab === 'city'
            ? { position: [60, 40, 70], fov: 50, near: 0.1, far: 1000 }
            : { position: [0, 3.5, 12], fov: 45, near: 0.1, far: 500 }
        }
        className="w-full h-full"
      >
        <color attach="background" args={['#090d16']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[50, 80, 50]} intensity={1.8} castShadow />
        <directionalLight position={[-40, 30, -40]} intensity={0.6} color="#93c5fd" />

        {/* Ground grid & 3D coordinate axes */}
        <gridHelper args={[200, 100, '#38bdf8', '#1e293b']} position={[0, -0.01, 0]} />
        <axesHelper args={[ activeTab === 'city' ? 50 : 5 ]} />

        {/* 2 m Human-Scale Reference Box */}
        <group position={[activeTab === 'city' ? 0 : -14, 0, 0]}>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[0.6, 2.0, 0.6]} />
            <meshStandardMaterial
              color="#f43f5e"
              emissive="#e11d48"
              emissiveIntensity={0.3}
              roughness={0.4}
            />
          </mesh>
          <Html position={[0, 2.3, 0]} center distanceFactor={15}>
            <div className="bg-rose-950/90 border border-rose-500/80 rounded px-2 py-0.5 text-[10px] font-mono text-rose-200 font-bold whitespace-nowrap shadow-md">
              2.0 m Human Reference Box
            </div>
          </Html>
        </group>

        {/* Main Content Render */}
        <Suspense
          fallback={
            <Html center>
              <div className="bg-slate-900 border border-amber-500 rounded-lg p-4 text-center shadow-2xl">
                <div className="text-amber-400 font-bold mb-1">Loading 3D Asset...</div>
                <div className="text-xs text-slate-400 font-mono">
                  Decoding with MeshoptDecoder
                </div>
              </div>
            </Html>
          }
        >
          {activeTab === 'city' ? (
            <CityModelViewer wireframe={wireframe} grounded={grounded} modelUrl={cityUrl} />
          ) : (
            <CharactersRowViewer wireframe={wireframe} modelUrl={charUrl} />
          )}
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2 + 0.05}
        />
      </Canvas>

      {/* Floating Bottom Info Card */}
      <footer className="absolute bottom-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/85 border border-slate-800 shadow-2xl backdrop-blur-md text-xs font-mono">
        {activeTab === 'city' ? (
          <>
            <div>
              <div className="text-slate-400">Model Stats:</div>
              <div className="text-white font-bold">
                2 Meshes (Building 1_3: 1,105 tris, Building 2_2: 1,086 tris) — Total: 2,191 Tris
              </div>
            </div>
            <div>
              <div className="text-slate-400">Raw Bounds:</div>
              <div className="text-cyan-300">
                Min: [-41.98, -106.50, -70.49] | Max: [38.49, 6.78, 36.87] (Extends far below Y=0)
              </div>
            </div>
            <div>
              <div className="text-slate-400">Storey Height & Scale:</div>
              <div className="text-amber-300">
                Total Height: ~113.3 units across ~10-12 storeys (Needs scaling to ~3.5m / storey)
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-slate-400">Characters Stats:</div>
              <div className="text-white font-bold">
                12 Rigs, 54 Skinned Meshes, 19,908 Total Triangles (Flat Materials)
              </div>
            </div>
            <div>
              <div className="text-slate-400">Rig Type:</div>
              <div className="text-emerald-300">
                Rigify 38-bone armature per character (thigh, shin, foot, spine, upper_arm, forearm, hand)
              </div>
            </div>
            <div>
              <div className="text-slate-400">Host Character:</div>
              <div className="text-amber-300 font-bold">
                Rig #0: &quot;Business man_37&quot; (Host avatar Aditya)
              </div>
            </div>
          </>
        )}
        <div className="text-[10px] text-slate-500">
          Left-click: Orbit | Right-click: Pan | Scroll: Zoom | Keys 1 &amp; 2: Switch Tabs
        </div>
      </footer>
    </div>
  );
};
