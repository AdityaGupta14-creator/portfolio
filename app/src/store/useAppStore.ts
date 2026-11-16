import { create } from 'zustand';
import { PORTFOLIO_CONTENT } from '../data/content';
import { FLAGS } from '../config/flags';

export type ThemeMode = 'day' | 'goldenEvening';
export type ViewMode = '3d' | 'classic';

export interface AppState {
  // Flag to switch between legacy procedural city and new GLB assets
  useOldCity: boolean;
  setUseOldCity: (useOld: boolean) => void;
  toggleUseOldCity: () => void;

  // Theme & Atmosphere
  theme: ThemeMode;
  isGoldenEvening: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // View Mode: 3D vs. Accessible 2D
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;

  // Performance Settings
  isLowPerformanceMode: boolean;
  dpr: number;
  shadowsEnabled: boolean;
  activateLowPerformanceMode: () => void;

  // Debug Mode (Sign slots and bounds visualization - Press D)
  isDebugMode: boolean;
  toggleDebugMode: () => void;

  // Dev-only Top-Down Debug View (Press B)
  isTopDownDebug: boolean;
  toggleTopDownDebug: () => void;

  // Dev-only Pedestrian Debug Overlay (Press P)
  isPedestrianDebug: boolean;
  togglePedestrianDebug: () => void;

  // Dev-only Traffic Debug Overlay (Press T)
  isTrafficDebug: boolean;
  toggleTrafficDebug: () => void;

  // Guided Tour & Building State
  currentBuilding: number | null; // Currently focused or nearest building (0..4, or null)
  tourStep: number;               // Current tour step (0..4)
  focusedBuildingIndex: number | null;
  focusBuilding: (index: number) => void;
  closeBuildingModal: (scrollToOverview?: boolean) => void;
  stepBuilding: (delta: number) => void;

  // Project master-detail selection
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;

  // Scroll choreography progress (0.0 to 1.0)
  scrollProgress: number;
  setScrollProgress: (progress: number) => void;

  // Loading & intro states
  isLoading: boolean;
  loadProgress: number;
  setIsLoading: (isLoading: boolean) => void;
  setLoadProgress: (progress: number) => void;

  // Mobile navigation overlay menu
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  // Scroll navigation helpers
  startStreetTour: () => void;
  goToHub: () => void;
  scrollToTopSky: () => void;

  // Toast notifications
  toastMessage: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return '3d';
  const saved = localStorage.getItem('portfolioViewMode') as ViewMode | null;
  if (saved === '3d' || saved === 'classic') return saved;
  // Auto-detect reduced-motion or low device memory (< 4GB)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (prefersReducedMotion || (deviceMemory !== undefined && deviceMemory < 4)) {
    return 'classic';
  }
  return '3d';
};

const getInitialDpr = (): number => {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
};

const getInitialScrollProgress = (): number => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('p')) {
      const val = parseFloat(params.get('p') || '0');
      if (!isNaN(val)) return Math.max(0, Math.min(1, val));
    }
  }
  return 0;
};

const getInitialFocusedBuilding = (): number | null => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('focus')) {
      const val = parseInt(params.get('focus') || '-1', 10);
      if (val >= 0 && val < 5) return val;
    }
  }
  return null;
};

const getInitialIsLoading = (): boolean => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('noloading')) return false;
  }
  return true;
};

