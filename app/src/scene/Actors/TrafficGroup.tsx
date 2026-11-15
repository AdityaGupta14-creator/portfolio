import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CROSSWALK_ZONES, crosswalkManager, CarTelemetry } from '../../data/crosswalks';

interface CarConfig {
  color: number;
  isTaxi: boolean;
  type: 'sedan' | 'suv';
}

interface CarData {
  id: number;
  x: number;
  z: number;
  dir: 1 | -1;
  cruiseSpeed: number;
  currentSpeed: number;
  isBraking: boolean;
  cfg: CarConfig;
}

const CAR_CONFIGS: CarConfig[] = [
  { color: 0xf5b700, isTaxi: true, type: 'sedan' },
  { color: 0xb91c1c, isTaxi: false, type: 'sedan' },
  { color: 0x1e293b, isTaxi: false, type: 'suv' },
  { color: 0xf5b700, isTaxi: true, type: 'sedan' },
  { color: 0x2563eb, isTaxi: false, type: 'sedan' },
  { color: 0x0f766e, isTaxi: false, type: 'suv' },
  { color: 0xe2e8f0, isTaxi: false, type: 'sedan' },
];

export const TrafficGroup: React.FC = () => {
  const carGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const wheelRefs = useRef<(THREE.Mesh | null)[][]>([]);
  const tailLightRefs = useRef<(THREE.Mesh | null)[][]>([]);

  // 12 Cars deployed in 2 lanes:
  // Lane 1: Z = 2.1, Dir = +1 (Eastbound)
  // Lane 2: Z = -3.6, Dir = -1 (Westbound)
  const cars = useMemo<CarData[]>(() => {
    const list: CarData[] = [];
    let id = 0;
    for (let i = 0; i < 6; i++) {
      const cruise1 = 0.17 + (i % 3) * 0.03;
      list.push({
        id: id++,
        x: -115 + i * 44,
        z: 2.1,
        dir: 1,
        cruiseSpeed: cruise1,
        currentSpeed: cruise1,
        isBraking: false,
        cfg: CAR_CONFIGS[i % CAR_CONFIGS.length],
      });

      const cruise2 = 0.16 + ((i + 1) % 3) * 0.03;
      list.push({
        id: id++,
        x: -95 + i * 44,
        z: -3.6,
        dir: -1,
        cruiseSpeed: cruise2,
        currentSpeed: cruise2,
        isBraking: false,
        cfg: CAR_CONFIGS[(i + 3) % CAR_CONFIGS.length],
      });
    }
    return list;
  }, []);

  // Shared Materials
  const glassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.8 }),
    []
  );
  const headLightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xfff7c2 }), []);
  const tailLightNormalMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x991b1b }), []);
  const tailLightBrakeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    []
  );
  const taxiSignMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xfffbeb }), []);
  const tireMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 }),
    []
  );

  const wheelGeom = useMemo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16), []);

  useFrame((_state, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    // Update crosswalk clear countdown timers
    crosswalkManager.tickClearCountdown(clampedDelta);

    const carTelemetries: CarTelemetry[] = [];

    cars.forEach((car, idx) => {
      const group = carGroupRefs.current[idx];
      if (!group) return;

      // Current car telemetry for crosswalk checks
      const telemetry: CarTelemetry = {
        id: car.id,
        x: group.position.x,
        z: car.z,
        dir: car.dir,
        speed: car.currentSpeed,
        worldSpeed: car.currentSpeed * 60,
        isBraking: car.isBraking,
      };

      // ── Check all 3 crosswalks for crossing pedestrians ────────────────────
      let minTargetSpeed = car.cruiseSpeed;
      let shouldBrakeAny = false;

      for (const cw of CROSSWALK_ZONES) {
        const { shouldBrake, distToStopLine } = crosswalkManager.shouldCarBrake(telemetry, cw);

        if (shouldBrake) {
          shouldBrakeAny = true;
          // Scale target speed down smoothly based on distance to the 3m stop line
          // When at or past stop line (dist <= 0.3m), stop completely
          if (distToStopLine <= 0.3) {
            minTargetSpeed = 0;
          } else {
            // Smoothly decelerate as car approaches the stop line
            const brakeFactor = Math.max(0, Math.min(1, distToStopLine / 14.0));
            const brakeTarget = car.cruiseSpeed * brakeFactor;
            minTargetSpeed = Math.min(minTargetSpeed, brakeTarget);
          }
        }
      }

      car.isBraking = shouldBrakeAny && car.currentSpeed > 0.001;

      // ── Smooth Acceleration & Deceleration ─────────────────────────────────
      // Brake deceleration ~3.0 m/s^2, acceleration ~2.0 m/s^2
      const accelRate = shouldBrakeAny ? 0.06 : 0.035; // units/frame^2
      const speedDiff = minTargetSpeed - car.currentSpeed;
      const step = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), accelRate * clampedDelta * 60);
      car.currentSpeed += step;
      car.currentSpeed = Math.max(0, car.currentSpeed);

      // Move car
      group.position.x += car.currentSpeed * car.dir * clampedDelta * 60;

      // Spin wheels proportionally to movement
      const wheels = wheelRefs.current[idx];
      if (wheels) {
        wheels.forEach((w) => {
          if (w) w.rotation.z -= car.currentSpeed * car.dir * 0.8 * clampedDelta * 60;
        });
      }

      // Update Taillights (glow bright red when braking)
      const tailLights = tailLightRefs.current[idx];
      if (tailLights) {
        const activeMat = car.isBraking ? tailLightBrakeMat : tailLightNormalMat;
        tailLights.forEach((tl) => {
          if (tl) tl.material = activeMat;
        });
      }

      // Boundary wrapping along avenue
      if (car.dir > 0 && group.position.x > 135) {
        group.position.x = -135;
      } else if (car.dir < 0 && group.position.x < -135) {
        group.position.x = 135;
      }

      // Save live telemetry for pedestrians
      carTelemetries.push({
        id: car.id,
        x: group.position.x,
        z: car.z,
        dir: car.dir,
        speed: car.currentSpeed,
        worldSpeed: car.currentSpeed * 60,
        isBraking: car.isBraking,
      });
    });

    // Publish shared telemetry
    crosswalkManager.updateCars(carTelemetries);
  });

  return (
    <group>
      {cars.map((car, idx) => {
        const length = car.cfg.type === 'suv' ? 4.6 : 4.3;
        const cabinL = car.cfg.type === 'suv' ? 2.9 : 2.35;
        const cabinX = car.dir > 0 ? -0.25 : 0.25;
        const frontX = car.dir > 0 ? length / 2 + 0.02 : -length / 2 - 0.02;
        const backX = -frontX;

        const bodyMat = new THREE.MeshStandardMaterial({
          color: car.cfg.color,
          roughness: 0.28,
          metalness: 0.45,
        });

        if (!wheelRefs.current[idx]) {
          wheelRefs.current[idx] = [];
        }
        if (!tailLightRefs.current[idx]) {
          tailLightRefs.current[idx] = [];
        }

        return (
          <group
            key={car.id}
            ref={(el) => {
              carGroupRefs.current[idx] = el;
            }}
            position={[car.x, 0, car.z]}
          >
            {/* Chassis */}
            <mesh position={[0, 0.76, 0]} material={bodyMat} castShadow receiveShadow>
              <boxGeometry args={[length, 0.92, 2.05]} />
            </mesh>

            {/* Cabin */}
            <mesh position={[cabinX, 1.56, 0]} material={bodyMat} castShadow>
              <boxGeometry args={[cabinL, 0.82, 1.78]} />
            </mesh>

            {/* Windows */}
            <mesh position={[cabinX, 1.56, 0]} material={glassMat}>
              <boxGeometry args={[cabinL + 0.06, 0.62, 1.82]} />
            </mesh>

            {/* Taxi Roof Sign */}
            {car.cfg.isTaxi && (
              <mesh position={[cabinX, 2.08, 0]} material={taxiSignMat}>
                <boxGeometry args={[0.65, 0.24, 0.32]} />
              </mesh>
            )}

            {/* Headlights */}
            <mesh position={[frontX, 0.82, 0.68]} material={headLightMat}>
              <boxGeometry args={[0.08, 0.24, 0.38]} />
            </mesh>
            <mesh position={[frontX, 0.82, -0.68]} material={headLightMat}>
              <boxGeometry args={[0.08, 0.24, 0.38]} />
            </mesh>

            {/* Taillights / Brake Lights */}
            <mesh
              ref={(el) => {
                tailLightRefs.current[idx][0] = el;
              }}
              position={[backX, 0.82, 0.68]}
              material={tailLightNormalMat}
            >
              <boxGeometry args={[0.08, 0.24, 0.42]} />
            </mesh>
            <mesh
              ref={(el) => {
                tailLightRefs.current[idx][1] = el;
              }}
              position={[backX, 0.82, -0.68]}
              material={tailLightNormalMat}
            >
              <boxGeometry args={[0.08, 0.24, 0.42]} />
            </mesh>

            {/* 4 Rolling Wheels */}
            {[
              [-1.35, 0.98],
              [1.35, 0.98],
              [-1.35, -0.98],
              [1.35, -0.98],
            ].map(([wx, wz], wIdx) => (
              <mesh
                key={wIdx}
                ref={(el) => {
                  wheelRefs.current[idx][wIdx] = el;
                }}
                geometry={wheelGeom}
                material={tireMat}
                rotation={[Math.PI / 2, 0, 0]}
                position={[wx, 0.42, wz]}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
};
