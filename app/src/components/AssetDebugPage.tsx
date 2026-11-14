import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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

  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cityScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { box, size };
  }, [cityScene]);

  const yOffset = grounded ? -bounds.box.min.y : 0;

  return (
    <group position={[0, yOffset, 0]}>
      <primitive object={cityScene} />
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
    const metarigNodes: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        metarigNodes.push(obj);
      }
    });

    return metarigNodes.map((rigRoot, index) => {
      const fullClone = SkeletonUtils.clone(gltf.scene);
      const otherRigs: THREE.Object3D[] = [];

      fullClone.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
          if (obj.name !== rigRoot.name) {
            otherRigs.push(obj);
          }
        }
      });

      otherRigs.forEach((r) => {
        if (r.parent) r.parent.remove(r);
      });

      const box = new THREE.Box3().setFromObject(fullClone);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const height = box.max.y - box.min.y;

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

// ── Tab 3: Step 5 Single Character Procedural Walk Cycle Test ─────────────────
interface WalkTestViewerProps {
  modelUrl: string;
  wireframe: boolean;
  speed: number;
  strideAmp: number;
  freezePose?: 'stride' | 'pass' | null;
}

interface WalkRigBones {
  thighL: THREE.Bone | null;
  thighR: THREE.Bone | null;
  shinL: THREE.Bone | null;
  shinR: THREE.Bone | null;
  footL: THREE.Bone | null;
  footR: THREE.Bone | null;
  upperArmL: THREE.Bone | null;
  upperArmR: THREE.Bone | null;
  forearmL: THREE.Bone | null;
  forearmR: THREE.Bone | null;
  spine: THREE.Bone | null;
  spineUpper: THREE.Bone | null;
}

interface RestQuaternions {
  thighL: THREE.Quaternion;
  thighR: THREE.Quaternion;
  shinL: THREE.Quaternion;
  shinR: THREE.Quaternion;
  footL: THREE.Quaternion;
  footR: THREE.Quaternion;
  upperArmL: THREE.Quaternion;
  upperArmR: THREE.Quaternion;
  forearmL: THREE.Quaternion;
  forearmR: THREE.Quaternion;
  spine: THREE.Quaternion;
  spineUpper: THREE.Quaternion;
}

