import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';
import { AboutPanel } from './panels/AboutPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { ProjectsPanel } from './panels/ProjectsPanel';
import { ResumePanel } from './panels/ResumePanel';
import { ContactPanel } from './panels/ContactPanel';

export const BuildingDrawer: React.FC = () => {
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const closeBuildingModal = useAppStore((s) => s.closeBuildingModal);
  const stepBuilding = useAppStore((s) => s.stepBuilding);
  const drawerRef = useRef<HTMLDivElement>(null);

  const currentBuilding =
    focusedBuildingIndex !== null ? PORTFOLIO_CONTENT.buildings[focusedBuildingIndex] : null;

  // Keyboard navigation & accessibility inside open modal
  useEffect(() => {
    if (!currentBuilding) return;

    // Shift focus into modal container when opened
    if (drawerRef.current) {
      drawerRef.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept arrow navigation if typing in an input or textarea
      const target = document.activeElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable);

      if (e.key === 'Escape') {
        e.preventDefault();
        closeBuildingModal(false);
      } else if (e.key === 'ArrowLeft' && !isInput) {
        e.preventDefault();
        stepBuilding(-1);
      } else if (e.key === 'ArrowRight' && !isInput) {
        e.preventDefault();
        stepBuilding(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBuilding, closeBuildingModal, stepBuilding]);

  const renderPanel = () => {
    switch (focusedBuildingIndex) {
      case 0:
        return <AboutPanel />;
      case 1:
        return <SkillsPanel />;
      case 2:
        return <ProjectsPanel />;
      case 3:
        return <ResumePanel />;
      case 4:
        return <ContactPanel />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {currentBuilding && (
        <motion.div
          ref={drawerRef}
          tabIndex={-1}
          initial={{ opacity: 0, x: 40, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 40, y: 40 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 top-auto sm:top-4 sm:bottom-4 sm:inset-auto sm:right-4 z-50 w-full sm:w-[480px] md:w-[540px] max-h-[85vh] sm:max-h-none glass-panel rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl border border-white/20 overscroll-contain focus:outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Mobile Bottom-Sheet Grab Handle */}
          <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
            <div className="w-12 h-1.5 bg-slate-500/60 rounded-full" />
          </div>

          {/* Drawer Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-900 font-display font-extrabold flex items-center justify-center text-lg shadow-md shrink-0">
                {currentBuilding.number}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {currentBuilding.subtitle}
                </div>
                <h2 id="modal-title" className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
                  {currentBuilding.name} — Aditya Gupta
                </h2>
              </div>
            </div>

            <button
              onClick={() => closeBuildingModal(false)}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition border border-slate-600 shadow-md shrink-0 focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Close Panel (Escape)"
              aria-label="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Dynamic Body Content */}
          <div className="p-6 sm:p-8 overflow-y-auto custom-scroll flex-1 text-base text-slate-200">
            {renderPanel()}
          </div>

          {/* Drawer Footer Navigation (Prev / Hub / Next Building) */}
          <div className="p-5 sm:p-6 border-t border-white/10 flex items-center justify-between gap-3 bg-slate-950/40 shrink-0">
            <button
              onClick={() => stepBuilding(-1)}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white flex items-center gap-2 transition border border-slate-600 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Previous Building (ArrowLeft)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            <button
              onClick={() => closeBuildingModal(true)}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-xs sm:text-sm font-bold text-amber-400 transition flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Overview / Return to Street Hub"
            >
              <Building2 className="w-4 h-4" />
              <span>Go to Hub</span>
            </button>

            <button
              onClick={() => stepBuilding(1)}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white flex items-center gap-2 transition border border-slate-600 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Next Building (ArrowRight)"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
