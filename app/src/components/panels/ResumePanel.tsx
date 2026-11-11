import React from 'react';
import { Download } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { useAppStore } from '../../store/useAppStore';

export const ResumePanel: React.FC = () => {
  const { experiences } = PORTFOLIO_CONTENT;
  const showToast = useAppStore((s) => s.showToast);

  const handleDownloadCV = () => {
    const resumeText = [
      `${PORTFOLIO_CONTENT.personal.name.toUpperCase()} — ${PORTFOLIO_CONTENT.personal.role.toUpperCase()}`,
      '=======================================================',
      `Location: Brownstone Avenue Portfolio • ${PORTFOLIO_CONTENT.socials.email}`,
      '',
      'EXPERIENCE:',
      ...PORTFOLIO_CONTENT.experiences.map(
        (exp) => `• ${exp.role} @ ${exp.company} (${exp.year})\n  ${exp.desc}`
      ),
      '',
      'CORE SKILLS:',
      PORTFOLIO_CONTENT.skills.flatMap((s) => s.skills).join(', '),
      '',
      'EDUCATION:',
      'B.Tech in Computer Science & Engineering',
    ].join('\n');

    const blob = new Blob([resumeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Aditya_Gupta_Resume.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded Aditya_Gupta_Resume.txt 📄');
  };

  return (
    <div>
      {/* CV Download Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700 p-5 rounded-xl mb-8 shadow-lg">
        <div>
          <h4 className="font-bold text-white text-sm">Curriculum Vitae</h4>
          <p className="text-xs text-slate-400 mt-1">Download complete software engineering resume</p>
        </div>
        <button
          onClick={handleDownloadCV}
          className="px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>Download CV</span>
        </button>
      </div>

      {/* Experience Timeline */}
      <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-700 pl-8">
        {experiences.map((exp, i) => (
          <div key={i} className="relative">
            <span
              className={`w-3 h-3 rounded-full absolute -left-[37px] top-1.5 ring-4 ring-slate-900 z-10 ${
                i === 0 ? 'bg-amber-400' : 'bg-slate-600'
              }`}
            />
            <div
              className={`text-xs font-bold mb-1 tracking-widest uppercase ${
                i === 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {exp.year}
            </div>
            <h4 className="font-display font-bold text-white text-lg">{exp.role}</h4>
            <div className="text-sm font-semibold text-slate-400 mb-2">{exp.company}</div>
            <p className="text-sm text-slate-300 leading-relaxed">{exp.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

