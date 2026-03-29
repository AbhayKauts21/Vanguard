# 🎙️ CLEO Voice Pipeline — Full Implementation Plan

> **Branch (Frontend):** `feature/voice-pipeline-frontend`
> **Branch (Backend):** `feature/voice-pipeline-backend`
> **Date:** 2026-03-27
> **Status:** Planning

---

## 1. Executive Summary

Add a full **voice-to-voice conversational mode** to CLEO. The user clicks a mic button → speaks → CLEO listens, transcribes, processes (RAG/Azure routing), streams a response, and **speaks it back** via synthesized audio — all while the Energy Core avatar reacts in real time to each phase of the interaction (listening → processing → speaking).

Text transcriptions are shown for both sides (user speech + CLEO response) with production-grade aesthetics matching the existing neural interface design.

---

## 2. Technology Options Analysis

### 2.1 Speech-to-Text (STT) — User Voice Input

| Option | Pros | Cons | Cost | Recommendation |
|--------|------|------|------|----------------|
| **Web Speech API (SpeechRecognition)** | Zero cost, zero dependency, built into Chrome/Edge/Safari. Real-time interim results. No backend round-trip. | Firefox support limited (needs flag). No custom model training. Relies on browser's cloud service. | Free | ✅ **Primary choice** — best DX, zero latency for interim transcripts |
| **Azure Speech SDK (JS)** | Enterprise-grade, custom models, multilingual, 80+ languages, real-time streaming, word-level timestamps | Requires Azure subscription, ~$1/hr audio, SDK bundle size (~2MB) | ~$1/hr | 🔶 **Upgrade path** — for production with custom vocabulary |
| **Whisper (OpenAI API)** | Highest accuracy, handles accents beautifully | Not real-time (file upload), latency 2-5s for transcription | $0.006/min | ❌ Not suitable for real-time voice mode |
| **Deepgram** | Real-time WebSocket streaming, very fast, great accuracy | External vendor dependency, cost | ~$0.0059/min | 🔶 Alternative to Azure Speech |
| **Vosk (local WASM)** | Fully offline, privacy-friendly, open source | Large model download (50MB+), lower accuracy than cloud | Free | ❌ Too heavy for web, accuracy trade-off |

**Decision: Web Speech API as primary STT** — it's free, instant, supports interim results for live transcription, and works in all Chromium browsers + Safari. We add an abstraction layer so we can swap to Azure Speech SDK later.

### 2.2 Text-to-Speech (TTS) — CLEO Voice Output

| Option | Pros | Cons | Cost | Recommendation |
|--------|------|------|------|----------------|
| **Azure TTS (Neural voices)** | 400+ neural voices, SSML control, streaming audio, word-level timestamps for lip-sync, custom voice cloning | Requires Azure subscription, network latency | ~$16/1M chars | ✅ **Primary choice** — already have Azure infra, best quality |
| **Web Speech API (SpeechSynthesis)** | Free, zero dependency, instant | Robotic voices, no streaming control, no word-level events for avatar sync, inconsistent across browsers | Free | 🔶 **Fallback** for offline/demo mode |
| **ElevenLabs** | Best voice quality, voice cloning, streaming, WebSocket API | Expensive at scale, external dependency | ~$0.30/1K chars | ❌ Cost prohibitive |
| **OpenAI TTS** | Good quality, simple API | No streaming (must download full audio), limited voices | $15/1M chars | ❌ No streaming = bad UX for voice mode |
| **Coqui TTS (local)** | Open source, self-hosted | Requires GPU server, complex setup | Server cost | ❌ Too complex for our architecture |

**Decision: Azure TTS (REST streaming) as primary** — we already have Azure OpenAI configured. Azure Speech is in the same ecosystem. We'll stream audio chunks back to achieve near-real-time speech output synced with the text stream. Web Speech API as offline fallback.

### 2.3 Audio Processing & Visualization

