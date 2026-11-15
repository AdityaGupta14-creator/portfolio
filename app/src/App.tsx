import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { CityCanvas } from './scene/CityCanvas';
import { ScrollTrack } from './components/ScrollTrack';
import { NavigationHeader } from './components/NavigationHeader';
import { MobileMenu } from './components/MobileMenu';
import { LoadingScreen } from './components/LoadingScreen';
import { SkyHeroOverlay } from './components/SkyHeroOverlay';
import { TourBanner } from './components/TourBanner';
import { DestinationHub } from './components/DestinationHub';
import { BuildingDrawer } from './components/BuildingDrawer';
import { ClassicView } from './components/ClassicView';
import { Toast } from './components/Toast';
import { AssetDebugPage } from './components/AssetDebugPage';
import { AnimDebugPage } from './components/AnimDebugPage';

export const App: React.FC = () => {
  const viewMode = useAppStore((s) => s.viewMode);
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const isDebugMode = useAppStore((s) => s.isDebugMode);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);

  // Check for /debug/assets route or query parameter (?debug=assets or #/debug/assets)
  const [isDebugRoute, setIsDebugRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.startsWith('/debug/assets') ||
      window.location.search.includes('debug=assets') ||
      window.location.hash.includes('/debug/assets')
    );
  });

  // Check for /debug/anim route or query parameter (?debug=anim or #/debug/anim)
  const [isDebugAnimRoute, setIsDebugAnimRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.startsWith('/debug/anim') ||
      window.location.search.includes('debug=anim') ||
      window.location.hash.includes('/debug/anim')
    );
  });

  useEffect(() => {
    const checkRoute = () => {
      setIsDebugRoute(
        window.location.pathname.startsWith('/debug/assets') ||
          window.location.search.includes('debug=assets') ||
          window.location.hash.includes('/debug/assets')
      );
      setIsDebugAnimRoute(
        window.location.pathname.startsWith('/debug/anim') ||
          window.location.search.includes('debug=anim') ||
          window.location.hash.includes('/debug/anim')
      );
    };
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  // Synchronize document body background with theme
  useEffect(() => {
    document.body.style.backgroundColor = isGoldenEvening ? '#231d33' : '#dbe3ea';
    document.body.style.transition = 'background-color 0.8s ease';
  }, [isGoldenEvening]);

  // Global accessibility keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable);

      if (e.key === 'Escape') {
        const { isMobileMenuOpen, setIsMobileMenuOpen, focusedBuildingIndex, closeBuildingModal } =
          useAppStore.getState();

        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        } else if (focusedBuildingIndex !== null) {
          closeBuildingModal(false);
        }
      } else if ((e.key === 'd' || e.key === 'D') && !isInput) {
        e.preventDefault();
        useAppStore.getState().toggleDebugMode();
      } else if ((e.key === 'b' || e.key === 'B') && !isInput) {
        e.preventDefault();
        useAppStore.getState().toggleTopDownDebug();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Manage body overflow for 3D vs classic view
  useEffect(() => {
    document.body.style.overflowY = 'auto';
  }, [viewMode]);

  // Render developer asset test route
  if (isDebugRoute) {
    return <AssetDebugPage />;
  }

  // Render developer animation test route (/debug/anim)
  if (isDebugAnimRoute) {
    return <AnimDebugPage />;
  }

  return (
    <div className="relative min-h-screen">
      {/* Loading Screen Overlay */}
      <LoadingScreen />

      {/* Top Navigation Bar */}
      <NavigationHeader />

      {/* Full-screen Mobile Menu */}
      <MobileMenu />

      {/* Global Notifications */}
      <Toast />

      {viewMode === '3d' ? (
        <>
          {/* 3D WebGL Canvas Viewport */}
          <CityCanvas />

          {/* Invisible Scroll Track driving Camera Descent */}
          <ScrollTrack />

          {/* Stage 1: Sky Hero Intro */}
          <SkyHeroOverlay />

          {/* Stage 2: Street Tour Banner */}
          <TourBanner />

          {/* Stage 3: Destination Hub */}
          <DestinationHub />

          {/* Building Interior Side Drawer */}
          <BuildingDrawer />
        </>
      ) : (
        /* Accessible 2D Single-Page Layout */
        <ClassicView />
      )}
      {/* Debug Mode Overlap HUD Overlay */}
      {isDebugMode && (
        <div className="fixed bottom-4 left-4 z-50 glass-panel px-4 py-2.5 border border-amber-400/50 text-amber-300 font-mono text-xs flex items-center gap-3 shadow-2xl pointer-events-auto backdrop-blur-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold tracking-wider text-white">DEBUG MODE (Press D)</span>
          <button
            onClick={() => useAppStore.getState().toggleUseOldCity()}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-semibold"
          >
            City: {useAppStore.getState().useOldCity ? 'Procedural Brownstones' : 'Sketchfab City'}
          </button>
          <a
            href="/debug/assets"
            className="ml-2 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors"
          >
            Open /debug/assets ↗
          </a>
        </div>
      )}

      {/* Top-Down Debug View HUD Overlay (Press B) */}
      {isTopDownDebug && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full bg-slate-900/95 border border-cyan-400/60 text-white font-mono text-xs shadow-2xl flex items-center gap-4 backdrop-blur-md pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold tracking-wider text-cyan-300">TOP-DOWN DEBUG VIEW (Press B to toggle)</span>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-slate-300">
            Street Centre: <strong className="text-yellow-400">Z = -0.80</strong> | Pavement Level: <strong className="text-emerald-400">Y = 0.16</strong>
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-slate-300">
            North Facade: <strong className="text-cyan-400">Z = -13.40</strong> | South Facade: <strong className="text-amber-400">Z = +13.40</strong>
          </span>
          <button
            onClick={() => useAppStore.getState().toggleTopDownDebug()}
            className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold"
          >
            Exit Top-Down
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
