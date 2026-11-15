const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_debug_inspect';

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

  pageWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
    }
    if (data.id && pagePending.has(data.id)) {
      const { resolve } = pagePending.get(data.id);
      pagePending.delete(data.id);
      resolve(data.result);
    }
  };

  await new Promise(r => setTimeout(r, 6000));
  const evalRes = await pageSend('Runtime.evaluate', {
    expression: `
      (() => {
        if (!window.__pedRuntimes) return 'No runtimes';
        return window.__pedRuntimes.map(p => ({
          id: p.id,
          state: p.state,
          lane: p.lane.id,
          side: p.lane.side,
          dir: p.dir,
          x: p.x.toFixed(2),
          z: p.z.toFixed(2),
          cooldown: p.greetCooldown.toFixed(1)
        }));
      })()
    `,
    returnByValue: true
  });
  console.log('Pedestrians at 2s:', evalRes.result?.value);

  pageWs.close();
  ws.close();
  chromeProc.kill();
}

run().catch(console.error);
