const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_snap6_fresh';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('=== Capturing 6 Verification Screenshots (Morning, Evening, Night) ===');

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9260',
    `--user-data-dir=${profileDir}`,
    '--window-size=1600,1000',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9260/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9260');
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
  const pageWs = new WebSocket(`ws://localhost:9260/devtools/page/${targetId}`);
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

  console.log('Waiting for scene, GLB clouds, and sky to initialize...');
  await new Promise(r => setTimeout(r, 4500));

  async function captureShot(fileName) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, fileName);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  // 1. Morning Hero
  console.log('\n[1/6] Morning Hero (p = 0.0)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.useAppStore && window.useAppStore.getState().setSkyMode('morning');
      window.scrollTo(0, 0);
      window.useAppStore && window.useAppStore.getState().setScrollProgress(0.0);
    `
  });
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_hero_morning.png');

  // 2. Morning Street
  console.log('\n[2/6] Morning Street (p = 0.28)...');
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
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_street_morning.png');

  // 3. Evening Street
  console.log('\n[3/6] Evening Street (p = 0.28)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.useAppStore && window.useAppStore.getState().setSkyMode('evening');
    `
  });
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_street_evening.png');

  // 4. Evening Hero
  console.log('\n[4/6] Evening Hero (p = 0.0)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.scrollTo(0, 0);
      window.useAppStore && window.useAppStore.getState().setScrollProgress(0.0);
    `
  });
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_hero_evening.png');

  // 5. Night Hero
  console.log('\n[5/6] Night Hero (p = 0.0)...');
  await pageSend('Runtime.evaluate', {
    expression: `
      window.useAppStore && window.useAppStore.getState().setSkyMode('night');
    `
  });
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_hero_night.png');

  // 6. Night Street
  console.log('\n[6/6] Night Street (p = 0.28)...');
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
  await new Promise(r => setTimeout(r, 2200));
  await captureShot('screenshot_street_night.png');

  console.log('\nAll 6 screenshots successfully captured!');
  chromeProc.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('Snapshot script failed:', e);
  process.exit(1);
});
