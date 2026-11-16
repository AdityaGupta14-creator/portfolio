import { CrosswalkZone, CROSSWALK_ZONES, CarTelemetry } from '../data/crosswalks';

export type CrosswalkState =
  | 'CARS_GO'
  | 'PED_REQUEST'
  | 'CARS_STOPPING'
  | 'PEDS_CROSSING'
  | 'CLEARING';

export interface PedestrianCrosswalkRequest {
  pedId: number;
  side: 'north' | 'south';
  registeredTime: number;
  state: 'waiting' | 'crossing' | 'finished';
}

export interface CommittedCarInfo {
  carId: number;
  dir: 1 | -1;
  speed: number;
  distToStopLine: number;
  minStopDist: number;
  isCommitted: boolean;
}

export interface CrosswalkDebugInfo {
  id: string;
  name: string;
  centerX: number;
  state: CrosswalkState;
  stateTimer: number;
  holdTime: number;
  waitingCount: number;
  crossingCount: number;
  stopLineNorth: number; // for Westbound cars (dir = -1)
  stopLineSouth: number; // for Eastbound cars (dir = +1)
  committedCars: CommittedCarInfo[];
  waitReason: string;
  watchdogTriggered: string | null;
}

export interface PedestrianTelemetry {
  id: number;
  x: number;
  y: number;
  z: number;
  state: string;
}

/**
 * Controller for a single zebra crossing.
 * Acts as the single source of truth for pedestrian-vs-car right-of-way.
 */
export class CrosswalkController {
  public readonly zone: CrosswalkZone;

  // State Machine
  private state: CrosswalkState = 'CARS_GO';
  private stateTimer: number = 0;
  private holdTimer: number = 0; // Cumulative time cars have been stopped

  // Pedestrians
  private pedestrianRequests: Map<number, PedestrianCrosswalkRequest> = new Map();

  // Cars
  private stopLineEastbound: number; // For Eastbound cars (dir = +1, driving towards +X)
  private stopLineWestbound: number; // For Westbound cars (dir = -1, driving towards -X)
  private stoppedCarTimers: Map<number, number> = new Map(); // Track how long cars have been stopped

  // Telemetry & Diagnostics
  private waitReason: string = 'None';
  private committedCarsList: CommittedCarInfo[] = [];
  private lastWatchdogAlert: string | null = null;

  // Maximum timers per requirements
  private static readonly MAX_REQUEST_WAIT_SEC = 12.0; // Force cars to stop after 12s of ped waiting
  private static readonly MAX_CAR_HOLD_SEC = 20.0;     // Never hold cars more than 20s
  private static readonly MAX_CAR_STOPPED_SEC = 15.0;  // Release car stopped > 15s if nobody on road
  private static readonly CLEARING_DELAY_SEC = 1.0;    // 1s buffer after last pedestrian reaches kerb
  private static readonly COMFORT_DECEL_MS2 = 3.0;     // Maximum comfortable deceleration rate (3 m/s^2)
  private static readonly STOP_MARGIN_M = 2.0;         // Safety distance margin for commitment

  constructor(zone: CrosswalkZone) {
    this.zone = zone;
    // Crosswalk zebra width is 2.8m (centerX +/- 1.4m).
    // Stop line is 3m before crossing edge:
    // Eastbound (dir = +1) approaches from -X: edge is centerX - 1.4m -> stop line is centerX - 4.4m
    // Westbound (dir = -1) approaches from +X: edge is centerX + 1.4m -> stop line is centerX + 4.4m
    this.stopLineEastbound = zone.centerX - 4.4;
    this.stopLineWestbound = zone.centerX + 4.4;
  }

  public getState(): CrosswalkState {
    return this.state;
  }

  public getStateTimer(): number {
    return this.stateTimer;
  }

  public getHoldTimer(): number {
    return this.holdTimer;
  }

  public getStopLine(dir: 1 | -1): number {
    return dir > 0 ? this.stopLineEastbound : this.stopLineWestbound;
  }

  /**
   * Register a pedestrian wanting to cross at this crosswalk
   */
  public registerPedestrian(pedId: number, side: 'north' | 'south') {
    const existing = this.pedestrianRequests.get(pedId);
    if (!existing) {
      this.pedestrianRequests.set(pedId, {
        pedId,
        side,
        registeredTime: performance.now(),
        state: 'waiting',
      });
    }

    // If currently in CARS_GO, transition to PED_REQUEST
    if (this.state === 'CARS_GO') {
      this.transitionTo('PED_REQUEST', 'Pedestrian registered request; checking oncoming traffic');
    } else if (this.state === 'PEDS_CROSSING') {
      // Allow late-arriving pedestrian to join if at least 3s remains in crossing phase
      // (or if phase just began)
      if (this.stateTimer < 5.0) {
        const req = this.pedestrianRequests.get(pedId);
        if (req && req.state === 'waiting') {
          req.state = 'crossing';
        }
      }
    }
  }

