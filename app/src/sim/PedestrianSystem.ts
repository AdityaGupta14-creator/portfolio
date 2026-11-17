import * as THREE from 'three';
import { PEDESTRIAN_STRIDE } from '../data/pedestrianConfig';
import { getCrosswalkCycle } from './crosswalkCycle';

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  waitSeconds?: number;
  isKerbWaitingPoint?: boolean;
  isOppositeKerb?: boolean;
  crosswalkId?: string;
  oppositeKerb?: { x: number; y: number; z: number };
  crossSpeed?: number;
}

export interface Pedestrian {
  id: number;
  mesh: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction;
  standAction: THREE.AnimationAction;
  route: Waypoint[];
  waypointIndex: number;
  targetSpeed: number;       // Target cruise speed (m/s)
  currentSpeed: number;      // Current velocity magnitude (m/s)
  actualSpeed: number;       // Measured smoothed speed (distance moved / dt)
  waitUntil: number;         // Absolute timestamp in seconds
  yaw: number;
  targetYaw: number;
  lateralOffset: number;
  targetLateralOffset: number;
  lastPosition: THREE.Vector3;
  stuckTimer: number;
  isStuck: boolean;
  isAnimMismatch: boolean;
  isWaitingAtKerb: boolean;
  isCrossingRoad: boolean;
  isRed: boolean;
  redReason: string;
  animSkipCount?: number;
}

export interface PedestrianTelemetry {
  id: number;
  speed: string;
  routeIndex: string;
  actionName: string;
  isRunning: boolean;
  weight: string;
  timeScale: string;
  isRed: boolean;
  redReason: string;
  position: [number, number, number];
}

/**
 * Clean Looping Sidewalk Routes
 * Includes North loop, South loop, and Crosswalk loops.
 * Turnarounds occur smoothly under dense fog (|X| > 120m).
 * Routes loop forever — pedestrians never despawn or recycle.
 */
export function createNorthSidewalkLoop(): Waypoint[] {
  return [
    // Eastbound on Near-Kerb lane (Z = -8.6, walking towards +X)
    { x: -120, y: 0.16, z: -8.6 },
    { x: -60, y: 0.16, z: -8.6 },
    { x: 0, y: 0.16, z: -8.6 },
    { x: 60, y: 0.16, z: -8.6 },
    { x: 120, y: 0.16, z: -8.6 },
    // Smooth U-Turn at East end under fog
    { x: 126, y: 0.16, z: -9.7 },
    { x: 120, y: 0.16, z: -10.8 },
    // Westbound on Near-Building lane (Z = -10.8, walking towards -X)
    { x: 60, y: 0.16, z: -10.8 },
    { x: 0, y: 0.16, z: -10.8, waitSeconds: 2.0 },
    { x: -60, y: 0.16, z: -10.8 },
    { x: -120, y: 0.16, z: -10.8 },
    // Smooth U-Turn at West end under fog
    { x: -126, y: 0.16, z: -9.7 },
  ];
}

export function createSouthSidewalkLoop(): Waypoint[] {
  return [
    // Eastbound on Near-Park lane (Z = 9.8, walking towards +X)
    { x: -120, y: 0.10, z: 9.8 },
    { x: -60, y: 0.10, z: 9.8 },
    { x: 0, y: 0.10, z: 9.8 },
    { x: 60, y: 0.10, z: 9.8 },
    { x: 120, y: 0.10, z: 9.8 },
    // Smooth U-Turn at East end under fog
    { x: 126, y: 0.10, z: 8.7 },
    { x: 120, y: 0.10, z: 7.6 },
    // Westbound on Near-Kerb lane (Z = 7.6, walking towards -X)
    { x: 60, y: 0.10, z: 7.6 },
    { x: 0, y: 0.10, z: 7.6, waitSeconds: 2.5 },
    { x: -60, y: 0.10, z: 7.6 },
    { x: -120, y: 0.10, z: 7.6 },
    // Smooth U-Turn at West end under fog
    { x: -126, y: 0.10, z: 8.7 },
  ];
}

