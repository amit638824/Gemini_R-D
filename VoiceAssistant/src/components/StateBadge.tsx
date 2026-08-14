import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AssistantState } from '../agent/types';
import { ws, hs, fs } from '../utils/metrics';

interface StateBadgeProps {
  state: AssistantState;
  isBackgroundActive?: boolean;
}

const STATE_CONFIG: Record<
  AssistantState,
  { label: string; bg: string; border: string; text: string; dot: string; glow: string }
> = {
  idle: {
    label: 'STANDBY',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.25)',
    text: '#94a3b8',
    dot: '#64748b',
    glow: 'rgba(100, 116, 139, 0.2)',
  },
  listening: {
    label: 'LISTENING',
    bg: 'rgba(0, 242, 254, 0.12)',
    border: 'rgba(0, 242, 254, 0.4)',
    text: '#00F2FE',
    dot: '#00F2FE',
    glow: 'rgba(0, 242, 254, 0.4)',
  },
  thinking: {
    label: 'THINKING',
    bg: 'rgba(225, 0, 255, 0.12)',
    border: 'rgba(225, 0, 255, 0.4)',
    text: '#E100FF',
    dot: '#E100FF',
    glow: 'rgba(225, 0, 255, 0.4)',
  },
  speaking: {
    label: 'SPEAKING',
    bg: 'rgba(0, 242, 96, 0.12)',
    border: 'rgba(0, 242, 96, 0.4)',
    text: '#00F260',
    dot: '#00F260',
    glow: 'rgba(0, 242, 96, 0.4)',
  },
  error: {
    label: 'ERROR',
    bg: 'rgba(255, 75, 75, 0.12)',
    border: 'rgba(255, 75, 75, 0.4)',
    text: '#FF4B4B',
    dot: '#FF4B4B',
    glow: 'rgba(255, 75, 75, 0.4)',
  },
};

export const StateBadge: React.FC<StateBadgeProps> = ({ state, isBackgroundActive }) => {
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'listening' || state === 'thinking' || state === 'speaking') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: config.dot, opacity: pulseAnim },
        ]}
      />
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
      {isBackgroundActive && (
        <View style={styles.bgTag}>
          <Text style={styles.bgTagText}>BG ACTIVE</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ws(12),
    paddingVertical: hs(5),
    borderRadius: ws(20),
    borderWidth: ws(1),
    gap: ws(6),
  },
  dot: {
    width: ws(8),
    height: ws(8),
    borderRadius: ws(4),
  },
  text: {
    fontSize: fs(11),
    fontWeight: '800',
    letterSpacing: ws(1.2),
  },
  bgTag: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: ws(6),
    paddingVertical: hs(2),
    borderRadius: ws(8),
    marginLeft: ws(4),
  },
  bgTagText: {
    color: '#00F2FE',
    fontSize: fs(9),
    fontWeight: '900',
  },
});
