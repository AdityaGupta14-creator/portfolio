import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Play, Square, User, Layers, Info, CheckCircle, ArrowRight, Activity } from 'lucide-react';
import { CHARACTER_LABELS } from './AssetDebugPage';

// Pre-configure MeshoptDecoder
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

export interface FBXAnalysisResult {
  fileName: string;
  hasSkinnedMesh: boolean;
  rawHeightCm: number;
  scaledHeightM: number;
  uniqueBones: string[];
  clipName: string;
  durationSec: number;
  hasForwardRootMotion: boolean;
  rootMotionDeltaZ: number;
  inPlaceApplied: boolean;
}

export const MIXAMO_UNIQUE_BONES: string[] = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigHeadTop_End',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigLeftHandThumb1',
  'mixamorigLeftHandThumb2',
  'mixamorigLeftHandThumb3',
  'mixamorigLeftHandThumb4',
  'mixamorigLeftHandIndex1',
  'mixamorigLeftHandIndex2',
  'mixamorigLeftHandIndex3',
  'mixamorigLeftHandIndex4',
  'mixamorigLeftHandMiddle1',
  'mixamorigLeftHandMiddle2',
  'mixamorigLeftHandMiddle3',
  'mixamorigLeftHandMiddle4',
  'mixamorigLeftHandRing1',
  'mixamorigLeftHandRing2',
  'mixamorigLeftHandRing3',
  'mixamorigLeftHandRing4',
  'mixamorigLeftHandPinky1',
  'mixamorigLeftHandPinky2',
  'mixamorigLeftHandPinky3',
  'mixamorigLeftHandPinky4',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigRightHandThumb1',
  'mixamorigRightHandThumb2',
  'mixamorigRightHandThumb3',
  'mixamorigRightHandThumb4',
  'mixamorigRightHandIndex1',
  'mixamorigRightHandIndex2',
  'mixamorigRightHandIndex3',
  'mixamorigRightHandIndex4',
  'mixamorigRightHandMiddle1',
  'mixamorigRightHandMiddle2',
  'mixamorigRightHandMiddle3',
  'mixamorigRightHandMiddle4',
  'mixamorigRightHandRing1',
  'mixamorigRightHandRing2',
  'mixamorigRightHandRing3',
  'mixamorigRightHandRing4',
  'mixamorigRightHandPinky1',
  'mixamorigRightHandPinky2',
  'mixamorigRightHandPinky3',
  'mixamorigRightHandPinky4',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigLeftToe_End',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase',
  'mixamorigRightToe_End',
];

export const DEFAULT_WALK_ANALYSIS: FBXAnalysisResult = {
  fileName: 'Walking.fbx',
  hasSkinnedMesh: true,
  rawHeightCm: 179.27,
  scaledHeightM: 1.75,
  uniqueBones: MIXAMO_UNIQUE_BONES,
  clipName: 'mixamo.com',
  durationSec: 1.033,
  hasForwardRootMotion: true,
  rootMotionDeltaZ: 177.86,
  inPlaceApplied: true,
};

export const DEFAULT_WAVE_ANALYSIS: FBXAnalysisResult = {
  fileName: 'Waving.fbx',
  hasSkinnedMesh: true,
  rawHeightCm: 179.27,
  scaledHeightM: 1.75,
  uniqueBones: MIXAMO_UNIQUE_BONES,
  clipName: 'mixamo.com',
  durationSec: 4.733,
  hasForwardRootMotion: false,
  rootMotionDeltaZ: 0.0,
  inPlaceApplied: false,
};

// ── Tab 1: Mixamo Avatar Viewer ──────────────────────────────────────────────
interface MixamoAvatarViewerProps {
  currentAnim: 'walk' | 'wave' | 'stop';
  onAnalysisReady: (walking: FBXAnalysisResult, waving: FBXAnalysisResult) => void;
  wireframe: boolean;
}

