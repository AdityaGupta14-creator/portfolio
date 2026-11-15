const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const root = new THREE.Group();
const local = new THREE.Group();
local.scale.setScalar(0.001);
local.position.y = 0.35;
root.add(local);

const geom = new THREE.BoxGeometry(1000, 1000, 4000);
const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
local.add(mesh);

root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
console.log('Box size:', box.getSize(new THREE.Vector3()));
