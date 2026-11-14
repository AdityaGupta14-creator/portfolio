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
    for (let z = -4.8; z <= 4.8; z += 1.15) {
      stripesZ.push(z);
    }
    return { crosswalkX, stripesZ };
  }, []);

  const planeGroundGeom = useMemo(() => new THREE.PlaneGeometry(1000, 1000), []);
  const dashGeom = useMemo(() => new THREE.PlaneGeometry(3.4, 0.2), []);
  const stripeGeom = useMemo(() => new THREE.PlaneGeometry(2.8, 0.55), []);

  return (
    <group name="StreetGround">
      {/* 1. Base Dark Foundation Ground (Replaced old olive-green meadow) */}
      <mesh
        geometry={planeGroundGeom}
        material={new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.95 })}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      />

      {/* 2. South Sidewalk (Under south brownstone row Z = +6.0 to +22.0) */}
      <mesh
        position={[0, -0.08, 14.0]}
        material={materials.sidewalk}
        receiveShadow
      >
        <boxGeometry args={[290, 0.40, 16.0]} />
      </mesh>

      {/* 3. South Concrete Curb */}
      <mesh
        position={[0, -0.06, 5.75]}
        material={materials.curb}
        receiveShadow
      >
        <boxGeometry args={[290, 0.44, 0.35]} />
      </mesh>

      {/* 4. Asphalt Street Roadway (Centered at Z = 0) */}
      <mesh
        position={[0, -0.22, 0.0]}
        material={materials.asphalt}
        receiveShadow
      >
        <boxGeometry args={[290, 0.3, 11.2]} />
      </mesh>

      {/* 5. Center Dashed Lane Markings */}
      {dashPositions.map((x) => (
        <mesh
          key={x}
          geometry={dashGeom}
          material={materials.dashLine}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, -0.06, 0.0]}
        />
      ))}

      {/* 6. Zebra Crosswalks */}
      {crosswalks.crosswalkX.map((cx) => (
        <group key={cx} position={[cx, -0.05, 0]}>
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

      {/* 7. North Sidewalk (Under north brownstone row Z = -6.0 to -22.0) */}
      <mesh
        position={[0, -0.08, -14.0]}
        material={materials.sidewalk}
        receiveShadow
      >
        <boxGeometry args={[290, 0.40, 16.0]} />
      </mesh>

      {/* 8. North Concrete Curb */}
      <mesh
        position={[0, -0.06, -5.75]}
        material={materials.curb}
        receiveShadow
      >
        <boxGeometry args={[290, 0.44, 0.35]} />
      </mesh>
    </group>
  );
};

