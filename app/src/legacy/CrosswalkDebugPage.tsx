import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  CROSSWALK_ZONES,
  CarTelemetry,
} from '../data/crosswalks';
import {
  CrosswalkController,
  getCrosswalkController,
  PedestrianTelemetry,
  CrosswalkDebugInfo,
} from '../sim/CrosswalkController';
import { createCar, CarInstance } from '../scene/carFactory';
import { StreetGround } from '../scene/Environment/StreetGround';
import { PEDESTRIAN_STRIDE, calculateWalkTimeScale } from '../data/pedestrianConfig';

const CW_ZONE = CROSSWALK_ZONES[1]; // Storefront 105 / Projects (X = 13.0m)

interface DebugPedState {
  id: number;
  side: 'north' | 'south';
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetYaw: number;
  speed: number;
  targetSpeed: number;
  state: 'approach_kerb' | 'wait' | 'cross' | 'finished';
  crossingDirZ: 1 | -1;
}

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
  instance: CarInstance | null;
  chassis: THREE.Group;
  tailLightLeft: THREE.Mesh;
  tailLightRight: THREE.Mesh;
}

interface LogEntry {
  id: number;
  time: string;
  state: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'action';
}

// ── 3D Scene Controller Inside Canvas ────────────────────────────────────────
const CrosswalkScene: React.FC<{
  controller: CrosswalkController;
  isAutoLoop: boolean;
  onTelemetryUpdate: (info: CrosswalkDebugInfo, peds: DebugPedState[], cars: DebugCarState[]) => void;
  onLog: (entry: Omit<LogEntry, 'id' | 'time'>) => void;
  spawnTrigger: number;
  cameraPreset: 'perspective' | 'topdown' | 'kerb';
}> = ({ controller, isAutoLoop, onTelemetryUpdate, onLog, spawnTrigger, cameraPreset }) => {
  const { camera } = useThree();
  const carsGLTF = useGLTF('/models/cars.web.glb');
  const [sourceScene, setSourceScene] = useState<THREE.Group | null>(null);

  // Pedestrian animations
  const [walkingFbx, setWalkingFbx] = useState<THREE.Group | null>(null);
  const [wavingFbx, setWavingFbx] = useState<THREE.Group | null>(null);

  // Pedestrians Runtime Array (2 pedestrians: North & South)
  const pedsRef = useRef<DebugPedState[]>([
    {
      id: 1,
      side: 'north',
      x: CW_ZONE.centerX - 0.65,
      y: 0.16,
      z: -7.6, // Start 1m back on sidewalk approaching kerb
      yaw: 0,
      targetYaw: 0,
      speed: 1.35,
      targetSpeed: 1.35,
      state: 'approach_kerb',
      crossingDirZ: 1,
    },
    {
      id: 2,
      side: 'south',
      x: CW_ZONE.centerX + 0.65,
      y: 0.10,
      z: 6.5, // Start 1m back on promenade approaching kerb
      yaw: Math.PI,
      targetYaw: Math.PI,
      speed: 1.40,
      targetSpeed: 1.40,
      state: 'approach_kerb',
      crossingDirZ: -1,
    },
  ]);

  // Cars Runtime Array (3 cars: 2 Eastbound + 1 Westbound)
  const carsRef = useRef<DebugCarState[]>([]);
  const carsInitializedRef = useRef(false);

  // Visual Meshes for Pedestrians
  const pedMeshesRef = useRef<{
    root: THREE.Group;
    mixer: THREE.AnimationMixer;
    walkAction: THREE.AnimationAction;
    standAction?: THREE.AnimationAction;
  }[]>([]);

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

  // Load models & animations
  useEffect(() => {
    if (carsGLTF && carsGLTF.scene) {
      setSourceScene(carsGLTF.scene as THREE.Group);
    }

    const loader = new FBXLoader();
    loader.load('/animations/Walking.fbx', (fbx) => {
      setWalkingFbx(fbx);
    });
    loader.load('/animations/Waving.fbx', (fbx) => {
      setWavingFbx(fbx);
    }, undefined, () => {});
  }, [carsGLTF]);

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

  // Build the 3 Cars
  useEffect(() => {
    if (!sourceScene || carsInitializedRef.current) return;
    carsInitializedRef.current = true;

    const carConfigs = [
      { id: 1, type: 'sedan' as const, color: '#f5b700', x: -26.0, z: 2.1, dir: 1 as const, speed: 10.5 },
      { id: 2, type: 'suv' as const, color: '#18181b', x: -40.0, z: 2.1, dir: 1 as const, speed: 10.0 },
      { id: 3, type: 'coupe' as const, color: '#2563eb', x: 38.0, z: -3.6, dir: -1 as const, speed: 11.0 },
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

      // Eastbound cars face +X (yaw = Math.PI/2), Westbound face -X (yaw = -Math.PI/2)
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
        instance,
        chassis,
        tailLightLeft: tlL,
        tailLightRight: tlR,
      };
    });
  }, [sourceScene, lightGeom, tailLightCruisingMat]);

  // Build the 2 Pedestrians
  useEffect(() => {
    if (!walkingFbx) return;

    const rawBox = new THREE.Box3().setFromObject(walkingFbx);
    const rawHeight = rawBox.max.y - rawBox.min.y || PEDESTRIAN_STRIDE.rawHeightCm;
    const baseScaleFactor = PEDESTRIAN_STRIDE.targetHeightM / rawHeight;

    const rawWalkClip = walkingFbx.animations[0];
    const walkClip = rawWalkClip ? rawWalkClip.clone() : new THREE.AnimationClip('Walk', 0, []);
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

    const standClip = (() => {
      const srcClip = (wavingFbx && wavingFbx.animations[0]) || rawWalkClip;
      if (!srcClip) return null;
      const frozenTracks = srcClip.tracks.map((t) => {
        const TrackCtor = t.constructor as new (name: string, times: number[], values: number[]) => THREE.KeyframeTrack;
        const valSize = t.getValueSize();
        const vals = Array.from(t.values.slice(0, valSize));
        return new TrackCtor(t.name, [0, 1.0], [...vals, ...vals]);
      });
      return new THREE.AnimationClip('Stand', 1.0, frozenTracks);
    })();

    pedMeshesRef.current = [0, 1].map(() => {
      const cloned = SkeletonUtils.clone(walkingFbx) as THREE.Group;
      cloned.scale.setScalar(baseScaleFactor);

      const mixer = new THREE.AnimationMixer(cloned);
      const walkAction = mixer.clipAction(walkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.play();

      let standAction: THREE.AnimationAction | undefined = undefined;
      if (standClip) {
        standAction = mixer.clipAction(standClip);
        standAction.setLoop(THREE.LoopRepeat, Infinity);
      }

      const root = new THREE.Group();
      root.add(cloned);
      return { root, mixer, walkAction, standAction };
    });
  }, [walkingFbx, wavingFbx]);

  // Reset / Spawn Trigger Handler
  useEffect(() => {
    controller.reset();
    onLog({
      state: 'RESET',
      message: 'Reset crosswalk controller to CARS_GO. Repositioned 2 pedestrians & 3 cars.',
      type: 'action',
    });

    // Reset pedestrians
    pedsRef.current = [
      {
        id: 1,
        side: 'north',
        x: CW_ZONE.centerX - 0.65,
        y: 0.16,
        z: -7.6,
        yaw: 0,
        targetYaw: 0, // Facing South across road (+Z)
        speed: 1.35,
        targetSpeed: 1.35,
        state: 'approach_kerb',
        crossingDirZ: 1,
      },
      {
        id: 2,
        side: 'south',
        x: CW_ZONE.centerX + 0.65,
        y: 0.10,
        z: 6.5,
        yaw: Math.PI,
        targetYaw: Math.PI, // Facing North across road (-Z)
        speed: 1.40,
        targetSpeed: 1.40,
        state: 'approach_kerb',
        crossingDirZ: -1,
      },
    ];

    // Reset cars
    const carResetPositions = [
      { x: -26.0, speed: 10.5 },
      { x: -40.0, speed: 10.0 },
      { x: 38.0, speed: 11.0 },
    ];
    carsRef.current.forEach((car, idx) => {
      const r = carResetPositions[idx];
      car.x = r.x;
      car.speed = r.speed;
      car.targetSpeed = r.speed;
      car.isBraking = false;
      car.chassis.position.set(car.x, -0.09, car.z);
    });
  }, [spawnTrigger, controller]);

  const lastLoggedStateRef = useRef<string>('');

  // ── Frame Simulation Loop ──────────────────────────────────────────────────
  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.05);
    const peds = pedsRef.current;
    const cars = carsRef.current;

    // 1. Build Car & Pedestrian Telemetry
    const carTelemetries: CarTelemetry[] = cars.map((c) => ({
      id: c.id,
      x: c.x,
      z: c.z,
      dir: c.dir,
      speed: c.speed / 60,
      worldSpeed: c.speed,
      isBraking: c.isBraking,
    }));

    const pedTelemetries: PedestrianTelemetry[] = peds.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      state: p.state,
    }));

    // 2. Step Controller State Machine
    controller.update(clampedDelta, carTelemetries, pedTelemetries);
    const currentState = controller.getState();

    // Log state transitions
    if (currentState !== lastLoggedStateRef.current) {
      lastLoggedStateRef.current = currentState;
      let msg = '';
      let logType: LogEntry['type'] = 'info';

      if (currentState === 'PED_REQUEST') {
        msg = 'Pedestrians waiting at kerb. Checking for committed oncoming cars.';
        logType = 'warn';
      } else if (currentState === 'CARS_STOPPING') {
        msg = 'No committed cars. Cars ordered to brake smoothly and stop 3m before zebra.';
        logType = 'action';
      } else if (currentState === 'PEDS_CROSSING') {
        msg = 'Cars stationary at stop lines. Pedestrians green: crossing roadway simultaneously!';
        logType = 'success';
      } else if (currentState === 'CLEARING') {
        msg = 'All pedestrians reached far kerb! 1.0s safety clearing buffer countdown.';
        logType = 'info';
      } else if (currentState === 'CARS_GO') {
        msg = 'Roadway clear. Green light for cars! Smooth acceleration (~2.2 m/s²).';
        logType = 'success';
      }

      onLog({
        state: currentState,
        message: msg,
        type: logType,
      });
    }

    // 3. Update Pedestrian Simulation
    peds.forEach((ped, idx) => {
      const meshObj = pedMeshesRef.current[idx];

      // State: APPROACH_KERB
      if (ped.state === 'approach_kerb') {
        const kerbZ = ped.crossingDirZ > 0 ? CW_ZONE.northWaitingPoint.z : CW_ZONE.southWaitingPoint.z;
        const dz = kerbZ - ped.z;

        if (Math.abs(dz) > 0.15) {
          ped.z += Math.sign(dz) * Math.min(Math.abs(dz), ped.speed * clampedDelta);
          ped.targetSpeed = 1.35;
          ped.targetYaw = ped.crossingDirZ > 0 ? 0 : Math.PI;
        } else {
          ped.z = kerbZ;
          ped.state = 'wait';
          ped.targetSpeed = 0;
          ped.speed = 0;
          ped.targetYaw = ped.crossingDirZ > 0 ? 0 : Math.PI; // Face directly across road!
          controller.registerPedestrian(ped.id, ped.side);
        }
      }

      // State: WAIT
      else if (ped.state === 'wait') {
        ped.targetSpeed = 0;
        ped.speed = 0;
        ped.targetYaw = ped.crossingDirZ > 0 ? 0 : Math.PI; // Keep facing across road

        // Smooth rotation (~0.3s)
        let diff = ped.targetYaw - ped.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.yaw += Math.sign(diff) * Math.min(Math.abs(diff), (Math.PI / 0.30) * clampedDelta);

        // Keep registered
        controller.registerPedestrian(ped.id, ped.side);

        if (controller.canPedestrianCross(ped.id)) {
          ped.state = 'cross';
          controller.onPedestrianStartedCrossing(ped.id);
        }
      }

      // State: CROSS
      else if (ped.state === 'cross') {
        ped.targetSpeed = 1.55; // 1.55 m/s per requirement
        ped.speed = 1.55;
        ped.targetYaw = ped.crossingDirZ > 0 ? 0 : Math.PI;

        ped.z += ped.speed * ped.crossingDirZ * clampedDelta;

        // Elevation
        if (ped.z > -5.8 && ped.z < 4.8) {
          ped.y = -0.08;
        } else if (ped.crossingDirZ > 0) {
          ped.y = ped.z >= 4.8 ? 0.10 : 0.16;
        } else {
          ped.y = ped.z <= -5.8 ? 0.16 : 0.10;
        }

        controller.onPedestrianStartedCrossing(ped.id);

        const destZ = ped.crossingDirZ > 0 ? 5.5 : -6.6;
        const reached = (ped.crossingDirZ > 0 && ped.z >= destZ) || (ped.crossingDirZ < 0 && ped.z <= destZ);

        if (reached) {
          ped.state = 'finished';
          ped.targetSpeed = 0;
          ped.speed = 0;
          controller.onPedestrianFinished(ped.id);
        }
      }

      // Animation & Position update
      if (meshObj) {
        if (ped.state === 'wait' || ped.state === 'finished') {
          if (meshObj.standAction && (!meshObj.standAction.isRunning() || meshObj.standAction.getEffectiveWeight() < 0.5)) {
            meshObj.walkAction.crossFadeTo(meshObj.standAction, 0.3, true);
            meshObj.standAction.reset().play();
          }
        } else {
          if (meshObj.standAction && meshObj.standAction.isRunning() && meshObj.standAction.getEffectiveWeight() > 0.1) {
            meshObj.standAction.crossFadeTo(meshObj.walkAction, 0.3, true);
            meshObj.walkAction.play();
          } else if (!meshObj.walkAction.isRunning()) {
            meshObj.walkAction.reset().play();
          }
          const ts = calculateWalkTimeScale(ped.speed, 1.0);
          meshObj.walkAction.setEffectiveTimeScale(Math.max(ts, 0.001));
        }

        meshObj.mixer.update(clampedDelta);
        meshObj.root.position.set(ped.x, ped.y, ped.z);
        meshObj.root.rotation.y = ped.yaw;
      }
    });

    // 4. Update Cars Simulation
    cars.forEach((car, idx) => {
      const stopLineX = controller.getStopLine(car.dir);
      const distToStop = (stopLineX - car.x) * car.dir;

      let minTargetSpeed = car.cruiseSpeed;
      let shouldBrake = false;

      // Controller stop required?
      if (controller.stopRequired(car.id, car.x, car.z, car.dir, car.speed)) {
        shouldBrake = true;
        if (distToStop <= 0.3) {
          minTargetSpeed = 0;
        } else {
          // Smooth deceleration to 3m stop line
          const decel = Math.min(car.cruiseSpeed, Math.sqrt(Math.max(0, 2 * 3.0 * distToStop)));
          minTargetSpeed = Math.min(minTargetSpeed, decel);
        }
      }

      // 6m gap rule to car ahead (Car 2 trailing Car 1)
      if (idx === 1) {
        const carAhead = cars[0];
        const gap = carAhead.x - car.x - 4.5; // bumper-to-bumper
        if (gap < 6.0) {
          minTargetSpeed = 0;
          shouldBrake = true;
        } else if (gap < 14.0) {
          minTargetSpeed = Math.min(minTargetSpeed, carAhead.speed * ((gap - 6.0) / 8.0));
          shouldBrake = true;
        }
      }

      car.targetSpeed = minTargetSpeed;
      car.isBraking = shouldBrake && car.speed > 0.15;

      // Accel / Decel physics
      const accelRate = shouldBrake ? 4.0 : 2.2;
      const speedDiff = car.targetSpeed - car.speed;
      car.speed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), accelRate * clampedDelta);
      car.speed = Math.max(0, car.speed);

      // Advance
      const deltaD = car.speed * clampedDelta * car.dir;
      car.x += deltaD;
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

    // 5. Auto Loop Trigger: If cars have driven past and road is clear, re-spawn after 2 seconds
    if (isAutoLoop && currentState === 'CARS_GO') {
      const allCarsPast = cars.every((c) => (c.dir > 0 ? c.x > CW_ZONE.centerX + 25 : c.x < CW_ZONE.centerX - 25));
      if (allCarsPast && controller.getStateTimer() > 2.0) {
        // Trigger next cycle
        onLog({
          state: 'LOOP',
          message: 'Auto-loop triggered: Spawning new crossing sequence.',
          type: 'info',
        });
        // Reset positions
        pedsRef.current = [
          {
            id: 1,
            side: 'north',
            x: CW_ZONE.centerX - 0.65,
            y: 0.16,
            z: -7.6,
            yaw: 0,
            targetYaw: 0,
            speed: 1.35,
            targetSpeed: 1.35,
            state: 'approach_kerb',
            crossingDirZ: 1,
          },
          {
            id: 2,
            side: 'south',
            x: CW_ZONE.centerX + 0.65,
            y: 0.10,
            z: 6.5,
            yaw: Math.PI,
            targetYaw: Math.PI,
            speed: 1.40,
            targetSpeed: 1.40,
            state: 'approach_kerb',
            crossingDirZ: -1,
          },
        ];
        const carResetPositions = [
          { x: -26.0, speed: 10.5 },
          { x: -40.0, speed: 10.0 },
          { x: 38.0, speed: 11.0 },
        ];
        cars.forEach((car, i) => {
          car.x = carResetPositions[i].x;
          car.speed = carResetPositions[i].speed;
          car.targetSpeed = carResetPositions[i].speed;
          car.isBraking = false;
          car.chassis.position.set(car.x, -0.09, car.z);
        });
      }
    }

    // Telemetry publish
    onTelemetryUpdate(controller.getDebugInfo(), [...peds], [...cars]);
  });

  const isCarsStoppedState =
    controller.getState() === 'CARS_STOPPING' ||
    controller.getState() === 'PEDS_CROSSING' ||
    controller.getState() === 'CLEARING';

  return (
    <group>
      {/* Street & Crosswalk Environment */}
      <StreetGround />

      {/* Cars in Scene */}
      {carsRef.current.map((car) => (
        <primitive key={car.id} object={car.chassis} />
      ))}

      {/* Pedestrians in Scene */}
      {pedMeshesRef.current.map((p, idx) => (
        <primitive key={idx} object={p.root} />
      ))}

      {/* 3m Stop Line: Westbound (North side, Z in [-6.0, -1.0]) */}
      <group position={[CW_ZONE.centerX + 4.4, -0.06, -3.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 5.0]} />
          <meshBasicMaterial color={isCarsStoppedState ? '#ef4444' : '#22c55e'} />
        </mesh>
      </group>

      {/* 3m Stop Line: Eastbound (South side, Z in [-0.6, 4.8]) */}
      <group position={[CW_ZONE.centerX - 4.4, -0.06, 2.1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 5.4]} />
          <meshBasicMaterial color={isCarsStoppedState ? '#ef4444' : '#22c55e'} />
        </mesh>
      </group>
    </group>
  );
};

