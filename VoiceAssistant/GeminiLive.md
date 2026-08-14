# Gemini Live "AI Chief of Staff" — Project Brief & Architecture

**Prepared for:** Vivek Mishra / Arun Verma / Nayan Bhuva
**Stack:** React Native CLI (not Expo) + native modules (iOS/Android)
**Date:** 2026-08-13

---

## 1. App skeleton (React Native CLI)

This is the baseline project layout the assistant will be built on top of. It's a standard
RN-CLI structure with native module folders added for the voice/background pieces this
requirement needs (see §4).

```
App.tsx                      # App entry (providers + navigation)
assets/
  fonts/                     # bundled fonts
  images/                    # PNG assets (see src/utils/appImages.ts)
  svgs/                      # SVG icons (see assets/svgs/index.ts)
src/
  components/                # shared UI components (AppButton, AppText, AppTextInput, ...)
  constants/                 # constants like route names (AppScreens)
  i18n/                      # i18n setup + locale files
  interface/                 # design system utilities (colors, metrics)
  navigation/                # stack + tabs navigation
  redux/                     # store, reducers, slices, hooks OR Zustand
  screens/                   # feature screens (intro/login/home/...)
  services/                  # API clients (axios instance)
  utils/                     # storage (MMKV), typography, assets mapping, etc.
  validation/                # Yup schemas / validation helpers

# Additions needed for this project specifically:
android/app/src/main/java/.../voicebridge/   # native Android module (foreground service, mic, VAD wake)
ios/VoiceBridge/                             # native iOS module (AVAudioSession, background audio mode)
src/native/                                  # JS bridge wrappers around the native modules above
src/agent/                                   # Gemini Live session manager, state machine, tool/function handlers
src/agent/tools/                             # function-calling handlers: calendar, tasks, orders, timers
src/scheduler/                               # local re-engagement scheduling (independent of any open session)
```

**Why native modules are unavoidable here** (not a "nice to have"): a JS-only RN app cannot
(a) keep a microphone/audio session alive once the screen is off or the app is backgrounded,
(b) run a wake-up timer that reliably fires 35 minutes later regardless of OS memory pressure,
or (c) get through iOS's background-execution restrictions for arbitrary networking. All three
are core to "put phone away, get proactively re-engaged" — so native background audio +
scheduling modules are in scope from day one, not a later optimization.

---

## 2. What the requirement actually needs (plain read)

Stripping the example down, there are really **four separable capabilities**, and conflating
them is the most common way these builds go wrong:

1. **Live two-way voice conversation** — talk to Gemini, it talks back, natural turn-taking,
   barge-in. This is what the Gemini Live API is for.
2. **Proactive re-engagement on a timer/state trigger** — "come back and speak to me in 35
   minutes" is *not* a live-conversation feature. It's a scheduling problem.
3. **Structured capture with confirmation** — "save this: James ordered 250 units for
   Thursday" → parse → write to a store → speak back a confirmation. This is a
   function-calling problem, not a raw-transcription problem.
4. **Reasoning over the day's state** — prioritization, payment allocation — this is a
   text/agentic reasoning problem that can reuse Gemini (non-Live, or Live in text mode) once
   the state (calendar, tasks, notes) is assembled.

The critical architectural point: **#1 and #2 do not compose the way the example implies.**

---

## 3. The core technical issue: Gemini Live cannot "wait 35 minutes and then speak"

This needs to be said plainly because it changes the whole design and the MVP timeline:

- A Gemini Live session is a persistent WebSocket connection with a **hard cap of ~15 minutes
  for audio-only sessions** (2 minutes if video is included), after which the connection is
  terminated. Context resumption lets you reconnect and restore history, but you cannot hold
  one open session idle across a 35-minute gap and expect it to "wake up" on its own.
- "Proactive audio" (currently in preview) means the model decides **whether to respond within
  an active session** — e.g. staying silent during ambient chatter that isn't directed at it.
  It is not a background scheduler. It doesn't run when there's no open connection.
- Keeping a live audio session open and billing the whole time just so the model can maybe
  speak up 35 minutes later would be both expensive (audio tokens are billed continuously) and
  a battery/OS-background nightmare on both platforms.

**Correct architecture:** treat re-engagement as a **local, device-native scheduling problem**,
and treat Gemini Live sessions as **short-lived, triggered by events** (user speaks, or a
scheduled check-in fires). Concretely:

