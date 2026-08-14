import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ToolCallItem } from '../agent/types';
import { ws, hs, fs } from '../utils/metrics';

export const ToolCallsPanel: React.FC<{ tools: ToolCallItem[] }> = ({ tools }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.panelTitle}>Function Calling Logs</Text>
      {tools.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tool calls logged yet.</Text>
          <Text style={styles.emptySubText}>
            Function calls like create_task, save_order, schedule_checkin, or query_calendar will be displayed here in real time.
          </Text>
        </View>
      ) : (
        tools.map((t) => (
          <View key={t.id} style={styles.toolCard}>
            <View style={styles.toolHeader}>
              <Text style={styles.toolName}>{t.name}</Text>
              <Text style={styles.toolTime}>{t.at}</Text>
            </View>
            <Text style={styles.jsonLabel}>Arguments:</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                {JSON.stringify(t.args, null, 2)}
              </Text>
            </View>
            {t.result ? (
              <>
                <Text style={styles.jsonLabel}>Result:</Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(t.result, null, 2)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        ))
      )}
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
  },
  emptyState: {
    paddingVertical: hs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: fs(14),
    fontWeight: '700',
    marginBottom: hs(4),
  },
  emptySubText: {
    color: '#64748b',
    fontSize: fs(12),
    textAlign: 'center',
    paddingHorizontal: ws(20),
    lineHeight: hs(18),
  },
  toolCard: {
    backgroundColor: '#0c1322',
    borderRadius: ws(14),
    padding: ws(12),
    borderWidth: ws(1),
    borderColor: 'rgba(225, 0, 255, 0.25)',
    gap: hs(6),
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolName: {
    color: '#E100FF',
    fontSize: fs(13),
    fontWeight: '800',
  },
  toolTime: {
    color: '#64748b',
    fontSize: fs(10),
  },
  jsonLabel: {
    color: '#94a3b8',
    fontSize: fs(10.5),
    fontWeight: '700',
    marginTop: hs(2),
  },
  codeBlock: {
    backgroundColor: '#050912',
    padding: ws(8),
    borderRadius: ws(8),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  codeText: {
    color: '#00F2FE',
    fontSize: fs(11),
    fontFamily: 'monospace',
  },
});
