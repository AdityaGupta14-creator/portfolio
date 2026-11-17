import React from 'react';
import { User, Zap, FolderGit2, FileText, Send, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';
import { AboutPanel } from './panels/AboutPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { ProjectsPanel } from './panels/ProjectsPanel';
import { ResumePanel } from './panels/ResumePanel';
import { ContactPanel } from './panels/ContactPanel';

const ICONS = [User, Zap, FolderGit2, FileText, Send];

export const ClassicView: React.FC = () => {
  const { personal, buildings } = PORTFOLIO_CONTENT;
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const toggleViewMode = useAppStore((s) => s.toggleViewMode);

  const renderContent = (id: number) => {
    switch (id) {
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
    <main className="relative z-10 pt-28 pb-24 px-4 sm:px-8 max-w-4xl mx-auto space-y-12 transition-colors duration-700">
      {/* Intro Header */}
      <section className="text-center mb-14 pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-500 text-xs font-bold uppercase tracking-wider mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Accessible 2D Layout</span>
          <button
            onClick={toggleViewMode}
            className="ml-2 text-amber-500 underline hover:text-amber-400 transition"
          >
            Switch to 3D Avenue &rarr;
          </button>
        </div>

        <h1
          className={`font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 transition-colors ${
            isGoldenEvening ? 'text-white' : 'text-slate-900'
          }`}
        >
          {personal.name}
        </h1>
        <p
          className={`text-lg sm:text-xl font-bold mb-2 transition-colors ${
            isGoldenEvening ? 'text-amber-300' : 'text-slate-800'
          }`}
        >
          {personal.role}
        </p>
        <p
          className={`text-base transition-colors ${
            isGoldenEvening ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {personal.tagline}
        </p>
      </section>

      {/* 5 Content Sections */}
      {buildings.map((b, idx) => {
        const Icon = ICONS[idx % ICONS.length];
        return (
          <section
            key={b.id}
            id={`section-${b.id}`}
            aria-labelledby={`heading-${b.id}`}
            className="glass-panel p-6 sm:p-10 !bg-slate-900 !text-slate-200 border !border-slate-800 shadow-2xl relative overflow-hidden rounded-2xl scroll-mt-24"
          >
            <div
              className="absolute top-0 left-0 w-2 h-full"
              style={{ backgroundColor: b.trimColor }}
            />
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg shrink-0"
                style={{
                  backgroundColor: `${b.trimColor}20`,
                  color: b.trimColor,
                  border: `1px solid ${b.trimColor}50`,
                }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {b.subtitle}
                </div>
                <h2 id={`heading-${b.id}`} className="font-display text-2xl sm:text-3xl font-bold text-white">
                  {b.name}
                </h2>
              </div>
            </div>
            <div className="text-base leading-relaxed">{renderContent(b.id)}</div>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="pt-8 pb-12 text-center text-xs text-slate-400 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          © 2026 {personal.name} • {personal.role}
        </div>
        <div className="flex items-center gap-4">
          <a href={`mailto:${PORTFOLIO_CONTENT.socials.email}`} className="text-amber-400 hover:underline font-medium">
            {PORTFOLIO_CONTENT.socials.email}
          </a>
          <span>•</span>
          <a href={PORTFOLIO_CONTENT.socials.github} target="_blank" rel="noopener noreferrer" className="hover:text-white transition font-medium">
            GitHub
          </a>
          <span>•</span>
          <a href={PORTFOLIO_CONTENT.socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white transition font-medium">
            LinkedIn
          </a>
        </div>
      </footer>
    </main>
  );
};

