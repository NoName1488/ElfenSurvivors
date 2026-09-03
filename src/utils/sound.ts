/**
 * Web Audio API procedural sound synthesizer for Elfen Lied: Vector Survivor
 * Generates dynamic retro/anime sci-fi sound effects, heavy firearms for Bando, and the Lilium music box theme.
 */

const AUDIO_SETTINGS_KEY = 'elfen_lied_audio_settings';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicMuted: boolean = false;
  private sfxMuted: boolean = false;
  private musicVolume: number = 0.35;
  private sfxVolume: number = 0.6;
  private musicInterval: any = null;
  private isMusicPlaying: boolean = false;
  private listeners: (() => void)[] = [];

  constructor() {
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
        })
      );
    } catch (e) {}
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

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private currentCharacterId: string = 'lucy';
  private distortionCurve: Float32Array | null = null;

  private makeDistortionCurve(amount: number = 50) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const drive = Math.max(1, amount / 10);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // High-grade hyperbolic tangent distortion with tube-like soft clipping
      curve[i] = Math.tanh(x * drive);
    }
    return curve;
  }

  public enableAudio() {
    this.init();
    if (!this.isMusicPlaying && this.canPlayMusic()) {
      this.startMusic();
    }
  }

  public setCharacter(characterId: string) {
    if (this.currentCharacterId === characterId && this.isMusicPlaying) return;
    this.currentCharacterId = characterId;
    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startMusic();
    }
  }

  public startBossBattle() {
    this.currentTrack = 'boss_battle';
    if (this.isMusicPlaying) {
      this.stopMusic();
    }
    this.startMusic();
  }

  public endBossBattle() {
    this.currentTrack = 'hero_theme';
    if (this.isMusicPlaying) {
      this.stopMusic();
    }
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

  private currentTrack: string = 'hero_theme';

  public getTrack() {
    return this.currentTrack;
  }

  public setTrack(track: string) {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startMusic();
    }
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
    if (this.isMusicPlaying || !this.canPlayMusic()) return;
    this.init();
    if (!this.ctx) return;

    this.isMusicPlaying = true;

    if (this.currentTrack === 'boss_battle') {
      this.startBossBattleMusic();
    } else if (this.currentTrack === 'lilium') {
      this.startLiliumMusic();
    } else {
      // Authentic character-specific Elfen Lied OST themes
      if (this.currentCharacterId === 'nyu') {
        this.startNyuDreamMusic(); // Lilium Music Box & Gentle Lullaby
      } else if (this.currentCharacterId === 'nana') {
        this.startNanaMelancholyMusic(); // Shinjitsu - Emotional strings of hope
      } else if (this.currentCharacterId === 'bando') {
        this.startBandoTacticalMusic(); // Heavy tactical assault & sirens
      } else if (this.currentCharacterId === 'mariko') {
        this.startMarikoDissonanceMusic(); // No. 35 - Dissonant choral requiem
      } else {
        // Lucy & Default: The legendary "Lilium" Hymn with choir formants & pipe organ
        this.startLiliumMusic();
      }
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  // ==========================================
  // 2. NYU: INNOCENT DREAM LULLABY MUSIC BOX
  // ==========================================
  private startNyuDreamMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    // Sweet pentatonic soothing music box
    const melody = [
      { note: 523.25, dur: 0.5 }, // C5
      { note: 659.25, dur: 0.5 }, // E5
      { note: 783.99, dur: 0.5 }, // G5
      { note: 1046.5, dur: 0.8 }, // C6
      { note: 880.0, dur: 0.5 }, // A5
      { note: 783.99, dur: 0.5 }, // G5
      { note: 659.25, dur: 1.0 }, // E5

      { note: 587.33, dur: 0.5 }, // D5
      { note: 659.25, dur: 0.5 }, // E5
      { note: 783.99, dur: 0.5 }, // G5
      { note: 880.0, dur: 0.8 }, // A5
      { note: 783.99, dur: 0.5 }, // G5
      { note: 659.25, dur: 0.5 }, // E5
      { note: 523.25, dur: 1.2 }, // C5
    ];

    let noteIndex = 0;

    const playNyuNote = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const item = melody[noteIndex];
      const now = this.ctx.currentTime;

      // Pure crystal glass bell tone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(item.note, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(item.note * 2.01, now); // Gentle shimmer

      gain.gain.setValueAtTime(0.2 * this.musicVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + item.dur * 1.8);
      osc2.stop(now + item.dur * 1.8);

      noteIndex = (noteIndex + 1) % melody.length;
      this.musicInterval = setTimeout(playNyuNote, item.dur * 900);
    };

    playNyuNote();
  }

  // ==========================================
  // 3. NANA: MELANCHOLY STRINGS & PROTECT SYNTH
  // ==========================================
  private startNanaMelancholyMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    // Em, C, G, D warm cello & violin progression
    const chords = [
      { bass: 82.41, notes: [164.81, 246.94, 329.63, 392.0], dur: 1.8 }, // Em
      { bass: 65.41, notes: [130.81, 261.63, 329.63, 392.0], dur: 1.8 }, // C
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0], dur: 1.8 }, // G
      { bass: 73.42, notes: [146.83, 220.0, 293.66, 369.99], dur: 1.8 }, // D
      { bass: 82.41, notes: [164.81, 261.63, 329.63, 440.0], dur: 1.8 }, // Am/E
      { bass: 61.74, notes: [123.47, 246.94, 311.13, 369.99], dur: 1.8 }, // B7
    ];

    let chordIndex = 0;

    const playNanaChord = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const chord = chords[chordIndex];
      const now = this.ctx.currentTime;

      // Soft bowing strings pad
      chord.notes.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.06 * this.musicVolume, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + chord.dur * 1.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + chord.dur * 1.1);
      });

      // Warm cello sub-bass
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(chord.bass, now);
      bassGain.gain.setValueAtTime(0.12 * this.musicVolume, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + chord.dur);
      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + chord.dur);

      chordIndex = (chordIndex + 1) % chords.length;
      this.musicInterval = setTimeout(playNanaChord, chord.dur * 950);
    };

    playNanaChord();
  }

  // ==========================================
  // 4. MARIKO: GOLDEN DISSONANCE & HIGH TENSION STRINGS
  // ==========================================
  private startMarikoDissonanceMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    // Rapid high frequency staccato arpeggio with unsettling tritone tension
    const notes = [
      { f: 880.0, dur: 0.18 }, // A5
      { f: 932.33, dur: 0.18 }, // Bb5 (Minor 2nd dissonance)
      { f: 880.0, dur: 0.18 },
      { f: 1244.51, dur: 0.22 }, // Eb6 (Tritone panic)
      { f: 1174.66, dur: 0.18 }, // D6
      { f: 880.0, dur: 0.18 },
      { f: 698.46, dur: 0.25 }, // F5
      { f: 659.25, dur: 0.3 }, // E5
    ];

    let noteIdx = 0;

    const playMarikoStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;
      const item = notes[noteIdx];
      const now = this.ctx.currentTime;

      // High-tension glass bell & staccato wire
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(item.f, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(400, now);

      gain.gain.setValueAtTime(0.14 * this.musicVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + item.dur * 1.2);

      // Low ominous stasis pulse on beat 0
      if (noteIdx === 0) {
        const drone = this.ctx.createOscillator();
        const droneGain = this.ctx.createGain();
        drone.type = 'sine';
        drone.frequency.setValueAtTime(55.0, now); // A1
        droneGain.gain.setValueAtTime(0.2 * this.musicVolume, now);
        droneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        drone.connect(droneGain);
        droneGain.connect(this.ctx.destination);
        drone.start(now);
        drone.stop(now + 1.2);
      }

      noteIdx = (noteIdx + 1) % notes.length;
      this.musicInterval = setTimeout(playMarikoStep, item.dur * 900);
    };

    playMarikoStep();
  }

  // ==========================================
  // 5. LUCY / DEFAULT: GOTHIC REQUIEM (LILIUM)
  // ==========================================
  private startLiliumMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    // Lilium melody notes in Hz (Music Box tone + Deep Organ Pad)
    const melody = [
      { note: 440.0, bass: 110.0, dur: 0.6 }, // A4
      { note: 523.25, bass: 110.0, dur: 0.6 }, // C5
      { note: 659.25, bass: 110.0, dur: 0.8 }, // E5
      { note: 587.33, bass: 98.0, dur: 0.6 }, // D5
      { note: 523.25, bass: 98.0, dur: 0.6 }, // C5
      { note: 493.88, bass: 82.41, dur: 1.0 }, // B4
      { note: 392.0, bass: 82.41, dur: 0.6 }, // G4
      { note: 440.0, bass: 110.0, dur: 1.4 }, // A4

      { note: 440.0, bass: 110.0, dur: 0.6 }, // A4
      { note: 523.25, bass: 110.0, dur: 0.6 }, // C5
      { note: 659.25, bass: 110.0, dur: 0.8 }, // E5
      { note: 783.99, bass: 130.81, dur: 0.8 }, // G5
      { note: 659.25, bass: 130.81, dur: 0.6 }, // E5
      { note: 587.33, bass: 98.0, dur: 1.2 }, // D5

      { note: 523.25, bass: 110.0, dur: 0.6 }, // C5
      { note: 587.33, bass: 98.0, dur: 0.6 }, // D5
      { note: 659.25, bass: 110.0, dur: 0.8 }, // E5
      { note: 523.25, bass: 87.31, dur: 0.6 }, // C5
      { note: 440.0, bass: 110.0, dur: 0.8 }, // A4
      { note: 392.0, bass: 82.41, dur: 0.6 }, // G4
      { note: 440.0, bass: 110.0, dur: 1.8 }, // A4
    ];

    let noteIndex = 0;

    const playNextNote = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;

      const item = melody[noteIndex];
      const now = this.ctx.currentTime;

      // Music box bell timbre (Sine with gentle harmonics)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(item.note, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(item.note * 2, now); // Octave overtone

      const noteVolume = 0.22 * this.musicVolume;
      gain.gain.setValueAtTime(noteVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + item.dur * 1.5);
      osc2.stop(now + item.dur * 1.5);

      // Deep gothic organ bass pedal
      if (item.bass) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(item.bass, now);
        bassGain.gain.setValueAtTime(0.09 * this.musicVolume, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + item.dur * 1.4);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + item.dur * 1.4);
      }

      noteIndex = (noteIndex + 1) % melody.length;
      this.musicInterval = setTimeout(playNextNote, item.dur * 900);
    };

    playNextNote();
  }

  private lastVectorSoundTime = 0;

  // Play a procedural vector slice sound
  public playVectorSlash() {
    if (!this.canPlaySfx()) return;
    const perfNow = performance.now();
    if (perfNow - this.lastVectorSoundTime < 45) return;
    this.lastVectorSoundTime = perfNow;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(3, now);

      gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Bando Firearms: Heavy Shotgun Boom
  public playShotgun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // White noise explosion burst
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      // Low frequency punch
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
      oscGain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.25);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  // Tactical Firearm: Pistol gunshot
  public playPistol() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // Bando Firearms: Minigun Vulcan Fast Rap
  public playMinigun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);

      gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  // Bando Cybernetics: Rocket Launch & Whoosh
  public playRocketLaunch() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.2);

      gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Bando Sniper Railgun
  public playRailgun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

      gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // Anti-vector high-frequency laser
  public playLaser() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // Gore squelch / hit sound
  public playGoreHit() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

      gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  // Deflection shield ping
  public playDeflection() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

      gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // DNA / XP pickup chime
  public playDnaPickup() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // Level Up fanfarish chord
  public playLevelUp() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch (e) {}
  }

  // Explosion sound
  public playExplosion() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

      gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  // Special ability trigger sound
  public playSpecialAbility() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);

      gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  // UI Click
  public playUiClick() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // Wave Complete Warning Chime
  public playWaveComplete() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch (e) {}
  }

  // Synergy Unlocked Fanfare
  public playSynergyUnlocked() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.07;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
      });
    } catch (e) {}
  }

  // Metal Clank / Armor Deflection Sound
  public playMetalClank() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

      gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  // Tactical Helicopter Rotor Blade Thump
  public playHelicopterRotor(volume: number = 0.5) {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // 1. Low Frequency Sub-bass Chopper Blade Pulse
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);

      const effectiveVol = Math.max(0.05, Math.min(0.9, volume * this.sfxVolume * 0.7));
      oscGain.gain.setValueAtTime(effectiveVol, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

      // 2. Rotor Blade Air Displacement Noise
      const bufferSize = this.ctx.sampleRate * 0.07;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(220, now);
      filter.Q.setValueAtTime(2.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(effectiveVol * 0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch (e) {}
  }

  // Weapon Mechanical Reload & Magazine Click
  public playReloadClick() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Eject click
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(900, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain1.gain.setValueAtTime(0.3 * this.sfxVolume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      // Lock slide click
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1400, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain2.gain.setValueAtTime(0.25 * this.sfxVolume, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.1);
    } catch (e) {}
  }

  // Tactical Dropship Inbound Alert
  public playDropshipAlarm() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.15);
      osc.frequency.linearRampToValueAtTime(320, now + 0.3);

      gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  // Helicopter Cover Fire Minigun Burst
  public playHelicopterMinigun() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const rounds = 4;
      for (let i = 0; i < rounds; i++) {
        const time = this.ctx.currentTime + i * 0.055;
        const osc = this.ctx.createOscillator();
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        // Mechanical punch
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, time);
        osc.frequency.exponentialRampToValueAtTime(60, time + 0.04);

        gain.gain.setValueAtTime(0.28 * this.sfxVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.05);
      }
    } catch (e) {}
  }

  // Helicopter Shot Down & Crash Explosion
  public playHelicopterCrash() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Metal screech
      const metalOsc = this.ctx.createOscillator();
      const metalGain = this.ctx.createGain();
      metalOsc.type = 'sawtooth';
      metalOsc.frequency.setValueAtTime(800, now);
      metalOsc.frequency.exponentialRampToValueAtTime(120, now + 0.5);
      metalGain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      metalOsc.connect(metalGain);
      metalGain.connect(this.ctx.destination);
      metalOsc.start(now);
      metalOsc.stop(now + 0.5);

      // 2. Heavy Detonation Sub-Boom
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(140, now + 0.1);
      boomOsc.frequency.exponentialRampToValueAtTime(25, now + 1.2);
      boomGain.gain.setValueAtTime(0.7 * this.sfxVolume, now + 0.1);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      boomOsc.connect(boomGain);
      boomGain.connect(this.ctx.destination);
      boomOsc.start(now + 0.1);
      boomOsc.stop(now + 1.2);
    } catch (e) {}
  }

  // Boss Vector Clash / Kinetic Shield Parry
  public playVectorClash() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // High frequency kinetic resonance with metallic ring
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(2200, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 0.12);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(3200, now);
      osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.16);

      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(1200, now);
      osc3.frequency.exponentialRampToValueAtTime(350, now + 0.18);

      gain.gain.setValueAtTime(0.42 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
      osc3.stop(now + 0.18);
    } catch (e) {}
  }

  // Vector Guard Shatter / Posture Break
  public playGuardBreak() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // 1. Crystal shatter high pitch
      const shatterOsc = this.ctx.createOscillator();
      const shatterGain = this.ctx.createGain();
      shatterOsc.type = 'sawtooth';
      shatterOsc.frequency.setValueAtTime(3500, now);
      shatterOsc.frequency.exponentialRampToValueAtTime(400, now + 0.45);
      shatterGain.gain.setValueAtTime(0.6 * this.sfxVolume, now);
      shatterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      shatterOsc.connect(shatterGain);
      shatterGain.connect(this.ctx.destination);
      shatterOsc.start(now);
      shatterOsc.stop(now + 0.45);

      // 2. Heavy concussive impact boom
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(220, now);
      boomOsc.frequency.exponentialRampToValueAtTime(30, now + 0.7);
      boomGain.gain.setValueAtTime(0.7 * this.sfxVolume, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      boomOsc.connect(boomGain);
      boomGain.connect(this.ctx.destination);
      boomOsc.start(now);
      boomOsc.stop(now + 0.7);
    } catch (e) {}
  }

  // Lore-justified Mobility / Dash audio per character
  public playDash(characterId: string = 'lucy') {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      if (characterId === 'bando') {
        // Tactical combat roll + gear shift
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);
        gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (characterId === 'mariko') {
        // Hydraulic pneumatic booster hiss + screech
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.28);
        gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (characterId === 'nana') {
        // Vector vault whoosh + elastic snap
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(400, now);
        osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.14);
        osc1.frequency.exponentialRampToValueAtTime(300, now + 0.26);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(180, now + 0.26);

        gain.gain.setValueAtTime(0.38 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.26);
        osc2.stop(now + 0.26);
      } else if (characterId === 'nyu') {
        // Clumsy tumble + repulsive shockwave puff
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.32);
        gain.gain.setValueAtTime(0.45 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } else {
        // Lucy: Supersonic telekinetic slice whoosh
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(1400, now);
        osc1.frequency.exponentialRampToValueAtTime(200, now + 0.24);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(900, now);
        osc2.frequency.exponentialRampToValueAtTime(140, now + 0.24);

        gain.gain.setValueAtTime(0.45 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.24);
        osc2.stop(now + 0.24);
      }
    } catch (e) {}
  }

  // Boss Ground Shockwave / Vector Slam
  public playBossShockwave() {
    if (!this.canPlaySfx()) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

      gain.gain.setValueAtTime(0.6 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  }

  // =========================================================================
  // 6. BOSS BATTLE: GOTHIC ANIME DUEL (INTENSE CHOIR & STACCATO STRINGS)
  // =========================================================================
  private startBossBattleMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    // D minor dramatic battle progression: Dm -> Bb -> Gm -> A7 -> Dm
    const chords = [
      { bass: 73.42, root: 146.83, choir: [293.66, 349.23, 440.0], dur: 0.32, timpani: true }, // Dm
      { bass: 73.42, root: 146.83, choir: [293.66, 349.23, 440.0], dur: 0.32, timpani: false },
      { bass: 73.42, root: 174.61, choir: [349.23, 440.0, 523.25], dur: 0.32, timpani: true }, // F
      { bass: 58.27, root: 116.54, choir: [233.08, 293.66, 349.23], dur: 0.32, timpani: true }, // Bb
      { bass: 58.27, root: 116.54, choir: [233.08, 293.66, 466.16], dur: 0.32, timpani: false },
      { bass: 49.00, root: 98.00,  choir: [196.00, 233.08, 293.66], dur: 0.32, timpani: true }, // Gm
      { bass: 55.00, root: 110.00, choir: [220.00, 277.18, 329.63], dur: 0.32, timpani: true }, // A major
      { bass: 55.00, root: 110.00, choir: [277.18, 329.63, 440.0], dur: 0.32, timpani: true }, // A7
    ];

    let chordIdx = 0;

    const playBossStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;

      const step = chords[chordIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Driving Staccato Strings (Sawtooth filtered)
        const strOsc = this.ctx.createOscillator();
        const strFilter = this.ctx.createBiquadFilter();
        const strGain = this.ctx.createGain();

        strOsc.type = 'sawtooth';
        strOsc.frequency.setValueAtTime(step.root, now);
        strFilter.type = 'lowpass';
        strFilter.frequency.setValueAtTime(1600, now);
        strFilter.Q.setValueAtTime(3.0, now);

        strGain.gain.setValueAtTime(0.18 * this.musicVolume, now);
        strGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);

        strOsc.connect(strFilter);
        strFilter.connect(strGain);
        strGain.connect(this.ctx.destination);

        strOsc.start(now);
        strOsc.stop(now + dur);

        // Gothic Battle Choir
        step.choir.forEach((freq) => {
          if (!this.ctx) return;
          const choirOsc = this.ctx.createOscillator();
          const choirFilter = this.ctx.createBiquadFilter();
          const choirGain = this.ctx.createGain();

          choirOsc.type = 'triangle';
          choirOsc.frequency.setValueAtTime(freq, now);

          // Vowel "Ah / Oh" formant simulation
          choirFilter.type = 'bandpass';
          choirFilter.frequency.setValueAtTime(750, now);
          choirFilter.Q.setValueAtTime(4.0, now);

          choirGain.gain.setValueAtTime(0.09 * this.musicVolume, now);
          choirGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);

          choirOsc.connect(choirFilter);
          choirFilter.connect(choirGain);
          choirGain.connect(this.ctx.destination);

          choirOsc.start(now);
          choirOsc.stop(now + dur * 1.2);
        });

        // Heavy Timpani Strike
        if (step.timpani) {
          const timpOsc = this.ctx.createOscillator();
          const timpGain = this.ctx.createGain();
          timpOsc.type = 'sine';
          timpOsc.frequency.setValueAtTime(90, now);
          timpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.25);

          timpGain.gain.setValueAtTime(0.35 * this.musicVolume, now);
          timpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          timpOsc.connect(timpGain);
          timpGain.connect(this.ctx.destination);
          timpOsc.start(now);
          timpOsc.stop(now + 0.25);
        }
      } catch (e) {}

      chordIdx = (chordIdx + 1) % chords.length;
      this.musicInterval = setTimeout(playBossStep, dur * 950);
    };

    playBossStep();
  }

  // =========================================================================
  // 7. BANDO: TACTICAL ASSAULT (MILITARY COMBAT BEAT & SIRENS)
  // =========================================================================
  private startBandoTacticalMusic() {
    if (!this.ctx || !this.isMusicPlaying) return;

    const pattern = [
      { bass: 55.0, kick: true, snare: false, siren: false, dur: 0.26 },
      { bass: 55.0, kick: false, snare: false, siren: false, dur: 0.26 },
      { bass: 55.0, kick: false, snare: true, siren: false, dur: 0.26 },
      { bass: 65.41, kick: true, snare: false, siren: false, dur: 0.26 },
      { bass: 55.0, kick: true, snare: false, siren: true, dur: 0.26 },
      { bass: 49.0, kick: false, snare: false, siren: false, dur: 0.26 },
      { bass: 55.0, kick: false, snare: true, siren: false, dur: 0.26 },
      { bass: 73.42, kick: true, snare: false, siren: false, dur: 0.26 },
    ];

    let stepIdx = 0;

    const playTacticalStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.canPlayMusic()) return;

      const step = pattern[stepIdx];
      const now = this.ctx.currentTime;
      const dur = step.dur;

      try {
        // Heavy Sub Synth Bass
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(step.bass, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        bassGain.gain.setValueAtTime(0.25 * this.musicVolume, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);

        bassOsc.connect(filter);
        filter.connect(bassGain);
        bassGain.connect(this.ctx.destination);

        bassOsc.start(now);
        bassOsc.stop(now + dur);

        // Kick
        if (step.kick) {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(140, now);
          kickOsc.frequency.exponentialRampToValueAtTime(32, now + 0.16);
          kickGain.gain.setValueAtTime(0.4 * this.musicVolume, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          kickOsc.connect(kickGain);
          kickGain.connect(this.ctx.destination);
          kickOsc.start(now);
          kickOsc.stop(now + 0.16);
        }

        // Snare
        if (step.snare) {
          const snareOsc = this.ctx.createOscillator();
          const snareGain = this.ctx.createGain();
          snareOsc.type = 'triangle';
          snareOsc.frequency.setValueAtTime(280, now);
          snareOsc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
          snareGain.gain.setValueAtTime(0.3 * this.musicVolume, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          snareOsc.connect(snareGain);
          snareGain.connect(this.ctx.destination);
          snareOsc.start(now);
          snareOsc.stop(now + 0.12);
        }

        // Tactical siren blip
        if (step.siren) {
          const sirenOsc = this.ctx.createOscillator();
          const sirenGain = this.ctx.createGain();
          sirenOsc.type = 'sawtooth';
          sirenOsc.frequency.setValueAtTime(880, now);
          sirenOsc.frequency.linearRampToValueAtTime(1100, now + 0.15);
          sirenGain.gain.setValueAtTime(0.12 * this.musicVolume, now);
          sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          sirenOsc.connect(sirenGain);
          sirenGain.connect(this.ctx.destination);
          sirenOsc.start(now);
          sirenOsc.stop(now + 0.2);
        }
      } catch (e) {}

      stepIdx = (stepIdx + 1) % pattern.length;
      this.musicInterval = setTimeout(playTacticalStep, dur * 950);
    };

    playTacticalStep();
  }

  // Character Unlocked Fanfare
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
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, stepTime);

          gain.gain.setValueAtTime(0.25 * this.sfxVolume, stepTime);
          gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.6);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(stepTime);
          osc.stop(stepTime + 0.6);
        });
      });
    } catch (e) {}
  }
}

export const sound = new SoundEngine();
