import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const TourBanner: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const tourStep = useAppStore((s) => s.tourStep);
  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const skipAnimation = useAppStore((s) => s.skipAnimation);
  const toggleSkipAnimation = useAppStore((s) => s.toggleSkipAnimation);

  // Strict mutual exclusivity: Only show between 0.22 and 0.90 when drawer is closed
  const isVisible = focusedBuildingIndex === null && scrollProgress >= 0.22 && scrollProgress <= 0.90;
  const currentBuilding = PORTFOLIO_CONTENT.buildings[tourStep];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 32, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 32, x: '-50%' }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-8 left-1/2 z-20 w-[94%] max-w-2xl pointer-events-auto"
        >
          <div className="glass-panel px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 shadow-2xl border border-white/20">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-display font-bold text-lg sm:text-xl shrink-0 shadow-inner">
                {currentBuilding.number}
              </div>
              <div className="truncate">
                <div className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-amber-400">
                  Aditya's Guided Tour • Place {tourStep + 1} of 5
                </div>
                <h3 className="font-display font-bold text-sm sm:text-base text-white mt-0.5 truncate">
                  {currentBuilding.number} Brownstone Ave — {currentBuilding.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
              {/* Persistent Skip Animation Toggle */}
              <button
                onClick={toggleSkipAnimation}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                  skipAnimation
                    ? 'bg-amber-400/25 border-amber-400 text-amber-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                }`}
                title={
                  skipAnimation
                    ? 'Skip animation is ON (Stops jump instantly). Click to enable walking.'
                    : 'Skip animation is OFF. Click to enable instant jumps. (Space/Esc also skips)'
                }
                aria-label={`Skip animation toggle. Currently ${skipAnimation ? 'ON' : 'OFF'}`}
              >
                <Zap className={`w-3.5 h-3.5 ${skipAnimation ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Skip animation:</span>
                <span
                  className={`uppercase font-extrabold text-[10px] px-1.5 py-0.5 rounded ${
                    skipAnimation ? 'bg-amber-400 text-slate-900' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {skipAnimation ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                onClick={() => focusBuilding(tourStep)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm shrink-0 transition flex items-center gap-1.5 sm:gap-2 shadow-lg"
              >
                <span>Enter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
