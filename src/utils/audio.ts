/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class LabAudioEngine {
  private ctx: AudioContext | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted && this.humGain) {
      this.humGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound of a heavy industrial optical relay or toggle switch
   */
  public playSwitch(powerOn: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = powerOn ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(powerOn ? 440 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(powerOn ? 880 : 110, t + 0.06);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Soft mechanical click when changing specimens or camera
   */
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Smooth laser generator ambient hum
   */
  public updateLaserHum(isOn: boolean, intensity: number = 0.8) {
    if (this.isMuted || !isOn) {
      if (this.humGain && this.ctx) {
        this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }

    this.initCtx();
    if (!this.ctx) return;

    if (!this.humOsc1) {
      const t = this.ctx.currentTime;
      this.humOsc1 = this.ctx.createOscillator();
      this.humOsc2 = this.ctx.createOscillator();
      this.humGain = this.ctx.createGain();

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);

      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.setValueAtTime(120, t); // 120Hz transformer hum

      this.humOsc2.type = 'triangle';
      this.humOsc2.frequency.setValueAtTime(240, t);

      this.humGain.gain.setValueAtTime(0.0, t);

      this.humOsc1.connect(filter);
      this.humOsc2.connect(filter);
      filter.connect(this.humGain);
      this.humGain.connect(this.ctx.destination);

      this.humOsc1.start();
      this.humOsc2.start();
    }

    if (this.humGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.018 * Math.min(1, Math.max(0.1, intensity));
      this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
    }
  }
}

export const labAudio = new LabAudioEngine();
