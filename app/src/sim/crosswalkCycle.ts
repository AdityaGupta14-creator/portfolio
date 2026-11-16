import { CROSSWALK_ZONES, CrosswalkZone, CarTelemetry } from '../data/crosswalks';

export type CrosswalkPhase = 'CARS_GO' | 'CARS_STOPPING' | 'WALK' | 'CLEAR';

export interface CrosswalkTimings {
  CARS_GO: number;       // 14 s
  CARS_STOPPING: number; // 3 s
  WALK: number;          // 10 s
  CLEAR: number;         // 2 s
  MAX_EXTRA_CLEAR: number; // 5 s max extra if road not clear
}

export const DEFAULT_CROSSWALK_TIMINGS: CrosswalkTimings = {
  CARS_GO: 14.0,
  CARS_STOPPING: 3.0,
  WALK: 10.0,
  CLEAR: 2.0,
  MAX_EXTRA_CLEAR: 5.0,
};

export interface CarStopDecision {
  carId: number;
  shouldStop: boolean;
  stopLineX: number;
  distToStopLine: number;
  isCommitted: boolean;
  reason: string;
}

export interface CrosswalkCycleTelemetry {
  id: string;
  name: string;
  centerX: number;
  phase: CrosswalkPhase;
  phaseTimer: number;
  phaseDuration: number;
  cycleCount: number;
  waitingCount: number;
  crossingCount: number;
  stopLineNorth: number; // Westbound (dir = -1)
  stopLineSouth: number; // Eastbound (dir = +1)
  carDecisions: CarStopDecision[];
  watchdogTriggered: boolean;
}

export interface PedestrianPosition {
  id: number;
  x: number;
  y: number;
  z: number;
  isWaitingAtKerb?: boolean;
  isCrossingRoad?: boolean;
}

export class CrosswalkCycleController {
  public readonly zone: CrosswalkZone;
  public readonly timings: CrosswalkTimings;

  private phase: CrosswalkPhase = 'CARS_GO';
  private phaseTimer: number = 0;
  private extraClearTimer: number = 0;
  private cycleCount: number = 0;

  // Stop lines 3 m before zebra crossing edge:
  // Eastbound (+1) approaches from -X: edge is centerX - 1.4m -> stop line is centerX - 4.4m
  // Westbound (-1) approaches from +X: edge is centerX + 1.4m -> stop line is centerX + 4.4m
  public readonly stopLineEastbound: number;
  public readonly stopLineWestbound: number;

  private carDecisions: Map<number, CarStopDecision> = new Map();
  private waitingPedIds: Set<number> = new Set();
  private crossingPedIds: Set<number> = new Set();
  private watchdogAlert: boolean = false;

  constructor(zone: CrosswalkZone, timings = DEFAULT_CROSSWALK_TIMINGS) {
    this.zone = zone;
    this.timings = timings;
    this.stopLineEastbound = zone.centerX - 4.4;
    this.stopLineWestbound = zone.centerX + 4.4;
  }

  public getPhase(): CrosswalkPhase {
    return this.phase;
  }

  public getPhaseTimer(): number {
    return this.phaseTimer;
  }

  public getCycleCount(): number {
    return this.cycleCount;
  }

  public getPhaseDuration(): number {
    switch (this.phase) {
      case 'CARS_GO':
        return this.timings.CARS_GO;
      case 'CARS_STOPPING':
        return this.timings.CARS_STOPPING;
      case 'WALK':
        return this.timings.WALK;
      case 'CLEAR':
        return this.timings.CLEAR;
    }
  }

  public getStopLine(dir: 1 | -1): number {
    return dir > 0 ? this.stopLineEastbound : this.stopLineWestbound;
  }

  public reset() {
    this.phase = 'CARS_GO';
    this.phaseTimer = 0;
    this.extraClearTimer = 0;
    this.cycleCount = 0;
    this.carDecisions.clear();
    this.waitingPedIds.clear();
    this.crossingPedIds.clear();
    this.watchdogAlert = false;
  }