  /**
   * Checks whether a pedestrian is currently authorized to cross the road
   */
  public canPedestrianCross(pedId: number): boolean {
    if (this.state !== 'PEDS_CROSSING') {
      return false;
    }
    const req = this.pedestrianRequests.get(pedId);
    if (!req) return false;
    return req.state === 'waiting' || req.state === 'crossing';
  }

  /**
   * Called when pedestrian has stepped off kerb and started crossing
   */
  public onPedestrianStartedCrossing(pedId: number) {
    const req = this.pedestrianRequests.get(pedId);
    if (req) {
      req.state = 'crossing';
    }
  }

  /**
   * Called when pedestrian has reached the opposite kerb
   */
  public onPedestrianFinished(pedId: number) {
    const req = this.pedestrianRequests.get(pedId);
    if (req) {
      req.state = 'finished';
      this.pedestrianRequests.delete(pedId);
    }
  }

  /**
   * Checks if a car is required to stop for this crosswalk
   */
  public stopRequired(
    _carId: number,
    x: number,
    _z: number,
    dir: 1 | -1,
    _speedMs: number
  ): boolean {
    // Stop line along travel direction
    const stopLineX = this.getStopLine(dir);
    const distToStopLine = (stopLineX - x) * dir;

    // A car that has already crossed the stop line (distToStopLine < -0.5m)
    // keeps going and clears the crossing safely.
    if (distToStopLine < -0.5) {
      return false;
    }

    // During CARS_STOPPING, PEDS_CROSSING, and CLEARING:
    // Cars approaching within stopping horizon (up to 30m) must stop at the stop line.
    if (
      this.state === 'CARS_STOPPING' ||
      this.state === 'PEDS_CROSSING' ||
      this.state === 'CLEARING'
    ) {
      return distToStopLine <= 30.0;
    }

    return false;
  }

  public reset() {
    this.state = 'CARS_GO';
    this.stateTimer = 0;
    this.holdTimer = 0;
    this.pedestrianRequests.clear();
    this.stoppedCarTimers.clear();
    this.committedCarsList = [];
    this.waitReason = 'Reset to CARS_GO';
    this.lastWatchdogAlert = null;
  }

  /**
   * Checks if a car is cleared to proceed
   */
  public canGo(
    _carId: number,
    x: number,
    _z: number,
    dir: 1 | -1
  ): boolean {
    const stopLineX = this.getStopLine(dir);
    const distToStopLine = (stopLineX - x) * dir;

    // A car already past the stop line keeps going
    if (distToStopLine < -0.5) {
      return true;
    }

    // Only cleared to proceed when state is CARS_GO or PED_REQUEST
    return this.state === 'CARS_GO' || this.state === 'PED_REQUEST';
  }

