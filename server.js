import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkMcpHealth,
  getSkillsPayload,
  runBreakoutScan,
  runMarketReport,
} from './lib/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3847;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/api/health' && req.method === 'GET') {
    try {
      const result = await checkMcpHealth();
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 503, { ok: false, error: e.message });
    }
    return;
  }

  if (req.url === '/api/skills' && req.method === 'GET') {
    sendJson(res, 200, getSkillsPayload());
    return;
  }

  if (req.url === '/api/market-report' && req.method === 'POST') {
    try {
      const result = await runMarketReport();
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (req.url === '/api/breakout-scan' && req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || '{}') : {};
      const result = await runBreakoutScan(body.parameters || body);
      const status = result.error ? 207 : 200;
      sendJson(res, status, result);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  const publicDir = path.join(__dirname, 'public');
  if (req.url === '/' || req.url === '/index.html') {
    serveStatic(res, path.join(publicDir, 'index.html'), 'text/html; charset=utf-8');
    return;
  }
  if (req.url === '/style.css') {
    serveStatic(res, path.join(publicDir, 'style.css'), 'text/css');
    return;
  }
  if (req.url === '/app.js') {
    serveStatic(res, path.join(publicDir, 'app.js'), 'application/javascript');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`CMC Trader Dashboard → http://localhost:${PORT}`);
});