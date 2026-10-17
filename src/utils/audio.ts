/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class LabAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Dedicated monophonic click voice (chokes active click immediately to prevent voice stacking/distortion)
  private clickOsc: OscillatorNode | null = null;
  private clickGain: GainNode | null = null;
  private lastClickTime: number = 0;

  // Dedicated monophonic switch voice (chokes active switch sound)
  private switchOsc: OscillatorNode | null = null;
  private switchGain: GainNode | null = null;
  private lastSwitchTime: number = 0;

  // Laser generator ambient hum (smooth, pure sine transformer hum with warm harmonics)
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

        // 1. Master Gain Node - Đặt mức âm lượng tối đa 1.0 (to rõ, sắc nét)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

        // 2. Master Brickwall Limiter & Dynamics Compressor
        // Giới hạn ở -1.5dB để bảo toàn 100% độ to rõ mà tuyệt đối không bị clipping hay rè méo tiếng
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-1.5, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.001, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.03, this.ctx.currentTime);

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
      this.chokeClick();
      this.chokeSwitch();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Ngắt dứt khoát tiếng click cũ nếu đang phát để tiếng mới vang lên trong trẻo, không bị chồng âm (beat frequencies)
   */
  private chokeClick() {
    if (!this.ctx || !this.clickGain || !this.clickOsc) return;
    try {
      const t = this.ctx.currentTime;
      this.clickGain.gain.cancelScheduledValues(t);
      this.clickGain.gain.setValueAtTime(this.clickGain.gain.value, t);
      this.clickGain.gain.linearRampToValueAtTime(0.0001, t + 0.002);
      this.clickOsc.stop(t + 0.003);
    } catch (_) {}
    this.clickOsc = null;
    this.clickGain = null;
  }

  /**
   * Ngắt dứt khoát tiếng công tắc cũ
   */
  private chokeSwitch() {
    if (!this.ctx || !this.switchGain || !this.switchOsc) return;
    try {
      const t = this.ctx.currentTime;
      this.switchGain.gain.cancelScheduledValues(t);
      this.switchGain.gain.setValueAtTime(this.switchGain.gain.value, t);
      this.switchGain.gain.linearRampToValueAtTime(0.0001, t + 0.002);
      this.switchOsc.stop(t + 0.003);
    } catch (_) {}
    this.switchOsc = null;
    this.switchGain = null;
  }

  /**
   * Âm thanh click cơ học TO RÕ, ĐANH GIÒN, dứt khoát:
   * Nghe rõ mồn một trên cả loa điện thoại lẫn loa máy tính, nút nào ra nút nấy!
   */
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    // Giữ khoảng cách 25ms giữa các lần click để tiếng bấm tròn, giòn, không bị giật nhại máy
    if (now - this.lastClickTime < 25) {
      return;
    }
    this.lastClickTime = now;

    // Choke voice cũ ngay lập tức (Monophonic voice stealing)
    this.chokeClick();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Dải tần vàng cho tai người và loa ngoài điện thoại: 1300Hz xuống 420Hz trong 22ms
    // Tạo tiếng "tách" giòn, đanh, có lực, sắc sảo
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1300, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.022);

    // Biên độ đỉnh tăng lên 0.28 (To, rõ ràng, dứt khoát) với attack 0.8ms chống bụp DC offset
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.046);

    this.clickOsc = osc;
    this.clickGain = gain;
  }

  /**
   * Âm thanh công tắc đóng/cắt nguồn Laser (Relay cơ học chất lượng cao, TO RÕ, KHÔNG SÓNG VUÔNG)
   */
  public playSwitch(powerOn: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastSwitchTime < 35) return;
    this.lastSwitchTime = now;

    this.chokeSwitch();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Lọc thông thấp 3200Hz giữ tiếng đanh chắc mà không chói tai
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);

    osc.type = powerOn ? 'triangle' : 'sine';
    if (powerOn) {
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(760, t + 0.035);
    } else {
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.032);
    }

    // Biên độ đỉnh tăng lên 0.35 (To rõ, uy lực như công tắc cơ học cao cấp)
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.06);

    this.switchOsc = osc;
    this.switchGain = gain;
  }

  /**
   * Âm thanh buồng phát laser: Êm ái, có dải tần 100Hz & 200Hz để loa điện thoại và máy tính đều nghe rõ tiếng máy hoạt động,
   * Tuyệt đối không rè, không ngắt quãng hay giật nảy khi kéo thanh trượt
   */
  public updateLaserHum(isOn: boolean, intensity: number = 0.8) {
    if (this.isMuted || !isOn) {
      if (this.humGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.currentHumTarget = 0;
        this.humGain.gain.cancelScheduledValues(t);
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, t);
        this.humGain.gain.linearRampToValueAtTime(0, t + 0.08);
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

      // Bộ lọc cắt dải tần 350Hz để âm thanh ấm áp, công nghệ cao, không có tiếng rè rè
      this.humFilter.type = 'lowpass';
      this.humFilter.frequency.setValueAtTime(350, t);

      // 95Hz (trầm ấm) và 190Hz (để loa ngoài điện thoại nghe rõ tiếng buồng máy)
      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.setValueAtTime(95, t);

      this.humOsc2.type = 'sine';
      this.humOsc2.frequency.setValueAtTime(190, t);

      this.humGain.gain.setValueAtTime(0.0001, t);

      this.humOsc1.connect(this.humFilter);
      this.humOsc2.connect(this.humFilter);
      this.humFilter.connect(this.humGain);
      this.humGain.connect(this.masterGain);

      this.humOsc1.start();
      this.humOsc2.start();
    }

    const now = performance.now();
    // Giới hạn tần suất cập nhật AudioParam khi ngón tay trượt thanh độ sáng liên tục (chống buffer glitch)
    if (now - this.lastHumUpdateTime < 40) {
      return;
    }
    this.lastHumUpdateTime = now;

    if (this.humGain && this.ctx) {
      // Âm lượng hum tăng lên 0.035 (vừa vặn, nghe rõ không gian phòng thí nghiệm mà không lấn át tiếng click)
      const targetGain = this.isMuted ? 0 : 0.035 * Math.min(1, Math.max(0.15, intensity));
      if (Math.abs(targetGain - this.currentHumTarget) > 0.0005) {
        this.currentHumTarget = targetGain;
        const t = this.ctx.currentTime;
        this.humGain.gain.cancelScheduledValues(t);
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, t);
        this.humGain.gain.linearRampToValueAtTime(targetGain, t + 0.08);
      }
    }
  }
}

export const labAudio = new LabAudioEngine();
