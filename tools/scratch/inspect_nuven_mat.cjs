const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9255',
    '--window-size=1600,1000',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_inspect_nuven',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9255/json/version', res => {
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
  const pageWs = new WebSocket(`ws://localhost:9255/devtools/page/${targetId}`);
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
  await new Promise(r => setTimeout(r, 3000));

  const script = `
    new Promise((resolve, reject) => {
      import('/node_modules/.vite/deps/three_examples_jsm_loaders_GLTFLoader__js.js').then(mod => {
        new mod.GLTFLoader().load('/models/cartoon_night_sky.glb', gltf => {
          let nuvenMesh = null;
          gltf.scene.traverse(c => {
            if (c.isMesh && c.material && c.material.name === 'nuven' && !nuvenMesh) {
              nuvenMesh = c;
            }
          });
          const mat = nuvenMesh.material;
          const geom = nuvenMesh.geometry;
          const pos = Array.from(geom.attributes.position.array);
          const norm = geom.attributes.normal ? Array.from(geom.attributes.normal.array) : null;
          const uv = geom.attributes.uv ? Array.from(geom.attributes.uv.array) : null;
          const index = geom.index ? Array.from(geom.index.array) : null;

          resolve({
            matType: mat.type,
            matColor: '#' + mat.color.getHexString(),
            matEmissive: '#' + mat.emissive.getHexString(),
            matRoughness: mat.roughness,
            matMetalness: mat.metalness,
            opacity: mat.opacity,
            transparent: mat.transparent,
            depthWrite: mat.depthWrite,
            side: mat.side,
            map: mat.map ? {
              w: mat.map.image ? mat.map.image.width : null,
              h: mat.map.image ? mat.map.image.height : null,
              flipY: mat.map.flipY,
              colorSpace: mat.map.colorSpace
            } : null,
            pos,
            norm,
            uv,
            index
          });
        }, undefined, reject);
      }).catch(reject);
    })
  `;

  const res = await pageSend('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(res.result.value, null, 2));

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
