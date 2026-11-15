import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RAW_BOUNDS, BUILDING_PROXIES } from '../../data/buildings';
import { useAppStore } from '../../store/useAppStore';

// Pre-configure MeshoptDecoder for static extras GLTF loading
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

// ── Natural Clothing & Appearance Palettes ──────────────────────────────────
const SUIT_PALETTE = [
  0x1e293b, // Navy
  0x27272a, // Charcoal
  0x334155, // Slate
  0x36453b, // Olive Earth
  0x7c5e42, // Warm Camel
  0x2d2421, // Deep Espresso
  0x4a1c24, // Muted Burgundy
  0x3f4756, // Steel
];

const PANTS_PALETTE = [
  0x27272a, // Charcoal
  0x1e2430, // Classic Navy
  0x635343, // Khaki Chino
  0x2f3542, // Slate Dark
  0x26201d, // Dark Brown
  0x495057, // Stone Grey
  0x1b263b, // Dark Denim
  0x1f2229, // Anthracite
];

const SHIRT_PALETTE = [
  0xf8fafc, // Crisp White
  0xdbeafe, // Soft Sky Blue
  0xfef9c3, // Pale Cream
  0xe2e8f0, // Heather Grey
  0xe0f2fe, // Heather Ice
  0xdcfce7, // Soft Sage
  0xf5f0eb, // Natural Linen
  0xfce7f3, // Soft Blush
];

const SKIN_PALETTE = [
  0xf5d0b5, // Fair
  0xe0ac8b, // Medium Warm
  0xc6865c, // Tan
  0x8d5534, // Warm Bronze
  0xf7dcc4, // Peach
  0xd4a87c, // Golden Tan
  0x6e4327, // Deep Bronze
];

const HAIR_PALETTE = [
  0x18181b, // Soft Black
  0x2d221e, // Dark Brown
  0x4a3022, // Chestnut
  0x5c4738, // Warm Ash
  0x785b45, // Sandy Brown
  0x27272a, // Charcoal
];

const SHOE_PALETTE = [
  0x131418, // Black Leather
  0x241b18, // Espresso Leather
  0x31191c, // Cordovan / Oxblood
  0x3b2b23, // Brown Leather
];

// ── Pedestrian Configurations (8 Diversified Mixamo Walkers) ─────────────────
// Bounding box lanes:
// North sidewalk: facade at Z = -13.4, curb at Z = -6.2, pavement Y = 0.16
// South promenade: curb at Z = 5.1, boundary at Z = 13.3, pavement Y = 0.10
export interface PedestrianConfig {
  id: number;
  laneSide: 'north' | 'south';
  initialX: number;
  zLane: number;
  pavementY: number;
  dir: 1 | -1;
  speedMult: number;     // 0.90 to 1.10
  heightMult: number;    // 0.95 to 1.05
  suitColor: number;
  pantsColor: number;
  shirtColor: number;
  skinColor: number;
  hairColor: number;
  shoeColor: number;
  pairWithId: number | null; // Id of companion pedestrian walking side-by-side
  pairOffsetZ: number;       // Lateral offset for pair
}