| Library | Purpose | Size |
|---------|---------|------|
| **Web Audio API (native)** | Audio analysis, waveform visualization, volume metering | 0KB (built-in) |
| **Tone.js** | Advanced audio scheduling and effects | ~150KB |
| **Howler.js** | Cross-browser audio playback | ~10KB |

**Decision: Native Web Audio API** — zero bundle cost, gives us `AnalyserNode` for real-time frequency data to drive avatar animations.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  VoiceMode   │  │  VoiceStore  │  │  EnergyCoreCanvas       │  │
│  │  Button      │──│  (Zustand)   │──│  (Three.js + sync)      │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────────────┘  │
│         │                  │                                        │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌─────────────────────────┐  │
│  │  STT Engine  │  │  TTS Engine  │  │  VoiceTranscript        │  │
│  │  (Web Speech │  │  (Azure TTS  │  │  (floating text overlay) │  │
│  │   API)       │  │   Stream)    │  │                          │  │
│  └──────┬───────┘  └──────▲───────┘  └─────────────────────────┘  │
│         │                  │                                        │
│         ▼                  │                                        │
│  ┌──────────────────────────────────┐                              │
│  │  useChatStream (existing hook)   │                              │
│  │  + voice mode orchestration      │                              │
│  └──────────────┬───────────────────┘                              │
│                  │ SSE /api/v1/chat/stream                          │
└──────────────────┼──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                            │
│                                                                     │
│  ┌───────────────────────────┐  ┌─────────────────────────────┐   │
│  │  POST /api/v1/chat/stream │  │  POST /api/v1/voice/tts     │   │
│  │  (existing — no change)   │  │  (NEW — Azure TTS stream)   │   │
│  └───────────┬───────────────┘  └──────────────┬──────────────┘   │
│              │                                   │                  │
│  ┌───────────▼───────────────┐  ┌──────────────▼──────────────┐   │
│  │  RAG Service              │  │  TTS Service                 │   │
│  │  (confidence routing)     │  │  (Azure Speech SDK)          │   │
│  └───────────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Data Flow — Voice Mode Lifecycle

```
1. User clicks 🎙️ → VoiceStore: phase = "listening"
   → EnergyCoreCanvas → "listening" profile (amber pulsing, tilt motion)
   → STT Engine starts (Web Speech API continuous mode)

2. User speaks → interim transcripts shown in real-time in VoiceTranscript overlay
   → words appear with typewriter animation

3. User stops speaking (silence detected / clicks stop)
   → VoiceStore: phase = "processing"
   → EnergyCoreCanvas → "syncing" profile (orange, fast rotation)
   → Final transcript → useChatStream.sendStream(transcript)

4. SSE tokens stream back
   → VoiceStore: phase = "speaking"
   → EnergyCoreCanvas → "speech" profile (emerald, breathing pulse)
   → Tokens accumulated → sentence chunking → TTS API call per sentence
   → Audio chunks queued → Web Audio API playback
   → AnalyserNode → frequency data → EnergyCoreCanvas heartbeat sync

5. All audio played
   → VoiceStore: phase = "idle"
   → EnergyCoreCanvas → "idle" profile (blue, slow drift)
```

---

## 4. Energy Core Avatar Sync States

We extend the existing `EnergyCoreVisualState` with new voice-specific profiles:

| Phase | Core State | Color | Speed | Noise | Breath | Visual Effect |
|-------|-----------|-------|-------|-------|--------|---------------|
| **Idle** | `idle` | `#4c7fff` (blue) | 0.050 | 0.028 | slow | Calm drift |
| **Listening** | `listening` | `#a855f7` (purple) | 0.085 | 0.042 | medium | Subtle inward pulse, "ear" effect |
| **Processing** | `syncing` | `#ff9f1c` (amber) | 0.105 | 0.050 | fast | Rapid energy surge |
| **Speaking** | `speaking` | `#22d3c5` (teal) | dynamic | dynamic | dynamic | **Audio-reactive** — noise/scale driven by `AnalyserNode` frequency data |
| **Error** | `error` | `#ef4444` (red) | 0.020 | 0.015 | slow | Dim, stuttered |

