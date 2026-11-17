import * as THREE from 'three';

// ── 1. Component Re-render Tracker ──────────────────────────────────────────
export interface RenderStats {
  counts: Record<string, number>;
  rates: Record<string, number>;
  totalRate: number;
}

class PerfRenderTracker {
  private counts: Record<string, number> = {};
  public rates: Record<string, number> = {};
  public totalRate: number = 0;
  private lastTick: number = performance.now();

  mark(name: string) {
    this.counts[name] = (this.counts[name] || 0) + 1;
  }

  tick() {
    const now = performance.now();
    const elapsed = (now - this.lastTick) / 1000;
    if (elapsed < 0.5) return;

    let sum = 0;
    const newRates: Record<string, number> = {};
    for (const key in this.counts) {
      const rate = Math.round((this.counts[key] / elapsed) * 10) / 10;
      newRates[key] = rate;
      sum += rate;
      this.counts[key] = 0;
    }
    this.rates = newRates;
    this.totalRate = Math.round(sum * 10) / 10;
    this.lastTick = now;
  }
}

export const perfRenderTracker = new PerfRenderTracker();

// ── 2. Live Performance Snapshot & Scenario Recorder ────────────────────────
export interface PerfSnapshot {
  fps: number;
  frameTimeMs: number;
  worstFrame5sMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heapMB: number;
  reRendersPerSec: number;
  reRendersByComponent: Record<string, number>;
}

export interface ScenarioResult {
  scenario: string;
  durationMs: number;
  sampleCount: number;
  avgFps: number;
  worstFrameMs: number;
  minFps: number;
  avgDrawCalls: number;
  avgTriangles: number;
  avgHeapMB: number;
  reRendersPerSec: number;
}

class PerfMetricsManager {
  private frameTimes5s: { time: number; dt: number }[] = [];
  private lastFrameTimestamp: number = performance.now();
  private fpsFrames: number = 0;
  private fpsLastCalc: number = performance.now();
  private currentFps: number = 60;
  private currentFrameTime: number = 16.6;

  // Active scenario recording
  private activeScenario: string | null = null;
  private scenarioStartTime: number = 0;
  private scenarioSamples: {
    dt: number;
    drawCalls: number;
    triangles: number;
    heapMB: number;
  }[] = [];
  public recordedScenarios: Record<string, ScenarioResult> = {};

  public latestSnapshot: PerfSnapshot = {
    fps: 60,
    frameTimeMs: 16.6,
    worstFrame5sMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    heapMB: 0,
    reRendersPerSec: 0,
    reRendersByComponent: {},
  };

  recordFrame(gl: THREE.WebGLRenderer) {
    const now = performance.now();
    const dt = now - this.lastFrameTimestamp;
    this.lastFrameTimestamp = now;

    if (dt > 0 && dt < 1000) {
      this.currentFrameTime = dt;
      this.frameTimes5s.push({ time: now, dt });
    }

    // Purge records older than 5 seconds
    const cutoff = now - 5000;
    while (this.frameTimes5s.length > 0 && this.frameTimes5s[0].time < cutoff) {
      this.frameTimes5s.shift();
    }

    // Compute worst frame in last 5 seconds
    let worst = 0;
    for (let i = 0; i < this.frameTimes5s.length; i++) {
      if (this.frameTimes5s[i].dt > worst) worst = this.frameTimes5s[i].dt;
    }

    // Calculate rolling FPS
    this.fpsFrames++;
    const fpsElapsed = now - this.fpsLastCalc;
    if (fpsElapsed >= 500) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / fpsElapsed);
      this.fpsFrames = 0;
      this.fpsLastCalc = now;
      perfRenderTracker.tick();
    }

    // Heap measurement
    let heapMB = 0;
    if (typeof window !== 'undefined' && (performance as any).memory) {
      heapMB = Math.round(((performance as any).memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    }

    const info = gl.info;
    const drawCalls = info.render.calls;
    const triangles = info.render.triangles;
    const geometries = info.memory.geometries;
    const textures = info.memory.textures;

    this.latestSnapshot = {
      fps: this.currentFps,
      frameTimeMs: Math.round(this.currentFrameTime * 10) / 10,
      worstFrame5sMs: Math.round(worst * 10) / 10,
      drawCalls,
      triangles,
      geometries,
      textures,
      heapMB,
      reRendersPerSec: perfRenderTracker.totalRate,
      reRendersByComponent: { ...perfRenderTracker.rates },
    };

    // If recording scenario, gather sample
    if (this.activeScenario) {
      this.scenarioSamples.push({
        dt,
        drawCalls,
        triangles,
        heapMB,
      });
    }
  }

  startScenario(name: string) {
    this.activeScenario = name;
    this.scenarioStartTime = performance.now();
    this.scenarioSamples = [];
  }

  stopScenario(): ScenarioResult | null {
    if (!this.activeScenario) return null;
    const duration = performance.now() - this.scenarioStartTime;
    const samples = this.scenarioSamples;
    const count = samples.length;

    let sumDt = 0;
    let worstDt = 0;
    let sumCalls = 0;
    let sumTriangles = 0;
    let sumHeap = 0;

    for (let i = 0; i < count; i++) {
      const s = samples[i];
      sumDt += s.dt;
      if (s.dt > worstDt) worstDt = s.dt;
      sumCalls += s.drawCalls;
      sumTriangles += s.triangles;
      sumHeap += s.heapMB;
    }

    const avgFps = count > 0 && duration > 0 ? Math.round((count * 1000) / duration) : 0;
    const result: ScenarioResult = {
      scenario: this.activeScenario,
      durationMs: Math.round(duration),
      sampleCount: count,
      avgFps,
      worstFrameMs: Math.round(worstDt * 10) / 10,
      minFps: worstDt > 0 ? Math.round(1000 / worstDt) : 0,
      avgDrawCalls: count > 0 ? Math.round(sumCalls / count) : 0,
      avgTriangles: count > 0 ? Math.round(sumTriangles / count) : 0,
      avgHeapMB: count > 0 ? Math.round((sumHeap / count) * 10) / 10 : 0,
      reRendersPerSec: perfRenderTracker.totalRate,
    };

    this.recordedScenarios[this.activeScenario] = result;
    this.activeScenario = null;
    return result;
  }
}

export const perfMetricsManager = new PerfMetricsManager();

// Expose on window for browser automated testing & inspection
if (typeof window !== 'undefined') {
  (window as any).__perfTracker = perfMetricsManager;
  (window as any).__perfRenderTracker = perfRenderTracker;
}
