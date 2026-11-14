const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const fs = require('fs');
const path = require('path');

const loader = new GLTFLoader();
const modelPath = path.resolve(__dirname, '../app/public/models/characters.glb');
const buf = fs.readFileSync(modelPath);

loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', gltf => {
  gltf.scene.updateMatrixWorld(true);

  function testBone(boneName, childName) {
    let bone = null;
    let child = null;
    gltf.scene.traverse(o => {
      if (o.isBone) {
        const clean = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetClean = boneName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const childClean = childName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.includes(targetClean) && !bone) bone = o;
        if (clean.includes(childClean) && !child) child = o;
      }
    });

    if (!bone || !child) {
      console.log(`Could not find ${boneName} or ${childName}`);
      return;
    }

    const restQuat = bone.quaternion.clone();
    const restPos = new THREE.Vector3();
    child.getWorldPosition(restPos);

    ['X', 'Y', 'Z'].forEach(axis => {
      const angle = THREE.MathUtils.degToRad(20);
      const q = new THREE.Quaternion();
      if (axis === 'X') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
      if (axis === 'Y') q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      if (axis === 'Z') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);

      bone.quaternion.copy(restQuat).multiply(q);
      gltf.scene.updateMatrixWorld(true);

      const newPos = new THREE.Vector3();
      child.getWorldPosition(newPos);
      const delta = new THREE.Vector3().subVectors(newPos, restPos);
      console.log(`${bone.name} -> +20 deg around local ${axis}: child ${child.name} delta: [dX=${delta.x.toFixed(4)}, dY=${delta.y.toFixed(4)}, dZ=${delta.z.toFixed(4)}]`);
    });
    bone.quaternion.copy(restQuat);
  }

  console.log('--- TESTING SHIN (KNEE BEND) ---');
  testBone('shin.L', 'foot.L');
  console.log('--- TESTING UPPER ARM (SHOULDER SWING) ---');
  testBone('upper_arm.L', 'hand.L');
  console.log('--- TESTING FOREARM (ELBOW BEND) ---');
  testBone('forearm.L', 'hand.L');
});
