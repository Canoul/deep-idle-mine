#!/usr/bin/env node
/* Petit serveur local sans dépendance : les modules JS ne se chargent pas en ouvrant le fichier par double-clic.
   Usage : npm start   (ou node scripts/serve.js [port])   puis ouvrir http://localhost:8000 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.PORT || 8000);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8' };

http.createServer((req,res)=>{
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url==='/' ? 'index.html' : url);
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  fs.readFile(file, (err,data)=>{
    if(err){ res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  });
}).listen(PORT, ()=>console.log(`Deep Idle Mine : http://localhost:${PORT}  (Ctrl+C pour arrêter)`));
