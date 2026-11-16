const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_glasses';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('=== Capturing Host Character Glasses Verification Screenshots ===');

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9232',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9232/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9232');
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

  console.log('Navigating to http://localhost:5173/debug/anim?tab=mixamo ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/debug/anim?tab=mixamo'
  });
  const pageWs = new WebSocket(`ws://localhost:9232/devtools/page/${targetId}`);
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

  console.log('Waiting for avatar and sunglasses to mount...');
  await new Promise(r => setTimeout(r, 4500));

  async function captureShot(fileName) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, fileName);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  // 1. Front Close-up (T-pose / standing)
  console.log('\n[1/5] Setting Camera Preset: FRONT close-up...');
  await pageSend('Runtime.evaluate', {
    expression: 'window.__setCameraPreset && window.__setCameraPreset("front"); window.__setCurrentAnim && window.__setCurrentAnim("stop");'
  });
  await new Promise(r => setTimeout(r, 1200));
  await captureShot('screenshot_glasses_host_front.png');

  // 2. Side Profile (Temple / ear fit)
  console.log('\n[2/5] Setting Camera Preset: SIDE profile...');
  await pageSend('Runtime.evaluate', {
    expression: 'window.__setCameraPreset && window.__setCameraPreset("side");'
  });
  await new Promise(r => setTimeout(r, 1200));
  await captureShot('screenshot_glasses_host_side.png');

  // 3. 3/4 Perspective View
  console.log('\n[3/5] Setting Camera Preset: 3/4 VIEW...');
  await pageSend('Runtime.evaluate', {
    expression: 'window.__setCameraPreset && window.__setCameraPreset("threeQuarter");'
  });
  await new Promise(r => setTimeout(r, 1200));
  await captureShot('screenshot_glasses_host_three_quarter.png');

  // 4. Mid-Walk Animation
  console.log('\n[4/5] Playing Walk Animation (Mid-Stride)...');
  await pageSend('Runtime.evaluate', {
    expression: 'window.__setCurrentAnim && window.__setCurrentAnim("walk");'
  });
  await new Promise(r => setTimeout(r, 800)); // allow stride in motion
  await captureShot('screenshot_glasses_host_mid_walk.png');

  // 5. Mid-Wave Animation
  console.log('\n[5/5] Playing Wave Animation (Mid-Wave)...');
  await pageSend('Runtime.evaluate', {
    expression: 'window.__setCurrentAnim && window.__setCurrentAnim("wave");'
  });
  await new Promise(r => setTimeout(r, 1500)); // wait for arm raised waving
  await captureShot('screenshot_glasses_host_mid_wave.png');

  console.log('\n=== All 5 Verification Screenshots Captured Successfully! ===');
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error capturing glasses screenshots:', err);
  process.exit(1);
});
