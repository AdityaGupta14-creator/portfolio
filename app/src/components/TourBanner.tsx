import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const TourBanner: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const tourStep = useAppStore((s) => s.tourStep);
  const focusBuilding = useAppStore((s) => s.focusBuilding);

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
          className="fixed bottom-8 left-1/2 z-20 w-[92%] max-w-xl pointer-events-auto"
        >
          <div className="glass-panel px-6 py-4 flex items-center justify-between gap-4 shadow-2xl border border-white/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-display font-bold text-xl shrink-0 shadow-inner">
                {currentBuilding.number}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider font-bold text-amber-400">
                  Aditya's Guided Tour • Place {tourStep + 1} of 5
                </div>
                <h3 className="font-display font-bold text-base sm:text-lg text-white mt-0.5">
                  {currentBuilding.number} Brownstone Ave — {currentBuilding.name}
                </h3>
              </div>
            </div>

            <button
              onClick={() => focusBuilding(tourStep)}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm shrink-0 transition flex items-center gap-2 shadow-lg"
            >
              <span>Enter</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
