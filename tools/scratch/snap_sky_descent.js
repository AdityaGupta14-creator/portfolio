const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_sky_hero';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('=== Capturing Sky Hero & Descent Verification Screenshots ===');

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9238',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9238/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9238');
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

  console.log('Navigating to http://localhost:5173/?noloading ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading'
  });
  const pageWs = new WebSocket(`ws://localhost:9238/devtools/page/${targetId}`);
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

  console.log('Waiting for scene, clouds, and sky to initialize...');
  await new Promise(r => setTimeout(r, 4500));

  async function captureShot(fileName) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, fileName);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  // 1. Hero at the Start (p = 0.0)
  console.log('\n[1/3] Capturing Hero at Start (p = 0.0)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.scrollTo(0, 0);
      window.useAppStore && window.useAppStore.getState().setScrollProgress(0.0);
    `
  });
  await new Promise(r => setTimeout(r, 1600));
  await captureShot('screenshot_hero_start.png');

  // 2. Mid-Descent in the Clouds (p = 0.11)
  console.log('\n[2/3] Capturing Mid-Descent in Clouds (p = 0.11)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      const track = document.getElementById('scroll-track');
      if (track) {
        const maxScroll = track.offsetHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * 0.11);
      }
      window.useAppStore && window.useAppStore.getState().setScrollProgress(0.11);
    `
  });
  await new Promise(r => setTimeout(r, 1800));
  await captureShot('screenshot_hero_mid_descent.png');

  // 3. Arrival at the Street (p = 0.28 - Building 101 Stop)
  console.log('\n[3/3] Capturing Arrival at Street (p = 0.28)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      const track = document.getElementById('scroll-track');
      if (track) {
        const maxScroll = track.offsetHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * 0.28);
      }
      window.useAppStore && window.useAppStore.getState().setScrollProgress(0.28);
    `
  });
  // Wait until camera reaches street height (Y <= 1.85)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    const posRes = await pageSend('Runtime.evaluate', {
      expression: `(() => {
        const cam = window.__DEBUG_CAMERA__;
        return cam ? cam.position.y : null;
      })()`,
      returnByValue: true
    });
    if (posRes.result.value && posRes.result.value <= 1.85) {
      console.log(`Camera arrived at street eye-level: Y=${posRes.result.value.toFixed(2)}m`);
      break;
    }
  }
  await new Promise(r => setTimeout(r, 800));
  await captureShot('screenshot_hero_arrival_street.png');

  console.log('\n=== All 3 Verification Screenshots Captured Successfully! ===');
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error capturing sky hero screenshots:', err);
  process.exit(1);
});