  /**
   * Main simulation tick for this crosswalk controller
   */
  public update(
    delta: number,
    cars: CarTelemetry[],
    peds: PedestrianTelemetry[]
  ) {
    this.stateTimer += delta;

    // Cumulative hold timer (when cars are stopped)
    if (
      this.state === 'CARS_STOPPING' ||
      this.state === 'PEDS_CROSSING' ||
      this.state === 'CLEARING'
    ) {
      this.holdTimer += delta;
    } else {
      this.holdTimer = 0;
    }

    // ── Evaluate approaching cars and commitment status ─────────────────────
    this.committedCarsList = [];
    let hasCommittedCar = false;
    let nearestApproachingCarDist = Infinity;
    let nearestApproachingCarSpeed = 0;

    for (const car of cars) {
      const stopLineX = this.getStopLine(car.dir);
      const distToStopLine = (stopLineX - car.x) * car.dir;
      const v = car.worldSpeed;

      // Only evaluate cars that are approaching this crosswalk (dist > -0.5m and < 40m)
      if (distToStopLine >= -0.5 && distToStopLine <= 40.0) {
        if (distToStopLine < nearestApproachingCarDist) {
          nearestApproachingCarDist = distToStopLine;
          nearestApproachingCarSpeed = v;
        }

        // Required stopping distance at 3 m/s^2 plus 2m safety margin:
        // d = v^2 / (2 * a) + margin
        const minStopDist = (v * v) / (2 * CrosswalkController.COMFORT_DECEL_MS2) + CrosswalkController.STOP_MARGIN_M;
        const isCommitted = v > 0.3 && distToStopLine < minStopDist;

        if (isCommitted) {
          hasCommittedCar = true;
        }

        this.committedCarsList.push({
          carId: car.id,
          dir: car.dir,
          speed: v,
          distToStopLine,
          minStopDist,
          isCommitted,
        });

        // Track car stopped duration for watchdog
        if (distToStopLine <= 0.8 && v < 0.15) {
          const currentStoppedTime = (this.stoppedCarTimers.get(car.id) || 0) + delta;
          this.stoppedCarTimers.set(car.id, currentStoppedTime);
        } else {
          this.stoppedCarTimers.delete(car.id);
        }
      } else {
        this.stoppedCarTimers.delete(car.id);
      }
    }

    // ── Count waiting and crossing pedestrians ──────────────────────────────
    let waitingCount = 0;
    let crossingCount = 0;
    this.pedestrianRequests.forEach((req) => {
      if (req.state === 'waiting') waitingCount++;
      if (req.state === 'crossing') crossingCount++;
    });

    // Check if any pedestrian is physically on the roadway asphalt (Z between -6.0 and +4.8)
    const pedsOnRoad = peds.filter((p) => {
      const inX = Math.abs(p.x - this.zone.centerX) <= this.zone.width * 1.5;
      const onAsphalt = p.z > -6.0 && p.z < 4.8;
      return inX && onAsphalt;
    });

    // ── WATCHDOG 1: Car Hold Watchdog (Max 20s hold) ─────────────────────────
    if (this.holdTimer > CrosswalkController.MAX_CAR_HOLD_SEC) {
      const reason = `Watchdog triggered: Cars held for >20s (${this.holdTimer.toFixed(1)}s) at ${this.zone.name}. Releasing cars safely.`;
      console.warn(`[Crosswalk Watchdog] ${reason}`);
      this.lastWatchdogAlert = reason;

      // Mark all crossing pedestrians as finished and walk them to nearest kerb
      this.pedestrianRequests.forEach((req) => {
        req.state = 'finished';
      });
      this.pedestrianRequests.clear();
      this.transitionTo('CLEARING', 'Watchdog: 20s hold limit exceeded');
    }

    // ── WATCHDOG 2: Stopped Car Watchdog (Max 15s stopped with clear road) ──
    for (const [carId, stoppedTime] of this.stoppedCarTimers.entries()) {
      if (stoppedTime > CrosswalkController.MAX_CAR_STOPPED_SEC && pedsOnRoad.length === 0) {
        const reason = `Watchdog triggered: Car #${carId} stopped for >15s (${stoppedTime.toFixed(1)}s) with empty crosswalk at ${this.zone.name}. Releasing.`;
        console.warn(`[Crosswalk Watchdog] ${reason}`);
        this.lastWatchdogAlert = reason;
        this.pedestrianRequests.clear();
        this.transitionTo('CARS_GO', 'Watchdog: Car stopped >15s with empty road');
        break;
      }
    }

    // ── STATE MACHINE EXECUTION ──────────────────────────────────────────────
    switch (this.state) {
      case 'CARS_GO': {
        this.waitReason = 'Cars have green light';
        if (waitingCount > 0) {
          this.transitionTo('PED_REQUEST', 'Pedestrians waiting at kerb');
        }
        break;
      }

      case 'PED_REQUEST': {
        // Wait until no committed car is approaching OR 12s timeout expires
        const timeoutReached = this.stateTimer >= CrosswalkController.MAX_REQUEST_WAIT_SEC;

        if (timeoutReached) {
          this.transitionTo(
            'CARS_STOPPING',
            `12s max request wait reached (stateTimer=${this.stateTimer.toFixed(1)}s); forcing cars to brake`
          );
        } else if (!hasCommittedCar) {
          this.transitionTo('CARS_STOPPING', 'No committed cars approaching; ordering cars to stop');
        } else {
          this.waitReason = `Waiting for committed car #${this.committedCarsList.find((c) => c.isCommitted)?.carId} (${this.stateTimer.toFixed(1)}s/12s)`;
        }
        break;
      }

      case 'CARS_STOPPING': {
        // Cars approaching are braking to stop line.
        // Wait until the nearest approaching car is fully stopped (speed < 0.15 m/s)
        // or far outside the stop distance (> 22m).
        const allApproachingStopped =
          nearestApproachingCarDist > 22.0 || nearestApproachingCarSpeed < 0.18;

        if (allApproachingStopped || this.stateTimer >= 5.0) {
          // Authorize all waiting pedestrians to start crossing!
          this.pedestrianRequests.forEach((req) => {
            if (req.state === 'waiting') {
              req.state = 'crossing';
            }
          });
          this.transitionTo('PEDS_CROSSING', 'Cars stationary at stop line; pedestrians crossing');
        } else {
          this.waitReason = `Cars braking to stop line (nearest car dist=${nearestApproachingCarDist.toFixed(1)}m, speed=${nearestApproachingCarSpeed.toFixed(2)}m/s)`;
        }
        break;
      }

      case 'PEDS_CROSSING': {
        // Pedestrians cross in both directions.
        // When all pedestrians have completed crossing and none are left on the roadway:
        const anyCrossing = Array.from(this.pedestrianRequests.values()).some(
          (r) => r.state === 'crossing'
        );

        if (!anyCrossing && pedsOnRoad.length === 0) {
          this.transitionTo('CLEARING', 'All pedestrians reached far kerb; clearing road');
        } else {
          this.waitReason = `${crossingCount} pedestrian(s) crossing roadway`;
        }
        break;
      }

      case 'CLEARING': {
        // Wait 1 second buffer after last pedestrian has reached kerb.
        // Cars must not start while anyone is still on the road.
        if (this.stateTimer >= CrosswalkController.CLEARING_DELAY_SEC && pedsOnRoad.length === 0) {
          this.pedestrianRequests.clear();
          this.transitionTo('CARS_GO', 'Road clear; green light for cars');
        } else {
          this.waitReason = `Clearing buffer (${(CrosswalkController.CLEARING_DELAY_SEC - this.stateTimer).toFixed(1)}s remaining)`;
        }
        break;
      }
    }
  }

