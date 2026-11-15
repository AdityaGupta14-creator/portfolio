const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Car definitions with node names and raw showroom circle angle
const CAR_DEFS = {
  compact:   { nodeName: 'Compact Body', rawAngleDeg: 143.3, forwardSign: 1 },
  coupe:     { nodeName: 'Coupe Body',   rawAngleDeg: 107.7, forwardSign: 1, isCoupe: true },
  hatchback: { nodeName: 'Hatchback Body', rawAngleDeg: 35.0,  forwardSign: 1 },
  minivan:   { nodeName: 'minivan body', rawAngleDeg: 71.5,  forwardSign: 1 },
  offroad:   { nodeName: 'Offroad Body', rawAngleDeg: -108.0, forwardSign: 1 },
  pickup:    { nodeName: 'Pickup Body',  rawAngleDeg: 0.0,    forwardSign: 1 },
  sedan:     { nodeName: 'Sedan Body',   rawAngleDeg: 180.0,  forwardSign: 1 },
  sport:     { nodeName: 'Sport body',   rawAngleDeg: -35.8,  forwardSign: 1 },
  suv:       { nodeName: 'SUV Body',     rawAngleDeg: -72.0,  forwardSign: 1 },
  wagon:     { nodeName: 'Wagon Body',   rawAngleDeg: -144.6, forwardSign: 1 },
};

// Check wheel nodes
const wheelNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.startsWith('Wheel_') && !n.name.includes('_Wheel_') && !n.name.includes('_Wheek_') && !n.name.includes('_Body_')) {
    wheelNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1], children: n.children });
  }
});

for (const [type, def] of Object.entries(CAR_DEFS)) {
  const bNode = gltf.nodes.find(n => n.name === def.nodeName);
  const bPos = new THREE.Vector3(...bNode.translation);
  
  const matchedWheels = wheelNodes
    .map(w => ({ w, dist: bPos.distanceTo(new THREE.Vector3(...w.translation)) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map(item => item.w);

  // Wheel center in raw space
  const wheelCenter = new THREE.Vector3();
  matchedWheels.forEach(w => wheelCenter.add(new THREE.Vector3(...w.translation)));
  wheelCenter.divideScalar(4);

  // Get wheel mesh radius
  const firstWheelChild = gltf.nodes[matchedWheels[0].children[0]];
  const wMesh = gltf.meshes[firstWheelChild.mesh];
  const wAcc = gltf.accessors[wMesh.primitives[0].attributes.POSITION];
  const wheelDiameterMm = Math.max(wAcc.max[1] - wAcc.min[1], wAcc.max[2] - wAcc.min[2]);
  const wheelRadiusM = (wheelDiameterMm / 2) * 0.001;

  console.log(`Car "${type}": wheels=[${matchedWheels.map(w => w.index).join(',')}], wheelRadius=${wheelRadiusM.toFixed(3)}m (dia ${(wheelRadiusM*2).toFixed(2)}m)`);
}
