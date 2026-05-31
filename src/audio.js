// KARTOPIA - all sound is synthesized with the Web Audio API (no audio files).
// Engine hum, SFX (boost, item, hit, shell, lightning) and a looping chiptune.
// Everything is guarded so the game still runs if audio is unavailable/blocked.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (click/tap) to satisfy autoplay rules.
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* audio not available */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // ---------------- Engine ----------------
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    try {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      const sub = this.ctx.createOscillator(); sub.type = 'square';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = this.ctx.createGain(); g.gain.value = 0.0001;
      o.connect(f); sub.connect(f); f.connect(g); g.connect(this.master);
      o.start(); sub.start();
      this.engineOsc = o; this.engineSub = sub; this.engineGain = g; this.engineFilter = f;
    } catch (e) {}
  }
  setEngine(speed01, boosting) {
    if (!this.engineOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 55 + speed01 * 110 + (boosting ? 45 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(base * 0.5, t, 0.06);
    this.engineGain.gain.setTargetAtTime(0.035 + speed01 * 0.05, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(500 + speed01 * 1600 + (boosting ? 800 : 0), t, 0.1);
  }
  stopEngine() {
    for (const o of [this.engineOsc, this.engineSub]) { if (o) { try { o.stop(); } catch (e) {} } }
    this.engineOsc = this.engineSub = this.engineGain = this.engineFilter = null;
  }

  // ---------------- One-shot SFX ----------------
  blip(freq, dur, type = 'square', vol = 0.3, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  sweep(f0, f1, dur, type = 'sine', vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  noiseBurst(dur = 0.3, vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start(t);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'count': this.blip(440, 0.18, 'square', 0.35); break;
      case 'go': this.blip(880, 0.35, 'square', 0.45); break;
      case 'boost': this.sweep(280, 900, 0.35, 'sawtooth', 0.3); break;
      case 'item':
        this.blip(660, 0.08, 'square', 0.3, 0);
        this.blip(880, 0.08, 'square', 0.3, 0.08);
        this.blip(1180, 0.12, 'square', 0.3, 0.16);
        break;
      case 'use': this.blip(520, 0.1, 'triangle', 0.32); break;
      case 'hit': this.sweep(520, 70, 0.45, 'sawtooth', 0.4); this.noiseBurst(0.2, 0.2); break;
      case 'shell': this.sweep(950, 380, 0.18, 'square', 0.25); break;
      case 'lightning': this.noiseBurst(0.45, 0.35); this.sweep(1300, 90, 0.55, 'sawtooth', 0.35); break;
      case 'drift': this.blip(1500, 0.05, 'sawtooth', 0.12); break;
      case 'bump': this.blip(150, 0.12, 'square', 0.3); this.noiseBurst(0.1, 0.18); break;
      case 'wall': this.sweep(220, 60, 0.2, 'sawtooth', 0.3); this.noiseBurst(0.14, 0.22); break;
      case 'coin':
        this.blip(1320, 0.06, 'square', 0.22, 0);
        this.blip(1760, 0.10, 'square', 0.22, 0.05);
        break;
    }
  }

  // ---------------- Looping music ----------------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // C major pentatonic-ish happy loop (Hz)
    const mel = [523, 659, 784, 659, 587, 784, 880, 784, 523, 659, 784, 1046, 880, 784, 659, 587];
    const bass = [131, 131, 196, 196, 147, 147, 196, 196];
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const s = this.musicStep;
      const m = mel[s % mel.length];
      if (m) this.blip(m, 0.16, 'triangle', 0.12);
      if (s % 2 === 0) this.blip(bass[(s / 2) % bass.length], 0.2, 'square', 0.1);
      this.musicStep++;
    }, 160);
  }
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
