/**
 * EXACT CROSSWALK ZONES
 *
 * Measured directly from StreetGround.tsx:
 * - Zebra crossing center X positions: [-39.0, 13.0, 65.0]
 * - Zebra stripe width in X: 2.8 m (PlaneGeometry args: [2.8, 0.55])
 * - Zebra stripes Z range: -5.6 m to +3.8 m
 * - Roadway bounds: North kerb at Z = -6.2, South kerb at Z = 5.1
 * - Sidewalk pavement levels: North Y = 0.16, South Y = 0.10
 * - Road asphalt surface level: Y = -0.08
 */

export interface KerbWaitingPoint {
  side: 'north' | 'south';
  x: number;
  y: number;
  z: number;
  facingYaw: number; // yaw to face the roadway (Math.PI for north, 0 for south)
}

export interface CrosswalkZone {
  id: string;
  index: number;
  name: string;
  centerX: number;
  width: number;
  xMin: number;
  xMax: number;
  zRoadMin: number;
  zRoadMax: number;
  northWaitingPoint: KerbWaitingPoint;
  southWaitingPoint: KerbWaitingPoint;
}

export const CROSSWALK_ZONES: CrosswalkZone[] = [
  {
    id: 'cw-101-about',
    index: 0,
    name: 'Crosswalk 1 (Storefront 101 / About)',
    centerX: -39.0,
    width: 2.8,
    xMin: -40.4,
    xMax: -37.6,
    zRoadMin: -6.2,
    zRoadMax: 5.1,
    northWaitingPoint: {
      side: 'north',
      x: -39.0,
      y: 0.16,
      z: -6.6,
      facingYaw: Math.PI, // Facing South toward road
    },
    southWaitingPoint: {
      side: 'south',
      x: -39.0,
      y: 0.10,
      z: 5.5,
      facingYaw: 0, // Facing North toward road
    },
  },
  {
    id: 'cw-105-projects',
    index: 1,
    name: 'Crosswalk 2 (Storefront 105 / Projects)',
    centerX: 13.0,
    width: 2.8,
    xMin: 11.6,
    xMax: 14.4,
    zRoadMin: -6.2,
    zRoadMax: 5.1,
    northWaitingPoint: {
      side: 'north',
      x: 13.0,
      y: 0.16,
      z: -6.6,
      facingYaw: Math.PI,
    },
    southWaitingPoint: {
      side: 'south',
      x: 13.0,
      y: 0.10,
      z: 5.5,
      facingYaw: 0,
    },
  },
  {
    id: 'cw-109-contact',
    index: 2,
    name: 'Crosswalk 3 (Storefront 109 / Contact)',
    centerX: 65.0,
    width: 2.8,
    xMin: 63.6,
    xMax: 66.4,
    zRoadMin: -6.2,
    zRoadMax: 5.1,
    northWaitingPoint: {
      side: 'north',
      x: 65.0,
      y: 0.16,
      z: -6.6,
      facingYaw: Math.PI,
    },
    southWaitingPoint: {
      side: 'south',
      x: 65.0,
      y: 0.10,
      z: 5.5,
      facingYaw: 0,
    },
  },
];

export interface CarTelemetry {
  id: number;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;       // world units / frame or m/s
  worldSpeed: number;  // converted to m/s
  isBraking: boolean;
}

export interface CrosswalkDynamicState {
  isOccupied: boolean;
  clearCountdown: number;     // wait 1 second after clear before cars proceed
  activePedestrianId: number | null;
  pedestrianSide: 'north' | 'south' | null;
}

/**
 * Shared in-memory crosswalk simulation state
 * Allows zero-overhead communication between PedestrianGroup and TrafficGroup
 */
class CrosswalkSimulationManager {
  private dynamicStates: Map<string, CrosswalkDynamicState> = new Map();
  private carTelemetries: CarTelemetry[] = [];

  constructor() {
    CROSSWALK_ZONES.forEach((cw) => {
      this.dynamicStates.set(cw.id, {
        isOccupied: false,
        clearCountdown: 0,
        activePedestrianId: null,
        pedestrianSide: null,
      });
    });
  }

  public updateCars(cars: CarTelemetry[]) {
    this.carTelemetries = cars;
  }

