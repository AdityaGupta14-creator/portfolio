import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook to track normalized window scroll progress (0.0 to 1.0)
 * Drives the 3D brownstone avenue camera trajectory.
 */
export function useScrollProgress() {
  const setScrollProgress = useAppStore((s) => s.setScrollProgress);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [setScrollProgress]);
}

