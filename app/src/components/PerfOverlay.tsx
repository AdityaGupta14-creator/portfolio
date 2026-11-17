import React, { useEffect, useState } from 'react';
import { perfMetricsManager, PerfSnapshot } from '../utils/perfTracker';
import { Activity, Layers, HardDrive, RefreshCw } from 'lucide-react';

export const PerfOverlay: React.FC = () => {
  const isPerfEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('perf') === '1' ||
      new URLSearchParams(window.location.search).has('perf'));

  const [snap, setSnap] = useState<PerfSnapshot>(perfMetricsManager.latestSnapshot);

  // Poll metrics at 4Hz to prevent HUD rendering from impacting framerate
  useEffect(() => {
    if (!isPerfEnabled) return;

    const interval = setInterval(() => {
      setSnap({ ...perfMetricsManager.latestSnapshot });
    }, 250);

    return () => clearInterval(interval);
  }, [isPerfEnabled]);

  if (!isPerfEnabled) return null;

  const fpsColor =
    snap.fps >= 50 ? 'text-emerald-400' : snap.fps >= 30 ? 'text-amber-400' : 'text-rose-400';
  const worstColor =
    snap.worstFrame5sMs <= 20
      ? 'text-emerald-400'
      : snap.worstFrame5sMs <= 33
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div
      id="dev-perf-overlay"
      className="fixed bottom-4 right-4 z-[9999] pointer-events-auto bg-slate-950/90 text-white font-mono text-xs p-4 rounded-2xl border border-amber-400/40 shadow-2xl backdrop-blur-md w-80 select-none flex flex-col gap-3"
      role="region"
      aria-label="Performance Telemetry HUD"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-bold tracking-wider text-amber-400 uppercase text-[11px]">
            Performance HUD (?perf=1)
          </span>
        </div>
        <span className="text-[10px] text-slate-400">Live 4Hz</span>
      </div>

      {/* Primary Metrics: FPS & Latency */}
      <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/80 p-2.5 rounded-xl border border-white/5">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">FPS</div>
          <div className={`text-xl font-extrabold ${fpsColor}`}>{snap.fps}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Frame</div>
          <div className="text-base font-bold text-slate-200">{snap.frameTimeMs} ms</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Worst (5s)</div>
          <div className={`text-base font-bold ${worstColor}`}>{snap.worstFrame5sMs} ms</div>
        </div>
      </div>

      {/* WebGL Renderer Info */}
      <div className="flex flex-col gap-1 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Renderer Info</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Draw Calls:</span>
          <span className="font-bold text-cyan-300">{snap.drawCalls.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Triangles:</span>
          <span className="font-bold text-cyan-300">{snap.triangles.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Geometries:</span>
          <span className="font-bold text-slate-200">{snap.geometries}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Textures:</span>
          <span className="font-bold text-slate-200">{snap.textures}</span>
        </div>
      </div>

      {/* Memory & React Re-renders */}
      <div className="flex flex-col gap-1 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>JS Heap</span>
          </div>
          <span className="font-bold text-purple-300">
            {snap.heapMB > 0 ? `${snap.heapMB} MB` : 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scene Re-renders</span>
          </div>
          <span
            className={`font-bold ${
              snap.reRendersPerSec > 10 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {snap.reRendersPerSec}/s
          </span>
        </div>

        {/* Component Breakdown */}
        {Object.keys(snap.reRendersByComponent).length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1 pt-1 border-t border-white/5">
            {Object.entries(snap.reRendersByComponent)
              .filter(([_, r]) => r > 0)
              .map(([name, rate]) => (
                <span key={name}>
                  {name}: <strong className="text-white">{rate}</strong>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
