/**
 * Preload bridge for the player's music folder.
 *
 * The renderer runs sandboxed with context isolation, so it has no filesystem of its own.
 * This exposes exactly two operations - list the folder, open it in the file manager - and
 * nothing else: the renderer never receives a path it could read from or write to directly,
 * only URLs the app:// handler already knows how to serve.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elfenDesktop', {
  isDesktop: true,
  /** @returns {Promise<Array<{id,file,url,artist,title,size}>>} */
  listPlayerMusic: () => ipcRenderer.invoke('player-music:list'),
  /** Opens the folder in Explorer/Finder so the player can drop files in. */
  openPlayerMusicFolder: () => ipcRenderer.invoke('player-music:open-folder'),
});
