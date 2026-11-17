import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
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
            <ArrowLeft className="w-3.5 h-3.5" /> Back to All Projects
          </button>

          {activeProject.badge && (
            <div className="mb-2">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                {activeProject.badge}
              </span>
            </div>
          )}

          <h3 className="font-display text-2xl font-bold text-white mb-2">
            {activeProject.title}
          </h3>

          <p className="text-slate-300 text-sm mb-5 leading-relaxed">
            {activeProject.desc}
          </p>

          {/* Live and Code action buttons (shown only when URL is configured) */}
          {((activeProject.liveUrl || activeProject.live) || (activeProject.repoUrl || activeProject.code)) && (
            <div className="flex gap-3 mb-6 pb-6 border-b border-white/10">
              {(activeProject.liveUrl || activeProject.live) && (
                <a
                  href={activeProject.liveUrl || activeProject.live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition text-sm flex items-center gap-2 shadow-md"
                >
                  <span>Live Demo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {(activeProject.repoUrl || activeProject.code) && (
                <a
                  href={activeProject.repoUrl || activeProject.code}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition text-sm flex items-center gap-2 shadow-md"
                >
                  <GithubIcon className="w-4 h-4" />
                  <span>Code</span>
                </a>
              )}
            </div>
          )}

          <div className="space-y-5 text-sm leading-relaxed">
            {/* Role Bullets */}
            {activeProject.bullets && activeProject.bullets.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Key Responsibilities &amp; Implementation
                </div>
                <ul className="space-y-2 list-disc list-inside text-slate-200">
                  {activeProject.bullets.map((b, i) => (
                    <li key={i} className="leading-relaxed">
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tech Stack Chips */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tech Stack &amp; Architecture
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeProject.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-amber-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
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
          {projects.map((p) => {
            const hasLive = !!(p.liveUrl || p.live);
            const hasCode = !!(p.repoUrl || p.code);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className="rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700 hover:border-amber-400/50 transition cursor-pointer flex flex-col group shadow-lg p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="font-display font-bold text-lg text-white group-hover:text-amber-300 transition">
                    {p.title}
                  </h4>
                  {p.badge && (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      {p.badge}
                    </span>
                  )}
                </div>

                {/* One-Line Summary */}
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-3">
                  {p.desc}
                </p>

                {/* Role Bullets */}
                {p.bullets && p.bullets.length > 0 && (
                  <ul className="space-y-1.5 mb-3 text-xs text-slate-300 list-disc list-inside">
                    {p.bullets.map((b, i) => (
                      <li key={i} className="leading-relaxed">
                        <span className="text-slate-200">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tech Tags */}
                <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Live and Code Action Buttons (shown ONLY when a URL is configured) */}
                {(hasLive || hasCode) && (
                  <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-slate-700/60">
                    {hasLive && (
                      <a
                        href={p.liveUrl || p.live}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                      >
                        <span>Live</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {hasCode && (
                      <a
                        href={p.repoUrl || p.code}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                      >
                        <GithubIcon className="w-3.5 h-3.5" />
                        <span>Code</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
