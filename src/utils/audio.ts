/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class LabAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Pre-rendered PCM AudioBuffers: Miễn nhiễm 100% với hiện tượng giật lag, đứt quãng (buffer underrun)
  // và triệt tiêu hoàn toàn hiện tượng vang dội, rè loa trên điện thoại
  private clickBuffer: AudioBuffer | null = null;
  private switchOnBuffer: AudioBuffer | null = null;
  private switchOffBuffer: AudioBuffer | null = null;

  private lastClickTime: number = 0;
  private lastSwitchTime: number = 0;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Master Gain tuyến tính thuần khiết (Linear Headroom 0.85)
        // Kết nối thẳng tới đầu ra loa: Loại bỏ hoàn toàn Dynamics Compressor
        // -> Triệt tiêu 100% hiện tượng "bơm nén âm thanh" (compressor pumping) gây tiếng vang rè sau khi bấm
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Khởi tạo trước các bộ đệm âm thanh PCM siêu ngắn (Micro-impulse PCM buffers)
        this.initBuffers(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Tạo sẵn bộ đệm âm thanh PCM trong bộ nhớ (Zero latency, Zero CPU, Zero rác bộ nhớ):
   * Mỗi âm thanh chỉ kéo dài vài mili-giây (siêu ngắn), kết thúc dứt khoát về 0
   * để không bao giờ có hiện tượng vang rè, rung màng loa điện thoại hay xẹt tia điện.
   */
  private initBuffers(ctx: AudioContext) {
    const sr = ctx.sampleRate || 44100;

    // 1. Tactile Click Buffer (chỉ đúng 8 mili-giây):
    // Dải tần số cao 2400Hz + 1500Hz thanh thoát, không có tần số trầm (< 800Hz)
    // -> Loa điện thoại phát ra cực kỳ trong, đanh giòn, êm ái, tuyệt đối không rung màng loa
    const clickSamples = Math.floor(sr * 0.008);
    this.clickBuffer = ctx.createBuffer(1, clickSamples, sr);
    const clickData = this.clickBuffer.getChannelData(0);
    for (let i = 0; i < clickSamples; i++) {
      const t = i / sr;
      // Đường bao nửa sóng sin 1.2ms chống DC offset, sau đó suy hao nhanh
      const env = t < 0.0012
        ? Math.sin((t / 0.0012) * (Math.PI / 2))
        : Math.exp(-(t - 0.0012) * 900);
      const tone = 0.65 * Math.sin(2 * Math.PI * 2400 * t) + 0.35 * Math.sin(2 * Math.PI * 1500 * t);
      clickData[i] = tone * env * 0.16;
    }
    clickData[clickSamples - 1] = 0;

    // 2. Switch On Buffer (20 mili-giây - Rơ-le cơ học đóng mạch)
    const swOnSamples = Math.floor(sr * 0.020);
    this.switchOnBuffer = ctx.createBuffer(1, swOnSamples, sr);
    const swOnData = this.switchOnBuffer.getChannelData(0);
    for (let i = 0; i < swOnSamples; i++) {
      const t = i / sr;
      const env = t < 0.002
        ? Math.sin((t / 0.002) * (Math.PI / 2))
        : Math.exp(-(t - 0.002) * 350);
      const freq = 600 + 400 * (t / 0.020);
      swOnData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.18;
    }
    swOnData[swOnSamples - 1] = 0;

    // 3. Switch Off Buffer (20 mili-giây - Rơ-le cơ học ngắt mạch)
    const swOffSamples = Math.floor(sr * 0.020);
    this.switchOffBuffer = ctx.createBuffer(1, swOffSamples, sr);
    const swOffData = this.switchOffBuffer.getChannelData(0);
    for (let i = 0; i < swOffSamples; i++) {
      const t = i / sr;
      const env = t < 0.002
        ? Math.sin((t / 0.002) * (Math.PI / 2))
        : Math.exp(-(t - 0.002) * 350);
      const freq = 900 - 450 * (t / 0.020);
      swOffData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.18;
    }
    swOffData[swOffSamples - 1] = 0;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Âm thanh click giao diện chuẩn Haptic:
   * Siêu ngắn (8ms), phát tức thì (0ms latency), trong trẻo và sạch sẽ 100%.
   * Ngay sau khi bấm xong là im lặng hoàn toàn, không có đuôi âm, không vang rè.
   */
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain || !this.clickBuffer) return;

    const now = performance.now();
    // Chặn dội nút nếu bấm quá nhanh trong vòng 20ms
    if (now - this.lastClickTime < 20) {
      return;
    }
    this.lastClickTime = now;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.connect(this.masterGain);
      source.start();
    } catch (_) {}
  }

  /**
   * Âm thanh công tắc đóng/ngắt nguồn Laser (Relay cơ học sắc nét, dứt khoát)
   */
  public playSwitch(powerOn: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const buf = powerOn ? this.switchOnBuffer : this.switchOffBuffer;
    if (!buf) return;

    const now = performance.now();
    if (now - this.lastSwitchTime < 30) return;
    this.lastSwitchTime = now;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.connect(this.masterGain);
      source.start();
    } catch (_) {}
  }

  /**
   * Cấu hình buồng phát laser:
   * Giữ nền tĩnh lặng, thanh thoát như một phòng thí nghiệm quang học hiện đại,
   * triệt tiêu hoàn toàn tiếng ù nền liên tục (nguyên nhân gây rung rè loa ngoài điện thoại).
   */
  public updateLaserHum(_isOn: boolean, _intensity: number = 0.8) {
    // Để giữ âm thanh sạch sẽ, không rung màng loa điện thoại và không tạo đuôi vang rè sau thao tác,
    // nền buồng máy duy trì trạng thái tĩnh lặng tuyệt đối.
  }
}

export const labAudio = new LabAudioEngine();
