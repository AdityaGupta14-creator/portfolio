import React from 'react';
import { Layout, Box, Server, Wrench } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Layout,
  Box,
  Server,
  Wrench,
};

export const SkillsPanel: React.FC = () => {
  const { skills } = PORTFOLIO_CONTENT;

  return (
    <div className="space-y-6">
      <p className="text-slate-300 text-sm">
        Inside <strong className="text-white">Tech Foundry</strong> is my engineering workshop. Here is my core toolkit:
      </p>

      <div className="space-y-6">
        {skills.map((category, idx) => {
          const Icon = ICON_MAP[category.icon] || Box;
          return (
            <div key={idx}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Icon className="w-4 h-4 text-amber-400" />
                <span>{category.title}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-sm font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-700 shadow-sm"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

