/**
 * Electron main process for the desktop build.
 *
 * The game is a pure static client: it never calls the Express/Gemini server, so the desktop
 * build just serves the Vite output. Files are served over a custom app:// protocol rather
 * than file://, because Chromium treats file:// as an opaque origin and localStorage there is
 * unreliable — and every bit of player progress (meta DNA, unlocks, achievements, settings)
 * lives in localStorage.
 */

const { app, BrowserWindow, protocol, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Readable } = require('node:stream');

// Minimal MIME table. Only the types this build actually ships.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const APP_SCHEME = 'app';
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Marker written into userData after the first successful launch of an installed build.
// Its absence means "this machine has never run this game", which is what guarantees the
// player starts a genuinely new game even if a previous install left data behind.
const FIRST_RUN_MARKER = 'install-state.json';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true, // range requests, needed for streaming the soundtrack mp3s
      corsEnabled: true,
    },
  },
]);

function markerPath() {
  return path.join(app.getPath('userData'), FIRST_RUN_MARKER);
}

function isFirstRun() {
  try {
    return !fs.existsSync(markerPath());
  } catch (e) {
    return false;
  }
}

function writeMarker() {
  try {
    fs.writeFileSync(
      markerPath(),
      JSON.stringify({ installedAt: new Date().toISOString(), version: app.getVersion() }, null, 2)
    );
  } catch (e) {
    // Non-fatal: worst case the next launch also clears storage.
  }
}

/**
 * Wipe every trace of a previous install so the first launch is a true new game.
 * Covers localStorage (all progress and settings), plus caches and IndexedDB for good measure.
 */
async function resetPlayerData() {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['localstorage', 'indexdb', 'websql', 'cachestorage', 'serviceworkers', 'shadercache'],
    });
    await session.defaultSession.clearCache();
  } catch (e) {
    console.error('Failed to clear previous install data:', e);
  }
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    // Strip the query/hash and normalise; default to the SPA entry point.
    let relative = decodeURIComponent(url.pathname);
    if (!relative || relative === '/') relative = '/index.html';

    const resolved = path.normalize(path.join(DIST_DIR, relative));
    // Never serve anything outside dist/, whatever the request says.
    if (!resolved.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    let target = resolved;
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      // Single-page app: unknown paths fall back to the entry document.
      target = path.join(DIST_DIR, 'index.html');
    }

    // Read through fs rather than net.fetch(file://): in a packaged build these paths live
    // inside app.asar, which the file:// loader cannot see. fs is asar-aware, so this is the
    // only form that works both unpacked and packaged.
    try {
      const ext = path.extname(target).toLowerCase();
      const type = MIME_TYPES[ext] || 'application/octet-stream';
      const size = fs.statSync(target).size;
      // Stream instead of buffering: the soundtrack files are ~13 MB each.
      const body = Readable.toWeb(fs.createReadStream(target));
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Content-Length': String(size),
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      console.error('Failed to serve', target, e);
      return new Response('Not found', { status: 404 });
    }
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#050505',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The soundtrack must start without an extra click inside the app.
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false, // keep the game loop running if the window loses focus
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // External links open in the real browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`${APP_SCHEME}://local/index.html`);
  return win;
}

app.whenReady().then(async () => {
  registerAppProtocol();

  if (isFirstRun()) {
    await resetPlayerData();
    writeMarker();
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
