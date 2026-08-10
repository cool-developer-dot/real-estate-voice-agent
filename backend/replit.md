# Project: Rehman Estates — Front Desk

Realtime Urdu voice agent for a Lahore property dealership, built for a 1-day hackathon. A buyer speaks Urdu into the browser; a land-registry-style form on screen fills itself in as the agent extracts structured data from code-switched speech.

## Hard architecture constraints — never violate

- Vite + React 18, JavaScript (NOT TypeScript). Single page. No router.
- NO backend, NO server, NO database, NO auth, NO API routes. Everything runs in the browser. The Uplift assistant is public, so no secret ever reaches the client.
- Dependencies are FROZEN at: @upliftai/assistants-react, @livekit/components-react, livekit-client. Do not add any other runtime dependency — no Tailwind, no shadcn, no framer-motion, no state library, no icon pack, no date library. If you believe you need one, stop and say so instead of installing it.
- Styling is plain CSS in src/index.css using CSS custom properties. No CSS modules, no styled-components, no utility framework.
- Never convert files to .ts/.tsx. Never introduce a build step beyond Vite.

## Environment

- Replit Secret `VITE_ASSISTANT_ID` holds the Uplift assistant id.
- vite.config.js must set: server: { host: '0.0.0.0', port: 5000, allowedHosts: true }
- The app is demoed in a real browser tab, never Replit's preview iframe (the iframe blocks getUserMedia).

## Uplift AI realtime API — verified contracts, do not guess or "improve" these

Session creation (no auth header, public assistant):

    POST https://api.upliftai.org/v1/realtime-assistants/{assistantId}/createPublicSession
    headers: { 'Content-Type': 'application/json' }
    body:    { "participantName": "Demo Caller" }
    200 ->   { token, wsUrl, roomName }
    403 ->   assistant is not public;  404 -> wrong assistant id

Room:

    import { UpliftAIRoom } from '@upliftai/assistants-react';
    <UpliftAIRoom token={token} serverUrl={wsUrl} connect audio video={false} tools={tools}>

Hooks and components, all from '@upliftai/assistants-react':

    useUpliftAIRoom()   -> { isConnected, agentParticipant, addTool, updateTool, removeTool, upsertTools, updateInstruction }
    // To get the LiveKit Room object, use useRoomContext() from '@livekit/components-react' (also re-exported by @upliftai/assistants-react)
    useVoiceAssistant() -> { state, participant }   // 'listening' | 'thinking' | 'speaking'
    useTracks([Track.Source.Microphone], { onlySubscribed: true })
    AudioTrack, BarVisualizer, TrackToggle, DisconnectButton, RoomAudioRenderer

Track is imported from 'livekit-client'. The agent's audio track is: tracks.find(t => !t.participant.isLocal)

Tool config object shape:

    {
      name: 'snake_case_name',
      description: 'when the model should call this',
      parameters: { type: 'object', properties: { ... }, required: [] },  // JSON Schema
      timeout: 5,                                                        // seconds
      handler: async (data) => {
        const args = JSON.parse(data.payload).arguments;   // <- the actual parameters
        // Wire format (verified at runtime): data.payload is the JSON string {"tool": "<name>", "arguments": {...}}
        ...
        return JSON.stringify({ result: <anything>, presentationInstructions: "<what the agent should say about this>" });
      }
    }

Handlers run IN THE BROWSER and must return a STRING.

## Critical React rule for tools

The `tools` array passed to UpliftAIRoom must have a STABLE identity across renders, and handlers must never close over stale state. Therefore:

- build the array once with useMemo(..., []) — empty dependency array,
- never read React state directly inside a handler; read it through a ref that an effect keeps up to date,
- never call a setter that depends on a captured value; always use the functional form, e.g. setLead(prev => ({ ...prev, ...patch })).

Recreating the tools array every render causes repeated re-registration and dropped tool calls. This is the number one failure mode of this integration.

## Ownership — do not edit files you do not own

Person A owns: src/App.jsx, src/agent/*. Person B owns: src/components/*, src/data/*, src/index.css. When a task touches both, change only what the task names.

## Non-goals — refuse these even if they seem helpful

Telephony. WhatsApp. Login. Multi-tenant. Charts. Dark mode. Persisting leads. CSV export. A landing page. Analytics. Tests. A README. Error-boundary libraries.
