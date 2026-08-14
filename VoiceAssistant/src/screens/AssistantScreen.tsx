import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { StateBadge } from '../components/StateBadge';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { TranscriptBubble } from '../components/TranscriptBubble';
import { VoiceConsole } from '../components/VoiceConsole';
import { StatePanel } from '../components/StatePanel';
import { ToolCallsPanel } from '../components/ToolCallsPanel';
import { VoiceBridge, AudioChunkPayload } from '../native/VoiceBridge';
import { StubAgent } from '../agent/StubAgent';
import { AssistantState, TranscriptTurn, ToolCallItem, DayState, SessionStatus } from '../agent/types';
import { emptyDayState } from '../shared/types';
import { SchedulerStub } from '../scheduler/SchedulerStub';
import { AppStorage } from '../utils/storage';
import { ApiClient } from '../services/apiClient';
import { ApiEnvMode } from '../config/apiConfig';
import { ws, hs, fs } from '../utils/metrics';
import { SafeAreaView } from 'react-native-safe-area-context';

export const AssistantScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'console' | 'dayState' | 'tools'>('console');
  const [state, setState] = useState<AssistantState>('idle');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [dayState, setDayState] = useState<DayState>(emptyDayState());
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [rms, setRms] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [envMode, setEnvMode] = useState<ApiEnvMode>(AppStorage.getEnvMode());

  const scrollViewRef = useRef<any>(null);
  const agentRef = useRef<StubAgent>(new StubAgent());

  useEffect(() => {
    const agent = agentRef.current;

    // Subscribe to SessionManager events
    const unsubscribe = agent.addListener({
      onStateChange: (newState) => setState(newState),
      onTranscriptUpdate: (newTranscript) => setTranscript(newTranscript),
      onAudioRms: (newRms) => setRms(newRms),
      onDayStateUpdate: (newDayState) => setDayState({ ...newDayState }),
      onToolCall: (newTools) => setToolCalls([...newTools]),
      onSessionStatusChange: (status, errorDetail) => {
        setSessionStatus(status);
        setSessionError(errorDetail ?? null);
      },
      onError: (err) => Alert.alert('Assistant Error', err),
    });

    // Subscribe to VoiceBridge Native Events
    const chunkSub = VoiceBridge.onAudioChunk((data: AudioChunkPayload) => {
      agent.processAudioChunk(data);
    });

    const stateSub = VoiceBridge.onStateChange((data) => {
      setIsCapturing(data.isCapturing);
    });

    const errorSub = VoiceBridge.onError((err) => {
      console.error('[VoiceBridge Error]', err);
    });

    // Hands-Free Voice-On-Open lifecycle
    initVoiceOnOpen();

    return () => {
      unsubscribe();
      chunkSub?.remove();
      stateSub?.remove();
      errorSub?.remove();
      VoiceBridge.stopCapture();
      agent.stopSession();
    };
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (activeTab === 'console') {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [transcript, activeTab]);

  const initVoiceOnOpen = async () => {
    const granted = await VoiceBridge.requestAndroidPermissions();
    setPermissionGranted(granted);

    // Always connect WebSocket to Live Backend
    agentRef.current.connectWebSocket(AppStorage.getServerUrl());

    // Fetch dynamic initial DayState, Calendar, Tasks from REST API
    void fetchInitialRestState();

    if (granted) {
      startListeningSession();
    } else {
      Alert.alert(
        'Permission Required',
        'Microphone permission is required for AI Chief of Staff voice interaction.'
      );
    }
  };

  const fetchInitialRestState = async () => {
    try {
      const [fetchedState, events, tasks] = await Promise.all([
        ApiClient.fetchDayState(),
        ApiClient.fetchCalendar(24),
        ApiClient.fetchTasks(false),
      ]);

      if (fetchedState) {
        if (events && events.length > 0) {
          fetchedState.calendar = events.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            location: e.location,
            description: e.description,
          }));
        }
        if (tasks && tasks.length > 0) {
          fetchedState.tasks = tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due: t.due,
          }));
        }
        setDayState({ ...fetchedState });
      }
    } catch (e) {
      console.warn('[AssistantScreen] fetchInitialRestState failed:', e);
    }
  };

  const startListeningSession = async () => {
    try {
      const success = await VoiceBridge.startCapture();
      if (success) {
        setIsCapturing(true);
        await agentRef.current.startSession();
      }
    } catch (err) {
      console.error('[AssistantScreen] Start capture failed:', err);
    }
  };

  const stopListeningSession = async () => {
    try {
      await VoiceBridge.stopCapture();
      await agentRef.current.stopSession();
      setIsCapturing(false);
    } catch (err) {
      console.error('[AssistantScreen] Stop capture failed:', err);
    }
  };

  const handleConnectWebSocket = () => {
    // Connects to Gemini Live WebSocket backend
    agentRef.current.connectWebSocket(AppStorage.getServerUrl());
  };

  const handleDisconnectWebSocket = () => {
    agentRef.current.disconnectWebSocket();
  };

  const handleSendText = (text: string) => {
    if (text.includes('40 minutes')) {
      SchedulerStub.scheduleCheckIn(40, 5);
      setDayState(agentRef.current.getDayState());
    }
    agentRef.current.sendTextMessage(text);
  };

  const toggleMute = () => {
    if (isCapturing) {
      stopListeningSession();
    } else {
      startListeningSession();
    }
  };

  const handleClearTranscript = () => {
    agentRef.current.clearTranscript();
  };

  const toggleEnvMode = () => {
    const nextMode: ApiEnvMode = envMode === 'DEV' ? 'PROD' : 'DEV';
    AppStorage.saveEnvMode(nextMode);
    setEnvMode(nextMode);
    Alert.alert(
      'Environment Switched',
      `Switched to ${nextMode} environment.\nURL: ${AppStorage.getServerUrl()}`
    );
    // Reconnect WS to the new environment URL if active
    if (sessionStatus === 'live' || sessionStatus === 'connecting') {
      agentRef.current.connectWebSocket(AppStorage.getServerUrl());
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.appTitle}>Gemini Live</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>CHIEF OF STAFF</Text>
            </View>
            <TouchableOpacity style={[styles.envBadge, envMode === 'PROD' ? styles.envProd : styles.envDev]} onPress={toggleEnvMode} activeOpacity={0.7}>
              <Text style={styles.envBadgeText}>{envMode}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.appSubtitle}>Hands-free voice · proactive timers · state</Text>
        </View>

        <StateBadge state={state} isBackgroundActive={isCapturing} />
      </View>

      {/* Tab Segment Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'console' && styles.activeTabItem]}
          onPress={() => setActiveTab('console')}
        >
          <Text style={[styles.tabText, activeTab === 'console' && styles.activeTabText]}>
            🎙️ Console & Live
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dayState' && styles.activeTabItem]}
          onPress={() => setActiveTab('dayState')}
        >
          <Text style={[styles.tabText, activeTab === 'dayState' && styles.activeTabText]}>
            📋 Day State
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'tools' && styles.activeTabItem]}
          onPress={() => setActiveTab('tools')}
        >
          <Text style={[styles.tabText, activeTab === 'tools' && styles.activeTabText]}>
            🛠️ Tools ({toolCalls.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Content */}
      {activeTab === 'dayState' ? (
        <StatePanel dayState={dayState} />
      ) : activeTab === 'tools' ? (
        <ToolCallsPanel tools={toolCalls} />
      ) : (
        <View style={styles.mainCol}>
          {/* WebSocket & Status Console */}
          <VoiceConsole
            status={sessionStatus}
            isCapturing={isCapturing}
            error={sessionError}
            onConnect={handleConnectWebSocket}
            onDisconnect={handleDisconnectWebSocket}
            onSendText={handleSendText}
          />

          {/* Audio Visualizer Hero */}
          <AudioVisualizer state={state} rms={rms} />

          {/* Live Transcript Container */}
          <View style={styles.transcriptContainer}>
            <View style={styles.transcriptHeaderRow}>
              <View style={styles.transcriptTitleGroup}>
                <Text style={styles.transcriptHeaderTitle}>Conversation Stream</Text>
                <View style={styles.liveIndicatorDot} />
              </View>
              <TouchableOpacity onPress={handleClearTranscript} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.clearText}>Clear Stream</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.transcriptScroll}
              contentContainerStyle={styles.transcriptContent}
              showsVerticalScrollIndicator={true}
            >
              {transcript.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateTitle}>Hands-free continuous session</Text>
                  <Text style={styles.emptyStateText}>
                    {permissionGranted
                      ? 'Put phone down, speak anytime — mic streams continuously.'
                      : 'Grant microphone permission to begin.'}
                  </Text>
                </View>
              ) : (
                transcript.map((turn) => <TranscriptBubble key={turn.id} turn={turn} />)
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Floating Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.muteButton, isCapturing ? styles.muteButtonActive : styles.muteButtonPaused]}
          onPress={toggleMute}
          activeOpacity={0.85}
        >
          <Text style={styles.muteButtonText}>
            {isCapturing ? '🎙️ MUTE MICROPHONE' : '▶️ UNMUTE & LISTEN'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ws(16),
    paddingTop: hs(20),
    paddingBottom: hs(10),
    borderBottomWidth: ws(1),
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ws(8),
  },
  appTitle: {
    color: '#ffffff',
    fontSize: fs(20),
    fontWeight: '900',
    letterSpacing: ws(-0.5),
  },
  versionBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.18)',
    borderColor: 'rgba(0, 242, 254, 0.4)',
    borderWidth: ws(1),
    paddingHorizontal: ws(6),
    paddingVertical: hs(2),
    borderRadius: ws(6),
  },
  versionText: {
    color: '#00F2FE',
    fontSize: fs(9),
    fontWeight: '900',
    letterSpacing: ws(0.8),
  },
  appSubtitle: {
    color: '#94a3b8',
    fontSize: fs(10.5),
    fontWeight: '600',
    marginTop: hs(2),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0c1322',
    marginHorizontal: ws(16),
    marginTop: hs(8),
    borderRadius: ws(12),
    padding: ws(3),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: hs(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ws(10),
  },
  activeTabItem: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderWidth: ws(1),
  },
  tabText: {
    color: '#64748b',
    fontSize: fs(11),
    fontWeight: '700',
  },
  activeTabText: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  mainCol: {
    flex: 1,
  },
  chipsSection: {
    marginVertical: hs(2),
  },
  chipsScrollContent: {
    paddingHorizontal: ws(16),
    gap: ws(8),
  },
  chipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: ws(1),
    paddingHorizontal: ws(12),
    paddingVertical: hs(6),
    borderRadius: ws(16),
  },
  chipText: {
    color: '#cbd5e1',
    fontSize: fs(11.5),
    fontWeight: '600',
  },
  transcriptContainer: {
    flex: 1,
    backgroundColor: '#0c1322',
    marginHorizontal: ws(16),
    marginVertical: hs(6),
    borderRadius: ws(16),
    borderWidth: ws(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ws(14),
    paddingVertical: hs(10),
    backgroundColor: '#111a2e',
    borderBottomWidth: ws(1),
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  transcriptTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ws(6),
  },
  transcriptHeaderTitle: {
    color: '#94a3b8',
    fontSize: fs(11),
    fontWeight: '800',
    letterSpacing: ws(0.8),
    textTransform: 'uppercase',
  },
  liveIndicatorDot: {
    width: ws(6),
    height: ws(6),
    borderRadius: ws(3),
    backgroundColor: '#00F260',
  },
  clearText: {
    color: '#FF4B4B',
    fontSize: fs(11.5),
    fontWeight: '700',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: ws(14),
  },
  emptyStateContainer: {
    paddingVertical: hs(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    color: '#00F2FE',
    fontSize: fs(14),
    fontWeight: '800',
    marginBottom: hs(4),
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: fs(12),
    textAlign: 'center',
    lineHeight: hs(18),
    paddingHorizontal: ws(16),
  },
  controlBar: {
    paddingHorizontal: ws(16),
    paddingBottom: hs(12),
    paddingTop: hs(4),
  },
  muteButton: {
    paddingVertical: hs(13),
    borderRadius: ws(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: ws(8),
    elevation: 6,
  },
  muteButtonActive: {
    backgroundColor: '#0284c7',
  },
  muteButtonPaused: {
    backgroundColor: '#059669',
  },
  muteButtonText: {
    color: '#ffffff',
    fontSize: fs(13.5),
    fontWeight: '900',
    letterSpacing: ws(1.2),
  },
  envBadge: {
    paddingHorizontal: ws(7),
    paddingVertical: hs(2),
    borderRadius: ws(6),
    borderWidth: ws(1),
  },
  envDev: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#0284c7',
  },
  envProd: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  envBadgeText: {
    color: '#ffffff',
    fontSize: fs(10),
    fontWeight: '900',
    letterSpacing: ws(0.5),
  },
});
