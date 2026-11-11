import React from 'react';
import { User, Sparkles } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';

export const AboutPanel: React.FC = () => {
  const { personal } = PORTFOLIO_CONTENT;

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-24 h-24 rounded-2xl bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-xl">
          {personal.avatarUrl ? (
            <img src={personal.avatarUrl} alt={personal.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-slate-400" />
          )}
        </div>

        <div>
          {personal.isOpenToWork && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span>Open to Work</span>
            </div>
          )}

          <h3 className="font-display text-2xl font-bold text-white tracking-tight">
            {personal.name}
          </h3>
          <p className="text-amber-400 text-xs sm:text-sm font-bold mt-1 uppercase tracking-widest">
            {personal.role}
          </p>
        </div>
      </div>

      {/* Bio Description */}
      <div className="space-y-4 leading-relaxed text-slate-300 text-sm sm:text-base border-t border-white/10 pt-4">
        <p>
          Welcome to <strong className="text-white">The Studio</strong>. {personal.bioIntro}
        </p>
        {personal.bioDetails.map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}
      </div>

      {/* Focus & Philosophy Card */}
      <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3 mt-2">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-300">
          <strong className="text-white block font-semibold mb-1">Philosophy</strong>
          Crafting web environments where performance meets artistry—interactive 3D, responsive typography, and tactile UI feedback.
        </div>
      </div>
    </div>
  );
};

