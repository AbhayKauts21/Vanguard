# US-004: Interactive AI Avatar (HeyGen)

## 📝 User Story
**As a** User,
**I want** to interact with a lifelike AI avatar that responds with voice and realistic human-like animation,
**so that** the experience becomes more natural and engaging.

## ✅ Acceptance Criteria
- [x] Integrate the HeyGen SDK for WebRTC streaming of the interactive avatar.
- [x] Implement a robust state machine for the avatar (disconnected, idle, listening, speaking).
- [x] Protect the HeyGen API Key by using a server-side proxy for token generation.
- [x] Develop a responsive AvatarVideo component for the WebRTC stream.
- [x] Create an automatic bridge between Chat output and Avatar `speak()` commands.
- [x] Support locale-aware voice mapping (switching between en/es voices).
- [x] Implement session lifecycle management (beforeload cleanup) to prevent WebRTC leaks.
- [x] Provide a failure fallback mechanism that returns to the ambient sphere when the avatar cannot be loaded.

## 🛠 Technical Mapping (features.md)
| Feature ID | Title | Module |
|---|---|---|
| F-053 | **HeyGen Streaming Avatar SDK** | `frontend/domains/avatar/hooks/useHeyGenAvatar.ts` |
| F-054 | **Avatar Zustand Store** | `frontend/domains/avatar/model/avatar-store.ts` |
| F-057 | **Avatar State Machine Hook** | `frontend/domains/avatar/hooks/useAvatarState.ts` |
| F-060 | **AvatarPanel Feature Flag** | `frontend/components/avatar/AvatarPanel.tsx` |
| F-061 | **HeyGen Token Route** | `frontend/app/api/heygen/token/route.ts` |
| F-062 | **Chat→Avatar Bridge** | `frontend/domains/chat/hooks/useChatStream.ts` |
| F-063 | **Locale-Aware Voice** | `frontend/lib/env/index.ts` |
| F-087 | **Avatar Failure Fallback** | `frontend/src/components/avatar/AvatarVideo.tsx` |

## 📊 Status
- **Status**: ✅ Completed
- **Performance**: High-fidelity WebRTC streaming with automated speaking triggers.
