/**
 * Update check against the project's GitHub releases.
 *
 * Deliberately hand-rolled instead of using electron-updater: the desktop build ships only
 * dist/, electron/ and a trimmed package.json (see scripts/package-win.cjs), with no
 * node_modules, so a runtime dependency would have to be bundled in. The NSIS installer
 * already upgrades in place, so all this needs to do is notice a newer release, ask, fetch
 * the installer and hand over to it.
 *
 * Failures are non-fatal by design: no network, rate limiting or a malformed release must
 * never stop the player from playing.
 */

const { app, dialog, net, shell, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const REPO_OWNER = 'NoName1488';
const REPO_NAME = 'ElfenSurvivors';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

/**
 * Compares versions, semver style. Returns >0 when a is newer than b.
 * A missing segment counts as 0, and a prerelease tag makes a version OLDER than the same
 * numbers without one — otherwise "1.0.0-beta" would be offered as an upgrade over the
 * released 1.0.0.
 */
function compareVersions(a, b) {
  const split = (v) => {
    const clean = String(v).trim().replace(/^v/i, '');
    const plus = clean.indexOf('+');
    const noBuild = plus === -1 ? clean : clean.slice(0, plus);
    const dash = noBuild.indexOf('-');
    return {
      core: (dash === -1 ? noBuild : noBuild.slice(0, dash)).split('.'),
      pre: dash === -1 ? '' : noBuild.slice(dash + 1),
    };
  };

  const va = split(a);
  const vb = split(b);

  for (let i = 0; i < Math.max(va.core.length, vb.core.length); i++) {
    const na = parseInt(va.core[i], 10) || 0;
    const nb = parseInt(vb.core[i], 10) || 0;
    if (na !== nb) return na - nb;
  }

  if (va.pre === vb.pre) return 0;
  if (!va.pre) return 1; // a is a release, b is a prerelease of the same numbers
  if (!vb.pre) return -1;
  return va.pre < vb.pre ? -1 : 1;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    request.setHeader('Accept', 'application/vnd.github+json');
    request.setHeader('User-Agent', `${REPO_NAME}-desktop/${app.getVersion()}`);
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        response.on('data', () => {});
        response.on('end', () => reject(new Error(`HTTP ${response.statusCode}`)));
        return;
      }
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

/** Downloads to disk, reporting progress through onProgress(fraction). */
function download(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', redirect: 'follow' });
    request.setHeader('User-Agent', `${REPO_NAME}-desktop/${app.getVersion()}`);
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        response.on('data', () => {});
        response.on('end', () => reject(new Error(`HTTP ${response.statusCode}`)));
        return;
      }
      const total = parseInt(response.headers['content-length'], 10) || 0;
      let received = 0;
      const out = fs.createWriteStream(destination);
      response.on('data', (chunk) => {
        received += chunk.length;
        out.write(chunk);
        if (total && onProgress) onProgress(received / total);
      });
      response.on('end', () => out.end(() => resolve(destination)));
      response.on('error', reject);
      out.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

async function promptAndInstall(win, release, asset) {
  const notes = (release.body || '').trim().split('\n').slice(0, 8).join('\n');
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['Скачать и установить', 'Открыть страницу релиза', 'Позже'],
    defaultId: 0,
    cancelId: 2,
    title: 'Доступно обновление',
    message: `Вышла версия ${release.tag_name}. Установлена ${app.getVersion()}.`,
    detail: notes ? `${notes}\n\nЗагрузка ~${Math.round(asset.size / 1048576)} МБ.` : `Загрузка ~${Math.round(asset.size / 1048576)} МБ.`,
  });

  if (response === 1) {
    shell.openExternal(RELEASES_PAGE);
    return;
  }
  if (response !== 0) return;

  const dir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, asset.name);

  if (win && !win.isDestroyed()) win.setProgressBar(0);
  try {
    await download(asset.browser_download_url, target, (fraction) => {
      if (win && !win.isDestroyed()) win.setProgressBar(fraction);
    });
  } catch (e) {
    if (win && !win.isDestroyed()) win.setProgressBar(-1);
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Не удалось скачать обновление',
      message: 'Загрузка не завершилась.',
      detail: `${e}\n\nМожно скачать вручную со страницы релизов.`,
      buttons: ['Открыть страницу релиза', 'Закрыть'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response: r }) => {
      if (r === 0) shell.openExternal(RELEASES_PAGE);
    });
    return;
  }
  if (win && !win.isDestroyed()) win.setProgressBar(-1);

  const { response: confirm } = await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['Установить сейчас', 'Позже'],
    defaultId: 0,
    cancelId: 1,
    title: 'Обновление загружено',
    message: 'Игра закроется и запустится установщик.',
    detail: 'Прогресс сохраняется — установка поверх его не трогает.',
  });
  if (confirm !== 0) return;

  // Hand over to the installer and get out of its way, otherwise it cannot replace files.
  await shell.openPath(target);
  app.quit();
}

/**
 * Checks for a newer release. Safe to call on every launch.
 * @param {BrowserWindow} win parent window for the dialogs
 * @param {{silent?: boolean}} options silent suppresses the "you are up to date" message
 */
async function checkForUpdates(win, options = {}) {
  const silent = options.silent !== false;
  try {
    const release = await fetchJson(RELEASES_API);
    if (!release || release.draft || !release.tag_name) return;

    if (compareVersions(release.tag_name, app.getVersion()) <= 0) {
      if (!silent) {
        await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Обновлений нет',
          message: `Установлена последняя версия (${app.getVersion()}).`,
          buttons: ['OK'],
        });
      }
      return;
    }

    const asset = (release.assets || []).find((a) => /\.exe$/i.test(a.name));
    if (!asset) {
      // A release without a Windows installer: point at the page rather than guessing.
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Открыть страницу релиза', 'Позже'],
        defaultId: 0,
        cancelId: 1,
        title: 'Доступно обновление',
        message: `Вышла версия ${release.tag_name}, но установщик для Windows к ней не приложен.`,
      });
      if (response === 0) shell.openExternal(RELEASES_PAGE);
      return;
    }

    await promptAndInstall(win, release, asset);
  } catch (e) {
    // Offline, rate limited, or GitHub had a bad day. Never block the game.
    console.log('Update check skipped:', e.message);
    if (!silent) {
      await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Не удалось проверить обновления',
        message: 'Нет связи с GitHub.',
        detail: String(e.message),
        buttons: ['OK'],
      });
    }
  }
}

module.exports = { checkForUpdates, compareVersions };
