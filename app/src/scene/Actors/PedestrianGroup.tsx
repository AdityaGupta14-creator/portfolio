import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RAW_BOUNDS, BUILDING_PROXIES } from '../../data/buildings';
import { useAppStore } from '../../store/useAppStore';
import {
  PEDESTRIAN_STRIDE,
  calculateWalkTimeScale,
  AVOIDANCE_CONFIG,
  SIDEWALK_LANES,
  PEDESTRIAN_CONFIGS,
  SidewalkLaneDef,
  PedestrianInitConfig,
} from '../../data/pedestrianConfig';
import {
  CROSSWALK_ZONES,
  CrosswalkZone,
  crosswalkManager,
} from '../../data/crosswalks';

// Pre-configure MeshoptDecoder for static extras GLTF loading
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

type PedestrianBehaviorState =
  | 'walking'
  | 'avoiding'
  | 'following'
  | 'turning'
  | 'pausing'
  | 'approach_kerb'
  | 'wait'
  | 'cross';

interface WalkerRuntime {
  id: number;
  config: PedestrianInitConfig;
  lane: SidewalkLaneDef;
  x: number;
  y: number;
  z: number;
  baseZ: number;
  lateralOffset: number;       // current lateral offset from lane centerline
  targetLateralOffset: number; // desired lateral offset for avoidance
  yaw: number;                 // current heading in radians
  targetYaw: number;           // desired heading in radians
  dir: 1 | -1;                 // travel direction along X (+1 or -1)
  currentSpeed: number;        // current speed (m/s)
  targetSpeed: number;         // target speed (m/s)
  state: PedestrianBehaviorState;
  pauseTimer: number;          // countdown timer for random pause
  threatId: number | string | null; // ID of obstacle triggering avoidance

  // Crosswalk crossing behavior
  targetCrosswalk: CrosswalkZone | null;
  crossingDirZ: 1 | -1; // 1 = North to South (+Z), -1 = South to North (-Z)
  waitTimer: number;
  gapCheckInfo: {
    safe: boolean;
    threatCarId: number | null;
    threatCarDist: number;
    safeDist: number;
  } | null;
}

interface PedestrianInstance {
  config: PedestrianInitConfig;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction;
  standAction?: THREE.AnimationAction;
  shadowMesh: THREE.Mesh;
}

/**
 * Applies unique cloned PBR materials to the pedestrian mesh
 */
