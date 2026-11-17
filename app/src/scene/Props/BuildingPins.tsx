import React from 'react';
import { Html } from '@react-three/drei';
import { useAppStore } from '../../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../../data/content';

export const BuildingPins: React.FC = () => {
  const isVisible = useAppStore((s) => s.focusedBuildingIndex === null && s.scrollProgress > 0.14);
  const focusBuilding = useAppStore((s) => s.focusBuilding);

  if (!isVisible) return null;

  return (
    <group>
      {PORTFOLIO_CONTENT.buildings.map((b, idx) => (
        <group key={b.id} position={[b.xPos, 21.8, -13.0]}>
          <Html center distanceFactor={45} zIndexRange={[15, 0]}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                focusBuilding(idx);
              }}
              className="building-pin glass-panel px-3 py-1.5 rounded-2xl shadow-2xl border border-white/25 hover:border-amber-400 flex items-center gap-2 group transition pointer-events-auto transform hover:scale-105"
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold text-slate-950 shrink-0 shadow-sm"
                style={{ backgroundColor: b.trimColor }}
              >
                {b.number}
              </span>
              <div className="text-left pr-1 whitespace-nowrap">
                <div className="text-[10px] uppercase tracking-wider text-slate-300 leading-none">
                  {b.storefrontTitle}
                </div>
                <div className="text-xs font-display font-bold text-white group-hover:text-amber-300 leading-tight">
                  {b.name}
                </div>
              </div>
            </button>
          </Html>
        </group>
      ))}
    </group>
  );
};

