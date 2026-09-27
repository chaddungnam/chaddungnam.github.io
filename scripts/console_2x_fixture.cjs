// Local synthetic data only. Run from anywhere: node scripts/console_2x_fixture.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const auth = `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true}),snapshot:()=>({signedIn:true,unlocked:true}),isUnlocked:()=>true,requireChallenge:()=>{},logout:()=>{},headers:()=>({})};`;
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (url === '/_qa/360') url = '/tests/fixtures/console_2x_mobile.html';
  const before = url.startsWith('/before/');
  if (before) url = url.slice(7);
  if (url.endsWith('/')) url += 'index.html';
  let body;
  const type = path.extname(url);
  if (url === '/console/auth.js') body = auth;
  else if (url === '/console/api.js') body = fs.readFileSync(path.join(root, 'tests/fixtures/console_2x_api.js'));
  else {
    const file = path.resolve(root, before && url.startsWith('/console/') ? '.tmp/console-before' : '', url.slice(1));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { body = fs.readFileSync(file); }
    catch { res.writeHead(404).end(); return; }
  }
  if (type === '.html') body = String(body).replace(/<script src="https:\/\/accounts.google.com[^<]+<\/script>/g, '');
  res.writeHead(200, {
    'Content-Type': ({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[type] || 'application/octet-stream',
    'Cache-Control':'no-store',
  });
  res.end(body);
}).listen(8765, '127.0.0.1', () => console.log('Synthetic console: http://127.0.0.1:8765/console/ · 360px: /_qa/360'));
