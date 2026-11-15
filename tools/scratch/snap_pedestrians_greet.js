const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_greet';
const outPath = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521\\screenshot_pedestrians_greeting.png';

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

  if (!endpoint) {
    console.error('Failed to get CDP endpoint');
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

  console.log('Opening page with greet view...');
  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading=1&view=greet&debugpeds=1&greet=1'
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
  console.log('Polling simulation for GREET state...');
  for (let tick = 0; tick < 80; tick++) {
    await new Promise(r => setTimeout(r, 150));
    const evalRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__pedRuntimes) return null;
          const p5 = window.__pedRuntimes.find(p => p.id === 5);
          const p7 = window.__pedRuntimes.find(p => p.id === 7);
          const dist57 = p5 && p7 ? Math.hypot(p5.x - p7.x, p5.z - p7.z).toFixed(2) : 'N/A';
          const greetingPeds = window.__pedRuntimes.filter(p => p.state === 'greet');
          return {
            greetingCount: greetingPeds.length,
            greetingPeds: greetingPeds.map(p => ({
              id: p.id,
              partner: p.greetPartnerId,
              isWaving: p.isWaving,
              timer: p.greetTimer.toFixed(1),
              x: p.x.toFixed(2),
              z: p.z.toFixed(2)
            })),
            p5State: p5 ? p5.state + ' (x=' + p5.x.toFixed(1) + ')' : null,
            p7State: p7 ? p7.state + ' (x=' + p7.x.toFixed(1) + ')' : null,
            dist57
          };
        })()
      `,
      returnByValue: true
    });

    const info = evalRes.result?.value;
    if (info) {
      console.log(`[tick ${(tick * 0.15).toFixed(2)}s] Greetings: ${info.greetingCount} | P5: ${info.p5State} | P7: ${info.p7State} | dist: ${info.dist57}`);
      if (info.greetingCount >= 2) {
        console.log('>>> FOUND GREETING PAIR! Capturing screenshot...');
        const shot = await pageSend('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved screenshot to ${outPath}`);
        snapped = true;
        break;
      }
    }
  }

  if (!snapped) {
    console.log('Fallback capture at end of loop...');
    const shot = await pageSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${outPath}`);
  }

  pageWs.close();
  ws.close();
  chromeProc.kill();
  console.log('Finished!');
}

run().catch(console.error);
