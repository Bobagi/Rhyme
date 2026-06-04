// metronome.js
// A small Web Audio metronome: plays a short click at a fixed tempo and notifies
// a listener on every beat (for a visual pulse). Tempo is always clamped to
// [MIN_BPM, MAX_BPM]. Self-contained — owns its own AudioContext and timer.

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;

export function clampBpm(beatsPerMinute) {
  const numericValue = Number(beatsPerMinute);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BPM;
  }
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(numericValue)));
}

export class Metronome {
  constructor({ onBeat } = {}) {
    this.onBeat = typeof onBeat === 'function' ? onBeat : () => {};
    this.beatsPerMinute = DEFAULT_BPM;
    this.audioContext = null;
    this.intervalId = 0;
    this.isPlaying = false;
  }

  setBeatsPerMinute(beatsPerMinute) {
    this.beatsPerMinute = clampBpm(beatsPerMinute);
    if (this.isPlaying) {
      this.#scheduleTicking();
    }
    return this.beatsPerMinute;
  }

  start() {
    if (this.isPlaying) {
      return;
    }
    if (!this.audioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextConstructor();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.isPlaying = true;
    this.#tick();
    this.#scheduleTicking();
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = 0;
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  dispose() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  #scheduleTicking() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }
    const intervalMs = 60000 / this.beatsPerMinute;
    this.intervalId = window.setInterval(() => this.#tick(), intervalMs);
  }

  #tick() {
    this.#playClick();
    this.onBeat();
  }

  #playClick() {
    if (!this.audioContext) {
      return;
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const startTime = this.audioContext.currentTime;
    oscillator.frequency.value = 1100;
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.45, startTime + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.06);
  }
}
