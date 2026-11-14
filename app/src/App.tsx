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

export const App: React.FC = () => {
  const viewMode = useAppStore((s) => s.viewMode);
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const isDebugMode = useAppStore((s) => s.isDebugMode);

  // Check for /debug/assets route or query parameter (?debug=assets or #/debug/assets)
  const [isDebugRoute, setIsDebugRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.startsWith('/debug/assets') ||
      window.location.search.includes('debug=assets') ||
      window.location.hash.includes('/debug/assets')
    );
  });

  useEffect(() => {
    const checkRoute = () => {
      setIsDebugRoute(
        window.location.pathname.startsWith('/debug/assets') ||
          window.location.search.includes('debug=assets') ||
          window.location.hash.includes('/debug/assets')
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
          <span className="text-slate-300">
            • <span className="text-emerald-400 font-semibold">Green: Sign Slot</span> •{' '}
            <span className="text-cyan-400 font-semibold">Cyan: Awnings</span> •{' '}
            <span className="text-amber-400 font-semibold">Amber: Facade</span>
          </span>
          <a
            href="/debug/assets"
            className="ml-2 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors"
          >
            Open /debug/assets ↗
          </a>
        </div>
      )}
    </div>
  );
};

export default App;
