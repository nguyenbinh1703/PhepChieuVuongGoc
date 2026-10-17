/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class LabAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Giới hạn tần suất phát âm thanh chống chồng âm và dội loa
  private lastClickTime: number = 0;
  private lastSwitchTime: number = 0;

  // Buồng phát laser (âm nền transformer hum êm dịu, ấm áp)
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private currentHumTarget: number = 0;
  private lastHumUpdateTime: number = 0;

  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // 1. Master Gain Node - Đặt mức âm lượng tối ưu 0.85 (bảo đảm headroom, chống clipping DAC)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        // 2. Master Transparent Limiter:
        // Đặt attack 10ms và release 100ms để bộ nén làm việc hoàn toàn trong suốt,
        // tuyệt đối KHÔNG cắt vụn đỉnh sóng âm (nguyên nhân gây tiếng rè rè như tia điện)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-4.0, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.01, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted) {
      if (this.humGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.humGain.gain.cancelScheduledValues(t);
        this.humGain.gain.setValueAtTime(0, t);
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Âm thanh click giao diện chuẩn công nghệ cao:
   * Thanh thoát, giòn giã, êm ái, tuyệt đối KHÔNG có tiếng rè rè hay tia điện loa rè.
   * Hoạt động hoàn mỹ trên cả loa điện thoại, tai nghe và loa máy tính.
   */
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    // Giữ khoảng cách 30ms giữa các lần click để tiếng bấm tròn trịa, dứt khoát
    if (now - this.lastClickTime < 30) {
      return;
    }
    this.lastClickTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // 1. Bộ lọc thông thấp 2800Hz cắt sạch các tần số hài kỹ thuật số gắt tai
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.Q.setValueAtTime(0.7, t);

    // 2. Dải tần số chuẩn Tactile Click: lướt nhẹ từ 1760Hz (A6) xuống 1320Hz (E6) trong 18ms
    // Tạo tiếng "tách" thanh thoát, cơ học, không bao giờ rơi xuống dải tần thấp gây méo tiếng
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.018);

    // 3. Đường bao âm lượng mượt mà (Attack 2.5ms chống bụp DC offset; Decay 24ms êm dịu)
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.0025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.030);

    // Tự động thu dọn node giải phóng tài nguyên Web Audio sau khi phát xong
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
  }

  /**
   * Âm thanh công tắc đóng/ngắt nguồn Laser (Relay cơ học trong trẻo, đầm chắc)
   */
  public playSwitch(powerOn: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastSwitchTime < 35) return;
    this.lastSwitchTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);

    osc.type = 'sine';
    if (powerOn) {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(720, t + 0.030);
    } else {
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(360, t + 0.028);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.050);

    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
  }

  /**
   * Âm thanh buồng phát laser: Êm ái, dải trầm ấm áp, không gây gắt tai và không giật cục
   */
  public updateLaserHum(isOn: boolean, intensity: number = 0.8) {
    if (this.isMuted || !isOn) {
      if (this.humGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.currentHumTarget = 0;
        this.humGain.gain.cancelScheduledValues(t);
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, t);
        this.humGain.gain.linearRampToValueAtTime(0, t + 0.06);
      }
      return;
    }

    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    if (!this.humOsc1) {
      const t = this.ctx.currentTime;
      this.humOsc1 = this.ctx.createOscillator();
      this.humOsc2 = this.ctx.createOscillator();
      this.humGain = this.ctx.createGain();
      this.humFilter = this.ctx.createBiquadFilter();

      this.humFilter.type = 'lowpass';
      this.humFilter.frequency.setValueAtTime(280, t);

      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.setValueAtTime(90, t);

      this.humOsc2.type = 'sine';
      this.humOsc2.frequency.setValueAtTime(180, t);

      this.humGain.gain.setValueAtTime(0.0001, t);

      this.humOsc1.connect(this.humFilter);
      this.humOsc2.connect(this.humFilter);
      this.humFilter.connect(this.humGain);
      this.humGain.connect(this.masterGain);

      this.humOsc1.start();
      this.humOsc2.start();
    }

    const now = performance.now();
    if (now - this.lastHumUpdateTime < 40) {
      return;
    }
    this.lastHumUpdateTime = now;

    if (this.humGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.025 * Math.min(1, Math.max(0.15, intensity));
      if (Math.abs(targetGain - this.currentHumTarget) > 0.0005) {
        this.currentHumTarget = targetGain;
        const t = this.ctx.currentTime;
        this.humGain.gain.cancelScheduledValues(t);
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, t);
        this.humGain.gain.linearRampToValueAtTime(targetGain, t + 0.06);
      }
    }
  }
}

export const labAudio = new LabAudioEngine();
