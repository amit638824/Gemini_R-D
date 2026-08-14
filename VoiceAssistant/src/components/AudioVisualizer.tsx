import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { AssistantState } from '../agent/types';
import { ws, hs, fs } from '../utils/metrics';

interface AudioVisualizerProps {
  state: AssistantState;
  rms: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ state, rms }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseOuter = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Waveform bar heights (7 bars for ultra-modern symmetry)
  const barAnims = [
    useRef(new Animated.Value(ws(10))).current,
    useRef(new Animated.Value(ws(18))).current,
    useRef(new Animated.Value(ws(28))).current,
    useRef(new Animated.Value(ws(38))).current,
    useRef(new Animated.Value(ws(28))).current,
    useRef(new Animated.Value(ws(18))).current,
    useRef(new Animated.Value(ws(10))).current,
  ];

  // Continuous ambient background pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOuter, {
          toValue: 1.15,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOuter, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseOuter]);

  // Dynamic reaction to RMS audio energy level
  useEffect(() => {
    if (state === 'listening') {
      const targetScale = 1 + rms * 1.6;
      Animated.spring(scaleAnim, {
        toValue: targetScale,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }).start();

      barAnims.forEach((bar, index) => {
        const base = ws(10) + Math.sin(index) * ws(8);
        const targetHeight = Math.min(hs(55), base + rms * hs(90) * (1 + (index % 4) * 0.3));
        Animated.timing(bar, {
          toValue: targetHeight,
          duration: 70,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [rms, state, scaleAnim, barAnims]);

  // Rotation animation for 'thinking' state
  useEffect(() => {
    if (state === 'thinking') {
      const loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state, rotateAnim]);

  // Speaking state animated wave
  useEffect(() => {
    if (state === 'speaking') {
      const animations = barAnims.map((bar, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: hs(40) + (i % 3) * hs(12),
              duration: 250 + i * 70,
              useNativeDriver: false,
            }),
            Animated.timing(bar, {
              toValue: hs(8),
              duration: 250 + i * 70,
              useNativeDriver: false,
            }),
          ])
        )
      );
      Animated.parallel(animations).start();
      return () => animations.forEach(a => a.stop());
    }
  }, [state, barAnims]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getGlowColor = () => {
    switch (state) {
      case 'listening': return 'rgba(0, 242, 254, 0.25)';
      case 'thinking': return 'rgba(225, 0, 255, 0.3)';
      case 'speaking': return 'rgba(0, 242, 96, 0.3)';
      case 'error': return 'rgba(255, 75, 75, 0.3)';
      default: return 'rgba(148, 163, 184, 0.15)';
    }
  };

  const getRingColor = () => {
    switch (state) {
      case 'listening': return '#00F2FE';
      case 'thinking': return '#E100FF';
      case 'speaking': return '#00F260';
      case 'error': return '#FF4B4B';
      default: return '#64748b';
    }
  };

  return (
    <View style={styles.container}>
      {/* Outer Glowing Ring Aura */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            backgroundColor: getGlowColor(),
            transform: [{ scale: Animated.multiply(scaleAnim, pulseOuter) }],
          },
        ]}
      />

      {/* Main Glass Center Orb */}
      <Animated.View
        style={[
          styles.centerOrb,
          { borderColor: getRingColor() },
          state === 'thinking' && { transform: [{ rotate: spin }] },
        ]}
      >
        {/* Waveform Bars */}
        <View style={styles.barsContainer}>
          {barAnims.map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.waveBar,
                {
                  height: anim,
                  backgroundColor: getRingColor(),
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: hs(140),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: hs(6),
  },
  glowRing: {
    position: 'absolute',
    width: ws(130),
    height: ws(130),
    borderRadius: ws(65),
  },
  centerOrb: {
    width: ws(94),
    height: ws(94),
    borderRadius: ws(47),
    backgroundColor: '#0c1322',
    borderWidth: ws(3),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: ws(16),
    elevation: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ws(4),
    height: hs(55),
  },
  waveBar: {
    width: ws(4),
    borderRadius: ws(2),
  },
});
