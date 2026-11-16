const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_ped_3min';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('Starting 3-minute Pedestrian System Verification via Headless Chrome CDP...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9225',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9225/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9225');
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

  console.log('Navigating to http://localhost:5173/ ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/'
  });

  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true
  });

  const sessionPending = new Map();
  ws.addEventListener('message', (event) => {
    const raw = JSON.parse(event.data);
    if (raw.method === 'Target.receivedMessageFromTarget' && raw.params?.sessionId === sessionId) {
      const inner = JSON.parse(raw.params.message);
      if (inner.id && sessionPending.has(inner.id)) {
        const { resolve, reject } = sessionPending.get(inner.id);
        sessionPending.delete(inner.id);
        if (inner.error) reject(inner.error);
        else resolve(inner.result);
      }
    }
  });

  function callPage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      sessionPending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({
        id: id++,
        method: 'Target.sendMessageToTarget',
        params: {
          sessionId,
          message: JSON.stringify({ id: msgId, method, params })
        }
      }));
    });
  }

  await callPage('Page.enable');
  await callPage('Runtime.enable');

  console.log('Waiting 5s for street scene, 8 pedestrians, and 10 cars to mount...');
  await new Promise(r => setTimeout(r, 5000));

  // Press 'p' to enable the pedestrian debug overlay
  console.log('Activating Pedestrian Debug Overlay (key: P)...');
  await callPage('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP' });
  await callPage('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP' });

  await new Promise(r => setTimeout(r, 2000));

  console.log('--- BEGIN 3-MINUTE VERIFICATION (180 SECONDS) ---');
  const startTime = Date.now();
  const DURATION_MS = 180 * 1000;
  let maxRedCount = 0;
  let minPedCount = 8;
  let tickCount = 0;
  let samplesWithRed = 0;

  while (Date.now() - startTime < DURATION_MS) {
    await new Promise(r => setTimeout(r, 1000));
    tickCount++;

    const res = await callPage('Runtime.evaluate', {
      expression: `(() => {
        const data = window.__pedOverlayData;
        const redCount = window.__redPedestrianCount ?? 0;
        return {
          pedCount: data ? data.length : 0,
          redCount,
          items: data ? data.map(d => ({
            id: d.id,
            speed: d.speed,
            wp: d.routeIndex,
            act: d.actionName,
            run: d.isRunning,
            w: d.weight,
            ts: d.timeScale,
            red: d.isRed,
            reason: d.redReason
          })) : []
        };
      })()`,
      returnByValue: true
    });

    const val = res.result?.value;
    if (val) {
      if (val.pedCount < minPedCount) minPedCount = val.pedCount;
      if (val.redCount > maxRedCount) maxRedCount = val.redCount;
      if (val.redCount > 0) samplesWithRed++;

      // Log progress every 15 seconds
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      if (elapsedSec % 15 === 0 || val.redCount > 0) {
        console.log(`[T+${elapsedSec}s] Active Peds: ${val.pedCount}/8 | RED Counter: ${val.redCount}`);
        if (val.items && val.items.length > 0) {
          const sample = val.items.map(p => `#${p.id}: ${p.speed} [${p.act}]`).join(', ');
          console.log(`   Sample: ${sample}`);
        }
        if (val.redCount > 0) {
          console.warn(`   WARNING RED DETECTED:`, val.items.filter(p => p.red));
        }
      }

      // Capture screenshot at 10s, 90s, and 175s
      if (elapsedSec === 10 || elapsedSec === 90 || elapsedSec === 175) {
        const shot = await callPage('Page.captureScreenshot', { format: 'png' });
        const filename = elapsedSec === 175
          ? 'screenshot_pedestrian_system_overlay.png'
          : `screenshot_pedestrians_${elapsedSec}s.png`;
        fs.writeFileSync(path.join(artifactDir, filename), Buffer.from(shot.data, 'base64'));
        console.log(`   Captured screenshot: ${filename}`);
      }
    }
  }

  console.log('--- 3-MINUTE VERIFICATION COMPLETE ---');
  console.log(`Total Elapsed: ${(Date.now() - startTime) / 1000}s`);
  console.log(`Total Samples Checked: ${tickCount}`);
  console.log(`Min Pedestrian Count (must be 8): ${minPedCount}`);
  console.log(`Max RED Pedestrians Count (must be 0): ${maxRedCount}`);
  console.log(`Samples with RED > 0 (must be 0): ${samplesWithRed}`);

  chromeProc.kill();

  if (maxRedCount === 0 && minPedCount === 8) {
    console.log('VERIFICATION PASSED: RED counter stayed 0 for full 3 minutes and all 8 pedestrians looped continuously without disappearing!');
    process.exit(0);
  } else {
    console.error(`VERIFICATION FAILED: maxRedCount=${maxRedCount}, minPedCount=${minPedCount}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
