import React, { useMemo } from 'react';
import * as THREE from 'three';
import { materials } from '../../utils/proceduralTextures';

export const StreetGround: React.FC = () => {
  // Dashed lane lines along avenue
  const dashPositions = useMemo(() => {
    const list: number[] = [];
    for (let x = -130; x <= 130; x += 7.5) {
      list.push(x);
    }
    return list;
  }, []);

  // Crosswalk zebra stripes
  const crosswalks = useMemo(() => {
    const crosswalkX = [-39, 13, 65];
    const stripesZ: number[] = [];
    for (let z = -5.6; z <= 3.8; z += 1.15) {
      stripesZ.push(z);
    }
    return { crosswalkX, stripesZ };
  }, []);

  const planeGroundGeom = useMemo(() => new THREE.PlaneGeometry(1000, 1000), []);
  const dashGeom = useMemo(() => new THREE.PlaneGeometry(3.4, 0.2), []);
  const stripeGeom = useMemo(() => new THREE.PlaneGeometry(2.8, 0.55), []);

  return (
    <group>
      {/* 1. Base Meadow Infinite Ground */}
      <mesh
        geometry={planeGroundGeom}
        material={new THREE.MeshStandardMaterial({ color: 0x8eb939, roughness: 1.0 })}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      />

      {/* 2. Foreground Park Lawn */}
      <mesh
        position={[0, -0.08, 24.5]}
        material={materials.grass}
        receiveShadow
      >
        <boxGeometry args={[290, 0.65, 28]} />
      </mesh>

      {/* 3. Cobblestone Promenade / Front Sidewalk */}
      <mesh
        position={[0, -0.14, 9.2]}
        material={materials.sidewalk}
        receiveShadow
      >
        <boxGeometry args={[290, 0.48, 8.2]} />
      </mesh>

      {/* 4. Front Concrete Curb */}
      <mesh
        position={[0, -0.1, 5.1]}
        material={materials.curb}
        receiveShadow
      >
        <boxGeometry args={[290, 0.54, 0.45]} />
      </mesh>

      {/* 5. Asphalt Street Roadway */}
      <mesh
        position={[0, -0.25, -0.8]}
        material={materials.asphalt}
        receiveShadow
      >
        <boxGeometry args={[290, 0.3, 11.8]} />
      </mesh>

      {/* 6. Center Dashed Lane Markings */}
      {dashPositions.map((x) => (
        <mesh
          key={x}
          geometry={dashGeom}
          material={materials.dashLine}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, -0.08, -0.8]}
        />
      ))}

      {/* 7. Zebra Crosswalks */}
      {crosswalks.crosswalkX.map((cx) => (
        <group key={cx} position={[cx, -0.07, 0]}>
          {crosswalks.stripesZ.map((z) => (
            <mesh
              key={z}
              geometry={stripeGeom}
              material={materials.dashLine}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, z]}
            />
          ))}
        </group>
      ))}

      {/* 8. Rear Sidewalk (Brownstone Frontage) */}
      <mesh
        position={[0, -0.1, -9.8]}
        material={materials.sidewalk}
        receiveShadow
      >
        <boxGeometry args={[290, 0.52, 7.2]} />
      </mesh>

      {/* 9. Rear Concrete Curb */}
      <mesh
        position={[0, -0.08, -6.3]}
        material={materials.curb}
        receiveShadow
      >
        <boxGeometry args={[290, 0.56, 0.45]} />
      </mesh>
    </group>
  );
};

