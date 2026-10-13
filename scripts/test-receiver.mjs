// Tiny local lead receiver for testing the "Send it" flow:
//   node scripts/test-receiver.mjs        (then set LEAD_ENDPOINT: 'http://localhost:9000' in config.js)
import { createServer } from 'node:http';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; req.on('data', (d) => (body += d));
  req.on('end', () => {
    try { const p = JSON.parse(body); console.log('\n— lead —\n', p.contact.name, p.contact.email, '|', p.trip.route, '|', p.trip.days + 'd', '~$' + p.trip.estTotalUsd, '| ref:', p.ref || '-', '| from:', p.fromHostel || '-'); }
    catch (e) { console.log('bad payload', e.message); res.writeHead(400, cors); return res.end('bad'); }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  });
}).listen(9000, () => console.log('lead receiver on http://localhost:9000'));
