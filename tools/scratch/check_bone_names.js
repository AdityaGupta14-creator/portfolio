const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three'));
const { GLTFLoader } = require(path.resolve('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'));

const buf = fs.readFileSync('c:/Users/Aditya/Desktop/portfolio/app/public/models/characters.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', gltf => {
  const bones = [];
  gltf.scene.traverse(o => {
    if (o.isBone && o.name.toLowerCase().includes('arm')) {
      bones.push(o.name);
    }
  });
  console.log('Total arm bones:', bones.length, bones.slice(0, 10));
});
