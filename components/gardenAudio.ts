"use client";

/**
 * gardenAudio.ts
 * ----------------------------------------------------------------------
 * Fully procedural ambient garden soundscape using the Web Audio API.
 * No external mp3/wav files needed — birdsong, cricket/insect chirps and
 * a soft wind bed are all synthesized at runtime.
 *
 * Usage:
 *   const audio = new GardenAudio();
 *   audio.start();   // must be called from a user gesture (click/tap)
 *   audio.stop();
 *   audio.setVolume(0.5);
 */

type TimeoutId = ReturnType<typeof setTimeout>;

export class GardenAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private timers: TimeoutId[] = [];
  private running = false;

  get isRunning() {
    return this.running;
  }

  /** Must be called from within a user interaction (click/tap) due to browser autoplay policies. */
  start(volume = 0.35) {
    if (this.running) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(this.ctx.destination);

    this.running = true;

    this.startWind();
    this.scheduleBirdChirp();
    this.scheduleCricketChirp();
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];

    this.windSource?.stop();
    this.windSource?.disconnect();
    this.windSource = null;

    this.master?.disconnect();
    this.master = null;

    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  toggle(volume?: number) {
    if (this.running) this.stop();
    else this.start(volume);
    return this.running;
  }

  setVolume(volume: number) {
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.ctx.currentTime + 0.2
      );
    }
  }

  // ---- internals -------------------------------------------------------

  private track(fn: () => void, delayMs: number) {
    const id = setTimeout(() => {
      if (this.running) fn();
    }, delayMs);
    this.timers.push(id);
  }

  /** Soft filtered noise bed that gently swells and fades, like a breeze through leaves. */
  private startWind() {
    const ctx = this.ctx!;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // brown-ish noise (integrated white noise) sounds softer than raw white noise
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 6;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.5;

    source.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.master!);
    source.start();

    this.windSource = source;

    // slow random swell so it doesn't sound like a static hiss
    const swell = () => {
      if (!this.running || !this.ctx) return;
      const target = 0.25 + Math.random() * 0.4;
      windGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 4);
      this.track(swell, 4000 + Math.random() * 3000);
    };
    swell();
  }

  /** Schedules short, randomly-pitched bird chirps at irregular intervals. */
  private scheduleBirdChirp() {
    const next = () => {
      this.playBirdChirp();
      this.track(next, 900 + Math.random() * 3500);
    };
    this.track(next, 500 + Math.random() * 1500);
  }

  private playBirdChirp() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const notes = 2 + Math.floor(Math.random() * 3);
    const baseFreq = 1800 + Math.random() * 1400;

    for (let i = 0; i < notes; i++) {
      const startAt = ctx.currentTime + i * (0.09 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";

      const freq = baseFreq + (Math.random() - 0.5) * 400;
      osc.frequency.setValueAtTime(freq, startAt);
      osc.frequency.exponentialRampToValueAtTime(
        freq * (Math.random() > 0.5 ? 1.4 : 0.7),
        startAt + 0.08
      );

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);

      osc.connect(gain);
      gain.connect(master);
      osc.start(startAt);
      osc.stop(startAt + 0.14);
    }
  }

  /** Schedules cricket / insect style tremolo pulses. */
  private scheduleCricketChirp() {
    const next = () => {
      this.playCricketChirp();
      this.track(next, 2500 + Math.random() * 4000);
    };
    this.track(next, 3000 + Math.random() * 2000);
  }

  private playCricketChirp() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const pulses = 4 + Math.floor(Math.random() * 5);
    const freq = 3800 + Math.random() * 900;

    for (let i = 0; i < pulses; i++) {
      const startAt = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.045, startAt + 0.01);
      gain.gain.linearRampToValueAtTime(0, startAt + 0.05);

      osc.connect(gain);
      gain.connect(master);
      osc.start(startAt);
      osc.stop(startAt + 0.06);
    }
  }
}
