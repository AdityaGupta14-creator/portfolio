import React, { useEffect } from 'react';
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

export const App: React.FC = () => {
  const viewMode = useAppStore((s) => s.viewMode);
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);

  // Synchronize document body background with theme
  useEffect(() => {
    document.body.style.backgroundColor = isGoldenEvening ? '#231d33' : '#dbe3ea';
    document.body.style.transition = 'background-color 0.8s ease';
  }, [isGoldenEvening]);

  // Global accessibility keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const { isMobileMenuOpen, setIsMobileMenuOpen, focusedBuildingIndex, closeBuildingModal } =
          useAppStore.getState();

        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        } else if (focusedBuildingIndex !== null) {
          closeBuildingModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Manage body overflow for 3D vs classic view
  useEffect(() => {
    document.body.style.overflowY = 'auto';
  }, [viewMode]);

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
    </div>
  );
};

export default App;