  private transitionTo(newState: CrosswalkState, reason: string) {
    this.state = newState;
    this.stateTimer = 0;
    this.waitReason = reason;
  }

  public getDebugInfo(): CrosswalkDebugInfo {
    let waitingCount = 0;
    let crossingCount = 0;
    this.pedestrianRequests.forEach((req) => {
      if (req.state === 'waiting') waitingCount++;
      if (req.state === 'crossing') crossingCount++;
    });

    return {
      id: this.zone.id,
      name: this.zone.name,
      centerX: this.zone.centerX,
      state: this.state,
      stateTimer: this.stateTimer,
      holdTime: this.holdTimer,
      waitingCount,
      crossingCount,
      stopLineNorth: this.stopLineWestbound,
      stopLineSouth: this.stopLineEastbound,
      committedCars: [...this.committedCarsList],
      waitReason: this.waitReason,
      watchdogTriggered: this.lastWatchdogAlert,
    };
  }
}

// ── Global Singleton Map of Controllers (one per crosswalk) ──────────────────
export const crosswalkControllers: Map<string, CrosswalkController> = new Map();

CROSSWALK_ZONES.forEach((zone) => {
  crosswalkControllers.set(zone.id, new CrosswalkController(zone));
});

export function getCrosswalkController(id: string): CrosswalkController {
  let ctrl = crosswalkControllers.get(id);
  if (!ctrl) {
    const zone = CROSSWALK_ZONES.find((z) => z.id === id) || CROSSWALK_ZONES[0];
    ctrl = new CrosswalkController(zone);
    crosswalkControllers.set(id, ctrl);
  }
  return ctrl;
}

export function getAllCrosswalkControllers(): CrosswalkController[] {
  return Array.from(crosswalkControllers.values());
}

let cachedCars: CarTelemetry[] = [];
let cachedPedestrians: PedestrianTelemetry[] = [];

export function updateCarTelemetries(cars: CarTelemetry[]): void {
  cachedCars = cars;
}

export function updatePedestrianTelemetries(peds: PedestrianTelemetry[]): void {
  cachedPedestrians = peds;
}

export function tickAllCrosswalkControllers(delta: number): void {
  crosswalkControllers.forEach((ctrl) => {
    ctrl.update(delta, cachedCars, cachedPedestrians);
  });
}

export function resetAllCrosswalkControllers(): void {
  crosswalkControllers.forEach((ctrl) => ctrl.reset());
}
