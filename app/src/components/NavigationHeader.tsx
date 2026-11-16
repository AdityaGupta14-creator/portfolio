import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Sunset, Moon, Eye, Image as ImageIcon, Menu, MapPin, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const NavigationHeader: React.FC = () => {
  const currentBuilding = useAppStore((s) => s.currentBuilding);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const skyMode = useAppStore((s) => s.skyMode);
  const cycleSkyMode = useAppStore((s) => s.cycleSkyMode);
  const viewMode = useAppStore((s) => s.viewMode);
  const toggleViewMode = useAppStore((s) => s.toggleViewMode);
  const toggleMobileMenu = useAppStore((s) => s.toggleMobileMenu);
  const focusBuilding = useAppStore((s) => s.focusBuilding);
  const goToHub = useAppStore((s) => s.goToHub);
  const scrollToTopSky = useAppStore((s) => s.scrollToTopSky);

  const [activeClassicSection, setActiveClassicSection] = useState<number>(0);

  // Active section tracking in Classic 2D view
  useEffect(() => {
    if (viewMode !== 'classic') return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      for (let i = PORTFOLIO_CONTENT.buildings.length - 1; i >= 0; i--) {
        const el = document.getElementById(`section-${i}`);
        if (el && el.offsetTop <= scrollPos) {
          setActiveClassicSection(i);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  const activeIndex =
    viewMode === 'classic'
      ? activeClassicSection
      : focusedBuildingIndex !== null
      ? focusedBuildingIndex
      : currentBuilding;

  const handleBrandClick = () => {
    if (viewMode === 'classic') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      scrollToTopSky();
    }
  };

  const handleNavClick = (idx: number, bId: number) => {
    if (viewMode === 'classic') {
      const el = document.getElementById(`section-${bId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      focusBuilding(idx);
    }
  };

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-30 px-4 sm:px-8 py-4 flex items-center justify-between pointer-events-none"
    >
      {/* Brand / Identity Button */}
      <button
        onClick={handleBrandClick}
        className="glass-panel px-4 py-2 flex items-center gap-3.5 pointer-events-auto hover:border-amber-400 transition group text-left shadow-lg"
        aria-label="Scroll to Top / Sky View"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center text-slate-900 font-display font-extrabold text-base shadow-md group-hover:bg-amber-300 transition">
          AG
        </div>
        <div>
          <div className="font-display font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition leading-tight">
            {PORTFOLIO_CONTENT.personal.name}
          </div>
          <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
            Brownstone Ave
          </div>
        </div>
      </button>

      {/* 5 City Buildings Quick-Jump Bar (Desktop) */}
      <nav
        className="hidden lg:flex items-center gap-1.5 glass-panel p-1.5 pointer-events-auto shadow-lg border border-white/10"
        aria-label="Portfolio Sections"
      >
        {PORTFOLIO_CONTENT.buildings.map((b, idx) => {
          const isActive = activeIndex === idx;
          return (
            <button
              key={b.id}
              onClick={() => handleNavClick(idx, b.id)}
              className={`relative px-3.5 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                isActive
                  ? 'bg-white/15 text-amber-300 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  isActive ? 'bg-amber-400' : 'bg-slate-500'
                }`}
              />
              <span>
                {idx + 1}. {b.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Atmosphere & Street Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
        {/* Street Overview / Switch to 3D Button */}
        {viewMode === '3d' ? (
          <button
            onClick={goToHub}
            className="hidden sm:flex glass-panel text-amber-400 px-3.5 py-2 text-xs sm:text-sm font-bold items-center gap-2 hover:border-amber-400 transition shadow-lg"
            title="Street Overview"
            aria-label="Street Overview"
          >
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Street Overview</span>
          </button>
        ) : (
          <button
            onClick={toggleViewMode}
            className="hidden sm:flex glass-panel text-amber-400 px-3.5 py-2 text-xs sm:text-sm font-bold items-center gap-2 hover:border-amber-400 transition shadow-lg"
            title="Switch to 3D Avenue"
            aria-label="Switch to 3D Avenue"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>3D Avenue</span>
          </button>
        )}

        {/* 3-Mode Sky Atmosphere Selector (Morning / Evening / Night) */}
        <button
          onClick={cycleSkyMode}
          className="glass-panel text-white px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 hover:border-amber-400 transition shadow-lg select-none"
          title={`Atmosphere: ${skyMode} (Click to switch)`}
          aria-label={`Current sky mode: ${skyMode}. Click to switch.`}
        >
          {skyMode === 'morning' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Morning</span>
            </>
          ) : skyMode === 'evening' ? (
            <>
              <Sunset className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Evening</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-300" />
              <span className="hidden sm:inline">Night</span>
            </>
          )}
        </button>

        {/* 3D vs Classic View Mode Toggle */}
        <button
          onClick={toggleViewMode}
          className="glass-panel text-white px-3 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 hover:border-amber-400 transition shadow-lg"
          aria-label="Toggle Classic or 3D View"
        >
          {viewMode === '3d' ? (
            <>
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">3D View</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Classic View</span>
            </>
          )}
        </button>

        {/* Mobile Menu Hamburger Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden glass-panel text-amber-400 p-2.5 text-base font-bold flex items-center justify-center shadow-lg hover:border-amber-400 transition"
          aria-label="Open Mobile Menu"
        >
          <Menu className="w-5 h-5 text-amber-400" />
        </button>
      </div>
    </motion.header>
  );
};