  public getCars(): CarTelemetry[] {
    return this.carTelemetries;
  }

  public getCrosswalkState(cwId: string): CrosswalkDynamicState {
    let state = this.dynamicStates.get(cwId);
    if (!state) {
      state = {
        isOccupied: false,
        clearCountdown: 0,
        activePedestrianId: null,
        pedestrianSide: null,
      };
      this.dynamicStates.set(cwId, state);
    }
    return state;
  }

  public setPedestrianCrossing(cwId: string, pedId: number | null, side: 'north' | 'south' | null) {
    const state = this.getCrosswalkState(cwId);
    if (pedId !== null) {
      state.isOccupied = true;
      state.clearCountdown = 1.0; // 1s buffer after clear
      state.activePedestrianId = pedId;
      state.pedestrianSide = side;
    } else {
      state.isOccupied = false;
      state.activePedestrianId = null;
      state.pedestrianSide = null;
    }
  }

  public tickClearCountdown(delta: number) {
    this.dynamicStates.forEach((state) => {
      if (!state.isOccupied && state.clearCountdown > 0) {
        state.clearCountdown = Math.max(0, state.clearCountdown - delta);
      }
    });
  }

  /**
   * Evaluates if a car is close enough to threaten a crosswalk.
   * Safe gap condition: car path crosses crosswalk and is within (speed * 3.0s + 6.0m).
   */
  public evaluateCarGap(
    cw: CrosswalkZone,
    car: CarTelemetry
  ): { isThreat: boolean; distance: number; safeDistance: number } {
    // Distance from car to crosswalk center along travel direction:
    // positive = car is approaching before crosswalk
    // negative = car has passed crosswalk
    const distToCw = (cw.centerX - car.x) * car.dir;
    const speedMs = car.worldSpeed || car.speed * 60;
    const safeDistance = speedMs * 3.0 + 6.0;

    // A car already past the 3m stopping line (-2.0m past center) is leaving the crosswalk
    if (distToCw < -2.5) {
      return { isThreat: false, distance: distToCw, safeDistance };
    }

    // Car is approaching and within the safe distance threshold
    const isThreat = distToCw > -2.5 && distToCw <= safeDistance;
    return { isThreat, distance: distToCw, safeDistance };
  }

  /**
   * Checks whether ALL oncoming cars are far enough away for a pedestrian to safely cross.
   */
  public isCrosswalkGapSafe(cw: CrosswalkZone): {
    safe: boolean;
    threatCar: CarTelemetry | null;
    distance: number;
    safeDistance: number;
  } {
    for (const car of this.carTelemetries) {
      const { isThreat, distance, safeDistance } = this.evaluateCarGap(cw, car);
      if (isThreat) {
        return { safe: false, threatCar: car, distance, safeDistance };
      }
    }
    return { safe: true, threatCar: null, distance: 999, safeDistance: 0 };
  }

  /**
   * Evaluates if a car approaching a crosswalk should brake for crossing pedestrians.
   * Cars brake if crosswalk is occupied (or in 1s clear countdown) AND car is before the 3m stop line.
   */
  public shouldCarBrake(
    car: CarTelemetry,
    cw: CrosswalkZone
  ): { shouldBrake: boolean; distToStopLine: number } {
    const state = this.getCrosswalkState(cw.id);
    const isBlocked = state.isOccupied || state.clearCountdown > 0;

    // Stop line is 3 meters before the crosswalk edge:
    // crosswalk edge is centerX - car.dir * 1.4m
    // stop line is centerX - car.dir * 4.4m (3m before the edge)
    const stopLineX = cw.centerX - car.dir * 4.4;
    const distToStopLine = (stopLineX - car.x) * car.dir;

    if (!isBlocked) {
      return { shouldBrake: false, distToStopLine };
    }

    // If car is already past the stop line (distToStopLine < -0.5m), it continues through naturally
    if (distToStopLine < -0.5) {
      return { shouldBrake: false, distToStopLine };
    }

    // Car is approaching the stop line and crosswalk is occupied -> BRAKE!
    // Start braking when within 25 meters of the stop line
    const shouldBrake = distToStopLine <= 25.0;
    return { shouldBrake, distToStopLine };
  }
}

export const crosswalkManager = new CrosswalkSimulationManager();
