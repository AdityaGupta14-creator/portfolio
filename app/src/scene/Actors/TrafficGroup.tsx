import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CROSSWALK_ZONES, crosswalkManager, CarTelemetry } from '../../data/crosswalks';
import { useAppStore } from '../../store/useAppStore';
import {
  CarType,
  CarInstance,
  createCar,
} from '../carFactory';

useGLTF.preload('/models/cars.web.glb');

// ── 1. Continuous Closed-Loop Traffic Track ──────────────────────────────────
// Road surface is at Y = -0.09.
// Eastbound lane: Z = 2.1 (traffic drives toward +X on the South side)
// Westbound lane: Z = -3.6 (traffic drives toward -X on the North side)
// Smooth U-turns under dense fog at X = +/-135..145. No teleportation.
function createTrafficLoopCurve(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [
    // ── Straight Eastbound Section (South side, Z = 2.1, driving towards +X)
    new THREE.Vector3(-125, -0.09, 2.1),
    new THREE.Vector3(-60, -0.09, 2.1),
    new THREE.Vector3(0, -0.09, 2.1),
    new THREE.Vector3(60, -0.09, 2.1),
    new THREE.Vector3(125, -0.09, 2.1),

    // ── East U-Turn (Under fog at X > 130m)
    new THREE.Vector3(134, -0.09, 1.3),
    new THREE.Vector3(139, -0.09, -0.75),
    new THREE.Vector3(134, -0.09, -2.8),

    // ── Straight Westbound Section (North side, Z = -3.6, driving towards -X)
    new THREE.Vector3(125, -0.09, -3.6),
    new THREE.Vector3(60, -0.09, -3.6),
    new THREE.Vector3(0, -0.09, -3.6),
    new THREE.Vector3(-60, -0.09, -3.6),
    new THREE.Vector3(-125, -0.09, -3.6),

    // ── West U-Turn (Under fog at X < -130m)
    new THREE.Vector3(-134, -0.09, -2.8),
    new THREE.Vector3(-139, -0.09, -0.75),
    new THREE.Vector3(-134, -0.09, 1.3),
  ];

  return new THREE.CatmullRomCurve3(points, true, 'centripetal');
}

// ── 2. Car Fleet Configuration (10 Diversified Cars) ─────────────────────────
interface FleetCarConfig {
  type: CarType;
  color: string;
  cruiseSpeed: number; // m/s (approx 32 - 42 km/h)
  isTaxi?: boolean;
}

const FLEET_CONFIGS: FleetCarConfig[] = [
  { type: 'sedan', color: '#f5b700', cruiseSpeed: 10.5, isTaxi: true }, // Yellow Taxi
  { type: 'suv', color: '#18181b', cruiseSpeed: 9.8 },                 // Obsidian SUV
  { type: 'compact', color: '#ef4444', cruiseSpeed: 11.2 },             // Crimson Compact
  { type: 'coupe', color: '#2563eb', cruiseSpeed: 11.0 },               // Royal Blue Coupe
  { type: 'hatchback', color: '#f59e0b', cruiseSpeed: 10.2 },           // Amber Hatchback
  { type: 'pickup', color: '#047857', cruiseSpeed: 9.6 },               // Forest Green Pickup
  { type: 'minivan', color: '#831843', cruiseSpeed: 9.3 },              // Ruby Minivan
  { type: 'sport', color: '#ea580c', cruiseSpeed: 11.8 },               // Sunset Sport
  { type: 'wagon', color: '#475569', cruiseSpeed: 10.0 },               // Slate Wagon
  { type: 'offroad', color: '#3f6212', cruiseSpeed: 9.2 },              // Olive Offroad
];

// Runtime dynamic simulation state per car
interface RuntimeCar {
  id: number;
  cfg: FleetCarConfig;
  s: number;            // Distance along track (0..totalLength)
  worldPos: THREE.Vector3;
  headingYaw: number;
  currentSpeed: number; // m/s
  targetSpeed: number;
  isBraking: boolean;
  steerAngle: number;
  pitch: number;        // Nose dip when braking
  roll: number;         // Lean in turns
  instance: CarInstance | null;
  chassisGroup: THREE.Group;
  tailLightLeft: THREE.Mesh;
  tailLightRight: THREE.Mesh;
  headLightLeft: THREE.Mesh;
  headLightRight: THREE.Mesh;
  bboxMesh: THREE.Mesh | null;
  wheelAxesHelpers: THREE.AxesHelper[];
}