const PEDESTRIAN_CONFIGS: PedestrianConfig[] = [
  // Pair A (North Sidewalk, walking West together)
  {
    id: 0,
    laneSide: 'north',
    initialX: 16.0,
    zLane: -10.4,
    pavementY: RAW_BOUNDS.pavementY,
    dir: -1,
    speedMult: 1.00,
    heightMult: 1.02,
    suitColor: SUIT_PALETTE[0], // Navy
    pantsColor: PANTS_PALETTE[0], // Charcoal
    shirtColor: SHIRT_PALETTE[0], // White
    skinColor: SKIN_PALETTE[1],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[0],
    pairWithId: 1,
    pairOffsetZ: 0,
  },
  {
    id: 1,
    laneSide: 'north',
    initialX: 16.3,
    zLane: -9.6,
    pavementY: RAW_BOUNDS.pavementY,
    dir: -1,
    speedMult: 1.00,
    heightMult: 0.97,
    suitColor: SUIT_PALETTE[4], // Warm Camel
    pantsColor: PANTS_PALETTE[1], // Classic Navy
    shirtColor: SHIRT_PALETTE[1], // Sky Blue
    skinColor: SKIN_PALETTE[0],
    hairColor: HAIR_PALETTE[2],
    shoeColor: SHOE_PALETTE[1],
    pairWithId: 0,
    pairOffsetZ: 0.8,
  },
  // North Solo Walkers
  {
    id: 2,
    laneSide: 'north',
    initialX: 32.0,
    zLane: -8.8,
    pavementY: RAW_BOUNDS.pavementY,
    dir: -1,
    speedMult: 0.95,
    heightMult: 1.04,
    suitColor: SUIT_PALETTE[2], // Slate
    pantsColor: PANTS_PALETTE[3], // Slate Dark
    shirtColor: SHIRT_PALETTE[3], // Heather Grey
    skinColor: SKIN_PALETTE[2],
    hairColor: HAIR_PALETTE[1],
    shoeColor: SHOE_PALETTE[0],
    pairWithId: null,
    pairOffsetZ: 0,
  },
  {
    id: 3,
    laneSide: 'north',
    initialX: -14.0,
    zLane: -10.2,
    pavementY: RAW_BOUNDS.pavementY,
    dir: 1,
    speedMult: 1.05,
    heightMult: 0.98,
    suitColor: SUIT_PALETTE[3], // Olive
    pantsColor: PANTS_PALETTE[2], // Khaki Chino
    shirtColor: SHIRT_PALETTE[2], // Cream
    skinColor: SKIN_PALETTE[3],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[3],
    pairWithId: null,
    pairOffsetZ: 0,
  },
  // Pair B (South Promenade, walking West together)
  {
    id: 4,
    laneSide: 'south',
    initialX: 24.0,
    zLane: 8.2,
    pavementY: 0.10,
    dir: -1,
    speedMult: 0.98,
    heightMult: 1.01,
    suitColor: SUIT_PALETTE[1], // Charcoal
    pantsColor: PANTS_PALETTE[0], // Charcoal
    shirtColor: SHIRT_PALETTE[0], // White
    skinColor: SKIN_PALETTE[5],
    hairColor: HAIR_PALETTE[1],
    shoeColor: SHOE_PALETTE[0],
    pairWithId: 5,
    pairOffsetZ: 0,
  },
  {
    id: 5,
    laneSide: 'south',
    initialX: 24.3,
    zLane: 9.0,
    pavementY: 0.10,
    dir: -1,
    speedMult: 0.98,
    heightMult: 0.96,
    suitColor: SUIT_PALETTE[6], // Burgundy
    pantsColor: PANTS_PALETTE[6], // Dark Denim
    shirtColor: SHIRT_PALETTE[6], // Linen
    skinColor: SKIN_PALETTE[4],
    hairColor: HAIR_PALETTE[4],
    shoeColor: SHOE_PALETTE[2],
    pairWithId: 4,
    pairOffsetZ: 0.8,
  },
  // South Solo Walkers
  {
    id: 6,
    laneSide: 'south',
    initialX: 38.0,
    zLane: 7.6,
    pavementY: 0.10,
    dir: -1,
    speedMult: 1.02,
    heightMult: 1.03,
    suitColor: SUIT_PALETTE[7], // Steel
    pantsColor: PANTS_PALETTE[5], // Stone
    shirtColor: SHIRT_PALETTE[5], // Sage
    skinColor: SKIN_PALETTE[6],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[1],
    pairWithId: null,
    pairOffsetZ: 0,
  },
  {
    id: 7,
    laneSide: 'south',
    initialX: -8.0,
    zLane: 9.6,
    pavementY: 0.10,
    dir: 1,
    speedMult: 0.93,
    heightMult: 0.99,
    suitColor: SUIT_PALETTE[5], // Espresso
    pantsColor: PANTS_PALETTE[4], // Dark Brown
    shirtColor: SHIRT_PALETTE[4], // Ice
    skinColor: SKIN_PALETTE[1],
    hairColor: HAIR_PALETTE[3],
    shoeColor: SHOE_PALETTE[0],
    pairWithId: null,
    pairOffsetZ: 0,
  },
];

// Physical constants:
// Base walking speed calibrated to Mixamo stride: 1.68 m/s
const BASE_WALK_SPEED = 1.68;
const MIN_PERSON_SPACING = 1.25; // meters
const HOST_AVOID_RADIUS = 1.8;   // meters
const LANE_X_MIN = -58;          // meters
const LANE_X_MAX = 58;           // meters
const CULL_DISTANCE = 75;        // meters to camera