The key innovation is the **speaking** state becoming audio-reactive: the `AnalyserNode` provides real-time frequency data (0-255 per band) which modulates:
- `uNoiseIntensity` → vertex displacement (mouth/breath effect)
- `scale` → overall size pulse (heartbeat)
- `breathSpeed` → synced to speech cadence

---

## 5. Implementation Phases

### Phase V1: Foundation — Voice Store + STT Engine (Frontend)
**Branch:** `feature/voice-pipeline-frontend`
**Commits:** conventional (`feat:`, `refactor:`)

#### Files to Create:
```
frontend/src/domains/voice/
├── model/
│   ├── voice-store.ts              # Zustand store: phase, transcript, audioLevel, isVoiceMode
│   └── types.ts                    # VoicePhase, VoiceConfig, STTResult
├── hooks/
│   ├── useVoiceMode.ts             # Orchestrator: STT → chat → TTS → avatar sync
│   ├── useSpeechRecognition.ts     # Web Speech API abstraction
│   └── useAudioAnalyser.ts         # Web Audio API AnalyserNode for avatar sync
├── engine/
│   ├── stt-engine.ts               # STT abstraction layer (Web Speech API impl)
│   ├── tts-engine.ts               # TTS abstraction layer (Azure TTS impl)
│   ├── audio-queue.ts              # Audio chunk queue + sequential playback
│   └── sentence-chunker.ts         # Splits streaming tokens into speakable sentences
└── api/
    └── voice-api.ts                # TTS endpoint client
```

#### Files to Create (Components):
```
frontend/src/components/voice/
├── VoiceModeButton.tsx             # Mic button with glow animation
├── VoiceTranscript.tsx             # Floating transcript overlay (user + CLEO)
├── VoiceWaveform.tsx               # Real-time audio waveform visualizer
└── index.ts
```

#### Files to Modify:
```
frontend/src/components/chat/Composer.tsx           # Add mic button
frontend/src/components/layout/CleoInterface.tsx     # Wire voice mode
frontend/src/domains/avatar/model/energy-core.ts     # Add "listening" state
frontend/src/domains/avatar/model/types.ts           # (already has "listening")
frontend/src/components/avatar/EnergyCoreCanvas.tsx   # Add listening + audio-reactive profiles
frontend/src/lib/env/index.ts                         # Add voice env flags
frontend/src/types/index.ts                           # Voice-related types
```

---

### Phase V2: Backend TTS Endpoint
**Branch:** `feature/voice-pipeline-backend`

#### Files to Create:
```
backend/app/api/router_voice.py              # POST /api/v1/voice/tts (streaming audio)
backend/app/services/tts_service.py          # Azure Speech SDK integration
backend/app/adapters/azure_speech_client.py  # Azure Speech SDK adapter
```

#### Files to Modify:
```
backend/main.py                              # Register voice router
backend/app/core/config.py                   # Azure Speech env vars
backend/requirements.txt                     # azure-cognitiveservices-speech
backend/app/domain/schemas.py                # TTSRequest, TTSResponse schemas
```

#### New Backend API:
```http
POST /api/v1/voice/tts
Content-Type: application/json

{
  "text": "Hello, I found these results...",
  "voice": "en-US-JennyNeural",
  "rate": "+0%",
  "pitch": "+0Hz"
}

Response: audio/mpeg (streaming binary)
```

---

### Phase V3: Voice Mode Orchestration + Avatar Sync
**Branch:** `feature/voice-pipeline-frontend`

