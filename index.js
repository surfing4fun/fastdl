const express       = require('express');
const http          = require('http');
const fs            = require('fs-extra');
const path          = require('path');
const { promisify } = require('util');
const exec          = promisify(require('child_process').exec);
const { Server }    = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT         = process.env.PORT || 3003;
const SERVERS_ROOT = path.resolve(__dirname, '..');  // ../surf & ../bhop
const FASTDL_ROOT  = __dirname;                      // output root
const SERVERS      = ['bhop', 'surf'];
const ASSETS       = ['materials', 'sound'];

console.log(`→  FastDL starting up on port ${PORT}`);

// serve compressed FastDL assets at /bhop and /surf
app.use('/bhop', express.static(path.join(FASTDL_ROOT, 'bhop')));
app.use('/surf', express.static(path.join(FASTDL_ROOT, 'surf')));

// throttle: only allow one update per minute
let lastUpdateTs = 0;

async function copyAndCompress(srcDir, dstDir, socket) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const dstPath = path.join(dstDir, e.name);

    if (e.isDirectory()) {
      await fs.ensureDir(dstPath);
      await copyAndCompress(srcPath, dstPath, socket);
      continue;
    }
    // skip map files
    if (path.extname(e.name).toLowerCase() === '.bsp') {
      socket.emit('progress', `Skipping map file: ${e.name}`);
      continue;
    }
    await fs.copy(srcPath, dstPath);
    socket.emit('progress', `Copied: ${path.relative(FASTDL_ROOT, dstPath)}`);
    try {
      await exec(`bzip2 -f "${dstPath}"`);
      socket.emit('progress', `Compressed: ${path.relative(FASTDL_ROOT, dstPath)}.bz2`);
    } catch (err) {
      socket.emit('error', `Compression failed for ${e.name}: ${err.message}`);
      throw err;
    }
  }
}

async function updateFastDL(socket) {
  socket.emit('progress', 'FastDL update started');

  for (const srv of SERVERS) {
    socket.emit('progress', `--- Starting ${srv} ---`);

    const srcBase = path.join(SERVERS_ROOT, srv, 'cstrike');
    const dstBase = path.join(FASTDL_ROOT, srv);

    for (const asset of ASSETS) {
      const srcAsset = path.join(srcBase, asset);
      const dstAsset = path.join(dstBase, asset);

      // remove old asset folder but keep srv folder itself intact
      await fs.remove(dstAsset);
      await fs.ensureDir(dstAsset);

      if (!await fs.pathExists(srcAsset)) {
        socket.emit('progress', `No ${srv}/cstrike/${asset}, skipping`);
        continue;
      }

      socket.emit('progress', `Processing ${srv}/${asset}`);
      await copyAndCompress(srcAsset, dstAsset, socket);
    }

    socket.emit('progress', `Finished ${srv}`);
  }

  socket.emit('done', 'All FastDL updates complete');
}

io.on('connection', socket => {
  console.log('Client connected');
  socket.on('startUpdate', () => {
    const now = Date.now();
    if (now - lastUpdateTs < 60_000) {
      const wait = Math.ceil((60_000 - (now - lastUpdateTs)) / 1000);
      socket.emit('error', `Please wait ${wait}s before running again.`);
      return;
    }
    lastUpdateTs = now;
    updateFastDL(socket).catch(err => {
      console.error(err);
      socket.emit('error', err.message);
    });
  });
});

app.get('/update', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FastDL Update</title>
  <style>
    html, body {
      height: 100%; margin: 0; overflow: hidden;
      font-family: sans-serif; background: #1f2235; color: #e0e0e0;
      display: flex; flex-direction: column;
    }
    header {
      flex: 0 0 auto;
      background: linear-gradient(90deg, #5a3fda, #8b59fb);
      padding: 1rem 2rem; color: #fff; font-size: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    main {
      flex: 1 1 auto; padding: 1rem; overflow: hidden;
    }
    .card {
      background: #2a2d47; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: flex; flex-direction: column; height: 100%; padding: 1rem;
    }
    .card h2 {
      margin-bottom: 0.75rem; font-size: 1.25rem; color: #fff;
    }
    #status {
      flex: 1 1 auto; background: #1e1f33; border-radius: 4px;
      padding: 0.75rem; font-family: "Courier New", monospace;
      font-size: 0.9rem; line-height: 1.4; overflow-y: auto;
    }
    #status::-webkit-scrollbar {
      width: 8px;
    }
    #status::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1); border-radius: 4px;
    }
    .msg-copied     { color: #a6e22e; }
    .msg-compressed { color: #66d9ef; }
    .msg-skipped    { color: #fd971f; }
    .msg-error      { color: #f92672; font-weight: bold; }
    .msg-done       { color: #ae81ff; font-weight: bold; }
    .msg-progress   { color: #e0e0e0; }
  </style>
</head>
<body>
  <header>FastDL Updater</header>
  <main>
    <div class="card">
      <h2>Status</h2>
      <div id="status"><p class="msg-progress">Connecting…</p></div>
    </div>
  </main>

  <script src="/fastdl/socket.io/socket.io.js"></script>
  <script>
    const statusDiv = document.getElementById('status');
    const socket    = io({ path: '/fastdl/socket.io' });

    socket.on('connect', () => {
      statusDiv.innerHTML = '';
      socket.emit('startUpdate');
    });

    socket.on('progress', msg => {
      const p = document.createElement('p'); p.textContent = msg;
      if (msg.startsWith('Copied:'))      p.classList.add('msg-copied');
      else if (msg.startsWith('Compressed:')) p.classList.add('msg-compressed');
      else if (msg.startsWith('Skipping'))    p.classList.add('msg-skipped');
      else                                     p.classList.add('msg-progress');
      statusDiv.appendChild(p);
      statusDiv.scrollTop = statusDiv.scrollHeight;
    });

    socket.on('done', msg => {
      const p = document.createElement('p'); p.textContent = msg;
      p.classList.add('msg-done'); statusDiv.appendChild(p);
      statusDiv.scrollTop = statusDiv.scrollHeight;
    });

    socket.on('error', err => {
      const p = document.createElement('p'); p.textContent = 'Error: ' + err;
      p.classList.add('msg-error'); statusDiv.appendChild(p);
      statusDiv.scrollTop = statusDiv.scrollHeight;
    });

    socket.on('connect_error', err => {
      statusDiv.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'Connection failed: ' + err.message;
      p.classList.add('msg-error'); statusDiv.appendChild(p);
    });
  </script>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`FastDL updater listening on port ${PORT}, status page at /update`);
});
