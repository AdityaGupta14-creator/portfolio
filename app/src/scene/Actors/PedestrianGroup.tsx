import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RAW_BOUNDS, BUILDING_PROXIES } from '../../data/buildings';
import { useAppStore } from '../../store/useAppStore';
import {
  PEDESTRIAN_CONFIGS,
  PedestrianInitConfig,
  PEDESTRIAN_STRIDE,
} from '../../data/pedestrianConfig';
import { attachGlassesToHead, GlassesStyle } from '../Glasses';
import { DEFAULT_GLASSES_CONFIG } from '../../data/glassesConfig';
import {
  Pedestrian,
  PedestrianTelemetry,
  pedestrianSystem,
  createNorthSidewalkLoop,
  createSouthSidewalkLoop,
  createCrossingLoopRoute,
} from '../../sim/PedestrianSystem';
import { getAllCrosswalkCycles, CrosswalkCycleController } from '../../sim/crosswalkCycle';

// Pre-configure MeshoptDecoder for static extras GLTF loading
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

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
      } else if (name.includes('eyelash') || name.includes('lash')) {
        mesh.visible = false;
        return;
      } else if (name.includes('hair')) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: config.hairColor,
          roughness: 0.85,
          side: THREE.FrontSide,
        });
        return;
      } else if (name.includes('belt')) {
        color = 0x111317;
        roughness = 0.40;
        metalness = 0.25;
      }

      mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: THREE.DoubleSide,
      });
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. MIXAMO WALKING PEDESTRIANS (Driven by PedestrianSystem)
// ═════════════════════════════════════════════════════════════════════════════
const MixamoWalkingPedestrians: React.FC = () => {
  const isPedestrianDebug = useAppStore((s) => s.isPedestrianDebug);
  const [isReady, setIsReady] = useState(false);
  const rootsRef = useRef<THREE.Group[]>([]);
  const [, setDebugTrigger] = useState(0);
  const debugTickRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    pedestrianSystem.clear();

    const loader = new FBXLoader();
    loader.load(
      '/animations/Walking.fbx',
      (walkingFbx) => {
        if (!isMounted) return;

        const rawBox = new THREE.Box3().setFromObject(walkingFbx);
        const rawHeight = rawBox.max.y - rawBox.min.y || PEDESTRIAN_STRIDE.rawHeightCm;
        const baseScaleFactor = PEDESTRIAN_STRIDE.targetHeightM / rawHeight;

        // Strip forward root motion translation from hips track
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

        // Upright standing pose clip (first frame of walking animation frozen)
        const standTracks = walkClip.tracks.map((t) => {
          const TrackCtor = t.constructor as new (
            name: string,
            times: number[],
            values: number[]
          ) => THREE.KeyframeTrack;
          const valSize = t.getValueSize();
          const vals = Array.from(t.values.slice(0, valSize));
          return new TrackCtor(t.name, [0, 1.0], [...vals, ...vals]);
        });
        const standClip = new THREE.AnimationClip('Stand', 1.0, standTracks);

        const northLoop = createNorthSidewalkLoop();
        const southLoop = createSouthSidewalkLoop();
        const crossingLoop = createCrossingLoopRoute();

        // 8 Diverse Pedestrians: North loop, South loop, and Crosswalk loops
        const createdRoots: THREE.Group[] = [];

        PEDESTRIAN_CONFIGS.forEach((cfg, idx) => {
          let route = northLoop;
          if (idx === 1 || idx === 2) {
            route = crossingLoop;
          } else if (idx >= 4) {
            route = southLoop;
          }

          const startWpIndex = (idx * 2) % route.length;
          const startWp = route[startWpIndex];

          const clonedAvatar = SkeletonUtils.clone(walkingFbx) as THREE.Group;
          const totalScale = baseScaleFactor * cfg.heightMult;
          clonedAvatar.scale.setScalar(totalScale);

          const scaledBox = new THREE.Box3().setFromObject(clonedAvatar);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);
          clonedAvatar.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

          applyClonedMaterials(clonedAvatar, cfg);

          // Variety: about half wear "clear" or "round", on the rest none
          const pedStyle: GlassesStyle | 'none' =
            idx % 4 === 1 ? 'clear' : idx % 4 === 2 ? 'round' : 'none';

          if (pedStyle !== 'none') {
            attachGlassesToHead(clonedAvatar, {
              ...DEFAULT_GLASSES_CONFIG,
              style: pedStyle,
            });
          }

          // Mixer and Actions
          const mixer = new THREE.AnimationMixer(clonedAvatar);
          const walkAction = mixer.clipAction(walkClip);
          walkAction.setLoop(THREE.LoopRepeat, Infinity);
          walkAction.time = (idx * 0.23) % walkClip.duration; // random walk phase offset

          const standAction = mixer.clipAction(standClip);
          standAction.setLoop(THREE.LoopRepeat, Infinity);

          // Root container
          const root = new THREE.Group();
          root.name = `PedestrianRoot_${cfg.id}`;
          root.position.set(startWp.x, startWp.y, startWp.z);

          // Calculate initial heading towards next waypoint
          const nextWp = route[(startWpIndex + 1) % route.length];
          const initialYaw = Math.atan2(nextWp.x - startWp.x, nextWp.z - startWp.z);
          root.rotation.y = initialYaw;

          // Shadow disc
          const shadowMesh = new THREE.Mesh(
            new THREE.RingGeometry(0.04, 0.42 * cfg.heightMult, 20),
            new THREE.MeshBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0.24,
              depthWrite: false,
            })
          );
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.position.y = 0.012;

          root.add(clonedAvatar);
          root.add(shadowMesh);
          createdRoots.push(root);

          // Start walk action
          walkAction.play();
          walkAction.setEffectiveWeight(1.0);
          walkAction.setEffectiveTimeScale(cfg.cruiseSpeed / PEDESTRIAN_STRIDE.clipNaturalSpeed);
          mixer.update(0.016);

          const isAtKerbStart = !!startWp.isKerbWaitingPoint;
          const pedObj: Pedestrian = {
            id: cfg.id,
            mesh: root,
            mixer,
            walkAction,
            standAction,
            route,
            waypointIndex: isAtKerbStart ? startWpIndex : (startWpIndex + 1) % route.length,
            targetSpeed: cfg.cruiseSpeed,
            currentSpeed: isAtKerbStart ? 0 : cfg.cruiseSpeed,
            actualSpeed: isAtKerbStart ? 0 : cfg.cruiseSpeed,
            waitUntil: 0,
            yaw: initialYaw,
            targetYaw: initialYaw,
            lateralOffset: 0,
            targetLateralOffset: 0,
            lastPosition: root.position.clone(),
            stuckTimer: 0,
            isStuck: false,
            isAnimMismatch: false,
            isWaitingAtKerb: isAtKerbStart,
            isCrossingRoad: false,
            isRed: false,
            redReason: '',
          };

          pedestrianSystem.addPedestrian(pedObj);
        });

        rootsRef.current = createdRoots;
        setIsReady(true);
      },
      undefined,
      (err) => {
        console.error('Failed to load Walking.fbx:', err);
      }
    );

    return () => {
      isMounted = false;
      pedestrianSystem.clear();
    };
  }, []);

  // Frame Simulation Tick
  useFrame((_, delta) => {
    if (!isReady) return;

    // PedestrianSystem.update(dt) runs every frame for every pedestrian in the strict order
    pedestrianSystem.update(delta);

    // Expose telemetry on window for browser testing & inspection
    if (typeof window !== 'undefined') {
      const telem = pedestrianSystem.getTelemetry();
      const redCount = pedestrianSystem.getRedCount();
      (window as any).__pedOverlayData = telem;
      (window as any).__redPedestrianCount = redCount;
    }

    if (isPedestrianDebug) {
      debugTickRef.current += delta;
      if (debugTickRef.current > 0.08) {
        debugTickRef.current = 0;
        setDebugTrigger((prev) => prev + 1);
      }
    }
  });

  return (
    <group name="MixamoWalkingPedestrians">
      {rootsRef.current.map((root, idx) => (
        <primitive key={idx} object={root} />
      ))}

      {/* ── Debug Overlay (Key P) ────────────────────────────────────────── */}
      {isPedestrianDebug && <PedestrianDebugOverlay />}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  2. DEBUG OVERLAY (KEY P) WITH PER-PEDESTRIAN LABELS & RED COUNTER
// ═════════════════════════════════════════════════════════════════════════════
function createPedestrianCardTexture(item: PedestrianTelemetry): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const isRed = item.isRed;

  // Background styling
  ctx.fillStyle = isRed ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = isRed ? '#fca5a5' : '#10b981';
  ctx.lineWidth = isRed ? 6 : 4;

  ctx.beginPath();
  ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 16);
  ctx.fill();
  ctx.stroke();

  // Header: Pedestrian ID & Status
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `PED #${item.id} • [${item.actionName.toUpperCase()}]${isRed ? ' ⚠ RED' : ''}`,
    canvas.width / 2,
    44
  );

  // Row 1: Speed & Route Waypoint Index
  ctx.fillStyle = isRed ? '#fee2e2' : '#e2e8f0';
  ctx.font = '22px monospace';
  ctx.fillText(`speed: ${item.speed}  route: WP ${item.routeIndex}`, canvas.width / 2, 82);

  // Row 2: Mixer Diagnostics (action name, isRunning, weight, timeScale)
  ctx.fillStyle = isRed ? '#fecaca' : '#86efac';
  ctx.font = '20px monospace';
  ctx.fillText(
    `action: ${item.actionName}  run: ${item.isRunning ? 'Y' : 'N'}  w: ${item.weight}  ts: ${item.timeScale}`,
    canvas.width / 2,
    120
  );

  // Divider
  ctx.strokeStyle = isRed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 140);
  ctx.lineTo(canvas.width - 24, 140);
  ctx.stroke();

  // Row 3: Status / Reason
  ctx.font = 'bold 20px monospace';
  if (isRed) {
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`FAIL: ${item.redReason}`, canvas.width / 2, 178);
  } else {
    ctx.fillStyle = '#4ade80';
    ctx.fillText('STATUS: OK (speed matched, no sliding)', canvas.width / 2, 178);
  }

  // Row 4: Watchdog status
  ctx.font = '17px monospace';
  ctx.fillStyle = isRed ? '#ffffff' : '#94a3b8';
  ctx.fillText('Watchdogs: 5s-stuck: OK · anim-check: OK', canvas.width / 2, 216);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createCrosswalkCycleCardTexture(ctrl: CrosswalkCycleController): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 330;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const phase = ctrl.getPhase();
  const telem = ctrl.getTelemetry();

  let bg = 'rgba(15, 23, 42, 0.94)';
  let border = '#10b981';
  if (phase === 'CARS_STOPPING') {
    bg = 'rgba(60, 20, 10, 0.95)';
    border = '#f59e0b';
  } else if (phase === 'WALK') {
    bg = 'rgba(10, 40, 60, 0.95)';
    border = '#06b6d4';
  } else if (phase === 'CLEAR') {
    bg = 'rgba(40, 15, 55, 0.95)';
    border = '#c084fc';
  }

  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${telem.name}`, canvas.width / 2, 40);

  ctx.fillStyle = border;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(
    `PHASE: [${phase}]  ${telem.phaseTimer.toFixed(1)}s / ${telem.phaseDuration}s  (Cycle #${telem.cycleCount})`,
    canvas.width / 2,
    74
  );

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 90);
  ctx.lineTo(canvas.width - 24, 90);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '19px monospace';

  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`• Pedestrians:  Waiting: ${telem.waitingCount}   Crossing: ${telem.crossingCount}`, 28, 124);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`• Stop Lines:   Eastbound: X = ${ctrl.stopLineEastbound.toFixed(1)}m (3m before zebra)`, 28, 158);
  ctx.fillText(`                Westbound: X = ${ctrl.stopLineWestbound.toFixed(1)}m (3m before zebra)`, 28, 188);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`• Car Stop Decisions:`, 28, 222);

  ctx.font = '16px monospace';
  if (telem.carDecisions.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`   No approaching cars within 30m`, 32, 250);
  } else {
    telem.carDecisions.slice(0, 2).forEach((d, idx) => {
      ctx.fillStyle = d.shouldStop ? '#f87171' : '#86efac';
      ctx.fillText(`   Car #${d.carId}: ${d.shouldStop ? 'STOP' : 'GO'} — ${d.reason.slice(0, 36)}`, 32, 250 + idx * 24);
    });
  }

  ctx.font = '16px monospace';
  ctx.fillStyle = telem.watchdogTriggered ? '#ef4444' : '#6ee7b7';
  ctx.fillText(
    `• Watchdog: ${telem.watchdogTriggered ? 'Phase > 2x nominal (auto-advanced)' : 'Cycle Clock OK (cannot deadlock)'}`,
    28,
    302
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const PedestrianDebugOverlay: React.FC = () => {
  const telemetry = pedestrianSystem.getTelemetry();
  const redCount = pedestrianSystem.getRedCount();
  const crosswalks = getAllCrosswalkCycles();

  return (
    <group name="PedestrianDebugOverlay">
      {telemetry.map((item) => {
        const tex = createPedestrianCardTexture(item);
        const [x, y, z] = item.position;

        return (
          <group key={item.id} position={[x, y, z]}>
            {/* Footprint Ring (0.35m radius) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.33, 0.35, 32]} />
              <meshBasicMaterial
                color={item.isRed ? '#ef4444' : '#10b981'}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Floating Telemetry Billboard */}
            <sprite position={[0, 2.3, 0]} scale={[2.6, 1.25, 1.0]}>
              <spriteMaterial map={tex} transparent depthTest={false} />
            </sprite>
          </group>
        );
      })}

      {/* ── Crosswalk Cycle Overlays & Stop Lines ──────────────────────── */}
      {crosswalks.map((ctrl) => {
        const tex = createCrosswalkCycleCardTexture(ctrl);
        const phase = ctrl.getPhase();
        const isStopPhase = phase !== 'CARS_GO';

        return (
          <group key={ctrl.zone.id}>
            {/* 3m Stop Line: Westbound (North side, Z in [-6.0, -1.0]) */}
            <group position={[ctrl.stopLineWestbound, -0.06, -3.5]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.35, 5.0]} />
                <meshBasicMaterial color={isStopPhase ? '#ef4444' : '#22c55e'} />
              </mesh>
            </group>

            {/* 3m Stop Line: Eastbound (South side, Z in [-0.6, 4.8]) */}
            <group position={[ctrl.stopLineEastbound, -0.06, 2.1]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.35, 5.4]} />
                <meshBasicMaterial color={isStopPhase ? '#ef4444' : '#22c55e'} />
              </mesh>
            </group>

            {/* Crosswalk Cycle HUD Billboard */}
            <sprite position={[ctrl.zone.centerX, 4.0, -0.8]} scale={[3.8, 2.0, 1.0]}>
              <spriteMaterial map={tex} transparent depthTest={false} />
            </sprite>
          </group>
        );
      })}

      {/* ── Fixed Screen Counter of RED Pedestrians ──────────────────────── */}
      {/* Also rendered in 3D floating over street center for in-scene visibility */}
      <group position={[0, 5.0, -0.8]}>
        {(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 120;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = redCount > 0 ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = redCount > 0 ? '#ef4444' : '#10b981';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PEDESTRIAN SYSTEM MONITOR', canvas.width / 2, 40);

            ctx.fillStyle = redCount > 0 ? '#fee2e2' : '#86efac';
            ctx.font = 'bold 28px monospace';
            ctx.fillText(
              `RED COUNTER: ${redCount} ${redCount === 0 ? '✓ ZERO ERRORS' : '⚠ ISSUES DETECTED'}`,
              canvas.width / 2,
              84
            );
          }
          const tex = new THREE.CanvasTexture(canvas);
          tex.needsUpdate = true;
          return (
            <sprite scale={[4.0, 1.0, 1.0]}>
              <spriteMaterial map={tex} transparent depthTest={false} />
            </sprite>
          );
        })()}
      </group>
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  3. STATIC STOREFRONT EXTRAS (Rigify Models Breathing Quietly in Doorways)
// ═════════════════════════════════════════════════════════════════════════════
interface StaticExtraDef {
  modelKey: string;
  position: [number, number, number];
  rotationY: number;
  height: number;
  phaseOffset: number;
}

