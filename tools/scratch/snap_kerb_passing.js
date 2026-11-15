const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_kerb_poll';
const outPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_person_waiting_car_passing.png';

async function run() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
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

  console.log('Opening page...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading=1&view=crosswalk&debugpeds=1'
  });
  const pageWs = new WebSocket(`ws://localhost:9222/devtools/page/${targetId}`);
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
      const { resolve } = pagePending.get(data.id);
      pagePending.delete(data.id);
      resolve(data.result);
    }
  };

  await pageSend('Page.enable');
  await pageSend('Runtime.enable');

  let snapped = false;
  for (let tick = 0; tick < 70; tick++) {
    await new Promise(r => setTimeout(r, 200));
    const evalRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__pedRuntimes) return null;
          const p2 = window.__pedRuntimes.find(p => p.id === 2);
          const cars = window.__crosswalkManager ? window.__crosswalkManager.getCars() : [];
          let closest = null;
          let minD = 999;
          for (const c of cars) {
            const d = Math.abs(c.x - 13.0);
            if (d < minD) {
              minD = d;
              closest = c;
            }
          }
          return {
            p2: p2 ? { state: p2.state, x: p2.x.toFixed(2), z: p2.z.toFixed(2), gap: p2.gapCheckInfo } : null,
            closeCar: closest ? { id: closest.id, x: closest.x.toFixed(1), z: closest.z, dir: closest.dir, dist: minD.toFixed(1) } : null
          };
        })()
      `,
      returnByValue: true
    });

    const info = evalRes.result?.value;
    if (info) {
      console.log(`[tick ${(tick * 0.2).toFixed(1)}s] P2:`, info.p2?.state, 'Car:', info.closeCar);
      if (info.p2?.state === 'wait' && info.closeCar && parseFloat(info.closeCar.dist) < 5.0) {
        console.log('>>> PERFECT MATCH! Capturing screenshot...');
        const shot = await pageSend('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved screenshot to ${outPath}`);
        snapped = true;
        break;
      }
    }
  }

  if (!snapped) {
    console.log('Fallback capture...');
    const shot = await pageSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  }

  pageWs.close();
  ws.close();
  chromeProc.kill();
  console.log('Finished!');
}

run().catch(console.error);
