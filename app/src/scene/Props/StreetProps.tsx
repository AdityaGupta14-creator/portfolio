import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { materials } from '../../utils/proceduralTextures';
import { useAppStore } from '../../store/useAppStore';

interface TreeData {
  x: number;
  z: number;
  scale: number;
  phase: number;
}

export const StreetProps: React.FC = () => {
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const treeCanopyRefs = useRef<(THREE.Group | null)[]>([]);
  const lanternMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Materials for Trees — Stylized, warm natural city park foliage
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 }),
    []
  );
  const canopyMat1 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x426e38, roughness: 0.8 }),
    []
  );
  const canopyMat2 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x507f3f, roughness: 0.75 }),
    []
  );
  const canopyMat3 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x385f30, roughness: 0.82 }),
    []
  );

  // Fire Hydrant & Park Bench Materials
  const redIronMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xb8252a, roughness: 0.45, metalness: 0.3 }),
    []
  );
  const woodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x7c5032, roughness: 0.8 }),
    []
  );

  // Streetlamp Positions
  const lampPositions = useMemo(() => {
    const list: [number, number][] = [];
    for (let lx = -65; lx <= 65; lx += 26) {
      list.push([lx + 9, -6.8]);
    }
    list.push([-28, 6.8]);
    list.push([24, 6.8]);
    return list;
  }, []);

  // Hydrant Positions
  const hydrantPositions = useMemo<[number, number][]>(() => [[-33, -6.8], [19, -6.8]], []);

  // Bench Positions: [x, z, rotY] (Placed along south sidewalk facing street)
  const benchPositions = useMemo<[number, number, number][]>(
    () => [
      [-36, 7.2, 0],
      [8, 7.2, 0],
    ],
    []
  );

  // Sidewalk Street Tree Positions (slender urban sidewalk trees along south curb verge)
  const treeConfigs = useMemo<TreeData[]>(
    () => [
      { x: -68, z: 7.2, scale: 1.0, phase: 0.2 },
      { x: -22, z: 7.2, scale: 1.05, phase: 1.5 },
      { x: 24, z: 7.2, scale: 0.95, phase: 2.8 },
      { x: 68, z: 7.2, scale: 1.02, phase: 4.1 },
    ],
    []
  );

  // Compact elevated canopy puff offsets: [px, py, pz, radius, mat]
  // Elevated above eye level (Y = 4.8m - 7.5m) so they never clip street camera or block facades
  const canopyPuffs = useMemo<Array<[number, number, number, number, THREE.MeshStandardMaterial]>>(
    () => [
      [0, 6.2, 0, 1.8, canopyMat2],
      [-1.1, 5.5, 0.5, 1.4, canopyMat1],
      [1.2, 5.4, 0.4, 1.4, canopyMat1],
      [-0.8, 5.1, -0.9, 1.3, canopyMat3],
      [0.9, 5.2, -0.8, 1.3, canopyMat1],
      [0, 5.3, 1.1, 1.3, canopyMat2],
      [0.4, 6.6, -0.5, 1.4, canopyMat2],
    ],
    [canopyMat1, canopyMat2, canopyMat3]
  );

  // Tree Wind Sway Animation & Lantern Glow
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    // Gentle tree canopy wind sway
    treeCanopyRefs.current.forEach((ref, idx) => {
      if (ref) {
        const phase = treeConfigs[idx].phase;
        ref.rotation.z = Math.sin(elapsed * 1.4 + phase) * 0.025;
      }
    });

    // Lantern warm glow in Golden Evening
    if (lanternMatRef.current) {
      const targetColor = isGoldenEvening ? new THREE.Color(0xffd57a) : new THREE.Color(0xffe9a6);
      lanternMatRef.current.color.lerp(targetColor, 0.05);
    }
  });

  return (
    <group>
      {/* 1. Vintage Cast-Iron Streetlamps */}
      {lampPositions.map(([x, z], idx) => (
        <group key={idx} position={[x, 0, z]}>
          {/* Base */}
          <mesh position={[0, 0.35, 0]} material={materials.ironBlack}>
            <cylinderGeometry args={[0.28, 0.35, 0.7, 10]} />
          </mesh>
          {/* Pole */}
          <mesh position={[0, 2.7, 0]} material={materials.ironBlack} castShadow>
            <cylinderGeometry args={[0.11, 0.18, 5.4, 10]} />
          </mesh>
          {/* Lantern Globe */}
          <mesh position={[0, 5.55, 0]}>
            <sphereGeometry args={[0.38, 14, 14]} />
            <meshBasicMaterial ref={lanternMatRef} color={0xffe9a6} />
          </mesh>
          {/* Cap */}
          <mesh position={[0, 5.92, 0]} material={materials.ironBlack}>
            <coneGeometry args={[0.42, 0.3, 12]} />
          </mesh>
        </group>
      ))}

      {/* 2. Red Cast-Iron Fire Hydrants */}
      {hydrantPositions.map(([x, z], idx) => (
        <group key={idx} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]} material={redIronMat} castShadow>
            <cylinderGeometry args={[0.22, 0.25, 0.85, 10]} />
          </mesh>
          <mesh position={[0, 0.85, 0]} material={redIronMat}>
            <sphereGeometry args={[0.23, 10, 10]} />
          </mesh>
        </group>
      ))}

      {/* 3. Park Benches with Iron Armrests */}
      {benchPositions.map(([x, z, rotY], idx) => (
        <group key={idx} position={[x, 0, z]} rotation={[0, rotY, 0]}>
          {/* Seat */}
          <mesh position={[0, 0.55, 0]} material={woodMat} castShadow>
            <boxGeometry args={[2.4, 0.12, 0.65]} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.9, -0.28]} rotation={[-0.15, 0, 0]} material={woodMat}>
            <boxGeometry args={[2.4, 0.55, 0.1]} />
          </mesh>
          {/* Iron Legs */}
          {[-0.95, 0.95].map((lx) => (
            <mesh key={lx} position={[lx, 0.28, 0]} material={materials.ironBlack}>
              <boxGeometry args={[0.14, 0.55, 0.65]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 4. Stylized Procedural Sidewalk Trees */}
      {treeConfigs.map((t, idx) => (
        <group key={idx} position={[t.x, 0, t.z]} scale={t.scale}>
          {/* Sidewalk Tree Pit Cast-Iron Grate */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.ironBlack}>
            <ringGeometry args={[0.32, 1.05, 16]} />
          </mesh>

          {/* Soft Tree Contact Shadow */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.1, 2.2, 24]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
          </mesh>

          {/* Slender Urban Trunk */}
          <mesh position={[0, 2.5, 0]} material={trunkMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.2, 0.32, 5.0, 10]} />
          </mesh>

          {/* Upper Crown Branches */}
          {[-0.35, 0.35].map((bx, bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, 4.8, bIdx === 0 ? 0.25 : -0.25]}
              rotation={[0, 0, bx * -0.45]}
              material={trunkMat}
            >
              <cylinderGeometry args={[0.14, 0.22, 1.8, 8]} />
            </mesh>
          ))}

          {/* Wind-Swaying Elevated Canopy */}
          <group
            ref={(el) => {
              treeCanopyRefs.current[idx] = el;
            }}
          >
            {canopyPuffs.map(([px, py, pz, r, mat], pIdx) => (
              <mesh key={pIdx} position={[px, py, pz]} material={mat} castShadow receiveShadow>
                <sphereGeometry args={[r, 16, 16]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
};

