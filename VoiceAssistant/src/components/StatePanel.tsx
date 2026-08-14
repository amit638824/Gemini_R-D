import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { DayState } from '../shared/types';
import { ws, hs, fs } from '../utils/metrics';

function remainingLabel(endsAt: string): string {
  const sec = Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const StatePanel: React.FC<{ dayState: DayState }> = ({ dayState }) => {
  const activeTimers = dayState.timers ? dayState.timers.filter((t) => !t.fired) : [];
  const openTasks = dayState.tasks ? dayState.tasks.filter((t) => t.status === 'open') : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.panelTitle}>Day State Overview</Text>

      {/* Now & Next */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>⚡ Current Activity Context</Text>
        <View style={styles.row}>
          <Text style={styles.label}>NOW:</Text>
          <Text style={styles.valueHighlight}>{dayState.activity?.current ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>NEXT:</Text>
          <Text style={styles.value}>{dayState.activity?.next ?? '—'}</Text>
        </View>
        {dayState.activity?.locationHint ? (
          <Text style={styles.mutedText}>📍 {dayState.activity.locationHint}</Text>
        ) : null}
      </View>

      {/* Active Timers */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>⏰ Active Re-Engagement Timers</Text>
        {activeTimers.length === 0 ? (
          <Text style={styles.mutedText}>No pending check-in timers</Text>
        ) : (
          activeTimers.map((t) => (
            <View key={t.id} style={styles.itemRow}>
              <Text style={styles.itemTitle}>{t.label}</Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerBadgeText}>{remainingLabel(t.endsAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Orders */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📦 Voice-Captured Orders</Text>
        {!dayState.orders || dayState.orders.length === 0 ? (
          <Text style={styles.mutedText}>No orders captured today</Text>
        ) : (
          dayState.orders.slice(0, 5).map((o) => (
            <View key={o.id} style={styles.itemRow}>
              <Text style={styles.itemTitle}>
                {o.customer}: {o.quantity} {o.unit ?? ''}
              </Text>
              {o.dueDate ? <Text style={styles.tagText}>Due: {o.dueDate}</Text> : null}
            </View>
          ))
        )}
      </View>

      {/* Tasks */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📋 Priority Tasks</Text>
        {openTasks.length === 0 ? (
          <Text style={styles.mutedText}>No open tasks</Text>
        ) : (
          openTasks.slice(0, 6).map((tk) => (
            <View key={tk.id} style={styles.itemRow}>
              <View style={[styles.prioBadge, tk.priority === 'high' ? styles.prioHigh : styles.prioMed]}>
                <Text style={styles.prioText}>{tk.priority.toUpperCase()}</Text>
              </View>
              <Text style={styles.itemTitleFlex}>{tk.title}</Text>
            </View>
          ))
        )}
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📝 Notes & Insights</Text>
        {!dayState.notes || dayState.notes.length === 0 ? (
          <Text style={styles.mutedText}>No notes recorded</Text>
        ) : (
          dayState.notes.slice(0, 5).map((n) => (
            <View key={n.id} style={styles.noteItem}>
              <Text style={styles.noteText}>{n.text}</Text>
            </View>
          ))
        )}
      </View>

      {/* Calendar Events */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📅 Calendar Schedule</Text>
        {!dayState.calendar || dayState.calendar.length === 0 ? (
          <Text style={styles.mutedText}>Ask: "What's on my calendar?"</Text>
        ) : (
          dayState.calendar.slice(0, 4).map((c) => (
            <View key={c.id} style={styles.itemRow}>
              <Text style={styles.itemTitleFlex}>{c.title}</Text>
              <Text style={styles.mutedText}>{new Date(c.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  content: {
    padding: ws(16),
    gap: hs(12),
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: fs(18),
    fontWeight: '900',
    marginBottom: hs(4),
    letterSpacing: ws(-0.4),
  },
  card: {
    backgroundColor: '#0c1322',
    borderRadius: ws(16),
    padding: ws(14),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: hs(8),
  },
  cardHeader: {
    color: '#00F2FE',
    fontSize: fs(13),
    fontWeight: '800',
    letterSpacing: ws(0.5),
    marginBottom: hs(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ws(8),
  },
  label: {
    color: '#64748b',
    fontSize: fs(11),
    fontWeight: '800',
    width: ws(45),
  },
  valueHighlight: {
    color: '#00F260',
    fontSize: fs(13),
    fontWeight: '700',
    flex: 1,
  },
  value: {
    color: '#e2e8f0',
    fontSize: fs(13),
    fontWeight: '600',
    flex: 1,
  },
  mutedText: {
    color: '#64748b',
    fontSize: fs(11.5),
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: ws(10),
    paddingVertical: hs(6),
    borderRadius: ws(8),
    gap: ws(8),
  },
  itemTitle: {
    color: '#f8fafc',
    fontSize: fs(12.5),
    fontWeight: '600',
  },
  itemTitleFlex: {
    color: '#f8fafc',
    fontSize: fs(12.5),
    fontWeight: '600',
    flex: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.18)',
    paddingHorizontal: ws(8),
    paddingVertical: hs(3),
    borderRadius: ws(6),
  },
  timerBadgeText: {
    color: '#00F2FE',
    fontSize: fs(11),
    fontWeight: '800',
  },
  tagText: {
    color: '#E100FF',
    fontSize: fs(11),
    fontWeight: '700',
  },
  prioBadge: {
    paddingHorizontal: ws(6),
    paddingVertical: hs(2),
    borderRadius: ws(4),
  },
  prioHigh: {
    backgroundColor: 'rgba(255, 75, 75, 0.2)',
  },
  prioMed: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  prioText: {
    color: '#ffffff',
    fontSize: fs(9),
    fontWeight: '900',
  },
  noteItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: ws(8),
    borderRadius: ws(8),
  },
  noteText: {
    color: '#cbd5e1',
    fontSize: fs(12),
  },
});
