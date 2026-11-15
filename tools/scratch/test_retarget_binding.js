const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');

const bone = new THREE.Bone();
bone.name = 'spine_36';
const skeleton = new THREE.Skeleton([bone]);
const geom = new THREE.BufferGeometry();
const mat = new THREE.MeshBasicMaterial();
const mesh = new THREE.SkinnedMesh(geom, mat);
mesh.bind(skeleton);

console.log('mesh has skeleton:', !!mesh.skeleton);

const group = new THREE.Group();
group.add(mesh);

const track = new THREE.QuaternionKeyframeTrack('.bones[spine_36].quaternion', [0, 1], [0,0,0,1, 0,0,0,1]);
const clip = new THREE.AnimationClip('test', 1, [track]);

const mixerMesh = new THREE.AnimationMixer(mesh);
const action1 = mixerMesh.clipAction(clip);
console.log('Action created on mesh:', !!action1);
mixerMesh.update(0.1);

const mixerGroup = new THREE.AnimationMixer(group);
const action2 = mixerGroup.clipAction(clip);
console.log('Action created on group:', !!action2);
mixerGroup.update(0.1);
