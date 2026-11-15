import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Cleans a bone name by removing prefixes ('mixamorig:', 'mixamorig'),
 * numeric suffixes ('_30', '_36'), dots, and underscores for reliable matching.
 */
export function cleanBoneName(name: string): string {
  return name
    .replace(/^mixamorig:?/i, '')
    .replace(/_\d+$/, '')
    .replace(/[\._]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Cleaned Rigify-to-Mixamo base name dictionary.
 * Maps every primary skeleton joint from Rigify metarig conventions to Mixamo conventions.
 */
export const RIGIFY_CLEAN_TO_MIXAMO_BASE: Record<string, string> = {
  'spine': 'hips',
  'spine001': 'spine',
  'spine002': 'spine1',
  'spine003': 'spine2',
  'spine004': 'neck',
  'spine006': 'head',
  'shoulderl': 'leftshoulder',
  'shoulderr': 'rightshoulder',
  'upperarml': 'leftarm',
  'upperarmr': 'rightarm',
  'forearml': 'leftforearm',
  'forearmr': 'rightforearm',
  'handl': 'lefthand',
  'handr': 'righthand',
  'thighl': 'leftupleg',
  'thighr': 'rightupleg',
  'shinl': 'leftleg',
  'shinr': 'rightleg',
  'footl': 'leftfoot',
  'footr': 'rightfoot',
  'toel': 'lefttoebase',
  'toer': 'righttoebase',
};

/**
 * Finds corresponding source Mixamo bone name for a target Rigify bone.
 */
export function mapTargetBoneToMixamo(
  targetBoneName: string,
  sourceBones: THREE.Bone[]
): string | undefined {
  const cleanTarget = cleanBoneName(targetBoneName);
  const targetMixamoBase = RIGIFY_CLEAN_TO_MIXAMO_BASE[cleanTarget];
  if (!targetMixamoBase) return undefined;

  for (const sb of sourceBones) {
    if (cleanBoneName(sb.name) === targetMixamoBase) {
      return sb.name;
    }
  }
  return undefined;
}

export interface RetargetResult {
  clip: THREE.AnimationClip;
  mappedBonesCount: number;
  totalTargetBones: number;
  scaleUsed: number;
  mappingDetails: { target: string; source: string }[];
}

/**
 * Retargets an AnimationClip (e.g. Mixamo Walking) from sourceMesh to targetMesh
 * using SkeletonUtils.retargetClip with full scale matching and in-place walking.
 */
export function retargetMixamoToRigify(
  targetMesh: THREE.SkinnedMesh,
  sourceMesh: THREE.SkinnedMesh,
  clip: THREE.AnimationClip,
  sourceRoot?: THREE.Object3D,
  targetRoot?: THREE.Object3D,
  customOffsets?: Record<string, THREE.Matrix4>
): RetargetResult {
  const targetSkeleton = targetMesh.skeleton;
  let sourceSkeleton = sourceMesh.skeleton;

  // If source skeleton has only a subset of bones (e.g. only legs/pants),
  // gather all Bone nodes from sourceRoot to build the full complete skeleton
  if (sourceSkeleton.bones.length < 20 && sourceRoot) {
    const allSourceBones: THREE.Bone[] = [];
    sourceRoot.traverse((c) => {
      if ((c as THREE.Bone).isBone) allSourceBones.push(c as THREE.Bone);
    });
    if (allSourceBones.length > sourceSkeleton.bones.length) {
      sourceSkeleton = new THREE.Skeleton(allSourceBones);
    }
  }

  // Ensure source object passed to retargetClip can bind animation tracks
  // If sourceRoot is provided, attach skeleton reference so retargetClip can access both
  // the skeleton and child bone nodes for its internal AnimationMixer
  const sourceObj = sourceRoot || sourceMesh;
  (sourceObj as any).skeleton = sourceSkeleton;

  const targetObj = targetRoot || targetMesh;
  (targetObj as any).skeleton = targetSkeleton;

  // Build explicit bone name dictionary for SkeletonUtils
  const names: Record<string, string> = {};
  const mappingDetails: { target: string; source: string }[] = [];

  for (const tBone of targetSkeleton.bones) {
    const matchedSource = mapTargetBoneToMixamo(tBone.name, sourceSkeleton.bones);
    if (matchedSource) {
      names[tBone.name] = matchedSource;
      mappingDetails.push({ target: tBone.name, source: matchedSource });
    }
  }

  // Determine source hip bone name
  let hipSourceName = 'mixamorigHips';
  const foundHip = sourceSkeleton.bones.find(
    (b) => cleanBoneName(b.name) === 'hips' || b.name === 'mixamorigHips'
  );
  if (foundHip) {
    hipSourceName = foundHip.name;
  }

  // Ensure both skeletons are updated in world space
  targetObj.updateMatrixWorld(true);
  sourceObj.updateMatrixWorld(true);

  const tHipBone = targetSkeleton.bones.find((b) => names[b.name] === hipSourceName);
  const sHipBone = sourceSkeleton.bones.find((b) => b.name === hipSourceName);

  const tHipWorld = new THREE.Vector3();
  const sHipWorld = new THREE.Vector3();

  if (tHipBone) tHipBone.getWorldPosition(tHipWorld);
  if (sHipBone) sHipBone.getWorldPosition(sHipWorld);

  let scale = 1.0;
  if (sHipWorld.y > 0.01 && tHipWorld.y > 0.01) {
    scale = tHipWorld.y / sHipWorld.y;
  } else if (sHipBone && tHipBone && sHipBone.position.y > 0.01) {
    scale = tHipBone.position.y / sHipBone.position.y;
  }

  // Compute canonical rest-pose calibration offsets for all mapped bones:
  // Offset = Q_sourceRest^{-1} * Q_targetRest
  // This automatically corrects for bone roll / rest orientation discrepancies between
  // Mixamo's T-pose (+X coordinate system) and Blender/Rigify's A-pose (+Y coordinate system)
  const autoLocalOffsets: Record<string, THREE.Matrix4> = {};

  for (const tBone of targetSkeleton.bones) {
    const sBoneName = names[tBone.name];
    if (!sBoneName) continue;
    const sBone = sourceSkeleton.bones.find((b) => b.name === sBoneName);
    if (!sBone) continue;

    const qTarget = new THREE.Quaternion();
    const qSource = new THREE.Quaternion();

    tBone.getWorldQuaternion(qTarget);
    sBone.getWorldQuaternion(qSource);

    // Q_offset = Q_source^{-1} * Q_target
    const qOffset = qSource.clone().invert().multiply(qTarget);
    const mOffset = new THREE.Matrix4().makeRotationFromQuaternion(qOffset);
    autoLocalOffsets[tBone.name] = mOffset;
  }

  // If customOffsets are provided, apply additional fine adjustments
  if (customOffsets) {
    for (const [key, mat] of Object.entries(customOffsets)) {
      for (const tBone of targetSkeleton.bones) {
        if (tBone.name === key || cleanBoneName(tBone.name) === cleanBoneName(key)) {
          if (autoLocalOffsets[tBone.name]) {
            autoLocalOffsets[tBone.name].multiply(mat);
          } else {
            autoLocalOffsets[tBone.name] = mat;
          }
        }
      }
    }
  }

  const options: any = {
    names,
    hip: hipSourceName,
    hipInfluence: new THREE.Vector3(0, 1, 0), // In-place: only vertical bounce
    scale: scale,
    localOffsets: autoLocalOffsets,
    preserveBonePositions: true,
    preserveBoneMatrix: true,
    useTargetMatrix: false,
    useFirstFramePosition: false,
    fps: 30,
  };

  // Run Three.js SkeletonUtils.retargetClip
  const retargetedClip = SkeletonUtils.retargetClip(targetObj, sourceObj, clip, options);
  retargetedClip.name = `${clip.name}_Retargeted`;

  // Fix track names: convert '.bones[boneName].quaternion' -> 'boneName.quaternion'
  // and '.bones[boneName].position' -> 'boneName.position'
  // so AnimationMixer bound to target character Group or SkinnedMesh works seamlessly
  retargetedClip.tracks.forEach((track) => {
    track.name = track.name.replace(/^\.bones\[(.*?)\]/, '$1');
  });

  // Fix in-place hip translation: ensure hip rests at target character's native X and Z,
  // and keep vertical bounce grounded at native hip height
  if (tHipBone) {
    const nativeHipY = tHipBone.position.y;
    const restX = tHipBone.position.x;
    const restZ = tHipBone.position.z;

    retargetedClip.tracks.forEach((track) => {
      if (track.name.endsWith('.position')) {
        const firstY = track.values[1];
        const yOffset = (Math.abs(firstY - nativeHipY) > 0.15) ? (nativeHipY - firstY) : 0;

        for (let i = 0; i < track.values.length; i += 3) {
          track.values[i] = restX;
          track.values[i + 1] = track.values[i + 1] + yOffset;
          track.values[i + 2] = restZ;
        }
      }
    });
  }

  return {
    clip: retargetedClip,
    mappedBonesCount: mappingDetails.length,
    totalTargetBones: targetSkeleton.bones.length,
    scaleUsed: scale,
    mappingDetails,
  };
}
