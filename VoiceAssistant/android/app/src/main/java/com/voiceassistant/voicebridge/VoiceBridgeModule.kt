package com.voiceassistant.voicebridge

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class VoiceBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "VoiceBridgeModule"
        private const val EVENT_AUDIO_CHUNK = "VoiceBridge_AudioChunk"
        private const val EVENT_STATE_CHANGE = "VoiceBridge_StateChange"
        private const val EVENT_ERROR = "VoiceBridge_Error"
    }

    private var audioCaptureManager: AudioCaptureManager? = null
    private var audioTrack: AudioTrack? = null

    override fun getName(): String = "VoiceBridge"

    @ReactMethod
    fun startCapture(promise: Promise) {
        try {
            // Start Foreground Service
            val intent = Intent(reactContext, VoiceForegroundService::class.java).apply {
                action = VoiceForegroundService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            if (audioCaptureManager == null) {
                audioCaptureManager = AudioCaptureManager(
                    onAudioFrame = { base64Pcm, rms ->
                        sendAudioChunkEvent(base64Pcm, rms)
                    },
                    onError = { errorMsg ->
                        sendErrorEvent(errorMsg)
                    }
                )
            }

            audioCaptureManager?.startCapture()
            sendStateEvent(isCapturing = true)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start capture", e)
            promise.reject("START_CAPTURE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopCapture(promise: Promise) {
        try {
            audioCaptureManager?.stopCapture()

            val intent = Intent(reactContext, VoiceForegroundService::class.java).apply {
                action = VoiceForegroundService.ACTION_STOP
            }
            reactContext.startService(intent)

            sendStateEvent(isCapturing = false)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop capture", e)
            promise.reject("STOP_CAPTURE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isCapturing(promise: Promise) {
        val capturing = audioCaptureManager?.isRecording() ?: false
        promise.resolve(capturing)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter compliance
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter compliance
    }

    private fun amplifyPcm16(pcmBytes: ByteArray, gain: Float = 2.5f): ByteArray {
        val amplified = ByteArray(pcmBytes.size)
        for (i in 0 until pcmBytes.size - 1 step 2) {
            val low = pcmBytes[i].toInt() and 0xFF
            val high = pcmBytes[i + 1].toInt()
            var sample = (high shl 8) or low
            sample = (sample * gain).toInt().coerceIn(-32768, 32767)
            amplified[i] = (sample and 0xFF).toByte()
            amplified[i + 1] = ((sample shr 8) and 0xFF).toByte()
        }
        return amplified
    }

    @ReactMethod
    fun playAudioChunk(base64Pcm: String) {
        try {
            val rawPcm = Base64.decode(base64Pcm, Base64.DEFAULT)
            if (rawPcm.isEmpty()) return
            val pcmData = amplifyPcm16(rawPcm, 2.5f)

            if (audioTrack == null) {
                // Ensure AudioManager routes audio output to loud speaker
                val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                audioManager?.let {
                    it.mode = AudioManager.MODE_NORMAL
                    it.isSpeakerphoneOn = true
                }

                val minBuf = AudioTrack.getMinBufferSize(
                    24000,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                val bufferSize = maxOf(minBuf * 2, 48000)

                audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(24000)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                audioTrack?.setVolume(1.0f)
                audioTrack?.play()
            }
            audioTrack?.write(pcmData, 0, pcmData.size)
        } catch (e: Exception) {
            Log.e(TAG, "AudioTrack write error", e)
        }
    }

    @ReactMethod
    fun stopAudio() {
        try {
            audioTrack?.apply {
                if (playState == AudioTrack.PLAYSTATE_PLAYING) {
                    stop()
                }
                flush()
                release()
            }
            audioTrack = null
        } catch (e: Exception) {
            Log.e(TAG, "AudioTrack stop error", e)
        }
    }

    private fun sendAudioChunkEvent(base64Pcm: String, rms: Double) {
        val map = Arguments.createMap().apply {
            putString("pcmChunk", base64Pcm)
            putDouble("rms", rms)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        sendEvent(EVENT_AUDIO_CHUNK, map)
    }

    private fun sendStateEvent(isCapturing: Boolean) {
        val map = Arguments.createMap().apply {
            putBoolean("isCapturing", isCapturing)
        }
        sendEvent(EVENT_STATE_CHANGE, map)
    }

    private fun sendErrorEvent(errorMessage: String) {
        val map = Arguments.createMap().apply {
            putString("message", errorMessage)
        }
        sendEvent(EVENT_ERROR, map)
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }
}