/**
 * Route including a crossing leg across Crosswalk 2 (Projects, X = 13.0m).
 * North kerb point A (12.35, 0.16, -6.6) -> South kerb point B (12.35, 0.10, 5.5).
 * Loops through South sidewalk, crosses back at Crosswalk 1 (-39.0m), and loops back.
 */
export function createCrossingLoopRoute(): Waypoint[] {
  return [
    // 1. Approach North Kerb Point A at Crosswalk 2 (X = 13.0m, offset -0.65m for right half)
    {
      x: 12.35,
      y: 0.16,
      z: -6.6,
      isKerbWaitingPoint: true,
      crosswalkId: 'cw-105-projects',
      oppositeKerb: { x: 12.35, y: 0.10, z: 5.5 },
      crossSpeed: 1.50,
    },
    // 2. Straight crossing leg across the road to South Kerb Point B
    {
      x: 12.35,
      y: 0.10,
      z: 5.5,
      isOppositeKerb: true,
      crosswalkId: 'cw-105-projects',
    },

    // 3. Walk West on South Sidewalk towards Crosswalk 1 (About, X = -39.0m)
    { x: 0.0, y: 0.10, z: 7.6 },
    {
      x: -39.65,
      y: 0.10,
      z: 5.5,
      isKerbWaitingPoint: true,
      crosswalkId: 'cw-101-about',
      oppositeKerb: { x: -39.65, y: 0.16, z: -6.6 },
      crossSpeed: 1.50,
    },
    // 4. Straight crossing leg back to North Kerb
    {
      x: -39.65,
      y: 0.16,
      z: -6.6,
      isOppositeKerb: true,
      crosswalkId: 'cw-101-about',
    },

    // 5. Walk East on North Sidewalk back to Crosswalk 2
    { x: -10.0, y: 0.16, z: -8.6 },
  ];
}

export class PedestrianSystem {
  private pedestrians: Pedestrian[] = [];
  private currentTime: number = 0;

  public addPedestrian(ped: Pedestrian) {
    this.pedestrians.push(ped);
  }

  public getPedestrians(): Pedestrian[] {
    return this.pedestrians;
  }

  public clear() {
    this.pedestrians = [];
    this.currentTime = 0;
  }

