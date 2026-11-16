import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowDown, Compass, Activity } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const SkyHeroOverlay: React.FC = () => {
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const startStreetTour = useAppStore((s) => s.startStreetTour);
  const goToHub = useAppStore((s) => s.goToHub);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);
  const isLoading = useAppStore((s) => s.isLoading);

  // Live FPS monitor reporting real frame performance on hero
  const [fps, setFps] = useState<number>(60);
  useEffect(() => {
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
  }, []);

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
          className="fixed inset-0 z-20 flex flex-col items-center justify-between px-4 sm:px-6 py-16 sm:py-20 text-center select-none"
        >
          {/* Subtle contrast gradient scrim for text clarity while preserving vibrant sky colors */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-950/10 to-transparent pointer-events-none -z-10" />

          {/* Top Status & Performance Bar */}
          <div className="w-full max-w-4xl flex items-center justify-between px-2 pt-2">
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
          </div>

          {/* Center Hero Content */}
          <div className="flex flex-col items-center max-w-4xl my-auto px-2">
            {/* Headline fades in over ~1s after loading completes */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.15 }}
              className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-2xl"
            >
              I build fast, beautiful{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                3D web experiences.
              </span>
            </motion.h1>

            {/* Subline */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
              className="mt-4 sm:mt-5 font-display text-base sm:text-xl font-semibold text-slate-200 drop-shadow-md max-w-2xl"
            >
              {PORTFOLIO_CONTENT.personal.name} · {PORTFOLIO_CONTENT.personal.role}
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.55 }}
              className="mt-2 text-slate-300 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-lg drop-shadow"
            >
              Explore an interactive living avenue built with Three.js, React Three Fiber, and real-time physics.
            </motion.p>

            {/* Actions: Primary Button & Skip Link */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.75 }}
              className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md sm:max-w-none"
            >
              {/* Primary Button */}
              <button
                onClick={startStreetTour}
                className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
              >
                <span>Scroll into the city</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>

              {/* Small Text Link */}
              <button
                onClick={goToHub}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-slate-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition hover:underline cursor-pointer"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Skip to City Hub</span>
              </button>
            </motion.div>
          </div>

          {/* Bottom Animated Scroll Hint (fades after first scroll) */}
          <div
            style={{ opacity: hintOpacity }}
            className="flex flex-col items-center gap-1.5 transition-opacity duration-300"
          >
            <span className="font-mono text-[11px] sm:text-xs text-slate-300 font-semibold tracking-wider uppercase drop-shadow">
              Scroll to enter the city
            </span>
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm animate-bounce text-amber-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </section>
      )}
    </AnimatePresence>
  );
};
