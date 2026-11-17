import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BuildingMeta } from '../../data/content';
import { materials, getStoreSignTexture } from '../../utils/proceduralTextures';
import { useAppStore } from '../../store/useAppStore';

interface BrownstoneBlockProps {
  centerX: number;
  zPos?: number;
  buildingData?: BuildingMeta | null;
  variant?: number;
}

export const BrownstoneBlock: React.FC<BrownstoneBlockProps> = ({
  centerX,
  zPos = -19.2,
  buildingData = null,
  variant = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const focusBuilding = useAppStore((s) => s.focusBuilding);

  const isFocused = buildingData !== null && focusedBuildingIndex === buildingData.id;

  const width = 24;
  const depth = 12.5;
  const baseHeight = variant % 2 === 0 ? 19.8 : 17.6;
  const subWidth = width / 2;

  // Gentle physical lift when focused or hovered
  useFrame(() => {
    if (groupRef.current) {
      const targetY = isFocused ? 0.65 : 0;
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.12;

      const targetScale = isFocused ? 1.015 : 1.0;
      const curScale = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(curScale + (targetScale - curScale) * 0.12);
    }
  });

  // Storefront sign texture memoized
  const signTexture = useMemo(() => {
    if (!buildingData) return null;
    return getStoreSignTexture(buildingData.storefrontTitle, buildingData.number);
  }, [buildingData]);

  // Awning materials
  const awningMats = useMemo(() => {
    const makeMat = (hex: number) =>
      new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78 });

    if (!buildingData) {
      return [makeMat(0x991f2e), makeMat(0xe6dac1)];
    }
    const side0 = buildingData.awningColor;
    const side1 = side0 === 0x991f2e ? 0xe6dac1 : 0x991f2e;
    return [makeMat(side0), makeMat(side1)];
  }, [buildingData]);

  // Reusable door materials
  const doorMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: 0x651d27, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x26343f, roughness: 0.5 }),
    ],
    []
  );

  const planterMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x4b6e35, roughness: 0.9 }),
    []
  );

  const barrelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x624936, roughness: 0.85 }),
    []
  );
  const coneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x382b21, roughness: 0.8 }),
    []
  );

  const handleClick = (e: { stopPropagation: () => void }) => {
    if (buildingData !== null) {
      e.stopPropagation();
      focusBuilding(buildingData.id);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[centerX, 0, zPos]}
      onClick={buildingData ? handleClick : undefined}
      onPointerOver={
        buildingData
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        buildingData
          ? () => {
              document.body.style.cursor = 'default';
            }
          : undefined
      }
    >
      {[0, 1].map((side) => {
        const subX = (side === 0 ? -1 : 1) * (subWidth / 2);
        const matChoice = (side + variant) % 3;
        const mainWallMat =
          matChoice === 0
            ? materials.brickRed
            : matChoice === 1
            ? materials.brickBrown
            : materials.brickTan;
        const subH = side === 0 ? baseHeight : baseHeight - (variant % 2 === 0 ? 1.4 : -1.2);

        // Quoins calculations
        const quoins = [];
        for (let qy = 4.3; qy < subH - 1.1; qy += 0.95) {
          const isLong = Math.floor(qy) % 2 === 0;
          const qW = isLong ? 0.82 : 0.48;
          quoins.push({ qy, qW });
        }

        // Bracket calculations
        const brackets = [];
        for (let bx = -subWidth / 2 + 1; bx <= subWidth / 2 - 1; bx += 2.0) {
          brackets.push(bx);
        }

        const hasBayColumn =
          (side === 0 && variant % 2 === 0) || (side === 1 && variant % 2 === 1);
        const bayHeight = subH - 4.3;
        const bayColX = subX - 3.15;

        // Fire escape calculations
        const feX = subX + (side === 0 ? 1.65 : -0.6);
        const fireEscapes = [];
        for (let fl = 0; fl < 3; fl++) {
          const fy = 4.6 + fl * 4.15;
          if (fy <= subH - 2) {
            fireEscapes.push({ fl, fy });
          }
        }

        // Upper windows calculations
        const upperWindows = [];
        for (let fl = 0; fl < 3; fl++) {
          const wy = 5.75 + fl * 4.15;
          if (wy <= subH - 1.7) {
            for (let col = -1; col <= 1; col++) {
              const wx = subX + col * 3.15;
              const isBayWin = hasBayColumn && col === -1;
              const zOffset = isBayWin ? depth / 2 + 1.05 : depth / 2 + 0.14;
              upperWindows.push({ fl, col, wx, wy, zOffset });
            }
          }
        }

        return (
          <group key={side}>
            {/* Main Townhouse Body */}
            <mesh
              position={[subX, subH / 2, 0]}
              material={mainWallMat}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[subWidth - 0.12, subH, depth]} />
            </mesh>

            {/* Corner Quoins */}
            {quoins.map(({ qy, qW }, idx) => (
              <React.Fragment key={idx}>
                <mesh
                  position={[subX - subWidth / 2 + qW / 2, qy, depth / 2 + 0.06]}
                  material={materials.creamStone}
                >
                  <boxGeometry args={[qW, 0.58, 0.36]} />
                </mesh>
                <mesh
                  position={[subX + subWidth / 2 - qW / 2, qy, depth / 2 + 0.06]}
                  material={materials.creamStone}
                >
                  <boxGeometry args={[qW, 0.58, 0.36]} />
                </mesh>
              </React.Fragment>
            ))}

            {/* Heavy Molded Cornice & Sub-cornice */}
            <mesh
              position={[subX, subH + 0.35, 0.25]}
              material={materials.darkTrim}
              castShadow
            >
              <boxGeometry args={[subWidth + 0.35, 0.95, depth + 0.95]} />
            </mesh>
            <mesh
              position={[subX, subH - 0.25, 0.15]}
              material={materials.creamStone}
            >
              <boxGeometry args={[subWidth + 0.15, 0.45, depth + 0.5]} />
            </mesh>

            {/* Cornice Corbel Brackets */}
            {brackets.map((bx, bIdx) => (
              <mesh
                key={bIdx}
                position={[subX + bx, subH + 0.1, depth / 2 + 0.48]}
                material={materials.darkTrim}
              >
                <boxGeometry args={[0.28, 0.55, 0.45]} />
              </mesh>
            ))}

            {/* Ground-Floor Storefront Base & Windows */}
            <mesh
              position={[subX, 1.95, 0.12]}
              material={materials.darkTrim}
            >
              <boxGeometry args={[subWidth, 3.9, depth + 0.35]} />
            </mesh>
            <mesh
              position={[subX + 0.85, 2.0, depth / 2 + 0.32]}
              material={materials.storefrontWindow}
            >
              <planeGeometry args={[subWidth - 3.1, 2.65]} />
            </mesh>

            {/* Storefront Flanking Pilasters */}
            <mesh
              position={[subX - subWidth / 2 + 0.3, 1.95, depth / 2 + 0.2]}
              material={materials.creamStone}
            >
              <boxGeometry args={[0.55, 3.9, 0.48]} />
            </mesh>
            <mesh
              position={[subX + subWidth / 2 - 0.3, 1.95, depth / 2 + 0.2]}
              material={materials.creamStone}
            >
              <boxGeometry args={[0.55, 3.9, 0.48]} />
            </mesh>

            {/* Storefront Entrance Door & Transom */}
            <mesh
              position={[subX - subWidth / 2 + 1.55, 1.85, depth / 2 + 0.26]}
              material={doorMats[side]}
            >
              <boxGeometry args={[1.5, 2.85, 0.22]} />
            </mesh>
            <mesh
              position={[subX - subWidth / 2 + 1.55, 3.52, depth / 2 + 0.32]}
              material={materials.upperWindow}
            >
              <planeGeometry args={[1.3, 0.55]} />
            </mesh>

            {/* Entrance Stoop Steps */}
            <mesh
              position={[subX - subWidth / 2 + 1.55, 0.25, depth / 2 + 0.72]}
              material={materials.creamStone}
            >
              <boxGeometry args={[2.05, 0.5, 1.35]} />
            </mesh>
            <mesh
              position={[subX - subWidth / 2 + 1.55, 0.55, depth / 2 + 0.5]}
              material={materials.creamStone}
            >
              <boxGeometry args={[1.85, 0.28, 0.85]} />
            </mesh>

            {/* Fabric Canopy Awning & Front Valance */}
            <mesh
              position={[subX + 0.85, 3.65, depth / 2 + 1.15]}
              rotation={[0.36, 0, 0]}
              material={awningMats[side]}
              castShadow
            >
              <boxGeometry args={[subWidth - 2.5, 0.22, 2.35]} />
            </mesh>
            <mesh
              position={[subX + 0.85, 3.12, depth / 2 + 2.22]}
              material={awningMats[side]}
            >
              <boxGeometry args={[subWidth - 2.5, 0.36, 0.12]} />
            </mesh>

            {/* Optional Bay Window Volume */}
            {hasBayColumn && (
              <mesh
                position={[bayColX, 3.9 + bayHeight / 2, depth / 2 + 0.45]}
                material={materials.creamStone}
                castShadow
              >
                <boxGeometry args={[3.25, bayHeight, 1.15]} />
              </mesh>
            )}

            {/* 3 Floors of Upper Windows with Lintels, Sills & Planters */}
            {upperWindows.map(({ fl, col, wx, wy, zOffset }, winIdx) => (
              <React.Fragment key={winIdx}>
                <mesh
                  position={[wx, wy, zOffset]}
                  material={materials.upperWindow}
                >
                  <planeGeometry args={[1.62, 2.45]} />
                </mesh>
                <mesh
                  position={[wx, wy + 1.34, zOffset + 0.04]}
                  material={materials.creamStone}
                >
                  <boxGeometry args={[1.92, 0.34, 0.32]} />
                </mesh>
                <mesh
                  position={[wx, wy - 1.28, zOffset + 0.06]}
                  material={materials.creamStone}
                >
                  <boxGeometry args={[1.88, 0.24, 0.36]} />
                </mesh>
                {(fl + col) % 2 === 0 && (
                  <mesh
                    position={[wx, wy - 1.05, zOffset + 0.15]}
                    material={planterMat}
                  >
                    <boxGeometry args={[1.4, 0.28, 0.28]} />
                  </mesh>
                )}
              </React.Fragment>
            ))}

            {/* Multi-Level Cast Iron Fire Escape */}
            {fireEscapes.map(({ fl, fy }) => (
              <React.Fragment key={fl}>
                <mesh
                  position={[feX, fy, depth / 2 + 0.78]}
                  material={materials.ironBlack}
                  castShadow
                >
                  <boxGeometry args={[4.5, 0.14, 1.45]} />
                </mesh>
                <mesh
                  position={[feX, fy + 0.92, depth / 2 + 1.45]}
                  material={materials.ironBlack}
                >
                  <boxGeometry args={[4.5, 0.08, 0.08]} />
                </mesh>

                {/* Vertical Railing Bars */}
                {[-2.1, -1.68, -1.26, -0.84, -0.42, 0, 0.42, 0.84, 1.26, 1.68, 2.1].map(
                  (rx) => (
                    <mesh
                      key={rx}
                      position={[feX + rx, fy + 0.46, depth / 2 + 1.45]}
                      material={materials.ironBlack}
                    >
                      <boxGeometry args={[0.05, 0.9, 0.05]} />
                    </mesh>
                  )
                )}

                {/* Connecting Diagonal Stairs */}
                {fl < 2 && (
                  <>
                    <mesh
                      position={[feX, fy + 2.1, depth / 2 + 1.02]}
                      rotation={[0, 0, (fl % 2 === 0 ? 1 : -1) * 0.62]}
                      material={materials.ironBlack}
                      castShadow
                    >
                      <boxGeometry args={[0.18, 4.75, 0.42]} />
                    </mesh>
                    <mesh
                      position={[feX, fy + 2.55, depth / 2 + 1.25]}
                      rotation={[0, 0, (fl % 2 === 0 ? 1 : -1) * 0.62]}
                      material={materials.ironBlack}
                    >
                      <boxGeometry args={[0.08, 4.75, 0.08]} />
                    </mesh>
                  </>
                )}
              </React.Fragment>
            ))}
          </group>
        );
      })}

      {/* Rooftop Wooden Water Tower */}
      {(variant % 2 === 0 || buildingData) && (
        <group position={[variant % 2 === 0 ? -2.8 : 3.2, baseHeight + 0.35, -1.6]}>
          {/* Steel Support Legs */}
          <mesh position={[0, 1.15, 0]} material={materials.ironBlack}>
            <cylinderGeometry args={[1.15, 1.45, 2.3, 8, 1, true]} />
          </mesh>

          {/* Timber Water Barrel */}
          <mesh position={[0, 3.25, 0]} material={barrelMat} castShadow>
            <cylinderGeometry args={[1.55, 1.55, 2.9, 16]} />
          </mesh>

          {/* Iron Reinforcing Hoops */}
          {[2.3, 3.2, 4.1].map((hy) => (
            <mesh key={hy} position={[0, hy, 0]} material={materials.ironBlack}>
              <cylinderGeometry args={[1.58, 1.58, 0.1, 16]} />
            </mesh>
          ))}

          {/* Conical Wooden Cap */}
          <mesh position={[0, 5.25, 0]} material={coneMat}>
            <coneGeometry args={[1.72, 1.1, 16]} />
          </mesh>
        </group>
      )}

      {/* Storefront Signboard & Warm Interior Glow Light */}
      {buildingData && signTexture && (
        <>
          <mesh position={[0, 4.65, depth / 2 + 0.52]}>
            <boxGeometry args={[12.8, 2.4, 0.38]} />
            <meshBasicMaterial map={signTexture} />
          </mesh>

          <pointLight
            position={[0, 2.8, depth / 2 + 2.2]}
            color={0xffb86c}
            intensity={0.85}
            distance={14}
          />
        </>
      )}
    </group>
  );
};

