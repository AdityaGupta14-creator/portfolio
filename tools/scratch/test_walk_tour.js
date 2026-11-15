const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_walk_tour_test';
const outPath101 = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_mixamo_host_101.png';
const outPathWalk = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_mixamo_host_walking.png';
const outPathHub = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_mixamo_host_hub.png';

async function run() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
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

  console.log('Opening at Stop 101...');
  const { targetId } = await send('Target.createTarget', { url: 'http://localhost:5173/?noloading=1&p=0.28' });
  const pageWs = new WebSocket(`ws://localhost:9222/devtools/page/${targetId}`);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pagePending = new Map();
  function sendPage(method, params = {}) {
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

  await sendPage('Page.enable');
  await sendPage('Runtime.enable');
  await sendPage('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  // 1. Wait for assets to load at Stop 101
  console.log('Waiting 11s for initial load...');
  await new Promise(r => setTimeout(r, 11000));

  const shot1 = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath101, Buffer.from(shot1.data, 'base64'));
  console.log('Captured Stop 101 screenshot:', fs.statSync(outPath101).size, 'bytes');

  // 2. Trigger walk towards Building 103
  console.log('Navigating towards Building 103...');
  await sendPage('Runtime.evaluate', {
    expression: `(() => {
      window.history.pushState({}, '', '/?noloading=1&p=0.44');
      window.scrollTo({ top: window.innerHeight * 2.8, behavior: 'smooth' });
    })()`
  });

  await new Promise(r => setTimeout(r, 2000));
  const shotWalk = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPathWalk, Buffer.from(shotWalk.data, 'base64'));
  console.log('Captured Walking screenshot:', fs.statSync(outPathWalk).size, 'bytes');

  // 3. Jump to Hub & wait for camera easing to complete
  console.log('Jumping to Hub & waiting for camera easing...');
  await sendPage('Runtime.evaluate', {
    expression: `(() => {
      window.history.pushState({}, '', '/?noloading=1&p=1.0');
      const track = document.getElementById('scroll-track');
      const maxScroll = track ? track.offsetHeight - window.innerHeight : 7000;
      window.scrollTo({ top: maxScroll, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll'));
    })()`
  });

  await new Promise(r => setTimeout(r, 6500));
  const debugHub = await sendPage('Runtime.evaluate', {
    expression: 'window.__HOST_DEBUG__',
    returnByValue: true
  });
  console.log('Hub debug info:', debugHub.result.value);

  const shotHub = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPathHub, Buffer.from(shotHub.data, 'base64'));
  console.log('Captured Hub screenshot:', fs.statSync(outPathHub).size, 'bytes');

  pageWs.close();
  ws.close();
  chromeProc.kill();
  console.log('All tests passed!');
}

run().catch(console.error);
