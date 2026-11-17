const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';

async function main() {
  console.log('Launching headless Chrome on port 9254...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9254',
    '--window-size=1600,1000',
    '--user-data-dir=C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_cdp_profile_tour_verify',
    'http://localhost:5173/?noloading&p=0.28'
  ]);

  let endpoint = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const list = await new Promise((resolve, reject) => {
        http.get('http://localhost:9254/json/list', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      const pageTarget = list.find(t => t.type === 'page' && t.url.includes('5173'));
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        endpoint = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!endpoint) {
    throw new Error('Could not find active page target');
  }

  console.log('Connecting to page WebSocket endpoint...');
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
    const d = JSON.parse(event.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      const text = (d.params.args || []).map(a => a.value || JSON.stringify(a)).join(' ');
      console.log(`[Page Console ${d.params.type}]`, text);
    }
    if (d.method === 'Runtime.exceptionThrown') {
      console.error('[Page Exception]', d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text);
    }
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const pageSend = send;

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');

  async function evaluate(fnStr) {
    const res = await pageSend('Runtime.evaluate', {
      expression: fnStr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result ? res.result.value : null;
  }

  async function takeScreenshot(filename) {
    const res = await pageSend('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  console.log('Waiting for page and 3D assets to load at Stop 1 (p = 0.28)...');
  await new Promise(r => setTimeout(r, 4000));

  console.log('Waiting for host avatar model to finish loading...');
  for (let i = 0; i < 35; i++) {
    const ready = await evaluate(`!!(window.__HOST_DEBUG__ && window.__HOST_DEBUG__.hasAvatar)`);
    if (ready) {
      console.log('Host avatar loaded and ready!');
      break;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // ── Step 1: Verify Host at Stop 1 with ground ring & name tag ─────────────
  console.log('\n--- 1. Testing Host Visibility (Ground Ring & Name Tag at Wide Shot) ---');
  const hostInfo = await evaluate(`
    (() => {
      const debug = window.__HOST_DEBUG__;
      const cam = window.__DEBUG_CAMERA__;
      return {
        hasAvatar: debug ? debug.hasAvatar : false,
        hostPos: debug ? debug.currentPos : null,
        camPos: cam ? [cam.position.x, cam.position.y, cam.position.z] : null,
        state: debug ? debug.state : null
      };
    })()
  `);
  console.log('Host debug status:', JSON.stringify(hostInfo, null, 2));

  // Frame wide shot: follow camera distance ~7m away so name tag is crisp and ground ring is clear
  console.log('Setting wide framing to capture host, ground ring, and name tag...');
  await evaluate(`
    (() => {
      const hPos = window.__HOST_POS__ || [-42.07, 0.16, -10.0];
      // Place camera ~6.9m away in street corridor (Z = -4.8)
      window.__CAM_OVERRIDE__ = {
        pos: [hPos.x - 4.5, 1.85, -4.8],
        look: [hPos.x + 0.5, 1.35, -10.0]
      };
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  await takeScreenshot('screenshot_host_ring_tag.png');

  // Clear camera override so dynamic camera runs normally
  await evaluate(`delete window.__CAM_OVERRIDE__;`);

  // ── Step 2: Test Skip Animation Toggle in TourBar & LocalStorage ──────────
  console.log('\n--- 2. Testing TourBar Skip Animation Toggle & LocalStorage ---');
  const toggleRes1 = await evaluate(`
    (() => {
      const store = window.useAppStore.getState();
      const initialSkip = store.skipAnimation;
      store.toggleSkipAnimation();
      const afterSkip = window.useAppStore.getState().skipAnimation;
      const stored = localStorage.getItem('portfolioSkipAnimation');
      return { initialSkip, afterSkip, stored };
    })()
  `);
  console.log('Toggle Skip result:', toggleRes1);

  // Toggle back to false for testing walk and Space/Esc cancel
  await evaluate(`window.useAppStore.getState().setSkipAnimation(false);`);

  // ── Step 3: Test Keyboard Cancel Walk (Space / Esc) ────────────────────────
  console.log('\n--- 3. Testing Space / Esc walk cancellation ---');
  // Scroll to trigger walking toward stop 2 (p = 0.44)
  await evaluate(`
    (() => {
      const track = document.getElementById('scroll-track');
      const maxScroll = track ? track.offsetHeight - window.innerHeight : 1000;
      window.scrollTo(0, 0.44 * maxScroll);
      window.useAppStore.getState().setScrollProgress(0.44);
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const walkingStatus = await evaluate(`
    (() => {
      const d = window.__HOST_DEBUG__;
      return { state: d ? d.state : null, pos: d ? d.currentPos : null };
    })()
  `);
  console.log('Walking status before keypress:', walkingStatus);

  // Dispatch Space keydown
  await evaluate(`
    (() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const afterKeyStatus = await evaluate(`
    (() => {
      const d = window.__HOST_DEBUG__;
      return { state: d ? d.state : null, pos: d ? d.currentPos : null };
    })()
  `);
  console.log('Status after Space keypress (should be WAVING or STANDING at stop):', afterKeyStatus);

  // ── Step 4: Test Direct Nav Jump (About, Skills, Projects, Resume, Contact) ─
  console.log('\n--- 4. Testing Direct Nav Item Jump & Immediate Panel Opening ---');
  // Click Nav button "2. Skills" (building index 1)
  await evaluate(`
    (() => {
      // Direct jump via focusBuilding(1)
      window.useAppStore.getState().focusBuilding(1);
    })()
  `);
  // Capture during quick ease transition and immediate panel open (~250ms in)
  await new Promise(r => setTimeout(r, 280));

  const jumpState = await evaluate(`
    (() => {
      const s = window.useAppStore.getState();
      const h = window.__HOST_DEBUG__;
      const cam = window.__DEBUG_CAMERA__;
      const drawer = document.querySelector('[role="dialog"]');
      return {
        focusedBuildingIndex: s.focusedBuildingIndex,
        isDrawerOpen: !!drawer,
        hostPos: h ? h.currentPos : null,
        hostState: h ? h.state : null,
        camPos: cam ? [cam.position.x.toFixed(2), cam.position.y.toFixed(2), cam.position.z.toFixed(2)] : null
      };
    })()
  `);
  console.log('Nav Jump State (in progress):', JSON.stringify(jumpState, null, 2));

  await takeScreenshot('screenshot_tour_nav_jump.png');

  // Let camera settle and verify final framing
  await new Promise(r => setTimeout(r, 600));

  const finalState = await evaluate(`
    (() => {
      const cam = window.__DEBUG_CAMERA__;
      return {
        camPos: cam ? [cam.position.x.toFixed(2), cam.position.y.toFixed(2), cam.position.z.toFixed(2)] : null
      };
    })()
  `);
  console.log('Final camera position after ease:', finalState);

  console.log('\n--- All Usability Tests Complete! ---');

  // Clean up
  try {
    chromeProc.kill();
  } catch {}
  process.exit(0);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
