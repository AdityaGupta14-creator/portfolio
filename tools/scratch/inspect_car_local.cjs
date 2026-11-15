const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Print all 10 bodies and check their meshes and bounding boxes from GLTF accessors
const bodyMeshes = {};
gltf.nodes.forEach(n => {
  if (n.name && n.name.toLowerCase().includes('body') && !n.name.includes('_') && n.children) {
    const meshChildren = n.children.map(ci => gltf.nodes[ci]);
    bodyMeshes[n.name] = {
      node: n,
      children: meshChildren.map(mc => ({
        name: mc.name,
        mesh: gltf.meshes[mc.mesh],
        posAcc: gltf.accessors[gltf.meshes[mc.mesh].primitives[0].attributes.POSITION]
      }))
    };
  }
});

console.log('--- CAR BODY MESH BOUNDS (LOCAL TO BODY NODE) ---');
for (const [name, data] of Object.entries(bodyMeshes)) {
  console.log(`\nCar: ${name}`);
  data.children.forEach(c => {
    const min = c.posAcc.min.map(v => v.toFixed(0));
    const max = c.posAcc.max.map(v => v.toFixed(0));
    console.log(`  ${c.name}: [${min.join(', ')}] -> [${max.join(', ')}]`);
  });
}
