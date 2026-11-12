/**
 * Web Audio API Engine for Realistic Tactical Walkie-Talkie Simulation
 * Provides procedural sound synthesis, realistic radio filtering, distortion,
 * latency delay, static injection, and interruption gating.
 */

class RadioAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.staticSource = null;
    this.staticGain = null;
    this.staticFilter = null;
    this.peerAudioNodes = new Map(); // peerId -> { source, delayNode, hpFilter, lpFilter, shaper, compressor, gate, staticMixer }
    this.activeInterruption = false;
    this.interruptionTimer = null;

    // Default conditions
    this.conditions = {
      staticLevel: 35,
      voiceDistortion: 40,
      transmissionDelay: 250,
      signalInterruptionProb: 15,
      interruptionDuration: 800,
      connectionFailureProb: 5,
    };

    this.onInterruptionChange = null;
  }

  // Ensure AudioContext is initialized and resumed (browsers require user interaction)
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupStaticNoiseGenerator();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Generate procedural radio static noise (no external MP3 needed!)
  setupStaticNoiseGenerator() {
    if (!this.ctx) return;

    // Create 3 seconds of white/pink noise buffer
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      // Pink-ish noise generation with random atmospheric modulation
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      const pink = b0 + b1 + b2 + white * 0.2;
      output[i] = pink * 0.12;
    }

    this.staticSource = this.ctx.createBufferSource();
    this.staticSource.buffer = noiseBuffer;
    this.staticSource.loop = true;

    // Static bandpass filter to sound like analog VHF/UHF radio receiver hiss
    this.staticFilter = this.ctx.createBiquadFilter();
    this.staticFilter.type = 'bandpass';
    this.staticFilter.frequency.value = 1600;
    this.staticFilter.Q.value = 1.0;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0; // initially silent until radio receives or squelch opens

    this.staticSource.connect(this.staticFilter);
    this.staticFilter.connect(this.staticGain);
    this.staticGain.connect(this.ctx.destination);

    this.staticSource.start(0);
  }

  // Update simulation conditions from Admin
  updateConditions(newConditions) {
    this.conditions = { ...this.conditions, ...newConditions };

    // Update delay and filter properties on all active peer audio graphs
    const delaySec = Math.max(0, Math.min(3, (this.conditions.transmissionDelay || 0) / 1000));
    const distortionAmt = (this.conditions.voiceDistortion || 0) / 100;

    for (const [peerId, nodes] of this.peerAudioNodes.entries()) {
      if (nodes.delayNode) {
        nodes.delayNode.delayTime.setTargetAtTime(delaySec, this.ctx.currentTime, 0.1);
      }
      if (nodes.shaper) {
        nodes.shaper.curve = this.createDistortionCurve(distortionAmt * 40);
      }
    }
  }

  // Custom distortion wave shaper for realistic walkie-talkie saturation
  createDistortionCurve(amount = 20) {
    const k = typeof amount === 'number' ? amount : 20;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Asymmetric saturation curve for military radio transformer/clipping effect
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Connect remote peer WebRTC stream into Tactical Audio Pipeline
  attachPeerStream(peerId, mediaStream) {
    this.initContext();
    this.detachPeerStream(peerId);

    try {
      const source = this.ctx.createMediaStreamSource(mediaStream);

      // 1. Transmission Delay Node
      const delaySec = Math.max(0, Math.min(3, (this.conditions.transmissionDelay || 0) / 1000));
      const delayNode = this.ctx.createDelay(3.5);
      delayNode.delayTime.value = delaySec;

      // 2. Highpass Filter (Cut sub-350Hz: removes room rumble, mimics small speaker)
      const hpFilter = this.ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 350;
      hpFilter.Q.value = 1.2;

      // 3. Lowpass Filter (Cut above 2800Hz: creates iconic limited VHF band)
      const lpFilter = this.ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 2900;
      lpFilter.Q.value = 1.0;

      // 4. Presence Peaking Filter (Peak at 1.8kHz for harsh tactical speech punch)
      const peakFilter = this.ctx.createBiquadFilter();
      peakFilter.type = 'peaking';
      peakFilter.frequency.value = 1800;
      peakFilter.Q.value = 2.0;
      peakFilter.gain.value = 5.0;

      // 5. Radio Saturation & Distortion WaveShaper
      const shaper = this.ctx.createWaveShaper();
      const distortionAmt = (this.conditions.voiceDistortion || 0) / 100;
      shaper.curve = this.createDistortionCurve(distortionAmt * 40);
      shaper.oversample = '2x';

      // 6. Aggressive Dynamics Compressor (Radio AGC automatic gain control)
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 6;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      // 7. Interruption Gate (cuts out audio during simulated signal drops)
      const gate = this.ctx.createGain();
      gate.gain.value = 1.0;

      // 8. Master output gain
      const masterGain = this.ctx.createGain();
      masterGain.gain.value = this.isMuted ? 0 : 1.2;

      // Connect pipeline
      source.connect(delayNode);
      delayNode.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(peakFilter);
      peakFilter.connect(shaper);
      shaper.connect(compressor);
      compressor.connect(gate);
      gate.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      this.peerAudioNodes.set(peerId, {
        source,
        delayNode,
        hpFilter,
        lpFilter,
        peakFilter,
        shaper,
        compressor,
        gate,
        masterGain
      });
    } catch (err) {
      console.error('Failed to attach peer audio stream:', err);
    }
  }

  detachPeerStream(peerId) {
    const nodes = this.peerAudioNodes.get(peerId);
    if (nodes) {
      try {
        nodes.source.disconnect();
        nodes.delayNode.disconnect();
        nodes.gate.disconnect();
        nodes.masterGain.disconnect();
      } catch (e) {}
      this.peerAudioNodes.delete(peerId);
    }
  }

  // Radio Static level during transmission
  setTransmissionStatic(active) {
    if (!this.staticGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (active) {
      const level = Math.max(0.01, (this.conditions.staticLevel || 0) / 100) * 0.25;
      this.staticGain.gain.cancelScheduledValues(now);
      this.staticGain.gain.setTargetAtTime(level, now, 0.04);
    } else {
      this.staticGain.gain.cancelScheduledValues(now);
      this.staticGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  // Trigger Signal Interruption (Mute incoming voice + loud static burst)
  triggerInterruption(durationMs = 800) {
    if (this.activeInterruption || !this.ctx) return;
    this.activeInterruption = true;
    const now = this.ctx.currentTime;

    // Mute all active peer gates
    for (const nodes of this.peerAudioNodes.values()) {
      if (nodes.gate) {
        nodes.gate.gain.cancelScheduledValues(now);
        nodes.gate.gain.setTargetAtTime(0, now, 0.01);
      }
    }

    // Heavy static burst during interruption
    if (this.staticGain) {
      this.staticGain.gain.cancelScheduledValues(now);
      this.staticGain.gain.setTargetAtTime(0.35, now, 0.02);
    }

    if (this.onInterruptionChange) {
      this.onInterruptionChange(true);
    }

    clearTimeout(this.interruptionTimer);
    this.interruptionTimer = setTimeout(() => {
      this.endInterruption();
    }, durationMs);
  }

  endInterruption() {
    if (!this.activeInterruption || !this.ctx) return;
    this.activeInterruption = false;
    const now = this.ctx.currentTime;

    // Restore peer gates
    for (const nodes of this.peerAudioNodes.values()) {
      if (nodes.gate) {
        nodes.gate.gain.cancelScheduledValues(now);
        nodes.gate.gain.setTargetAtTime(1.0, now, 0.05);
      }
    }

    // Reset static to normal
    if (this.staticGain) {
      const normalLevel = Math.max(0.01, (this.conditions.staticLevel || 0) / 100) * 0.25;
      this.staticGain.gain.cancelScheduledValues(now);
      this.staticGain.gain.setTargetAtTime(normalLevel, now, 0.05);
    }

    if (this.onInterruptionChange) {
      this.onInterruptionChange(false);
    }
  }

  // -------------------------------------------------------------
  // PROCEDURAL UI SOUND EFFECTS (SYNTHESIZED WITH WEB AUDIO API)
  // -------------------------------------------------------------

  // Tactical PTT Click On: Mechanical switch click + short VHF keying pulse
  playPttPressSound() {
    if (this.isMuted) return;
    this.initContext();
    const now = this.ctx.currentTime;

    // Relay micro-click (sharp filtered square pop)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);

    // Subtle radio wake chirp
    const chirp = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(880, now + 0.02);
    chirp.frequency.exponentialRampToValueAtTime(1320, now + 0.05);

    chirpGain.gain.setValueAtTime(0.001, now);
    chirpGain.gain.setValueAtTime(0.15, now + 0.02);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    chirp.connect(chirpGain);
    chirpGain.connect(this.ctx.destination);
    chirp.start(now + 0.02);
    chirp.stop(now + 0.06);
  }

  // Iconic NASA / Military Roger Beep + Squelch Tail Burst
  playRogerBeep() {
    if (this.isMuted) return;
    this.initContext();
    const now = this.ctx.currentTime;

    // Tone 1: 1200 Hz for 45ms
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.setValueAtTime(0.25, now + 0.04);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.045);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Tone 2: 950 Hz for 45ms
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(950, now + 0.045);
    gain2.gain.setValueAtTime(0.25, now + 0.045);
    gain2.gain.setValueAtTime(0.25, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.095);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + 0.1);

    // Squelch tail burst (analog radio cutoff noise)
    const noiseDuration = 0.08;
    const bufferSize = this.ctx.sampleRate * noiseDuration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now + 0.09);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09 + noiseDuration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now + 0.09);
  }

  // Channel Busy Rejection Tone (Staccato buzz)
  playBusyTone() {
    if (this.isMuted) return;
    this.initContext();
    const now = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  // Connection Lost Warning Tone (Descending 3 pips)
  playConnectionLostSound() {
    if (this.isMuted) return;
    this.initContext();
    const now = this.ctx.currentTime;
    const freqs = [750, 520, 380];

    freqs.forEach((freq, idx) => {
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  // Connection Restored Chime (Ascending 2 pips)
  playConnectionRestoredSound() {
    if (this.isMuted) return;
    this.initContext();
    const now = this.ctx.currentTime;
    const freqs = [550, 950];

    freqs.forEach((freq, idx) => {
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    for (const nodes of this.peerAudioNodes.values()) {
      if (nodes.masterGain) {
        nodes.masterGain.gain.value = this.isMuted ? 0 : 1.2;
      }
    }
    return this.isMuted;
  }
}

// Singleton export
export const audioEngine = new RadioAudioEngine();
