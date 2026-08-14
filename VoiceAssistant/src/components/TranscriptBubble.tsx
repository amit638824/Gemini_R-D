import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TranscriptTurn } from '../agent/types';
import { ws, hs, fs } from '../utils/metrics';

interface TranscriptBubbleProps {
  turn: TranscriptTurn;
}

export const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ turn }) => {
  const isUser = turn.sender === 'user';
  const isSystem = turn.sender === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>⚡ {turn.text}</Text>
      </View>
    );
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
      <View style={[styles.headerRow, isUser && styles.userHeaderRow]}>
        <View style={[styles.avatarChip, isUser ? styles.userChip : styles.assistantChip]}>
          <Text style={styles.avatarText}>{isUser ? 'YOU' : 'AI'}</Text>
        </View>
        <Text style={[styles.senderBadge, isUser ? styles.userSender : styles.assistantSender]}>
          {isUser ? 'USER' : 'CHIEF OF STAFF'}
        </Text>
        <Text style={styles.timestamp}>{formatTime(turn.timestamp)}</Text>
      </View>

      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          turn.isPartial && styles.partialBubble,
        ]}
      >
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {turn.text}
        </Text>
        {turn.isPartial && <Text style={styles.listeningDots}> ...</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: hs(6),
    maxWidth: '88%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  assistantWrapper: {
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hs(4),
    gap: ws(6),
  },
  userHeaderRow: {
    justifyContent: 'flex-end',
  },
  avatarChip: {
    width: ws(20),
    height: ws(20),
    borderRadius: ws(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  userChip: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
  },
  assistantChip: {
    backgroundColor: 'rgba(225, 0, 255, 0.2)',
  },
  avatarText: {
    fontSize: fs(9),
    fontWeight: '900',
    color: '#ffffff',
  },
  senderBadge: {
    fontSize: fs(10),
    fontWeight: '800',
    letterSpacing: ws(0.8),
  },
  userSender: {
    color: '#00F2FE',
  },
  assistantSender: {
    color: '#E100FF',
  },
  timestamp: {
    fontSize: fs(9),
    color: '#64748b',
  },
  bubble: {
    borderRadius: ws(16),
    paddingHorizontal: ws(14),
    paddingVertical: hs(10),
    borderWidth: ws(1),
  },
  userBubble: {
    backgroundColor: '#131c2e',
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderBottomRightRadius: ws(3),
  },
  assistantBubble: {
    backgroundColor: '#0c1322',
    borderColor: 'rgba(225, 0, 255, 0.3)',
    borderBottomLeftRadius: ws(3),
  },
  partialBubble: {
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  userText: {
    color: '#f8fafc',
    fontSize: fs(13.5),
    lineHeight: hs(20),
  },
  assistantText: {
    color: '#f1f5f9',
    fontSize: fs(13.5),
    lineHeight: hs(20),
  },
  text: {
    fontWeight: '400',
  },
  listeningDots: {
    color: '#00F2FE',
    fontWeight: 'bold',
  },
  systemContainer: {
    alignSelf: 'center',
    marginVertical: hs(6),
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: ws(12),
    paddingVertical: hs(4),
    borderRadius: ws(12),
    borderWidth: ws(1),
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  systemText: {
    color: '#94a3b8',
    fontSize: fs(10.5),
    fontWeight: '600',
  },
});
