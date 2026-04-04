# US-005: Voice Intelligence 2.0

## 📝 User Story
**As a** User,
**I want** to engage in a realistic, natural vocal conversation with the AI,
**so that** I can communicate hands-free and experience an AI that understands "vibes" and conversational nuances.

## ✅ Acceptance Criteria
- [x] Implement a "Vibe Selector" to adjust the sentiment and tone of the AI (Professional, Clinical, Empathic).
- [x] Develop sentiment-aware SSML voice synthesis to inject emotional nuances into the AI's voice.
- [x] Implement manual interruption logic to stop the AI's speech when the user starts speaking.
- [x] Add auto-mute and manual interrupt controls for speech-to-text (STT) capture.
- [x] Refine RAG system prompts for more natural conversational flow (openings/closings).
- [x] Implement smart "small talk" routing to suppress uncertainty banners for conversational filler.
- [x] Integrate manual interrupt controls into the UI (QuickActionToast).
- [x] Propagate voice mode and vibe flags throughout the LLM pipeline for consistent responses.

## 🛠 Technical Mapping (Git History / Recent)
| Feature ID | Title | Module |
|---|---|---|
| G-001 | **Vibe Selector Component** | `frontend/src/domains/voice/components/VibeSelector.tsx` |
| G-002 | **Sentiment-Aware SSML** | `backend/app/services/llm_client.py` |
| G-003 | **STT Interruption logic** | `frontend/src/domains/voice/engine/stt-engine.ts` |
| G-004 | **Manual Interrupt Logic** | `frontend/src/domains/voice/hooks/useHeyGenAvatar.ts` |
| G-005 | **Unified Smart-Talk Routing** | `backend/app/services/rag_service.py` |
| G-006 | **Vibe-Aware Visual Reactivity** | `frontend/src/components/effects/` |

## 📊 Status
- **Status**: ✅ Completed (Neural Link 2.0)
- **Experimental**: Successfully implemented manual interrupt logic to handle asynchronous vocal exchanges.
