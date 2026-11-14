const path = require('path');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const fs = require('fs');

const loader = new GLTFLoader();
const modelPath = path.resolve(__dirname, '../app/public/models/city.glb');
const buf = fs.readFileSync(modelPath);

loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', gltf => {
  gltf.scene.updateMatrixWorld(true);
  console.log('--- SCENE HIERARCHY & BOUNDING BOXES ---');
  gltf.scene.traverse(o => {
    const box = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log(`Node: "${o.name}" (${o.type})`);
    console.log(`  BBox Min:   [${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}]`);
    console.log(`  BBox Max:   [${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)}]`);
    console.log(`  Dimensions: [W=${size.x.toFixed(2)}, H=${size.y.toFixed(2)}, D=${size.z.toFixed(2)}]`);
  });
});
