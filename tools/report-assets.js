const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function analyzeGlb(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) {
    return { error: 'File not found: ' + relativePath };
  }
  const stat = fs.statSync(fullPath);
  const buf = fs.readFileSync(fullPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

  let totalTriangles = 0;
  const meshes = (gltf.meshes || []).map((m, idx) => {
    let tris = 0;
    (m.primitives || []).forEach(p => {
      if (p.indices !== undefined) {
        tris += gltf.accessors[p.indices].count / 3;
      } else if (p.attributes && p.attributes.POSITION !== undefined) {
        tris += gltf.accessors[p.attributes.POSITION].count / 3;
      }
    });
    totalTriangles += tris;
    return { name: m.name || `Mesh_${idx}`, tris };
  });

  // Accessor-based bounding box
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  (gltf.accessors || []).forEach(acc => {
    if (acc.type === 'VEC3' && acc.min && acc.max) {
      for (let i = 0; i < 3; i++) {
        if (acc.min[i] < min[i]) min[i] = acc.min[i];
        if (acc.max[i] > max[i]) max[i] = acc.max[i];
      }
    }
  });

  const nodes = (gltf.nodes || []).map(n => n.name).filter(Boolean);
  const metarigRoots = nodes.filter(n => n.toLowerCase().startsWith('metarig'));

  return {
    path: relativePath,
    size: stat.size,
    sizeStr: formatBytes(stat.size),
    triangles: totalTriangles,
    meshes,
    nodeCount: nodes.length,
    metarigRoots,
    nodesSample: nodes.slice(0, 10),
    allNodes: nodes,
    bbox: {
      min: min.map(v => Number(v.toFixed(3))),
      max: max.map(v => Number(v.toFixed(3))),
      size: [
        Number((max[0] - min[0]).toFixed(3)),
        Number((max[1] - min[1]).toFixed(3)),
        Number((max[2] - min[2]).toFixed(3))
      ]
    },
    extensionsUsed: gltf.extensionsUsed || [],
    extensionsRequired: gltf.extensionsRequired || []
  };
}

console.log('='.repeat(78));
console.log('               GLTF ASSET PREPARATION & AUDIT REPORT               ');
console.log('='.repeat(78));

const targets = [
  'app/public/models/city.glb',
  'app/public/models/city.opt.glb',
  'app/public/models/characters.glb',
  'app/public/models/characters.opt.glb'
];

targets.forEach(t => {
  const data = analyzeGlb(t);
  if (data.error) {
    console.log(`\n[-] ${t}: ${data.error}`);
    return;
  }
  console.log(`\n[*] Asset: ${data.path}`);
  console.log(`    File Size:       ${data.sizeStr} (${data.size.toLocaleString()} bytes)`);
  console.log(`    Total Triangles: ${data.triangles.toLocaleString()}`);
  console.log(`    Meshes (${data.meshes.length}):        ${data.meshes.map(m => `${m.name} (${m.tris} tris)`).join(', ')}`);
  console.log(`    Total Nodes:     ${data.nodeCount}`);
  if (data.metarigRoots.length > 0) {
    console.log(`    Metarig Roots (${data.metarigRoots.length}): ${data.metarigRoots.join(', ')}`);
  }
  console.log(`    Bounding Box:    Min: [${data.bbox.min.join(', ')}]`);
  console.log(`                     Max: [${data.bbox.max.join(', ')}]`);
  console.log(`                     Dimensions (W x H x D): [${data.bbox.size.join(' x ')}]`);
  if (data.extensionsUsed.length > 0) {
    console.log(`    Extensions:      ${data.extensionsUsed.join(', ')}`);
  }
});

console.log('\n' + '='.repeat(78));
