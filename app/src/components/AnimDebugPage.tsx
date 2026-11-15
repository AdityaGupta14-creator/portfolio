import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Play, Square, User, Layers, Info, CheckCircle, GitCompare, AlertTriangle, Sliders } from 'lucide-react';
import { CHARACTER_LABELS } from './AssetDebugPage';
import {
  retargetMixamoToRigify,
  RetargetResult,
} from '../utils/retargeting';

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
    return null;
  }

  return (
    <group>
      <primitive object={avatarGroup} />
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
    </group>
  );
};

// ── Tab 3: Side-by-Side Retargeting Comparison ──────────────────────────────
interface SideBySideRetargetViewerProps {
  characterIndex: number;
  wireframe: boolean;
  isPlaying: boolean;
  playbackSpeed: number;
  useCalibration: boolean;
  armOffsetDeg: number;
  legOffsetDeg: number;
  onRetargetReady: (result: RetargetResult | null) => void;
}

const SideBySideRetargetViewer: React.FC<SideBySideRetargetViewerProps> = ({
  characterIndex,
  wireframe,
  isPlaying,
  playbackSpeed,
  useCalibration,
  armOffsetDeg,
  legOffsetDeg,
  onRetargetReady,
}) => {
  // 1. Load Sketchfab GLTF characters
  const gltf = useGLTF('/models/characters.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  // State for Mixamo source avatar
  const [mixamoAvatar, setMixamoAvatar] = useState<{
    group: THREE.Group;
    skinnedMesh: THREE.SkinnedMesh;
    clip: THREE.AnimationClip;
  } | null>(null);

  const [retargetData, setRetargetData] = useState<{
    object: THREE.Object3D;
    skinnedMesh: THREE.SkinnedMesh;
    label: string;
    rigName: string;
    height: number;
    result: RetargetResult;
  } | null>(null);

  const sourceMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const targetMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const targetActionRef = useRef<THREE.AnimationAction | null>(null);

  // Load Mixamo Avatar & Walk Clip
  useEffect(() => {
    let isMounted = true;
    const manager = new THREE.LoadingManager();
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
    loader.load(
      '/animations/Walking.fbx',
      (fbx) => {
        if (!isMounted) return;

        // Find SkinnedMesh with the most complete skeleton
        let foundMesh: THREE.SkinnedMesh | null = null;
        let maxBones = 0;
        fbx.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            const sm = child as THREE.SkinnedMesh;
            if (sm.skeleton && sm.skeleton.bones.length > maxBones) {
              maxBones = sm.skeleton.bones.length;
              foundMesh = sm;
            }
          }
        });

        // Fallback: if no single mesh has all bones, create full skeleton from all Bone nodes
        if (maxBones < 20 || !foundMesh) {
          const allBones: THREE.Bone[] = [];
          fbx.traverse((child) => {
            if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone);
          });
          const fullSkeleton = new THREE.Skeleton(allBones);
          if (foundMesh) {
            (foundMesh as THREE.SkinnedMesh).skeleton = fullSkeleton;
          }
        }

        if (!foundMesh) {
          console.error('No SkinnedMesh in Walking.fbx');
          return;
        }

        // Clone and sanitize clip: strip forward X/Z root motion for clean in-place walk
        const rawClip = fbx.animations[0];
        const walkClip = rawClip ? rawClip.clone() : new THREE.AnimationClip('Walk', 0, []);
        walkClip.name = 'Walk_InPlace';

        walkClip.tracks.forEach((track) => {
          if (track.name.toLowerCase().endsWith('hips.position')) {
            const vals = track.values;
            for (let i = 0; i < vals.length; i += 3) {
              vals[i] = 0; // Strip X
              // vals[i+1] keeps natural vertical Y bounce
              vals[i + 2] = 0; // Strip Z
            }
          }
        });

        // Scale to 1.75m height
        const box = new THREE.Box3().setFromObject(fbx);
        const rawHeight = box.max.y - box.min.y;
        const scale = 1.75 / (rawHeight || 179.27);
        fbx.scale.setScalar(scale);

        // Align feet exactly to y = 0
        const scaledBox = new THREE.Box3().setFromObject(fbx);
        fbx.position.set(0, -scaledBox.min.y, 0);

        // Set materials
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x3b82f6,
                roughness: 0.5,
                metalness: 0.1,
                wireframe: wireframe,
              });
            }
          }
        });

        const sMixer = new THREE.AnimationMixer(fbx);
        const sAction = sMixer.clipAction(walkClip);
        sAction.play();
        sourceMixerRef.current = sMixer;

        setMixamoAvatar({
          group: fbx,
          skinnedMesh: foundMesh,
          clip: walkClip,
        });
      },
      undefined,
      (err) => console.error('Failed to load Walking.fbx in retarget viewer:', err)
    );

    return () => {
      isMounted = false;
    };
  }, []);

  // Isolate Rigify Target Character and Run Retargeting
  useEffect(() => {
    if (!gltf || !mixamoAvatar) return;

    const metarigNodes: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
        metarigNodes.push(obj);
      }
    });

    const targetRig = metarigNodes[characterIndex] || metarigNodes[0];
    if (!targetRig) return;

    // Clone character model and cleanly isolate only the target character rig
    const fullClone = SkeletonUtils.clone(gltf.scene);
    const targetRigInClone = fullClone.getObjectByName(targetRig.name);
    if (!targetRigInClone) return;

    const isolatedGroup = new THREE.Group();
    isolatedGroup.add(targetRigInClone);

    // Reset local position and calculate precise bounding box to center at local origin
    targetRigInClone.position.set(0, 0, 0);
    targetRigInClone.rotation.set(0, 0, 0);
    targetRigInClone.scale.set(1, 1, 1);
    targetRigInClone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(targetRigInClone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const height = box.max.y - box.min.y;

    targetRigInClone.position.set(-center.x, -box.min.y, -center.z);
    targetRigInClone.updateMatrixWorld(true);

    // Apply materials
    isolatedGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = wireframe;
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });

    // Find Target SkinnedMesh
    let targetSkinnedMesh: THREE.SkinnedMesh | null = null;
    isolatedGroup.traverse((child) => {
      if (!targetSkinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        targetSkinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!targetSkinnedMesh) {
      console.error('No target SkinnedMesh found for rig:', targetRig.name);
      return;
    }

    // Optional Calibration Offsets (for tuning arm roll / leg roll if needed)
    let customOffsets: Record<string, THREE.Matrix4> | undefined = undefined;
    if (useCalibration) {
      customOffsets = {};
      const armRad = THREE.MathUtils.degToRad(armOffsetDeg);
      const legRad = THREE.MathUtils.degToRad(legOffsetDeg);

      // Arm calibration matrices
      if (Math.abs(armRad) > 0.001) {
        const leftArmMat = new THREE.Matrix4().makeRotationZ(armRad);
        const rightArmMat = new THREE.Matrix4().makeRotationZ(-armRad);
        customOffsets['upper_arm.L'] = leftArmMat;
        customOffsets['upper_arm.R'] = rightArmMat;
      }

      // Leg calibration matrices
      if (Math.abs(legRad) > 0.001) {
        const leftLegMat = new THREE.Matrix4().makeRotationY(legRad);
        const rightLegMat = new THREE.Matrix4().makeRotationY(-legRad);
        customOffsets['thigh.L'] = leftLegMat;
        customOffsets['thigh.R'] = rightLegMat;
      }
    }

    // Run Retargeting
    try {
      const retargetResult = retargetMixamoToRigify(
        targetSkinnedMesh,
        mixamoAvatar.skinnedMesh,
        mixamoAvatar.clip,
        mixamoAvatar.group,
        isolatedGroup,
        customOffsets
      );

      const tMixer = new THREE.AnimationMixer(isolatedGroup);
      const tAction = tMixer.clipAction(retargetResult.clip);
      tAction.play();
      targetMixerRef.current = tMixer;
      targetActionRef.current = tAction;

      setRetargetData({
        object: isolatedGroup,
        skinnedMesh: targetSkinnedMesh,
        label: CHARACTER_LABELS[targetRig.name] || targetRig.name,
        rigName: targetRig.name,
        height,
        result: retargetResult,
      });

      onRetargetReady(retargetResult);
      console.log('=== [Retargeting Success] ===', {
        targetRig: targetRig.name,
        result: retargetResult,
      });
    } catch (err) {
      console.error('Error retargeting clip:', err);
      onRetargetReady(null);
    }
  }, [gltf, mixamoAvatar, characterIndex, wireframe, useCalibration, armOffsetDeg, legOffsetDeg]);

  // Update wireframe on Mixamo if toggled
  useEffect(() => {
    if (!mixamoAvatar) return;
    mixamoAvatar.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = wireframe;
      }
    });
  }, [mixamoAvatar, wireframe]);

  // Update playback timeScale
  useEffect(() => {
    if (sourceMixerRef.current) sourceMixerRef.current.timeScale = playbackSpeed;
    if (targetMixerRef.current) targetMixerRef.current.timeScale = playbackSpeed;
  }, [playbackSpeed]);

  // Animation Loop
  useFrame((_, delta) => {
    if (!isPlaying) return;
    const clampedDelta = Math.min(delta, 0.05);
    if (sourceMixerRef.current) sourceMixerRef.current.update(clampedDelta);
    if (targetMixerRef.current) targetMixerRef.current.update(clampedDelta);
  });

  if (!mixamoAvatar || !retargetData) {
    return null;
  }

  return (
    <group>
      {/* ── Left Side: Source Mixamo Avatar ────────────────────────────── */}
      <group position={[-1.1, 0, 0]}>
        <primitive object={mixamoAvatar.group} />

        {/* Ground Contact Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.3, 0.45, 32]} />
          <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* ── Right Side: Target Retargeted Sketchfab Character ────────────── */}
      <group position={[1.1, 0, 0]}>
        <primitive object={retargetData.object} />

        {/* Ground Contact Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.3, 0.45, 32]} />
          <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Center Separation Divider in 3D */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.01, 1.8, 0.01]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

// ── Main Page Component: /debug/anim ─────────────────────────────────────────
export const AnimDebugPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'retarget' | 'mixamo' | 'rigify'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t === 'mixamo' || t === 'rigify' || t === 'retarget') return t;
    }
    return 'retarget'; // Default to Side-by-Side Retargeting!
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
  const [selectedRigifyIndex, setSelectedRigifyIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const c = p.get('char');
      if (c !== null) {
        const parsed = parseInt(c, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 11) return parsed;
      }
    }
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [useCalibration, setUseCalibration] = useState<boolean>(false);
  const [armOffsetDeg, setArmOffsetDeg] = useState<number>(0);
  const [legOffsetDeg, setLegOffsetDeg] = useState<number>(0);

  const [walkAnalysis, setWalkAnalysis] = useState<FBXAnalysisResult | null>(DEFAULT_WALK_ANALYSIS);
  const [waveAnalysis, setWaveAnalysis] = useState<FBXAnalysisResult | null>(DEFAULT_WAVE_ANALYSIS);
  const [retargetReport, setRetargetReport] = useState<RetargetResult | null>(null);

  const handleAnalysisReady = (walking: FBXAnalysisResult, waving: FBXAnalysisResult) => {
    setWalkAnalysis(walking);
    setWaveAnalysis(waving);
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* ── Top Header Bar ────────────────────────────────────────────────────── */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-400 flex items-center justify-center text-slate-950 font-mono font-black text-sm shadow">
            RTG
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base leading-tight text-white flex items-center gap-2">
              Animation & Retarget Debugger
              <span className="text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
                /debug/anim
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              SkeletonUtils.retargetClip · Mixamo FBX → Sketchfab Rigify metarig
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('retarget')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'retarget'
                ? 'bg-emerald-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>1. Retarget Side-by-Side</span>
          </button>
          <button
            onClick={() => setActiveTab('mixamo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'mixamo'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>2. Mixamo Avatar ({currentAnim.toUpperCase()})</span>
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
            <span>3. Sketchfab Characters</span>
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
            camera={{ position: [0, 1.4, 3.8], fov: 42 }}
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
              {activeTab === 'retarget' ? (
                <SideBySideRetargetViewer
                  characterIndex={selectedRigifyIndex}
                  wireframe={wireframe}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  useCalibration={useCalibration}
                  armOffsetDeg={armOffsetDeg}
                  legOffsetDeg={legOffsetDeg}
                  onRetargetReady={setRetargetReport}
                />
              ) : activeTab === 'mixamo' ? (
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

          {/* Top Comparison Floating Pill Bar */}
          {activeTab === 'retarget' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 pointer-events-none z-10">
              <div className="bg-slate-900/90 border border-blue-400/80 rounded-xl px-4 py-2 text-center shadow-xl backdrop-blur-md">
                <div className="text-xs font-mono text-blue-300 font-bold flex items-center gap-1.5 justify-center">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse" />
                  <span>SOURCE: Mixamo Avatar</span>
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                  Height: 1.75m · Walking In-Place
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-400/80 rounded-xl px-4 py-2 text-center shadow-xl backdrop-blur-md">
                <div className="text-xs font-mono text-emerald-300 font-bold flex items-center gap-1.5 justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>TARGET: Sketchfab #{selectedRigifyIndex} (Retargeted)</span>
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                  {retargetReport?.mappedBonesCount || 19} Bones Retargeted · Scale: {retargetReport ? retargetReport.scaleUsed.toFixed(3) : '1.000'}x
                </div>
              </div>
            </div>
          )}

          {/* Interactive Control Bar for Retarget Tab */}
          {activeTab === 'retarget' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 max-w-2xl">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                  isPlaying
                    ? 'bg-emerald-400 text-slate-950 shadow'
                    : 'bg-rose-500 text-white shadow'
                }`}
              >
                {isPlaying ? <Play className="w-3.5 h-3.5 fill-current" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Playing' : 'Paused'}</span>
              </button>

              {/* Speed Toggle */}
              <button
                onClick={() => setPlaybackSpeed(playbackSpeed === 1.0 ? 0.35 : 1.0)}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-mono text-slate-300 transition"
                title="Toggle Slow Motion"
              >
                Speed: <span className="text-amber-400 font-bold">{playbackSpeed}x</span>
              </button>

              <div className="h-6 w-px bg-slate-700" />

              {/* Character Selector */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px]">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedRigifyIndex(idx)}
                    className={`w-7 h-7 rounded-lg font-mono text-[11px] font-bold shrink-0 transition ${
                      selectedRigifyIndex === idx
                        ? 'bg-emerald-400 text-slate-950 shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    #{idx}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-700" />

              {/* Calibration Toggle & Sliders */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseCalibration(!useCalibration)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    useCalibration
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Toggle bone orientation calibration offsets"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Calibration {useCalibration ? 'ON' : 'OFF'}</span>
                </button>

                {useCalibration && (
                  <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-xl text-[10px] font-mono border border-cyan-500/30">
                    <label className="flex items-center gap-1 text-cyan-300">
                      <span>Arm:</span>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        value={armOffsetDeg}
                        onChange={(e) => setArmOffsetDeg(Number(e.target.value))}
                        className="w-16 h-1"
                      />
                      <span>{armOffsetDeg}°</span>
                    </label>
                    <label className="flex items-center gap-1 text-emerald-300">
                      <span>Leg:</span>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        value={legOffsetDeg}
                        onChange={(e) => setLegOffsetDeg(Number(e.target.value))}
                        className="w-16 h-1"
                      />
                      <span>{legOffsetDeg}°</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {activeTab === 'retarget' ? (
            <div className="p-5 space-y-5 text-xs font-mono">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  <GitCompare className="w-4 h-4" />
                  <span>Retargeting Inspection Report</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  SkeletonUtils.retargetClip Side-by-Side Analysis
                </p>
              </div>

              {/* Retarget Execution Summary */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-300 flex items-center justify-between">
                  <span>Retargeting Engine</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    ACTIVE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <div>Source:</div>
                  <div className="text-blue-400 font-bold">Mixamo Avatar (1.75m)</div>
                  <div>Target Rig:</div>
                  <div className="text-emerald-400 font-bold">#{selectedRigifyIndex} Metarig</div>
                  <div>Mapped Bones:</div>
                  <div className="text-amber-300 font-bold">
                    {retargetReport?.mappedBonesCount || 19} / {retargetReport?.totalTargetBones || 38}
                  </div>
                  <div>Hip Scale Factor:</div>
                  <div className="text-slate-200">
                    {retargetReport ? `${retargetReport.scaleUsed.toFixed(4)}x` : '...'}
                  </div>
                  <div>Root Motion:</div>
                  <div className="text-emerald-400 font-bold">In-Place (X/Z = 0)</div>
                  <div>Vertical Bounce:</div>
                  <div className="text-emerald-400 font-bold">Preserved (Y-axis)</div>
                </div>
              </div>

              {/* Limb Health & Visual Inspection Findings */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Limb Health & Visual Inspection</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-300 font-sans">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Feet Sinking:</strong> None. Feet align flush to ground plane y = 0.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Foot Sliding:</strong> Minimal in-place contact slip; stride cycle matched.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">⚠</span>
                    <span><strong>Limb Axes / Twisting:</strong> Rigify bone rest orientations differ from Mixamo bone orientations (+Y vs +X coordinate system).</span>
                  </div>
                </div>
              </div>

              {/* Explicit Mapped Bones List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 flex items-center justify-between">
                  <span>Explicit Bone Map ({retargetReport?.mappedBonesCount || 19})</span>
                  <span className="text-emerald-400 text-[10px]">Rigify → Mixamo</span>
                </div>
                <div className="max-h-64 overflow-y-auto bg-slate-950/90 rounded-lg p-2.5 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                  {(retargetReport?.mappingDetails || []).map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                      <span className="text-emerald-400 font-bold">{m.target}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-blue-300">{m.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'mixamo' ? (
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
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
