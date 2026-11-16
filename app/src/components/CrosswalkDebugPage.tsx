import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CROSSWALK_ZONES, CarTelemetry } from '../data/crosswalks';
import {
  CrosswalkCycleController,
  CrosswalkPhase,
  CarStopDecision,
  CrosswalkCycleTelemetry,
} from '../sim/crosswalkCycle';
import { createCar, CarInstance } from '../scene/carFactory';
import { StreetGround } from '../scene/Environment/StreetGround';
import { PEDESTRIAN_STRIDE } from '../data/pedestrianConfig';
import { Pedestrian, Waypoint, PedestrianSystem } from '../sim/PedestrianSystem';

const CW_ZONE = CROSSWALK_ZONES[1]; // Storefront 105 / Projects (X = 13.0m)

interface DebugCarState {
  id: number;
  type: 'sedan' | 'suv' | 'coupe';
  color: string;
  x: number;
  y: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  targetSpeed: number;
  cruiseSpeed: number;
  isBraking: boolean;
  stopReason: string;
  instance: CarInstance | null;
  chassis: THREE.Group;
  tailLightLeft: THREE.Mesh;
  tailLightRight: THREE.Mesh;
}

interface LogEntry {
  id: number;
  time: string;
  phase: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'action';
}

function createCrosswalkCardTexture(ctrl: CrosswalkCycleController): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 190;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const phase = ctrl.getPhase();
    const isStop = phase !== 'CARS_GO';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = isStop ? '#ef4444' : '#10b981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CROSSWALK 2 (Projects, X = 13.0m)', canvas.width / 2, 38);

    ctx.fillStyle = isStop ? '#f87171' : '#4ade80';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(
      `PHASE: [${phase}]  ${ctrl.getPhaseTimer().toFixed(1)}s / ${ctrl.getPhaseDuration()}s  (Cycle #${ctrl.getCycleCount()})`,
      canvas.width / 2,
      72
    );

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(24, 88);
    ctx.lineTo(canvas.width - 24, 88);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '17px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`• 3m Stop Lines:  Eastbound X = 8.6m | Westbound X = 17.4m`, 24, 118);

    ctx.fillStyle = '#f1f5f9';
    const telem = ctrl.getTelemetry();
    ctx.fillText(`• Pedestrians:    Waiting: ${telem.waitingCount} | Crossing: ${telem.crossingCount}`, 24, 146);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = '15px monospace';
    ctx.fillText(`• Cycle: CARS_GO 14s → STOPPING 3s → WALK 10s → CLEAR 2s`, 24, 172);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createCarCardTexture(car: DebugCarState): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = car.isBraking ? '#ef4444' : '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`Car #${car.id} [${car.type.toUpperCase()}] dir: ${car.dir > 0 ? '+1 (East)' : '-1 (West)'}`, 14, 28);

    ctx.fillStyle = car.isBraking ? '#f87171' : '#4ade80';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`${car.speed.toFixed(1)} m/s ${car.isBraking ? '[BRAKING]' : '[CRUISING]'}`, 14, 56);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText(`↳ ${car.stopReason.slice(0, 42)}`, 14, 88);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPedCardTexture(ped: Pedestrian): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 380;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isWaiting = ped.isWaitingAtKerb;
    const isCrossing = ped.isCrossingRoad;
    const state = isWaiting ? 'WAIT_KERB' : isCrossing ? 'CROSSING' : 'WALK';
    const stateColor = isWaiting ? '#fbbf24' : isCrossing ? '#38bdf8' : '#34d399';

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = stateColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`Pedestrian #${ped.id} · State: ${state}`, 14, 28);

    ctx.fillStyle = stateColor;
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`Speed: ${ped.actualSpeed.toFixed(2)} m/s (target: ${ped.targetSpeed} m/s)`, 14, 56);

    const walkWeight = ped.walkAction.getEffectiveWeight();
    const action = walkWeight > 0.4 ? 'Walk' : 'Stand';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText(`Mixer: ${action} | W: ${walkWeight.toFixed(2)} | Scale: ${ped.walkAction.getEffectiveTimeScale().toFixed(2)}`, 14, 88);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const CrosswalkScene: React.FC<{
  controller: CrosswalkCycleController;
  pedSystem: PedestrianSystem;
  onTelemetryUpdate: (info: CrosswalkCycleTelemetry, cars: DebugCarState[]) => void;
  onLog: (entry: Omit<LogEntry, 'id' | 'time'>) => void;
  cameraPreset: 'perspective' | 'topdown' | 'kerb';
  showOverlay: boolean;
  timeScale: number;
}> = ({ controller, pedSystem, onTelemetryUpdate, onLog, cameraPreset, showOverlay, timeScale }) => {
  const { camera } = useThree();
  const carsGLTF = useGLTF('/models/cars.web.glb');
  const [sourceScene, setSourceScene] = useState<THREE.Group | null>(null);

  const carsRef = useRef<DebugCarState[]>([]);
  const carsInitializedRef = useRef(false);
  const pedsInitializedRef = useRef(false);

  // Camera presets
  useEffect(() => {
    if (cameraPreset === 'perspective') {
      camera.position.set(13.0, 7.5, -16.0);
      camera.lookAt(13.0, 0.5, -0.8);
    } else if (cameraPreset === 'topdown') {
      camera.position.set(13.0, 24.0, -0.8);
      camera.lookAt(13.0, 0.0, -0.8);
    } else if (cameraPreset === 'kerb') {
      camera.position.set(10.5, 1.6, -7.5);
      camera.lookAt(13.0, 1.2, 5.0);
    }
  }, [cameraPreset, camera]);

  // Materials for Car Lights
  const lightGeom = useMemo(() => new THREE.BoxGeometry(0.24, 0.12, 0.05), []);
  const tailLightCruisingMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x881313 }),
    []
  );
  const tailLightBrakeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xff1e1e }),
    []
  );

  useEffect(() => {
    if (carsGLTF && carsGLTF.scene) {
      setSourceScene(carsGLTF.scene as THREE.Group);
    }
  }, [carsGLTF]);

  // Build the 3 Cars
  useEffect(() => {
    if (!sourceScene || carsInitializedRef.current) return;
    carsInitializedRef.current = true;

    const carConfigs = [
      { id: 1, type: 'sedan' as const, color: '#f5b700', x: -28.0, z: 2.1, dir: 1 as const, speed: 10.5 },
      { id: 2, type: 'suv' as const, color: '#18181b', x: -44.0, z: 2.1, dir: 1 as const, speed: 10.0 },
      { id: 3, type: 'coupe' as const, color: '#2563eb', x: 40.0, z: -3.6, dir: -1 as const, speed: 11.0 },
    ];

    carsRef.current = carConfigs.map((cfg) => {
      const chassis = new THREE.Group();
      chassis.name = `Car_${cfg.id}`;

      const tlL = new THREE.Mesh(lightGeom, tailLightCruisingMat);
      const tlR = new THREE.Mesh(lightGeom, tailLightCruisingMat);

      const instance = createCar(cfg.type, cfg.color, sourceScene);
      const rearZ = instance.rear.z;
      const lightY = Math.max(0.48, instance.rear.y + 0.32);

      tlL.position.set(-0.68, lightY, rearZ - 0.02);
      tlR.position.set(0.68, lightY, rearZ - 0.02);

      chassis.add(instance.root);
      chassis.add(tlL);
      chassis.add(tlR);

      chassis.rotation.y = cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      chassis.position.set(cfg.x, -0.09, cfg.z);

      return {
        id: cfg.id,
        type: cfg.type,
        color: cfg.color,
        x: cfg.x,
        y: -0.09,
        z: cfg.z,
        dir: cfg.dir,
        speed: cfg.speed,
        targetSpeed: cfg.speed,
        cruiseSpeed: cfg.speed,
        isBraking: false,
        stopReason: 'Cruising normally (CARS_GO)',
        instance,
        chassis,
        tailLightLeft: tlL,
        tailLightRight: tlR,
      };
    });
  }, [sourceScene, lightGeom, tailLightCruisingMat]);

  // Build the 2 Pedestrians using PedestrianSystem
  useEffect(() => {
    if (pedsInitializedRef.current) return;
    pedsInitializedRef.current = true;
    pedSystem.clear();

    const loader = new FBXLoader();
    loader.load('/animations/Walking.fbx', (walkingFbx) => {
      const rawBox = new THREE.Box3().setFromObject(walkingFbx);
      const rawHeight = rawBox.max.y - rawBox.min.y || PEDESTRIAN_STRIDE.rawHeightCm;
      const baseScaleFactor = PEDESTRIAN_STRIDE.targetHeightM / rawHeight;

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

      const standTracks = walkClip.tracks.map((t) => {
        const TrackCtor = t.constructor as new (name: string, times: number[], values: number[]) => THREE.KeyframeTrack;
        const valSize = t.getValueSize();
        const vals = Array.from(t.values.slice(0, valSize));
        return new TrackCtor(t.name, [0, 1.0], [...vals, ...vals]);
      });
      const standClip = new THREE.AnimationClip('Stand', 1.0, standTracks);

      // Route for Pedestrian 1: Starts at North Kerb Point A, crosses to South Kerb Point B, loops back
      const routePed1: Waypoint[] = [
        {
          x: CW_ZONE.centerX - 0.65, // 12.35m
          y: 0.16,
          z: -6.6,
          isKerbWaitingPoint: true,
          crosswalkId: 'cw-105-projects',
          oppositeKerb: { x: CW_ZONE.centerX - 0.65, y: 0.10, z: 5.5 },
          crossSpeed: 1.50,
        },
        {
          x: CW_ZONE.centerX - 0.65,
          y: 0.10,
          z: 5.5,
          isOppositeKerb: true,
          crosswalkId: 'cw-105-projects',
        },
        // Turn around on South sidewalk to return crossing lane
        { x: CW_ZONE.centerX - 0.65, y: 0.10, z: 7.2 },
        { x: CW_ZONE.centerX + 0.65, y: 0.10, z: 7.2 },
        {
          x: CW_ZONE.centerX + 0.65, // 13.65m
          y: 0.10,
          z: 5.5,
          isKerbWaitingPoint: true,
          crosswalkId: 'cw-105-projects',
          oppositeKerb: { x: CW_ZONE.centerX + 0.65, y: 0.16, z: -6.6 },
          crossSpeed: 1.50,
        },
        {
          x: CW_ZONE.centerX + 0.65,
          y: 0.16,
          z: -6.6,
          isOppositeKerb: true,
          crosswalkId: 'cw-105-projects',
        },
        // Turn around on North sidewalk back to Point A
        { x: CW_ZONE.centerX + 0.65, y: 0.16, z: -8.0 },
        { x: CW_ZONE.centerX - 0.65, y: 0.16, z: -8.0 },
      ];

      // Route for Pedestrian 2: Starts at South Kerb Point A, crosses to North Kerb Point B, loops back
      const routePed2: Waypoint[] = [
        {
          x: CW_ZONE.centerX + 0.65, // 13.65m
          y: 0.10,
          z: 5.5,
          isKerbWaitingPoint: true,
          crosswalkId: 'cw-105-projects',
          oppositeKerb: { x: CW_ZONE.centerX + 0.65, y: 0.16, z: -6.6 },
          crossSpeed: 1.50,
        },
        {
          x: CW_ZONE.centerX + 0.65,
          y: 0.16,
          z: -6.6,
          isOppositeKerb: true,
          crosswalkId: 'cw-105-projects',
        },
        // Turn around on North sidewalk back to South crossing lane
        { x: CW_ZONE.centerX + 0.65, y: 0.16, z: -8.0 },
        { x: CW_ZONE.centerX - 0.65, y: 0.16, z: -8.0 },
        {
          x: CW_ZONE.centerX - 0.65, // 12.35m
          y: 0.16,
          z: -6.6,
          isKerbWaitingPoint: true,
          crosswalkId: 'cw-105-projects',
          oppositeKerb: { x: CW_ZONE.centerX - 0.65, y: 0.10, z: 5.5 },
          crossSpeed: 1.50,
        },
        {
          x: CW_ZONE.centerX - 0.65,
          y: 0.10,
          z: 5.5,
          isOppositeKerb: true,
          crosswalkId: 'cw-105-projects',
        },
        // Turn around on South sidewalk back to South Kerb
        { x: CW_ZONE.centerX - 0.65, y: 0.10, z: 7.2 },
        { x: CW_ZONE.centerX + 0.65, y: 0.10, z: 7.2 },
      ];

      [
        { id: 1, route: routePed1, startYaw: 0 },
        { id: 2, route: routePed2, startYaw: Math.PI },
      ].forEach((spec) => {
        const clonedAvatar = SkeletonUtils.clone(walkingFbx) as THREE.Group;
        clonedAvatar.scale.setScalar(baseScaleFactor);

        const mixer = new THREE.AnimationMixer(clonedAvatar);
        const walkAction = mixer.clipAction(walkClip);
        walkAction.setLoop(THREE.LoopRepeat, Infinity);

        const standAction = mixer.clipAction(standClip);
        standAction.setLoop(THREE.LoopRepeat, Infinity);
        standAction.play();
        standAction.setEffectiveWeight(1.0);

        const root = new THREE.Group();
        root.position.set(spec.route[0].x, spec.route[0].y, spec.route[0].z);
        root.rotation.y = spec.startYaw;
        root.add(clonedAvatar);

        const ped: Pedestrian = {
          id: spec.id,
          mesh: root,
          mixer,
          walkAction,
          standAction,
          route: spec.route,
          waypointIndex: 0,
          targetSpeed: 1.40,
          currentSpeed: 0,
          actualSpeed: 0,
          waitUntil: 0,
          yaw: spec.startYaw,
          targetYaw: spec.startYaw,
          lateralOffset: 0,
          targetLateralOffset: 0,
          lastPosition: root.position.clone(),
          stuckTimer: 0,
          isStuck: false,
          isAnimMismatch: false,
          isWaitingAtKerb: true,
          isCrossingRoad: false,
          isRed: false,
          redReason: '',
        };

        pedSystem.addPedestrian(ped);
      });
    });
  }, [pedSystem]);

  const lastPhaseRef = useRef<CrosswalkPhase>('CARS_GO');

  // ── Frame Simulation Loop ──────────────────────────────────────────────────
  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.05);
    const subSteps = Math.max(1, Math.min(10, Math.round(timeScale)));

    for (let step = 0; step < subSteps; step++) {
      // 1. Check pedestrians on roadway
      const peds = pedSystem.getPedestrians();
      const pedsOnRoadCount = peds.filter((p) => {
        const pos = p.mesh.position;
        return Math.abs(pos.x - CW_ZONE.centerX) < 3.5 && pos.z > -6.0 && pos.z < 4.8;
      }).length;

      // 2. Update Crosswalk Cycle Controller Clock
      controller.update(clampedDelta, pedsOnRoadCount);
      const currentPhase = controller.getPhase();

      if (currentPhase !== lastPhaseRef.current) {
        lastPhaseRef.current = currentPhase;
        const msgs: Record<CrosswalkPhase, { text: string; type: LogEntry['type'] }> = {
          CARS_GO: { text: `Phase CARS_GO (14s) · Green for traffic · Cycle #${controller.getCycleCount()}`, type: 'success' },
          CARS_STOPPING: { text: 'Phase CARS_STOPPING (3s) · Approaching cars braking to 3m stop line', type: 'warn' },
          WALK: { text: 'Phase WALK (10s) · Pedestrians stepping off simultaneously at ~1.5 m/s', type: 'action' },
          CLEAR: { text: 'Phase CLEAR (2s) · Clearing buffer · Waiting for road to empty', type: 'info' },
        };
        onLog({
          phase: currentPhase,
          message: msgs[currentPhase].text,
          type: msgs[currentPhase].type,
        });
      }

      // 3. Update PedestrianSystem
      pedSystem.update(clampedDelta);

      // 4. Update Cars Simulation
      const cars = carsRef.current;
      cars.forEach((car, idx) => {
        const telemetry: CarTelemetry = {
          id: car.id,
          x: car.x,
          z: car.z,
          dir: car.dir,
          speed: car.speed / 60,
          worldSpeed: car.speed,
          isBraking: car.isBraking,
        };

        const isPedAhead = pedsOnRoadCount > 0;
        const decision: CarStopDecision = controller.evaluateCar(telemetry, isPedAhead);

        let minTargetSpeed = car.cruiseSpeed;
        let shouldBrake = false;
        let reason = decision.reason;

        // Stop decision from crosswalk cycle clock
        if (decision.shouldStop) {
          shouldBrake = true;
          if (decision.distToStopLine <= 0.3) {
            minTargetSpeed = 0;
          } else {
            const decelSpeed = Math.min(
              car.cruiseSpeed,
              Math.sqrt(Math.max(0, 2 * 3.0 * decision.distToStopLine))
            );
            minTargetSpeed = Math.min(minTargetSpeed, decelSpeed);
          }
        }

        // 6m Gap Rule between Car 2 and Car 1
        if (idx === 1 && cars[0]) {
          const carAhead = cars[0];
          const gap = carAhead.x - car.x - 4.5;
          if (gap < 6.0) {
            minTargetSpeed = 0;
            shouldBrake = true;
            reason = `Queued behind Car #1 (gap: ${gap.toFixed(1)}m < 6m)`;
          } else if (gap < 14.0) {
            minTargetSpeed = Math.min(minTargetSpeed, carAhead.speed * ((gap - 6.0) / 8.0));
            shouldBrake = true;
            reason = `Matching speed of Car #1 ahead`;
          }
        }

        car.stopReason = reason;
        car.targetSpeed = minTargetSpeed;
        car.isBraking = shouldBrake && car.speed > 0.15;

        // Acceleration (2.2 m/s^2) / Deceleration (4.0 m/s^2)
        const accelRate = shouldBrake ? 4.0 : 2.2;
        const speedDiff = car.targetSpeed - car.speed;
        car.speed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), accelRate * clampedDelta);
        car.speed = Math.max(0, car.speed);

        // Advance along travel direction
        const deltaD = car.speed * clampedDelta * car.dir;
        car.x += deltaD;

        // Loop cars on track so they continuously test crosswalk cycles
        if (car.dir > 0 && car.x > 80.0) {
          car.x = -80.0;
        } else if (car.dir < 0 && car.x < -80.0) {
          car.x = 80.0;
        }

        car.chassis.position.x = car.x;

        // Spin wheels
        if (car.instance && Math.abs(deltaD) > 0) {
          car.instance.spinWheels(Math.abs(deltaD) / car.instance.wheelRadius);
        }

        // Brake lights
        const activeMat = car.isBraking ? tailLightBrakeMat : tailLightCruisingMat;
        if (car.tailLightLeft.material !== activeMat) {
          car.tailLightLeft.material = activeMat;
          car.tailLightRight.material = activeMat;
        }
      });
    }

    onTelemetryUpdate(controller.getTelemetry(), [...carsRef.current]);
  });

  const currentPhase = controller.getPhase();
  const isCarsStoppedPhase = currentPhase !== 'CARS_GO';

  return (
    <group>
      {/* Street & Crosswalk Ground */}
      <StreetGround />

      {/* Cars in Scene */}
      {carsRef.current.map((car) => (
        <primitive key={car.id} object={car.chassis} />
      ))}

      {/* Pedestrians in Scene */}
      {pedSystem.getPedestrians().map((p) => (
        <primitive key={p.id} object={p.mesh} />
      ))}

      {/* 3m Stop Line: Westbound (North side, Z in [-6.0, -1.0]) */}
      <group position={[CW_ZONE.centerX + 4.4, -0.06, -3.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 5.0]} />
          <meshBasicMaterial color={isCarsStoppedPhase ? '#ef4444' : '#22c55e'} />
        </mesh>
      </group>

      {/* 3m Stop Line: Eastbound (South side, Z in [-0.6, 4.8]) */}
      <group position={[CW_ZONE.centerX - 4.4, -0.06, 2.1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 5.4]} />
          <meshBasicMaterial color={isCarsStoppedPhase ? '#ef4444' : '#22c55e'} />
        </mesh>
      </group>

      {/* ── Key P 3D Overlay Billboards ──────────────────────────────────── */}
      {showOverlay && (
        <group name="CrosswalkDebug3DOverlays">
          {/* Overhead Crosswalk Cycle Card */}
          <sprite position={[CW_ZONE.centerX, 4.2, -0.8]} scale={[4.2, 1.8, 1.0]}>
            <spriteMaterial map={createCrosswalkCardTexture(controller)} transparent depthTest={false} />
          </sprite>

          {/* Overhead Car Cards with Stop Reason */}
          {carsRef.current.map((car) => (
            <sprite key={`card_${car.id}`} position={[car.x, 2.35, car.z]} scale={[3.4, 1.0, 1.0]}>
              <spriteMaterial map={createCarCardTexture(car)} transparent depthTest={false} />
            </sprite>
          ))}

          {/* Overhead Pedestrian Cards */}
          {pedSystem.getPedestrians().map((ped) => (
            <sprite key={`ped_card_${ped.id}`} position={[ped.mesh.position.x, 2.3, ped.mesh.position.z]} scale={[2.8, 0.95, 1.0]}>
              <spriteMaterial map={createPedCardTexture(ped)} transparent depthTest={false} />
            </sprite>
          ))}
        </group>
      )}
    </group>
  );
};

