import React from 'react';
import { Html } from '@react-three/drei';
import { useAppStore } from '../../store/useAppStore';

export const SpeechBubble: React.FC<{
  position?: [number, number, number];
  onWaveClick: () => void;
}> = ({ position = [0, 2.95, 0], onWaveClick }) => {
  const isVisible = useAppStore((s) => s.focusedBuildingIndex === null && s.scrollProgress > 0.88);

  if (!isVisible) return null;

  return (
    <group position={position}>
      <Html center zIndexRange={[24, 0]}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onWaveClick();
          }}
          className="glass-panel px-4 py-2 flex items-center gap-3.5 cursor-pointer hover:border-amber-400 transition shadow-2xl border border-white/20 whitespace-nowrap pointer-events-auto transform hover:scale-105"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-slate-900 text-lg font-extrabold shrink-0 shadow-md">
            👋
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Aditya Gupta
            </div>
            <div className="text-sm font-display font-bold text-white leading-tight mt-0.5">
              Hi! I'm Aditya! Where would you like to go?
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};