// ── Exported Debug Page Component ────────────────────────────────────────────
export const CrosswalkDebugPage: React.FC = () => {
  const controller = useMemo(() => getCrosswalkController('cw-105-projects'), []);
  const [spawnTrigger, setSpawnTrigger] = useState(0);
  const [isAutoLoop, setIsAutoLoop] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<'perspective' | 'topdown' | 'kerb'>('perspective');

  const [telemetry, setTelemetry] = useState<CrosswalkDebugInfo | null>(null);
  const [pedStates, setPedStates] = useState<DebugPedState[]>([]);
  const [carStates, setCarStates] = useState<DebugCarState[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (entry: Omit<LogEntry, 'id' | 'time'>) => {
    const now = new Date();
    const time = `${now.getMinutes().toString().padStart(2, '0')}:${now
      .getSeconds()
      .toString()
      .padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
    setLogs((prev) => [{ id: Date.now() + Math.random(), time, ...entry }, ...prev.slice(0, 39)]);
  };

  const handleTelemetry = (info: CrosswalkDebugInfo, peds: DebugPedState[], cars: DebugCarState[]) => {
    setTelemetry(info);
    setPedStates(peds);
    setCarStates(cars);
    if (typeof window !== 'undefined') {
      (window as any).__crosswalkDebugTelemetry = { info, peds, cars };
    }
  };

  const stateColors: Record<string, { bg: string; text: string; border: string }> = {
    CARS_GO: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
    PED_REQUEST: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
    CARS_STOPPING: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
    PEDS_CROSSING: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40' },
    CLEARING: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
  };

  const currentState = telemetry?.state || 'CARS_GO';
  const stateColor = stateColors[currentState] || stateColors.CARS_GO;

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* ── Top Header Navigation Bar ───────────────────────────────────────── */}
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
              Crosswalk Controller Debugger
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Crosswalk 2 · Projects (X = 13.0m)
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              State Machine: CARS_GO → PED_REQUEST → CARS_STOPPING → PEDS_CROSSING → CLEARING → CARS_GO
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSpawnTrigger((prev) => prev + 1)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            Spawn Test Crossing Sequence
          </button>

          <button
            onClick={() => setIsAutoLoop((prev) => !prev)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              isAutoLoop
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Auto-Loop: {isAutoLoop ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => controller.reset()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
          >
            Reset CARS_GO
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

      {/* ── Main Viewport + Telemetry Sidebar ───────────────────────────────── */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* 3D WebGL Canvas */}
        <div className="flex-1 h-full relative">
          <Canvas
            camera={{ position: [13.0, 7.5, -16.0], fov: 45 }}
            gl={{ antialias: true }}
            shadows
          >
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
              isAutoLoop={isAutoLoop}
              onTelemetryUpdate={handleTelemetry}
              onLog={addLog}
              spawnTrigger={spawnTrigger}
              cameraPreset={cameraPreset}
            />

            <OrbitControls target={[13.0, 0.5, -0.8]} maxPolarAngle={Math.PI / 2 - 0.05} />
          </Canvas>

          {/* Floating State Banner On Canvas */}
          <div className="absolute top-4 left-6 z-10 flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
            <div
              className={`px-3 py-1.5 rounded-lg font-mono text-sm font-bold border ${stateColor.bg} ${stateColor.text} ${stateColor.border} flex items-center gap-2`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
              STATE: {currentState}
            </div>
            <div className="text-xs font-mono text-slate-300">
              Timer: <strong className="text-white">{telemetry?.stateTimer.toFixed(1)}s</strong> | Hold:{' '}
              <strong className="text-amber-300">{telemetry?.holdTime.toFixed(1)}s / 20s</strong>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Event Log Panel */}
        <aside className="w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col z-10 backdrop-blur-md">
          {/* Section 1: Live Status Cards */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Controller Telemetry
            </h2>

            {/* Pedestrians Card */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Pedestrians (2 Clones)</span>
                <span className="text-cyan-400">
                  Wait: {telemetry?.waitingCount} · Cross: {telemetry?.crossingCount}
                </span>
              </div>
              {pedStates.map((p) => (
                <div key={p.id} className="flex justify-between text-[11px] text-slate-400">
                  <span>
                    #{p.id} ({p.side.toUpperCase()}): [{p.state.toUpperCase()}]
                  </span>
                  <span className="text-slate-200">
                    z: {p.z.toFixed(2)}m · spd: {p.speed.toFixed(2)}m/s
                  </span>
                </div>
              ))}
            </div>

            {/* Cars Card */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Cars Fleet (3 Vehicles)</span>
                <span className="text-slate-400">Stop Line: X=8.6 / X=17.4</span>
              </div>
              {carStates.map((c) => {
                const stopLineX = controller.getStopLine(c.dir);
                const distToStop = (stopLineX - c.x) * c.dir;
                return (
                  <div key={c.id} className="flex justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      #{c.id} {c.type} (dir {c.dir > 0 ? '+1' : '-1'}):
                    </span>
                    <span className={c.isBraking ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {c.isBraking ? 'BRAKING' : 'CRUISING'} ({c.speed.toFixed(1)}m/s, d={distToStop.toFixed(1)}m)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Committed Car / Safety Status */}
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] font-mono space-y-1">
              <div className="text-slate-400 font-semibold">Controller Wait Reason:</div>
              <div className="text-amber-300 leading-snug">{telemetry?.waitReason}</div>
              <div className="text-slate-400 pt-1 font-semibold">Watchdog Status:</div>
              <div className="text-emerald-400">
                {telemetry?.watchdogTriggered || 'All watchdogs OK (car hold < 20s, stopped car < 15s)'}
              </div>
            </div>
          </div>

          {/* Section 2: Real-time Event Log */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Sequence Event Log
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic p-2">Click "Spawn Test Crossing Sequence" to begin...</div>
              ) : (
                logs.map((log) => {
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
                        <span className="font-bold text-white">[{log.state}]</span>
                        <span>{log.time}</span>
                      </div>
                      <div>{log.message}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CrosswalkDebugPage;
