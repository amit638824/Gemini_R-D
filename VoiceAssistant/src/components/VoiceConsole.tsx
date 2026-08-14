import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SessionStatus } from '../shared/types';
import { ws, hs, fs } from '../utils/metrics';

interface VoiceConsoleProps {
  status: SessionStatus;
  isCapturing: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendText: (text: string) => void;
}

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  status,
  isCapturing,
  error,
  onConnect,
  onDisconnect,
  onSendText,
}) => {
  const [inputText, setInputText] = useState('');
  const live = status === 'live';

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setInputText('');
  };

  const getStatusLine = () => {
    if (status === 'idle') return 'Ready — start a continuous Live session';
    if (status === 'connecting') return 'Connecting to Gemini Live…';
    if (status === 'live') {
      return isCapturing
        ? 'Listening continuously — put the phone down, speak anytime'
        : 'Live session connected — microphone muted';
    }
    if (status === 'error') return 'Session error / Local Mode Active';
    return '';
  };

  return (
    <View style={styles.consoleCard}>
      {/* Status Line */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            live ? styles.dotLive : status === 'connecting' ? styles.dotConnecting : styles.dotIdle,
          ]}
        />
        <Text style={styles.statusText}>{getStatusLine()}</Text>
      </View>

      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

      {/* Primary Connect / Disconnect CTA Row */}
      <View style={styles.ctaRow}>
        {!live ? (
          <TouchableOpacity style={styles.connectBtn} onPress={onConnect} activeOpacity={0.8}>
            <Text style={styles.connectBtnText}>🚀 Start Chief of Staff (WebSocket)</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} activeOpacity={0.8}>
            <Text style={styles.disconnectBtnText}>🔴 End Session</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Text Inject Fallback Form */}
      <View style={styles.textFallbackForm}>
        <TextInput
          style={styles.textInput}
          placeholder="Optional text inject (debug / noisy room)..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  consoleCard: {
    backgroundColor: '#0c1322',
    marginHorizontal: ws(16),
    marginVertical: hs(6),
    padding: ws(14),
    borderRadius: ws(16),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: hs(10),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ws(8),
  },
  statusDot: {
    width: ws(10),
    height: ws(10),
    borderRadius: ws(5),
  },
  dotLive: {
    backgroundColor: '#00F260',
  },
  dotConnecting: {
    backgroundColor: '#E100FF',
  },
  dotIdle: {
    backgroundColor: '#64748b',
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: fs(12),
    fontWeight: '700',
    flex: 1,
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: fs(11),
    fontWeight: '600',
  },
  ctaRow: {
    marginTop: hs(2),
  },
  connectBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: hs(10),
    borderRadius: ws(12),
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: fs(13),
    fontWeight: '800',
    letterSpacing: ws(0.5),
  },
  disconnectBtn: {
    backgroundColor: '#be123c',
    paddingVertical: hs(10),
    borderRadius: ws(12),
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#ffffff',
    fontSize: fs(13),
    fontWeight: '800',
  },
  textFallbackForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ws(8),
  },
  textInput: {
    flex: 1,
    backgroundColor: '#050912',
    color: '#ffffff',
    fontSize: fs(12),
    paddingHorizontal: ws(12),
    paddingVertical: hs(8),
    borderRadius: ws(10),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendBtn: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    borderColor: 'rgba(0, 242, 254, 0.4)',
    borderWidth: ws(1),
    paddingHorizontal: ws(14),
    paddingVertical: hs(8),
    borderRadius: ws(10),
  },
  sendBtnText: {
    color: '#00F2FE',
    fontSize: fs(12),
    fontWeight: '800',
  },
});