  /**
   * Main simulation tick.
   * STRICT ORDER:
   * (a) Decide desired velocity along route (accelerate towards targetSpeed, or 0 while waiting)
   * (b) Move
   * (c) Rotate smoothly towards movement direction
   * (d) ANIMATION: measure actual speed (distance moved / dt, smoothed);
   *     if > 0.15 m/s play Walking action with timeScale = actualSpeed / clipNaturalSpeed,
   *     otherwise crossfade to idle/standing
   * (e) mixer.update(dt)
   * Nothing else is allowed to set actions or timeScale.
   */
  public update(dt: number, cameraPos?: THREE.Vector3) {
    const clampedDt = Math.min(dt, 0.05);
    this.currentTime += clampedDt;

    const count = this.pedestrians.length;

    for (let i = 0; i < count; i++) {
      const ped = this.pedestrians[i];
      const pos = ped.mesh.position;
      const prevX = ped.lastPosition.x;
      const prevZ = ped.lastPosition.z;

      // ── (a) DECIDE DESIRED VELOCITY ALONG THE ROUTE ────────────────────────
      const currentWaypoint = ped.route[ped.waypointIndex];
      const toWpX = currentWaypoint.x - pos.x;
      const toWpZ = currentWaypoint.z - pos.z;
      const distToWp = Math.hypot(toWpX, toWpZ);

      // Check if at kerb waiting point
      if (currentWaypoint.isKerbWaitingPoint) {
        if (distToWp < 0.75 || ped.isWaitingAtKerb) {
          const opp = currentWaypoint.oppositeKerb!;
          const oppDx = opp.x - pos.x;
          const oppDz = opp.z - pos.z;
          // Face the OPPOSITE kerb point across the road
          ped.targetYaw = Math.atan2(oppDx, oppDz);

          const ctrl = getCrosswalkCycle(currentWaypoint.crosswalkId || 'cw-105-projects');
          const crossTime = Math.hypot(oppDx, oppDz) / 1.5;
          const canCross = ctrl.canPedestrianStartCrossing(ped.id, crossTime);

          if (canCross) {
            // Green WALK phase with enough remaining time: step off and cross!
            ped.isWaitingAtKerb = false;
            ped.isCrossingRoad = true;
            ped.waypointIndex = (ped.waypointIndex + 1) % ped.route.length;
          } else {
            // Stand and wait at kerb
            ped.isWaitingAtKerb = true;
            ped.isCrossingRoad = false;
          }
        }
      } else {
        ped.isWaitingAtKerb = false;
      }

      // Check reaching normal waypoint (or opposite kerb)
      if (!ped.isWaitingAtKerb && distToWp < 0.75) {
        if (currentWaypoint.isOppositeKerb || ped.isCrossingRoad) {
          // Reached opposite kerb: finished crossing
          const ctrl = getCrosswalkCycle(currentWaypoint.crosswalkId || 'cw-105-projects');
          ctrl.onPedestrianFinishedCrossing(ped.id);
          ped.isCrossingRoad = false;
        }
        if (currentWaypoint.waitSeconds && currentWaypoint.waitSeconds > 0) {
          ped.waitUntil = this.currentTime + currentWaypoint.waitSeconds;
        }
        ped.waypointIndex = (ped.waypointIndex + 1) % ped.route.length;
      }

      const isDeliberatelyWaiting = ped.isWaitingAtKerb || this.currentTime < ped.waitUntil;
      let desiredSpeed = 0;

      if (!isDeliberatelyWaiting) {
        desiredSpeed = ped.isCrossingRoad ? 1.50 : ped.targetSpeed;

        // ── Kinematic Avoidance (look-ahead 2.5m, steer sideways, no overlap) ──
        let closestDist = Infinity;
        let threatLatDiff = 0;
        const forwardX = Math.sin(ped.yaw);
        const forwardZ = Math.cos(ped.yaw);

        for (let j = 0; j < count; j++) {
          if (j === i) continue;
          const other = this.pedestrians[j];
          const otherPos = other.mesh.position;

          const dx = otherPos.x - pos.x;
          const dz = otherPos.z - pos.z;

          // Project along forward direction
          const forwardDist = dx * forwardX + dz * forwardZ;
          // Perpendicular lateral distance
          const latDist = -dx * forwardZ + dz * forwardX;

          if (forwardDist > 0 && forwardDist < 2.5 && Math.abs(latDist) < 1.2) {
            if (forwardDist < closestDist) {
              closestDist = forwardDist;
              threatLatDiff = latDist;
            }
          }
        }

        if (closestDist < Infinity) {
          // Steer smoothly sideways (lateral offset up to 0.55m)
          const steerSign = threatLatDiff >= 0 ? -1 : 1;
          ped.targetLateralOffset = steerSign * 0.55;

          if (closestDist < 0.85) {
            // Buffer gap: brake to prevent overlapping/pushing
            desiredSpeed = 0;
          } else {
            desiredSpeed = (ped.isCrossingRoad ? 1.50 : ped.targetSpeed) * 0.85;
          }
        } else {
          ped.targetLateralOffset = 0;
        }
      } else {
        desiredSpeed = 0;
        ped.targetLateralOffset = 0;
      }

      // Smooth acceleration / deceleration (2.2 m/s^2)
      const maxDeltaSpeed = 2.2 * clampedDt;
      const speedDiff = desiredSpeed - ped.currentSpeed;
      ped.currentSpeed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), maxDeltaSpeed);
      ped.currentSpeed = Math.max(0, ped.currentSpeed);

      // Smooth lateral offset transition
      const latDiff = ped.targetLateralOffset - ped.lateralOffset;
      ped.lateralOffset += Math.sign(latDiff) * Math.min(Math.abs(latDiff), 1.6 * clampedDt);

