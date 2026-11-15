const fs = require('fs');

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
// Read GLB header: magic (4), version (4), length (4), chunkLength (4), chunkType (4)
const jsonLength = glbBuffer.readUInt32LE(12);
const jsonBuffer = glbBuffer.subarray(20, 20 + jsonLength);
const gltf = JSON.parse(jsonBuffer.toString('utf8'));

console.log('Scenes count:', gltf.scenes?.length);
console.log('Nodes count:', gltf.nodes?.length);
console.log('Meshes count:', gltf.meshes?.length);

const nodes = gltf.nodes.map((n, i) => ({ index: i, name: n.name, mesh: n.mesh, children: n.children }));
console.log('\n--- ROOT & HIGH LEVEL NODES ---');
nodes.forEach(n => {
  if (!n.name || n.name.toLowerCase().includes('body') || n.name.toLowerCase().includes('wheel') || n.name.toLowerCase().includes('cylinder')) {
    console.log(`[${n.index}] "${n.name}" (mesh: ${n.mesh}, children: ${n.children ? n.children.length : 0})`);
  }
});
