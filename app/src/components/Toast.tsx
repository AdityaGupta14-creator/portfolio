import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const Toast: React.FC = () => {
  const toastMessage = useAppStore((s) => s.toastMessage);

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -24, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -24, x: '-50%' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-20 left-1/2 z-[70] glass-panel px-5 py-3 text-white text-sm font-semibold flex items-center gap-3 shadow-2xl border border-amber-400/40 pointer-events-auto"
        >
          <Info className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