const SingleCharacterWalkViewer: React.FC<WalkTestViewerProps> = ({
  modelUrl,
  wireframe,
  speed,
  strideAmp,
  freezePose,
}) => {
  const gltf = useGLTF(modelUrl, true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const rootGroupRef = useRef<THREE.Group>(null);

  // Isolate Rig 0: Business man (Host character)
  const { characterObj, bones, restQuats, scaledHeight } = useMemo(() => {
    const fullClone = SkeletonUtils.clone(gltf.scene);

    // Keep only metarig.009_38 (Business man / Host)
    const otherRigs: THREE.Object3D[] = [];
    fullClone.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        if (!obj.name.includes('009') && !obj.name.includes('Business')) {
          otherRigs.push(obj);
        }
      }
    });
    otherRigs.forEach((r) => {
      if (r.parent) r.parent.remove(r);
    });

    // Update matrix world before measuring bounding box
    fullClone.updateMatrixWorld(true);

    const rawBox = new THREE.Box3().setFromObject(fullClone);
    const rawCenter = new THREE.Vector3();
    rawBox.getCenter(rawCenter);
    const rawHeight = rawBox.max.y - rawBox.min.y;

    // Scale precisely to 1.75 units tall (human scale)
    const targetHeight = 1.75;
    const scaleFactor = targetHeight / (rawHeight || 1.75);

    // Re-center X and Z at 0, feet exactly on the pavement Y=0
    fullClone.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
    
    // Create container group with uniform scale
    const container = new THREE.Group();
    container.scale.set(scaleFactor, scaleFactor, scaleFactor);
    container.add(fullClone);

    // Locate the 38-bone Rigify skeletal joints
    const b: WalkRigBones = {
      thighL: null,
      thighR: null,
      shinL: null,
      shinR: null,
      footL: null,
      footR: null,
      upperArmL: null,
      upperArmR: null,
      forearmL: null,
      forearmR: null,
      spine: null,
      spineUpper: null,
    };

    fullClone.traverse((o) => {
      if (o instanceof THREE.Bone) {
        const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (n.includes('thighl')) b.thighL = o;
        if (n.includes('thighr')) b.thighR = o;
        if (n.includes('shinl')) b.shinL = o;
        if (n.includes('shinr')) b.shinR = o;
        if (n.includes('footl') && !n.includes('heel')) b.footL = o;
        if (n.includes('footr') && !n.includes('heel')) b.footR = o;
        if (n.includes('upperarml')) b.upperArmL = o;
        if (n.includes('upperarmr')) b.upperArmR = o;
        if (n.includes('forearml') && !n.includes('001') && !n.includes('002')) b.forearmL = o;
        if (n.includes('forearmr') && !n.includes('001') && !n.includes('002')) b.forearmR = o;
        if (n.includes('spine36') || n === 'spine') b.spine = o;
        if (n.includes('spine003') || n.includes('spine004')) b.spineUpper = o;
      }

      if (wireframe && o instanceof THREE.Mesh && o.material) {
        (o.material as THREE.MeshStandardMaterial).wireframe = true;
      }
    });

    // Store rest orientations
    const rq: RestQuaternions = {
      thighL: b.thighL ? b.thighL.quaternion.clone() : new THREE.Quaternion(),
      thighR: b.thighR ? b.thighR.quaternion.clone() : new THREE.Quaternion(),
      shinL: b.shinL ? b.shinL.quaternion.clone() : new THREE.Quaternion(),
      shinR: b.shinR ? b.shinR.quaternion.clone() : new THREE.Quaternion(),
      footL: b.footL ? b.footL.quaternion.clone() : new THREE.Quaternion(),
      footR: b.footR ? b.footR.quaternion.clone() : new THREE.Quaternion(),
      upperArmL: b.upperArmL ? b.upperArmL.quaternion.clone() : new THREE.Quaternion(),
      upperArmR: b.upperArmR ? b.upperArmR.quaternion.clone() : new THREE.Quaternion(),
      forearmL: b.forearmL ? b.forearmL.quaternion.clone() : new THREE.Quaternion(),
      forearmR: b.forearmR ? b.forearmR.quaternion.clone() : new THREE.Quaternion(),
      spine: b.spine ? b.spine.quaternion.clone() : new THREE.Quaternion(),
      spineUpper: b.spineUpper ? b.spineUpper.quaternion.clone() : new THREE.Quaternion(),
    };

    return { characterObj: container, bones: b, restQuats: rq, scaledHeight: targetHeight };
  }, [gltf, wireframe]);

  // Procedural walk animation cycle driven on useFrame
  useFrame(({ clock }) => {
    let elapsed = clock.getElapsedTime() * 4.2 * speed;
    if (freezePose === 'stride') {
      elapsed = Math.PI * 0.5; // Peak stride extension
    } else if (freezePose === 'pass') {
      elapsed = 0; // Cross-over neutral stance
    }
    const sinCycle = Math.sin(elapsed);
    const cosCycle = Math.cos(elapsed);

    // 1. Thigh swing (local X axis tested & calibrated)
    const thighAngle = sinCycle * strideAmp;
    if (bones.thighL) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), thighAngle);
      bones.thighL.quaternion.copy(restQuats.thighL).multiply(q);
    }
    if (bones.thighR) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -thighAngle);
      bones.thighR.quaternion.copy(restQuats.thighR).multiply(q);
    }

    // 2. Knee bend (shin bends backward when leg is in back/passing phase, clamped >= 0)
    if (bones.shinL) {
      const kneeBend = Math.max(0, -sinCycle) * (strideAmp * 1.35);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), kneeBend);
      bones.shinL.quaternion.copy(restQuats.shinL).multiply(q);
    }
    if (bones.shinR) {
      const kneeBend = Math.max(0, sinCycle) * (strideAmp * 1.35);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), kneeBend);
      bones.shinR.quaternion.copy(restQuats.shinR).multiply(q);
    }

    // 3. Foot / Ankle compensation so feet stay level during stride
    if (bones.footL) {
      const footTilt = sinCycle * (strideAmp * 0.45);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -footTilt);
      bones.footL.quaternion.copy(restQuats.footL).multiply(q);
    }
    if (bones.footR) {
      const footTilt = -sinCycle * (strideAmp * 0.45);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -footTilt);
      bones.footR.quaternion.copy(restQuats.footR).multiply(q);
    }

    // 4. Arms swing opposite to legs (local X axis)
    const armAngle = -sinCycle * (strideAmp * 0.85);
    if (bones.upperArmL) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), armAngle);
      bones.upperArmL.quaternion.copy(restQuats.upperArmL).multiply(q);
    }
    if (bones.upperArmR) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -armAngle);
      bones.upperArmR.quaternion.copy(restQuats.upperArmR).multiply(q);
    }

    // 5. Forearm subtle natural elbow bend
    if (bones.forearmL) {
      const elbowBend = 0.15 + Math.max(0, -armAngle) * 0.5;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), elbowBend);
      bones.forearmL.quaternion.copy(restQuats.forearmL).multiply(q);
    }
    if (bones.forearmR) {
      const elbowBend = 0.15 + Math.max(0, armAngle) * 0.5;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), elbowBend);
      bones.forearmR.quaternion.copy(restQuats.forearmR).multiply(q);
    }

    // 6. Spine twist & subtle pelvis bobbing
    if (bones.spine) {
      const twist = -sinCycle * 0.05;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twist);
      bones.spine.quaternion.copy(restQuats.spine).multiply(q);
    }
    if (bones.spineUpper) {
      const counterTwist = sinCycle * 0.035;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), counterTwist);
      bones.spineUpper.quaternion.copy(restQuats.spineUpper).multiply(q);
    }

    // 7. Natural vertical hip bob (two bounces per full gait cycle)
    if (rootGroupRef.current) {
      const bob = Math.abs(cosCycle) * 0.032;
      rootGroupRef.current.position.y = bob;
    }
  });

  return (
    <group>
      {/* Animated Character Group */}
      <group ref={rootGroupRef}>
        <primitive object={characterObj} />
      </group>

      {/* Soft Contact Shadow Disc under character feet */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      {/* Floating Measurement Indicator */}
      <Html position={[0, scaledHeight + 0.35, 0]} center distanceFactor={10}>
        <div className="bg-slate-900/95 border border-emerald-500/80 rounded-lg px-3 py-1.5 text-center shadow-2xl pointer-events-none whitespace-nowrap backdrop-blur-md">
          <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
            Host: Business Man (Calibrated Walk)
          </div>
          <div className="text-[9px] font-mono text-slate-300">
            Scale: <span className="text-amber-300">1.75 m</span> • Swing Axis: <span className="text-cyan-300">Local X</span>
          </div>
          <div className="text-[8px] font-mono text-slate-400">
            Opposite Phase Arms &amp; Legs • Backward Knee Bend Clamped
          </div>
        </div>
      </Html>
    </group>
  );
};

