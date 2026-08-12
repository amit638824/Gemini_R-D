import {
  downsampleTo16k,
  floatTo16BitPCM,
  int16ToBase64,
} from './pcm';

export type AudioChunkHandler = (base64Pcm16k: string) => void;

/**
 * Continuous mic capture → 16kHz PCM base64 chunks for Gemini Live.
 * Hands-free: always streaming while session is live (not push-to-talk).
 */
export class MicRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onChunk: AudioChunkHandler | null = null;

  async start(onChunk: AudioChunkHandler): Promise<void> {
    this.onChunk = onChunk;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but widely supported for PCM tap without AudioWorklet bundling complexity
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      if (!this.onChunk || !this.ctx) return;
      const input = event.inputBuffer.getChannelData(0);
      const down = downsampleTo16k(input, this.ctx.sampleRate);
      const pcm = floatTo16BitPCM(down);
      this.onChunk(int16ToBase64(pcm));
    };

    // Keep processor alive without playing mic into speakers (echo risk)
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(mute);
    mute.connect(this.ctx.destination);
  }

  stop(): void {
    this.onChunk = null;
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;
    void this.ctx?.close();
    this.ctx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
