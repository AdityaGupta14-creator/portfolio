import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const ScrollTrack: React.FC = () => {
  const setScrollProgress = useAppStore((s) => s.setScrollProgress);

  useEffect(() => {
    const handleScroll = () => {
      const track = document.getElementById('scroll-track');
      if (track) {
        const maxScroll = track.offsetHeight - window.innerHeight;
        const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [setScrollProgress]);

  return <div id="scroll-track" className="relative w-full h-[750vh] pointer-events-none z-2" />;
};

