import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Sunset, Moon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const MobileMenu: React.FC = () => {
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const toggleMobileMenu = useAppStore((s) => s.toggleMobileMenu);
  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const skyMode = useAppStore((s) => s.skyMode);
  const setSkyMode = useAppStore((s) => s.setSkyMode);
  const viewMode = useAppStore((s) => s.viewMode);

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-6"
        >
          <button
            onClick={toggleMobileMenu}
            className="absolute top-6 right-6 text-white text-3xl p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition border border-slate-700"
            aria-label="Close Menu"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="flex flex-col gap-5 text-center">
            {PORTFOLIO_CONTENT.buildings.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => {
                  toggleMobileMenu();
                  if (viewMode === 'classic') {
                    const sec = document.getElementById(`section-${b.id}`);
                    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    focusBuilding(idx);
                  }
                }}
                className="text-2xl font-display font-bold text-slate-300 hover:text-amber-400 transition"
              >
                {b.number} — {b.name}
              </button>
            ))}
          </div>

          {/* 3-Way Sky Atmosphere Selector (Morning / Evening / Night) */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setSkyMode('morning')}
              className={`glass-panel px-4 py-2.5 text-sm font-bold flex items-center gap-2 border transition rounded-xl ${
                skyMode === 'morning'
                  ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                  : 'border-white/20 text-slate-300 hover:border-white/40'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Morning</span>
            </button>
            <button
              onClick={() => setSkyMode('evening')}
              className={`glass-panel px-4 py-2.5 text-sm font-bold flex items-center gap-2 border transition rounded-xl ${
                skyMode === 'evening'
                  ? 'border-orange-400 bg-orange-400/20 text-orange-300'
                  : 'border-white/20 text-slate-300 hover:border-white/40'
              }`}
            >
              <Sunset className="w-4 h-4 text-orange-400" />
              <span>Evening</span>
            </button>
            <button
              onClick={() => setSkyMode('night')}
              className={`glass-panel px-4 py-2.5 text-sm font-bold flex items-center gap-2 border transition rounded-xl ${
                skyMode === 'night'
                  ? 'border-indigo-400 bg-indigo-400/20 text-indigo-300'
                  : 'border-white/20 text-slate-300 hover:border-white/40'
              }`}
            >
              <Moon className="w-4 h-4 text-indigo-300" />
              <span>Night</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
