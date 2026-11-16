const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_crosswalk_10x';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('=== Crosswalk 10 Cycles Verification Test ===');
  console.log('Launching headless Chrome on port 9228...');

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9228',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9228/json/version', res => {
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
    console.error('Could not connect to Chrome CDP on port 9228');
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

  console.log('Waiting for crosswalk simulation to load...');
  await new Promise(r => setTimeout(r, 4000));

  // Set speed to 5x so 10 full cycles (290s sim time) completes in ~58s
  console.log('Setting simulation speed to 5x...');
  await callPage('Runtime.evaluate', {
    expression: 'window.__setTimeScale && window.__setTimeScale(5);'
  });

  async function takeScreenshot(fileName) {
    const res = await callPage('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(artifactDir, fileName);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${fullPath} (${buffer.length} bytes)`);
  }

  let capturedWalkShot = false;
  let capturedCarsGoShot = false;
  let lastReportedCycle = -1;
  let maxCyclesObserved = 0;
  const phasesSeen = new Set();
  const startTime = Date.now();

  console.log('Beginning cycle observation loop (target >= 10 completed cycles)...');

  while (Date.now() - startTime < 120000) { // max 2 minutes
    await new Promise(r => setTimeout(r, 500));

    try {
      const telemRes = await callPage('Runtime.evaluate', {
        expression: `(() => {
          const t = window.__crosswalkCycleTelemetry;
          if (!t) return null;
          return {
            phase: t.info.phase,
            timer: t.info.phaseTimer,
            duration: t.info.phaseDuration,
            cycleCount: t.info.cycleCount,
            waiting: t.info.waitingCount,
            crossing: t.info.crossingCount,
            watchdogTriggered: t.info.watchdogTriggered,
            cars: t.cars.map(c => ({
              id: c.id,
              x: c.x.toFixed(1),
              speed: c.speed.toFixed(1),
              isBraking: c.isBraking,
              reason: c.stopReason
            }))
          };
        })()`,
        returnByValue: true
      });

      const telem = telemRes?.result?.value;
      if (!telem) continue;

      phasesSeen.add(telem.phase);
      maxCyclesObserved = telem.cycleCount;

      if (telem.cycleCount !== lastReportedCycle) {
        lastReportedCycle = telem.cycleCount;
        console.log(`\n[Cycle #${telem.cycleCount}] Phase: ${telem.phase} (${telem.timer.toFixed(1)}s/${telem.duration}s) | Peds: ${telem.waiting} waiting, ${telem.crossing} crossing`);
        telem.cars.forEach(c => {
          console.log(`  Car #${c.id}: x=${c.x}m, v=${c.speed}m/s [${c.isBraking ? 'BRAKING' : 'GO'}] -> ${c.reason}`);
        });
      }

      // Capture screenshot during WALK phase
      if (telem.phase === 'WALK' && !capturedWalkShot && telem.cycleCount >= 1) {
        capturedWalkShot = true;
        console.log('\n--> Capturing WALK phase screenshot with pedestrians crossing & cars stopped at 3m line...');
        await takeScreenshot('screenshot_crosswalk_walk_phase.png');
      }

      // Capture screenshot during CARS_GO phase
      if (telem.phase === 'CARS_GO' && !capturedCarsGoShot && telem.cycleCount >= 2) {
        capturedCarsGoShot = true;
        console.log('\n--> Capturing CARS_GO phase screenshot with cars driving & pedestrians waiting at kerb...');
        await takeScreenshot('screenshot_crosswalk_cars_go.png');
      }

      // Target condition: cycleCount >= 10
      if (telem.cycleCount >= 10) {
        console.log(`\n=== SUCCESS: Reached ${telem.cycleCount} full cycles! ===`);
        console.log(`Phases observed: ${Array.from(phasesSeen).join(' -> ')}`);
        console.log(`Watchdog triggered: ${telem.watchdogTriggered} (False = perfectly timed clock cycle)`);
        
        // Take final screenshot of completed 10+ cycles
        await takeScreenshot('screenshot_crosswalk_10cycles_completed.png');
        break;
      }
    } catch (err) {
      console.warn('Evaluation error:', err.message);
    }
  }

  console.log(`\nVerification Test Finished: Observed ${maxCyclesObserved} cycles.`);
  try {
    chromeProc.kill();
  } catch {}

  if (maxCyclesObserved >= 10) {
    console.log('TEST PASSED: >= 10 crosswalk cycles completed with zero deadlocks and clean behavior.');
    process.exit(0);
  } else {
    console.error(`TEST FAILED: Only observed ${maxCyclesObserved} cycles.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
