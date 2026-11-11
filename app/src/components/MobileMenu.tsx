import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const MobileMenu: React.FC = () => {
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const toggleMobileMenu = useAppStore((s) => s.toggleMobileMenu);
  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
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

          <button
            onClick={toggleTheme}
            className="glass-panel text-white px-6 py-3 mt-6 text-base font-bold flex items-center gap-3 border border-white/20 hover:border-amber-400 transition"
          >
            {isGoldenEvening ? (
              <>
                <Moon className="w-5 h-5 text-amber-300" />
                <span>Golden Evening</span>
              </>
            ) : (
              <>
                <Sun className="w-5 h-5 text-amber-400" />
                <span>Daylight Mode</span>
              </>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
