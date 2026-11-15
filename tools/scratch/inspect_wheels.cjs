const fs = require('fs');

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

console.log('--- ALL WHEEL NODES ---');
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase().includes('wheel')) {
    console.log(JSON.stringify({
      index: i,
      name: n.name,
      mesh: n.mesh,
      trans: n.translation,
      rot: n.rotation,
      children: n.children
    }));
  }
});
