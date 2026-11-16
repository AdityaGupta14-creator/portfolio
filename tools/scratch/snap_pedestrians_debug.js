const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_ped_debug';
const outPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_pedestrian_debug_all_green.png';

async function main() {
  console.log('Launching headless Chrome with CDP for pedestrian debug verification...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9226',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9226/json/version', res => {
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
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  console.log('Opening street view with pedestrian debug (?noloading=1&view=crosswalk&debugpeds=1)...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading=1&view=crosswalk&debugpeds=1'
  });
  const pageWs = new WebSocket(`ws://localhost:9226/devtools/page/${targetId}`);
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
  await pageSend('Console.enable');

  pageWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Console.messageAdded') {
      console.log('[Browser Console]', data.params.message.text);
    }
    if (data.id && pagePending.has(data.id)) {
      const { resolve, reject } = pagePending.get(data.id);
      pagePending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  // Wait for pedestrian FBX loading and simulation to run
  console.log('Waiting for pedestrian FBX loading and simulation...');
  let overlayData = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    const evalResult = await pageSend('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__pedOverlayData || [])',
      returnByValue: true
    });
    overlayData = JSON.parse(evalResult.result.value || '[]');
    if (overlayData.length > 0) {
      console.log(`Found ${overlayData.length} pedestrians active at attempt ${attempt + 1}!`);
      break;
    }
  }

  // Let them walk 3 more seconds to verify steady-state
  console.log('Letting pedestrians walk for 3.0s...');
  await new Promise(r => setTimeout(r, 3000));

  const finalEval = await pageSend('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__pedOverlayData || [])',
    returnByValue: true
  });
  overlayData = JSON.parse(finalEval.result.value || '[]');

  console.log('=== PEDESTRIAN TELEMETRY TABLE ===');
  console.table(overlayData);

  console.log('Capturing screenshot to', outPath);
  const screenshot = await pageSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Screenshot saved successfully!');

  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Error in script:', err);
  process.exit(1);
});
