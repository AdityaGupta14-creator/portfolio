import * as THREE from 'three';
import { getSharedGLTFLoader } from '../utils/modelLoader';

export type CarType =
  | 'compact'
  | 'coupe'
  | 'hatchback'
  | 'minivan'
  | 'offroad'
  | 'pickup'
  | 'sedan'
  | 'sport'
  | 'suv'
  | 'wagon';

export const ALL_CAR_TYPES: CarType[] = [
  'compact',
  'coupe',
  'hatchback',
  'minivan',
  'offroad',
  'pickup',
  'sedan',
  'sport',
  'suv',
  'wagon',
];

export interface WheelPivots {
  steer: THREE.Group;
  spin: THREE.Group;
}

export interface CarWheelPivots {
  frontLeft: WheelPivots;
  frontRight: WheelPivots;
  rearLeft: WheelPivots;
  rearRight: WheelPivots;
}

export interface CarInstance {
  root: THREE.Group;
  wheelPivots: CarWheelPivots;
  wheelRadius: number;
  length: number;
  front: THREE.Vector3;
  rear: THREE.Vector3;
  type: CarType;
  bodyMesh: THREE.Mesh | null;
  forwardSign: 1 | -1;
  setBodyColor: (color: THREE.ColorRepresentation) => void;
  setSteering: (angleRad: number) => void;
  spinWheels: (angleDeltaRad: number) => void;
}

interface RawCarMeta {
  type: CarType;
  nodeName: string;
  forwardSign: 1 | -1;
  isCoupe?: boolean;
}

export const CAR_CONFIGS: Record<CarType, RawCarMeta> = {
  compact: { type: 'compact', nodeName: 'Compact_Body', forwardSign: 1 },
  coupe: { type: 'coupe', nodeName: 'Coupe_Body', forwardSign: 1, isCoupe: true },
  hatchback: { type: 'hatchback', nodeName: 'Hatchback_Body', forwardSign: 1 },
  minivan: { type: 'minivan', nodeName: 'minivan_body', forwardSign: 1 },
  offroad: { type: 'offroad', nodeName: 'Offroad_Body', forwardSign: 1 },
  pickup: { type: 'pickup', nodeName: 'Pickup_Body', forwardSign: 1 },
  sedan: { type: 'sedan', nodeName: 'Sedan_Body', forwardSign: 1 },
  sport: { type: 'sport', nodeName: 'Sport_body', forwardSign: 1 },
  suv: { type: 'suv', nodeName: 'SUV_Body', forwardSign: 1 },
  wagon: { type: 'wagon', nodeName: 'Wagon_Body', forwardSign: 1 },
};

let cachedSourceScene: THREE.Group | null = null;
let loadPromise: Promise<THREE.Group> | null = null;

/**
 * Preload and cache the cars.web.glb model.
 */
export async function loadCarModel(): Promise<THREE.Group> {
  if (cachedSourceScene) return cachedSourceScene;
  if (loadPromise) return loadPromise;

  const loader = getSharedGLTFLoader();
  loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      '/models/cars.web.glb',
      (gltf) => {
        cachedSourceScene = gltf.scene;
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.error('Failed to load /models/cars.web.glb', err);
        reject(err);
      }
    );
  });

  return loadPromise;
}

export function getCachedCarScene(): THREE.Group | null {
  return cachedSourceScene;
}

function findAllWheelNodes(scene: THREE.Object3D): THREE.Object3D[] {
  const wheels: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (
      obj.name &&
      obj.name.startsWith('Wheel_') &&
      !obj.name.includes('_Wheel_') &&
      !obj.name.includes('_Wheek_') &&
      !obj.name.includes('_Body_') &&
      obj.children.length > 0
    ) {
      wheels.push(obj);
    }
  });
  return wheels;
}

/**
 * Creates an independent CarInstance of the specified type.
 */
