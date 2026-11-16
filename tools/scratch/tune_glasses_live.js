const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_tuning';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9235',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9235/json/version', res => {
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
  const pageWs = new WebSocket(`ws://localhost:9235/devtools/page/${targetId}`);
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
  await new Promise(r => setTimeout(r, 4500));

  async function captureShot(fileName) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, fileName);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  // First test with CLEAR glasses style to see the frame vs lens geometry
  console.log('Testing CLEAR style with Z=0.135...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.__setCameraPreset("front");
      window.__setCurrentAnim("stop");
      window.__setGlassesConfig({ style: 'clear', position: [0.0, 0.097, 0.135], rotationX: 2.0 });
    `
  });
  await new Promise(r => setTimeout(r, 1000));
  await captureShot('test_clear_front.png');

  // Test side profile with Z=0.135, rotationX = 2.0
  await pageSend('Runtime.evaluate', {
    expression: `window.__setCameraPreset("side");`
  });
  await new Promise(r => setTimeout(r, 1000));
  await captureShot('test_clear_side.png');

  // Test SUNGLASSES with tuned position
  console.log('Testing SUNGLASSES style with Z=0.135, rotX=2.0...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.__setCameraPreset("front");
      window.__setGlassesConfig({ style: 'sunglasses', position: [0.0, 0.097, 0.135], rotationX: 2.0 });
    `
  });
  await new Promise(r => setTimeout(r, 1000));
  await captureShot('test_sunglasses_front.png');

  // Test SUNGLASSES side
  await pageSend('Runtime.evaluate', {
    expression: `window.__setCameraPreset("side");`
  });
  await new Promise(r => setTimeout(r, 1000));
  await captureShot('test_sunglasses_side.png');

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
