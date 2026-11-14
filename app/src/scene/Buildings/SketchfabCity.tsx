import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CITY_CONFIG } from '../../config/cityConfig';
import { BUILDING_PROXIES, BuildingProxyDef } from '../../data/buildings';
import { DistantSkyline } from '../Environment/DistantSkyline';
import { useAppStore } from '../../store/useAppStore';

// Preload optimized city model with MeshoptDecoder
useGLTF.preload('/models/city.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

interface BuildingInstanceConfig {
  id: string;
  variant: 1 | 2;
  position: [number, number, number];
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  tintColor: string;
  proxy?: BuildingProxyDef;
}

export const SketchfabCity: React.FC = () => {
  const gltf = useGLTF('/models/city.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);

  // URL query parameter ?hover=0 pre-selects hover for testing
  const [hoveredBuildingId, setHoveredBuildingId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.has('hover')) {
        const val = parseInt(p.get('hover') || '-1', 10);
        if (val >= 0 && val < 5) return val;
      }
    }
    return null;
  });

  // Extract reference objects for Building 1_3 and Building 2_2 from loaded GLTF
  const { rawB1, rawB2 } = useMemo(() => {
    let b1: THREE.Object3D | null = null;
    let b2: THREE.Object3D | null = null;

    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((o) => {
      if (o.name === 'Building_1_3' || o.name === 'Building 1_3') b1 = o;
      if (o.name === 'Building_2_2' || o.name === 'Building 2_2') b2 = o;
    });

    // Fallbacks if node naming differs
    if (!b1 || !b2) {
      const children = gltf.scene.children;
      b2 = b2 || children[0] || null;
      b1 = b1 || children[1] || children[0] || null;
    }

    return { rawB1: b1, rawB2: b2 };
  }, [gltf]);

  // Layout all buildings into two facing rows along the avenue
  const buildingsList = useMemo<BuildingInstanceConfig[]>(() => {
    const list: BuildingInstanceConfig[] = [];

    // ── 1. North Row: Main Interactive Street Facades (Z = -19.2) ───────────
    // Filler left buildings
    list.push({
      id: 'north-filler-left-2',
      variant: 1,
      position: [-98, 0, CITY_CONFIG.NORTH_ROW_Z],
      rotationY: 0,
      scaleX: -CITY_CONFIG.SCALE, // Mirrored horizontally
      scaleY: CITY_CONFIG.SCALE * 1.04,
      scaleZ: CITY_CONFIG.SCALE,
      tintColor: '#f8f8f8',
    });
    list.push({
      id: 'north-filler-left-1',
      variant: 2,
      position: [-74, 0, CITY_CONFIG.NORTH_ROW_Z],
      rotationY: 0,
      scaleX: CITY_CONFIG.SCALE,
      scaleY: CITY_CONFIG.SCALE * 0.98,
      scaleZ: CITY_CONFIG.SCALE,
      tintColor: '#ffffff',
    });

    // 5 Core Interactive Facades mapped to BUILDING_PROXIES (natural brick, subtle ±5-8% brightness)
    const tints = ['#ffffff', '#fafafa', '#f6f6f6', '#f8f8f8', '#f2f2f2'];
    BUILDING_PROXIES.forEach((proxy, idx) => {
      list.push({
        id: `interactive-${proxy.id}`,
        variant: proxy.facadeVariant,
        position: [proxy.xPos, 0, CITY_CONFIG.NORTH_ROW_Z],
        rotationY: 0,
        scaleX: idx % 2 === 1 ? -CITY_CONFIG.SCALE : CITY_CONFIG.SCALE,
        scaleY: CITY_CONFIG.SCALE * (1.0 + (idx % 3) * 0.03),
        scaleZ: CITY_CONFIG.SCALE,
        tintColor: tints[idx],
        proxy,
      });
    });

    // Filler right buildings
    list.push({
      id: 'north-filler-right-1',
      variant: 1,
      position: [74, 0, CITY_CONFIG.NORTH_ROW_Z],
      rotationY: 0,
      scaleX: CITY_CONFIG.SCALE,
      scaleY: CITY_CONFIG.SCALE * 1.02,
      scaleZ: CITY_CONFIG.SCALE,
      tintColor: '#f7f7f7',
    });
    list.push({
      id: 'north-filler-right-2',
      variant: 2,
      position: [98, 0, CITY_CONFIG.NORTH_ROW_Z],
      rotationY: 0,
      scaleX: -CITY_CONFIG.SCALE,
      scaleY: CITY_CONFIG.SCALE * 0.96,
      scaleZ: CITY_CONFIG.SCALE,
      tintColor: '#f4f4f4',
    });

    // ── 2. South Row: Facing Buildings (Z = +19.2, rotated 180° into street) ─
    const southXCoords = [-96, -72, -48, -24, 0, 24, 48, 72, 96];
    const southTints = ['#ffffff', '#fafafa', '#f7f7f7', '#fdfdfd', '#f5f5f5', '#f8f8f8', '#fcfcfc', '#f6f6f6', '#f9f9f9'];

    southXCoords.forEach((x, i) => {
      const variant: 1 | 2 = i % 2 === 0 ? 1 : 2;
      const heightVar = 0.94 + ((i * 7) % 15) * 0.01;
      const mirror = i % 3 === 0 ? -1 : 1;

      list.push({
        id: `south-${i}`,
        variant,
        position: [x, 0, CITY_CONFIG.SOUTH_ROW_Z],
        rotationY: Math.PI, // Facing into the street
        scaleX: CITY_CONFIG.SCALE * mirror,
        scaleY: CITY_CONFIG.SCALE * heightVar,
        scaleZ: CITY_CONFIG.SCALE,
        tintColor: southTints[i % southTints.length],
      });
    });

    return list;
  }, []);

  // Material cache to prevent recreating cloned materials every render
  const materialCache = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Factory to clone and configure an individual building node
  const createBuildingClone = (rawObj: THREE.Object3D | null, variant: 1 | 2, tint: string) => {
    if (!rawObj) return null;
    const clone = rawObj.clone(true);

    // Re-centering offset constants (measured from geometry bounds)
    // Building 1: center X = 37.00, base Y = -6.81494, facade front Z = 4.23
    // Building 2: center X = -62.16, base Y = -6.81494, facade front Z = 5.93
    const offsetX = variant === 1 ? -37.00 : 62.16;
    const offsetY = 6.81494;
    const offsetZ = variant === 1 ? -4.23 : -5.93;

    clone.position.set(offsetX, offsetY, offsetZ);

    // Apply material styling: correct colorSpace, roughness 0.8, toneMapped
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material) {
        const origMat = o.material as THREE.MeshStandardMaterial;
        const cacheKey = `${origMat.uuid}_${tint}`;
        if (!materialCache.current.has(cacheKey)) {
          const mat = origMat.clone();
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
          }
          mat.roughness = CITY_CONFIG.ROUGHNESS;
          mat.metalness = CITY_CONFIG.METALNESS;
          mat.toneMapped = true;
          mat.color.set(tint);
          materialCache.current.set(cacheKey, mat);
        }
        o.material = materialCache.current.get(cacheKey)!;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return clone;
  };

  return (
    <group name="SketchfabCity">
      {/* 1. Distant skyline backing the street with muted silhouettes under fog */}
      <DistantSkyline />

      {/* 2. Facing rows of Chicago brownstone buildings */}
      {buildingsList.map((b) => {
        const raw = b.variant === 1 ? rawB1 : rawB2;
        const buildingMesh = createBuildingClone(raw, b.variant, b.tintColor);
        if (!buildingMesh) return null;

        return (
          <group
            key={b.id}
            position={b.position}
            rotation={[0, b.rotationY, 0]}
            scale={[b.scaleX, b.scaleY, b.scaleZ]}
          >
            <primitive object={buildingMesh} />
          </group>
        );
      })}

      {/* 3. 5 Invisible Click-Proxy Boxes with Hover Glow & Floating Street Labels */}
      {BUILDING_PROXIES.map((proxy) => {
        const isHovered = hoveredBuildingId === proxy.id;
        const isFocused = focusedBuildingIndex === proxy.id;

        return (
          <group key={proxy.id} position={[proxy.xPos, 0, proxy.zPos]}>
            {/* Invisible Hitbox Box for Smooth Mouse / Pointer Selection */}
            <mesh
              position={[0, proxy.boxSize[1] / 2, proxy.boxSize[2] / 2 + 1.0]}
              onClick={(e) => {
                e.stopPropagation();
                focusBuilding(proxy.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                setHoveredBuildingId(proxy.id);
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
                setHoveredBuildingId(null);
              }}
            >
              <boxGeometry args={proxy.boxSize} />
              <meshBasicMaterial visible={false} />
            </mesh>

            {/* Entrance Doorway Accent Glow on Hover */}
            {(isHovered || isFocused) && (
              <mesh position={[0, 4.2, 0.4]}>
                <boxGeometry args={[11.5, 8.4, 0.4]} />
                <meshBasicMaterial
                  color={proxy.trimColor}
                  wireframe
                  transparent
                  opacity={isFocused ? 0.85 : 0.45}
                />
              </mesh>
            )}

            {/* Ground Halo Glow under Active / Hovered Building */}
            {(isHovered || isFocused) && (
              <mesh position={[0, 0.05, 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 7.5, 32]} />
                <meshBasicMaterial
                  color={proxy.trimColor}
                  transparent
                  opacity={isFocused ? 0.35 : 0.2}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}

            {/* Floating Street Label above Facade Entrance */}
            <Html
              position={[0, 7.6, 2.5]}
              center
              distanceFactor={22}
              style={{ pointerEvents: 'none', transition: 'all 0.3s ease' }}
            >
              <div
                className={`transition-all duration-300 transform ${
                  isHovered || isFocused
                    ? 'scale-110 -translate-y-1 opacity-100'
                    : 'scale-95 opacity-85 hover:opacity-100'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full backdrop-blur-md shadow-2xl border text-left cursor-pointer pointer-events-auto"
                  style={{
                    backgroundColor: isHovered || isFocused ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.8)',
                    borderColor: isHovered || isFocused ? proxy.trimColor : 'rgba(255, 255, 255, 0.2)',
                    boxShadow: isHovered || isFocused ? `0 0 20px ${proxy.trimColor}44` : 'none',
                  }}
                  onClick={() => focusBuilding(proxy.id)}
                  onMouseEnter={() => setHoveredBuildingId(proxy.id)}
                  onMouseLeave={() => setHoveredBuildingId(null)}
                >
                  {/* Building Number Badge */}
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold text-white shadow-inner"
                    style={{ backgroundColor: proxy.trimColor }}
                  >
                    {proxy.number}
                  </span>

                  {/* Building Title & Name */}
                  <div className="flex flex-col pr-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 font-mono">
                      {proxy.storefrontTitle}
                    </span>
                    <span className="text-xs font-semibold text-white leading-tight">
                      {proxy.name}
                    </span>
                  </div>

                  {/* Click arrow */}
                  <span
                    className="text-xs font-bold transition-transform"
                    style={{ color: proxy.trimColor }}
                  >
                    →
                  </span>
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
