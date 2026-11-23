// Neon Palms — pure WebAudio synth. No audio files, everything is oscillators and noise.
export class SoundBank {
  constructor() { this.ctx = null; this.engineOsc = null; this.engineGain = null; this.sirenOn = false; this.muted = false; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speedFrac, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedFrac * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedFrac * 140, t, 0.08);
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  gunshot() { this.noise(0.14, 0.4, 2600); this.blip(180, 0.08, 'square', 0.2, 60); }
  punch() { this.noise(0.08, 0.3, 500); }
  crash() { this.noise(0.3, 0.4, 700); this.blip(90, 0.25, 'sawtooth', 0.2, 40); }
  pickup() { this.blip(660, 0.1, 'sine', 0.2); setTimeout(() => this.blip(990, 0.14, 'sine', 0.2), 90); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 130));
  }
  busted() { this.blip(220, 0.5, 'sawtooth', 0.2, 110); }
  sirenTick(on) {
    if (!this.ctx || this.muted) return;
    if (!on) return;
    this.blip(this._sirenHigh ? 700 : 950, 0.28, 'sine', 0.07);
    this._sirenHigh = !this._sirenHigh;
  }
}
