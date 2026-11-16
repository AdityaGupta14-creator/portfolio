const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9251',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_inspect_sky',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9251/json/version', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      endpoint = data.webSocketDebuggerUrl;
      if (endpoint) break;
    } catch {}
  }

  const ws = new WebSocket(endpoint);
  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  ws.onmessage = (event) => {
    const d = JSON.parse(event.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading'
  });
  const pageWs = new WebSocket(`ws://localhost:9251/devtools/page/${targetId}`);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pagePending = new Map();
  function pageSend(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = pageId++;
      pagePending.set(msgId, { resolve, reject });
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  pageWs.onmessage = (event) => {
    const d = JSON.parse(event.data);
    if (d.id && pagePending.has(d.id)) {
      const { resolve, reject } = pagePending.get(d.id);
      pagePending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');
  await new Promise(r => setTimeout(r, 3500));

  const script = `
    new Promise((resolve, reject) => {
      import('/node_modules/.vite/deps/three_examples_jsm_loaders_GLTFLoader__js.js')
        .then(mod => {
          const GLTFLoader = mod.GLTFLoader;
          const loader = new GLTFLoader();
          loader.load('/models/cartoon_night_sky.glb', gltf => {
            const nodes = [];
            const meshes = [];
            const materials = new Set();
            gltf.scene.traverse(child => {
              nodes.push({ name: child.name, type: child.type });
              if (child.isMesh) {
                child.geometry.computeBoundingBox();
                const bb = child.geometry.boundingBox;
                const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
                const mat = child.material;
                materials.add(mat ? mat.name : 'none');
                meshes.push({
                  name: child.name,
                  geomVertices: child.geometry.attributes.position.count,
                  size,
                  pos: child.position.toArray(),
                  rot: [child.rotation.x, child.rotation.y, child.rotation.z],
                  scale: child.scale.toArray(),
                  matName: mat ? mat.name : null,
                  matColor: mat && mat.color ? '#' + mat.color.getHexString() : null,
                  matEmissive: mat && mat.emissive ? '#' + mat.emissive.getHexString() : null,
                  transparent: mat ? mat.transparent : null,
                  opacity: mat ? mat.opacity : null,
                  hasMap: Boolean(mat && mat.map)
                });
              }
            });
            resolve({
              nodesCount: nodes.length,
              nodes,
              meshes,
              materials: Array.from(materials)
            });
          }, undefined, reject);
        })
        .catch(reject);
    })
  `;
  const res = await pageSend('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(res.result.value, null, 2));

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
