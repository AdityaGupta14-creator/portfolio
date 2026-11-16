const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const data = await new Promise((resolve, reject) => {
    http.get('http://localhost:9232/json/version', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
  const endpoint = data.webSocketDebuggerUrl;
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
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://localhost:9232/json', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
  const pageTarget = targets.find(t => t.url.includes('/debug/anim'));
  if (!pageTarget) {
    console.error('No /debug/anim page found!');
    process.exit(1);
  }

  const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let pid = 1;
  const ppending = new Map();
  function pageSend(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = pid++;
      ppending.set(msgId, { resolve, reject });
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  pageWs.onmessage = (event) => {
    const d = JSON.parse(event.data);
    if (d.id && ppending.has(d.id)) {
      const { resolve, reject } = ppending.get(d.id);
      ppending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };
  await new Promise(r => pageWs.onopen = r);

  const evalRes = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const avatar = window.__DEBUG_AVATAR__;
      const head = avatar.getObjectByName('mixamorigHead');
      const anchor = head.getObjectByName('GlassesAnchor');
      const glasses = anchor.children[0];
      const childrenInfo = glasses.children.map(c => ({
        name: c.name,
        type: c.type,
        geomType: c.geometry ? c.geometry.type : null,
        pos: c.position.toArray(),
        scale: c.scale.toArray(),
        isMesh: c.isMesh,
        mat: c.material ? {
          color: '#' + c.material.color.getHexString(),
          opacity: c.material.opacity,
          transparent: c.material.transparent,
          depthWrite: c.material.depthWrite
        } : null
      }));
      return {
        anchorScale: anchor.scale.toArray(),
        glassesPos: glasses.position.toArray(),
        glassesRot: [glasses.rotation.x, glasses.rotation.y, glasses.rotation.z],
        glassesScale: glasses.scale.toArray(),
        children: childrenInfo
      };
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(evalRes.result.value, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