export const CrosswalkDebugPage: React.FC = () => {
  const controller = useMemo(() => new CrosswalkCycleController(CW_ZONE), []);
  const pedSystem = useMemo(() => new PedestrianSystem(), []);
  const [cameraPreset, setCameraPreset] = useState<'perspective' | 'topdown' | 'kerb'>('perspective');
  const [showOverlay, setShowOverlay] = useState(true);
  const [timeScale, setTimeScale] = useState(1);

  const [telemetry, setTelemetry] = useState<CrosswalkCycleTelemetry | null>(null);
  const [carStates, setCarStates] = useState<DebugCarState[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable);
      if ((e.key === 'p' || e.key === 'P') && !isInput) {
        e.preventDefault();
        setShowOverlay((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setTimeScale = (scale: number) => setTimeScale(scale);
      (window as any).__getTimeScale = () => timeScale;
      (window as any).__setShowOverlay = (show: boolean) => setShowOverlay(show);
    }
  }, [timeScale, showOverlay]);

  const addLog = (entry: Omit<LogEntry, 'id' | 'time'>) => {
    const now = new Date();
    const time = `${now.getMinutes().toString().padStart(2, '0')}:${now
      .getSeconds()
      .toString()
      .padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
    setLogs((prev) => [{ id: Date.now() + Math.random(), time, ...entry }, ...prev.slice(0, 39)]);
  };

  const handleTelemetry = (info: CrosswalkCycleTelemetry, cars: DebugCarState[]) => {
    setTelemetry(info);
    setCarStates(cars);
    if (typeof window !== 'undefined') {
      (window as any).__crosswalkCycleTelemetry = { info, cars };
    }
  };

  const phaseColors: Record<CrosswalkPhase, { bg: string; text: string; border: string }> = {
    CARS_GO: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
    CARS_STOPPING: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
    WALK: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40' },
    CLEAR: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
  };

  const currentPhase: CrosswalkPhase = telemetry?.phase || 'CARS_GO';
  const color = phaseColors[currentPhase];

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            ← Exit Debug
          </a>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Crosswalk Timed Cycle Simulator
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Crosswalk 2 · Projects (X = 13.0m)
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Cycle: CARS_GO (14s) → CARS_STOPPING (3s) → WALK (10s) → CLEAR (2s) · No Negotiation
            </p>
          </div>
        </div>

        {/* Action Controls & Cycle Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs">
            <span className="text-slate-400">Cycles Completed:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {telemetry?.cycleCount ?? 0} / 10+
            </span>
          </div>

          <button
            onClick={() => controller.reset()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
          >
            Reset
          </button>

          {/* TimeScale Speed Control */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono px-1">Speed:</span>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setTimeScale(s)}
                className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition ${
                  timeScale === s ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Overlay Toggle Button */}
          <button
            onClick={() => setShowOverlay((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono transition ${
              showOverlay
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Overlay (P): {showOverlay ? 'ON' : 'OFF'}
          </button>

          <div className="h-6 w-px bg-slate-800" />

          {/* Camera Presets */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setCameraPreset('perspective')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                cameraPreset === 'perspective' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Perspective
            </button>
            <button
              onClick={() => setCameraPreset('topdown')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                cameraPreset === 'topdown' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Top-Down
            </button>
            <button
              onClick={() => setCameraPreset('kerb')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                cameraPreset === 'kerb' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kerb Eye
            </button>
          </div>
        </div>
      </header>

      {/* Viewport + Telemetry Sidebar */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 h-full relative">
          <Canvas camera={{ position: [13.0, 7.5, -16.0], fov: 45 }} gl={{ antialias: true }} shadows>
            <ambientLight intensity={1.2} />
            <directionalLight
              position={[25, 35, -20]}
              intensity={2.2}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />

            <CrosswalkScene
              controller={controller}
              pedSystem={pedSystem}
              onTelemetryUpdate={handleTelemetry}
              onLog={addLog}
              cameraPreset={cameraPreset}
              showOverlay={showOverlay}
              timeScale={timeScale}
            />

            <OrbitControls target={[13.0, 0.5, -0.8]} maxPolarAngle={Math.PI / 2 - 0.05} />
          </Canvas>

          {/* Floating State Banner On Canvas */}
          <div className="absolute top-4 left-6 z-10 flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
            <div
              className={`px-3 py-1.5 rounded-lg font-mono text-sm font-bold border ${color.bg} ${color.text} ${color.border} flex items-center gap-2`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
              PHASE: {currentPhase}
            </div>
            <div className="text-xs font-mono text-slate-300">
              Timer: <strong className="text-white">{telemetry?.phaseTimer.toFixed(1)}s</strong> / {telemetry?.phaseDuration}s | Cycle:{' '}
              <strong className="text-emerald-300">#{telemetry?.cycleCount}</strong>
            </div>
          </div>
        </div>

        {/* Right Telemetry Sidebar */}
        <aside className="w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col z-10 backdrop-blur-md">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Crosswalk Cycle Status
            </h2>

            {/* Pedestrians Telemetry Card */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Pedestrians Crossing Status</span>
                <span className="text-cyan-400">
                  Waiting: {telemetry?.waitingCount} · Crossing: {telemetry?.crossingCount}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Phase WALK grants entry only when time remaining &ge; 9.5s
              </div>
            </div>

            {/* Cars & Stop Reasons Card */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Vehicles & Stop Reasons</span>
                <span className="text-slate-400">3m Stop Line: X=8.6 / X=17.4</span>
              </div>
              {carStates.map((c) => (
                <div key={c.id} className="text-[11px] space-y-0.5 border-t border-slate-700/40 pt-1">
                  <div className="flex justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      #{c.id} {c.type} (dir {c.dir > 0 ? '+1' : '-1'}):
                    </span>
                    <span className={c.isBraking ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {c.speed.toFixed(1)} m/s {c.isBraking ? '[BRAKING]' : '[GO]'}
                    </span>
                  </div>
                  <div className="text-slate-400 italic text-[10px] pl-3.5">
                    ↳ {c.stopReason}
                  </div>
                </div>
              ))}
            </div>

            {/* Watchdogs Status */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] font-mono space-y-1">
              <div className="text-slate-400 font-semibold">Deadlock Prevention Watchdog:</div>
              <div className="text-emerald-400">
                {telemetry?.watchdogTriggered
                  ? '⚠ Phase exceeded 2x duration; auto-advanced'
                  : '✓ Clock-driven cycle active (cannot deadlock, max 2x watchdog OK)'}
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Cycle Events Log
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
              {logs.map((log) => {
                const borderColors = {
                  info: 'border-slate-700 bg-slate-800/40 text-slate-300',
                  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                  action: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
                };
                return (
                  <div
                    key={log.id}
                    className={`p-2 rounded border leading-tight ${borderColors[log.type]}`}
                  >
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold text-white">[{log.phase}]</span>
                      <span>{log.time}</span>
                    </div>
                    <div>{log.message}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CrosswalkDebugPage;
