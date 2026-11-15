import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudSun, ArrowDown, Compass } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const SkyHeroOverlay: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const startStreetTour = useAppStore((s) => s.startStreetTour);
  const goToHub = useAppStore((s) => s.goToHub);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);

  const isSignsOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('signs') ||
      new URLSearchParams(window.location.search).get('view') === 'all-signs');

  // Strict mutual exclusivity: Only show when drawer is closed, scrollProgress < 0.11, not in top-down debug view, and not in signs overview
  const isVisible =
    focusedBuildingIndex === null && scrollProgress < 0.11 && !isTopDownDebug && !isSignsOverview;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center px-4 text-center pointer-events-none bg-gradient-to-b from-slate-900/70 via-slate-900/20 to-transparent"
        >
          {/* Intro Badge */}
          <div className="glass-panel px-6 py-2 rounded-full shadow-md mb-5 inline-flex items-center gap-2 text-white text-xs sm:text-sm font-bold tracking-wide uppercase border-white/20 pointer-events-auto">
            <CloudSun className="w-4 h-4 text-amber-400" />
            <span>Interactive 3D City Experience</span>
          </div>

          <div className="flex flex-col items-center max-w-4xl">
            <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-lg leading-tight">
              I build fast, beautiful 3D web <span className="text-amber-400">experiences.</span>
            </h1>

            <p className="mt-4 font-display text-lg sm:text-xl font-bold text-slate-200 drop-shadow-md">
              {PORTFOLIO_CONTENT.personal.name} · {PORTFOLIO_CONTENT.personal.role}
            </p>

            <p className="mt-3 max-w-xl text-slate-300 text-sm sm:text-base font-medium leading-relaxed drop-shadow">
              Scroll down to explore my interactive brownstone avenue.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
              <button
                onClick={startStreetTour}
                className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-xl flex items-center gap-2.5 transition transform hover:-translate-y-0.5"
              >
                <span>Scroll Into The City</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>
              <button
                onClick={goToHub}
                className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white font-bold text-sm shadow-lg flex items-center gap-2 transition"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Skip to City Hub</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
