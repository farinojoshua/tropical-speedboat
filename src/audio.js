/**
 * Procedural Web Audio marine soundscape:
 * - Twin V6 outboard engine rumble & harmonic whine scaling with RPM/boost
 * - Filtered white-noise hull water rush & sea breeze
 * - Splash bursts on wave-jump landings
 * - Clean arcade chime on checkpoint collection
 */
export class BoatAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.masterGain = null;
    this.engineOscA = null;
    this.engineOscB = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.waterGain = null;
    this.waterFilter = null;
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.42 : 0.0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // --- Twin V6 Outboard Engine Synth ---
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 210;
    engineFilter.Q.value = 2.4;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.08;
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 46;

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 93.5; // slight detune for twin-outboard throbbing resonance

    oscA.connect(engineFilter);
    oscB.connect(engineFilter);
    oscA.start();
    oscB.start();

    this.engineOscA = oscA;
    this.engineOscB = oscB;
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;

    // --- Filtered Noise for Ocean Water Rush & Wind ---
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.value = 520;
    waterFilter.Q.value = 0.7;

    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.05;

    noiseSrc.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(master);
    noiseSrc.start();

    this.waterFilter = waterFilter;
    this.waterGain = waterGain;
    this.noiseBuffer = noiseBuf;
    this.started = true;
  }

  setEnabled(flag) {
    this.enabled = flag;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(flag ? 0.42 : 0.0, this.ctx.currentTime, 0.05);
    }
  }

  update(speedNorm, throttleAbs, boosting, airborne) {
    if (!this.started || !this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;

    const rpm = Math.min(1.45, 0.14 + speedNorm * 0.82 + throttleAbs * 0.25 + (boosting ? 0.34 : 0));
    const baseFreq = 42 + rpm * 98;

    this.engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineOscB.frequency.setTargetAtTime(baseFreq * 1.99 + (boosting ? 14 : 0), now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(180 + rpm * 740 + (boosting ? 420 : 0), now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.08 + rpm * 0.14, now, 0.08);

    // Water hull rush decreases slightly when airborne off a jump!
    const waterLevel = airborne ? 0.025 : 0.04 + speedNorm * 0.22 + (boosting ? 0.06 : 0);
    this.waterGain.gain.setTargetAtTime(waterLevel, now, 0.07);
    this.waterFilter.frequency.setTargetAtTime(380 + speedNorm * 1100, now, 0.08);
  }

  playSplash(intensity = 1.0) {
    if (!this.started || !this.ctx || !this.enabled || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.52);

    const gain = this.ctx.createGain();
    const peak = Math.min(0.45, 0.18 * intensity);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.58);
  }

  playCheckpoint(isFinish = false) {
    if (!this.started || !this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = isFinish ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880.0];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.24, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });
  }
}
