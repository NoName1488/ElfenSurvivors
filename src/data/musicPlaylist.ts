/**
 * File-based soundtracks.
 *
 * The rest of the game's music is synthesized procedurally in sound.ts. This layer plays
 * real audio files through an <audio> element instead, so the two can coexist: choosing a
 * file playlist swaps the generator out and routes the element through its own full
 * bandwidth chain.
 *
 * Two sources feed it:
 *   - the bundled soundtrack shipped in /public/music
 *   - whatever the player has dropped into their own music folder
 *
 * The player's folder only exists in the desktop build, where the main process lists it and
 * serves it over app://. In a browser there is no folder to read, so that playlist is
 * simply empty and the UI says so.
 */

export interface MusicTrack {
  id: string;
  /** Absolute URL the <audio> element loads. */
  url: string;
  artist: string;
  title: string;
  /** Where the track came from, which decides which playlist it belongs to. */
  source: 'bundled' | 'player';
}

/** Shape exposed by electron/preload.cjs. Absent in the browser build. */
interface DesktopBridge {
  isDesktop: boolean;
  listPlayerMusic: () => Promise<
    Array<{ id: string; file: string; url: string; artist: string; title: string; size: number }>
  >;
  openPlayerMusicFolder: () => Promise<{ ok: boolean; path: string; error: string | null }>;
}

function bridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as unknown as { elfenDesktop?: DesktopBridge }).elfenDesktop;
  return b && b.isDesktop ? b : null;
}

export function isDesktopBuild(): boolean {
  return bridge() !== null;
}

const MUSIC_BASE_PATH = '/music/';

/** The soundtrack that ships with the game. */
export const BUNDLED_PLAYLIST: MusicTrack[] = [
  { id: 'decalius_loneliness', url: MUSIC_BASE_PATH + 'decalius-loneliness.mp3', artist: 'Decalius', title: 'Loneliness', source: 'bundled' },
  { id: 'agony_her_dead_eyes', url: MUSIC_BASE_PATH + 'minuta-agonii-her-dead-eyes.mp3', artist: 'минута агонии', title: 'Her Dead Eyes', source: 'bundled' },
  { id: 'agony_my_friend', url: MUSIC_BASE_PATH + 'minuta-agonii-my-friend-killed-himself-last-spring.mp3', artist: 'минута агонии', title: 'My Friend Killed Himself Last Spring', source: 'bundled' },
  { id: 'desolate_ghost', url: MUSIC_BASE_PATH + 'desolate-thoughts-ghost.mp3', artist: 'Desolate Thoughts', title: 'Ghost', source: 'bundled' },
  { id: 'desolate_bitter_reality', url: MUSIC_BASE_PATH + 'desolate-thoughts-bitter-reality.mp3', artist: 'Desolate Thoughts', title: 'Bitter Reality', source: 'bundled' },
  { id: 'wintercult_frozen', url: MUSIC_BASE_PATH + 'wintercult-frozen-in-melancholy.mp3', artist: 'Wintercult', title: 'Frozen in Melancholy', source: 'bundled' },
];

/**
 * Tracks from the player's own folder.
 *
 * Held in a module-level cache rather than fetched on demand: the sound engine reads the
 * playlist synchronously on every track change, and an async read there would mean the
 * player's list is empty for the first frame after every skip.
 */
let playerTracks: MusicTrack[] = [];
const playerTrackListeners: Array<() => void> = [];

export function getPlayerTracks(): MusicTrack[] {
  return playerTracks;
}

export function onPlayerTracksChanged(listener: () => void): () => void {
  playerTrackListeners.push(listener);
  return () => {
    const i = playerTrackListeners.indexOf(listener);
    if (i >= 0) playerTrackListeners.splice(i, 1);
  };
}

/**
 * Rescans the player's music folder.
 * Safe to call any time; in a browser it resolves to an empty list without touching anything.
 */
export async function refreshPlayerTracks(): Promise<MusicTrack[]> {
  const b = bridge();
  if (!b) {
    playerTracks = [];
    playerTrackListeners.forEach((l) => l());
    return playerTracks;
  }

  try {
    const files = await b.listPlayerMusic();
    playerTracks = files.map((f) => ({
      id: f.id,
      url: f.url,
      artist: f.artist,
      // A file with no readable name still needs something to show in the list.
      title: f.title || f.file,
      source: 'player' as const,
    }));
  } catch (e) {
    // A folder that cannot be read is reported as empty rather than breaking the settings.
    playerTracks = [];
  }
  playerTrackListeners.forEach((l) => l());
  return playerTracks;
}

/** Opens the player's music folder in the OS file manager. */
export async function openPlayerMusicFolder(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try {
    const result = await b.openPlayerMusicFolder();
    return result.ok;
  } catch (e) {
    return false;
  }
}

export function getPlaylist(source: 'bundled' | 'player'): MusicTrack[] {
  return source === 'bundled' ? BUNDLED_PLAYLIST : playerTracks;
}
