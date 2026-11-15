const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three'));
const { GLTFLoader } = require(path.resolve('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'));

const buf = fs.readFileSync('c:/Users/Aditya/Desktop/portfolio/app/public/models/characters.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', gltf => {
  gltf.scene.updateMatrixWorld(true);
  const list = [];
  gltf.scene.traverse(o => {
    if (o.isBone && o.name.toLowerCase().startsWith('upper_arml_')) {
      const wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      list.push({ name: o.name, quat: o.quaternion.toArray().map(v => v.toFixed(3)) });
    }
  });
  console.log(list);
});
