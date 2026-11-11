import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface PedestrianConfig {
  id: number;
  x: number;
  z: number;
  dir: number;
  speed: number;
  mode: 'sidewalk' | 'crosswalk';
  minBound: number;
  maxBound: number;
  skin: number;
  coat: number;
  pants: number;
  hair: number;
  hasBackpack: boolean;
  scale: number;
  phase: number;
}

const SKIN_TONES = [0xf5d0b5, 0xe0ac8b, 0xc6865c, 0x8d5534, 0xf7dcc4];
const COAT_COLORS = [
  0x1e293b, 0x991b1b, 0x0f766e, 0xd97706, 0x3730a3,
  0x4b5563, 0xbe185d, 0x166534, 0x2563eb, 0x7c2d12,
];
const PANTS_COLORS = [0x1e242b, 0x2b394a, 0x4b3f35, 0x334155, 0x18181b];
const HAIR_COLORS = [0x1a1615, 0x4a3222, 0x8c5a32, 0xd4a359, 0x2c221e];

export const PedestrianGroup: React.FC = () => {
  const rootRefs = useRef<(THREE.Group | null)[]>([]);
  const leftArmRefs = useRef<(THREE.Group | null)[]>([]);
  const rightArmRefs = useRef<(THREE.Group | null)[]>([]);
  const leftLegRefs = useRef<(THREE.Group | null)[]>([]);
  const rightLegRefs = useRef<(THREE.Group | null)[]>([]);
  const headRefs = useRef<(THREE.Group | null)[]>([]);

  // 24 Pedestrians deployed across sidewalks and crosswalks
  const pedestrians = useMemo<PedestrianConfig[]>(() => {
    const list: PedestrianConfig[] = [];
    let id = 0;

    // 1) 13 Pedestrians on Brownstone Storefront Sidewalk
    for (let i = 0; i < 13; i++) {
      list.push({
        id: id++,
        x: -78 + i * 12.5 + (Math.random() - 0.5) * 4,
        z: -8.2 - (i % 3) * 1.15,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.032 + Math.random() * 0.018,
        mode: 'sidewalk',
        minBound: -95,
        maxBound: 95,
        skin: SKIN_TONES[i % SKIN_TONES.length],
        coat: COAT_COLORS[i % COAT_COLORS.length],
        pants: PANTS_COLORS[i % PANTS_COLORS.length],
        hair: HAIR_COLORS[i % HAIR_COLORS.length],
        hasBackpack: i % 3 === 0,
        scale: 0.94 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 2) 8 Pedestrians on Foreground Promenade
    for (let i = 0; i < 8; i++) {
      list.push({
        id: id++,
        x: -65 + i * 18 + (Math.random() - 0.5) * 5,
        z: 7.6 + (i % 3) * 1.25,
        dir: i % 2 === 0 ? -1 : 1,
        speed: 0.034 + Math.random() * 0.018,
        mode: 'sidewalk',
        minBound: -92,
        maxBound: 92,
        skin: SKIN_TONES[(i + 2) % SKIN_TONES.length],
        coat: COAT_COLORS[(i + 4) % COAT_COLORS.length],
        pants: PANTS_COLORS[(i + 1) % PANTS_COLORS.length],
        hair: HAIR_COLORS[(i + 3) % HAIR_COLORS.length],
        hasBackpack: i % 2 === 0,
        scale: 0.96 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 3) 3 Pedestrians on Crosswalks
    const crosswalkX = [-39, 13, 65];
    crosswalkX.forEach((cx, idx) => {
      list.push({
        id: id++,
        x: cx + (idx % 2 === 0 ? -0.5 : 0.5),
        z: -6.5 + idx * 4,
        dir: idx % 2 === 0 ? 1 : -1,
        speed: 0.036,
        mode: 'crosswalk',
        minBound: -9.8,
        maxBound: 9.5,
        skin: SKIN_TONES[idx % SKIN_TONES.length],
        coat: COAT_COLORS[(idx + 6) % COAT_COLORS.length],
        pants: PANTS_COLORS[idx % PANTS_COLORS.length],
        hair: HAIR_COLORS[idx % HAIR_COLORS.length],
        hasBackpack: true,
        scale: 1.0,
        phase: Math.random() * Math.PI * 2,
      });
    });

    return list;
  }, []);

  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6 }),
    []
  );
  const backpackMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7 }),
    []
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    pedestrians.forEach((p, idx) => {
      const root = rootRefs.current[idx];
      const leftLeg = leftLegRefs.current[idx];
      const rightLeg = rightLegRefs.current[idx];
      const leftArm = leftArmRefs.current[idx];
      const rightArm = rightArmRefs.current[idx];
      const head = headRefs.current[idx];

      if (!root) return;

      const walkCycle = elapsed * (p.speed * 195) + p.phase;
      const swingAngle = Math.sin(walkCycle) * 0.58;

      if (leftLeg) leftLeg.rotation.x = swingAngle;
      if (rightLeg) rightLeg.rotation.x = -swingAngle;
      if (leftArm) leftArm.rotation.x = -swingAngle * 0.75;
      if (rightArm) rightArm.rotation.x = swingAngle * 0.75;

      root.position.y = 0.16 + Math.abs(Math.cos(walkCycle)) * 0.045;
      if (head) head.rotation.y = Math.sin(elapsed * 0.9 + p.phase) * 0.22;

      if (p.mode === 'sidewalk') {
        root.position.x += p.speed * p.dir;
        root.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

        if (p.dir > 0 && root.position.x > p.maxBound) {
          root.position.x = p.minBound;
        } else if (p.dir < 0 && root.position.x < p.minBound) {
          root.position.x = p.maxBound;
        }
      } else {
        root.position.z += p.speed * p.dir;
        root.rotation.y = p.dir > 0 ? 0 : Math.PI;

        if (p.dir > 0 && root.position.z > p.maxBound) {
          p.dir = -1;
        } else if (p.dir < 0 && root.position.z < p.minBound) {
          p.dir = 1;
        }
      }
    });
  });

  return (
    <group>
      {pedestrians.map((p, idx) => {
        const skinMat = new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.65 });
        const coatMat = new THREE.MeshStandardMaterial({ color: p.coat, roughness: 0.75 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: p.pants, roughness: 0.8 });
        const hairMat = new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.7 });

        return (
          <group
            key={p.id}
            ref={(el) => {
              rootRefs.current[idx] = el;
            }}
            position={[p.x, 0.16, p.z]}
            scale={p.scale}
          >
            {/* Torso */}
            <mesh position={[0, 1.12, 0]} material={coatMat} castShadow>
              <boxGeometry args={[0.46, 0.68, 0.26]} />
            </mesh>

            {/* Head Group */}
            <group
              ref={(el) => {
                headRefs.current[idx] = el;
              }}
              position={[0, 1.64, 0]}
            >
              <mesh material={skinMat} castShadow>
                <sphereGeometry args={[0.17, 14, 14]} />
              </mesh>
              <mesh
                position={[0, 0.02, 0]}
                material={hairMat}
              >
                <sphereGeometry args={[0.18, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              </mesh>
            </group>

            {/* Backpack */}
            {p.hasBackpack && (
              <mesh position={[0, 1.15, -0.19]} material={backpackMat}>
                <boxGeometry args={[0.32, 0.42, 0.16]} />
              </mesh>
            )}

            {/* Arms */}
            <group
              ref={(el) => {
                leftArmRefs.current[idx] = el;
              }}
              position={[0.3, 1.4, 0]}
            >
              <mesh position={[0, -0.26, 0]} material={coatMat} castShadow>
                <cylinderGeometry args={[0.075, 0.065, 0.56, 10]} />
              </mesh>
              <mesh position={[0, -0.56, 0]} material={skinMat}>
                <sphereGeometry args={[0.065, 8, 8]} />
              </mesh>
            </group>

            <group
              ref={(el) => {
                rightArmRefs.current[idx] = el;
              }}
              position={[-0.3, 1.4, 0]}
            >
              <mesh position={[0, -0.26, 0]} material={coatMat} castShadow>
                <cylinderGeometry args={[0.075, 0.065, 0.56, 10]} />
              </mesh>
              <mesh position={[0, -0.56, 0]} material={skinMat}>
                <sphereGeometry args={[0.065, 8, 8]} />
              </mesh>
            </group>

            {/* Legs */}
            <group
              ref={(el) => {
                leftLegRefs.current[idx] = el;
              }}
              position={[0.13, 0.78, 0]}
            >
              <mesh position={[0, -0.36, 0]} material={pantsMat} castShadow>
                <cylinderGeometry args={[0.09, 0.075, 0.72, 10]} />
              </mesh>
              <mesh position={[0, -0.73, 0.04]} material={shoeMat}>
                <boxGeometry args={[0.15, 0.1, 0.26]} />
              </mesh>
            </group>

            <group
              ref={(el) => {
                rightLegRefs.current[idx] = el;
              }}
              position={[-0.13, 0.78, 0]}
            >
              <mesh position={[0, -0.36, 0]} material={pantsMat} castShadow>
                <cylinderGeometry args={[0.09, 0.075, 0.72, 10]} />
              </mesh>
              <mesh position={[0, -0.73, 0.04]} material={shoeMat}>
                <boxGeometry args={[0.15, 0.1, 0.26]} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

