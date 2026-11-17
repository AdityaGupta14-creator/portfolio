import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CITY_CONFIG } from '../../config/cityConfig';
import {
  NORTH_ROW_BUILDINGS,
  SOUTH_ROW_BUILDINGS,
  BUILDING_PROXIES,
  RAW_BOUNDS,
} from '../../data/buildings';
import { DistantSkyline } from '../Environment/DistantSkyline';
import { TopDownDebugView } from './TopDownDebugView';
import { StorefrontSignsAndAwnings } from './StorefrontSignsAndAwnings';
import { useAppStore } from '../../store/useAppStore';
import { perfRenderTracker } from '../../utils/perfTracker';

// Preload optimized city model with MeshoptDecoder
useGLTF.preload('/models/city.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

export const SketchfabCity: React.FC = () => {
  perfRenderTracker.mark('SketchfabCity');
  const gltf = useGLTF('/models/city.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);

  // URL query parameter ?hover=0 pre-selects hover for testing
  const [hoveredBuildingId, setHoveredBuildingId] = React.useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.has('hover')) {
        const val = parseInt(p.get('hover') || '-1', 10);
        if (val >= 0 && val < 5) return val;
      }
    }
    return null;
  });

  // Extract each building with full GLTF hierarchy and center it in a dedicated wrapper
  const { rawB1, rawB2 } = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);

    // 1. Building 1_3 wrapper (isolate Building 1_3, center X at 0, base Y at 0, facade front Z at 0)
    const scene1 = gltf.scene.clone(true);
    let b2InScene1: THREE.Object3D | null = null;
    scene1.traverse((o) => {
      if (o.name === 'Building 2_2' || o.name === 'Building_2_2') b2InScene1 = o;
    });
    if (b2InScene1 && (b2InScene1 as THREE.Object3D).parent) {
      (b2InScene1 as THREE.Object3D).parent!.remove(b2InScene1);
    }
    const wrapper1 = new THREE.Group();
    // Measured world offsets: center X = 37.00065, base Y = -6.81494, front Z = 4.22779
    scene1.position.set(-37.00065, 6.81494, -4.22779);
    wrapper1.add(scene1);

    // 2. Building 2_2 wrapper (isolate Building 2_2, center X at 0, base Y at 0, facade front Z at 0)
    const scene2 = gltf.scene.clone(true);
    let b1InScene2: THREE.Object3D | null = null;
    scene2.traverse((o) => {
      if (o.name === 'Building 1_3' || o.name === 'Building_1_3') b1InScene2 = o;
    });
    if (b1InScene2 && (b1InScene2 as THREE.Object3D).parent) {
      (b1InScene2 as THREE.Object3D).parent!.remove(b1InScene2);
    }
    const wrapper2 = new THREE.Group();
    // Measured world offsets: center X = -62.15662, base Y = -6.81494, front Z = 5.92779
    scene2.position.set(62.15662, 6.81494, -5.92779);
    wrapper2.add(scene2);

    return { rawB1: wrapper1, rawB2: wrapper2 };
  }, [gltf]);

  // Combined buildings list: North Row + South Row
  const allBuildings = useMemo(() => {
    return [...NORTH_ROW_BUILDINGS, ...SOUTH_ROW_BUILDINGS];
  }, []);

  // Material cache to prevent recreating cloned materials every render
  const materialCache = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Memoize all building groups once when rawB1 and rawB2 are ready to eliminate re-cloning on hover/focus
  const buildingGroups = useMemo(() => {
    return allBuildings.map((b) => {
      const raw = b.variant === 1 ? rawB1 : rawB2;
      const clone = raw.clone(true);
      clone.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material) {
          const origMat = o.material as THREE.MeshStandardMaterial;
          const cacheKey = `${origMat.uuid}_${b.tintColor}`;
          if (!materialCache.current.has(cacheKey)) {
            const mat = origMat.clone();
            if (mat.map) {
              mat.map.colorSpace = THREE.SRGBColorSpace;
            }
            mat.roughness = CITY_CONFIG.ROUGHNESS;
            mat.metalness = CITY_CONFIG.METALNESS;
            mat.toneMapped = true;
            mat.color.set(b.tintColor);
            materialCache.current.set(cacheKey, mat);
          }
          o.material = materialCache.current.get(cacheKey)!;
          // Hero buildings cast shadow; background buildings receive shadow only
          const isHero = ['101', '103', '105', '107', '109'].includes(b.id);
          o.castShadow = isHero;
          o.receiveShadow = true;
        }
        o.matrixAutoUpdate = false;
        o.updateMatrix();
      });

      const group = new THREE.Group();
      group.name = `BuildingGroup_${b.id}`;
      group.position.set(...b.position);
      group.rotation.set(0, b.rotationY, 0);
      group.scale.set(CITY_CONFIG.SCALE, CITY_CONFIG.SCALE, CITY_CONFIG.SCALE);
      group.matrixAutoUpdate = false;
      group.updateMatrix();
      group.add(clone);
      return { id: b.id, group };
    });
  }, [allBuildings, rawB1, rawB2]);

  return (
    <group name="SketchfabCity">
      {/* 1. Distant skyline backing the street with muted silhouettes under fog */}
      <DistantSkyline />

      {/* 2. Dev-only Top-Down Debug Visualizer (Press B to toggle) */}
      {isTopDownDebug && <TopDownDebugView />}

      {/* 3. Authentic 3D Storefront Signs, Awnings, and Vintage Lamps for 5 Hero Buildings */}
      <StorefrontSignsAndAwnings />

      {/* 4. Two facing rows of continuous Chicago brownstone buildings (Pre-cloned & static) */}
      {buildingGroups.map(({ id, group }) => (
        <primitive key={id} object={group} />
      ))}

      {/* 4. 5 Invisible Click-Proxy Boxes with Hover Glow & Floating Street Labels */}
      {BUILDING_PROXIES.map((proxy) => {
        const isHovered = hoveredBuildingId === proxy.id;
        const isFocused = focusedBuildingIndex === proxy.id;

        return (
          <group key={proxy.id} position={[proxy.xPos, 0, proxy.zPos]}>
            {/* Invisible Hitbox Box Aligned Right to the Entrance Door */}
            <mesh
              position={[0, proxy.boxPos[1], proxy.boxPos[2] - proxy.zPos]}
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
              <mesh position={[0, RAW_BOUNDS.pavementY + 3.2, 0.2]}>
                <boxGeometry args={[4.2, 5.8, 0.4]} />
                <meshBasicMaterial
                  color={proxy.trimColor}
                  wireframe
                  transparent
                  opacity={isFocused ? 0.85 : 0.5}
                />
              </mesh>
            )}

            {/* Ground Halo Glow under Active / Hovered Building Doorstep */}
            {(isHovered || isFocused) && (
              <mesh position={[0, RAW_BOUNDS.pavementY + 0.05, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.5, 4.5, 32]} />
                <meshBasicMaterial
                  color={proxy.trimColor}
                  transparent
                  opacity={isFocused ? 0.4 : 0.25}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}

            {/* Floating Street Label above Facade Entrance (Only shown when hovered or focused, avoiding overlap with sign) */}
            {(isHovered || isFocused) && (
              <Html
                position={[0, proxy.labelPos[1], proxy.labelPos[2] - proxy.zPos]}
                center
                distanceFactor={22}
                style={{ pointerEvents: 'none', transition: 'all 0.3s ease' }}
              >
                <div className="scale-105 opacity-100 transition-all duration-300">
                  <div
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-full backdrop-blur-md shadow-2xl border text-left cursor-pointer pointer-events-auto"
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: proxy.trimColor,
                      boxShadow: `0 0 20px ${proxy.trimColor}44`,
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
            )}
          </group>
        );
      })}
    </group>
  );
};
