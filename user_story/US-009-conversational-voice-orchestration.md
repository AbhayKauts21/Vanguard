# US-009: Conversational Voice Orchestration

## 📝 User Story
**As a** User,  
**I want** voice mode to feel like a natural back-and-forth conversation while still showing me the full grounded answer,  
**so that** I can read the complete RAG response, hear a concise spoken reply, and interrupt naturally with my own voice at any time.

## ✅ Acceptance Criteria
- [x] Keep the full RAG answer as the canonical assistant response in chat/history.
- [x] Generate a separate short `voice_response` for voice mode using the general chat model without changing the stored answer.
- [x] Limit spoken replies to a concise conversational format that can include a relevant next step or follow-up.
- [x] Make normal chat retrieval-first for every query, with confidence-based routing between `rag`, `uncertain`, and general fallback.
- [x] Prevent greetings, small talk, and general questions from surfacing misleading low-confidence RAG uncertainty responses.
- [x] Prepare voice turns on the backend by generating the final answer, the spoken rewrite, and pre-synthesized audio before release.
- [x] Emit a `voice_ready` SSE event so prepared audio and the full text answer arrive in a synchronized, low-lag sequence.
- [x] Speak the short voice response in the background while keeping the full RAG markdown answer visible and interactive in chat.
- [x] Hide the short spoken summary from the visible UI and keep the voice HUD focused on status and user transcript only.
- [x] Support voice-only interruption during playback, including repeated cut-ins across consecutive turns.
- [x] Preserve interrupt speech as the seed for the next listening turn when available.
- [x] Add a stable global `next-intl` timezone to avoid environment fallback warnings and markup mismatch risk.

## 🛠 Technical Mapping (Current Branch)
| Feature ID | Title | Module |
|---|---|---|
| G-007 | **Voice Conversation Rewrite Service** | `backend/app/services/voice_conversation_service.py` |
| G-008 | **Prepared Voice Turn Orchestration** | `backend/app/services/chat_service.py` |
| G-009 | **Retrieval-First Confidence Routing** | `backend/app/services/rag_service.py` |
| G-010 | **Voice-Ready SSE Delivery** | `backend/app/api/router_chat.py` |
| G-011 | **Prepared Audio Metadata Support** | `backend/app/services/tts_service.py` |
| G-012 | **Frontend Voice-Ready Playback Flow** | `frontend/src/domains/voice/hooks/useVoiceMode.ts` |
| G-013 | **Spoken Interrupt Monitor** | `frontend/src/domains/voice/hooks/useSpokenInterruptMonitor.ts` |
| G-014 | **Speech Activity Barge-In Gate** | `frontend/src/domains/voice/hooks/useBargeInMonitor.ts` |
| G-015 | **Interrupt Intent Heuristics** | `frontend/src/domains/voice/model/interrupt-intent.ts` |
| G-016 | **Audio-Only Voice HUD** | `frontend/src/components/voice/VoiceTranscript.tsx` |
| G-017 | **Voice-Ready SSE Types & Parser** | `frontend/src/types/index.ts`, `frontend/src/lib/api/sse-parser.ts` |
| G-018 | **Stable Intl Time Zone Config** | `frontend/src/i18n/request.ts`, `frontend/src/app/providers.tsx` |

## 📊 Status
- **Status**: ✅ Completed
- **Outcome**: Voice mode now delivers a synchronized conversational spoken layer on top of the full grounded chat answer, with retrieval-first routing and voice-only interruption across repeated turns.
