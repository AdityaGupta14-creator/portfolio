import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { GithubIcon, LinkedinIcon, TwitterIcon } from '../icons/SocialIcons';

export const ContactPanel: React.FC = () => {
  const { socials } = PORTFOLIO_CONTENT;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus('error');
      return;
    }

    setStatus('sending');
    setTimeout(() => {
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
      setTimeout(() => {
        setStatus('idle');
      }, 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <p className="text-slate-300 text-sm">
        Have a project or idea? Let's build something great together. Send a message below:
      </p>

      {/* Validated Contact Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400 transition placeholder:text-slate-500"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Your Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400 transition placeholder:text-slate-500"
              placeholder="jane@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Message
          </label>
          <textarea
            rows={4}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400 transition placeholder:text-slate-500 resize-none"
            placeholder="Let's talk about..."
          />
        </div>

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full py-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-75 text-slate-900 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg"
        >
          {status === 'sending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-800" />
              <span>Sent Successfully!</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </>
          )}
        </button>

        {status === 'success' && (
          <div className="text-xs font-bold text-center mt-2 px-4 py-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
            Thanks for reaching out! I'll get back to you soon.
          </div>
        )}
      </form>

      {/* Social and Direct Links */}
      <div className="pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-slate-300">
        <a
          href={`mailto:${socials.email}`}
          className="flex items-center gap-2 hover:text-amber-400 transition"
          title={`Email ${socials.email}`}
        >
          <Mail className="w-4 h-4 text-amber-400" />
          <span className="font-medium">{socials.email}</span>
        </a>

        <div className="flex items-center gap-2.5">
          {socials.github && (
            <a
              href={socials.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              title="GitHub Profile"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-amber-400 hover:text-slate-900 transition text-sm shadow-md"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
          )}
          {socials.linkedin && (
            <a
              href={socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              title="LinkedIn Profile"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-amber-400 hover:text-slate-900 transition text-sm shadow-md"
            >
              <LinkedinIcon className="w-4 h-4" />
            </a>
          )}
          {socials.twitter && (
            <a
              href={socials.twitter}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X Profile"
              title="Twitter / X Profile"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-amber-400 hover:text-slate-900 transition text-sm shadow-md"
            >
              <TwitterIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