export function createCar(
  type: CarType,
  bodyColour?: THREE.ColorRepresentation,
  sourceScene?: THREE.Object3D
): CarInstance {
  const scene = sourceScene || cachedSourceScene;
  if (!scene) {
    throw new Error(
      `Cannot create car "${type}": cars model not loaded yet. Call await loadCarModel() first.`
    );
  }

  const cfg = CAR_CONFIGS[type];
  const targetNorm = cfg.nodeName.toLowerCase().replace(/[\s_]+/g, '_');
  let bodyNode: THREE.Object3D | undefined = scene.getObjectByName(cfg.nodeName);
  if (!bodyNode) {
    scene.traverse((o) => {
      if (!bodyNode && o.name && o.name.toLowerCase().replace(/[\s_]+/g, '_') === targetNorm) {
        bodyNode = o;
      }
    });
  }

  if (!bodyNode) {
    throw new Error(`Car body node "${cfg.nodeName}" not found in GLTF model.`);
  }

  scene.updateMatrixWorld(true);

  // 1. Identify 4 nearest wheels by world distance
  const allWheels = findAllWheelNodes(scene);
  const bodyWorldPos = new THREE.Vector3();
  bodyNode.getWorldPosition(bodyWorldPos);

  const matchedWheelsWithDist = allWheels.map((w) => {
    const wPos = new THREE.Vector3();
    w.getWorldPosition(wPos);
    return {
      node: w,
      dist: bodyWorldPos.distanceTo(wPos),
      worldPos: wPos,
    };
  });
  matchedWheelsWithDist.sort((a, b) => a.dist - b.dist);
  const matchedWheels = matchedWheelsWithDist.slice(0, 4);

  if (matchedWheels.length < 4) {
    throw new Error(`Could not find 4 wheels for car "${type}".`);
  }

  // 2. Compute car center and heading in raw world space
  const wheelWorldPositions = matchedWheels.map((m) => m.worldPos);
  const carCenter = new THREE.Vector3();
  wheelWorldPositions.forEach((p) => carCenter.add(p));
  carCenter.divideScalar(4);

  // Forward direction in horizontal plane:
  // Use body's local forward vector to project wheels into front vs rear
  const localForward = cfg.isCoupe ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const bodyForwardWorld = localForward.clone().applyQuaternion(bodyNode.quaternion);
  bodyForwardWorld.y = 0;
  bodyForwardWorld.normalize();

  // Find the two wheels furthest in bodyForwardWorld direction
  const wheelDots = wheelWorldPositions.map((p, idx) => ({
    idx,
    p,
    dot: p.clone().sub(carCenter).dot(bodyForwardWorld),
  }));
  wheelDots.sort((a, b) => b.dot - a.dot);

  const frontMid = wheelDots[0].p.clone().add(wheelDots[1].p).multiplyScalar(0.5);
  const rearMid = wheelDots[2].p.clone().add(wheelDots[3].p).multiplyScalar(0.5);

  const forwardAxis = frontMid.clone().sub(rearMid);
  forwardAxis.y = 0;
  forwardAxis.normalize();

  // If car is configured with forwardSign === -1, flip forwardAxis
  if (cfg.forwardSign === -1) {
    forwardAxis.negate();
  }

  const angleY = Math.atan2(forwardAxis.x, forwardAxis.z);

  // Car transformation matrix in world space (mm)
  const carWorldMatrix = new THREE.Matrix4().compose(
    carCenter,
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY),
    new THREE.Vector3(1, 1, 1)
  );
  const carInvMatrix = carWorldMatrix.clone().invert();

  // 3. Measure wheel radius from wheel mesh in world space
  matchedWheels[0].node.updateMatrixWorld(true);
  const wheelWorldBox = new THREE.Box3().setFromObject(matchedWheels[0].node);
  const wheelWorldSize = wheelWorldBox.getSize(new THREE.Vector3());
  const wheelRadiusM = Math.max(wheelWorldSize.y, wheelWorldSize.z) / 2;

  // 4. Build the independent carRoot
  const root = new THREE.Group();
  root.name = `Car_${type}`;

  const carLocal = new THREE.Group();
  carLocal.name = `CarLocal_${type}`;
  // carLocal is in city meters (world scale is already 1 unit = 1 meter)
  carLocal.position.y = wheelRadiusM;
  root.add(carLocal);

  // 5. Clone and transform Body meshes
  const bodyClone = bodyNode.clone(true);
  let carBodyMesh: THREE.Mesh | null = null;

  bodyClone.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const lowerName = (mesh.name || '').toLowerCase();
      // Only primary body mesh gets independent cloned material
      if (lowerName.includes('body_0') || (!lowerName.includes('glass') && !lowerName.includes('optic'))) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
        carBodyMesh = mesh;
        if (bodyColour !== undefined && mesh.material) {
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if ('color' in mat) {
            (mat as THREE.MeshStandardMaterial).color.set(bodyColour);
          }
        }
      }
    }
  });

  // Transform bodyClone from world space into car space
  const bodyLocalMatrix = carInvMatrix.clone().multiply(bodyNode.matrixWorld);
  bodyLocalMatrix.decompose(bodyClone.position, bodyClone.quaternion, bodyClone.scale);
  bodyClone.matrixAutoUpdate = true;
  carLocal.add(bodyClone);

  // 6. Setup 4 Wheel Pivots (Steer & Spin)
  interface TransformedWheel {
    steerGroup: THREE.Group;
    spinGroup: THREE.Group;
    localPos: THREE.Vector3;
    isFront: boolean;
    isLeft: boolean;
  }

  const processedWheels: TransformedWheel[] = [];

  matchedWheels.forEach((mw, i) => {
    // Wheel center in car space
    const wheelLocalPos = mw.worldPos.clone().applyMatrix4(carInvMatrix);

    const steerGroup = new THREE.Group();
    steerGroup.name = `Steer_${type}_${i}`;
    steerGroup.position.copy(wheelLocalPos);
    carLocal.add(steerGroup);

    const spinGroup = new THREE.Group();
    spinGroup.name = `Spin_${type}_${i}`;
    spinGroup.position.set(0, 0, 0);
    steerGroup.add(spinGroup);

    // Clone wheel node
    const wheelClone = mw.node.clone(true);
    // Relative matrix from steerGroup to wheelClone
    // Wheel node center was mw.worldPos, so inside steerGroup at (0,0,0),
    // wheelClone rotation is just its world rotation transformed by car rotation
    const steerWorldMatrix = new THREE.Matrix4().compose(
      mw.worldPos,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY),
      new THREE.Vector3(1, 1, 1)
    );
    const steerInvMatrix = steerWorldMatrix.clone().invert();
    const wheelInSpinMatrix = steerInvMatrix.multiply(mw.node.matrixWorld);

    wheelInSpinMatrix.decompose(wheelClone.position, wheelClone.quaternion, wheelClone.scale);
    wheelClone.matrixAutoUpdate = true;
    spinGroup.add(wheelClone);

    processedWheels.push({
      steerGroup,
      spinGroup,
      localPos: wheelLocalPos,
      isFront: wheelLocalPos.z > 0,
      isLeft: wheelLocalPos.x < 0,
    });
  });

  // Group wheels into frontLeft, frontRight, rearLeft, rearRight
  const frontWheels = processedWheels.filter((w) => w.isFront);
  const rearWheels = processedWheels.filter((w) => !w.isFront);

  if (frontWheels.length !== 2 || rearWheels.length !== 2) {
    processedWheels.sort((a, b) => b.localPos.z - a.localPos.z);
    frontWheels.length = 0;
    rearWheels.length = 0;
    frontWheels.push(processedWheels[0], processedWheels[1]);
    rearWheels.push(processedWheels[2], processedWheels[3]);
  }

  frontWheels.sort((a, b) => a.localPos.x - b.localPos.x);
  rearWheels.sort((a, b) => a.localPos.x - b.localPos.x);

  const frontLeft = frontWheels[0];
  const frontRight = frontWheels[1];
  const rearLeft = rearWheels[0];
  const rearRight = rearWheels[1];

  const wheelPivots: CarWheelPivots = {
    frontLeft: { steer: frontLeft.steerGroup, spin: frontLeft.spinGroup },
    frontRight: { steer: frontRight.steerGroup, spin: frontRight.spinGroup },
    rearLeft: { steer: rearLeft.steerGroup, spin: rearLeft.spinGroup },
    rearRight: { steer: rearRight.steerGroup, spin: rearRight.spinGroup },
  };

  // 7. Measure Bumper-to-Bumper Length in meters
  root.updateMatrixWorld(true);
  const fullCarBox = new THREE.Box3().setFromObject(root);
  const length = fullCarBox.max.z - fullCarBox.min.z;
  const front = new THREE.Vector3(0, fullCarBox.min.y + 0.3, fullCarBox.max.z);
  const rear = new THREE.Vector3(0, fullCarBox.min.y + 0.3, fullCarBox.min.z);

  // 8. Methods
  const setBodyColor = (color: THREE.ColorRepresentation) => {
    if (carBodyMesh && carBodyMesh.material) {
      const mat = Array.isArray(carBodyMesh.material) ? carBodyMesh.material[0] : carBodyMesh.material;
      if ('color' in mat) {
        (mat as THREE.MeshStandardMaterial).color.set(color);
      }
    }
  };

  const setSteering = (angleRad: number) => {
    wheelPivots.frontLeft.steer.rotation.y = angleRad;
    wheelPivots.frontRight.steer.rotation.y = angleRad;
  };

  const spinWheels = (angleDeltaRad: number) => {
    wheelPivots.frontLeft.spin.rotation.x += angleDeltaRad;
    wheelPivots.frontRight.spin.rotation.x += angleDeltaRad;
    wheelPivots.rearLeft.spin.rotation.x += angleDeltaRad;
    wheelPivots.rearRight.spin.rotation.x += angleDeltaRad;
  };

  console.log(
    `[carFactory] Built "${type}" -> length: ${length.toFixed(2)}m, wheelRadius: ${wheelRadiusM.toFixed(3)}m, forward: (0,0,1)`
  );

  return {
    root,
    wheelPivots,
    wheelRadius: wheelRadiusM,
    length,
    front,
    rear,
    type,
    bodyMesh: carBodyMesh,
    forwardSign: cfg.forwardSign,
    setBodyColor,
    setSteering,
    spinWheels,
  };
}
