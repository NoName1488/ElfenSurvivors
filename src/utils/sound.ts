/**
 * Web Audio API procedural sound synthesizer for Elfen Lied: Vector Survivor
 * Engineered with professional mastering bus, dynamic multi-stage limiter/compressor,
 * warm analog-style filtering to eliminate harsh high-frequency ear fatigue,
 * and an evolving multi-movement progressive soundtrack system.
 */

import { getPlaylist, onPlayerTracksChanged, MusicTrack } from '../data/musicPlaylist';

const AUDIO_SETTINGS_KEY = 'elfen_lied_audio_settings';

/**
 * Tracks the player can pick in the settings.
 * 'boss_battle' is deliberately absent: it is still generated, but the engine switches to it
 * on its own when a boss spawns, so offering it as a permanent choice made no sense.
 * The per-subject themes (Lilium, Kurama's elegy, Anna's singularity) are still reachable
 * through 'hero_theme'; only the standalone entries for them were removed.
 */
export const SELECTABLE_TRACKS = ['hero_theme', 'player_playlist'];

/** The player's own folder, listed by the desktop build. */
export const PLAYER_PLAYLIST_TRACK = 'player_playlist';

/**
 * A setting saved before the bundled soundtrack was removed.
 *
 * Kept only so an existing player's stored choice can be recognised and moved rather than
 * silently leaving them on a playlist that no longer exists.
 */
const REMOVED_BUNDLED_TRACK = 'custom_playlist';