export const useAppStore = create<AppState>((set, get) => ({
  // City asset toggle (USE_OLD_CITY safety flag)
  useOldCity: FLAGS.USE_OLD_CITY,
  setUseOldCity: (useOldCity) => set({ useOldCity }),
  toggleUseOldCity: () => {
    const next = !get().useOldCity;
    set({ useOldCity: next });
    get().showToast(next ? 'Switched to Procedural Brownstone City' : 'Switched to Sketchfab City Models');
  },

  // Theme state
  theme: 'day',
  isGoldenEvening: false,
  setTheme: (theme) => set({ theme, isGoldenEvening: theme === 'goldenEvening' }),
  toggleTheme: () => {
    const nextTheme: ThemeMode = get().theme === 'day' ? 'goldenEvening' : 'day';
    set({ theme: nextTheme, isGoldenEvening: nextTheme === 'goldenEvening' });
    get().showToast(
      nextTheme === 'goldenEvening'
        ? 'Switched to Warm Golden Evening Dusk Glow ✨'
        : 'Switched to Classic Daylight Street View ☀️'
    );
  },

  // View mode
  viewMode: getInitialViewMode(),
  setViewMode: (viewMode) => {
    localStorage.setItem('portfolioViewMode', viewMode);
    set({ viewMode });
  },
  toggleViewMode: () => {
    const nextMode: ViewMode = get().viewMode === '3d' ? 'classic' : '3d';
    localStorage.setItem('portfolioViewMode', nextMode);
    set({ viewMode: nextMode });
    get().showToast(`Switched to ${nextMode === '3d' ? 'Interactive 3D Avenue' : 'Accessible 2D Layout'}`);
  },

  // Performance settings
  isLowPerformanceMode: false,
  dpr: getInitialDpr(),
  shadowsEnabled: true,
  activateLowPerformanceMode: () => {
    if (get().isLowPerformanceMode) return;
    set({
      isLowPerformanceMode: true,
      dpr: 1,
      shadowsEnabled: false,
    });
    get().showToast('Performance mode activated for smoother scrolling.');
    console.warn('Performance mode active: Shadows disabled and DPR set to 1 due to FPS drop.');
  },

  // Debug mode
  isDebugMode: false,
  toggleDebugMode: () => {
    const nextDebug = !get().isDebugMode;
    set({ isDebugMode: nextDebug });
    get().showToast(
      nextDebug
        ? '🛠️ Debug Mode: ON — Visualizing Sign Slots & Bounds'
        : '🛠️ Debug Mode: OFF'
    );
  },

  // Dev-only Top-Down Debug View (Press B)
  isTopDownDebug:
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).has('topdown') ||
        new URLSearchParams(window.location.search).has('b')
      : false,
  toggleTopDownDebug: () => {
    const nextTopDown = !get().isTopDownDebug;
    set({ isTopDownDebug: nextTopDown });
    get().showToast(
      nextTopDown
        ? '🗺️ Top-Down Debug View: ON (Press B to exit)'
        : '🏙️ Street View: Restored'
    );
  },

  // Dev-only Pedestrian Debug Overlay (Press P)
  isPedestrianDebug:
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).has('debugpeds') ||
        new URLSearchParams(window.location.search).has('peddebug')
      : false,
  togglePedestrianDebug: () => {
    const nextDebug = !get().isPedestrianDebug;
    set({ isPedestrianDebug: nextDebug });
    get().showToast(
      nextDebug
        ? '🚶 Pedestrian Debug Overlay: ON (Press P to exit)'
        : '🚶 Pedestrian Debug Overlay: OFF'
    );
  },

  // Dev-only Traffic Debug Overlay (Press T)
  isTrafficDebug:
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).has('debugtraffic') ||
        new URLSearchParams(window.location.search).has('trafficdebug')
      : false,
  toggleTrafficDebug: () => {
    const nextDebug = !get().isTrafficDebug;
    set({ isTrafficDebug: nextDebug });
    get().showToast(
      nextDebug
        ? '🚗 Traffic Debug Overlay: ON (Press T to exit)'
        : '🚗 Traffic Debug Overlay: OFF'
    );
  },

  // Tour & Buildings
  currentBuilding: getInitialFocusedBuilding(),
  tourStep: getInitialFocusedBuilding() ?? 0,
  focusedBuildingIndex: getInitialFocusedBuilding(),
  focusBuilding: (index: number) => {
    set({
      currentBuilding: index,
      focusedBuildingIndex: index,
      tourStep: index,
      selectedProjectId: null,
      isMobileMenuOpen: false,
    });
  },
  closeBuildingModal: (scrollToOverview = false) => {
    set({ focusedBuildingIndex: null, selectedProjectId: null });
    if (scrollToOverview) {
      get().goToHub();
    }
  },
  stepBuilding: (delta: number) => {
    const currentIndex = get().focusedBuildingIndex;
    const total = PORTFOLIO_CONTENT.buildings.length;
    if (currentIndex === null) {
      get().focusBuilding(0);
      return;
    }
    const nextIndex = (currentIndex + delta + total) % total;
    get().focusBuilding(nextIndex);
  },

  selectedProjectId: null,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),

  // Scroll Progress
  scrollProgress: getInitialScrollProgress(),
  setScrollProgress: (scrollProgress) => {
    let currentStep = 0;
    if (scrollProgress >= 0.22 && scrollProgress <= 0.90) {
      const normalized = (scrollProgress - 0.22) / (0.90 - 0.22);
      currentStep = Math.min(4, Math.max(0, Math.floor(normalized * 5)));
    } else if (scrollProgress > 0.90) {
      currentStep = 4;
    }

    set({
      scrollProgress,
      tourStep: currentStep,
      currentBuilding: get().focusedBuildingIndex !== null ? get().focusedBuildingIndex : currentStep,
    });
  },

  // Loading
  isLoading: getInitialIsLoading(),
  loadProgress: getInitialIsLoading() ? 0 : 100,
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),

  // Mobile Menu
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  // Scroll Actions
  startStreetTour: () => {
    const track = document.getElementById('scroll-track');
    const maxScroll = track
      ? track.offsetHeight - window.innerHeight
      : document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * 0.28, behavior: 'smooth' });
  },

  goToHub: () => {
    set({ focusedBuildingIndex: null, selectedProjectId: null });
    const track = document.getElementById('scroll-track');
    const maxScroll = track
      ? track.offsetHeight - window.innerHeight
      : document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
  },

  scrollToTopSky: () => {
    set({ focusedBuildingIndex: null, selectedProjectId: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Toast
  toastMessage: null,
  showToast: (msg: string) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      set((current) => (current.toastMessage === msg ? { toastMessage: null } : {}));
    }, 2800);
  },
  clearToast: () => set({ toastMessage: null }),
}));