  /**
   * Evaluates if a pedestrian can start crossing the road.
   * Allowed ONLY if:
   * 1. Phase is WALK
   * 2. Enough time remains in the WALK phase: remainingTime >= crossTime + 1.5 s margin.
   */
  public canPedestrianStartCrossing(pedId: number, crossTimeSeconds = 8.0): boolean {
    if (this.phase !== 'WALK') {
      this.waitingPedIds.add(pedId);
      this.crossingPedIds.delete(pedId);
      return false;
    }

    const remainingWalkTime = this.timings.WALK - this.phaseTimer;
    const requiredTime = crossTimeSeconds + 1.5;

    if (remainingWalkTime >= requiredTime) {
      this.waitingPedIds.delete(pedId);
      this.crossingPedIds.add(pedId);
      return true;
    } else {
      // Not enough time left in this WALK phase: keep waiting for next cycle
      this.waitingPedIds.add(pedId);
      this.crossingPedIds.delete(pedId);
      return false;
    }
  }

  public onPedestrianFinishedCrossing(pedId: number) {
    this.crossingPedIds.delete(pedId);
    this.waitingPedIds.delete(pedId);
  }

  /**
   * Determines if a car approaching this crosswalk must stop.
   * Rule:
   * During CARS_STOPPING, WALK and CLEAR:
   * Must stop at the stop line (3 m before crossing)
   * UNLESS it is already too close to stop:
   * distance < v^2 / (2 * 3.0 m/s^2) + 2.0 m
   * in which case it continues.
   * In CARS_GO: never stops for the clock.
   */
  public evaluateCar(car: CarTelemetry, isPedOnRoadAhead: boolean): CarStopDecision {
    const stopLineX = this.getStopLine(car.dir);
    const distToStopLine = (stopLineX - car.x) * car.dir;
    const v = car.worldSpeed;

    // Minimum stopping distance at comfortable 3 m/s^2 deceleration plus 2m margin
    const minStopDist = (v * v) / (2 * 3.0) + 2.0;
    const isCommitted = v > 0.3 && distToStopLine < minStopDist;

    // Past stop line: continues through
    if (distToStopLine < -0.5) {
      const decision: CarStopDecision = {
        carId: car.id,
        shouldStop: false,
        stopLineX,
        distToStopLine,
        isCommitted: false,
        reason: 'Past stop line (clearing intersection)',
      };
      this.carDecisions.set(car.id, decision);
      return decision;
    }

    // Safety: If someone is physically directly on the road ahead of this car, car must stop
    if (isPedOnRoadAhead && distToStopLine <= 25.0) {
      const decision: CarStopDecision = {
        carId: car.id,
        shouldStop: true,
        stopLineX,
        distToStopLine,
        isCommitted: false,
        reason: 'Emergency: Pedestrian physically on roadway',
      };
      this.carDecisions.set(car.id, decision);
      return decision;
    }

    // CARS_GO: clock is green, cars proceed
    if (this.phase === 'CARS_GO') {
      const decision: CarStopDecision = {
        carId: car.id,
        shouldStop: false,
        stopLineX,
        distToStopLine,
        isCommitted: false,
        reason: 'CARS_GO (Green clock)',
      };
      this.carDecisions.set(car.id, decision);
      return decision;
    }

    // CARS_STOPPING, WALK, CLEAR:
    // If committed (too close to stop safely), continue through
    if (isCommitted) {
      const decision: CarStopDecision = {
        carId: car.id,
        shouldStop: false,
        stopLineX,
        distToStopLine,
        isCommitted: true,
        reason: `Committed (dist ${distToStopLine.toFixed(1)}m < minStop ${minStopDist.toFixed(1)}m)`,
      };
      this.carDecisions.set(car.id, decision);
      return decision;
    }

    // Approaching within stopping horizon: MUST STOP
    if (distToStopLine <= 30.0) {
      const decision: CarStopDecision = {
        carId: car.id,
        shouldStop: true,
        stopLineX,
        distToStopLine,
        isCommitted: false,
        reason: `Phase [${this.phase}] (Stop at 3m line)`,
      };
      this.carDecisions.set(car.id, decision);
      return decision;
    }

    const decision: CarStopDecision = {
      carId: car.id,
      shouldStop: false,
      stopLineX,
      distToStopLine,
      isCommitted: false,
      reason: 'Outside stopping horizon (>30m)',
    };
    this.carDecisions.set(car.id, decision);
    return decision;
  }

