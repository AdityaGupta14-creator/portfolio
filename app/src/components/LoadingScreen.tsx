import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const LoadingScreen: React.FC = () => {
  const { isLoading, loadProgress, setLoadProgress, setIsLoading, viewMode } = useAppStore();

  useEffect(() => {
    const isNoLoading = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noloading');
    if (viewMode === 'classic' || isNoLoading) {
      setIsLoading(false);
      return;
    }

    // Simulate initial asset & texture loading pipeline
    const interval = setInterval(() => {
      setLoadProgress(Math.min(95, loadProgress + Math.random() * 18));
    }, 120);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setLoadProgress(100);
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }, 1400);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [viewMode]);

  const isNoLoading = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noloading');
  if (!isLoading || viewMode === 'classic' || isNoLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out pointer-events-none ${
        loadProgress === 100 ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="font-display text-2xl font-bold text-white mb-2">Building the City...</h2>
      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-all duration-300 ease-out"
          style={{ width: `${Math.floor(loadProgress)}%` }}
        />
      </div>
      <p className="mt-3 text-slate-400 text-sm font-semibold">{Math.floor(loadProgress)}%</p>
    </div>
  );
};