```
User: "I'm staying here for 40 minutes."
        │
        ▼
Gemini Live session parses intent via function calling
        │
        ▼
Calls a local tool: schedule_checkin(duration=40min, warn_before=5min)
        │
        ▼
Native scheduler (JS scheduler/ + native alarm/WorkManager/BGTaskScheduler)
persists this to on-device state (MMKV) — session can now close.
        │
        ▼
   ... 35 minutes pass, app backgrounded, no open connection ...
        │
        ▼
Native alarm fires → app (or a lightweight background handler) opens a
NEW short-lived Gemini Live session → speaks "5 minutes left" → listens
for reply → user says "give me another 10" → function call updates the
schedule → session closes again.
```

This is the only version of this that is battery-sane, cost-sane, and survives how both
mobile OSes actually treat backgrounded apps.

---

## 4. Native module requirements (this is the hard part, not the UI)

| Concern | Android | iOS |
|---|---|---|
| Keep mic session usable while backgrounded | Foreground Service w/ microphone type + persistent notification | `AVAudioSession` category `.playAndRecord` + `UIBackgroundModes: audio` |
| Reliable "come back in N minutes" | `WorkManager` / `AlarmManager` (exact alarms need special permission on Android 12+) | `BGTaskScheduler` (best-effort, **not** exact — iOS does not guarantee wake time) |
| Re-open a Live session from background | Foreground service can open the WebSocket directly | Must use a background audio session or a silent push to bring the app forward briefly |
| Battery/OS kill resistance | Doze/App Standby exceptions needed | iOS is materially more restrictive here — this is the biggest platform risk |

**Be upfront with the client:** iOS does not guarantee background wake timing the way the "5
minutes left, right on schedule" example implies. `BGTaskScheduler` is best-effort and the OS
can delay or skip it under battery/usage pressure. A local notification at T-5 ("Tap to talk")
is a reliable fallback; a fully autonomous voice interruption on iOS without any user tap is
the ambitious/least-guaranteed part of this spec and should be flagged as such, not silently
promised. Android's foreground-service route is materially more reliable for true proactive
voice.

---

## 5. Integration surface

- **Google Calendar API** — read upcoming events for "what comes next," write events from
  voice ("book 30 min with James Thursday").
- **Google Tasks API** — simple task capture; use as the backing store for voice-captured
  to-dos and orders rather than inventing a custom note format — it's free infra and
  cross-device by default.
