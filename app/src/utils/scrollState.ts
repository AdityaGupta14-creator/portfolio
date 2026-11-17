/**
 * HIGH-PERFORMANCE DAMPED SCROLL STATE
 * Decouples raw scroll events and per-frame 3D camera interpolation from React state.
 * Smooths scroll input using frame-rate independent exponential decay:
 *   smoothed += (target - smoothed) * (1 - Math.exp(-k * dt))
 */

class ScrollStateManager {
  private rawTargetProgress: number = 0;
  private smoothedProgress: number = 0;
  private maxScrollHeight: number = 5000;
  private rafScheduled: boolean = false;
  private lastStoreUpdateP: number = 0;
  private storeUpdateCallback: ((p: number) => void) | null = null;

  init(setStoreProgress: (p: number) => void) {
    this.storeUpdateCallback = setStoreProgress;
    this.updateMaxScroll();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.updateMaxScroll, { passive: true });
      window.addEventListener('scroll', this.handleScroll, { passive: true });

      // Check query parameter ?p=
      const params = new URLSearchParams(window.location.search);
      if (params.has('p')) {
        const p = parseFloat(params.get('p') || '0');
        this.rawTargetProgress = Math.min(1, Math.max(0, p));
        this.smoothedProgress = this.rawTargetProgress;
        this.lastStoreUpdateP = this.smoothedProgress;
        if (this.storeUpdateCallback) this.storeUpdateCallback(this.smoothedProgress);
      } else {
        this.handleScroll();
      }
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.updateMaxScroll);
      window.removeEventListener('scroll', this.handleScroll);
    }
  }

  private updateMaxScroll = () => {
    if (typeof window === 'undefined') return;
    const track = document.getElementById('scroll-track');
    this.maxScrollHeight = track
      ? track.offsetHeight - window.innerHeight
      : document.documentElement.scrollHeight - window.innerHeight;
  };

  private handleScroll = () => {
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(this.onScrollRaf);
    }
  };

  private onScrollRaf = () => {
    this.rafScheduled = false;
    const scrollY = window.scrollY || 0;
    const p = this.maxScrollHeight > 0 ? scrollY / this.maxScrollHeight : 0;
    this.rawTargetProgress = Math.min(1, Math.max(0, p));
  };

  /**
   * Called inside Three.js useFrame loop to smoothly advance damped progress
   * using frame-rate independent exponential decay.
   */
  update(delta: number): number {
    const clampedDt = Math.min(delta, 0.05); // max 1/20s
    // Exponential smoothing constant k = 14 (fast, responsive, zero hitching)
    const factor = 1 - Math.exp(-14 * clampedDt);
    this.smoothedProgress += (this.rawTargetProgress - this.smoothedProgress) * factor;

    // Publish to Zustand store only when crossing discrete intervals (~0.003) to prevent React render storms
    if (Math.abs(this.smoothedProgress - this.lastStoreUpdateP) > 0.0035) {
      this.lastStoreUpdateP = this.smoothedProgress;
      if (this.storeUpdateCallback) {
        this.storeUpdateCallback(this.smoothedProgress);
      }
    }

    return this.smoothedProgress;
  }

  getSmoothedProgress(): number {
    return this.smoothedProgress;
  }

  getRawProgress(): number {
    return this.rawTargetProgress;
  }

  setImmediate(p: number) {
    this.rawTargetProgress = p;
    this.smoothedProgress = p;
    this.lastStoreUpdateP = p;
    if (this.storeUpdateCallback) {
      this.storeUpdateCallback(p);
    }
  }
}

export const scrollState = new ScrollStateManager();

if (typeof window !== 'undefined') {
  (window as any).__scrollState = scrollState;
}
