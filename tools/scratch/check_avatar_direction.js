const http = require('http');

async function main() {
  const data = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });

  const targets = await new Promise((resolve) => {
    http.get('http://localhost:9222/json/list', res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b)));
    });
  });
  console.log('Targets:', targets.map(t => t.url));
}

main().catch(console.error);
