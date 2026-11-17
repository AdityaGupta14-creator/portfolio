import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { scrollState } from '../utils/scrollState';

export const ScrollTrack: React.FC = () => {
  const setScrollProgress = useAppStore((s) => s.setScrollProgress);

  useEffect(() => {
    scrollState.init(setScrollProgress);
    return () => scrollState.destroy();
  }, [setScrollProgress]);

  return <div id="scroll-track" className="relative w-full h-[750vh] pointer-events-none z-2" />;
};
