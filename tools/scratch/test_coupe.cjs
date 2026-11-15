const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Check Coupe Body (15) and Wheel_F (19, 21, 23, 25)
const coupe = gltf.nodes[15];
console.log('Coupe Body node 15:', coupe);

[19, 21, 23, 25].forEach(idx => {
  const w = gltf.nodes[idx];
  console.log(`Wheel ${idx} (${w.name}):`, w.translation, w.rotation);
});
