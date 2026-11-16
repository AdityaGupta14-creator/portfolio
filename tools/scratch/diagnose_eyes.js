const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_eyes_diag';

async function main() {
  console.log('Launching headless Chrome for eye diagnosis...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9227',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9227/json/version', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      endpoint = data.webSocketDebuggerUrl;
      if (endpoint) break;
    } catch {}
  }

  if (!endpoint) {
    console.error('Could not connect to Chrome CDP');
    chromeProc.kill();
    process.exit(1);
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

  console.log('Navigating to http://localhost:5173/debug/anim?tab=mixamo...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/debug/anim?tab=mixamo'
  });
  const pageWs = new WebSocket(`ws://localhost:9227/devtools/page/${targetId}`);
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

  console.log('Waiting for FBX loading and diagnostics...');
  let eyeDiags = null;
  let allMeshes = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await pageSend('Runtime.evaluate', {
      expression: 'JSON.stringify({ eyeDiags: window.__eyeDiags || [], allMeshes: window.__allMeshes || [], headMetrics: window.__headMetrics })',
      returnByValue: true
    });
    const parsed = JSON.parse(res.result.value || '{}');
    if (parsed.allMeshes && parsed.allMeshes.length > 0) {
      eyeDiags = parsed.eyeDiags;
      allMeshes = parsed.allMeshes;
      console.log('=== HEAD & EYE METRICS ===');
      console.log(parsed.headMetrics);
      break;
    }
  }

  console.log('=== ALL MESHES IN AVATAR ===');
  console.table(allMeshes);

  console.log('=== EYE DIAGNOSTICS ===');
  console.table(eyeDiags);

  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
