import React from 'react';
import { User, Sparkles, Trophy, Award, Medal, Mail } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { GithubIcon, LinkedinIcon } from '../icons/SocialIcons';

export const AboutPanel: React.FC = () => {
  const { personal, socials } = PORTFOLIO_CONTENT;

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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>{personal.statusTag || 'Open to internships'}</span>
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

      {/* Real Highlights Grid (Replacing placeholder stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center text-center shadow-md">
          <Trophy className="w-5 h-5 text-amber-400 mb-1" />
          <div className="text-white text-xs font-bold">E-Cell Eureka 2026</div>
          <div className="text-amber-400 text-[11px] font-semibold mt-0.5">Winner 🏆</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center text-center shadow-md">
          <Award className="w-5 h-5 text-amber-400 mb-1" />
          <div className="text-white text-xs font-bold">AI-Prompt Night</div>
          <div className="text-amber-400 text-[11px] font-semibold mt-0.5">Winner 🥇</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center text-center shadow-md">
          <Medal className="w-5 h-5 text-amber-400 mb-1" />
          <div className="text-white text-xs font-bold">TCS College Hack</div>
          <div className="text-amber-400 text-[11px] font-semibold mt-0.5">Top 8 Finalist 🚀</div>
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

      {/* Education Summary Card */}
      <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-300">
          <strong className="text-white block font-semibold mb-1">Academic Background</strong>
          Second-year B.Tech in Electronics &amp; Computer Science at Vidyalankar Institute of Technology, Mumbai (Expected 2029) • First Year CGPA: <strong className="text-amber-300">9.38 / 10.0</strong>.
        </div>
      </div>

      {/* Contact & Credits Footer */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-2 mt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-slate-300">
          <a
            href={`mailto:${socials.email}`}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition font-medium"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{socials.email}</span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href={socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-white transition"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <span>•</span>
            <a
              href={socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-white transition"
            >
              <LinkedinIcon className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          3D Assets: &ldquo;Generic passenger car pack&rdquo; by Comrade1280, CC BY 4.0, via Sketchfab.
        </div>
      </div>
    </div>
  );
};

