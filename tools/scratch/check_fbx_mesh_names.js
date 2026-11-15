const fs = require('fs');
const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');
const { FBXLoader } = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/loaders/FBXLoader.js');

global.URL = {
  createObjectURL: () => 'blob:dummy',
  revokeObjectURL: () => {}
};
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  URL: global.URL,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  createElement: () => ({
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  }),
  createElementNS: () => ({
    addEventListener: () => {},
    removeEventListener: () => {}
  })
};

const filePath = 'c:/Users/Aditya/Desktop/portfolio/app/public/animations/Walking.fbx';
const buf = fs.readFileSync(filePath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
try {
  const fbx = loader.parse(ab, '');
  fbx.traverse(c => {
    if (c.isMesh) {
      const mat = Array.isArray(c.material) ? c.material : [c.material];
      console.log('Mesh:', c.name, 'Materials:', mat.map(m => m ? `${m.name}` : 'null'));
    }
  });
} catch (e) {
  console.log('Err:', e);
}