      // ── (b) MOVE ───────────────────────────────────────────────────────────
      const targetWp = ped.route[ped.waypointIndex];
      const moveX = targetWp.x - pos.x;
      const moveZ = targetWp.z - pos.z;
      const moveDist = Math.hypot(moveX, moveZ);

      let dirX = 0;
      let dirZ = 0;
      if (moveDist > 0.001) {
        dirX = moveX / moveDist;
        dirZ = moveZ / moveDist;
      }

      if (ped.currentSpeed > 0 && moveDist > 0.05) {
        const step = Math.min(moveDist, ped.currentSpeed * clampedDt);
        pos.x += dirX * step;
        pos.z += dirZ * step;

        // Apply lateral avoidance offset perpendicular to movement (only when not crossing road)
        if (!ped.isCrossingRoad) {
          const perpX = -dirZ;
          const perpZ = dirX;
          pos.x += perpX * ped.lateralOffset * clampedDt * 2.0;
          pos.z += perpZ * ped.lateralOffset * clampedDt * 2.0;
        }
      }

      // Elevation: smoothly follow route Y level (road bed at -0.08 while on street)
      const targetY = (ped.isCrossingRoad && pos.z > -6.0 && pos.z < 4.9) ? -0.08 : targetWp.y;
      pos.y = THREE.MathUtils.lerp(pos.y, targetY, Math.min(1.0, 10.0 * clampedDt));

      // ── (c) ROTATE SMOOTHLY TOWARDS MOVEMENT DIRECTION ─────────────────────
      if (!ped.isWaitingAtKerb && moveDist > 0.1) {
        ped.targetYaw = Math.atan2(dirX, dirZ);
      }