function applyClonedMaterials(avatar: THREE.Object3D, config: PedestrianInitConfig) {
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
//  MIXAMO WALKING PEDESTRIANS WITH ROAD CROSSING & DYNAMIC CAR AVOIDANCE
// ═════════════════════════════════════════════════════════════════════════════
const MixamoWalkingPedestrians: React.FC = () => {
  const { camera } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const isPedestrianDebug = useAppStore((s) => s.isPedestrianDebug);

  const [instances, setInstances] = useState<PedestrianInstance[]>([]);
  const [, setDebugRenderTrigger] = useState<number>(0);

  // Runtime physical state for each pedestrian
  const runtimesRef = useRef<WalkerRuntime[]>(
    PEDESTRIAN_CONFIGS.map((cfg) => {
      const lane = SIDEWALK_LANES[cfg.laneKey];

      // Pedestrians 2 and 4 are designated crossers for Crosswalk 2 (Projects, X = 13.0)
      let initialCrosswalk: CrosswalkZone | null = null;
      if (cfg.id === 2 || cfg.id === 4) {
        initialCrosswalk = CROSSWALK_ZONES[1]; // X = 13.0
      } else if (cfg.id === 1) {
        initialCrosswalk = CROSSWALK_ZONES[0]; // X = -39.0
      }

      return {
        id: cfg.id,
        config: cfg,
        lane,
        x: cfg.initialX,
        y: lane.pavementY,
        z: lane.zCenter,
        baseZ: lane.zCenter,
        lateralOffset: 0,
        targetLateralOffset: 0,
        yaw: lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
        targetYaw: lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
        dir: lane.direction,
        currentSpeed: cfg.cruiseSpeed,
        targetSpeed: cfg.cruiseSpeed,
        state: 'walking',
        pauseTimer: 7.0 + Math.random() * 10.0,
        threatId: null,
        targetCrosswalk: initialCrosswalk,
        crossingDirZ: lane.side === 'north' ? 1 : -1,
        waitTimer: 0,
        gapCheckInfo: null,
      };
    })
  );

  const hostPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-40.27, RAW_BOUNDS.pavementY, -10.0));
  const debugTickRef = useRef<number>(0);

  // Load Walking.fbx and optional Waving.fbx once, then clone independently
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

        const rawBox = new THREE.Box3().setFromObject(walkingFbx);
        const rawHeight = rawBox.max.y - rawBox.min.y || PEDESTRIAN_STRIDE.rawHeightCm;
        const baseScaleFactor = PEDESTRIAN_STRIDE.targetHeightM / rawHeight;

        // Strip forward root motion from hips track
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

        const spawned: PedestrianInstance[] = PEDESTRIAN_CONFIGS.map((config) => {
          const lane = SIDEWALK_LANES[config.laneKey];
          const clonedAvatar = SkeletonUtils.clone(walkingFbx) as THREE.Group;

          const totalScale = baseScaleFactor * config.heightMult;
          clonedAvatar.scale.setScalar(totalScale);

          const scaledBox = new THREE.Box3().setFromObject(clonedAvatar);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);
          clonedAvatar.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

          applyClonedMaterials(clonedAvatar, config);

          const mixer = new THREE.AnimationMixer(clonedAvatar);
          const walkAction = mixer.clipAction(walkClip);
          walkAction.setLoop(THREE.LoopRepeat, Infinity);

          const initialTimeScale = calculateWalkTimeScale(config.cruiseSpeed, config.heightMult);
          walkAction.setEffectiveTimeScale(initialTimeScale);

          walkAction.time = Math.random() * walkClip.duration;
          walkAction.play();

          let standAction: THREE.AnimationAction | undefined = undefined;
          if (standClip) {
            standAction = mixer.clipAction(standClip);
            standAction.setLoop(THREE.LoopOnce, 1);
            standAction.clampWhenFinished = true;
          }

          mixer.update(0.016);

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
          root.position.set(config.initialX, lane.pavementY, lane.zCenter);
          root.rotation.y = lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
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
    const runtimes = runtimesRef.current;
    if (typeof window !== 'undefined') {
      (window as any).__pedRuntimes = runtimes;
      (window as any).__crosswalkManager = crosswalkManager;
    }

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

    const hostPos = hostPosRef.current;

    // ── Update Pedestrian State Machine ──────────────────────────────────────
    for (let i = 0; i < instances.length; i++) {
      const rt = runtimes[i];
      const cfg = rt.config;
      const lane = rt.lane;

      // ── STATE 1: APPROACH_KERB ─────────────────────────────────────────────
      if (rt.state === 'approach_kerb') {
        const cw = rt.targetCrosswalk!;
        const waitingPoint =
          rt.crossingDirZ > 0 ? cw.northWaitingPoint : cw.southWaitingPoint;

        // Move toward kerb waiting point
        const dx = waitingPoint.x - rt.x;
        const dz = waitingPoint.z - rt.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.15) {
          const moveStep = Math.min(dist, cfg.cruiseSpeed * 0.9 * clampedDelta);
          rt.x += (dx / dist) * moveStep;
          rt.z += (dz / dist) * moveStep;
          rt.targetSpeed = cfg.cruiseSpeed * 0.85;

          // Face the target waiting point
          rt.targetYaw = Math.atan2(dx, dz);
        } else {
          // Arrived at kerb waiting point: transition to WAIT
          rt.x = waitingPoint.x;
          rt.z = waitingPoint.z;
          rt.state = 'wait';
          rt.targetSpeed = 0;
          rt.targetYaw = waitingPoint.facingYaw; // Face the road directly!
          rt.waitTimer = 0;
        }
      }

      // ── STATE 2: WAIT (Stand at kerb and evaluate oncoming cars) ────────────
      else if (rt.state === 'wait') {
        const cw = rt.targetCrosswalk!;
        const waitingPoint =
          rt.crossingDirZ > 0 ? cw.northWaitingPoint : cw.southWaitingPoint;

        rt.targetSpeed = 0;
        rt.targetYaw = waitingPoint.facingYaw; // Ensure facing the road

        // Evaluate oncoming car safe gap
        const gapCheck = crosswalkManager.isCrosswalkGapSafe(cw);
        rt.gapCheckInfo = {
          safe: gapCheck.safe,
          threatCarId: gapCheck.threatCar ? gapCheck.threatCar.id : null,
          threatCarDist: gapCheck.distance,
          safeDist: gapCheck.safeDistance,
        };

        if (gapCheck.safe) {
          // Gap is safe! Wait a brief 0.6s looking both ways then step out
          rt.waitTimer += clampedDelta;
          if (rt.waitTimer >= 0.6) {
            rt.state = 'cross';
            // Register crossing with crosswalk manager so cars brake!
            crosswalkManager.setPedestrianCrossing(
              cw.id,
              rt.id,
              rt.crossingDirZ > 0 ? 'north' : 'south'
            );
          }
        } else {
          // Car is passing or approaching within safe gap: stay put!
          rt.waitTimer = 0;
        }
      }

      // ── STATE 3: CROSS (Walk straight across at 1.6 m/s) ────────────────────
      else if (rt.state === 'cross') {
        const cw = rt.targetCrosswalk!;
        const crossSpeed = 1.60; // 1.6 m/s per requirement
        rt.targetSpeed = crossSpeed;
        rt.targetYaw = rt.crossingDirZ > 0 ? Math.PI : 0; // Straight line across road

        // Advance straight along Z
        rt.z += crossSpeed * rt.crossingDirZ * clampedDelta;

        // Smoothly adjust elevation from sidewalk (0.16/0.10) to road asphalt (-0.08)
        if (rt.z > -5.8 && rt.z < 4.8) {
          rt.y = -0.08; // Walking on asphalt roadway
        } else if (rt.crossingDirZ > 0) {
          // North to South: transition near south curb
          rt.y = rt.z >= 4.8 ? 0.10 : 0.16;
        } else {
          // South to North: transition near north curb
          rt.y = rt.z <= -5.8 ? 0.16 : 0.10;
        }

        // Keep registered with crosswalk manager while crossing
        crosswalkManager.setPedestrianCrossing(
          cw.id,
          rt.id,
          rt.crossingDirZ > 0 ? 'north' : 'south'
        );

        // Check if finished crossing (reached opposite sidewalk kerb)
        const destinationKerbZ = rt.crossingDirZ > 0 ? 5.5 : -6.6;
        const reachedOppositeKerb =
          (rt.crossingDirZ > 0 && rt.z >= destinationKerbZ) ||
          (rt.crossingDirZ < 0 && rt.z <= destinationKerbZ);

        if (reachedOppositeKerb) {
          // Free crosswalk for cars (triggers 1s clear countdown)
          crosswalkManager.setPedestrianCrossing(cw.id, null, null);

          // Assign new sidewalk lane on the destination side
          const newLaneKey =
            rt.crossingDirZ > 0 ? 'south-park' : 'north-building';
          rt.lane = SIDEWALK_LANES[newLaneKey];
          rt.baseZ = rt.lane.zCenter;
          rt.dir = rt.lane.direction;
          rt.targetYaw = rt.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          rt.y = rt.lane.pavementY;
          rt.state = 'walking';
          rt.targetSpeed = cfg.cruiseSpeed;
          rt.targetLateralOffset = 0;
          rt.targetCrosswalk = null; // Will pick next crosswalk after walking
          rt.gapCheckInfo = null;
        }
      }

      // ── STATE 4: TURNING AT ENDS ───────────────────────────────────────────
      else if (rt.state === 'turning') {
        let diff = rt.targetYaw - rt.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurnStep = AVOIDANCE_CONFIG.turnRate * clampedDelta;
        rt.yaw += Math.sign(diff) * Math.min(Math.abs(diff), maxTurnStep);

        rt.targetSpeed = cfg.cruiseSpeed * 0.45;
        rt.targetLateralOffset = 0;

        if (Math.abs(diff) < 0.06) {
          rt.yaw = rt.targetYaw;
          rt.state = 'walking';
          rt.targetSpeed = cfg.cruiseSpeed;
        }
      }

      // ── STATE 5: PAUSING ───────────────────────────────────────────────────
      else if (rt.state === 'pausing') {
        rt.pauseTimer -= clampedDelta;
        rt.targetSpeed = 0;
        if (rt.pauseTimer <= 0) {
          rt.state = 'walking';
          rt.targetSpeed = cfg.cruiseSpeed;
          rt.pauseTimer = 10.0 + Math.random() * 15.0;
        }
      }

      // ── STATE 6: NORMAL SIDEWALK WALKING & AVOIDANCE ───────────────────────
      else {
        // Check if approaching a crosswalk
        if (rt.targetCrosswalk) {
          const cw = rt.targetCrosswalk;
          const distToCwX = Math.abs(rt.x - cw.centerX);
          if (distToCwX < 4.0) {
            // Transition to APPROACH_KERB!
            rt.state = 'approach_kerb';
            continue;
          }
        }

        // Boundary check at lane ends
        const hitEnd =
          (rt.dir > 0 && rt.x >= lane.xMax) ||
          (rt.dir < 0 && rt.x <= lane.xMin);

        if (hitEnd) {
          rt.dir = (rt.dir * -1) as 1 | -1;
          rt.targetYaw = rt.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          rt.state = 'turning';
          rt.targetLateralOffset = 0;
          continue;
        }

        // Look-ahead avoidance scanning
        let closestThreatDist = Infinity;
        let threatLateralDiff = 0;
        let threatType: 'none' | 'oncoming' | 'leader' | 'host' = 'none';
        let threatSpeed = cfg.cruiseSpeed;
        let threatId: number | string | null = null;

        for (let j = 0; j < instances.length; j++) {
          if (j === i) continue;
          const other = runtimes[j];
          if (other.state === 'cross' || other.state === 'wait') continue;

          const dx = (other.x - rt.x) * rt.dir;
          const dz = other.z - rt.z;

          if (
            dx > 0 &&
            dx <= AVOIDANCE_CONFIG.lookAheadDistance &&
            Math.abs(dz) <= AVOIDANCE_CONFIG.avoidTriggerDistance
          ) {
            if (dx < closestThreatDist) {
              closestThreatDist = dx;
              threatLateralDiff = dz;
              threatId = other.id;
              threatSpeed = other.currentSpeed;
              threatType = other.dir !== rt.dir ? 'oncoming' : 'leader';
            }
          }
        }

        const hostDx = (hostPos.x - rt.x) * rt.dir;
        const hostDz = hostPos.z - rt.z;
        if (
          hostDx > 0 &&
          hostDx <= AVOIDANCE_CONFIG.lookAheadDistance &&
          Math.abs(hostDz) <= AVOIDANCE_CONFIG.avoidTriggerDistance
        ) {
          if (hostDx < closestThreatDist) {
            closestThreatDist = hostDx;
            threatLateralDiff = hostDz;
            threatType = 'host';
            threatSpeed = 0;
            threatId = 'host';
          }
        }

        rt.threatId = threatId;

        if (threatType === 'none') {
          rt.targetLateralOffset = 0;
          rt.targetSpeed = cfg.cruiseSpeed;
          rt.state = 'walking';
        } else if (threatType === 'oncoming' || threatType === 'host') {
          rt.state = 'avoiding';
          const steerSign = threatLateralDiff >= 0 ? -1 : 1;
          let desiredOffset = steerSign * AVOIDANCE_CONFIG.maxLateralOffset;
          const candidateZ = rt.baseZ + desiredOffset;
          if (candidateZ < lane.minZ) {
            desiredOffset = lane.minZ - rt.baseZ;
          } else if (candidateZ > lane.maxZ) {
            desiredOffset = lane.maxZ - rt.baseZ;
          }
          rt.targetLateralOffset = desiredOffset;

          if (closestThreatDist < AVOIDANCE_CONFIG.minSafeDistance) {
            rt.targetSpeed = 0;
          } else {
            rt.targetSpeed = cfg.cruiseSpeed * 0.92;
          }
        } else if (threatType === 'leader') {
          if (threatSpeed < cfg.cruiseSpeed) {
            const overtakeSign = threatLateralDiff >= 0 ? -1 : 1;
            const candidateOffset = overtakeSign * AVOIDANCE_CONFIG.maxLateralOffset;
            const candidateZ = rt.baseZ + candidateOffset;
            const isInBounds = candidateZ >= lane.minZ && candidateZ <= lane.maxZ;

            if (isInBounds && closestThreatDist > 1.3) {
              rt.state = 'avoiding';
              rt.targetLateralOffset = candidateOffset;
              rt.targetSpeed = cfg.cruiseSpeed;
            } else {
              rt.state = 'following';
              rt.targetLateralOffset = 0;
              if (closestThreatDist < AVOIDANCE_CONFIG.minSafeDistance) {
                rt.targetSpeed = 0;
              } else {
                const bufferFactor = Math.max(
                  0,
                  Math.min(1, (closestThreatDist - AVOIDANCE_CONFIG.minSafeDistance) / 1.0)
                );
                rt.targetSpeed = Math.min(cfg.cruiseSpeed, threatSpeed * bufferFactor);
              }
            }
          } else {
            rt.targetSpeed = cfg.cruiseSpeed;
            rt.targetLateralOffset = 0;
            rt.state = 'walking';
          }
        }

        // Apply smooth lateral steering
        const offsetDiff = rt.targetLateralOffset - rt.lateralOffset;
        const maxDeltaOffset = AVOIDANCE_CONFIG.lateralSteerRate * clampedDelta;
        rt.lateralOffset += Math.sign(offsetDiff) * Math.min(Math.abs(offsetDiff), maxDeltaOffset);

        // Advance along sidewalk X
        rt.x += rt.currentSpeed * rt.dir * clampedDelta;
        rt.z = THREE.MathUtils.clamp(rt.baseZ + rt.lateralOffset, lane.minZ, lane.maxZ);
        rt.y = lane.pavementY;

        let steerAngle = 0;
        if (rt.state === 'avoiding' && rt.currentSpeed > 0.15 && Math.abs(offsetDiff) > 0.05) {
          const latVel = (Math.sign(offsetDiff) * Math.min(Math.abs(offsetDiff), maxDeltaOffset)) / clampedDelta;
          steerAngle = Math.atan2(latVel, rt.currentSpeed * rt.dir) * 0.35;
        }

        const baseYaw = rt.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        rt.targetYaw = baseYaw + steerAngle;
      }

      // ── Kinematic Speed & Heading Updates ──────────────────────────────────
      const speedDiff = rt.targetSpeed - rt.currentSpeed;
      const maxDeltaSpeed = AVOIDANCE_CONFIG.maxAcceleration * clampedDelta;
      rt.currentSpeed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), maxDeltaSpeed);
      rt.currentSpeed = Math.max(0, rt.currentSpeed);

      let diff = rt.targetYaw - rt.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rt.yaw += Math.sign(diff) * Math.min(Math.abs(diff), AVOIDANCE_CONFIG.turnRate * clampedDelta);
    }

    // ── Phase 2: Matrix Updates & Animation Synchronization ──────────────────
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const rt = runtimes[i];
      const cfg = rt.config;

      const distToCamera = camera.position.distanceTo(inst.root.position);
      const isNearCamera = distToCamera < 85;

      if (isNearCamera) {
        const effectiveTimeScale = calculateWalkTimeScale(rt.currentSpeed, cfg.heightMult);
        inst.walkAction.setEffectiveTimeScale(effectiveTimeScale);

        if (rt.currentSpeed <= 0.04) {
          if (inst.standAction && inst.walkAction.isRunning()) {
            inst.walkAction.crossFadeTo(inst.standAction, 0.25, true);
            inst.standAction.reset().play();
          }
        } else {
          if (inst.standAction && inst.standAction.isRunning()) {
            inst.standAction.crossFadeTo(inst.walkAction, 0.25, true);
            inst.walkAction.play();
          }
        }

        inst.mixer.update(clampedDelta);
        inst.shadowMesh.visible = true;
      } else {
        inst.shadowMesh.visible = false;
      }

      inst.root.position.set(rt.x, rt.y, rt.z);
      inst.root.rotation.y = rt.yaw;
    }

    // Trigger debug overlay re-render
    if (isPedestrianDebug) {
      debugTickRef.current += clampedDelta;
      if (debugTickRef.current > 0.06) {
        debugTickRef.current = 0;
        setDebugRenderTrigger((prev) => prev + 1);
      }
    }
  });

  return (
    <group>
      {instances.map((inst, idx) => (
        <primitive key={idx} object={inst.root} />
      ))}

      {/* ── Debug Overlay (Press P): Crosswalks, Gap Checks, States ────────── */}
      {isPedestrianDebug && (
        <PedestrianDebugOverlay runtimes={runtimesRef.current} />
      )}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  DEBUG OVERLAY (PRESS P)
//  Shows crosswalk zones, kerb waiting points, gap checks, radius & state
// ═════════════════════════════════════════════════════════════════════════════
interface DebugOverlayProps {
  runtimes: WalkerRuntime[];
}

function createDebugLabelTexture(rt: WalkerRuntime): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const isThreat = rt.threatId !== null;
  const isWait = rt.state === 'wait';
  const isCross = rt.state === 'cross';

  // Card background styling
  if (isWait) {
    ctx.fillStyle = rt.gapCheckInfo?.safe
      ? 'rgba(16, 185, 129, 0.92)' // Green when safe
      : 'rgba(217, 119, 6, 0.92)';  // Amber when waiting for car
  } else if (isCross) {
    ctx.fillStyle = 'rgba(67, 56, 202, 0.92)'; // Indigo when crossing road
  } else if (isThreat) {
    ctx.fillStyle = 'rgba(185, 28, 28, 0.92)'; // Red on obstacle
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';  // Slate default
  }

  ctx.strokeStyle = isWait ? '#fef08a' : (isCross ? '#a5b4fc' : '#38bdf8');
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 20);
  ctx.fill();
  ctx.stroke();

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`PED #${rt.id} • [${rt.state.toUpperCase()}]`, canvas.width / 2, 48);

  // Body metrics
  ctx.fillStyle = '#f8fafc';
  ctx.font = '24px monospace';

  if (isWait) {
    const gap = rt.gapCheckInfo;
    ctx.fillText(`Kerb Wait: ${gap?.safe ? 'GAP SAFE' : 'CAR PASSING'}`, canvas.width / 2, 92);
    if (gap && !gap.safe) {
      ctx.fillStyle = '#fee2e2';
      ctx.fillText(`Car #${gap.threatCarId} at ${gap.threatCarDist.toFixed(1)}m < safe ${gap.safeDist.toFixed(1)}m`, canvas.width / 2, 136);
    } else {
      ctx.fillStyle = '#dcfce7';
      ctx.fillText(`Ready to cross road -> 1.6 m/s`, canvas.width / 2, 136);
    }
  } else if (isCross) {
    ctx.fillText(`Crossing Road: 1.60 m/s`, canvas.width / 2, 92);
    ctx.fillText(`Target: ${rt.crossingDirZ > 0 ? 'South Promenade' : 'North Sidewalk'}`, canvas.width / 2, 136);
  } else {
    ctx.fillText(`v: ${rt.currentSpeed.toFixed(2)} m/s (tgt: ${rt.targetSpeed.toFixed(2)})`, canvas.width / 2, 92);
    ctx.fillText(`Offset: ${rt.lateralOffset.toFixed(2)}m (tgt: ${rt.targetLateralOffset.toFixed(2)})`, canvas.width / 2, 136);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px monospace';
  ctx.fillText(`${rt.lane.name}`, canvas.width / 2, 182);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const PedestrianDebugOverlay: React.FC<DebugOverlayProps> = ({ runtimes }) => {
  // Lane guidelines
  const laneLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    return Object.values(SIDEWALK_LANES).map((lane) => {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lane.xMin, lane.pavementY + 0.03, lane.zCenter),
        new THREE.Vector3(lane.xMax, lane.pavementY + 0.03, lane.zCenter),
      ]);
      return new THREE.Line(geom, mat);
    });
  }, []);

  // Crosswalk zone boundary outlines
  const crosswalkBoxes = useMemo(() => {
    return CROSSWALK_ZONES.map((cw) => {
      // 3D box outline on asphalt
      const y = -0.06;
      const pts = [
        new THREE.Vector3(cw.xMin, y, cw.zRoadMin),
        new THREE.Vector3(cw.xMax, y, cw.zRoadMin),
        new THREE.Vector3(cw.xMax, y, cw.zRoadMax),
        new THREE.Vector3(cw.xMin, y, cw.zRoadMax),
        new THREE.Vector3(cw.xMin, y, cw.zRoadMin),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
      return { cw, line: new THREE.Line(geom, mat) };
    });
  }, []);

  return (
    <group>
      {/* 1. Lane Center Guide Lines */}
      {laneLines.map((lineObj, idx) => (
        <primitive key={idx} object={lineObj} />
      ))}

      {/* 2. Crosswalk Zones & Kerb Waiting Points */}
      {crosswalkBoxes.map(({ cw, line }, idx) => {
        const state = crosswalkManager.getCrosswalkState(cw.id);
        const isOccupied = state.isOccupied || state.clearCountdown > 0;
        const color = isOccupied ? 0xef4444 : 0x10b981;
        (line.material as THREE.LineBasicMaterial).color.setHex(color);

        return (
          <group key={idx}>
            <primitive object={line} />

            {/* North Waiting Point Disc */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[cw.northWaitingPoint.x, cw.northWaitingPoint.y + 0.03, cw.northWaitingPoint.z]}
            >
              <ringGeometry args={[0.35, 0.45, 24]} />
              <meshBasicMaterial color={isOccupied ? '#ef4444' : '#10b981'} side={THREE.DoubleSide} />
            </mesh>

            {/* South Waiting Point Disc */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[cw.southWaitingPoint.x, cw.southWaitingPoint.y + 0.03, cw.southWaitingPoint.z]}
            >
              <ringGeometry args={[0.35, 0.45, 24]} />
              <meshBasicMaterial color={isOccupied ? '#ef4444' : '#10b981'} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}

      {/* 3. Per-Pedestrian Dynamic Annotations & Gap Checks */}
      {runtimes.map((rt) => {
        const isTriggered = rt.threatId !== null || rt.state === 'wait';
        const lookAheadLength = AVOIDANCE_CONFIG.lookAheadDistance;
        const startPt = new THREE.Vector3(rt.x, rt.y + 0.12, rt.z);
        const endPt = new THREE.Vector3(
          rt.x + rt.dir * lookAheadLength,
          rt.y + 0.12,
          rt.z + (rt.targetLateralOffset - rt.lateralOffset) * 0.5
        );
        const lineMat = new THREE.LineBasicMaterial({
          color: isTriggered ? 0xf59e0b : 0x10b981,
          linewidth: 3,
          depthTest: false,
        });
        const lineGeom = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
        const lookAheadLine = new THREE.Line(lineGeom, lineMat);
        const labelTexture = createDebugLabelTexture(rt);

        // Gap check line to threatening car (if waiting at kerb)
        let gapLine: THREE.Line | null = null;
        if (rt.state === 'wait' && rt.gapCheckInfo && !rt.gapCheckInfo.safe) {
          const cars = crosswalkManager.getCars();
          const threatCar = cars.find((c) => c.id === rt.gapCheckInfo?.threatCarId);
          if (threatCar) {
            const carPt = new THREE.Vector3(threatCar.x, 0.8, threatCar.z);
            const gapGeom = new THREE.BufferGeometry().setFromPoints([startPt, carPt]);
            const gapMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3, depthTest: false });
            gapLine = new THREE.Line(gapGeom, gapMat);
          }
        }

        return (
          <group key={rt.id}>
            {/* 0.35m Radius Footprint Ring */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[rt.x, rt.y + 0.025, rt.z]}
            >
              <ringGeometry args={[0.33, 0.35, 32]} />
              <meshBasicMaterial
                color={rt.state === 'wait' ? '#f59e0b' : (rt.state === 'cross' ? '#818cf8' : (isTriggered ? '#ef4444' : '#06b6d4'))}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Look-Ahead Vector Line (while walking) */}
            {rt.state !== 'wait' && <primitive object={lookAheadLine} />}

            {/* Gap Check Line to Oncoming Car (while waiting at kerb) */}
            {gapLine && <primitive object={gapLine} />}

            {/* Floating State & Telemetry Sprite Billboard */}
            <sprite
              position={[rt.x, rt.y + 2.3, rt.z]}
              scale={[2.5, 1.05, 1.0]}
            >
              <spriteMaterial
                map={labelTexture}
                transparent
                depthTest={false}
              />
            </sprite>
          </group>
        );
      })}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  STATIC EXTRAS FROM characters.opt.glb (Rigify)
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

      const otherRigs: THREE.Object3D[] = [];
      fullClone.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().startsWith('metarig')) {
          if (!obj.name.includes(extra.modelKey)) {
            otherRigs.push(obj);
          }
        }
      });
      otherRigs.forEach((r) => r.parent?.remove(r));

      const box = new THREE.Box3().setFromObject(fullClone);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const rawH = box.max.y - box.min.y || 1.75;
      const scale = extra.height / rawH;

      fullClone.position.set(-center.x, -box.min.y, -center.z);

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
      {/* 8 Diversified Mixamo Walkers with independent materials, lanes & avoidance */}
      <MixamoWalkingPedestrians />

      {/* 4 Static Storefront Extras with subtle procedural idle breathing */}
      <StaticStorefrontExtras />
    </group>
  );
};