// ── Main Asset Debug Page ───────────────────────────────────────────────────
export const AssetDebugPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'city' | 'characters' | 'walk'>('walk');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [grounded, setGrounded] = useState<boolean>(true);
  const [useOpt, setUseOpt] = useState<boolean>(true);
  const [walkSpeed, setWalkSpeed] = useState<number>(1.0);
  const [strideAmp, setStrideAmp] = useState<number>(0.42);
  const [freezePose, setFreezePose] = useState<'stride' | 'pass' | null>(null);

  // Check URL params for tab override (e.g. ?tab=walk)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'city') setActiveTab('city');
      if (p.get('tab') === 'characters') setActiveTab('characters');
      if (p.get('tab') === 'walk') {
        setActiveTab('walk');
        if (p.get('pose') === 'stride') setFreezePose('stride');
        if (p.get('pose') === 'pass') setFreezePose('pass');
      }
    }
  }, []);

  // Keyboard shortcut to switch tabs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '1') setActiveTab('city');
      if (e.key === '2') setActiveTab('characters');
      if (e.key === '3') setActiveTab('walk');
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
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'city'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🏙️ City Model (Tab 1)
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'characters'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            👥 12 Characters (Tab 2)
          </button>
          <button
            onClick={() => setActiveTab('walk')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'walk'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md animate-pulse'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/50'
            }`}
          >
            🚶 Walk Calibration (Step 5)
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

          {activeTab === 'walk' && (
            <div className="flex items-center gap-3 bg-slate-800/90 px-3 py-1 rounded border border-slate-700 text-[11px] font-mono">
              <span className="text-slate-400">Speed:</span>
              <button
                onClick={() => setWalkSpeed(0.5)}
                className={`px-1.5 py-0.5 rounded ${walkSpeed === 0.5 ? 'bg-emerald-500 text-black font-bold' : 'text-slate-300'}`}
              >
                0.5x
              </button>
              <button
                onClick={() => setWalkSpeed(1.0)}
                className={`px-1.5 py-0.5 rounded ${walkSpeed === 1.0 ? 'bg-emerald-500 text-black font-bold' : 'text-slate-300'}`}
              >
                1.0x
              </button>
              <button
                onClick={() => setWalkSpeed(1.5)}
                className={`px-1.5 py-0.5 rounded ${walkSpeed === 1.5 ? 'bg-emerald-500 text-black font-bold' : 'text-slate-300'}`}
              >
                1.5x
              </button>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Stride:</span>
              <button
                onClick={() => setStrideAmp(0.3)}
                className={`px-1.5 py-0.5 rounded ${strideAmp === 0.3 ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300'}`}
              >
                Small
              </button>
              <button
                onClick={() => setStrideAmp(0.42)}
                className={`px-1.5 py-0.5 rounded ${strideAmp === 0.42 ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300'}`}
              >
                Normal
              </button>
              <button
                onClick={() => setStrideAmp(0.55)}
                className={`px-1.5 py-0.5 rounded ${strideAmp === 0.55 ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300'}`}
              >
                Brisk
              </button>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Pose:</span>
              <button
                onClick={() => setFreezePose(null)}
                className={`px-1.5 py-0.5 rounded ${freezePose === null ? 'bg-emerald-500 text-black font-bold' : 'text-slate-300'}`}
              >
                Live Walk
              </button>
              <button
                onClick={() => setFreezePose('stride')}
                className={`px-1.5 py-0.5 rounded ${freezePose === 'stride' ? 'bg-amber-400 text-black font-bold' : 'text-slate-300'}`}
              >
                Peak Stride
              </button>
            </div>
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
            : activeTab === 'characters'
            ? { position: [0, 3.5, 12], fov: 45, near: 0.1, far: 500 }
            : { position: [3.0, 1.05, 2.2], fov: 40, near: 0.1, far: 200 }
        }
        className="w-full h-full"
      >
        <color attach="background" args={['#090d16']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[50, 80, 50]} intensity={1.8} castShadow />
        <directionalLight position={[-40, 30, -40]} intensity={0.6} color="#93c5fd" />

        {/* Ground grid & 3D coordinate axes */}
        <gridHelper
          args={[activeTab === 'walk' ? 20 : 200, activeTab === 'walk' ? 20 : 100, '#38bdf8', '#1e293b']}
          position={[0, -0.01, 0]}
        />
        <axesHelper args={[activeTab === 'city' ? 50 : activeTab === 'characters' ? 5 : 2]} />

        {/* 2 m Human-Scale Reference Box (shown in Tab 1 and Tab 2) */}
        {activeTab !== 'walk' && (
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
        )}

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
          ) : activeTab === 'characters' ? (
            <CharactersRowViewer wireframe={wireframe} modelUrl={charUrl} />
          ) : (
            <SingleCharacterWalkViewer
              modelUrl={charUrl}
              wireframe={wireframe}
              speed={walkSpeed}
              strideAmp={strideAmp}
              freezePose={freezePose}
            />
          )}
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={activeTab === 'walk' ? [0, 0.95, 0] : [0, 0, 0]}
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
              <div className="text-slate-400">Storey Height &amp; Scale:</div>
              <div className="text-amber-300">
                Total Height: ~113.3 units across ~10-12 storeys (Needs scaling to ~3.5m / storey)
              </div>
            </div>
          </>
        ) : activeTab === 'characters' ? (
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
        ) : (
          <>
            <div>
              <div className="text-slate-400">Walk Cycle Calibration:</div>
              <div className="text-emerald-400 font-bold">
                Local X Axis Rotation on Thigh, Shin, Upper Arm &amp; Forearm
              </div>
            </div>
            <div>
              <div className="text-slate-400">Gait Coordination:</div>
              <div className="text-cyan-300">
                Arms &amp; Legs in Opposite Phase • Knee Backward Flexion Clamped • Spine Bob
              </div>
            </div>
            <div>
              <div className="text-slate-400">Proportional Height:</div>
              <div className="text-amber-300 font-bold">
                Calibrated to 1.75m Human Stature (Feet on Ground Plane Y=0)
              </div>
            </div>
          </>
        )}
        <div className="text-[10px] text-slate-500">
          Left-click: Orbit | Right-click: Pan | Scroll: Zoom | Keys 1, 2, 3: Switch Tabs
        </div>
      </footer>
    </div>
  );
};
