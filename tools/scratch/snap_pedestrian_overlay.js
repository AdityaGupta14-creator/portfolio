const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_overlay';
const outPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_pedestrian_debug_overlay.png';
const outPathStreet = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_pedestrian_overlay_street.png';

async function run() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json/version', res => {
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
    console.error('Failed to get CDP endpoint');
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
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  console.log('Navigating to Hub with debug overlay: http://localhost:5173/?noloading=1&p=1.0&debugpeds=1 ...');
  const { targetId } = await send('Target.createTarget', { url: 'http://localhost:5173/?noloading=1&p=1.0&debugpeds=1' });
  const pageWs = new WebSocket(`ws://localhost:9222/devtools/page/${targetId}`);
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
      const { resolve } = pagePending.get(data.id);
      pagePending.delete(data.id);
      resolve(data.result);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value || a.description || '').join(' ');
      console.log(`[Console ${data.params.type}]: ${text}`);
    }
  };

  await pageSend('Page.enable');
  await pageSend('Runtime.enable');

  // Wait 7 seconds for assets & animation loops
  console.log('Waiting 7s for FBX avatars to load...');
  await new Promise(r => setTimeout(r, 7000));

  // Capture Hub View with Overlay
  const shotHub = await pageSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath, Buffer.from(shotHub.data, 'base64'));
  console.log(`Saved hub overlay screenshot to ${outPath}`);

  // Test 'P' key press toggle
  console.log('Testing "p" key press via Input.dispatchKeyEvent...');
  await pageSend('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', text: 'p' });
  await pageSend('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', text: 'p' });
  await new Promise(r => setTimeout(r, 800));

  // Toggle back on
  await pageSend('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', text: 'p' });
  await pageSend('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', text: 'p' });
  await new Promise(r => setTimeout(r, 800));

  // Navigate to street perspective with overlay: p=0.45
  console.log('Navigating to street level p=0.45...');
  await pageSend('Page.navigate', { url: 'http://localhost:5173/?noloading=1&p=0.45&debugpeds=1' });
  await new Promise(r => setTimeout(r, 4000));

  const shotStreet = await pageSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPathStreet, Buffer.from(shotStreet.data, 'base64'));
  console.log(`Saved street overlay screenshot to ${outPathStreet}`);

  ws.close();
  pageWs.close();
  chromeProc.kill();
  console.log('Done!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