/** The one file-backed option, as opposed to the procedural generators. */
export function isFilePlaylistTrack(track: string): boolean {
  return track === PLAYER_PLAYLIST_TRACK;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicMuted: boolean = false;
  private sfxMuted: boolean = false;
  private musicVolume: number = 0.35;
  private sfxVolume: number = 0.55;
  private isMusicPlaying: boolean = false;
  private listeners: (() => void)[] = [];

  // Dedicated Audio Bus Architecture
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiterFilter: BiquadFilterNode | null = null;

  private sfxGain: GainNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;

  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicDelayGain: GainNode | null = null;
  private musicDelayNode: DelayNode | null = null;
  private musicDelayFeedback: GainNode | null = null;
  private musicDelayFilter: BiquadFilterNode | null = null;

  // Active Music Session & Anti-Overlap Architecture
  private musicSessionId: number = 0;
  private activeMusicTimeouts: Set<any> = new Set();
  private activeMusicOscillators: Set<AudioNode> = new Set();
  private lastMusicStartTime: number = 0;
  private lastPlayedTrackKey: string = '';
  private sessionGain: GainNode | null = null;
  private currentCharacterId: string = 'lucy';
  private currentTrack: string = 'hero_theme';

  // File-based playlist. The <audio> element is created once and reused: a media element
  // may only be attached to one MediaElementAudioSourceNode for its lifetime.
  private fileAudio: HTMLAudioElement | null = null;
  private fileSource: MediaElementAudioSourceNode | null = null;
  private fileGain: GainNode | null = null;
  private fileCompressor: DynamicsCompressorNode | null = null;
  private playlistIndex: number = 0;
  private playlistShuffle: boolean = false;
  private playlistListeners: (() => void)[] = [];
  private trackBeforeBoss: string | null = null;
  private breathingPausesEnabled: boolean = true;

  // Throttling Timestamps to prevent abrasive audio stacking on swarm hits
  private lastVectorSoundTime = 0;
  private lastGoreSoundTime = 0;
  private lastClashSoundTime = 0;
  private lastDnaSoundTime = 0;
  private lastDeflectSoundTime = 0;
  private lastMinigunSoundTime = 0;
  private lastHeartbeatTime = 0;

  constructor() {
    this.musicVolume = 0.28;
    this.sfxVolume = 0.36;
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.musicVolume === 'number') this.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
        if (typeof parsed.musicMuted === 'boolean') this.musicMuted = parsed.musicMuted;
        if (typeof parsed.sfxMuted === 'boolean') this.sfxMuted = parsed.sfxMuted;
        if (typeof parsed.isMuted === 'boolean') this.isMuted = parsed.isMuted;
        if (typeof parsed.currentTrack === 'string' && parsed.currentTrack === REMOVED_BUNDLED_TRACK) {
          // The bundled soundtrack is gone; send anyone who had it selected to the themes.
          this.currentTrack = 'hero_theme';
        } else if (typeof parsed.currentTrack === 'string' && SELECTABLE_TRACKS.includes(parsed.currentTrack)) {
          this.currentTrack = parsed.currentTrack;
        }
        if (typeof parsed.breathingPausesEnabled === 'boolean') this.breathingPausesEnabled = parsed.breathingPausesEnabled;
      }
    } catch (e) {}
  }

  private saveSettings() {
    try {
      localStorage.setItem(
        AUDIO_SETTINGS_KEY,
        JSON.stringify({
          musicVolume: this.musicVolume,
          sfxVolume: this.sfxVolume,
          musicMuted: this.musicMuted,
          sfxMuted: this.sfxMuted,
          isMuted: this.isMuted,
          currentTrack: this.currentTrack,
          breathingPausesEnabled: this.breathingPausesEnabled,
        })
      );
    } catch (e) {}
    this.updateBusGains();
    this.notifyListeners();
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notifyListeners() {
    for (const l of this.listeners) {
      try {
        l();
      } catch (e) {}
    }
  }

  public canPlaySfx(): boolean {
    return !this.isMuted && !this.sfxMuted && this.sfxVolume > 0.001;
  }

  public canPlayMusic(): boolean {
    return !this.isMuted && !this.musicMuted && this.musicVolume > 0.001;
  }

  public getBreathingPausesEnabled(): boolean {
    return this.breathingPausesEnabled;
  }

  public setBreathingPausesEnabled(enabled: boolean) {
    this.breathingPausesEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Initializes the Web Audio graph with a high-fidelity mastering chain:
   * 1. Master Bus: gentle limiter/compressor preventing clipping & ear-splitting volume spikes.
   * 2. SFX Bus: warm analog-style lowpass (2.1 kHz) + fast dynamic leveler to eliminate shrill trebles.
   * 3. Music Bus: warm acoustic lowpass (1.9 kHz) + lush stereo delay/reverb for cinematic spatial depth.
   */
  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.masterGain) {
      // 1. MASTER CHAIN
      this.masterGain = this.ctx.createGain();
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(14, this.ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(4.0, this.ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      this.masterLimiterFilter = this.ctx.createBiquadFilter();
      this.masterLimiterFilter.type = 'lowpass';
      this.masterLimiterFilter.frequency.setValueAtTime(9500, this.ctx.currentTime);
      this.masterLimiterFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);

      this.masterGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.masterLimiterFilter);
      this.masterLimiterFilter.connect(this.ctx.destination);

      // 2. SFX BUS (Anti-Harshness Warm Curve: 2.1 kHz cuts ear-ringing spikes)
      this.sfxGain = this.ctx.createGain();
      this.sfxFilter = this.ctx.createBiquadFilter();
      this.sfxFilter.type = 'lowpass';
      this.sfxFilter.frequency.setValueAtTime(2100, this.ctx.currentTime);
      this.sfxFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);

      this.sfxCompressor = this.ctx.createDynamicsCompressor();
      this.sfxCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.sfxCompressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.sfxCompressor.ratio.setValueAtTime(3.8, this.ctx.currentTime);
      this.sfxCompressor.attack.setValueAtTime(0.006, this.ctx.currentTime);
      this.sfxCompressor.release.setValueAtTime(0.08, this.ctx.currentTime);

      this.sfxGain.connect(this.sfxFilter);
      this.sfxFilter.connect(this.sfxCompressor);
      this.sfxCompressor.connect(this.masterGain);

      // 3. MUSIC BUS (Warm Ambient Space: 1.9 kHz acoustic warmth)
      this.musicGain = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.setValueAtTime(1900, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);

      // Warm Delay/Echo for space and acoustic depth
      this.musicDelayNode = this.ctx.createDelay(1.0);
      this.musicDelayNode.delayTime.setValueAtTime(0.26, this.ctx.currentTime);

      this.musicDelayFeedback = this.ctx.createGain();
      this.musicDelayFeedback.gain.setValueAtTime(0.20, this.ctx.currentTime);

      this.musicDelayFilter = this.ctx.createBiquadFilter();
      this.musicDelayFilter.type = 'lowpass';
      this.musicDelayFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.musicDelayGain = this.ctx.createGain();
      this.musicDelayGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      // Routing music signal
      this.musicGain.connect(this.musicFilter);
      this.musicFilter.connect(this.masterGain);

      // Send to delay loop
      this.musicFilter.connect(this.musicDelayNode);
      this.musicDelayNode.connect(this.musicDelayFilter);
      this.musicDelayFilter.connect(this.musicDelayFeedback);
      this.musicDelayFeedback.connect(this.musicDelayNode);
      this.musicDelayFilter.connect(this.musicDelayGain);
      this.musicDelayGain.connect(this.masterGain);

      this.updateBusGains();
    }
  }

  private updateBusGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const effectiveMaster = this.isMuted ? 0 : 0.85;
    const effectiveSfx = this.sfxMuted ? 0 : this.sfxVolume;
    const effectiveMusic = this.musicMuted ? 0 : this.musicVolume;

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(effectiveMaster, now + 0.05);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.linearRampToValueAtTime(effectiveSfx, now + 0.05);
    }
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.linearRampToValueAtTime(effectiveMusic, now + 0.05);
    }
    if (this.fileGain) {
      const target = this.computeFileGain();
      this.fileGain.gain.cancelScheduledValues(now);
      this.fileGain.gain.linearRampToValueAtTime(target, now + 0.05);
    } else if (this.fileAudio && !this.fileSource) {
      // Fallback path: no Web Audio graph, so drive the element volume directly.
      this.fileAudio.volume = this.isMuted || this.musicMuted ? 0 : this.musicVolume;
    }
  }

  /**
   * Route an audio node safely into the warm SFX mastering bus
   */
  private connectSfx(node: AudioNode) {
    if (!this.sfxGain) this.init();
    if (this.sfxGain) {
      node.connect(this.sfxGain);
    }
  }

  /**
   * Route an instrument node safely into the current music session bus
   */
  private connectMusic(node: AudioNode) {
    this.activeMusicOscillators.add(node);
    try {
      (node as any).onended = () => {
        this.activeMusicOscillators.delete(node);
      };
    } catch (e) {}

    if (this.sessionGain) {
      node.connect(this.sessionGain);
    } else {
      if (!this.musicGain) this.init();
      if (this.musicGain) {
        node.connect(this.musicGain);
      }
    }
  }

  /**
   * Safe scheduler that strictly isolates playback steps to their unique session token.
   * If music was stopped, track changed, or boss spawned, stale timers are silently terminated.
   */
  private scheduleMusicStep(sessionId: number, fn: () => void, delayMs: number) {
    if (sessionId !== this.musicSessionId || !this.isMusicPlaying) return;
    const timerId = setTimeout(() => {
      this.activeMusicTimeouts.delete(timerId);
      if (sessionId === this.musicSessionId && this.isMusicPlaying && this.canPlayMusic()) {
        fn();
      }
    }, delayMs);
    this.activeMusicTimeouts.add(timerId);
  }

  private clearAllMusicTimeouts() {
    this.activeMusicTimeouts.forEach((id) => clearTimeout(id));
    this.activeMusicTimeouts.clear();
  }

  public enableAudio() {
    this.init();
    if (!this.isMusicPlaying && this.canPlayMusic()) {
      this.startMusic();
    }
  }

  public setCharacter(characterId: string) {
    if (this.currentCharacterId === characterId) return;
    this.currentCharacterId = characterId;
    // The file playlist is not character-scoped, so a subject swap must not restart it.
    if (isFilePlaylistTrack(this.currentTrack)) return;
    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startMusic();
    }
  }

  public startBossBattle() {
    // The file playlist plays straight through. Cutting a five-minute track in half to
    // start a boss stinger, then cutting back, is worse than letting it run.
    if (isFilePlaylistTrack(this.currentTrack)) return;
    if (this.currentTrack === 'boss_battle') return;
    this.trackBeforeBoss = this.currentTrack;
    this.currentTrack = 'boss_battle';
    this.stopMusic();
    this.startMusic();
  }

  public endBossBattle() {
    if (isFilePlaylistTrack(this.currentTrack)) return;
    if (this.currentTrack !== 'boss_battle') return;
    // Return to whatever was playing, not unconditionally to 'hero_theme'.
    this.currentTrack = this.trackBeforeBoss || 'hero_theme';
    this.trackBeforeBoss = null;
    this.stopMusic();
    this.startMusic();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx) {
      this.stopMusic();
    } else if (!muted && this.canPlayMusic()) {
      this.startMusic();
    }
    this.saveSettings();
  }

  public setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    if (muted) {
      this.stopMusic();
    } else if (this.canPlayMusic()) {
      this.startMusic();
    }
    this.saveSettings();
  }

  public toggleMusicMuted() {
    this.setMusicMuted(!this.musicMuted);
  }

  public setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
    this.saveSettings();
  }

  public toggleSfxMuted() {
    this.setSfxMuted(!this.sfxMuted);
  }

  public getIsMuted() {
    return this.isMuted;
  }

  public getIsMusicMuted() {
    return this.musicMuted;
  }

  public getIsSfxMuted() {
    return this.sfxMuted;
  }

  public getTrack() {
    return this.currentTrack;
  }

  public setTrack(track: string) {
    if (!SELECTABLE_TRACKS.includes(track)) return;
    if (this.currentTrack === track) return;

    // The two file playlists have their own lengths, so an index carried over from a
    // six-track soundtrack would point past the end of a two-file folder.
    const wasFile = isFilePlaylistTrack(this.currentTrack);
    const isFile = isFilePlaylistTrack(track);
    if (wasFile !== isFile || (isFile && wasFile && track !== this.currentTrack)) {
      this.playlistIndex = 0;
      if (this.fileAudio) {
        try { this.fileAudio.pause(); } catch (e) {}
        // Force a reload on the next start: the element must not resume the old list's file.
        this.fileAudio.removeAttribute('src');
      }
    }

    this.currentTrack = track;
    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startMusic();
    }
    this.notifyPlaylistChange();
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicVolume === 0 && !this.musicMuted) {
      this.stopMusic();
    } else if (this.musicVolume > 0 && !this.musicMuted && !this.isMusicPlaying && !this.isMuted) {
      this.startMusic();
    }
    this.saveSettings();
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public getMusicVolume() {
    return this.musicVolume;
  }

  public getSfxVolume() {
    return this.sfxVolume;
  }

  public startMusic() {
    if (!this.canPlayMusic()) return;
    this.init();
    if (!this.ctx) return;

    const currentKey = `${this.currentTrack}_${this.currentCharacterId}`;
    const nowPerf = performance.now();
    // Prevent duplicate rapid calls from simultaneous React component mounts
    if (this.isMusicPlaying && currentKey === this.lastPlayedTrackKey && (nowPerf - this.lastMusicStartTime < 180)) {
      return;
    }
    this.lastMusicStartTime = nowPerf;
    this.lastPlayedTrackKey = currentKey;

    // Strict guarantee: Cleanly terminate any active session before spawning a new one
    this.stopMusic();

    this.isMusicPlaying = true;
    const sessionId = ++this.musicSessionId;

    // Dedicated isolated gain node for this session with click-free attack
    this.sessionGain = this.ctx.createGain();
    this.sessionGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    if (this.musicGain) {
      this.sessionGain.connect(this.musicGain);
    }

    if (isFilePlaylistTrack(this.currentTrack)) {
      this.startFilePlaylist();
    } else if (this.currentTrack === 'boss_battle') {
      this.startBossBattleMusic(sessionId);
    } else if (this.currentTrack === 'lilium' || this.currentTrack === 'lilium_complete') {
      this.startLiliumMusic(sessionId);
    } else if (this.currentTrack === 'kurama_elegy') {
      this.startKuramaElegyMusic(sessionId);
    } else if (this.currentTrack === 'singularity') {
      this.startSingularityMusic(sessionId);
    } else {
      // hero_theme: dynamically mapped per character
      if (this.currentCharacterId === 'nyu') {
        this.startNyuDreamMusic(sessionId);
      } else if (this.currentCharacterId === 'nana') {
        this.startNanaMelancholyMusic(sessionId);
      } else if (this.currentCharacterId === 'bando') {
        this.startBandoTacticalMusic(sessionId);
      } else if (this.currentCharacterId === 'mariko') {
        this.startMarikoDissonanceMusic(sessionId);
      } else if (this.currentCharacterId === 'restrained_lucy') {
        this.startRestrainedLucyMusic(sessionId);
      } else if (this.currentCharacterId === 'kurama') {
        this.startKuramaElegyMusic(sessionId);
      } else if (this.currentCharacterId === 'anna_kakuzawa') {
        this.startSingularityMusic(sessionId);
      } else {
        this.startLiliumMusic(sessionId);
      }
    }
  }

  // ─── File-based test soundtrack ────────────────────────────────────────────

  private ensureFilePlayer(): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null;
    if (this.fileAudio) return this.fileAudio;

    const el = document.createElement('audio');
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.addEventListener("ended", () => this.advanceTrack(1, true));
    el.addEventListener("error", () => {
      // A missing or unreadable file must not stall the whole playlist.
      this.advanceTrack(1, true);
    });
    this.fileAudio = el;

    // Files get their own full-bandwidth chain straight to the output.
    //
    // The music bus is voiced for the procedural synthesizer: a lowpass at 1900 Hz plus a
    // 260ms echo send. That is a deliberate warmth curve for oscillator tones, but on a
    // real recording it removes cymbals, air and every sibilant, and the echo smears the
    // mix. The master chain then lowpasses again at 9500 Hz.
    // So the file player bypasses both filters and the delay send, keeping only its own
    // gain (driven by the same music volume and mute) and a gentle compressor so a loud
    // master does not clip against the SFX bus.
    this.init();
    if (this.ctx) {
      try {
        this.fileGain = this.ctx.createGain();
        this.fileGain.gain.value = this.computeFileGain();

        this.fileCompressor = this.ctx.createDynamicsCompressor();
        this.fileCompressor.threshold.setValueAtTime(-8, this.ctx.currentTime);
        this.fileCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.fileCompressor.ratio.setValueAtTime(2.5, this.ctx.currentTime);
        this.fileCompressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
        this.fileCompressor.release.setValueAtTime(0.18, this.ctx.currentTime);

        this.fileSource = this.ctx.createMediaElementSource(el);
        this.fileSource.connect(this.fileGain);
        this.fileGain.connect(this.fileCompressor);
        this.fileCompressor.connect(this.ctx.destination);
      } catch (e) {
        // Web Audio routing unavailable: fall back to plain element playback.
        this.fileSource = null;
        this.fileGain = null;
        this.fileCompressor = null;
        el.volume = this.musicVolume;
      }
    }
    return el;
  }

  // The file bus sits outside masterGain, so it has to fold in the master mute and the
  // same 0.85 headroom the master bus uses.
  private computeFileGain(): number {
    if (this.isMuted || this.musicMuted) return 0;
    return this.musicVolume * 0.85;
  }

  /** The list the transport controls act on: the player's own folder. */
  private activePlaylist(): MusicTrack[] {
    return getPlaylist();
  }

  private startFilePlaylist() {
    const el = this.ensureFilePlayer();
    const list = this.activePlaylist();
    if (!el || list.length === 0) return;

    const track = list[this.playlistIndex % list.length];
    const url = track.url;
    // Only reload when the source actually changes, otherwise resume where we paused.
    if (!el.src.endsWith(url)) {
      el.src = url;
    }
    if (!this.fileSource) el.volume = this.isMuted || this.musicMuted ? 0 : this.musicVolume;
    const playAttempt = el.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      // Autoplay policy: playback starts on the next user gesture via enableAudio().
      playAttempt.catch(() => {});
    }
    this.notifyPlaylistChange();
  }

  private pauseFilePlaylist() {
    if (this.fileAudio && !this.fileAudio.paused) {
      try { this.fileAudio.pause(); } catch (e) {}
    }
  }

  private advanceTrack(delta: number, autoplay: boolean) {
    const list = this.activePlaylist();
    if (list.length === 0) return;
    if (this.playlistShuffle && delta > 0 && list.length > 1) {
      let next = this.playlistIndex;
      while (next === this.playlistIndex) {
        next = Math.floor(Math.random() * list.length);
      }
      this.playlistIndex = next;
    } else {
      const len = list.length;
      this.playlistIndex = ((this.playlistIndex + delta) % len + len) % len;
    }
    if (this.fileAudio) {
      try { this.fileAudio.pause(); } catch (e) {}
      this.fileAudio.currentTime = 0;
    }
    if (autoplay && isFilePlaylistTrack(this.currentTrack) && this.canPlayMusic()) {
      this.isMusicPlaying = true;
      this.startFilePlaylist();
    } else {
      this.notifyPlaylistChange();
    }
  }

  public nextPlaylistTrack() {
    this.advanceTrack(1, true);
  }

  public prevPlaylistTrack() {
    this.advanceTrack(-1, true);
  }

  public selectPlaylistTrack(index: number) {
    if (index < 0 || index >= this.activePlaylist().length) return;
    this.playlistIndex = index;
    if (this.fileAudio) {
      try { this.fileAudio.pause(); } catch (e) {}
      this.fileAudio.currentTime = 0;
    }
    if (isFilePlaylistTrack(this.currentTrack) && this.canPlayMusic()) {
      this.isMusicPlaying = true;
      this.startFilePlaylist();
    } else {
      this.notifyPlaylistChange();
    }
  }

  public getPlaylist(): MusicTrack[] {
    return this.activePlaylist();
  }

  public getPlaylistIndex(): number {
    return this.playlistIndex;
  }

  public getCurrentPlaylistTrack(): MusicTrack | null {
    const list = this.activePlaylist();
    if (list.length === 0) return null;
    return list[this.playlistIndex % list.length];
  }

  public isPlaylistActive(): boolean {
    return isFilePlaylistTrack(this.currentTrack);
  }

  public getPlaylistShuffle(): boolean {
    return this.playlistShuffle;
  }

  public setPlaylistShuffle(on: boolean) {
    this.playlistShuffle = on;
    this.notifyPlaylistChange();
  }

  /** UI subscription so the now-playing readout follows auto-advance. */
  public subscribePlaylist(cb: () => void): () => void {
    this.playlistListeners.push(cb);
    return () => {
      const i = this.playlistListeners.indexOf(cb);
      if (i !== -1) this.playlistListeners.splice(i, 1);
    };
  }

  /**
   * Keeps the transport honest when the player's folder is rescanned underneath it: an
   * index into a list that just shrank is clamped, and the UI is told to redraw.
   */
  public onPlayerLibraryChanged() {
    const list = this.activePlaylist();
    if (list.length === 0) {
      this.playlistIndex = 0;
    } else if (this.playlistIndex >= list.length) {
      this.playlistIndex = 0;
    }
    this.notifyPlaylistChange();
  }

  private notifyPlaylistChange() {
    this.playlistListeners.forEach((cb) => {
      try { cb(); } catch (e) {}
    });
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    this.pauseFilePlaylist();
    // Invalidate session ID immediately so any active timer callback halts
    this.musicSessionId++;
    this.clearAllMusicTimeouts();

    // Immediately stop & disconnect all currently sounding music oscillators
    this.activeMusicOscillators.forEach((node) => {
      try {
        (node as any).stop?.();
        node.disconnect();
      } catch (e) {}
    });
    this.activeMusicOscillators.clear();

    // Instant click-free disconnect of session gain
    if (this.sessionGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.sessionGain.gain.cancelScheduledValues(now);
        this.sessionGain.gain.setValueAtTime(0.0001, now);
        this.sessionGain.disconnect();
      } catch (e) {}
      this.sessionGain = null;
    }
  }

  /**
   * Gentle ambient drone breather for auditory rest
   */
  public playAmbientDrone(durationSec: number = 4.0) {
    if (!this.ctx || !this.canPlayMusic()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55.0, now); // A1 sub tone
      osc.frequency.linearRampToValueAtTime(54.5, now + durationSec);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 1.2);
      gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(filter);
      filter.connect(gain);
      this.connectMusic(gain);

      osc.start(now);
      osc.stop(now + durationSec);
    } catch (e) {}
  }

  // =========================================================================
  // MUSIC GENERATION: PROGRESSIVE MULTI-MOVEMENT SOUNDTRACK
  // Solves repetitive ear fatigue through structured movement phases:
  // Phase 0: Gentle Melodic Exposition
  // Phase 1: Harmonic Development & Warm Rhythm
  // Phase 2: Gothic/Symphonic Power Climax
  // Phase 3: Ambient Contemplative Breather (Crucial for sensory relaxation)
  // =========================================================================

  /**
   * 1. LUCY / DEFAULT: THE COMPLETE "LILIUM" GOTHIC HYMN & ELEGY
   * Full 4-phase composition covering all classical phrases with rich choir formants,
   * warm cello pedal tones, music box chime variations, and peaceful ambient pauses.
   */
  private startLiliumMusic(sessionId: number, onCycleComplete?: () => void) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    // The complete Latin hymn phrases across 4 movements:
    // M0: "Os iusti meditabitur sapientiam" (Main Music Box + Deep Sub Cello)
    // M1: "Et lingua eius loquetur iudicium" (Choir pad swells + Harmonic expansion)
    // M2: "Beatus vir qui suffert tentationem" (Gothic Organ + Full Cathedral Chorus)
    // M3: Ambient Interlude & Breathing Space (Gentle church bells, warm wind pad)
    const hymnMovements: Array<{
      note: number;
      bass?: number;
      chord?: number[];
      dur: number;
      chime?: boolean;
      choir?: boolean;
    }>[] = [
      // Movement 0: Lyrical Exposition
      [
        { note: 440.0, bass: 110.0, chord: [220, 261.63], dur: 0.7, chime: true, choir: false }, // A4
        { note: 523.25, bass: 110.0, dur: 0.6, chime: true, choir: false }, // C5
        { note: 659.25, bass: 110.0, dur: 0.8, chime: true, choir: true },  // E5
        { note: 587.33, bass: 98.0, chord: [196, 246.94], dur: 0.6, chime: true, choir: false }, // D5
        { note: 523.25, bass: 98.0, dur: 0.6, chime: true, choir: false },  // C5
        { note: 493.88, bass: 82.41, chord: [164.81, 246.94], dur: 0.9, chime: true, choir: true }, // B4
        { note: 392.0, bass: 82.41, dur: 0.6, chime: true, choir: false },  // G4
        { note: 440.0, bass: 110.0, chord: [220, 261.63, 329.63], dur: 1.4, chime: true, choir: true }, // A4
      ],
      // Movement 1: Harmonic Development
      [
        { note: 440.0, bass: 110.0, chord: [220, 261.63], dur: 0.6, chime: true, choir: true },
        { note: 523.25, bass: 110.0, dur: 0.6, chime: true, choir: false },
        { note: 659.25, bass: 130.81, chord: [261.63, 329.63], dur: 0.8, chime: true, choir: true },
        { note: 783.99, bass: 130.81, dur: 0.8, chime: true, choir: true },
        { note: 659.25, bass: 98.0, chord: [196, 293.66], dur: 0.6, chime: true, choir: false },
        { note: 587.33, bass: 98.0, dur: 1.1, chime: true, choir: true },
        { note: 523.25, bass: 87.31, chord: [174.61, 261.63], dur: 0.6, chime: true, choir: false },
        { note: 587.33, bass: 87.31, dur: 0.6, chime: true, choir: false },
        { note: 659.25, bass: 110.0, chord: [220, 329.63], dur: 0.8, chime: true, choir: true },
        { note: 523.25, bass: 110.0, dur: 0.6, chime: true, choir: false },
        { note: 440.0, bass: 82.41, chord: [164.81, 246.94], dur: 0.8, chime: true, choir: true },
        { note: 392.0, bass: 82.41, dur: 0.6, chime: true, choir: false },
        { note: 440.0, bass: 110.0, chord: [220, 261.63, 329.63, 440], dur: 1.8, chime: true, choir: true },
      ],
      // Movement 2: Gothic Climax (Full Choir & Grand Organ)
      [
        { note: 659.25, bass: 73.42, chord: [146.83, 220, 293.66], dur: 0.8, chime: true, choir: true }, // E5 over Dm
        { note: 783.99, bass: 73.42, dur: 0.7, chime: true, choir: true },
        { note: 880.0, bass: 58.27, chord: [116.54, 233.08, 349.23], dur: 1.0, chime: true, choir: true }, // A5 over Bb
        { note: 783.99, bass: 58.27, dur: 0.6, chime: true, choir: true },
        { note: 659.25, bass: 98.0, chord: [196, 293.66, 392], dur: 0.8, chime: true, choir: true },
        { note: 587.33, bass: 98.0, dur: 0.7, chime: true, choir: true },
        { note: 523.25, bass: 110.0, chord: [220, 277.18, 329.63], dur: 0.9, chime: true, choir: true }, // A major
        { note: 440.0, bass: 110.0, chord: [220, 261.63, 329.63], dur: 1.8, chime: true, choir: true }, // Dm resolve
      ],
      // Movement 3: Serene Ambient Breather (Prevents Ear Fatigue)
      [
        { note: 440.0, bass: 55.0, chord: [110, 164.81, 220], dur: 2.2, chime: false, choir: true },
        { note: 523.25, bass: 65.41, chord: [130.81, 196, 261.63], dur: 2.2, chime: false, choir: true },
        { note: 440.0, bass: 55.0, chord: [110, 164.81, 220], dur: 2.4, chime: true, choir: true },
      ],
    ];

    let currentMovement = 0;
    let noteIndex = 0;

    const playLiliumStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;

      const movement = hymnMovements[currentMovement];
      const item = movement[noteIndex];
      const now = this.ctx.currentTime;
      const dur = item.dur;

      try {
        // 1. Soft Warm Music Box Bell
        if (item.chime) {
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const chimeGain = this.ctx.createGain();
          const chimeFilter = this.ctx.createBiquadFilter();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(item.note, now);

          // Subdued octave harmonic (warm glass shimmer)
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(item.note * 2.002, now);

          chimeFilter.type = 'lowpass';
          chimeFilter.frequency.setValueAtTime(1300, now);

          // Soft non-click envelope with gentle anti-fatigue amplitude
          chimeGain.gain.setValueAtTime(0.0001, now);
          chimeGain.gain.linearRampToValueAtTime(0.08, now + 0.012);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.5);

          osc1.connect(chimeFilter);
          osc2.connect(chimeFilter);
          chimeFilter.connect(chimeGain);
          this.connectMusic(chimeGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + dur * 1.5);
          osc2.stop(now + dur * 1.5);
        }

        // 2. Warm Cathedral Choir Formants
        if (item.choir && item.chord) {
          item.chord.forEach((freq) => {
            if (!this.ctx) return;
            const choirOsc = this.ctx.createOscillator();
            const formant = this.ctx.createBiquadFilter();
            const choirGain = this.ctx.createGain();

            choirOsc.type = 'triangle';
            choirOsc.frequency.setValueAtTime(freq, now);

            // "Ah / Oh" vocal formant vowel filter
            formant.type = 'bandpass';
            formant.frequency.setValueAtTime(650, now);
            formant.Q.setValueAtTime(2.2, now);

            choirGain.gain.setValueAtTime(0.0001, now);
            choirGain.gain.linearRampToValueAtTime(0.07, now + 0.2);
            choirGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.3);

            choirOsc.connect(formant);
            formant.connect(choirGain);
            this.connectMusic(choirGain);

            choirOsc.start(now);
            choirOsc.stop(now + dur * 1.3);
          });
        }

        // 3. Deep Resonant Cello / Organ Pedal
        if (item.bass) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          const bassFilter = this.ctx.createBiquadFilter();

          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(item.bass, now);

          bassFilter.type = 'lowpass';
          bassFilter.frequency.setValueAtTime(350, now);

          bassGain.gain.setValueAtTime(0.0001, now);
          bassGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.2);

          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          this.connectMusic(bassGain);

          bassOsc.start(now);
          bassOsc.stop(now + dur * 1.2);
        }
      } catch (e) {}

      noteIndex++;
      if (noteIndex >= movement.length) {
        noteIndex = 0;
        currentMovement = (currentMovement + 1) % hymnMovements.length;
        if (currentMovement === 0) {
          if (onCycleComplete) {
            onCycleComplete();
            return;
          }
          if (this.breathingPausesEnabled) {
            // Solves ear fatigue: 5 second relaxing ambient pause before next loop
            this.playAmbientDrone(4.8);
            this.scheduleMusicStep(sessionId, playLiliumStep, 5000);
            return;
          }
        }
      }

      this.scheduleMusicStep(sessionId, playLiliumStep, dur * 920);
    };

    playLiliumStep();
  }

  /**
   * 2. NYU: INNOCENT LULLABY & SUNSET MUSIC BOX
   * Pentatonic soothing melody with spacious natural breathing, gentle kalimba tones,
   * and comforting major harmonies that reduce anxiety and cognitive fatigue.
   */
  private startNyuDreamMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const sections = [
      // Section A: Gentle Sunlit Chimes
      [
        { note: 523.25, dur: 0.6 }, // C5
        { note: 659.25, dur: 0.6 }, // E5
        { note: 783.99, dur: 0.7 }, // G5
        { note: 1046.5, dur: 0.9 }, // C6
        { note: 880.0, dur: 0.6 },  // A5
        { note: 783.99, dur: 0.7 }, // G5
        { note: 659.25, dur: 1.2 }, // E5
      ],
      // Section B: Warm Lullaby Turn
      [
        { note: 587.33, dur: 0.6 }, // D5
        { note: 659.25, dur: 0.6 }, // E5
        { note: 783.99, dur: 0.7 }, // G5
        { note: 880.0, dur: 0.9 },  // A5
        { note: 783.99, dur: 0.6 }, // G5
        { note: 659.25, dur: 0.6 }, // E5
        { note: 523.25, dur: 1.5 }, // C5
      ],
      // Section C: Soothing Ambient Drift
      [
        { note: 659.25, dur: 1.0 }, // E5
        { note: 587.33, dur: 1.0 }, // D5
        { note: 523.25, dur: 1.4 }, // C5
        { note: 392.0, dur: 1.8 },  // G4
      ],
    ];

    let secIdx = 0;
    let noteIdx = 0;

    const playNyuStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const currentSection = sections[secIdx];
      const item = currentSection[noteIdx];
      const now = this.ctx.currentTime;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(item.note, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.6);

        osc.connect(filter);
        filter.connect(gain);
        this.connectMusic(gain);

        osc.start(now);
        osc.stop(now + item.dur * 1.6);

        // Soft sub bass anchor
        if (noteIdx === 0) {
          const bass = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bass.type = 'sine';
          bass.frequency.setValueAtTime(item.note * 0.25, now);
          bassGain.gain.setValueAtTime(0.0001, now);
          bassGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 2.0);
          bass.connect(bassGain);
          this.connectMusic(bassGain);
          bass.start(now);
          bass.stop(now + item.dur * 2.0);
        }
      } catch (e) {}

      noteIdx++;
      if (noteIdx >= currentSection.length) {
        noteIdx = 0;
        secIdx = (secIdx + 1) % sections.length;
      }

      this.scheduleMusicStep(sessionId, playNyuStep, item.dur * 900);
    };

    playNyuStep();
  }

  /**
   * 3. NANA: MELANCHOLY VIOLIN & CELLO DUET ("SHINJITSU - TRUTH")
   * Moving emotional progression across Em, C, G, D, Am, B7 with warm bowing strings,
   * gentle cello resonance, and dynamic phrasing that avoids ear exhaustion.
   */
  private startNanaMelancholyMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const phrases = [
      // Phrase 1: The Weight of Solitude
      [
        { bass: 82.41, notes: [164.81, 246.94, 329.63], dur: 1.6 }, // Em
        { bass: 65.41, notes: [130.81, 261.63, 329.63], dur: 1.6 }, // C
        { bass: 98.00, notes: [196.00, 246.94, 293.66], dur: 1.6 }, // G
        { bass: 73.42, notes: [146.83, 220.00, 293.66], dur: 1.6 }, // D
      ],
      // Phrase 2: Seeds of Hope & Friendship
      [
        { bass: 82.41, notes: [164.81, 261.63, 329.63, 440.0], dur: 1.6 }, // Am/E
        { bass: 61.74, notes: [123.47, 246.94, 311.13, 369.99], dur: 1.6 }, // B7
        { bass: 65.41, notes: [130.81, 261.63, 392.00], dur: 1.6 }, // Cmaj7
        { bass: 73.42, notes: [146.83, 220.00, 369.99, 440.0], dur: 2.0 }, // Dsus
      ],
      // Phrase 3: Quiet Reflection & Warm Rest
      [
        { bass: 82.41, notes: [164.81, 329.63], dur: 2.2 }, // Em open fifth
        { bass: 98.00, notes: [196.00, 293.66], dur: 2.2 }, // G open fifth
        { bass: 82.41, notes: [164.81, 246.94, 329.63], dur: 2.6 }, // Em resolve
      ],
    ];

    let pIdx = 0;
    let stepIdx = 0;

    const playNanaStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const currentPhrase = phrases[pIdx];
      const chord = currentPhrase[stepIdx];
      const now = this.ctx.currentTime;
      const dur = chord.dur;

      try {
        // Soft Bowed Strings (Warm Lowpass Filtered Sawtooth)
        chord.notes.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(680, now);
          filter.Q.setValueAtTime(0.7, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.065, now + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.15);

          osc.connect(filter);
          filter.connect(gain);
          this.connectMusic(gain);

          osc.start(now);
          osc.stop(now + dur * 1.15);
        });

        // Deep Cello Sub-Bass
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(chord.bass, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.14, now + 0.1);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.05);

        bassOsc.connect(bassGain);
        this.connectMusic(bassGain);
        bassOsc.start(now);
        bassOsc.stop(now + dur * 1.05);
      } catch (e) {}

      stepIdx++;
      if (stepIdx >= currentPhrase.length) {
        stepIdx = 0;
        pIdx = (pIdx + 1) % phrases.length;
      }

      this.scheduleMusicStep(sessionId, playNanaStep, dur * 940);
    };

    playNanaStep();
  }

  /**
   * 4. MARIKO: THE 35TH REQUIEM (TRAGIC BAROQUE ELEGANCE)
   * Replaces the former ear-piercing rapid dissonant loop with a deep, haunting,
   * slow gothic requiem: mournful tolling bells, rich cello swells, and tragic D-minor harmony.
   */
  private startMarikoDissonanceMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const progression = [
      // 1. Dm Tragic Elegy
      { bass: 73.42, bell: 587.33, choir: [293.66, 349.23], dur: 1.4 },
      // 2. Gm Shadow
      { bass: 49.00, bell: 466.16, choir: [196.00, 233.08], dur: 1.4 },
      // 3. A7 Suspense
      { bass: 55.00, bell: 554.37, choir: [220.00, 277.18], dur: 1.4 },
      // 4. Dm Resolution with gentle chime
      { bass: 73.42, bell: 440.00, choir: [220.00, 261.63], dur: 1.8 },
      // 5. Ambient Pause (Rest for the mind)
      { bass: 36.71, bell: 880.00, choir: [146.83, 220.00], dur: 2.2 },
    ];

    let stepIdx = 0;

    const playMarikoStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const step = progression[stepIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Haunting Tolling Bell
        const bellOsc = this.ctx.createOscillator();
        const bellFilter = this.ctx.createBiquadFilter();
        const bellGain = this.ctx.createGain();

        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(step.bell, now);

        bellFilter.type = 'lowpass';
        bellFilter.frequency.setValueAtTime(1400, now);

        bellGain.gain.setValueAtTime(0.0001, now);
        bellGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.4);

        bellOsc.connect(bellFilter);
        bellFilter.connect(bellGain);
        this.connectMusic(bellGain);

        bellOsc.start(now);
        bellOsc.stop(now + dur * 1.4);

        // Tragic Cello Swell
        step.choir.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.09, now + 0.3);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.1);

          osc.connect(filter);
          filter.connect(gain);
          this.connectMusic(gain);

          osc.start(now);
          osc.stop(now + dur * 1.1);
        });

        // Deep Sub Drone
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(step.bass, now);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        sub.connect(subGain);
        this.connectMusic(subGain);
        sub.start(now);
        sub.stop(now + dur);
      } catch (e) {}

      stepIdx = (stepIdx + 1) % progression.length;
      this.scheduleMusicStep(sessionId, playMarikoStep, dur * 930);
    };

    playMarikoStep();
  }

  /**
   * 5. BANDO: DARK TACTICAL SYNTHWAVE
   * Deep, warm analog synth bassline with punchy low-end pulse, evolving arpeggios,
   * and military cadence without harsh sirens or screeching trebles.
   */
  private startBandoTacticalMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const measures = [
      // Measure 1: Recon Infiltration (Punchy, subdued groove)
      [
        { bass: 55.0, kick: true, snare: false, dur: 0.28 },
        { bass: 55.0, kick: false, snare: false, dur: 0.28 },
        { bass: 55.0, kick: false, snare: true, dur: 0.28 },
        { bass: 65.41, kick: true, snare: false, dur: 0.28 },
        { bass: 55.0, kick: true, snare: false, dur: 0.28 },
        { bass: 49.0, kick: false, snare: false, dur: 0.28 },
        { bass: 55.0, kick: false, snare: true, dur: 0.28 },
        { bass: 73.42, kick: true, snare: false, dur: 0.28 },
      ],
      // Measure 2: Firefight Escalation (Driving synth bass)
      [
        { bass: 55.0, kick: true, snare: false, dur: 0.28 },
        { bass: 82.41, kick: false, snare: false, dur: 0.28 },
        { bass: 55.0, kick: true, snare: true, dur: 0.28 },
        { bass: 65.41, kick: false, snare: false, dur: 0.28 },
        { bass: 73.42, kick: true, snare: false, dur: 0.28 },
        { bass: 65.41, kick: false, snare: false, dur: 0.28 },
        { bass: 55.0, kick: true, snare: true, dur: 0.28 },
        { bass: 49.0, kick: false, snare: false, dur: 0.28 },
      ],
      // Measure 3: Tactical Resupply (Low drone pause)
      [
        { bass: 55.0, kick: true, snare: false, dur: 0.56 },
        { bass: 55.0, kick: false, snare: true, dur: 0.56 },
        { bass: 49.0, kick: true, snare: false, dur: 0.56 },
        { bass: 65.41, kick: false, snare: true, dur: 0.56 },
      ],
    ];

    let mIdx = 0;
    let sIdx = 0;

    const playBandoStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const currentMeasure = measures[mIdx];
      const step = currentMeasure[sIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Warm Analog Sub-Bass
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(step.bass, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(450, now);

        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.22, now + 0.015);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.95);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        this.connectMusic(bassGain);

        bassOsc.start(now);
        bassOsc.stop(now + dur * 0.95);

        // Low-End Punchy Kick (No click)
        if (step.kick) {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(120, now);
          kickOsc.frequency.exponentialRampToValueAtTime(36, now + 0.14);

          kickGain.gain.setValueAtTime(0.0001, now);
          kickGain.gain.linearRampToValueAtTime(0.35, now + 0.005);
          kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

          kickOsc.connect(kickGain);
          this.connectMusic(kickGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.15);
        }

        // Warm Snare / Clap
        if (step.snare) {
          const snareOsc = this.ctx.createOscillator();
          const snareFilter = this.ctx.createBiquadFilter();
          const snareGain = this.ctx.createGain();

          snareOsc.type = 'triangle';
          snareOsc.frequency.setValueAtTime(220, now);
          snareOsc.frequency.exponentialRampToValueAtTime(80, now + 0.11);

          snareFilter.type = 'lowpass';
          snareFilter.frequency.setValueAtTime(900, now);

          snareGain.gain.setValueAtTime(0.0001, now);
          snareGain.gain.linearRampToValueAtTime(0.24, now + 0.005);
          snareGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

          snareOsc.connect(snareFilter);
          snareFilter.connect(snareGain);
          this.connectMusic(snareGain);

          snareOsc.start(now);
          snareOsc.stop(now + 0.12);
        }
      } catch (e) {}

      sIdx++;
      if (sIdx >= currentMeasure.length) {
        sIdx = 0;
        mIdx = (mIdx + 1) % measures.length;
      }

      this.scheduleMusicStep(sessionId, playBandoStep, dur * 950);
    };

    playBandoStep();
  }

  /**
   * 6. BOSS BATTLE: GOTHIC DUEL OF DICLONII
   * Intense multi-movement orchestral battle sequence: rolling timpani, staccato cello,
   * soaring choral vowel chords, and dramatic dynamic peaks that resolve into tense tactical breathers.
   */
  private startBossBattleMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const battleMovements = [
      // Movement 1: Driving Staccato Duel
      [
        { root: 146.83, bass: 73.42, choir: [293.66, 349.23, 440.0], timpani: true, dur: 0.34 }, // Dm
        { root: 146.83, bass: 73.42, choir: [293.66, 349.23, 440.0], timpani: false, dur: 0.34 },
        { root: 174.61, bass: 73.42, choir: [349.23, 440.0, 523.25], timpani: true, dur: 0.34 }, // F
        { root: 116.54, bass: 58.27, choir: [233.08, 293.66, 349.23], timpani: true, dur: 0.34 }, // Bb
        { root: 98.00,  bass: 49.00, choir: [196.00, 233.08, 293.66], timpani: true, dur: 0.34 }, // Gm
        { root: 110.00, bass: 55.00, choir: [220.00, 277.18, 329.63], timpani: true, dur: 0.34 }, // A major
        { root: 110.00, bass: 55.00, choir: [277.18, 329.63, 440.0],  timpani: true, dur: 0.45 }, // A7
      ],
      // Movement 2: Cathedral Choir Escalation
      [
        { root: 146.83, bass: 73.42, choir: [349.23, 440.0, 587.33], timpani: true, dur: 0.4 },
        { root: 174.61, bass: 87.31, choir: [392.00, 523.25, 659.25], timpani: false, dur: 0.4 },
        { root: 116.54, bass: 58.27, choir: [293.66, 349.23, 466.16], timpani: true, dur: 0.4 },
        { root: 110.00, bass: 55.00, choir: [277.18, 329.63, 554.37], timpani: true, dur: 0.6 },
      ],
      // Movement 3: Suspense Tense Breather
      [
        { root: 73.42, bass: 36.71, choir: [146.83, 220.00], timpani: false, dur: 1.2 },
        { root: 55.00, bass: 27.50, choir: [110.00, 164.81], timpani: true, dur: 1.4 },
      ],
    ];

    let mIdx = 0;
    let sIdx = 0;

    const playBossStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const currentMovement = battleMovements[mIdx];
      const step = currentMovement[sIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Filtered Staccato Cello Strings (No shrill trebles)
        const strOsc = this.ctx.createOscillator();
        const strFilter = this.ctx.createBiquadFilter();
        const strGain = this.ctx.createGain();

        strOsc.type = 'sawtooth';
        strOsc.frequency.setValueAtTime(step.root, now);

        strFilter.type = 'lowpass';
        strFilter.frequency.setValueAtTime(1100, now);
        strFilter.Q.setValueAtTime(1.2, now);

        strGain.gain.setValueAtTime(0.0001, now);
        strGain.gain.linearRampToValueAtTime(0.16, now + 0.01);
        strGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.9);

        strOsc.connect(strFilter);
        strFilter.connect(strGain);
        this.connectMusic(strGain);

        strOsc.start(now);
        strOsc.stop(now + dur * 0.9);

        // Vocal Choir Formants
        step.choir.forEach((freq) => {
          if (!this.ctx) return;
          const choirOsc = this.ctx.createOscillator();
          const choirFilter = this.ctx.createBiquadFilter();
          const choirGain = this.ctx.createGain();

          choirOsc.type = 'triangle';
          choirOsc.frequency.setValueAtTime(freq, now);

          choirFilter.type = 'bandpass';
          choirFilter.frequency.setValueAtTime(700, now);
          choirFilter.Q.setValueAtTime(2.5, now);

          choirGain.gain.setValueAtTime(0.0001, now);
          choirGain.gain.linearRampToValueAtTime(0.075, now + 0.08);
          choirGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.1);

          choirOsc.connect(choirFilter);
          choirFilter.connect(choirGain);
          this.connectMusic(choirGain);

          choirOsc.start(now);
          choirOsc.stop(now + dur * 1.1);
        });

        // Heavy Timpani Strike
        if (step.timpani) {
          const timpOsc = this.ctx.createOscillator();
          const timpGain = this.ctx.createGain();
          timpOsc.type = 'sine';
          timpOsc.frequency.setValueAtTime(85, now);
          timpOsc.frequency.exponentialRampToValueAtTime(32, now + 0.24);

          timpGain.gain.setValueAtTime(0.0001, now);
          timpGain.gain.linearRampToValueAtTime(0.28, now + 0.008);
          timpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

          timpOsc.connect(timpGain);
          this.connectMusic(timpGain);
          timpOsc.start(now);
          timpOsc.stop(now + 0.25);
        }
      } catch (e) {}

      sIdx++;
      if (sIdx >= currentMovement.length) {
        sIdx = 0;
        mIdx = (mIdx + 1) % battleMovements.length;
      }

      this.scheduleMusicStep(sessionId, playBossStep, dur * 930);
    };

    playBossStep();
  }

  /**
   * 7. RESTRAINED LUCY: THE CHAINED BEAST (SUBDUED TENSION)
   * Dark, low-frequency atmospheric tension with heavy muted heartbeat pulse,
   * distant ominous cathedral bell toll, and bowing cello harmonics.
   */
  private startRestrainedLucyMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const pattern = [
      { bass: 41.2, bell: 220, dur: 1.8, chord: [82.41, 123.47] },
      { bass: 43.65, bell: 0, dur: 1.6, chord: [87.31, 130.81] },
      { bass: 38.89, bell: 196, dur: 1.8, chord: [77.78, 116.54] },
      { bass: 41.2, bell: 0, dur: 2.2, chord: [82.41, 110.00] },
    ];

    let pIdx = 0;
    const playStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const step = pattern[pIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Deep sub drone
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(step.bass, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.2);

        osc.connect(filter);
        filter.connect(gain);
        this.connectMusic(gain);

        osc.start(now);
        osc.stop(now + dur * 1.2);

        // Distant cathedral bell
        if (step.bell > 0) {
          const bellOsc = this.ctx.createOscillator();
          const bellFilter = this.ctx.createBiquadFilter();
          const bellGain = this.ctx.createGain();

          bellOsc.type = 'sine';
          bellOsc.frequency.setValueAtTime(step.bell, now);

          bellFilter.type = 'lowpass';
          bellFilter.frequency.setValueAtTime(900, now);

          bellGain.gain.setValueAtTime(0.0001, now);
          bellGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
          bellGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.4);

          bellOsc.connect(bellFilter);
          bellFilter.connect(bellGain);
          this.connectMusic(bellGain);

          bellOsc.start(now);
          bellOsc.stop(now + dur * 1.4);
        }
      } catch (e) {}

      pIdx++;
      if (pIdx >= pattern.length) {
        pIdx = 0;
        if (this.breathingPausesEnabled) {
          this.playAmbientDrone(4.0);
          this.scheduleMusicStep(sessionId, playStep, 4200);
          return;
        }
      }

      this.scheduleMusicStep(sessionId, playStep, dur * 950);
    };

    playStep();
  }

  /**
   * 8. DIRECTOR KURAMA: REMORSE (SYMPHONIC ELEGY)
   * Poignant, heart-rending classical piano arpeggios and warm sustained cello.
   * Evokes Kurama's tragic fatherly devotion, sorrow, and sacrifice.
   */
  private startKuramaElegyMusic(sessionId: number, onCycleComplete?: () => void) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    // A minor -> F major -> C major -> G major (Classic mournful elegy)
    const notes = [
      // Am
      { note: 220.0, bass: 55.0, dur: 0.9 },
      { note: 261.63, bass: 110.0, dur: 0.8 },
      { note: 329.63, bass: 0, dur: 0.8 },
      { note: 440.0, bass: 0, dur: 1.4 },
      // F
      { note: 174.61, bass: 43.65, dur: 0.9 },
      { note: 261.63, bass: 87.31, dur: 0.8 },
      { note: 349.23, bass: 0, dur: 0.8 },
      { note: 440.0, bass: 0, dur: 1.4 },
      // C
      { note: 261.63, bass: 65.41, dur: 0.9 },
      { note: 329.63, bass: 130.81, dur: 0.8 },
      { note: 392.0, bass: 0, dur: 0.8 },
      { note: 523.25, bass: 0, dur: 1.4 },
      // G/E
      { note: 196.0, bass: 49.0, dur: 0.9 },
      { note: 246.94, bass: 98.0, dur: 0.8 },
      { note: 293.66, bass: 0, dur: 0.8 },
      { note: 392.0, bass: 0, dur: 1.8 },
    ];

    let nIdx = 0;
    const playPianoStep = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const step = notes[nIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Warm felt piano note
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(step.note, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.5);

        osc.connect(filter);
        filter.connect(gain);
        this.connectMusic(gain);

        osc.start(now);
        osc.stop(now + dur * 1.5);

        // Warm cello bass
        if (step.bass > 0) {
          const bassOsc = this.ctx.createOscillator();
          const bassFilter = this.ctx.createBiquadFilter();
          const bassGain = this.ctx.createGain();

          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(step.bass, now);

          bassFilter.type = 'lowpass';
          bassFilter.frequency.setValueAtTime(320, now);

          bassGain.gain.setValueAtTime(0.0001, now);
          bassGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 2.0);

          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          this.connectMusic(bassGain);

          bassOsc.start(now);
          bassOsc.stop(now + dur * 2.0);
        }
      } catch (e) {}

      nIdx++;
      if (nIdx >= notes.length) {
        nIdx = 0;
        if (onCycleComplete) {
          onCycleComplete();
          return;
        }
        if (this.breathingPausesEnabled) {
          this.playAmbientDrone(4.5);
          this.scheduleMusicStep(sessionId, playPianoStep, 4800);
          return;
        }
      }

      this.scheduleMusicStep(sessionId, playPianoStep, dur * 920);
    };

    playPianoStep();
  }

  /**
   * 9. ANNA KAKUZAWA: THE SINGULARITY (COSMIC CHORAL DRONE)
   * Meditative, transcendental vocal pads, deep celestial drone, and microtonal shimmer.
   */
  private startSingularityMusic(sessionId: number) {
    if (!this.ctx || !this.isMusicPlaying || sessionId !== this.musicSessionId) return;

    const chords = [
      { bass: 55.0, formants: [220, 277.18, 329.63, 440], dur: 3.2 },
      { bass: 43.65, formants: [174.61, 261.63, 349.23, 523.25], dur: 3.2 },
      { bass: 49.0, formants: [196.0, 246.94, 293.66, 392.0], dur: 3.2 },
      { bass: 65.41, formants: [261.63, 329.63, 392.0, 523.25], dur: 3.6 },
    ];

    let cIdx = 0;
    const playChoralSwell = () => {
      if (sessionId !== this.musicSessionId || !this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const step = chords[cIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Deep sub drone
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(step.bass, now);

        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(0.12, now + 0.6);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.1);

        subOsc.connect(subGain);
        this.connectMusic(subGain);
        subOsc.start(now);
        subOsc.stop(now + dur * 1.1);

        // Vocal Choir Chord
        step.formants.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(520, now);
          filter.Q.setValueAtTime(1.8, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.045, now + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.15);

          osc.connect(filter);
          filter.connect(gain);
          this.connectMusic(gain);

          osc.start(now);
          osc.stop(now + dur * 1.15);
        });
      } catch (e) {}

      cIdx++;
      if (cIdx >= chords.length) {
        cIdx = 0;
      }

      this.scheduleMusicStep(sessionId, playChoralSwell, dur * 900);
    };

    playChoralSwell();
  }

  public playVectorSlash() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastVectorSoundTime < 85) return;
    this.lastVectorSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, now);
      filter.Q.setValueAtTime(0.8, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {}
  }

  /**
   * Vector Swarm / Psychic vortex
   */
  public playVectorSwarm() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  /**
   * Vector Clash / Kinetic Shield Parry
   * Replaced harsh trebles with warm, deep bronze shield resonance.
   */
  public playVectorClash() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastClashSoundTime < 110) return;
    this.lastClashSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(340, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.16);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(680, now);
      osc2.frequency.exponentialRampToValueAtTime(280, now + 0.13);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.16);
      osc2.stop(now + 0.16);
    } catch (e) {}
  }

  /**
   * Bando Firearms: Heavy Shotgun Boom
   */
  public playShotgun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Lowpass filtered noise blast
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.22);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.42, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      // Deep sub-bass kick
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);

      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.45, now + 0.005);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      noise.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.connect(oscGain);
      this.connectSfx(oscGain);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.22);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  /**
   * Tactical Firearm: Pistol gunshot (muffled mechanical punch)
   */
  public playPistol() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  /**
   * Bando Firearms: Minigun Vulcan Fast Rap
   */
  public playMinigun() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastMinigunSoundTime < 38) return;
    this.lastMinigunSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  /**
   * Bando Cybernetics: Rocket Launch & Whoosh
   */
  public playRocketLaunch() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  /**
   * Bando Sniper Railgun (Deep concussive kinetic discharge)
   * Removed abrasive raw 1200Hz square wave.
   */
  public playRailgun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.Q.setValueAtTime(1.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  /**
   * Anti-vector high-frequency laser (Warm focus beam)
   */
  public playLaser() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {}
  }

  /**
   * Gore squelch / hit sound with rate-limiting to prevent volume explosion on swarm kills
   */
  public playGoreHit() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastGoreSoundTime < 75) return;
    this.lastGoreSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  /**
   * Deflection shield ping (warm crystal resonance)
   * Replaced screeching 980Hz ping with soft 340Hz kinetic ricochet.
   */
  public playDeflection() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastDeflectSoundTime < 85) return;
    this.lastDeflectSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  /**
   * DNA / XP pickup chime
   * Soft, organic droplet tone instead of piercing ping.
   */
  public playDnaPickup() {
    if (!this.canPlaySfx()) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastDnaSoundTime < 65) return;
    this.lastDnaSoundTime = nowPerf;

    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(392, now + 0.06);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  /**
   * Level Up fanfarish chord
   */
  public playLevelUp() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [392.0, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        this.connectSfx(gain);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch (e) {}
  }

  /**
   * Explosion sound (Deep cinematic rumble)
   */
  public playExplosion() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.35);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.42, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  /**
   * Special ability trigger sound
   */
  public playSpecialAbility() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.45);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * UI Click (Smooth bubble click)
   */
  public playUiClick() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  /**
   * Wave Complete Chime
   */
  public playWaveComplete() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        osc.connect(gain);
        this.connectSfx(gain);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch (e) {}
  }

  /**
   * Synergy Unlocked
   */
  public playSynergyUnlocked() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [293.66, 369.99, 440, 587.33];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.07;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        this.connectSfx(gain);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch (e) {}
  }

  /**
   * Metal Clank
   */
  public playMetalClank() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  /**
   * Tactical Helicopter Rotor Blade Thump
   */
  public playHelicopterRotor(volume: number = 0.5) {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.09);

      const effectiveVol = Math.max(0.04, Math.min(0.6, volume * 0.5));
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(effectiveVol, now + 0.005);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(oscGain);
      this.connectSfx(oscGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  /**
   * Weapon Mechanical Reload
   */
  public playReloadClick() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  /**
   * Tactical Dropship Inbound Alert
   */
  public playDropshipAlarm() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(420, now + 0.15);
      osc.frequency.linearRampToValueAtTime(320, now + 0.3);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  /**
   * Helicopter Cover Fire Minigun Burst
   */
  public playHelicopterMinigun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const rounds = 3;
      for (let i = 0; i < rounds; i++) {
        const time = this.ctx.currentTime + i * 0.06;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, time);
        osc.frequency.exponentialRampToValueAtTime(55, time + 0.045);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.22, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        this.connectSfx(gain);

        osc.start(time);
        osc.stop(time + 0.05);
      }
    } catch (e) {}
  }

  /**
   * Helicopter Shot Down Crash
   */
  public playHelicopterCrash() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();

      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(120, now);
      boomOsc.frequency.exponentialRampToValueAtTime(24, now + 0.9);

      boomGain.gain.setValueAtTime(0.0001, now);
      boomGain.gain.linearRampToValueAtTime(0.55, now + 0.01);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      boomOsc.connect(boomGain);
      this.connectSfx(boomGain);

      boomOsc.start(now);
      boomOsc.stop(now + 0.9);
    } catch (e) {}
  }

  /**
   * Vector Guard Shatter / Posture Break
   */
  public playGuardBreak() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const shatterOsc = this.ctx.createOscillator();
      const shatterFilter = this.ctx.createBiquadFilter();
      const shatterGain = this.ctx.createGain();

      shatterOsc.type = 'triangle';
      shatterOsc.frequency.setValueAtTime(460, now);
      shatterOsc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

      shatterFilter.type = 'lowpass';
      shatterFilter.frequency.setValueAtTime(900, now);

      shatterGain.gain.setValueAtTime(0.0001, now);
      shatterGain.gain.linearRampToValueAtTime(0.24, now + 0.005);
      shatterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      shatterOsc.connect(shatterFilter);
      shatterFilter.connect(shatterGain);
      this.connectSfx(shatterGain);

      shatterOsc.start(now);
      shatterOsc.stop(now + 0.35);

      // Concussive impact boom
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(180, now);
      boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.5);

      boomGain.gain.setValueAtTime(0.0001, now);
      boomGain.gain.linearRampToValueAtTime(0.48, now + 0.008);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      boomOsc.connect(boomGain);
      this.connectSfx(boomGain);

      boomOsc.start(now);
      boomOsc.stop(now + 0.5);
    } catch (e) {}
  }

  /**
   * Character Dash Sound
   */
  public playDash(characterId: string = 'lucy') {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (characterId === 'bando') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        filter.frequency.setValueAtTime(900, now);
      } else if (characterId === 'mariko') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
        filter.frequency.setValueAtTime(1400, now);
      } else if (characterId === 'nana') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        filter.frequency.setValueAtTime(1200, now);
      } else {
        // Lucy: Smooth kinetic whoosh
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
        filter.frequency.setValueAtTime(1600, now);
      }

      filter.type = 'lowpass';
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  /**
   * Boss Ground Shockwave / Vector Slam
   */
  public playBossShockwave() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.48, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      this.connectSfx(gain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * Character Unlocked Fanfare
   */
  public playCharacterUnlocked() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const chords = [
        [220, 277.18, 329.63], // A major
        [293.66, 369.99, 440], // D major
        [329.63, 415.3, 493.88], // E major
        [440, 554.37, 659.25, 880], // A grand
      ];
      chords.forEach((chord, stepIdx) => {
        const stepTime = this.ctx!.currentTime + stepIdx * 0.16;
        chord.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, stepTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1800, stepTime);

          gain.gain.setValueAtTime(0.0001, stepTime);
          gain.gain.linearRampToValueAtTime(0.22, stepTime + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, stepTime + 0.55);

          osc.connect(filter);
          filter.connect(gain);
          this.connectSfx(gain);

          osc.start(stepTime);
          osc.stop(stepTime + 0.55);
        });
      });
    } catch (e) {}
  }

  /**
   * Heartbeat pulse for low HP
   */
  public playHeartbeat() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    const nowTime = Date.now();
    if (nowTime - this.lastHeartbeatTime < 750) return;
    this.lastHeartbeatTime = nowTime;

    try {
      const t = this.ctx.currentTime;
      // Lub
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(60, t);
      osc1.frequency.exponentialRampToValueAtTime(30, t + 0.14);

      gain1.gain.setValueAtTime(0.0001, t);
      gain1.gain.linearRampToValueAtTime(0.38, t + 0.008);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      osc1.connect(gain1);
      this.connectSfx(gain1);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // Dub
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(50, t + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(26, t + 0.32);

      gain2.gain.setValueAtTime(0.0001, t + 0.18);
      gain2.gain.linearRampToValueAtTime(0.30, t + 0.188);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.33);

      osc2.connect(gain2);
      this.connectSfx(gain2);
      osc2.start(t + 0.18);
      osc2.stop(t + 0.33);
    } catch (e) {}
  }

  /**
   * Tactical SAT Squad Radio Alert
   */
  public playRadioAlert() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(650, t + 0.06);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, t);
      filter.Q.setValueAtTime(2.0, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      this.connectSfx(gain);

      osc.start(t);
      osc.stop(t + 0.18);
    } catch (e) {}
  }

  /**
   * Adrenaline Surge Chime
   */
  public playSurgeChime(level: number) {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const baseFreq = level === 1 ? 523.25 : level === 2 ? 659.25 : 783.99;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, t + 0.2);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

      osc.connect(gain);
      this.connectSfx(gain);

      osc.start(t);
      osc.stop(t + 0.28);
    } catch (e) {}
  }

  /**
   * Catalytic Weapon Evolution Fanfare
   */
  public playEvolutionFanfare() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const freqs = [220, 277.18, 329.63, 440, 554.37, 659.25, 880];
      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        const filter = this.ctx!.createBiquadFilter();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t + idx * 0.08);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t + idx * 0.08);

        gain.gain.setValueAtTime(0.0001, t + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.20, t + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.08 + 0.9);

        osc.connect(filter);
        filter.connect(gain);
        this.connectSfx(gain);

        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.95);
      });
    } catch (e) {}
  }

  /**
   * Bagged Materials Cashback Sound
   */
  public playBaggedCashback() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, t);
      osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.14);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(gain);
      this.connectSfx(gain);

      osc.start(t);
      osc.stop(t + 0.16);
    } catch (e) {}
  }
}

export const sound = new SoundEngine();

// Rescanning the player's folder can change the list out from under the transport, so the
// engine is wired to it once here rather than every component that triggers a refresh
// having to remember to tell it.
onPlayerTracksChanged(() => sound.onPlayerLibraryChanged());
