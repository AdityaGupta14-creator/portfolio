const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_measure';

async function main() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9230',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9230/json/version', res => {
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
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/debug/anim?tab=mixamo'
  });
  const pageWs = new WebSocket(`ws://localhost:9230/devtools/page/${targetId}`);
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
    const data = JSON.parse(event.data);
    if (data.id && pagePending.has(data.id)) {
      const { resolve, reject } = pagePending.get(data.id);
      pagePending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');
  console.log('Waiting for avatar to load...');
  await new Promise(r => setTimeout(r, 4500));

  const script = `
    (() => {
      const avatar = window.__DEBUG_AVATAR__;
      if (!avatar) return { error: 'No __DEBUG_AVATAR__' };

      avatar.updateMatrixWorld(true);
      const headBone = avatar.getObjectByName('mixamorigHead');
      const headEnd = avatar.getObjectByName('mixamorigHeadTop_End');
      const lash = avatar.getObjectByName('Ch23_Eyelashes');
      const body = avatar.getObjectByName('Ch23_Body');

      const boneWorldScale = new THREE.Vector3();
      headBone.getWorldScale(boneWorldScale);

      const headWorldPos = new THREE.Vector3();
      headBone.getWorldPosition(headWorldPos);

      const lashBox = lash ? new THREE.Box3().setFromObject(lash) : null;
      const lashCenter = lashBox ? lashBox.getCenter(new THREE.Vector3()) : null;
      const lashSize = lashBox ? lashBox.getSize(new THREE.Vector3()) : null;

      // In head bone local space:
      const headInv = headBone.matrixWorld.clone().invert();
      const lashCenterInHead = lashCenter ? lashCenter.clone().applyMatrix4(headInv) : null;

      // Head top in head bone space:
      const headEndInHead = headEnd ? new THREE.Vector3().setFromMatrixPosition(headEnd.matrixWorld).applyMatrix4(headInv) : null;

      return {
        boneWorldScale: boneWorldScale.toArray(),
        headWorldPos: headWorldPos.toArray(),
        lashCenterWorld: lashCenter ? lashCenter.toArray() : null,
        lashSizeWorld: lashSize ? lashSize.toArray() : null,
        lashCenterInHeadBone: lashCenterInHead ? lashCenterInHead.toArray() : null,
        headEndInHeadBone: headEndInHead ? headEndInHead.toArray() : null,
      };
    })()
  `;

  const res = await pageSend('Runtime.evaluate', { expression: script, returnByValue: true });
  console.log('=== Measured Head Metrics ===');
  console.log(JSON.stringify(res, null, 2));

  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
