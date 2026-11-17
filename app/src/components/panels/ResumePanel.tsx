import React from 'react';
import { Download, GraduationCap, Trophy, CheckCircle2 } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { useAppStore } from '../../store/useAppStore';

export const ResumePanel: React.FC = () => {
  const { education, achievements } = PORTFOLIO_CONTENT;
  const showToast = useAppStore((s) => s.showToast);

  const handleDownloadCV = () => {
    const a = document.createElement('a');
    a.href = '/Aditya_Gupta.pdf';
    a.download = 'Aditya_Gupta.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloading Aditya_Gupta.pdf 📄');
  };

  return (
    <div className="space-y-8">
      {/* CV Download Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700 p-5 rounded-xl shadow-lg">
        <div>
          <h4 className="font-bold text-white text-base">Curriculum Vitae</h4>
          <p className="text-xs text-slate-300 mt-1">
            Aditya_Gupta.pdf • Software Developer Resume (Open to internships)
          </p>
        </div>
        <button
          onClick={handleDownloadCV}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-md cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download CV</span>
        </button>
      </div>

      {/* Education Section */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span>Education</span>
        </h4>

        <div className="space-y-4">
          {education.map((edu, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-amber-400/40 transition shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <h5 className="font-display font-bold text-lg text-white">
                  {edu.degree}
                </h5>
                <span className="text-xs font-mono font-bold text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
                  CGPA {edu.cgpa}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-300 mb-2">
                {edu.institution}
              </div>
              <div className="text-xs text-slate-400 font-mono mb-2">
                {edu.period}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {edu.details}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements & Simulations Section */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Key Achievements &amp; Professional Certifications</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 flex items-start gap-3 hover:border-amber-400/30 transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white leading-snug">
                  {item.title}
                </div>
                {item.badge && (
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300">
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

