/**
 * Test soundtrack: real audio files served from /public/music.
 *
 * The rest of the game's music is synthesized procedurally in sound.ts. This playlist is a
 * separate, file-based layer so the two can coexist: picking the "Test soundtrack" track
 * option swaps the procedural generator for an <audio> element routed through the same
 * music bus, so mute, volume and ducking keep working unchanged.
 */

export interface MusicTrack {
  id: string;
  /** Filename under /public/music. Kept ASCII so the URL needs no escaping. */
  file: string;
  artist: string;
  title: string;
}

export const CUSTOM_PLAYLIST: MusicTrack[] = [
  {
    id: 'decalius_loneliness',
    file: 'decalius-loneliness.mp3',
    artist: 'Decalius',
    title: 'Loneliness',
  },
  {
    id: 'agony_her_dead_eyes',
    file: 'minuta-agonii-her-dead-eyes.mp3',
    artist: 'минута агонии',
    title: 'Her Dead Eyes',
  },
  {
    id: 'agony_my_friend',
    file: 'minuta-agonii-my-friend-killed-himself-last-spring.mp3',
    artist: 'минута агонии',
    title: 'My Friend Killed Himself Last Spring',
  },
  {
    id: 'desolate_ghost',
    file: 'desolate-thoughts-ghost.mp3',
    artist: 'Desolate Thoughts',
    title: 'Ghost',
  },
  {
    id: 'desolate_bitter_reality',
    file: 'desolate-thoughts-bitter-reality.mp3',
    artist: 'Desolate Thoughts',
    title: 'Bitter Reality',
  },
  {
    id: 'wintercult_frozen',
    file: 'wintercult-frozen-in-melancholy.mp3',
    artist: 'Wintercult',
    title: 'Frozen in Melancholy',
  },
];

/** Base path used to build the src URL for a track. */
export const MUSIC_BASE_PATH = '/music/';

export function trackUrl(track: MusicTrack): string {
  return MUSIC_BASE_PATH + track.file;
}

export function getTrackById(id: string): MusicTrack | undefined {
  return CUSTOM_PLAYLIST.find((t) => t.id === id);
}
