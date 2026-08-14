import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { VoiceBridge: NativeVoiceBridge } = NativeModules;

export interface AudioChunkPayload {
  pcmChunk: string; // Base64 PCM 16-bit 16kHz mono
  rms: number;      // Normalized 0.0 - 1.0 audio energy
  timestamp: number;
}

export interface StateChangePayload {
  isCapturing: boolean;
}

export interface ErrorPayload {
  message: string;
}

class VoiceBridgeService {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    if (NativeVoiceBridge) {
      this.eventEmitter = new NativeEventEmitter(NativeVoiceBridge);
    }
  }

  /**
   * Request necessary Android permissions for audio capture & foreground service notification.
   */
  async requestAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const audioGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission Required',
          message:
            'AI Chief of Staff requires continuous microphone access for hands-free voice interaction.',
          buttonPositive: 'Grant Permission',
        },
      );

      if (audioGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }

      // Android 13+ (API 33) Notification Permission
      if (Platform.Version >= 33) {
        const notifPermission = 'android.permission.POST_NOTIFICATIONS' as any;
        await PermissionsAndroid.request(notifPermission, {
          title: 'Background Service Notification',
          message:
            'Allows the app to inform you when the microphone is listening in background mode.',
          buttonPositive: 'Allow',
        });
      }

      return true;
    } catch (err) {
      console.error('[VoiceBridge] Permission error:', err);
      return false;
    }
  }

  /**
   * Start native audio capture & foreground service.
   */
  async startCapture(): Promise<boolean> {
    if (!NativeVoiceBridge) {
      console.warn('[VoiceBridge] Native module not loaded.');
      return false;
    }
    return await NativeVoiceBridge.startCapture();
  }

  /**
   * Stop native audio capture & background service.
   */
  async stopCapture(): Promise<boolean> {
    if (!NativeVoiceBridge) return false;
    return await NativeVoiceBridge.stopCapture();
  }

  /**
   * Returns current native capture state.
   */
  async isCapturing(): Promise<boolean> {
    if (!NativeVoiceBridge) return false;
    return await NativeVoiceBridge.isCapturing();
  }

  /**
   * Play PCM 16-bit audio chunk via native AudioTrack.
   */
  playAudioChunk(base64Pcm: string): void {
    if (NativeVoiceBridge?.playAudioChunk) {
      NativeVoiceBridge.playAudioChunk(base64Pcm);
    }
  }

  /**
   * Stop current audio playback on AudioTrack.
   */
  stopAudio(): void {
    if (NativeVoiceBridge?.stopAudio) {
      NativeVoiceBridge.stopAudio();
    }
  }

  /**
   * Subscribe to PCM audio chunk stream events.
   */
  onAudioChunk(callback: (data: AudioChunkPayload) => void): EmitterSubscription | null {
    if (!this.eventEmitter) return null;
    return this.eventEmitter.addListener('VoiceBridge_AudioChunk', (data: any) => callback(data));
  }

  /**
   * Subscribe to native state change events.
   */
  onStateChange(callback: (data: StateChangePayload) => void): EmitterSubscription | null {
    if (!this.eventEmitter) return null;
    return this.eventEmitter.addListener('VoiceBridge_StateChange', (data: any) => callback(data));
  }

  /**
   * Subscribe to native error events.
   */
  onError(callback: (data: ErrorPayload) => void): EmitterSubscription | null {
    if (!this.eventEmitter) return null;
    return this.eventEmitter.addListener('VoiceBridge_Error', (data: any) => callback(data));
  }
}

export const VoiceBridge = new VoiceBridgeService();
