import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowDown, Compass, Activity } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const SkyHeroOverlay: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const startStreetTour = useAppStore((s) => s.startStreetTour);
  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);
  const isLoading = useAppStore((s) => s.isLoading);

  // Check URL query parameter: hide performance/stage badges unless ?debug=1
  const isDebug =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  // Live FPS monitor reporting real frame performance on hero (only active when isDebug is true)
  const [fps, setFps] = useState<number>(60);
  useEffect(() => {
    if (!isDebug) return;

    let frames = 0;
    let lastTime = performance.now();
    let animId: number;

    const measure = (now: number) => {
      frames++;
      if (now - lastTime >= 500) {
        const measured = Math.round((frames * 1000) / (now - lastTime));
        if (measured >= 20) {
          setFps(Math.min(60, measured));
        }
        frames = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measure);
    };

    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, [isDebug]);

  const isSignsOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('signs') ||
      new URLSearchParams(window.location.search).get('view') === 'all-signs');

  const isCrosswalkOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('crosswalk') ||
      new URLSearchParams(window.location.search).get('view') === 'crosswalk');

  const isGreetOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('greet') ||
      new URLSearchParams(window.location.search).get('view') === 'greet');

  // Strict visibility: Active at the start of the experience before reaching the avenue (p < 0.16)
  const isVisible =
    !isLoading &&
    focusedBuildingIndex === null &&
    scrollProgress < 0.16 &&
    !isTopDownDebug &&
    !isSignsOverview &&
    !isCrosswalkOverview &&
    !isGreetOverview;

  // As user scrolls, text moves up slowly and fades
  const scrollFade = Math.max(0, 1 - scrollProgress / 0.10);
  const translateY = -scrollProgress * 260; // Pixels to move up

  // Scroll hint fades out after the first slight scroll (p > 0.015)
  const hintOpacity = Math.max(0, 1 - scrollProgress / 0.018);

  return (
    <AnimatePresence>
      {isVisible && (
        <section
          style={{
            opacity: scrollFade,
            transform: `translateY(${translateY}px)`,
            pointerEvents: scrollProgress < 0.08 ? 'auto' : 'none',
          }}
          className="fixed inset-0 z-20 flex flex-col items-center justify-between px-4 sm:px-6 py-10 sm:py-16 text-center select-none"
        >
          {/* Subtle contrast gradient scrim across whole viewport for text clarity */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/15 to-slate-950/35 pointer-events-none -z-20" />

          {/* Top Status & Performance Bar: Only visible when ?debug=1 */}
          <div className="w-full max-w-4xl flex items-center justify-between px-2 pt-2 min-h-[36px]">
            {isDebug ? (
              <>
                {/* Live Performance Badge */}
                <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono font-semibold border-white/20 text-slate-200 shadow-md">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>
                    <strong className="text-emerald-400">{fps}</strong> FPS
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-amber-300">WebGL 3D</span>
                </div>

                {/* Stage Indicator */}
                <div className="hidden sm:inline-flex glass-panel px-3.5 py-1.5 rounded-full text-[11px] font-mono tracking-wider uppercase text-amber-300 border-white/20 shadow-md">
                  Sky Descent · Intro
                </div>
              </>
            ) : (
              <div />
            )}
          </div>

          {/* Center Hero Content with soft dark gradient scrim (feathered radial gradient, no hard box edges) */}
          <div className="relative flex flex-col items-center max-w-3xl my-auto px-4 py-6 w-full">
            {/* Pure radial gradient scrim feathered completely to 0 opacity without rectangular backdrop-blur edges */}
            <div
              className="absolute -inset-x-20 sm:-inset-x-44 -inset-y-24 sm:-inset-y-36 pointer-events-none -z-10"
              style={{
                background:
                  'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(2, 6, 23, 0.72) 0%, rgba(2, 6, 23, 0.45) 45%, rgba(2, 6, 23, 0.15) 75%, rgba(2, 6, 23, 0) 100%)',
              }}
              aria-hidden="true"
            />

            {/* Headline with clamp() sizing, within 3 lines on phone, no horizontal overflow */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.15 }}
              style={{
                fontSize: 'clamp(1.75rem, 4.4vw + 0.5rem, 3.75rem)',
              }}
              className="font-display font-extrabold text-white tracking-tight leading-[1.14] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] max-w-2xl px-1 break-words"
            >
              {PORTFOLIO_CONTENT.hero.headlinePrefix}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-400 drop-shadow">
                {PORTFOLIO_CONTENT.hero.headlineHighlight}
              </span>
            </motion.h1>

            {/* Subline with Open to Internships Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
              className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-2.5 max-w-xl px-2"
            >
              <span className="font-display text-sm sm:text-base md:text-lg font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {PORTFOLIO_CONTENT.hero.subline}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Open to internships
              </span>
            </motion.div>

            {/* Supporting Line: White at 90% opacity */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.55 }}
              className="mt-3 text-white/90 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-lg drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-2"
            >
              {PORTFOLIO_CONTENT.hero.supporting}
            </motion.p>

            {/* Actions: Primary Button & Secondary Link */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.75 }}
              className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-sm sm:max-w-none"
            >
              {/* Primary Button (at least 44px tall) */}
              <button
                onClick={startStreetTour}
                className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
              >
                <span>{PORTFOLIO_CONTENT.hero.primaryButtonText}</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>

              {/* Secondary Link: Skip to projects (at least 44px tall touch target, clearly visible text link with underline on hover) */}
              <button
                onClick={() => focusBuilding(2)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl text-white hover:text-amber-300 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition hover:underline underline-offset-4 decoration-amber-300 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>{PORTFOLIO_CONTENT.hero.secondaryLinkText}</span>
              </button>
            </motion.div>
          </div>

          {/* Bottom Animated Scroll Hint (fades after first scroll, >= 4.5:1 contrast) */}
          <div
            style={{ opacity: hintOpacity }}
            className="flex flex-col items-center gap-2 transition-opacity duration-300 pointer-events-auto"
          >
            <button
              onClick={startStreetTour}
              className="px-5 py-2.5 rounded-full flex items-center gap-2.5 bg-slate-950/80 hover:bg-slate-950/90 border border-white/20 text-white backdrop-blur-md shadow-2xl transition hover:border-amber-400/50 group cursor-pointer"
            >
              <span className="font-mono text-xs sm:text-[13px] font-semibold tracking-wider uppercase text-white drop-shadow">
                {PORTFOLIO_CONTENT.hero.scrollHintText}
              </span>
              <ChevronDown className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>
        </section>
      )}
    </AnimatePresence>
  );
};
