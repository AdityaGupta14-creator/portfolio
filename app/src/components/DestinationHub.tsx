import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, User, Zap, FolderGit2, FileText, Send } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

const ICONS = [User, Zap, FolderGit2, FileText, Send];

export const DestinationHub: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const focusBuilding = useAppStore((s) => s.focusBuilding);

  // Strict mutual exclusivity: Only show when scroll reaches end (> 0.91) and drawer is closed
  const isVisible = focusedBuildingIndex === null && scrollProgress > 0.91;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.section
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 48 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-y-0 right-0 sm:right-8 z-20 flex flex-col justify-center px-4 pointer-events-auto w-full sm:w-[420px]"
        >
          <div className="glass-panel w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scroll border border-white/20">
            <div className="flex flex-col gap-1.5 pb-5 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Aditya's City Hub
              </span>
              <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">
                Where to next?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Select a destination or click any building along the avenue.
              </p>
            </div>

            {/* 5 Destination Cards */}
            <div className="flex flex-col gap-2.5 mt-5">
              {PORTFOLIO_CONTENT.buildings.map((b, idx) => {
                const Icon = ICONS[idx % ICONS.length];
                return (
                  <button
                    key={b.id}
                    onClick={() => focusBuilding(idx)}
                    className="group p-3.5 rounded-xl bg-slate-800/60 hover:bg-amber-400/10 border border-slate-700/80 hover:border-amber-400/50 text-left transition flex items-center gap-4"
                  >
                    <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-amber-400/50 transition">
                      <Icon className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm sm:text-base text-white group-hover:text-amber-300">
                        {b.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        #{b.number} • {b.storefrontTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
