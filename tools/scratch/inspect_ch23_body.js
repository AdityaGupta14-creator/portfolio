const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_inspect_body';

async function main() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9228',
    `--user-data-dir=${profileDir}`,
    'http://localhost:5173/debug/anim?tab=mixamo'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9228/json/version', res => {
          let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b)));
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
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const targets = await new Promise((resolve) => {
    http.get('http://localhost:9228/json/list', res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b)));
    });
  });
  const pageTarget = targets.find(t => t.url.includes('5173'));
  const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pagePending = new Map();
  function sendPage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = pageId++;
      pagePending.set(msgId, { resolve, reject });
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  pageWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pagePending.has(data.id)) {
      const { resolve } = pagePending.get(data.id);
      pagePending.delete(data.id);
      resolve(data.result);
    }
  };

  await sendPage('Runtime.enable');
  await new Promise(r => setTimeout(r, 6000));

  const res = await sendPage('Runtime.evaluate', {
    expression: `
      (() => {
        const bodyMesh = window.__DEBUG_AVATAR__ ? window.__DEBUG_AVATAR__.getObjectByName('Ch23_Body') : null;
        let info = null;
        if (bodyMesh) {
          info = {
            name: bodyMesh.name,
            isMesh: bodyMesh.isMesh,
            isSkinnedMesh: bodyMesh.isSkinnedMesh,
            materialIsArray: Array.isArray(bodyMesh.material),
            materialType: bodyMesh.material?.constructor?.name,
            geometryGroups: bodyMesh.geometry?.groups,
            morphTargets: bodyMesh.morphTargetDictionary,
            vertexCount: bodyMesh.geometry?.attributes?.position?.count,
            visible: bodyMesh.visible,
          };
        }
        return {
          hasAvatar: !!window.__DEBUG_AVATAR__,
          bodyMesh: info
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Ch23_Body Info:', JSON.stringify(res.result?.value, null, 2));

  pageWs.close();
  ws.close();
  chromeProc.kill();
}

main().catch(console.error);