export const TrafficGroup: React.FC = () => {
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const isTrafficDebug = useAppStore((s) => s.isTrafficDebug);

  const gltf = useGLTF('/models/cars.web.glb');
  const sourceScene = gltf.scene;
  const rootGroupRef = useRef<THREE.Group>(null);

  // Curve and geometry caches
  const loopCurve = useMemo(() => createTrafficLoopCurve(), []);
  const trackLength = useMemo(() => loopCurve.getLength(), [loopCurve]);

  // Materials
  const tailLightCruisingMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x881313 }),
    []
  );
  const tailLightBrakeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xff1e1e }),
    []
  );
  const headLightDayMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.35 }),
    []
  );
  const headLightDuskMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
    []
  );
  const lightGeom = useMemo(() => new THREE.BoxGeometry(0.24, 0.12, 0.05), []);

  // Debug visual materials & geometries
  const debugTrackLine = useMemo(() => {
    const pts = loopCurve.getPoints(240);
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
    return new THREE.Line(geom, mat);
  }, [loopCurve]);

  // ── Initialize Fleet Runtime Array ──────────────────────────────────────────
  const fleet = useMemo<RuntimeCar[]>(() => {
    const list: RuntimeCar[] = [];
    const carCount = FLEET_CONFIGS.length;
    const spacing = trackLength / carCount;

    FLEET_CONFIGS.forEach((cfg, idx) => {
      const s = idx * spacing;
      const initialPos = loopCurve.getPointAt(s / trackLength);
      const tangent = loopCurve.getTangentAt(s / trackLength);
      const yaw = Math.atan2(tangent.x, tangent.z);

      const chassisGroup = new THREE.Group();
      chassisGroup.name = `CarChassis_${idx}_${cfg.type}`;

      // Left & Right Brake Lights
      const tlLeft = new THREE.Mesh(lightGeom, tailLightCruisingMat);
      const tlRight = new THREE.Mesh(lightGeom, tailLightCruisingMat);
      tlLeft.name = 'BrakeLight_L';
      tlRight.name = 'BrakeLight_R';

      // Left & Right Headlights
      const hlLeft = new THREE.Mesh(lightGeom, headLightDayMat);
      const hlRight = new THREE.Mesh(lightGeom, headLightDayMat);
      hlLeft.name = 'HeadLight_L';
      hlRight.name = 'HeadLight_R';

      list.push({
        id: idx,
        cfg,
        s,
        worldPos: initialPos,
        headingYaw: yaw,
        currentSpeed: cfg.cruiseSpeed,
        targetSpeed: cfg.cruiseSpeed,
        isBraking: false,
        steerAngle: 0,
        pitch: 0,
        roll: 0,
        instance: null,
        chassisGroup,
        tailLightLeft: tlLeft,
        tailLightRight: tlRight,
        headLightLeft: hlLeft,
        headLightRight: hlRight,
        bboxMesh: null,
        wheelAxesHelpers: [],
      });
    });

    return list;
  }, [loopCurve, trackLength, lightGeom, tailLightCruisingMat, headLightDayMat]);

  // ── Instantiate 3D Cars with carFactory when Source Scene is Ready ─────────
  useEffect(() => {
    if (!sourceScene || !rootGroupRef.current) return;

    fleet.forEach((car) => {
      if (car.instance) return; // already created

      try {
        const instance = createCar(car.cfg.type, car.cfg.color, sourceScene);
        car.instance = instance;

        // Position Lights using front and rear bumpers from instance
        const rearZ = instance.rear.z;
        const frontZ = instance.front.z;
        const lightY = Math.max(0.48, instance.rear.y + 0.32);
        const halfWidth = 0.68;

        // Mount lights into chassisGroup
        car.tailLightLeft.position.set(-halfWidth, lightY, rearZ - 0.02);
        car.tailLightRight.position.set(halfWidth, lightY, rearZ - 0.02);
        car.headLightLeft.position.set(-halfWidth, lightY, frontZ + 0.02);
        car.headLightRight.position.set(halfWidth, lightY, frontZ + 0.02);

        car.chassisGroup.add(instance.root);
        car.chassisGroup.add(car.tailLightLeft);
        car.chassisGroup.add(car.tailLightRight);
        car.chassisGroup.add(car.headLightLeft);
        car.chassisGroup.add(car.headLightRight);

        // Debug Helpers: Bounding Box & Wheel Axes
        const bboxGeom = new THREE.BoxGeometry(1.85, 1.45, instance.length);
        const bboxMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true });
        const bboxMesh = new THREE.Mesh(bboxGeom, bboxMat);
        bboxMesh.position.set(0, 0.72, (instance.front.z + instance.rear.z) / 2);
        bboxMesh.visible = false;
        car.bboxMesh = bboxMesh;
        car.chassisGroup.add(bboxMesh);

        const pivots = instance.wheelPivots;
        const axesList: THREE.AxesHelper[] = [];
        [pivots.frontLeft, pivots.frontRight, pivots.rearLeft, pivots.rearRight].forEach((wp, pIdx) => {
          const ax = new THREE.AxesHelper(0.48);
          ax.position.x = pIdx % 2 === 0 ? -0.18 : 0.18;
          ax.visible = false;
          wp.spin.add(ax);
          axesList.push(ax);
        });
        car.wheelAxesHelpers = axesList;

        rootGroupRef.current?.add(car.chassisGroup);
      } catch (err) {
        console.error(`[TrafficGroup] Failed to build car ${car.cfg.type}:`, err);
      }
    });

    return () => {
      fleet.forEach((car) => {
        if (car.chassisGroup.parent) {
          car.chassisGroup.parent.remove(car.chassisGroup);
        }
        car.instance = null;
      });
    };
  }, [sourceScene, fleet]);

  // ── Frame Simulation Loop ──────────────────────────────────────────────────
  useFrame(({ camera }, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    // Update crosswalk countdown timers
    crosswalkManager.tickClearCountdown(clampedDelta);

    const carTelemetries: CarTelemetry[] = [];
    const carCount = fleet.length;

    fleet.forEach((car, idx) => {
      if (!car.instance) return;

      const pos = car.chassisGroup.position;
      const camDist = pos.distanceTo(camera.position);
      const isNearCamera = camDist < 125;

      // ── 1. Minimum Gap to Car Ahead (6m bumper-to-bumper) ─────────────────
      // Find the car immediately ahead on the loop
      const nextIdx = (idx + 1) % carCount;
      const carAhead = fleet[nextIdx];

      let distToAhead = (carAhead.s - car.s + trackLength) % trackLength;
      // Account for bumper lengths
      const safetyMargin = (car.instance.length + (carAhead.instance?.length || 4.5)) / 2;
      const bumperGap = distToAhead - safetyMargin;

      let minTargetSpeed = car.cfg.cruiseSpeed;
      let shouldBrakeForCar = false;

      // 6 meter absolute stopping threshold
      if (bumperGap < 6.0) {
        minTargetSpeed = 0;
        shouldBrakeForCar = true;
      } else if (bumperGap < 6.0 + car.currentSpeed * 2.0) {
        // Smoothly match speed of car ahead
        const gapFactor = Math.max(0, Math.min(1, (bumperGap - 6.0) / (car.currentSpeed * 2.0 + 0.1)));
        minTargetSpeed = Math.min(minTargetSpeed, carAhead.currentSpeed * gapFactor);
        shouldBrakeForCar = true;
      }

      // ── 2. Crosswalk & Pedestrian Safety Rules ────────────────────────────
      // Determine traffic direction on straightaways (+1 for Eastbound, -1 for Westbound)
      const currentDir: 1 | -1 = pos.z > -0.8 ? 1 : -1;
      const onStraight = Math.abs(pos.x) < 125;

      const telemetry: CarTelemetry = {
        id: car.id,
        x: pos.x,
        z: pos.z,
        dir: currentDir,
        speed: car.currentSpeed / 60,
        worldSpeed: car.currentSpeed,
        isBraking: car.isBraking,
      };

      let shouldBrakeForCrosswalk = false;

      if (onStraight) {
        for (const cw of CROSSWALK_ZONES) {
          const { shouldBrake, distToStopLine } = crosswalkManager.shouldCarBrake(telemetry, cw);
          if (shouldBrake) {
            shouldBrakeForCrosswalk = true;
            if (distToStopLine <= 0.4) {
              minTargetSpeed = 0;
            } else {
              // Smooth deceleration toward 3m stop line
              const brakeFactor = Math.max(0, Math.min(1, distToStopLine / 14.0));
              minTargetSpeed = Math.min(minTargetSpeed, car.cfg.cruiseSpeed * brakeFactor);
            }
          }
        }
      }

      const shouldBrakeAny = shouldBrakeForCar || shouldBrakeForCrosswalk;
      car.targetSpeed = minTargetSpeed;
      car.isBraking = shouldBrakeAny && car.currentSpeed > 0.15;

      // ── 3. Smooth Acceleration & Deceleration Physics ─────────────────────
      // Acceleration ~ 2.2 m/s^2, braking deceleration ~ 4.0 m/s^2
      const accelRate = shouldBrakeAny ? 4.0 : 2.2; // m/s^2
      const speedDiff = car.targetSpeed - car.currentSpeed;
      const step = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), accelRate * clampedDelta);
      car.currentSpeed += step;
      car.currentSpeed = Math.max(0, car.currentSpeed);

      // Advance distance along closed curve
      const deltaD = car.currentSpeed * clampedDelta;
      car.s = (car.s + deltaD) % trackLength;

      // ── 4. Position & Path Tangent Orientation ────────────────────────────
      const u = car.s / trackLength;
      const newPos = loopCurve.getPointAt(u);
      const tangent = loopCurve.getTangentAt(u);
      pos.copy(newPos);

      // Target yaw from path tangent
      const targetYaw = Math.atan2(tangent.x, tangent.z);
      // Smooth yaw rotation across loop wrap
      let yawDiff = targetYaw - car.headingYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      car.headingYaw += yawDiff * Math.min(1.0, 10.0 * clampedDelta);

      // ── 5. Steering Angle in Turns (up to 25 degrees) ──────────────────────
      const lookAheadU = ((car.s + 2.4) % trackLength) / trackLength;
      const aheadTangent = loopCurve.getTangentAt(lookAheadU);
      const aheadYaw = Math.atan2(aheadTangent.x, aheadTangent.z);
      let steerDiff = aheadYaw - car.headingYaw;
      while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
      while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;

      // Clamp front steer to max 25 degrees (0.436 rad)
      const maxSteerRad = (25 * Math.PI) / 180;
      const desiredSteer = THREE.MathUtils.clamp(steerDiff * 4.5, -maxSteerRad, maxSteerRad);
      car.steerAngle = THREE.MathUtils.lerp(car.steerAngle, desiredSteer, clampedDelta * 12.0);

      // ── 6. Subtle Nose Dip When Braking & Slight Lean in Turns ─────────────
      // Nose dip pitch (proportional to deceleration)
      const targetPitch = car.isBraking ? -0.024 : 0.0;
      car.pitch = THREE.MathUtils.lerp(car.pitch, targetPitch, clampedDelta * 8.0);

      // Body lean roll (into/against turn)
      const targetRoll = -car.steerAngle * 0.12;
      car.roll = THREE.MathUtils.lerp(car.roll, targetRoll, clampedDelta * 8.0);

      // Apply combined transform to chassisGroup
      car.chassisGroup.rotation.set(car.pitch, car.headingYaw, car.roll);

      // ── 7. Wheel Spin (Only active near camera for performance) ───────────
      if (isNearCamera && deltaD > 0) {
        // Roll forward: angle = deltaD / wheelRadius
        const spinDelta = deltaD / car.instance.wheelRadius;
        car.instance.spinWheels(spinDelta);
        car.instance.setSteering(car.steerAngle);
      } else if (car.currentSpeed === 0) {
        // Wheels stopped
        car.instance.setSteering(car.steerAngle);
      }

      // ── 8. Brake Lights & Headlights ──────────────────────────────────────
      if (isNearCamera) {
        // Taillights brighten red when braking
        const activeTailMat = car.isBraking ? tailLightBrakeMat : tailLightCruisingMat;
        if (car.tailLightLeft.material !== activeTailMat) {
          car.tailLightLeft.material = activeTailMat;
          car.tailLightRight.material = activeTailMat;
        }

        // Headlights illuminate at dusk (golden evening)
        const activeHeadMat = isGoldenEvening ? headLightDuskMat : headLightDayMat;
        if (car.headLightLeft.material !== activeHeadMat) {
          car.headLightLeft.material = activeHeadMat;
          car.headLightRight.material = activeHeadMat;
        }

        // Debug Helpers Visibility
        if (car.bboxMesh) {
          car.bboxMesh.visible = isTrafficDebug;
          if (isTrafficDebug) {
            (car.bboxMesh.material as THREE.MeshBasicMaterial).color.setHex(
              car.isBraking ? 0xef4444 : 0x22c55e
            );
          }
        }
        car.wheelAxesHelpers.forEach((ax) => {
          ax.visible = isTrafficDebug;
        });
      }

      // Collect telemetry for pedestrians
      carTelemetries.push(telemetry);
    });

    // Publish telemetry to shared crosswalk simulation
    crosswalkManager.updateCars(carTelemetries);
  });

  return (
    <group name="TrafficGroup">
      {/* Container for the 10 real cars */}
      <group ref={rootGroupRef} />

      {/* ── Debug Overlay (T): Lane Paths ───────────────────────────────── */}
      {isTrafficDebug && (
        <group name="TrafficDebugOverlay">
          <primitive object={debugTrackLine} />
          {/* Eastbound Lane Guide */}
          <mesh position={[0, -0.06, 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[260, 0.15]} />
            <meshBasicMaterial color="#f59e0b" wireframe />
          </mesh>
          {/* Westbound Lane Guide */}
          <mesh position={[0, -0.06, -3.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[260, 0.15]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default TrafficGroup;
