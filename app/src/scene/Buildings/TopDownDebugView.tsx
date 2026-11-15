import React from 'react';
import { Html } from '@react-three/drei';
import {
  NORTH_ROW_BUILDINGS,
  SOUTH_ROW_BUILDINGS,
  BUILDING_PROXIES,
  RAW_BOUNDS,
} from '../../data/buildings';

export const TopDownDebugView: React.FC = () => {
  return (
    <group name="TopDownDebugView">
      {/* ── 1. Street Centre Line (Z = -0.80) ─────────────────────────────────── */}
      <mesh position={[0, 0.22, RAW_BOUNDS.streetCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[270, 0.4]} />
        <meshBasicMaterial color="#facc15" depthTest={false} />
      </mesh>

      {/* Street Centre Line Labels at key intervals */}
      {[-50, 0, 50].map((x) => (
        <Html key={x} position={[x, 0.35, RAW_BOUNDS.streetCenterZ]} center distanceFactor={40}>
          <div className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-mono text-[9px] font-black uppercase tracking-wider shadow whitespace-nowrap pointer-events-none">
            Street Centre Line (Z = {RAW_BOUNDS.streetCenterZ.toFixed(2)}m)
          </div>
        </Html>
      ))}

      {/* ── 2. North Row Building Bounding Boxes (Cyan) ───────────────────────── */}
      {NORTH_ROW_BUILDINGS.map((b) => (
        <group key={`debug-${b.id}`}>
          {/* 3D Wireframe Bounding Box */}
          <mesh position={[b.position[0], b.position[1] + b.height / 2, b.boundsCenterZ]}>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshBasicMaterial color="#06b6d4" wireframe />
          </mesh>

          {/* Ground Footprint Perimeter Outline */}
          <mesh position={[b.position[0], 0.2, b.boundsCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[b.width, b.depth]} />
            <meshBasicMaterial color="#0891b2" transparent opacity={0.25} depthTest={false} />
          </mesh>

          {/* Front Facade Alignment Line along Z = -13.40 */}
          <mesh position={[b.position[0], 0.24, RAW_BOUNDS.northRowZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[b.width, 0.15]} />
            <meshBasicMaterial color="#38bdf8" depthTest={false} />
          </mesh>

          {/* Building Label Tag */}
          <Html position={[b.position[0], 12.0, b.boundsCenterZ]} center distanceFactor={45}>
            <div className="bg-slate-900/90 border border-cyan-400/80 rounded px-2 py-1 text-center shadow-lg font-mono text-[9px] text-white whitespace-nowrap pointer-events-none backdrop-blur-sm">
              <div className="font-bold text-cyan-300">
                {b.proxy ? `[${b.proxy.number}] ${b.proxy.storefrontTitle}` : b.id}
              </div>
              <div className="text-slate-300 text-[8px]">
                X: {b.position[0].toFixed(1)} | W: {b.width.toFixed(1)}m | Var {b.variant}
              </div>
            </div>
          </Html>
        </group>
      ))}

      {/* ── 3. South Row Building Bounding Boxes (Amber) ───────────────────────── */}
      {SOUTH_ROW_BUILDINGS.map((b) => (
        <group key={`debug-${b.id}`}>
          {/* 3D Wireframe Bounding Box */}
          <mesh position={[b.position[0], b.position[1] + b.height / 2, b.boundsCenterZ]}>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshBasicMaterial color="#f59e0b" wireframe />
          </mesh>

          {/* Ground Footprint Perimeter Outline */}
          <mesh position={[b.position[0], 0.2, b.boundsCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[b.width, b.depth]} />
            <meshBasicMaterial color="#d97706" transparent opacity={0.25} depthTest={false} />
          </mesh>

          {/* Front Facade Alignment Line along Z = +13.40 */}
          <mesh position={[b.position[0], 0.24, RAW_BOUNDS.southRowZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[b.width, 0.15]} />
            <meshBasicMaterial color="#fbbf24" depthTest={false} />
          </mesh>

          {/* Building Label Tag */}
          <Html position={[b.position[0], 12.0, b.boundsCenterZ]} center distanceFactor={45}>
            <div className="bg-slate-900/90 border border-amber-400/80 rounded px-2 py-1 text-center shadow-lg font-mono text-[9px] text-white whitespace-nowrap pointer-events-none backdrop-blur-sm">
              <div className="font-bold text-amber-300">{b.id} (Facing Street)</div>
              <div className="text-slate-300 text-[8px]">
                X: {b.position[0].toFixed(1)} | W: {b.width.toFixed(1)}m | Var {b.variant}
              </div>
            </div>
          </Html>
        </group>
      ))}

      {/* ── 4. The 5 Clickable Door Zones (Green Highlights) ───────────────────── */}
      {BUILDING_PROXIES.map((proxy) => (
        <group key={`debug-zone-${proxy.id}`}>
          {/* Green Wireframe Box Aligned to Door */}
          <mesh position={proxy.boxPos}>
            <boxGeometry args={proxy.boxSize} />
            <meshBasicMaterial color="#22c55e" wireframe />
          </mesh>

          {/* Green Ground Footprint at Doorway */}
          <mesh
            position={[proxy.boxPos[0], 0.23, proxy.boxPos[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[proxy.boxSize[0], proxy.boxSize[2]]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.5} depthTest={false} />
          </mesh>

          {/* Click Zone Label Tag */}
          <Html position={[proxy.boxPos[0], 4.5, proxy.boxPos[2]]} center distanceFactor={35}>
            <div className="bg-emerald-950/95 border-2 border-emerald-400 rounded-md px-2 py-1 text-center shadow-2xl font-mono text-[10px] text-emerald-200 whitespace-nowrap pointer-events-none backdrop-blur-sm">
              <div className="font-black text-emerald-300">
                CLICK ZONE #{proxy.number}
              </div>
              <div className="text-white text-[9px] font-semibold">{proxy.name} Door</div>
              <div className="text-emerald-400 text-[8px]">
                [{proxy.boxSize[0]}m × {proxy.boxSize[1]}m × {proxy.boxSize[2]}m]
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};
