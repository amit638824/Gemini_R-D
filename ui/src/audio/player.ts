import { base64ToInt16, parsePcmRate } from './pcm';

/**
 * Queued PCM playback with interruption support.
 */
export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async enqueueBase64(base64: string, mimeType?: string): Promise<void> {
    const ctx = await this.ensure();
    const rate = parsePcmRate(mimeType);
    const int16 = base64ToInt16(base64);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] ?? 0) / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, rate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source);
    };
  }

  interrupt(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime;
    }
  }

  async close(): Promise<void> {
    this.interrupt();
    await this.ctx?.close();
    this.ctx = null;
  }
}
