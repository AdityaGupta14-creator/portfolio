import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export const LoadingScreen: React.FC = () => {
  const { isLoading, loadProgress, setLoadProgress, setIsLoading, viewMode } = useAppStore();
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const isNoLoading =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('noloading');

    if (viewMode === 'classic' || isNoLoading) {
      setIsLoading(false);
      return;
    }

    // Fast, lightweight asset loading simulation (~1.2s total)
    const interval = setInterval(() => {
      setLoadProgress(Math.min(96, loadProgress + Math.random() * 25));
    }, 90);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setLoadProgress(100);
      setIsFadingOut(true);

      setTimeout(() => {
        setIsLoading(false);
      }, 650);
    }, 1100);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [viewMode]);

  const isNoLoading =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('noloading');

  if (!isLoading || viewMode === 'classic' || isNoLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-700 ease-out pointer-events-none ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Sleek Initials Badge */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-display font-black text-2xl tracking-tighter shadow-2xl shadow-amber-500/20 mb-8 border border-amber-300/40">
        AG
      </div>

      {/* Thin Progress Bar */}
      <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-200 ease-out rounded-full"
          style={{ width: `${Math.floor(loadProgress)}%` }}
        />
      </div>

      {/* Subtle percentage */}
      <div className="mt-3 font-mono text-[11px] text-slate-400 tracking-wider">
        {Math.floor(loadProgress)}%
      </div>
    </div>
  );
};