- **Gemini function calling** — the Live session should expose tools like `create_task`,
  `save_order`, `schedule_checkin`, `query_calendar`, `prioritize_tasks`. The model calls
  these; your app executes them and returns results into the session (Live API requires you
  to handle tool responses manually — there's no auto-exec).
- **Reasoning tasks** (prioritization, payment allocation) don't need to happen inside the
  Live voice session at all — they can run as a normal (non-Live) Gemini call over the
  assembled state (calendar + tasks + notes) and be *read out* by a short Live session, or
  even just TTS'd. Don't force everything through the expensive Live channel.

---

## 6. Session/connection design notes

- **Server-to-server is the right default**, not client-to-server: your backend holds the API
  key and manages the WebSocket; the RN app streams mic audio to your backend, which forwards
  to Gemini Live. Client-to-server (RN app talking directly to Gemini) requires issuing
  short-lived ephemeral tokens and is harder to reason about for a personal assistant that also
  needs to write to Calendar/Tasks with proper OAuth — a thin backend is worth having anyway.
- **Session length discipline**: design every Live session to be short and purposeful (a
  single check-in, a single capture-and-confirm), not one long-running "always on" session.
  This sidesteps the 15-minute cap entirely and keeps cost predictable.
- **Cost shape**: Live audio is priced per audio token (roughly single-digit cents per 10
  minutes of use), so a design built on frequent *short* sessions rather than one long
  always-listening session is also the cheaper one — the architecture that's technically
  correct here is also the one that's affordable at daily-use volume.

---

## 7. Proposed MVP scope (fastest path to something real)

**Phase 1 — Project setup + Assistant screen with voice-on-open and background capture (no backend yet)**

Since the backend isn't built yet, Phase 1's real goal is to get the *hardest native plumbing*
— mic capture that starts automatically and survives backgrounding — proven out against a
stub, so Phase 2 can drop the real Gemini Live backend in without touching UI or native code.

**7.1 Project setup**
- `react-native init` (bare CLI, TypeScript template) — not Expo, per the native-module
  requirement in §4
- Install: navigation, state (Zustand or Redux), MMKV, `react-native-permissions`, and a raw
  PCM audio-streaming layer (not a simple "record to file" recorder — Live API needs a
  continuous chunked PCM stream, so this will end up being a thin custom native module rather
  than an off-the-shelf recorder library)
- Scaffold the folder structure from §1, including `src/native/` and `src/agent/` as empty
  interfaces to be filled in Phase 2

**7.2 Native module — build now, even without a backend**
- **Android:** foreground service (microphone type) + `AudioRecord`-based capture, streaming
  PCM chunks to JS via an event emitter; request `RECORD_AUDIO` + foreground-service-microphone
  permissions
- **iOS:** `AVAudioSession` category `.playAndRecord` + `UIBackgroundModes: audio`;
  `AVAudioEngine` tap streaming PCM buffers to JS via native events
- JS bridge surface: `startCapture()`, `stopCapture()`, `onAudioChunk(cb)`, plus lifecycle
  events for foreground/background transitions
- This is deliberately the *same* module Phase 2 wires into the real Live WebSocket — proving
  it now, against a stub, catches the background-audio problems early instead of after the
  backend exists

**7.3 Assistant screen UI**
- Explicit visual states: `idle / listening / thinking / speaking / error` (pulsing mic icon or
  waveform + status text — should be readable at a glance, not just color)
- Capture **auto-starts on screen open**, right after permission is granted (the "voice on
  open" requirement)
- Rolling transcript (user/assistant turn bubbles), auto-scroll to latest
- A manual mute/pause control stays visible even in a "hands-free" product — don't remove user
  agency for the sake of the pitch
- Persistent indicator while backgrounded — Android requires this anyway for the foreground
  service notification, and it also keeps the user honestly informed the mic is live

**7.4 Stub AI layer (stand-in for the backend)**
- No real Gemini round-trip yet. Buffer incoming audio chunks; on a pause/silence gap, surface
  a canned response into the transcript to exercise the full state machine
- Isolate the swap point behind a single `src/agent/` session-manager interface, so Phase 2
  replaces the stub with the real WebSocket client without touching UI or native code
- This validates permission → capture → backgrounding → UI state → transcript end-to-end
  *before* there's a backend to blame or debug against

**7.5 Background-behavior validation (explicit test matrix)**
- Foreground, screen locked, home-backgrounded, and OS-suspended-then-resumed — test all four
  on real devices, not simulators (mic/background behavior doesn't simulate reliably)
- Android: confirm the foreground-service notification persists and capture doesn't drop
- iOS: confirm the audio session survives backgrounding; note again per §4 that iOS will not
  survive a full OS force-kill the way "always listening" implies — that's a known platform
  ceiling to document here, not a bug to chase in Phase 1

**7.6 Phase 1 exit criteria**
- Installs and runs on a real Android device and a real iOS device
- Assistant screen requests mic permission and starts listening automatically on open
- Backgrounding (not force-killing) the app keeps capture alive and the UI reflects state
  correctly on return
- Stubbed turns render correctly in the transcript
- Native bridge is stable enough that Phase 2 only needs to plug in the real backend
  connection — no UI or native rework

**Phase 2 — Calendar write + prioritization reasoning**
- Two-way Calendar sync
- A daily-state assembly job (calendar + tasks + notes) feeding a reasoning call for
  prioritization, read back on request or at check-ins

**Phase 3 — Robustness**
- iOS background reliability hardening (silent push wake-up path)
- Multi-timer state (more than one "come back to me" pending at once)
- Payment-allocation reasoning tool

I'd recommend **not** promising fully autonomous, tap-free proactive voice on iOS for the MVP —
build it on Android first where the guarantee is real, and ship iOS with a local-notification
tap-to-talk fallback for check-ins until background reliability is proven out.

---

## 8. Open questions for the client before estimating

- Is a thin backend (for the server-to-server Live relay, OAuth token storage, and the
  scheduling trigger) acceptable, or is this meant to be fully on-device/serverless?
- Android-first MVP with iOS fallback UX — acceptable, given the platform's background
  constraints described above?
- Expected concurrent "pending check-ins" per day (one at a time vs. several)?
- Any existing Google Workspace/OAuth setup already in place for Calendar/Tasks?