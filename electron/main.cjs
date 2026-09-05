/**
 * Electron main process for the desktop build.
 *
 * The game is a pure static client: it never calls the Express/Gemini server, so the desktop
 * build just serves the Vite output. Files are served over a custom app:// protocol rather
 * than file://, because Chromium treats file:// as an opaque origin and localStorage there is
 * unreliable — and every bit of player progress (meta DNA, unlocks, achievements, settings)
 * lives in localStorage.
 */

const { app, BrowserWindow, ipcMain, protocol, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { checkForUpdates } = require('./updater.cjs');

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

// Player-supplied soundtrack. Anything dropped in here shows up in the audio settings as a
// playlist the player owns; nothing is ever written to it except the readme below.
const USER_MUSIC_DIRNAME = 'Music';
// Requests under this path serve from the player's music folder rather than from dist/.
const USER_MUSIC_URL_PREFIX = '/__player-music/';
// Notepad on Windows still wants CRLF, and this readme is meant to be opened there.
// One flat folder is served, so any name carrying a separator or a parent hop is
// rejected outright rather than normalised.
const UNSAFE_NAME = new RegExp('[/' + String.fromCharCode(92) + ']|[.][.]');
const WINDOWS_NEWLINE = String.fromCharCode(13, 10);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus', '.webm', '.aac']);

function userMusicDir() {
  return path.join(app.getPath('userData'), USER_MUSIC_DIRNAME);
}

/**
 * Creates the player's music folder on first launch and leaves a note in it saying what it
 * is for. Without the note an empty folder in appdata is indistinguishable from junk.
 */
function ensureUserMusicDir() {
  const dir = userMusicDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const readme = path.join(dir, 'ПРОЧТИ МЕНЯ - READ ME.txt');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(
        readme,
        [
          'Elfen Lied: Vector Survivor - своя музыка / your own music',
          '',
          'Положите сюда аудиофайлы, и они появятся в игре:',
          'Настройки звука -> Моя музыка.',
          '',
          'Drop audio files here and they will appear in game under',
          'Audio Settings -> My music.',
          '',
          'Поддерживаются / supported: mp3, ogg, wav, m4a, flac, opus, webm, aac',
          '',
          'Имя файла можно писать как "Исполнитель - Название.mp3",',
          'тогда игра разберёт его на исполнителя и название.',
          '',
          'Name a file "Artist - Title.mp3" and the game will split it',
          'into artist and title.',
        ].join(WINDOWS_NEWLINE),
        'utf8'
      );
    }
  } catch (e) {
    console.error('Could not prepare the player music folder:', e);
  }
  return dir;
}

/** Lists playable files in the player's music folder, newest name order, non-recursive. */
function listUserMusic() {
  const dir = ensureUserMusicDir();
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const base = path.basename(entry.name, path.extname(entry.name));
      // "Artist - Title" is the near-universal download convention; anything else is
      // shown whole as the title rather than guessed at.
      const dash = base.indexOf(' - ');
      const artist = dash > 0 ? base.slice(0, dash).trim() : '';
      const title = dash > 0 ? base.slice(dash + 3).trim() : base.trim();
      let size = 0;
      try {
        size = fs.statSync(path.join(dir, entry.name)).size;
      } catch (e) {
        // Vanished between readdir and stat; report it as unknown rather than dropping it.
      }
      return {
        id: `user:${entry.name}`,
        file: entry.name,
        url: `${APP_SCHEME}://local${USER_MUSIC_URL_PREFIX}${encodeURIComponent(entry.name)}`,
        artist,
        title,
        size,
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file, 'ru'));
}

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

/**
 * Serves one file, honouring a Range request.
 *
 * Range support is not optional for audio. Chromium's media stack routinely asks for byte
 * ranges - to read the trailing metadata, to seek, and to refill its buffer - and this
 * handler used to answer every one of them with the whole file and a flat 200. The media
 * element ends up with a buffer that does not line up with what it asked for, errors out
 * partway through, and the playlist's error handler quietly skipped to the next track. That
 * is the "track does not play to the end" bug: not a decoding fault, a missing 206.
 */
function serveFile(target, request) {
  const ext = path.extname(target).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  const size = fs.statSync(target).size;

  const range = request.headers.get('range');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

  if (match) {
    // A range is [start, end] inclusive, and either end may be omitted.
    // "bytes=-500" means the last 500 bytes; "bytes=500-" means from 500 to the end.
    let start;
    let end;
    if (match[1] === '') {
      const suffixLength = parseInt(match[2], 10);
      if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}` },
        });
      }
      start = Math.max(0, size - suffixLength);
      end = size - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] === '' ? size - 1 : parseInt(match[2], 10);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);

    const body = Readable.toWeb(fs.createReadStream(target, { start, end }));
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Stream instead of buffering: soundtrack files run to tens of megabytes.
  const body = Readable.toWeb(fs.createReadStream(target));
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(size),
      // Advertised so the media element knows it may seek at all.
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    },
  });
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    // Strip the query/hash and normalise; default to the SPA entry point.
    let relative = decodeURIComponent(url.pathname);
    if (!relative || relative === '/') relative = '/index.html';

    // Player's own music lives outside dist/, so it gets its own branch with its own
    // containment check rather than being reachable by climbing out of dist/.
    if (relative.startsWith(USER_MUSIC_URL_PREFIX)) {
      const name = relative.slice(USER_MUSIC_URL_PREFIX.length);
      // One flat directory: a name with any path separator in it is not a file we serve.
      if (!name || UNSAFE_NAME.test(name)) {
        return new Response('Forbidden', { status: 403 });
      }
      const dir = userMusicDir();
      const target = path.join(dir, name);
      if (!target.startsWith(dir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        return new Response('Not found', { status: 404 });
      }
      try {
        return serveFile(target, request);
      } catch (e) {
        console.error('Failed to serve player music', target, e);
        return new Response('Not found', { status: 404 });
      }
    }

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
      return serveFile(target, request);
    } catch (e) {
      console.error('Failed to serve', target, e);
      return new Response('Not found', { status: 404 });
    }
  });
}

/** Renderer-facing API for the player's music folder. */
function registerMusicIpc() {
  ipcMain.handle('player-music:list', () => listUserMusic());
  ipcMain.handle('player-music:open-folder', async () => {
    const dir = ensureUserMusicDir();
    const problem = await shell.openPath(dir);
    return { ok: !problem, path: dir, error: problem || null };
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
      preload: path.join(__dirname, 'preload.cjs'),
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

  // Check for a newer release on every launch, a few seconds in so the check never
  // competes with startup. Silent when already up to date, and silent on any failure.
  setTimeout(() => {
    checkForUpdates(win, { silent: true });
  }, 4000);

  return win;
}

app.whenReady().then(async () => {
  registerAppProtocol();
  registerMusicIpc();
  ensureUserMusicDir();

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

// Exported for tests. Electron ignores extra exports on the main entry point, and the
// range logic is the fix for tracks cutting out mid-playback, so it is worth asserting on.
module.exports = { serveFile, listUserMusic, userMusicDir, ensureUserMusicDir };
