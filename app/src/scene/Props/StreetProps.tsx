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

  // Materials for Trees
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x6b472c, roughness: 0.9 }),
    []
  );
  const canopyMat1 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x77b352, roughness: 0.78 }),
    []
  );
  const canopyMat2 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x89c360, roughness: 0.75 }),
    []
  );
  const canopyMat3 = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x6aa346, roughness: 0.8 }),
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
    list.push([-28, 5.6]);
    list.push([24, 5.6]);
    return list;
  }, []);

  // Hydrant Positions
  const hydrantPositions = useMemo<[number, number][]>(() => [[-33, -6.8], [19, -6.8]], []);

  // Bench Positions: [x, z, rotY]
  const benchPositions = useMemo<[number, number, number][]>(
    () => [
      [-36, 12.2, Math.PI],
      [6, 12.2, Math.PI],
    ],
    []
  );

  // Tree Positions
  const treeConfigs = useMemo<TreeData[]>(
    () => [
      { x: -62, z: 15.2, scale: 1.25, phase: 0.2 },
      { x: -18, z: 16.5, scale: 1.18, phase: 1.5 },
      { x: 31, z: 14.8, scale: 1.26, phase: 2.8 },
      { x: 72, z: 15.8, scale: 1.12, phase: 4.1 },
    ],
    []
  );

  // Canopy Puff Offsets: [px, py, pz, radius, matIndex]
  const canopyPuffs = useMemo<Array<[number, number, number, number, THREE.MeshStandardMaterial]>>(
    () => [
      [0, 9.1, 0, 3.3, canopyMat2],
      [-2.5, 7.8, 0.8, 2.6, canopyMat1],
      [2.6, 7.7, 0.6, 2.7, canopyMat1],
      [-1.7, 6.9, -1.5, 2.4, canopyMat3],
      [1.9, 7.1, -1.4, 2.5, canopyMat1],
      [0, 7.4, 2.1, 2.4, canopyMat2],
      [-3.3, 6.5, -0.2, 2.0, canopyMat3],
      [3.2, 6.4, -0.3, 2.1, canopyMat2],
      [0.8, 8.6, -1.2, 2.5, canopyMat2],
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

      {/* 4. Stylized Procedural Trees */}
      {treeConfigs.map((t, idx) => (
        <group key={idx} position={[t.x, 0, t.z]} scale={t.scale}>
          {/* Trunk */}
          <mesh position={[0, 3.2, 0]} material={trunkMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.62, 1.35, 6.4, 12]} />
          </mesh>

          {/* Root Flares */}
          {[0, 1, 2, 3, 4].map((r) => {
            const angle = (r / 5) * Math.PI * 2;
            return (
              <mesh
                key={r}
                position={[Math.cos(angle) * 0.85, 0.75, Math.sin(angle) * 0.85]}
                rotation={[Math.sin(angle) * 0.45, 0, Math.cos(angle) * -0.45]}
                material={trunkMat}
              >
                <coneGeometry args={[0.38, 1.8, 8]} />
              </mesh>
            );
          })}

          {/* Branches */}
          {[0, 1, 2, 3].map((b) => (
            <mesh
              key={b}
              position={[(b - 1.5) * 0.75, 5.6, b % 2 === 0 ? 0.45 : -0.45]}
              rotation={[0, 0, (b - 1.5) * -0.38]}
              material={trunkMat}
            >
              <cylinderGeometry args={[0.24, 0.44, 3.5, 8]} />
            </mesh>
          ))}

          {/* Wind-Swaying Canopy */}
          <group
            ref={(el) => {
              treeCanopyRefs.current[idx] = el;
            }}
          >
            {canopyPuffs.map(([px, py, pz, r, mat], pIdx) => (
              <mesh key={pIdx} position={[px, py, pz]} material={mat} castShadow receiveShadow>
                <sphereGeometry args={[r, 20, 20]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
};

