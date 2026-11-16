const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_test_scroll';

async function main() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9241',
    `--user-data-dir=${profileDir}`,
    '--window-size=1920,1080',
    'about:blank'
  ]);

  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:9241/json/version', res => {
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
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5173/?noloading'
  });
  const pageWs = new WebSocket(`ws://localhost:9241/devtools/page/${targetId}`);
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
  await new Promise(r => setTimeout(r, 4000));

  const check1 = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const track = document.getElementById('scroll-track');
      const maxScroll = track ? track.offsetHeight - window.innerHeight : -1;
      return {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        trackHeight: track ? track.offsetHeight : null,
        maxScroll,
        scrollProgress: window.useAppStore ? window.useAppStore.getState().scrollProgress : null,
        camY: window.__DEBUG_CAMERA__ ? window.__DEBUG_CAMERA__.position.y : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Initial state:', check1.result.value);

  // Now set scroll to 0.28
  await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const track = document.getElementById('scroll-track');
      const maxScroll = track.offsetHeight - window.innerHeight;
      window.scrollTo(0, maxScroll * 0.28);
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  const check2 = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      return {
        scrollY: window.scrollY,
        scrollProgress: window.useAppStore ? window.useAppStore.getState().scrollProgress : null,
        camPos: window.__DEBUG_CAMERA__ ? window.__DEBUG_CAMERA__.position.toArray() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('After scrollTo(0.28):', check2.result.value);

  chromeProc.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
