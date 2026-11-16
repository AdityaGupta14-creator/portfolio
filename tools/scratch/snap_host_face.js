const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Aditya\\AppData\\Local\\Temp\\chrome_snap_host_face_temp4';
const artifactDir = 'C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\a306fb42-30e4-4a57-ab52-6c07de2a4521';
const frontPath = path.join(artifactDir, 'screenshot_host_face_front.png');
const sidePath = path.join(artifactDir, 'screenshot_host_face_side.png');

async function main() {
  console.log('Launching headless Chrome with CDP...');
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
    console.error('Failed to connect to CDP endpoint');
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

  console.log('Navigating to Stop 101: http://localhost:5173/?noloading=1&p=0.28 ...');
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
  };

  await sendPage('Page.enable');
  await sendPage('Runtime.enable');
  await sendPage('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Waiting for host avatar to load completely...');
  let hostInfo = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await sendPage('Runtime.evaluate', {
      expression: 'window.__HOST_DEBUG__',
      returnByValue: true
    });
    const info = res.result?.value;
    if (info && info.hasAvatar && info.headWorldPos) {
      hostInfo = info;
      console.log(`Avatar loaded successfully after ${i + 1}s!`);
      break;
    }
  }

  // Settle frame animations
  await new Promise(r => setTimeout(r, 2000));

  // Hide 2D HUD UI cards
  await sendPage('Runtime.evaluate', {
    expression: `
      const banner = document.querySelector('.fixed.bottom-8');
      if (banner) banner.style.display = 'none';
      const header = document.querySelector('header');
      if (header) header.style.display = 'none';
    `
  });

  // Query live head position
  const latestRes = await sendPage('Runtime.evaluate', {
    expression: 'window.__HOST_DEBUG__',
    returnByValue: true
  });
  const liveInfo = latestRes.result?.value || hostInfo;
  const headPos = liveInfo.headWorldPos;
  const hostYaw = liveInfo.currentYaw;
  console.log('Live Head position:', headPos, 'Host yaw:', hostYaw);

  // Close-up framing distance
  const dist = 0.52; // ~52cm from face for crisp detailed shot of eyes & face
  const forwardX = Math.sin(hostYaw);
  const forwardZ = Math.cos(hostYaw);

  // Since Mixamo model faces in opposite Z direction (-forward), the front of face is at -forward
  // Front camera: directly in front of avatar's face
  const frontCamPos = [
    headPos[0] - forwardX * dist,
    headPos[1] + 0.01,
    headPos[2] - forwardZ * dist
  ];

  console.log('Positioning front camera in front of face:', frontCamPos, '->', headPos);
  await sendPage('Runtime.evaluate', {
    expression: `
      window.__CAM_OVERRIDE__ = {
        pos: [${frontCamPos[0]}, ${frontCamPos[1]}, ${frontCamPos[2]}],
        look: [${headPos[0]}, ${headPos[1]}, ${headPos[2]}]
      };
    `
  });

  await new Promise(r => setTimeout(r, 1500));
  const frontShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(frontPath, Buffer.from(frontShot.data, 'base64'));
  console.log('Saved front close-up to:', frontPath, 'Size:', fs.statSync(frontPath).size);

  // Side camera: ~40 degree side-profile view
  const sideAngle = hostYaw + Math.PI + 0.70; // ~40 degrees from front of face
  const sideCamPos = [
    headPos[0] + Math.sin(sideAngle) * dist,
    headPos[1] + 0.01,
    headPos[2] + Math.cos(sideAngle) * dist
  ];

  console.log('Positioning side camera:', sideCamPos, '->', headPos);
  await sendPage('Runtime.evaluate', {
    expression: `
      window.__CAM_OVERRIDE__ = {
        pos: [${sideCamPos[0]}, ${sideCamPos[1]}, ${sideCamPos[2]}],
        look: [${headPos[0]}, ${headPos[1]}, ${headPos[2]}]
      };
    `
  });

  await new Promise(r => setTimeout(r, 1500));
  const sideShot = await sendPage('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(sidePath, Buffer.from(sideShot.data, 'base64'));
  console.log('Saved side close-up to:', sidePath, 'Size:', fs.statSync(sidePath).size);

  pageWs.close();
  ws.close();
  chromeProc.kill();
  console.log('Done!');
}

main().catch(console.error);
