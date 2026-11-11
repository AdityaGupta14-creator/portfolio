import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface CarConfig {
  color: number;
  isTaxi: boolean;
  type: 'sedan' | 'suv';
}

interface CarData {
  id: number;
  x: number;
  z: number;
  dir: number;
  speed: number;
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

  // 12 Cars deployed in 2 lanes
  const cars = useMemo<CarData[]>(() => {
    const list: CarData[] = [];
    let id = 0;
    for (let i = 0; i < 6; i++) {
      list.push({
        id: id++,
        x: -115 + i * 44,
        z: 2.1,
        dir: 1,
        speed: 0.17 + (i % 3) * 0.03,
        cfg: CAR_CONFIGS[i % CAR_CONFIGS.length],
      });
      list.push({
        id: id++,
        x: -95 + i * 44,
        z: -3.6,
        dir: -1,
        speed: 0.16 + ((i + 1) % 3) * 0.03,
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
  const tailLightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xff2626 }), []);
  const taxiSignMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xfffbeb }), []);
  const tireMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 }),
    []
  );

  const wheelGeom = useMemo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16), []);

  useFrame(() => {
    cars.forEach((car, idx) => {
      const group = carGroupRefs.current[idx];
      if (group) {
        group.position.x += car.speed * car.dir;

        // Spin wheels
        const wheels = wheelRefs.current[idx];
        if (wheels) {
          wheels.forEach((w) => {
            if (w) w.rotation.z -= car.speed * car.dir * 0.8;
          });
        }

        // Boundary wrapping
        if (car.dir > 0 && group.position.x > 135) {
          group.position.x = -135;
        } else if (car.dir < 0 && group.position.x < -135) {
          group.position.x = 135;
        }
      }
    });
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

            {/* Taillights */}
            <mesh position={[backX, 0.82, 0.68]} material={tailLightMat}>
              <boxGeometry args={[0.08, 0.24, 0.42]} />
            </mesh>
            <mesh position={[backX, 0.82, -0.68]} material={tailLightMat}>
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