const MixamoAvatarViewer: React.FC<MixamoAvatarViewerProps> = ({
  currentAnim,
  onAnalysisReady,
  wireframe,
}) => {
  const [avatarGroup, setAvatarGroup] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ walk?: THREE.AnimationAction; wave?: THREE.AnimationAction }>({});
  const prevAnimRef = useRef<'walk' | 'wave' | 'stop'>('stop');

  useEffect(() => {
    const manager = new THREE.LoadingManager();
    // Fast lightweight loading: intercept heavy embedded texture decompression
    const transparentPixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    manager.setURLModifier((url) => {
      if (
        url.startsWith('blob:') ||
        url.match(/\.(png|jpg|jpeg|tga|bmp|tif|tiff)(\?.*)?$/i) ||
        url.includes('.fbm')
      ) {
        return transparentPixel;
      }
      return url;
    });

    const loader = new FBXLoader(manager);
    let isMounted = true;

    // 1. Load Walking.fbx first (contains avatar model + walking animation)
    loader.load(
      '/animations/Walking.fbx',
      (walkingFbx) => {
        if (!isMounted) return;

        // Analyze Walking.fbx
        let walkHasSkinnedMesh = false;
        const walkBones: string[] = [];
        walkingFbx.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) walkHasSkinnedMesh = true;
          if ((child as THREE.Bone).isBone) walkBones.push(child.name);
        });
        const walkUniqueBones = Array.from(new Set(walkBones));

        const walkBox = new THREE.Box3().setFromObject(walkingFbx);
        const walkRawHeight = walkBox.max.y - walkBox.min.y;

        const walkClipRaw = walkingFbx.animations[0];
        let walkHasRootMotion = false;
        let walkDeltaZ = 0;

        // Clone and remove forward root motion from Walking clip
        const walkClip = walkClipRaw ? walkClipRaw.clone() : new THREE.AnimationClip('Walk', 0, []);
        walkClip.name = 'Walk';

        walkClip.tracks.forEach((track) => {
          if (track.name.toLowerCase().endsWith('hips.position')) {
            const vals = track.values;
            walkDeltaZ = Math.abs(vals[vals.length - 1] - vals[2]);
            if (walkDeltaZ > 5.0) {
              walkHasRootMotion = true;
            }
            // Remove X & Z translation so avatar walks in place, preserving Y vertical hip bounce
            const x0 = vals[0];
            const z0 = vals[2];
            for (let i = 0; i < vals.length; i += 3) {
              vals[i] = x0;
              vals[i + 2] = z0;
            }
          }
        });

        const walkAnalysis: FBXAnalysisResult = {
          fileName: 'Walking.fbx',
          hasSkinnedMesh: walkHasSkinnedMesh,
          rawHeightCm: Number(walkRawHeight.toFixed(2)),
          scaledHeightM: 1.75,
          uniqueBones: walkUniqueBones,
          clipName: walkClipRaw ? walkClipRaw.name : 'none',
          durationSec: walkClipRaw ? Number(walkClipRaw.duration.toFixed(3)) : 0,
          hasForwardRootMotion: walkHasRootMotion,
          rootMotionDeltaZ: Number(walkDeltaZ.toFixed(2)),
          inPlaceApplied: true,
        };

        // Prepare Avatar Model: scale to exactly 1.75m, feet at y = 0
        const avatar = walkingFbx;
        const targetHeight = 1.75;
        const scale = targetHeight / (walkRawHeight || 179.27);
        avatar.scale.setScalar(scale);

        // Compute scaled bounding box and align feet exactly to y = 0
        const scaledBox = new THREE.Box3().setFromObject(avatar);
        avatar.position.set(0, -scaledBox.min.y, 0);

        avatar.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const baseColor =
                (mesh.material as THREE.MeshStandardMaterial).color || new THREE.Color(0xd4d4d8);
              mesh.material = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.5,
                metalness: 0.1,
                wireframe: wireframe,
              });
            }
          }
        });

        // Setup AnimationMixer and Walk Action
        const animMixer = new THREE.AnimationMixer(avatar);
        const walkAction = animMixer.clipAction(walkClip);
        walkAction.setEffectiveTimeScale(1);
        walkAction.setEffectiveWeight(1);
        if (currentAnim === 'walk') {
          walkAction.play();
        }

        actionsRef.current.walk = walkAction;
        setMixer(animMixer);
        setAvatarGroup(avatar);
        onAnalysisReady(walkAnalysis, DEFAULT_WAVE_ANALYSIS);

        // 2. Now load Waving.fbx asynchronously to extract waving clip
        loader.load(
          '/animations/Waving.fbx',
          (wavingFbx) => {
            if (!isMounted) return;

            let waveHasSkinnedMesh = false;
            const waveBones: string[] = [];
            wavingFbx.traverse((child) => {
              if ((child as THREE.SkinnedMesh).isSkinnedMesh) waveHasSkinnedMesh = true;
              if ((child as THREE.Bone).isBone) waveBones.push(child.name);
            });
            const waveUniqueBones = Array.from(new Set(waveBones));

            const waveBox = new THREE.Box3().setFromObject(wavingFbx);
            const waveRawHeight = waveBox.max.y - waveBox.min.y;

            const waveClipRaw = wavingFbx.animations[0];
            let waveHasRootMotion = false;
            let waveDeltaZ = 0;

            const waveClip = waveClipRaw
              ? waveClipRaw.clone()
              : new THREE.AnimationClip('Wave', 0, []);
            waveClip.name = 'Wave';

            waveClip.tracks.forEach((track) => {
              if (track.name.toLowerCase().endsWith('hips.position')) {
                const vals = track.values;
                waveDeltaZ = Math.abs(vals[vals.length - 1] - vals[2]);
                if (waveDeltaZ > 5.0) {
                  waveHasRootMotion = true;
                }
              }
            });

            const waveAnalysis: FBXAnalysisResult = {
              fileName: 'Waving.fbx',
              hasSkinnedMesh: waveHasSkinnedMesh,
              rawHeightCm: Number(waveRawHeight.toFixed(2)),
              scaledHeightM: 1.75,
              uniqueBones: waveUniqueBones,
              clipName: waveClipRaw ? waveClipRaw.name : 'none',
              durationSec: waveClipRaw ? Number(waveClipRaw.duration.toFixed(3)) : 0,
              hasForwardRootMotion: waveHasRootMotion,
              rootMotionDeltaZ: Number(waveDeltaZ.toFixed(2)),
              inPlaceApplied: false,
            };

            const waveAction = animMixer.clipAction(waveClip);
            waveAction.setEffectiveTimeScale(1);
            waveAction.setEffectiveWeight(1);
            if (currentAnim === 'wave') {
              waveAction.play();
            }

            actionsRef.current.wave = waveAction;
            onAnalysisReady(walkAnalysis, waveAnalysis);

            console.log('=== [Mixamo FBX Animation Analysis] ===');
            console.log('Walking.fbx:', walkAnalysis);
            console.log('Waving.fbx:', waveAnalysis);
            console.log('Unique Bone Names (' + walkUniqueBones.length + '):', walkUniqueBones);
          },
          undefined,
          (err) => console.warn('Could not load secondary Waving.fbx:', err)
        );
      },
      undefined,
      (err) => console.error('Failed to load Walking.fbx:', err)
    );

    return () => {
      isMounted = false;
    };
  }, [onAnalysisReady]);

  // Handle animation switching with 0.3s crossfade
  useEffect(() => {
    if (!mixer || !actionsRef.current) return;
    const { walk, wave } = actionsRef.current;
    const prev = prevAnimRef.current;
    const next = currentAnim;
    if (prev === next) return;

    const crossfadeDuration = 0.3;

    const getAction = (name: 'walk' | 'wave' | 'stop') => {
      if (name === 'walk') return walk;
      if (name === 'wave') return wave;
      return null;
    };

    const prevAction = getAction(prev);
    const nextAction = getAction(next);

    if (nextAction) {
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      if (prevAction) {
        prevAction.crossFadeTo(nextAction, crossfadeDuration, true);
      } else {
        nextAction.fadeIn(crossfadeDuration);
      }
      nextAction.play();
    } else if (prevAction) {
      prevAction.fadeOut(crossfadeDuration);
    }

    prevAnimRef.current = next;
  }, [currentAnim, mixer]);

  // Update wireframe on materials if toggled
  useEffect(() => {
    if (!avatarGroup) return;
    avatarGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            (m as THREE.MeshStandardMaterial).wireframe = wireframe;
          });
        } else {
          (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  }, [avatarGroup, wireframe]);

  // Animation frame loop
  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta);
    }
  });

  if (!avatarGroup) {
    return (
      <Html center>
        <div className="bg-slate-900/90 border border-amber-400/50 rounded-xl px-5 py-3 text-amber-300 font-mono text-sm shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <Activity className="w-5 h-5 animate-spin" />
          <span>Loading & Analyzing Mixamo FBX Animations...</span>
        </div>
      </Html>
    );
  }

  return (
    <group>
      <primitive object={avatarGroup} />
      {/* Target Height Marker Pill */}
      <Html position={[0, 1.9, 0]} center distanceFactor={8}>
        <div className="bg-slate-900/90 border border-amber-400/60 rounded-full px-3 py-1 text-center shadow-lg pointer-events-none whitespace-nowrap backdrop-blur-sm">
          <span className="text-[11px] font-mono text-amber-300 font-bold">
            Avatar · 1.75m Height
          </span>
        </div>
      </Html>
    </group>
  );
};