type WalkerState = 'walking' | 'pausing' | 'turning';

interface WalkerRuntime {
  x: number;
  z: number;
  yaw: number;
  targetYaw: number;
  dir: 1 | -1;
  state: WalkerState;
  stateTimer: number;
}

interface PedestrianInstance {
  config: PedestrianConfig;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction;
  standAction?: THREE.AnimationAction;
  shadowMesh: THREE.Mesh;
}

/**
 * Applies unique cloned PBR materials to the pedestrian mesh
 */
function applyClonedMaterials(avatar: THREE.Object3D, config: PedestrianConfig) {
  avatar.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const name = mesh.name.toLowerCase();

      let color = config.suitColor;
      let roughness = 0.65;
      let metalness = 0.05;

      if (name.includes('suit') || name.includes('coat') || name.includes('jacket')) {
        color = config.suitColor;
        roughness = 0.65;
        metalness = 0.05;
      } else if (name.includes('pants') || name.includes('trousers') || name.includes('bottom')) {
        color = config.pantsColor;
        roughness = 0.70;
        metalness = 0.05;
      } else if (name.includes('shirt') || name.includes('top')) {
        color = config.shirtColor;
        roughness = 0.78;
        metalness = 0.02;
      } else if (name.includes('shoe') || name.includes('boot')) {
        color = config.shoeColor;
        roughness = 0.35;
        metalness = 0.20;
      } else if (
        name.includes('body') ||
        name.includes('skin') ||
        name.includes('face') ||
        name.includes('head')
      ) {
        color = config.skinColor;
        roughness = 0.58;
        metalness = 0.02;
      } else if (name.includes('hair') || name.includes('eyelash')) {
        color = config.hairColor;
        roughness = 0.85;
      } else if (name.includes('belt')) {
        color = 0x111317;
        roughness = 0.40;
        metalness = 0.25;
      }

      mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
      });
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MIXAMO-CLONED WALKING PEDESTRIANS
// ═════════════════════════════════════════════════════════════════════════════
const MixamoWalkingPedestrians: React.FC = () => {
  const { camera } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);

  const [instances, setInstances] = useState<PedestrianInstance[]>([]);
  const runtimeRef = useRef<WalkerRuntime[]>(
    PEDESTRIAN_CONFIGS.map((cfg) => ({
      x: cfg.initialX,
      z: cfg.zLane,
      yaw: cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      targetYaw: cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      dir: cfg.dir,
      state: 'walking',
      stateTimer: 6.0 + Math.random() * 8.0,
    }))
  );

  const hostPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-40.27, RAW_BOUNDS.pavementY, -10.0));

  // Load Walking.fbx and Waving.fbx once, then clone independently
  useEffect(() => {
    let isMounted = true;
    const manager = new THREE.LoadingManager();

    // Fast loading modifier: skip heavy embedded texture decompression
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

    const loadFBXPromise = (url: string): Promise<THREE.Group> => {
      return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    };

    Promise.all([
      loadFBXPromise('/animations/Walking.fbx'),
      loadFBXPromise('/animations/Waving.fbx').catch(() => null),
    ])
      .then(([walkingFbx, wavingFbx]) => {
        if (!isMounted) return;

        // Base model dimensions
        const rawBox = new THREE.Box3().setFromObject(walkingFbx);
        const rawHeight = rawBox.max.y - rawBox.min.y || 179.27;
        const baseTargetHeight = 1.75;
        const baseScaleFactor = baseTargetHeight / rawHeight;

        // Strip X/Z root motion from hips track on walk clip
        const rawWalkClip = walkingFbx.animations[0];
        const walkClip = rawWalkClip ? rawWalkClip.clone() : new THREE.AnimationClip('Walk', 0, []);
        walkClip.name = 'Walk';

        walkClip.tracks.forEach((track) => {
          if (track.name.toLowerCase().endsWith('hips.position')) {
            const vals = (track as THREE.VectorKeyframeTrack).values;
            const x0 = vals[0];
            const z0 = vals[2];
            for (let i = 0; i < vals.length; i += 3) {
              vals[i] = x0;
              vals[i + 2] = z0;
            }
          }
        });

        // Prepare optional standing pose from wave clip
        const standClip = wavingFbx && wavingFbx.animations[0] ? wavingFbx.animations[0].clone() : null;
        if (standClip) standClip.name = 'Stand';

        // Spawn 8 independent pedestrians with SkeletonUtils.clone
        const spawned: PedestrianInstance[] = PEDESTRIAN_CONFIGS.map((config) => {
          const clonedAvatar = SkeletonUtils.clone(walkingFbx) as THREE.Group;

          // Apply unique individual height scale
          const totalScale = baseScaleFactor * config.heightMult;
          clonedAvatar.scale.setScalar(totalScale);

          // Center X/Z and align feet at local Y = 0
          const scaledBox = new THREE.Box3().setFromObject(clonedAvatar);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);
          clonedAvatar.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

          // Deep-clone unique materials and apply natural outfit colors
          applyClonedMaterials(clonedAvatar, config);

          // Independent AnimationMixer
          const mixer = new THREE.AnimationMixer(clonedAvatar);
          const walkAction = mixer.clipAction(walkClip);
          walkAction.setLoop(THREE.LoopRepeat, Infinity);
          walkAction.setEffectiveTimeScale(config.speedMult);

          // Random walk phase offset
          walkAction.time = Math.random() * walkClip.duration;
          walkAction.play();

          let standAction: THREE.AnimationAction | undefined = undefined;
          if (standClip) {
            standAction = mixer.clipAction(standClip);
            standAction.setLoop(THREE.LoopOnce, 1);
            standAction.clampWhenFinished = true;
          }

          // Advance 1 frame to evaluate bind pose
          mixer.update(0.016);

          // Subtle contact shadow disc
          const shadowMesh = new THREE.Mesh(
            new THREE.RingGeometry(0.04, 0.42 * config.heightMult, 20),
            new THREE.MeshBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0.24,
              depthWrite: false,
            })
          );
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.position.y = 0.012;

          const root = new THREE.Group();
          root.position.set(config.initialX, config.pavementY, config.zLane);
          root.rotation.y = config.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          root.add(clonedAvatar);
          root.add(shadowMesh);

          return {
            config,
            root,
            mixer,
            walkAction,
            standAction,
            shadowMesh,
          };
        });

        if (isMounted) {
          setInstances(spawned);
        }
      })
      .catch((err) => {
        console.warn('Failed to load Mixamo pedestrian assets:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Frame simulation loop
  useFrame((_state, delta) => {
    if (instances.length === 0) return;
    const clampedDelta = Math.min(delta, 0.05);
    const runtimes = runtimeRef.current;

    // Track host position from building stops or hub
    if (focusedBuildingIndex !== null && focusedBuildingIndex >= 0 && focusedBuildingIndex < 5) {
      const px = BUILDING_PROXIES[focusedBuildingIndex].xPos - 1.8;
      hostPosRef.current.set(px, RAW_BOUNDS.pavementY, -10.0);
    } else if (scrollProgress >= 0.92) {
      hostPosRef.current.set(38.8, 0.10, 4.6);
    } else if (scrollProgress < 0.36) {
      hostPosRef.current.set(BUILDING_PROXIES[0].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0);
    } else {
      const t = (scrollProgress - 0.36) / (0.92 - 0.36);
      const startX = BUILDING_PROXIES[0].xPos - 1.8;
      const endX = BUILDING_PROXIES[4].xPos - 1.8;
      hostPosRef.current.set(startX + t * (endX - startX), RAW_BOUNDS.pavementY, -10.0);
    }

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const rt = runtimes[i];
      const cfg = inst.config;

      // ── Distance Culling & Performance LOD ─────────────────────────────────
      const distToCamera = camera.position.distanceTo(inst.root.position);
      const isNearCamera = distToCamera < CULL_DISTANCE;

      if (isNearCamera) {
        inst.mixer.update(clampedDelta);
        inst.shadowMesh.visible = true;
      } else {
        inst.shadowMesh.visible = false;
      }

      // ── State Machine ──────────────────────────────────────────────────────
      rt.stateTimer -= clampedDelta;

      if (rt.state === 'pausing') {
        // Paused on sidewalk
        if (rt.stateTimer <= 0) {
          rt.state = 'walking';
          rt.stateTimer = 8.0 + Math.random() * 12.0;

          if (inst.standAction && inst.walkAction) {
            inst.standAction.crossFadeTo(inst.walkAction, 0.3, true);
            inst.walkAction.reset().play();
          } else {
            inst.walkAction.setEffectiveTimeScale(cfg.speedMult);
          }
        }
      } else if (rt.state === 'turning') {
        // Smoothly rotate 180 degrees at lane ends
        let diff = rt.targetYaw - rt.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rt.yaw += diff * 4.0 * clampedDelta;

        if (Math.abs(diff) < 0.06) {
          rt.yaw = rt.targetYaw;
          rt.state = 'walking';
          rt.stateTimer = 8.0 + Math.random() * 12.0;
        }
      } else {
        // ── Walking: Move along pavement lane with stride-matched speed ───────
        const velocity = BASE_WALK_SPEED * cfg.speedMult;
        rt.x += velocity * rt.dir * clampedDelta;

        // Check lane boundaries (loop by turning around)
        const hitEnd =
          (rt.dir > 0 && rt.x > LANE_X_MAX) ||
          (rt.dir < 0 && rt.x < LANE_X_MIN);

        if (hitEnd) {
          rt.dir = (rt.dir * -1) as 1 | -1;
          rt.targetYaw = rt.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          rt.state = 'turning';
          rt.stateTimer = 0;

          // Sync pair partner if walking together
          if (cfg.pairWithId !== null && runtimes[cfg.pairWithId]) {
            const partnerRt = runtimes[cfg.pairWithId];
            partnerRt.dir = rt.dir;
            partnerRt.targetYaw = rt.targetYaw;
            partnerRt.state = 'turning';
            partnerRt.stateTimer = 0;
          }
        }

        // Random pause (2-4 seconds)
        if (rt.stateTimer <= 0 && Math.random() < 0.006) {
          rt.state = 'pausing';
          rt.stateTimer = 2.0 + Math.random() * 2.0;

          if (inst.standAction && inst.walkAction) {
            inst.walkAction.crossFadeTo(inst.standAction, 0.3, true);
            inst.standAction.reset().play();
          } else {
            inst.walkAction.setEffectiveTimeScale(0);
          }

          // Sync pair partner
          if (cfg.pairWithId !== null && runtimes[cfg.pairWithId]) {
            const partnerRt = runtimes[cfg.pairWithId];
            const partnerInst = instances[cfg.pairWithId];
            partnerRt.state = 'pausing';
            partnerRt.stateTimer = rt.stateTimer;
            if (partnerInst?.standAction && partnerInst?.walkAction) {
              partnerInst.walkAction.crossFadeTo(partnerInst.standAction, 0.3, true);
              partnerInst.standAction.reset().play();
            } else if (partnerInst?.walkAction) {
              partnerInst.walkAction.setEffectiveTimeScale(0);
            }
          }
        }
      }

      // Smooth yaw interpolation towards target
      let yawDiff = rt.targetYaw - rt.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      rt.yaw += yawDiff * 3.5 * clampedDelta;

      // ── Collision Avoidance & Clearances ──────────────────────────────────
      // 1. Separation between pedestrians (minimum 1.0m spacing)
      for (let j = 0; j < instances.length; j++) {
        if (j === i) continue;
        if (cfg.pairWithId === j) continue; // Companions walk side-by-side
        const otherRt = runtimes[j];
        const dx = rt.x - otherRt.x;
        const dz = rt.z - otherRt.z;
        const dist = Math.hypot(dx, dz);
        if (dist < MIN_PERSON_SPACING && dist > 0.01) {
          const push = (MIN_PERSON_SPACING - dist) * 0.4 * clampedDelta * 60;
          rt.x += (dx / dist) * push;
        }
      }

      // 2. Separation from Host Character
      const hDx = rt.x - hostPosRef.current.x;
      const hDz = rt.z - hostPosRef.current.z;
      const hDist = Math.hypot(hDx, hDz);
      if (hDist < HOST_AVOID_RADIUS && hDist > 0.01) {
        const push = (HOST_AVOID_RADIUS - hDist) * 0.5 * clampedDelta * 60;
        rt.x += (hDx / hDist) * push;
      }

      // 3. Lane Z boundaries (guarantees >= 2.5m clearance from building facades)
      if (cfg.laneSide === 'north') {
        rt.z = THREE.MathUtils.clamp(rt.z, -10.8, -8.4);
      } else {
        rt.z = THREE.MathUtils.clamp(rt.z, 7.4, 10.2);
      }

      // Apply root translation and rotation
      inst.root.position.set(rt.x, cfg.pavementY, rt.z);
      inst.root.rotation.y = rt.yaw;
    }
  });

  return (
    <group>
      {instances.map((inst, idx) => (
        <primitive key={idx} object={inst.root} />
      ))}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  OPTIONAL STATIC EXTRAS FROM characters.opt.glb (Rigify)
//  Subtle procedural breathing in code - NO retargeting or Mixamo clips
// ═════════════════════════════════════════════════════════════════════════════
interface StaticExtraDef {
  modelKey: string;
  position: [number, number, number];
  rotationY: number;
  height: number;
  phaseOffset: number;
}

const STATIC_EXTRAS: StaticExtraDef[] = [
  // Storefront 101 Entrance Doorway (About Me)
  {
    modelKey: '011', // Female Customer
    position: [BUILDING_PROXIES[0].xPos + 1.6, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 0.45],
    rotationY: 0,
    height: 1.70,
    phaseOffset: 0.0,
  },
  // Storefront 105 Near Lamppost (Projects)
  {
    modelKey: '004', // Male in Coat
    position: [BUILDING_PROXIES[2].xPos - 3.2, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 1.15],
    rotationY: 0.35,
    height: 1.78,
    phaseOffset: 1.8,
  },
  // Storefront 109 Entrance Porch (Contact)
  {
    modelKey: '002', // Female Formal
    position: [BUILDING_PROXIES[4].xPos + 2.0, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 0.45],
    rotationY: -0.2,
    height: 1.68,
    phaseOffset: 3.2,
  },
  // South Promenade Park Bench / Trees
  {
    modelKey: '010', // Casual Male
    position: [12.0, 0.10, 9.8],
    rotationY: Math.PI,
    height: 1.75,
    phaseOffset: 4.5,
  },
];

const StaticStorefrontExtras: React.FC = () => {
  const gltf = useGLTF('/models/characters.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const spineRefs = useRef<(THREE.Bone | null)[]>([]);

  const extraRoots = useMemo(() => {
    return STATIC_EXTRAS.map((extra, idx) => {
      const fullClone = SkeletonUtils.clone(gltf.scene);

      // Keep only target metarig
      const otherRigs: THREE.Object3D[] = [];
      fullClone.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
          if (!obj.name.includes(extra.modelKey)) {
            otherRigs.push(obj);
          }
        }
      });
      otherRigs.forEach((r) => r.parent?.remove(r));

      // Measure height and scale
      const box = new THREE.Box3().setFromObject(fullClone);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const rawH = box.max.y - box.min.y || 1.75;
      const scale = extra.height / rawH;

      fullClone.position.set(-center.x, -box.min.y, -center.z);

      // Find spine bone for subtle procedural idle breathing
      let spine: THREE.Bone | null = null;
      fullClone.traverse((o) => {
        if ((o as THREE.Bone).isBone) {
          const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (n === 'spine' || n.includes('spine001')) {
            if (!spine) spine = o as THREE.Bone;
          }
        }
      });
      spineRefs.current[idx] = spine;

      // Contact shadow disc
      const shadow = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.42, 20),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.012;

      const container = new THREE.Group();
      container.scale.setScalar(scale);
      container.add(fullClone);

      const root = new THREE.Group();
      root.position.set(...extra.position);
      root.rotation.y = extra.rotationY;
      root.add(container);
      root.add(shadow);

      return root;
    });
  }, [gltf]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    for (let i = 0; i < spineRefs.current.length; i++) {
      const spine = spineRefs.current[i];
      if (spine) {
        const offset = STATIC_EXTRAS[i].phaseOffset;
        spine.rotation.x = Math.sin(elapsed * 1.5 + offset) * 0.02;
        spine.rotation.y = Math.sin(elapsed * 0.7 + offset) * 0.015;
      }
    }
  });

  return (
    <group>
      {extraRoots.map((root, idx) => (
        <primitive key={idx} object={root} />
      ))}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  EXPORTED COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export const PedestrianGroup: React.FC = () => {
  return (
    <group>
      {/* 8 Diversified Mixamo Walkers with independent materials & AnimationMixers */}
      <MixamoWalkingPedestrians />

      {/* 4 Static Storefront Extras with subtle procedural idle breathing */}
      <StaticStorefrontExtras />
    </group>
  );
};
