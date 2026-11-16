const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_crosswalk';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('Launching headless Chrome with CDP for /debug/crosswalk...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9224',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9224/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9224');
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

  console.log('Navigating to http://localhost:5173/debug/crosswalk ...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/debug/crosswalk'
  });

  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true
  });

  function sendSession(method, params = {}) {
    return send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id: id++, method, params })
    });
  }

  // Handle messages from the page target
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

  // Wait for 3D canvas and initial state to mount
  console.log('Waiting for crosswalk simulation to initialize...');
  await new Promise(r => setTimeout(r, 3500));

  // Capture sequence telemetry over 14 seconds
  const statesObserved = new Set();
  const startTime = Date.now();

  let capturedCrossingShot = false;
  let capturedStoppingShot = false;

  console.log('Tracking crosswalk state machine sequence...');
  while (Date.now() - startTime < 16000) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await callPage('Runtime.evaluate', {
        expression: `(() => {
          const t = window.__crosswalkDebugTelemetry;
          if (!t) return null;
          return {
            state: t.info.state,
            stateTimer: t.info.stateTimer,
            holdTime: t.info.holdTime,
            waiting: t.info.waitingCount,
            crossing: t.info.crossingCount,
            waitReason: t.info.waitReason,
            peds: t.peds.map(p => ({ id: p.id, z: p.z.toFixed(2), state: p.state, speed: p.speed.toFixed(2) })),
            cars: t.cars.map(c => ({ id: c.id, x: c.x.toFixed(2), speed: c.speed.toFixed(2), isBraking: c.isBraking }))
          };
        })()`,
        returnByValue: true
      });

      const telem = res.result?.value;
      if (telem) {
        if (!statesObserved.has(telem.state)) {
          statesObserved.add(telem.state);
          console.log(`[STATE OBSERVED] => ${telem.state} (timer: ${telem.stateTimer.toFixed(1)}s, waiting: ${telem.waiting}, crossing: ${telem.crossing})`);
          console.log(`  Peds:`, JSON.stringify(telem.peds));
          console.log(`  Cars:`, JSON.stringify(telem.cars));
        }

        // Snapshot during CARS_STOPPING
        if (telem.state === 'CARS_STOPPING' && !capturedStoppingShot) {
          capturedStoppingShot = true;
          console.log('Capturing snapshot: CARS_STOPPING...');
          const shot = await callPage('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'screenshot_crosswalk_cars_stopping.png'), Buffer.from(shot.data, 'base64'));
        }

        // Snapshot during PEDS_CROSSING
        if (telem.state === 'PEDS_CROSSING' && !capturedCrossingShot && telem.crossing > 0) {
          capturedCrossingShot = true;
          console.log('Capturing snapshot: PEDS_CROSSING...');
          const shot = await callPage('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'screenshot_crosswalk_peds_crossing.png'), Buffer.from(shot.data, 'base64'));
        }
      }
    } catch (err) {
      console.warn('Evaluation tick error:', err);
    }
  }

  // Final Overview Screenshot of Debug Page
  console.log('Capturing overall /debug/crosswalk page screenshot...');
  const pageShot = await callPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'screenshot_crosswalk_debug_page.png'), Buffer.from(pageShot.data, 'base64'));

  console.log('States observed during sequence:', Array.from(statesObserved).join(' -> '));

  // Now inspect the main app http://localhost:5173/ and press Key P to verify the in-game debug overlay
  console.log('\nNavigating to main application http://localhost:5173/ to check Key P overlay...');
  const { targetId: mainTargetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/'
  });

  const { sessionId: mainSessionId } = await send('Target.attachToTarget', {
    targetId: mainTargetId,
    flatten: true
  });

  function callMainPage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      sessionPending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({
        id: id++,
        method: 'Target.sendMessageToTarget',
        params: {
          sessionId: mainSessionId,
          message: JSON.stringify({ id: msgId, method, params })
        }
      }));
    });
  }

  await callMainPage('Page.enable');
  await callMainPage('Runtime.enable');

  console.log('Waiting for street scene to load on main page...');
  await new Promise(r => setTimeout(r, 4500));

  // Press 'p' to enable pedestrian debug overlay
  console.log('Dispatching keydown "p" for pedestrian debug overlay...');
  await callMainPage('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP' });
  await callMainPage('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP' });

  // Move camera slightly forward or check crosswalk data
  await new Promise(r => setTimeout(r, 2000));

  const overlayTelem = await callMainPage('Runtime.evaluate', {
    expression: `(() => {
      return {
        controllers: window.__crosswalkDebugData,
        peds: window.__pedOverlayData?.slice(0, 4)
      };
    })()`,
    returnByValue: true
  });

  console.log('Main Page Overlay Telemetry:');
  console.log(JSON.stringify(overlayTelem.result?.value, null, 2));

  console.log('Capturing main page screenshot with Key P overlay active...');
  const mainShot = await callMainPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'screenshot_crosswalk_overlay_key_p.png'), Buffer.from(mainShot.data, 'base64'));

  chromeProc.kill();
  console.log('All tests & snapshots completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