  /**
   * Main simulation update tick.
   * Ticks the clock and advances phases:
   * CARS_GO 14s -> CARS_STOPPING 3s -> WALK 10s -> CLEAR 2s -> repeat.
   */
  public update(dt: number, pedsOnRoadCount: number) {
    this.phaseTimer += dt;
    const nominalDuration = this.getPhaseDuration();

    // ── Watchdog: phase lasting > 2x nominal duration ─────────────────────────
    if (this.phaseTimer > nominalDuration * 2.0 && this.phase !== 'CLEAR') {
      console.warn(
        `[Crosswalk Watchdog] Phase ${this.phase} at ${this.zone.name} exceeded 2x duration (${this.phaseTimer.toFixed(1)}s > ${(nominalDuration * 2).toFixed(1)}s). Forcing next phase.`
      );
      this.watchdogAlert = true;
      this.advancePhase();
      return;
    }

    switch (this.phase) {
      case 'CARS_GO': {
        if (this.phaseTimer >= this.timings.CARS_GO) {
          this.transitionTo('CARS_STOPPING');
        }
        break;
      }

      case 'CARS_STOPPING': {
        if (this.phaseTimer >= this.timings.CARS_STOPPING) {
          this.transitionTo('WALK');
        }
        break;
      }

      case 'WALK': {
        if (this.phaseTimer >= this.timings.WALK) {
          this.transitionTo('CLEAR');
        }
        break;
      }

      case 'CLEAR': {
        // CLEAR ends only when nobody is on the crossing (max extra 5 s, then log warning and release cars)
        if (this.phaseTimer >= this.timings.CLEAR) {
          if (pedsOnRoadCount === 0) {
            this.cycleCount++;
            this.transitionTo('CARS_GO');
          } else {
            this.extraClearTimer += dt;
            if (this.extraClearTimer >= this.timings.MAX_EXTRA_CLEAR) {
              console.warn(
                `[Crosswalk Watchdog] CLEAR extra time limit (5s) reached at ${this.zone.name} with ${pedsOnRoadCount} ped(s) on road. Releasing cars.`
              );
              this.cycleCount++;
              this.transitionTo('CARS_GO');
            }
          }
        }
        break;
      }
    }
  }

  private transitionTo(nextPhase: CrosswalkPhase) {
    this.phase = nextPhase;
    this.phaseTimer = 0;
    this.extraClearTimer = 0;
    this.watchdogAlert = false;
  }

  private advancePhase() {
    switch (this.phase) {
      case 'CARS_GO':
        this.transitionTo('CARS_STOPPING');
        break;
      case 'CARS_STOPPING':
        this.transitionTo('WALK');
        break;
      case 'WALK':
        this.transitionTo('CLEAR');
        break;
      case 'CLEAR':
        this.cycleCount++;
        this.transitionTo('CARS_GO');
        break;
    }
  }

  public getTelemetry(): CrosswalkCycleTelemetry {
    return {
      id: this.zone.id,
      name: this.zone.name,
      centerX: this.zone.centerX,
      phase: this.phase,
      phaseTimer: this.phaseTimer,
      phaseDuration: this.getPhaseDuration(),
      cycleCount: this.cycleCount,
      waitingCount: this.waitingPedIds.size,
      crossingCount: this.crossingPedIds.size,
      stopLineNorth: this.stopLineWestbound,
      stopLineSouth: this.stopLineEastbound,
      carDecisions: Array.from(this.carDecisions.values()),
      watchdogTriggered: this.watchdogAlert,
    };
  }
}

// ── Global Singleton Crosswalk Cycle Controllers ─────────────────────────────
export const crosswalkCycleControllers: Map<string, CrosswalkCycleController> = new Map();

CROSSWALK_ZONES.forEach((zone) => {
  crosswalkCycleControllers.set(zone.id, new CrosswalkCycleController(zone));
});

export function getCrosswalkCycle(id = 'cw-105-projects'): CrosswalkCycleController {
  let ctrl = crosswalkCycleControllers.get(id);
  if (!ctrl) {
    const zone = CROSSWALK_ZONES.find((z) => z.id === id) || CROSSWALK_ZONES[0];
    ctrl = new CrosswalkCycleController(zone);
    crosswalkCycleControllers.set(id, ctrl);
  }
  return ctrl;
}

export function getAllCrosswalkCycles(): CrosswalkCycleController[] {
  return Array.from(crosswalkCycleControllers.values());
}