**Key Logic — `useVoiceMode.ts` orchestration:**
```
startVoiceMode()
  → voiceStore.setPhase("listening")
  → sttEngine.start()
  → on interim result → voiceStore.setTranscript(interim)
  → on final result:
      → voiceStore.setPhase("processing")
      → chatStream.sendStream(finalTranscript)
      → on first token:
          → voiceStore.setPhase("speaking")
          → sentenceChunker.feed(token)
      → on sentence ready:
          → ttsEngine.speak(sentence) → audio queue
          → audioAnalyser.connect(audioElement)
          → frequency data → voiceStore.setAudioLevel(level)
      → on done:
          → wait for audio queue drain
          → voiceStore.setPhase("idle")

stopVoiceMode()
  → sttEngine.stop()
  → ttsEngine.stop()
  → audioQueue.flush()
  → voiceStore.reset()
```

**Energy Core Audio Reactivity:**
- During `speaking` phase, `useAudioAnalyser` provides 0-1 normalized amplitude
- This value is passed to `EnergyCoreCanvas` as a new `audioLevel` prop
- The shader uniforms `uNoiseIntensity` and `scale` are modulated: `base + audioLevel * multiplier`
- Result: the core "breathes" and pulses in sync with CLEO's voice output

---

### Phase V4: UI/UX Polish + Text Display
**Branch:** `feature/voice-pipeline-frontend`

#### Voice Transcript Overlay Design:
```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  "What are the BookStack features?" │   │  ← User speech (right-aligned)
│   │                      ── Operator 🎤  │   │     faded glass pill, typewriter in
│   └─────────────────────────────────────┘   │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  🔊 CLEO ──                         │   │  ← CLEO speech (left-aligned)
│   │  "BookStack offers page versioning, │   │     emerald glow border
│   │   role-based access control, and... │   │     words appear as spoken
│   └─────────────────────────────────────┘   │
│                                             │
│              ┌──────────────┐               │
│              │  ◉ Listening │               │  ← Status indicator
│              └──────────────┘               │
└─────────────────────────────────────────────┘
```

**Styling Rules:**
- Glass-morphism pills matching existing `.glass-panel` aesthetic
- User text: right-aligned, `bg-white/[0.08]`, monospace typewriter effect
- CLEO text: left-aligned, `bg-emerald-500/[0.05]`, words fade in as spoken
- Status pill: phase indicator with pulsing dot (purple=listening, amber=processing, teal=speaking)
- Smooth entry/exit with `framer-motion` (already in deps)

---

### Phase V5: Testing + Error Handling

#### Error Cases:
| Error | Handling |
|-------|----------|
| Microphone denied | Show permission dialog, fallback to text mode |
| STT not supported | Show browser compatibility warning |
| TTS endpoint fails | Fallback to Web Speech API synthesis |
| Network loss during voice | Graceful stop, show text transcript |
| User interrupts while CLEO speaks | Stop TTS, flush audio queue, return to listening |

#### Test Files:
```
frontend/src/domains/voice/model/__tests__/voice-store.test.ts
frontend/src/domains/voice/engine/__tests__/sentence-chunker.test.ts
frontend/src/domains/voice/engine/__tests__/audio-queue.test.ts
frontend/src/components/voice/__tests__/VoiceModeButton.test.tsx
backend/tests/unit/test_tts_service.py
backend/tests/unit/test_router_voice.py
```

---

## 6. Environment Variables

### Frontend (.env.local):
```env
NEXT_PUBLIC_ENABLE_VOICE_MODE=true
NEXT_PUBLIC_TTS_VOICE=en-US-JennyNeural
NEXT_PUBLIC_STT_LANGUAGE=en-US
NEXT_PUBLIC_VOICE_SILENCE_TIMEOUT_MS=2000
```

### Backend (.env):
```env
AZURE_SPEECH_KEY=<your-azure-speech-key>
AZURE_SPEECH_REGION=eastus
AZURE_TTS_VOICE=en-US-JennyNeural
AZURE_TTS_OUTPUT_FORMAT=audio-16khz-128kbitrate-mono-mp3
```

---

## 7. Commit Strategy (Conventional Commits)

Each phase delivers small, atomic commits:

