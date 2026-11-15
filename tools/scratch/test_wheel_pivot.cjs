const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

// Load GLB JSON and accessors
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Let's inspect the bounding box of each wheel mesh
console.log('--- ALL UNIQUE WHEEL MESHES IN GLTF ---');
const wheelMeshes = gltf.meshes.filter(m => m.name.toLowerCase().includes('wheel'));
wheelMeshes.forEach(m => {
  const acc = gltf.accessors[m.primitives[0].attributes.POSITION];
  const size = [acc.max[0] - acc.min[0], acc.max[1] - acc.min[1], acc.max[2] - acc.min[2]];
  const center = [(acc.max[0] + acc.min[0])/2, (acc.max[1] + acc.min[1])/2, (acc.max[2] + acc.min[2])/2];
  console.log(`Mesh "${m.name}": size=[${size.map(v => v.toFixed(1)).join(', ')}], center=[${center.map(v => v.toFixed(2)).join(', ')}]`);
});
