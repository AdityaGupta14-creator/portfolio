const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_night_street';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('=== Capturing Night Street (p = 0.28) ===');

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9262',
    `--user-data-dir=${profileDir}`,
    '--window-size=1600,1000',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9262/json/version', res => {
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

  // Navigate directly with query params ?mode=night&p=0.28&noloading
  console.log('Navigating with mode=night&p=0.28 ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?mode=night&p=0.28&noloading'
  });
  const pageWs = new WebSocket(`ws://localhost:9262/devtools/page/${targetId}`);
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

  console.log('Waiting 5s for night scene to settle...');
  await new Promise(r => setTimeout(r, 5000));

  const res = await pageSend('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  const outPath = path.join(artifactDir, 'screenshot_street_night.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved screenshot: screenshot_street_night.png (${buffer.length} bytes)`);

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
