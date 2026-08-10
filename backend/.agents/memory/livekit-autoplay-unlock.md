---
name: LiveKit autoplay unlock
description: How agent audio is kept unblocked across sessions in this browser-only voice app
---
Browser autoplay policy silently blocks agent audio on the first session of a fresh page load.

**Why:** `UpliftAIRoom` normally creates the Room *after* the session fetch, so `room.startAudio()` never ran inside a user gesture. First call was silent; Reset "fixed" it only because the page had accumulated gestures.

**How to apply:** pre-create `new Room()` and call `room.startAudio()` synchronously inside every click handler that leads to a session (before any `await`), pass it via the `room` prop (`UpliftAIRoomProps extends LiveKitRoomProps`). Retry `startAudio()` once connected; keep a visible "Tap to enable audio" fallback when `canPlaybackAudio` stays false — tool-triggered reconnects (e.g. desk switches) have no gesture, so the fallback is the guarantee there.

Related: overlapping session transitions (start / reset / desk switch) are serialized with a generation counter — stale fetch results and `finally` blocks must check the generation before touching shared state.