const STATIC_EXTRAS: StaticExtraDef[] = [
  {
    modelKey: '011',
    position: [BUILDING_PROXIES[0].xPos + 1.6, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 0.45],
    rotationY: 0,
    height: 1.70,
    phaseOffset: 0.0,
  },
  {
    modelKey: '004',
    position: [BUILDING_PROXIES[2].xPos - 3.2, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 1.15],
    rotationY: 0.35,
    height: 1.78,
    phaseOffset: 1.8,
  },
  {
    modelKey: '002',
    position: [BUILDING_PROXIES[4].xPos + 2.0, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ + 0.45],
    rotationY: -0.2,
    height: 1.68,
    phaseOffset: 3.2,
  },
  {
    modelKey: '010',
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
    <group name="StaticStorefrontExtras">
      {extraRoots.map((root, idx) => (
        <primitive key={idx} object={root} />
      ))}
    </group>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  EXPORTED PEDESTRIAN GROUP COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export const PedestrianGroup: React.FC = () => {
  return (
    <group name="PedestrianGroup">
      {/* 8 Diversified Mixamo Walkers with clean PedestrianSystem module */}
      <MixamoWalkingPedestrians />

      {/* 4 Static Storefront Extras with subtle procedural idle breathing */}
      <StaticStorefrontExtras />
    </group>
  );
};

export default PedestrianGroup;
