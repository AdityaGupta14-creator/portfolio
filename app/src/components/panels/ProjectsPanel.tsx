import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { useAppStore } from '../../store/useAppStore';
import { GithubIcon } from '../icons/SocialIcons';

export const ProjectsPanel: React.FC = () => {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const { projects } = PORTFOLIO_CONTENT;

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AnimatePresence mode="wait">
      {activeProject ? (
        <motion.div
          key="detail"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex flex-col h-full"
        >
          <button
            onClick={() => setSelectedProjectId(null)}
            className="self-start mb-4 text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to List
          </button>

          <div className="w-full aspect-video bg-slate-800 rounded-xl mb-6 flex items-center justify-center border border-slate-700 shadow-inner">
            <ImageIcon className="w-12 h-12 text-slate-500" />
          </div>

          <h3 className="font-display text-2xl font-bold text-white mb-4">
            {activeProject.title}
          </h3>

          <div className="flex gap-3 mb-6 pb-6 border-b border-white/10">
            {activeProject.live && (
              <a
                href={activeProject.live}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition text-sm flex items-center gap-2 shadow-md"
              >
                <span>Live Demo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {activeProject.code && (
              <a
                href={activeProject.code}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white transition text-sm flex items-center gap-2 shadow-md"
              >
                <GithubIcon className="w-4 h-4" />
                <span>Code</span>
              </a>
            )}
          </div>

          <div className="space-y-5 text-sm leading-relaxed">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                The Challenge
              </div>
              <div className="text-slate-200">{activeProject.problem}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                My Role
              </div>
              <div className="text-slate-200">{activeProject.role}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Tech Stack
              </div>
              <div className="text-slate-200">{activeProject.stack}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                The Result
              </div>
              <div className="text-slate-200">{activeProject.result}</div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="space-y-4"
        >
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className="rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700 hover:border-amber-400/50 transition cursor-pointer flex flex-col group shadow-lg"
            >
              <div className="w-full aspect-video bg-slate-800 relative flex items-center justify-center overflow-hidden border-b border-slate-700">
                <ImageIcon className="w-10 h-10 text-slate-500 group-hover:scale-110 transition duration-300" />
              </div>
              <div className="p-5">
                <h4 className="font-display font-bold text-lg text-white group-hover:text-amber-300 transition">
                  {p.title}
                </h4>
                <p className="text-slate-300 text-xs sm:text-sm mt-1">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