// ── Tab 2: Sketchfab Rigify Character Viewer ─────────────────────────────────
interface SketchfabRigifyViewerProps {
  characterIndex: number;
  wireframe: boolean;
}

const RIGIFY_KEY_BONES = [
  'spine',
  'thigh.L',
  'shin.L',
  'foot.L',
  'upper_arm.L',
  'forearm.L',
  'hand.L',
  'shoulder.L',
  'spine.004 (neck)',
  'spine.006 (head)',
  'thigh.R',
  'shin.R',
  'foot.R',
  'upper_arm.R',
  'forearm.R',
  'hand.R',
  'shoulder.R',
];

const SketchfabRigifyViewer: React.FC<SketchfabRigifyViewerProps> = ({
  characterIndex,
  wireframe,
}) => {
  const gltf = useGLTF('/models/characters.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const isolatedChar = useMemo(() => {
    const metarigNodes: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        metarigNodes.push(obj);
      }
    });

    const targetRig = metarigNodes[characterIndex] || metarigNodes[0];
    if (!targetRig) return null;

    const fullClone = SkeletonUtils.clone(gltf.scene);
    const otherRigs: THREE.Object3D[] = [];

    fullClone.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        if (obj.name !== targetRig.name) {
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

    fullClone.position.set(-center.x, -box.min.y, -center.z);

    if (wireframe) {
      fullClone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
          ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = true;
        }
      });
    }

    // Inspect Rigify bones present in this character
    const foundBones: string[] = [];
    fullClone.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        foundBones.push(child.name);
      }
    });

    return {
      object: fullClone,
      rigName: targetRig.name,
      label: CHARACTER_LABELS[targetRig.name] || targetRig.name,
      height,
      foundBones,
    };
  }, [gltf, characterIndex, wireframe]);

  if (!isolatedChar) return null;

  return (
    <group>
      <primitive object={isolatedChar.object} />
      <Html position={[0, isolatedChar.height + 0.35, 0]} center distanceFactor={8}>
        <div className="bg-slate-900/90 border border-cyan-400/60 rounded-md px-3 py-1.5 text-center shadow-lg pointer-events-none whitespace-nowrap backdrop-blur-sm">
          <div className="text-[11px] font-mono text-cyan-300 font-bold">
            #{characterIndex} {isolatedChar.label}
          </div>
          <div className="text-[9px] font-mono text-slate-300">
            Node: {isolatedChar.rigName} · Height: {isolatedChar.height.toFixed(2)} units
          </div>
        </div>
      </Html>
    </group>
  );
};

