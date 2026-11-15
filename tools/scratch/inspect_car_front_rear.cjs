const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// For each car, let's look at the Glass and Optics bounds to determine front vs rear.
// For example, in a car, the windshield is near the front and rear window near the rear.
// Also let's inspect the steering/engine hood vs trunk.
gltf.nodes.forEach(n => {
  if (n.name && n.name.toLowerCase().includes('body') && !n.name.includes('_') && n.children) {
    const meshChildren = n.children.map(ci => gltf.nodes[ci]);
    console.log(`\n=== ${n.name} ===`);
    meshChildren.forEach(mc => {
      const mesh = gltf.meshes[mc.mesh];
      const acc = gltf.accessors[mesh.primitives[0].attributes.POSITION];
      console.log(`  ${mc.name}:`);
      console.log(`    min: [${acc.min.map(v => v.toFixed(0)).join(', ')}]`);
      console.log(`    max: [${acc.max.map(v => v.toFixed(0)).join(', ')}]`);
    });
  }
});
