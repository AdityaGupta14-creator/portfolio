const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9254',
    '--window-size=1600,1000',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_inspect_sky_live',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9254/json/version', res => {
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
  const pageWs = new WebSocket(`ws://localhost:9254/devtools/page/${targetId}`);
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
  await new Promise(r => setTimeout(r, 4000));

  const res = await pageSend('Runtime.evaluate', {
    expression: `
      (() => {
        // Find R3F scene from canvas
        const canvas = document.querySelector('canvas');
        const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
        let root = canvas[fiberKey];
        while (root && !root.memoizedProps?.store) {
          root = root.return || root.child;
        }
        // Alternatively, find scene via __r3f or traversal
        const r3fState = canvas.__r3f;
        const scene = r3fState ? r3fState.root.getState().scene : null;
        
        const clouds = [];
        let moonGroup = null;
        let stars = null;
        let fogInfo = null;

        if (scene) {
          scene.traverse(obj => {
            if (obj.isInstancedMesh) {
              clouds.push({
                name: obj.name,
                count: obj.count,
                visible: obj.visible,
                geomVerts: obj.geometry.attributes.position?.count,
                matColor: '#' + obj.material.color?.getHexString(),
                matOpacity: obj.material.opacity,
                matEmissive: '#' + obj.material.emissive?.getHexString(),
                matEmissiveIntensity: obj.material.emissiveIntensity,
                hasMap: Boolean(obj.material.map),
                frustumCulled: obj.frustumCulled
              });
            }
            if (obj.name === 'MoonGroupFromGLB') {
              moonGroup = {
                visible: obj.visible,
                children: obj.children.length,
                scale: obj.scale.toArray(),
                pos: obj.position.toArray()
              };
            }
            if (obj.isPoints) {
              stars = {
                visible: obj.visible,
                count: obj.geometry.attributes.position?.count,
                uStarsOpacity: obj.material.uniforms?.uStarsOpacity?.value
              };
            }
          });
          if (scene.fog) {
            fogInfo = {
              color: '#' + scene.fog.color.getHexString(),
              near: scene.fog.near,
              far: scene.fog.far
            };
          }
        }

        return {
          hasScene: Boolean(scene),
          cloudsCount: clouds.length,
          clouds,
          moonGroup,
          stars,
          fogInfo
        };
      })()
    `,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));

  chromeProc.kill();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