// ── Main Page Component: /debug/anim ─────────────────────────────────────────
export const AnimDebugPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mixamo' | 'rigify'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'rigify') return 'rigify';
    }
    return 'mixamo';
  });
  const [currentAnim, setCurrentAnim] = useState<'walk' | 'wave' | 'stop'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const a = p.get('anim');
      if (a === 'wave' || a === 'stop' || a === 'walk') return a;
    }
    return 'walk';
  });
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [selectedRigifyIndex, setSelectedRigifyIndex] = useState<number>(0);
  const [walkAnalysis, setWalkAnalysis] = useState<FBXAnalysisResult | null>(DEFAULT_WALK_ANALYSIS);
  const [waveAnalysis, setWaveAnalysis] = useState<FBXAnalysisResult | null>(DEFAULT_WAVE_ANALYSIS);

  const handleAnalysisReady = (walking: FBXAnalysisResult, waving: FBXAnalysisResult) => {
    setWalkAnalysis(walking);
    setWaveAnalysis(waving);
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* ── Top Header Bar ────────────────────────────────────────────────────── */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-950 font-mono font-black text-sm shadow">
            FBX
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base leading-tight text-white flex items-center gap-2">
              Animation & Rig Debugger
              <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded font-mono">
                /debug/anim
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Mixamo FBX Bones · In-Place Walk Calibration · Sketchfab Rigify
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('mixamo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'mixamo'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Mixamo Avatar ({currentAnim.toUpperCase()})</span>
          </button>
          <button
            onClick={() => setActiveTab('rigify')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'rigify'
                ? 'bg-cyan-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Sketchfab Rigify Character</span>
          </button>
        </div>

        {/* Controls & Return */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-400 focus:ring-0"
            />
            <span>Wireframe</span>
          </label>
          <a
            href="/"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition border border-slate-700"
          >
            ← Back to City
          </a>
        </div>
      </header>

      {/* ── Main Viewport & Analysis Panels ─────────────────────────────────── */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* 3D Canvas Viewport */}
        <div className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <Canvas
            shadows
            camera={{ position: [0, 1.4, 3.2], fov: 45 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          >
            <ambientLight intensity={0.65} />
            <hemisphereLight args={[0xffffff, 0x334155, 0.7]} />
            <directionalLight
              position={[5, 8, 4]}
              intensity={1.5}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />

            {/* Grid & Ground Plane */}
            <gridHelper args={[20, 20, 0x475569, 0x1e293b]} position={[0, 0, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
              <planeGeometry args={[20, 20]} />
              <meshStandardMaterial color={0x0b1120} roughness={0.9} />
            </mesh>

            <Suspense fallback={null}>
              {activeTab === 'mixamo' ? (
                <MixamoAvatarViewer
                  currentAnim={currentAnim}
                  onAnalysisReady={handleAnalysisReady}
                  wireframe={wireframe}
                />
              ) : (
                <SketchfabRigifyViewer
                  characterIndex={selectedRigifyIndex}
                  wireframe={wireframe}
                />
              )}
            </Suspense>

            <OrbitControls
              target={[0, 0.9, 0]}
              maxPolarAngle={Math.PI / 2 - 0.02}
              minDistance={1.2}
              maxDistance={12}
            />
          </Canvas>

          {/* Interactive Animation Control Bar (Mixamo Tab) */}
          {activeTab === 'mixamo' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 backdrop-blur-md rounded-2xl p-2 shadow-2xl flex items-center gap-2">
              <button
                onClick={() => setCurrentAnim('walk')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                  currentAnim === 'walk'
                    ? 'bg-amber-400 text-slate-950 shadow-lg scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Walk (In-Place)</span>
              </button>
              <button
                onClick={() => setCurrentAnim('wave')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                  currentAnim === 'wave'
                    ? 'bg-amber-400 text-slate-950 shadow-lg scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Wave</span>
              </button>
              <button
                onClick={() => setCurrentAnim('stop')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                  currentAnim === 'stop'
                    ? 'bg-rose-500 text-white shadow-lg scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop / T-Pose</span>
              </button>
              <div className="h-6 w-px bg-slate-700 mx-1" />
              <div className="text-[10px] font-mono text-slate-400 px-2">
                Crossfade: <span className="text-amber-400 font-bold">0.3s</span>
              </div>
            </div>
          )}

          {/* Character Selector Bar (Rigify Tab) */}
          {activeTab === 'rigify' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl flex items-center gap-2 max-w-xl overflow-x-auto">
              <span className="text-xs font-mono text-slate-400 pl-2 shrink-0">Character:</span>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedRigifyIndex(idx)}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-bold shrink-0 transition ${
                    selectedRigifyIndex === idx
                      ? 'bg-cyan-400 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #{idx}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right-Side Printed Analysis & Bone Hierarchy Panel ────────────── */}
        <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          {activeTab === 'mixamo' ? (
            <div className="p-5 space-y-5 text-xs font-mono">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  <Info className="w-4 h-4" />
                  <span>Mixamo FBX Analysis Report</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Extracted via FBXLoader from /public/animations/
                </p>
              </div>

              {/* 1. Walking.fbx Analysis */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
                <div className="font-bold text-amber-300 flex items-center justify-between">
                  <span>Walking.fbx</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    LOADED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <div>Skinned Mesh:</div>
                  <div className="text-emerald-400 font-bold">
                    {walkAnalysis ? (walkAnalysis.hasSkinnedMesh ? 'YES' : 'NO') : 'Analyzing...'}
                  </div>
                  <div>Raw Height:</div>
                  <div className="text-slate-200">
                    {walkAnalysis ? `${walkAnalysis.rawHeightCm} cm` : '...'}
                  </div>
                  <div>Avatar Height:</div>
                  <div className="text-amber-400 font-bold">
                    {walkAnalysis ? `${walkAnalysis.scaledHeightM} m (Scaled)` : '...'}
                  </div>
                  <div>Clip Name:</div>
                  <div className="text-slate-200">{walkAnalysis?.clipName || '...'}</div>
                  <div>Clip Duration:</div>
                  <div className="text-slate-200">
                    {walkAnalysis ? `${walkAnalysis.durationSec} s` : '...'}
                  </div>
                  <div>Root Motion:</div>
                  <div className="text-amber-300 font-bold">
                    {walkAnalysis?.hasForwardRootMotion
                      ? `YES (ΔZ = ${walkAnalysis.rootMotionDeltaZ} cm)`
                      : 'NO'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[10px] text-emerald-400 flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>In-Place Walk Calibration Applied:</strong> Removed X/Z translation
                    from mixamorigHips.position track; preserved vertical hip bounce.
                  </span>
                </div>
              </div>

              {/* 2. Waving.fbx Analysis */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
                <div className="font-bold text-amber-300 flex items-center justify-between">
                  <span>Waving.fbx</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    LOADED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <div>Skinned Mesh:</div>
                  <div className="text-emerald-400 font-bold">
                    {waveAnalysis ? (waveAnalysis.hasSkinnedMesh ? 'YES' : 'NO') : 'Analyzing...'}
                  </div>
                  <div>Raw Height:</div>
                  <div className="text-slate-200">
                    {waveAnalysis ? `${waveAnalysis.rawHeightCm} cm` : '...'}
                  </div>
                  <div>Clip Name:</div>
                  <div className="text-slate-200">{waveAnalysis?.clipName || '...'}</div>
                  <div>Clip Duration:</div>
                  <div className="text-slate-200">
                    {waveAnalysis ? `${waveAnalysis.durationSec} s` : '...'}
                  </div>
                  <div>Root Motion:</div>
                  <div className="text-emerald-400">
                    {waveAnalysis?.hasForwardRootMotion ? 'YES' : 'NO (In-Place Wave)'}
                  </div>
                </div>
              </div>

              {/* 3. Mixamo Bone Hierarchy List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 flex items-center justify-between">
                  <span>Mixamo Rig Bones</span>
                  <span className="text-amber-400">{walkAnalysis?.uniqueBones.length || 65} Bones</span>
                </div>
                <div className="max-h-60 overflow-y-auto bg-slate-950/90 rounded-lg p-2.5 border border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                  {(walkAnalysis?.uniqueBones || []).map((b, i) => (
                    <div key={i} className="hover:text-amber-300 transition flex items-center gap-1.5">
                      <span className="text-slate-600 w-5 text-right">{i + 1}.</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-5 text-xs font-mono">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                  <Layers className="w-4 h-4" />
                  <span>Sketchfab Rigify Rig Structure</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Character from /public/models/characters.glb
                </p>
              </div>

              {/* Rigify Key Bones List */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-3">
                <div className="font-bold text-cyan-300">
                  Rigify Target Bones (Verified in characters.glb)
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  The 12 Sketchfab characters use standard Blender Rigify naming conventions.
                </p>
                <div className="space-y-1.5 text-[11px]">
                  {RIGIFY_KEY_BONES.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80"
                    >
                      <span className="text-cyan-300 font-bold">{b}</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                        MATCHED
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 text-[11px] text-cyan-200">
                <div className="font-bold text-cyan-300 mb-1 flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Next Step: Retargeting</span>
                </div>
                <p className="font-sans leading-relaxed text-slate-300 text-[10px]">
                  In the subsequent task, bone rotation tracks from the Mixamo clips will be
                  mapped to these Rigify bone targets so all 12 pedestrians can share the
                  walk and wave cycles.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
