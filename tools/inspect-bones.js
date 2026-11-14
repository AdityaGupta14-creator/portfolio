const fs = require('fs');
const path = require('path');

const buf = fs.readFileSync(path.resolve(__dirname, '../app/public/models/characters.glb'));
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

const skin = gltf.skins[0];
console.log('Skin 0 joints count:', skin.joints.length);

const jointNodes = skin.joints.map(j => ({
  idx: j,
  name: gltf.nodes[j].name,
  rot: gltf.nodes[j].rotation || [0, 0, 0, 1],
  trans: gltf.nodes[j].translation || [0, 0, 0]
}));

console.log('Key Rigify bones for Rig 0:');
jointNodes.forEach(j => {
  const n = j.name.toLowerCase();
  if (n.includes('thigh') || n.includes('shin') || n.includes('foot') || n.includes('arm') || n.includes('forearm') || n.includes('spine')) {
    console.log(`- Bone "${j.name}" (index ${j.idx})`);
    console.log(`    Rotation: [${j.rot.map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Translation: [${j.trans.map(v => v.toFixed(4)).join(', ')}]`);
  }
});
