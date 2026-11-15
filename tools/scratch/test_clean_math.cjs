const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

const CAR_DEFS = [
  { type: 'compact', nodeName: 'Compact Body', isCoupe: false },
  { type: 'coupe', nodeName: 'Coupe Body', isCoupe: true },
  { type: 'hatchback', nodeName: 'Hatchback Body', isCoupe: false },
  { type: 'minivan', nodeName: 'minivan body', isCoupe: false },
  { type: 'offroad', nodeName: 'Offroad Body', isCoupe: false },
  { type: 'pickup', nodeName: 'Pickup Body', isCoupe: false },
  { type: 'sedan', nodeName: 'Sedan Body', isCoupe: false },
  { type: 'sport', nodeName: 'Sport body', isCoupe: false },
  { type: 'suv', nodeName: 'SUV Body', isCoupe: false },
  { type: 'wagon', nodeName: 'Wagon Body', isCoupe: false },
];

const wheelNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.startsWith('Wheel_') && !n.name.includes('_Wheel_') && !n.name.includes('_Wheek_') && !n.name.includes('_Body_')) {
    wheelNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1], children: n.children });
  }
});

CAR_DEFS.forEach(car => {
  const bNode = gltf.nodes.find(n => n.name === car.nodeName);
  const bPos = new THREE.Vector3(...bNode.translation);
  const wheels = wheelNodes
    .map(w => ({ w, dist: bPos.distanceTo(new THREE.Vector3(...w.translation)) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map(item => item.w);

  // 4 wheel positions
  const wPositions = wheels.map(w => new THREE.Vector3(...w.translation));
  
  // Center of 4 wheels
  const carCenter = new THREE.Vector3();
  wPositions.forEach(p => carCenter.add(p));
  carCenter.divideScalar(4);

  // Find front vs rear:
  // Sort wheels by distance along local forward vector
  const localForward = car.isCoupe ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const bQuat = new THREE.Quaternion(...bNode.rotation);
  const forwardWorld = localForward.clone().applyQuaternion(bQuat);
  forwardWorld.y = 0;
  forwardWorld.normalize();

  // Project wheel positions onto forwardWorld
  const wheelProjections = wPositions.map((p, idx) => ({
    idx,
    p,
    dot: p.clone().sub(carCenter).dot(forwardWorld)
  }));
  wheelProjections.sort((a, b) => b.dot - a.dot);

  // 2 front wheels and 2 rear wheels
  const frontMid = wheelProjections[0].p.clone().add(wheelProjections[1].p).multiplyScalar(0.5);
  const rearMid = wheelProjections[2].p.clone().add(wheelProjections[3].p).multiplyScalar(0.5);

  const forwardAxis = frontMid.clone().sub(rearMid);
  forwardAxis.y = 0;
  forwardAxis.normalize();

  const angleY = Math.atan2(forwardAxis.x, forwardAxis.z);

  // Car world matrix (in mm)
  const carWorldMatrix = new THREE.Matrix4();
  carWorldMatrix.compose(
    carCenter,
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY),
    new THREE.Vector3(1, 1, 1)
  );

  const carInvMatrix = carWorldMatrix.clone().invert();

  // Transform all 4 wheels into car space:
  const localWheels = wPositions.map(p => p.clone().applyMatrix4(carInvMatrix));

  console.log(`\n=== Car: ${car.type} ===`);
  console.log(`  Center: [${carCenter.toArray().map(v => v.toFixed(0)).join(', ')}] mm`);
  console.log(`  Angle Y: ${(angleY * 180 / Math.PI).toFixed(1)} deg`);
  localWheels.forEach((lw, i) => {
    console.log(`  Wheel ${i} in car space: [X:${lw.x.toFixed(0)}, Y:${lw.y.toFixed(0)}, Z:${lw.z.toFixed(0)}] mm`);
  });
});