      let yawDiff = ped.targetYaw - ped.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      // Fast smooth turn (~0.3s)
      const turnRate = ped.isWaitingAtKerb ? 10.5 : 4.5;
      ped.yaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), turnRate * clampedDt);
      ped.mesh.rotation.y = ped.yaw;

      // ── (d) ANIMATION: MEASURE ACTUAL SPEED & SYNCHRONIZE ──────────────────
      const distanceMoved = Math.hypot(pos.x - prevX, pos.z - prevZ);
      const instantSpeed = distanceMoved / clampedDt;
      ped.actualSpeed = THREE.MathUtils.lerp(ped.actualSpeed, instantSpeed, Math.min(1.0, 10.0 * clampedDt));

      const isWalkingSpeed = ped.actualSpeed > 0.15;
      const naturalSpeed = PEDESTRIAN_STRIDE.clipNaturalSpeed;

      if (isWalkingSpeed) {
        // Play Walking action with timeScale matching ground speed
        const timeScale = Math.max(0.05, ped.actualSpeed / naturalSpeed);
        ped.walkAction.setEffectiveTimeScale(timeScale);

        if (ped.standAction.isRunning() && ped.standAction.getEffectiveWeight() > 0.05) {
          ped.standAction.crossFadeTo(ped.walkAction, 0.3, true);
          ped.walkAction.play();
        } else if (!ped.walkAction.isRunning() || ped.walkAction.getEffectiveWeight() < 0.1) {
          ped.walkAction.reset().play();
        }
      } else {
        // Stationary or waiting: crossfade to idle / standing
        if (ped.walkAction.isRunning() && ped.walkAction.getEffectiveWeight() > 0.05) {
          ped.walkAction.crossFadeTo(ped.standAction, 0.3, true);
          ped.standAction.reset().play();
        } else if (!ped.standAction.isRunning() || ped.standAction.getEffectiveWeight() < 0.1) {
          ped.standAction.reset().play();
        }
      }

      // ── (e) MIXER.UPDATE(dt) ───────────────────────────────────────────────
      // Distance culling / LOD: skip or throttle skeletal animation evaluation for distant pedestrians
      const distToCamera = cameraPos ? Math.hypot(pos.x - cameraPos.x, pos.z - cameraPos.z) : 0;
      if (!cameraPos || distToCamera < 45.0) {
        ped.mixer.update(clampedDt);
      } else if (distToCamera < 85.0) {
        ped.animSkipCount = (ped.animSkipCount || 0) + 1;
        if (ped.animSkipCount >= 3) {
          ped.mixer.update(clampedDt * ped.animSkipCount);
          ped.animSkipCount = 0;
        }
      }
      // Beyond 85m (hidden in fog/occluded): mixer update skipped, zero bone recalculation

      // ── WATCHDOGS ──────────────────────────────────────────────────────────
      // 1. Stuck Watchdog: If position hasn't changed for 5s while not deliberately waiting
      if (!isDeliberatelyWaiting) {
        if (distanceMoved < 0.04 * clampedDt) {
          ped.stuckTimer += clampedDt;
          if (ped.stuckTimer >= 5.0) {
            console.warn(`[WATCHDOG] STUCK ${ped.id}, route index ${ped.waypointIndex}`);
            ped.isStuck = true;
            ped.waypointIndex = (ped.waypointIndex + 1) % ped.route.length;
            ped.stuckTimer = 0;
          }
        } else {
          ped.stuckTimer = 0;
          ped.isStuck = false;
        }
      } else {
        ped.stuckTimer = 0;
        ped.isStuck = false;
      }

      // 2. Anim Mismatch Watchdog: Moving > 0.15 m/s without running walk action
      const walkWeight = ped.walkAction.getEffectiveWeight();
      const walkRunning = ped.walkAction.isRunning();
      if (ped.actualSpeed > 0.15 && (!walkRunning || walkWeight < 0.4)) {
        console.warn(`[WATCHDOG] ANIM MISMATCH ${ped.id}`);
        ped.isAnimMismatch = true;
        ped.mixer.stopAllAction();
        ped.walkAction.reset();
        ped.walkAction.setEffectiveWeight(1.0);
        ped.walkAction.setEffectiveTimeScale(Math.max(0.1, ped.actualSpeed / naturalSpeed));
        ped.walkAction.play();
      } else {
        ped.isAnimMismatch = false;
      }

      // ── Determine RED status for Debug Overlay ─────────────────────────────
      let isRed = false;
      let redReason = '';

      if (ped.actualSpeed > 0.15 && (!ped.walkAction.isRunning() || walkWeight < 0.4)) {
        isRed = true;
        redReason = 'Walking without active walkAction';
      } else if (ped.isStuck) {
        isRed = true;
        redReason = 'Stuck > 5s';
      } else if (ped.actualSpeed > 0.15 && ped.walkAction.getEffectiveTimeScale() <= 0.001) {
        isRed = true;
        redReason = 'timeScale <= 0 while moving';
      }

      ped.isRed = isRed;
      ped.redReason = redReason;
      ped.lastPosition.copy(pos);
    }
  }

  public getTelemetry(): PedestrianTelemetry[] {
    return this.pedestrians.map((ped) => {
      const walkWeight = ped.walkAction.getEffectiveWeight();
      const standWeight = ped.standAction.getEffectiveWeight();
      let activeAction = 'Walk';
      if (standWeight > walkWeight) activeAction = 'Stand';

      return {
        id: ped.id,
        speed: `${ped.actualSpeed.toFixed(2)} m/s`,
        routeIndex: `${ped.waypointIndex}/${ped.route.length}`,
        actionName: activeAction,
        isRunning: ped.walkAction.isRunning(),
        weight: (activeAction === 'Walk' ? walkWeight : standWeight).toFixed(2),
        timeScale: ped.walkAction.getEffectiveTimeScale().toFixed(2),
        isRed: ped.isRed,
        redReason: ped.redReason,
        position: [ped.mesh.position.x, ped.mesh.position.y, ped.mesh.position.z],
      };
    });
  }

  public getRedCount(): number {
    return this.pedestrians.filter((p) => p.isRed).length;
  }
}

export const pedestrianSystem = new PedestrianSystem();
