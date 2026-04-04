# US-001: Neural Link 2.0 (Smart Voice)

## Status: Draft
**Reference**: Voice Mode Upgrade (Hackathon Feature)

## User Story
**As an** Operator on the move,
**I want** a smart, interactive, and emotionally aware voice interface,
**So that** I can have a natural, low-latency conversation with CLEO that respects my context and feelings.

## Acceptance Criteria

### 1. Interactive Interruption (Full-Duplex)
- [ ] During the `speaking` phase, the microphone must remain active and monitor user input.
- [ ] If the user starts speaking while CLEO is providing a voice response, CLEO must immediately stop talking (abort audio/TTS).
- [ ] CLEO must transition back to the `listening` phase seamlessly upon interruption.

### 2. Emotional Speech (SSML Integration)
- [ ] The LLM must be prompted to detect user sentiment and energy levels.
- [ ] The LLM must output a sentiment tag (e.g., `[SENTIMENT: cheerful]`) at the start of its response.
- [ ] The backend `tts_service` must parse this tag and wrap the speech in Azure Neural SSML (`<mstts:express-as style="...">`).

### 3. Voice-First RAG Pipeline (Progressive Disclosure)
- [ ] Responses in voice mode must be significantly more concise than text (aim for < 3 sentences).
- [ ] If the RAG context contains high-volume or complex data (e.g., a 10-step list), CLEO must provide a high-level summary.
- [ ] CLEO must then ask: "I've got more details on this, would you like the full breakdown?"
- [ ] The system must remove all Markdown formatting (headers, bolding) before synthesis to ensure natural speech.

### 4. Interactive Engagement (Feedback Loops)
- [ ] **Smart Flow Control**: After providing a summary or a segment of information, CLEO must proactively ask questions like "Did that make sense?", "Shall I continue?", or "Was this what you were looking for?"
- [ ] **Visual Engagement**: If CLEO asks a clarifying question, a small, non-intrusive "Quick Action" pop-up/toast should appear in the UI with button options (e.g., "Yes, Continue", "Got it!", "Tell me more").
- [ ] **Omni-Channel Response**: The user must be able to reply to these cues via **Voice (Natural Language)** or by **Tapping the UI Pop-up**.
- [ ] **Boredom Avoidance**: If the interaction becomes monotonous, CLEO should pivot her tone or offer a different perspective based on the active "Vibe".

### 5. Dynamic "Vibes" & Visual Sync
- [ ] The user can select a "Vibe" (e.g., `Professional`, `Zen`, `Sassy`) which influences both the voice personality and the visual core.
- [ ] The `EnergyCoreCanvas` visual state (colors and pulse speed) must shift based on the active Vibe.
- [ ] Audio-reactivity must modulate the core's noise/scale during speech.

### 5. Low-Latency Fillers
- [ ] If the RAG pipeline takes > 1.5 seconds, a "Thinking Filler" (e.g., "Scanning the database...") should be played to bridge the gap.

## Technical Notes
- **Frontend Hook**: `useVoiceMode.ts`
- **Backend Service**: `rag_service.py`, `tts_service.py`
- **Models**: `ChatRequest` and `TTSRequest` require schema updates.
