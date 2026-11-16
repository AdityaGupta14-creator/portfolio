const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9252',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_inspect_sky2',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9252/json/version', res => {
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
  const pageWs = new WebSocket(`ws://localhost:9252/devtools/page/${targetId}`);
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
  await new Promise(r => setTimeout(r, 2000));

  const script = `
    new Promise((resolve, reject) => {
      import('/node_modules/.vite/deps/three_examples_jsm_loaders_GLTFLoader__js.js').then(mod => {
        new mod.GLTFLoader().load('/models/cartoon_night_sky.glb', gltf => {
          const list = [];
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse(c => {
            const pos = c.position.toArray();
            const scale = c.scale.toArray();
            const rot = [c.rotation.x, c.rotation.y, c.rotation.z];
            list.push({ name: c.name, type: c.type, pos, scale, rot });
          });
          resolve(list);
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
