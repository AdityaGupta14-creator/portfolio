const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

const bodyNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase().includes('body') && !n.name.includes('_') && n.children && n.children.length > 0) {
    bodyNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1] });
  }
});

const wheelNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.startsWith('Wheel_') && !n.name.includes('_Wheel_') && !n.name.includes('_Wheek_') && !n.name.includes('_Body_')) {
    wheelNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1], children: n.children });
  }
});

console.log(`Checking match for ${bodyNodes.length} bodies against ${wheelNodes.length} wheels...`);

const assignedWheels = new Set();
const carMatches = [];

bodyNodes.forEach(b => {
  const bPos = new THREE.Vector3(...b.translation);
  const bQuat = new THREE.Quaternion(...b.rotation);
  const bInvQuat = bQuat.clone().invert();

  // Find candidate wheels whose distance to body center is within ~3.5 meters (3500 mm)
  const candidates = [];
  wheelNodes.forEach(w => {
    const wPos = new THREE.Vector3(...w.translation);
    const dist = bPos.distanceTo(wPos);
    if (dist < 3500) {
      // transform into body local space
      const localPos = wPos.clone().sub(bPos).applyQuaternion(bInvQuat);
      candidates.push({
        wheel: w,
        dist,
        localPos,
      });
    }
  });

  candidates.sort((a, b) => a.dist - b.dist);
  console.log(`\n=============================`);
  console.log(`Car: "${b.name}" (index ${b.index}) - ${candidates.length} candidates found:`);
  candidates.forEach(c => {
    console.log(`   Wheel [${c.wheel.index}] "${c.wheel.name}": dist=${c.dist.toFixed(0)}mm, localPos=[X:${c.localPos.x.toFixed(0)}, Y:${c.localPos.y.toFixed(0)}, Z:${c.localPos.z.toFixed(0)}]`);
  });

  if (candidates.length >= 4) {
    const top4 = candidates.slice(0, 4);
    top4.forEach(c => assignedWheels.add(c.wheel.index));
    carMatches.push({ body: b, wheels: top4 });
  }
});

console.log(`\nTotal unique wheels matched: ${assignedWheels.size} / ${wheelNodes.length}`);
