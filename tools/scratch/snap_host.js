const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_host_fresh';
const outPath101 = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_mixamo_host_101.png';
const outPathHub = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_mixamo_host_hub.png';

async function run() {
  console.log('Launching Chrome with CDP on port 9222...');
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
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  // 1. Capture Stop 101
  console.log('Opening Stop 101: http://localhost:5173/?noloading=1&p=0.28 ...');
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
    if (data.method === 'Runtime.consoleAPICalled') {
      const args = data.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      console.log('[BROWSER CONSOLE]', args);
    }
  };

  await sendPage('Page.enable');
  await sendPage('Runtime.enable');
  await sendPage('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Waiting 8s for assets to load at Stop 101...');
  await new Promise(r => setTimeout(r, 8000));

  const debug101 = await sendPage('Runtime.evaluate', {
    expression: 'window.__HOST_DEBUG__',
    returnByValue: true
  });
  console.log('Host debug at 101:', debug101.result.value);

  const shot1 = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath101, Buffer.from(shot1.data, 'base64'));
  console.log('Saved Stop 101 screenshot to:', outPath101, 'Size:', fs.statSync(outPath101).size);

  // 2. Open Hub in new tab (so cache is warm and assets load instantly)
  console.log('Opening Hub: http://localhost:5173/?noloading=1&p=1.0 ...');
  const { targetId: hubTargetId } = await send('Target.createTarget', { url: 'http://localhost:5173/?noloading=1&p=1.0' });
  const hubWs = new WebSocket(`ws://localhost:9222/devtools/page/${hubTargetId}`);
  await new Promise(r => hubWs.onopen = r);

  let hubPageId = 1;
  const hubPending = new Map();
  function sendHub(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = hubPageId++;
      hubPending.set(msgId, { resolve, reject });
      hubWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  hubWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && hubPending.has(data.id)) {
      const { resolve } = hubPending.get(data.id);
      hubPending.delete(data.id);
      resolve(data.result);
    }
  };

  await sendHub('Page.enable');
  await sendHub('Runtime.enable');
  await sendHub('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Waiting 8s for Hub to load and host to position...');
  await new Promise(r => setTimeout(r, 8000));

  const debugHub = await sendHub('Runtime.evaluate', {
    expression: 'window.__HOST_DEBUG__',
    returnByValue: true
  });
  console.log('Host debug at Hub:', debugHub.result.value);

  const shot2 = await sendHub('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPathHub, Buffer.from(shot2.data, 'base64'));
  console.log('Saved Hub screenshot to:', outPathHub, 'Size:', fs.statSync(outPathHub).size);

  pageWs.close();
  hubWs.close();
  ws.close();
  chromeProc.kill();
  console.log('All done!');
}

run().catch(console.error);