```
feat(voice): add voice domain store with phase management
feat(voice): implement Web Speech API STT engine abstraction
feat(voice): add sentence chunker for streaming TTS
feat(voice): create VoiceModeButton component with mic glow animation
feat(voice): add VoiceTranscript overlay with typewriter effect
feat(avatar): extend EnergyCoreCanvas with listening profile
feat(avatar): add audio-reactive speaking mode to energy core
feat(voice): implement useVoiceMode orchestration hook
feat(voice): add VoiceWaveform real-time visualizer
feat(api): add TTS streaming endpoint (POST /api/v1/voice/tts)
feat(backend): integrate Azure Speech SDK for TTS
refactor(chat): add mic button to Composer component
feat(voice): wire voice mode into CleoInterface layout
test(voice): add voice store unit tests
test(voice): add sentence chunker tests
test(backend): add TTS endpoint tests
style(voice): polish transcript overlay animations
docs(voice): add voice pipeline implementation plan
```

---

## 8. Dependencies to Add

### Frontend (package.json):
```json
{
  "dependencies": {
    // No new deps needed! Web Speech API + Web Audio API are browser-native.
    // Azure TTS is called via REST from backend.
    // framer-motion already installed for animations.
  }
}
```

### Backend (requirements.txt):
```
azure-cognitiveservices-speech>=1.37.0
```

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Web Speech API browser support | Feature detection + graceful degradation to text-only |
| Azure TTS latency | Sentence-level chunking (don't wait for full response) |
| Audio playback jank | Pre-buffered audio queue with crossfade |
| Mobile support | Touch-friendly mic button, haptic feedback |
| Concurrent voice + text input | Mutex in voice store — voice mode disables text input |
| Memory leaks (audio contexts) | Strict cleanup in useEffect returns |

---

## 10. Success Metrics

- **Voice-to-first-audio latency:** < 3 seconds (user stops speaking → CLEO starts speaking)
- **Transcription accuracy:** > 95% (English, quiet environment)
- **Avatar sync fidelity:** Audio amplitude → core displacement within 1 frame (16ms)
- **Zero regressions:** All existing chat tests pass
- **Mobile-friendly:** Voice mode works on Chrome Mobile + Safari iOS

---

## 11. File Tree Summary (All New Files)

```
frontend/src/
├── domains/voice/
│   ├── model/
│   │   ├── voice-store.ts
│   │   └── types.ts
│   ├── hooks/
│   │   ├── useVoiceMode.ts
│   │   ├── useSpeechRecognition.ts
│   │   └── useAudioAnalyser.ts
│   ├── engine/
│   │   ├── stt-engine.ts
│   │   ├── tts-engine.ts
│   │   ├── audio-queue.ts
│   │   └── sentence-chunker.ts
│   └── api/
│       └── voice-api.ts
├── components/voice/
│   ├── VoiceModeButton.tsx
│   ├── VoiceTranscript.tsx
│   ├── VoiceWaveform.tsx
│   └── index.ts

backend/app/
├── api/router_voice.py
├── services/tts_service.py
├── adapters/azure_speech_client.py
```

---

## 12. Execution Order

| Step | Phase | Branch | Estimated Effort |
|------|-------|--------|------------------|
| 1 | V1 — Voice Store + Types + STT Engine | `feature/voice-pipeline-frontend` | 4-6 hours |
| 2 | V2 — Backend TTS Endpoint | `feature/voice-pipeline-backend` | 3-4 hours |
| 3 | V1 — VoiceModeButton + Composer integration | `feature/voice-pipeline-frontend` | 2-3 hours |
| 4 | V3 — useVoiceMode orchestration | `feature/voice-pipeline-frontend` | 4-6 hours |
| 5 | V3 — Energy Core audio-reactive sync | `feature/voice-pipeline-frontend` | 3-4 hours |
| 6 | V4 — VoiceTranscript overlay + polish | `feature/voice-pipeline-frontend` | 3-4 hours |
| 7 | V5 — Testing + error handling | Both branches | 3-4 hours |
| **Total** | | | **~22-31 hours** |

---

*This plan is ready for implementation. Each phase produces a working increment that can be tested independently.*
