package com.voiceassistant.voicebridge

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Base64
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

class AudioCaptureManager(
    private val onAudioFrame: (base64Pcm: String, rmsNormalized: Double) -> Unit,
    private val onError: (errorMessage: String) -> Unit
) {

    companion object {
        private const val TAG = "AudioCaptureManager"
        private const val SAMPLE_RATE = 16000 // 16kHz for Gemini Live
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val CHUNK_SIZE_SAMPLES = 640 // 40ms chunks at 16kHz
    }

    private var audioRecord: AudioRecord? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var captureThread: Thread? = null
    private val isCapturing = AtomicBoolean(false)

    @SuppressLint("MissingPermission")
    fun startCapture() {
        if (isCapturing.get()) {
            Log.w(TAG, "Audio capture is already running.")
            return
        }

        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        )

        if (minBufferSize <= 0) {
            onError("Invalid AudioRecord minBufferSize: $minBufferSize")
            return
        }

        val bufferSize = maxOf(minBufferSize, CHUNK_SIZE_SAMPLES * 2 * 4)

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                onError("AudioRecord failed to initialize.")
                audioRecord?.release()
                audioRecord = null
                return
            }

            val sessionId = audioRecord?.audioSessionId ?: 0
            if (sessionId != 0) {
                if (AcousticEchoCanceler.isAvailable()) {
                    try {
                        echoCanceler = AcousticEchoCanceler.create(sessionId)
                        echoCanceler?.enabled = true
                        Log.i(TAG, "Hardware AcousticEchoCanceler enabled.")
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to enable AcousticEchoCanceler", e)
                    }
                }
                if (NoiseSuppressor.isAvailable()) {
                    try {
                        noiseSuppressor = NoiseSuppressor.create(sessionId)
                        noiseSuppressor?.enabled = true
                        Log.i(TAG, "Hardware NoiseSuppressor enabled.")
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to enable NoiseSuppressor", e)
                    }
                }
            }

            audioRecord?.startRecording()
            isCapturing.set(true)

            captureThread = Thread({ readAudioLoop() }, "AudioCaptureThread").apply {
                priority = Thread.MAX_PRIORITY
                start()
            }
            Log.i(TAG, "Audio capture started successfully.")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting AudioRecord", e)
            onError(e.message ?: "Failed to start AudioRecord")
        }
    }

    fun stopCapture() {
        if (!isCapturing.get()) return

        isCapturing.set(false)
        try {
            captureThread?.interrupt()
            captureThread = null

            echoCanceler?.apply {
                enabled = false
                release()
            }
            echoCanceler = null

            noiseSuppressor?.apply {
                enabled = false
                release()
            }
            noiseSuppressor = null

            audioRecord?.apply {
                if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    stop()
                }
                release()
            }
            audioRecord = null
            Log.i(TAG, "Audio capture stopped.")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AudioRecord", e)
        }
    }

    fun isRecording(): Boolean = isCapturing.get()

    private fun readAudioLoop() {
        val buffer = ShortArray(CHUNK_SIZE_SAMPLES)
        val byteBuffer = ByteArray(CHUNK_SIZE_SAMPLES * 2)

        while (isCapturing.get() && !Thread.currentThread().isInterrupted) {
            val record = audioRecord ?: break
            val readShorts = record.read(buffer, 0, buffer.size)

            if (readShorts > 0) {
                // Convert ShortArray to ByteArray (little-endian PCM 16-bit)
                for (i in 0 until readShorts) {
                    val sample = buffer[i].toInt()
                    byteBuffer[i * 2] = (sample and 0x00FF).toByte()
                    byteBuffer[i * 2 + 1] = ((sample shr 8) and 0x00FF).toByte()
                }

                // Calculate RMS for VAD / visualizer
                var sumSq = 0.0
                for (i in 0 until readShorts) {
                    val s = buffer[i].toDouble()
                    sumSq += s * s
                }
                val rms = sqrt(sumSq / readShorts)
                val normalizedRms = (rms / 32768.0).coerceIn(0.0, 1.0)

                val base64Data = Base64.encodeToString(
                    byteBuffer,
                    0,
                    readShorts * 2,
                    Base64.NO_WRAP
                )

                onAudioFrame(base64Data, normalizedRms)
            } else if (readShorts < 0) {
                Log.e(TAG, "AudioRecord read error code: $readShorts")
                break
            }
        }
    }
}
