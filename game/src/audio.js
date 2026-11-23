// Sound, synthesized live with WebAudio: no audio files, no network. A tiny
// synth kit — noise bursts for gunshots, two-tone sirens, engine hum that
// follows speed, and short blips for pickups, punches and mission jingles.
// The context is created on the first user gesture, as browsers require.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Engine: a low sawtooth whose pitch follows driving speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows the driven car's speed (0 when on foot). */
    setEngine(speed, driving) {
      if (!context || !engineGain) return;
      const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 520 * 0.12) : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.16, context.currentTime, 0.1);
    },
    gunshot() {
      noise(0.16, 0.5, 2400);
      tone(160, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.09, 0.35, 500);
      tone(90, 0.1, 'sine', 0.3, 50);
    },
    crash() {
      noise(0.3, 0.5, 900);
      tone(70, 0.25, 'sawtooth', 0.25, 40);
    },
    siren() {
      tone(660, 0.28, 'sine', 0.07, 880);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.25);
      setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 90);
    },
    missionComplete() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.28), i * 110);
      });
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.2), i * 160);
      });
    },
    click() {
      tone(1200, 0.05, 'sine', 0.15);
    },
    hurt() {
      tone(140, 0.18, 'sawtooth', 0.25, 70);
    },
  };
}
