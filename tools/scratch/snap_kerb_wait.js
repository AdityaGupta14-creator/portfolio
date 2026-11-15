const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_kerb';
const outPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_pedestrian_waiting_kerb.png';

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

  // Stop 3 / Building 105 is at p = 0.58.
  // Camera looks directly across the street and crosswalk at X = 13.0!
  console.log('Navigating to Crosswalk 2 view: http://localhost:5173/?noloading=1&p=0.58&debugpeds=1 ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading=1&p=0.58&debugpeds=1'
  });
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
  };

  await pageSend('Page.enable');
  await pageSend('Runtime.enable');

  // Wait 7.5s for initial assets and pedestrian to reach kerb
  console.log('Waiting 7.5s for simulation frames...');
  await new Promise(r => setTimeout(r, 7500));

  // Capture screenshot of person waiting at the kerb with car passing
  const shot = await pageSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  console.log(`Saved screenshot to ${outPath}`);

  // Also capture street perspective from Hub at p=1.0 to see full avenue crosswalk view
  const hubOutPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_crosswalk_hub_perspective.png';
  console.log('Navigating to Hub: p=1.0 ...');
  await pageSend('Page.navigate', { url: 'http://localhost:5173/?noloading=1&p=1.0&debugpeds=1' });
  await new Promise(r => setTimeout(r, 7000));

  const hubShot = await pageSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(hubOutPath, Buffer.from(hubShot.data, 'base64'));
  console.log(`Saved hub crosswalk perspective to ${hubOutPath}`);

  ws.close();
  pageWs.close();
  chromeProc.kill();
  console.log('Done!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
