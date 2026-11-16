const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9253',
    '--window-size=1600,1000',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_sky_verify',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9253/json/version', res => {
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
  const pageWs = new WebSocket(`ws://localhost:9253/devtools/page/${targetId}`);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pagePending = new Map();
  const consoleMessages = [];

  function pageSend(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = pageId++;
      pagePending.set(msgId, { resolve, reject });
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  pageWs.onmessage = (event) => {
    const d = JSON.parse(event.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      const text = (d.params.args || []).map(a => a.value || JSON.stringify(a)).join(' ');
      consoleMessages.push(`[${d.params.type}] ${text}`);
    }
    if (d.id && pagePending.has(d.id)) {
      const { resolve, reject } = pagePending.get(d.id);
      pagePending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');

  console.log('Waiting for page and 3D assets to load...');
  await new Promise(r => setTimeout(r, 4500));

  async function takeScreenshot(filename) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  async function evaluate(fnStr) {
    const res = await pageSend('Runtime.evaluate', {
      expression: fnStr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result ? res.result.value : null;
  }

  // Scroll helper
  await evaluate(`
    window.__setScroll = (p) => {
      const track = document.getElementById('scroll-track');
      const maxScroll = track ? track.offsetHeight - window.innerHeight : document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, p * maxScroll);
      window.dispatchEvent(new Event('scroll'));
      if (window.useAppStore) {
        window.useAppStore.getState().setScrollProgress(p);
      }
    };
  `);

  // ── 1. Morning Mode: Hero View (p = 0.0) ──────────────────────────────────
  console.log('\n--- 1. Testing Morning Mode ---');
  await evaluate(`
    if (window.useAppStore) {
      window.useAppStore.getState().setSkyMode('morning');
    }
    window.__setScroll(0.0);
  `);
  await new Promise(r => setTimeout(r, 2200)); // Wait for 1.5s transition tween
  await takeScreenshot('screenshot_hero_morning.png');

  // Morning Street (p = 0.28)
  console.log('Navigating to Street in Morning (p = 0.28)...');
  await evaluate(`
    window.__setScroll(0.28);
  `);
  await new Promise(r => setTimeout(r, 2200));
  await takeScreenshot('screenshot_street_morning.png');

  // ── 2. Evening Mode ───────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Evening Mode ---');
  await evaluate(`
    if (window.useAppStore) {
      window.useAppStore.getState().setSkyMode('evening');
    }
  `);
  await new Promise(r => setTimeout(r, 2200)); // Wait for 1.5s transition tween
  await takeScreenshot('screenshot_street_evening.png');

  console.log('Navigating to Hero in Evening (p = 0.0)...');
  await evaluate(`
    window.__setScroll(0.0);
  `);
  await new Promise(r => setTimeout(r, 2200));
  await takeScreenshot('screenshot_hero_evening.png');

  // ── 3. Night Mode ─────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Night Mode ---');
  await evaluate(`
    if (window.useAppStore) {
      window.useAppStore.getState().setSkyMode('night');
    }
  `);
  await new Promise(r => setTimeout(r, 2200)); // Wait for 1.5s transition tween
  await takeScreenshot('screenshot_hero_night.png');

  console.log('Navigating to Street in Night (p = 0.28)...');
  await evaluate(`
    window.__setScroll(0.28);
  `);
  await new Promise(r => setTimeout(r, 2200));
  await takeScreenshot('screenshot_street_night.png');

  // Check night lighting and moon status
  const nightStatus = await evaluate(`
    (() => {
      const store = window.useAppStore?.getState();
      return {
        skyMode: store?.skyMode,
        isGoldenEvening: store?.isGoldenEvening,
        scrollProgress: store?.scrollProgress
      };
    })()
  `);
  console.log('\nFinal Store Status:', nightStatus);

  console.log('\n--- Console Logs from Page ---');
  consoleMessages.slice(-25).forEach(m => console.log(m));

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('Test script failed:', e);
  process.exit(1);
});
