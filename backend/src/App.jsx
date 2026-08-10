import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { UpliftAIRoom, useUpliftAIRoom, DisconnectButton } from '@upliftai/assistants-react';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
import CallPanel from './components/CallPanel.jsx';
import RegistryCard from './components/RegistryCard.jsx';
import StatusRail from './components/StatusRail.jsx';
import useLeadState from './agent/useLeadState.js';
import { makeTools } from './agent/tools.js';
import { setApiSessionId, apiPost, apiPatch } from './agent/api.js';
import { buildLanguageHandoffInstruction } from './agent/handoff.js';

/** After a language switch, push known lead/listings into the new Uplift session. */
function LanguageHandoff({ handoffRef, desk, leadRef, matchesRef }) {
  const { isConnected, updateInstruction, agentParticipant } = useUpliftAIRoom();
  const sentRef = useRef(false);

  useEffect(() => {
    sentRef.current = false;
  }, [desk]);

  useEffect(() => {
    if (!isConnected || !agentParticipant || !handoffRef.current || sentRef.current) return;
    sentRef.current = true;
    handoffRef.current = false;
    const instruction = buildLanguageHandoffInstruction(
      desk,
      leadRef.current,
      matchesRef.current,
    );
    updateInstruction(instruction).catch((err) => {
      console.warn('[handoff] updateInstruction failed', err);
      sentRef.current = false;
      handoffRef.current = true;
    });
  }, [isConnected, agentParticipant, desk, handoffRef, leadRef, matchesRef, updateInstruction]);

  return null;
}

function newCallSessionId() {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Language desks — three public Uplift assistants with identical tools.
// The Urdu desk keeps coming from the secret, with a literal fallback.
const DESKS = {
  urdu: import.meta.env.VITE_ASSISTANT_ID || '306b7318-ee5d-47e4-9f4e-27d945585881',
  punjabi: import.meta.env.VITE_ASSISTANT_ID_PUNJABI || '035c9b36-74f2-496f-a2d1-864631d6b7b8',
  english: import.meta.env.VITE_ASSISTANT_ID_ENGLISH || 'ba542e3f-cb15-401b-a25a-6f7064a3f6af',
};

const DESK_LABEL = { urdu: 'Urdu', punjabi: 'Punjabi', english: 'English' };

const MIC_BLOCKED_MESSAGE =
  "Microphone blocked. Allow access in your browser's address bar, then start the call again.";

function HeaderBar({ desk, children }) {
  return (
    <header className="header-bar">
      <span className="header-brand">REHMAN ESTATES</span>
      <span className="header-divider" aria-hidden="true" />
      <span className="header-sub">FRONT DESK</span>
      {desk && <span className="header-desk">{desk.toUpperCase()}</span>}
      <span className="header-right">{children}</span>
    </header>
  );
}

// Rendered inside UpliftAIRoom so it can read connection state.
function LiveControls({ onReset }) {
  const { isConnected } = useUpliftAIRoom();
  const connectionState = useConnectionState();
  const reconnecting = connectionState === 'reconnecting';
  return (
    <>
      {reconnecting && <span className="reconnecting">reconnecting…</span>}
      {isConnected && !reconnecting && (
        <>
          <span className="live-dot" aria-hidden="true" />
          <span className="live-word">LIVE</span>
        </>
      )}
      <button type="button" className="btn-quiet" onClick={onReset}>
        Reset
      </button>
      <DisconnectButton>End call</DisconnectButton>
    </>
  );
}

// Browser autoplay policy can block agent audio on a fresh page load. We call
// room.startAudio() inside the Start-call click gesture (see startCall), then
// again once connected; if playback is STILL blocked, this shows one button.
function AudioUnlock() {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [canPlayback, setCanPlayback] = useState(() => room.canPlaybackAudio);

  useEffect(() => {
    const update = () => setCanPlayback(room.canPlaybackAudio);
    room.on(RoomEvent.AudioPlaybackStatusChanged, update);
    update();
    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, update);
    };
  }, [room]);

  useEffect(() => {
    if (connectionState === 'connected' && !room.canPlaybackAudio) {
      room.startAudio().catch(() => {});
    }
  }, [connectionState, room]);

  if (connectionState !== 'connected' || canPlayback) return null;
  return (
    <div className="card">
      <button type="button" onClick={() => room.startAudio().catch(() => {})}>
        Tap to enable audio
      </button>
    </div>
  );
}

export default function App() {
  const [connecting, setConnecting] = useState(false);
  const [micError, setMicError] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [session, setSession] = useState(null); // { token, wsUrl, roomName }
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [toolLog, setToolLog] = useState([]); // last 5 { name, args, at }
  const [lastAnswer, setLastAnswer] = useState(null); // { id, topic } from answer_property_question
  const [resetEpoch, setResetEpoch] = useState(0);
  const [resetting, setResetting] = useState(false);
  const resettingRef = useRef(false);
  const roomRef = useRef(null); // pre-created Room, unlocked inside the click gesture
  const [desk, setDesk] = useState('urdu');
  const deskRef = useRef('urdu');
  const [switchingTo, setSwitchingTo] = useState(null); // language while a desk switch is in flight
  const [switchNotice, setSwitchNotice] = useState(null); // transcript divider text
  const genRef = useRef(0); // transition generation — see createSession

  const {
    lead,
    leadRef,
    mergeLead,
    justFilled,
    matches,
    matchesRef,
    setMatches,
    visits,
    addVisit,
    handoff,
    setHandoff,
    reset,
  } = useLeadState();

  const languageHandoffRef = useRef(false);
  const leadIdRef = useRef(null);

  const onToolCall = useCallback((name, args) => {
    console.log('[tool]', name, args);
    setToolLog((prev) => [...prev.slice(-4), { name, args, at: Date.now() }]);
  }, []);

  // Stable identity for the lifetime of the page — mandatory (see replit.md).
  const toolDepsRef = useRef({
    leadRef,
    matchesRef,
    mergeLead,
    setMatches,
    addVisit,
    setHandoff,
    setLastAnswer,
    deskRef,
    switchDesk: (lang) => switchDeskRef.current(lang), // stable wrapper over the latest closure
    onToolCall,
  });
  const tools = useMemo(() => makeTools(toolDepsRef.current), []);

  // Clears lead, matches, visits, handoff, transcript, and tool log.
  const clearLocalState = useCallback(() => {
    reset();
    leadIdRef.current = null;
    setToolLog([]);
    setLastAnswer(null);
    setSwitchNotice(null);
    deskRef.current = 'urdu'; // every Reset path returns to the Urdu desk
    setDesk('urdu');
    setResetEpoch((e) => e + 1);
    setApiSessionId(newCallSessionId()); // next call writes a fresh lead on the API
  }, [reset]);

  // Mirror local lead → API so dashboard stays current even if a tool sync lags.
  useEffect(() => {
    if (!session) return;
    const hasData =
      lead.intent ||
      lead.society ||
      lead.propertyType ||
      lead.name ||
      lead.phone ||
      lead.budgetMaxPKR != null ||
      lead.sizeMarla != null;
    if (!hasData) return;
    let cancelled = false;
    apiPost('/api/leads', {
      intent: lead.intent,
      propertyType: lead.propertyType,
      sizeMarla: lead.sizeMarla,
      sizeLabel: lead.sizeLabel,
      society: lead.society,
      phase: lead.phase,
      budgetMaxPKR: lead.budgetMaxPKR,
      budgetLabel: lead.budgetLabel,
      features: lead.features,
      name: lead.name,
      phone: lead.phone,
      timeline: lead.timeline,
      financing: lead.financing,
    }).then((api) => {
      if (cancelled || !api.ok) return;
      const id = api.data?.lead?.id;
      if (id) leadIdRef.current = id;
    });
    return () => {
      cancelled = true;
    };
  }, [lead, session]);

  // Creates a fresh public session against the given desk's assistant.
  // `gen` serializes overlapping transitions (start / reset / desk switch):
  // if a newer transition began while this one was in flight, its result is
  // discarded so the LAST-initiated transition always wins.
  async function createSession(assistantId, gen) {
    const stale = () => gen !== undefined && gen !== genRef.current;
    try {
      const res = await fetch(
        `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantName: 'Demo Caller' }),
        }
      );
      if (stale()) return false;
      if (!res.ok) {
        const bodyText = await res.text();
        if (stale()) return false;
        setSessionError({ status: res.status, body: bodyText });
        return false;
      }
      const body = await res.json();
      if (stale()) return false;
      setSession(body);
      setSessionStartedAt(Date.now());
      return true;
    } catch (err) {
      if (stale()) return false;
      setSessionError({ status: 'network error (no HTTP status)', body: String(err) });
      return false;
    }
  }

  // Must run synchronously inside a click handler, BEFORE any await, so the
  // browser's user-gesture context still applies to startAudio().
  function prepareRoomInGesture() {
    const room = new Room();
    room.startAudio().catch(() => {}); // unlock audio playback while we have the gesture
    roomRef.current = room;
  }

  async function startCall() {
    prepareRoomInGesture();
    setMicError(null);
    setSessionError(null);
    setConnecting(true);
    setApiSessionId(newCallSessionId());

    // Microphone pre-flight BEFORE creating the session.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const name = err && err.name ? err.name : 'UnknownError';
      setMicError(name === 'NotAllowedError' ? MIC_BLOCKED_MESSAGE : `Microphone error: ${name}`);
      setConnecting(false);
      return;
    }

    const gen = ++genRef.current;
    await createSession(DESKS[deskRef.current], gen);
    if (gen === genRef.current) setConnecting(false);
  }

  // Desk switch — same teardown/reconnect machinery as Reset, but WITHOUT
  // clearing the lead/registry state. Called from the switch_language tool.
  // New Uplift session has no chat history — LanguageHandoff re-injects lead/listings.
  async function switchDesk(lang) {
    if (!DESKS[lang] || lang === deskRef.current) return;
    const gen = ++genRef.current;
    prepareRoomInGesture(); // startAudio best-effort; page already has gestures, AudioUnlock is the fallback
    languageHandoffRef.current = true;
    deskRef.current = lang;
    setDesk(lang);
    setSwitchNotice(`— switched to ${DESK_LABEL[lang]} desk —`);
    resettingRef.current = true;
    setSwitchingTo(lang);
    setSession(null); // unmounts the room -> disconnect -> local tracks stopped
    setSessionStartedAt(null);
    try {
      await createSession(DESKS[lang], gen);
    } finally {
      // Only release the guard if no newer transition started meanwhile.
      if (gen === genRef.current) {
        resettingRef.current = false;
        setSwitchingTo(null);
      }
    }
  }
  const switchDeskRef = useRef(switchDesk);
  switchDeskRef.current = switchDesk;

  // Full reset during a call: clear local state, tear down the session, then
  // immediately create a fresh one — without returning to the idle screen.
  async function handleFullReset() {
    const gen = ++genRef.current;
    prepareRoomInGesture(); // Reset click is also a gesture — unlock the new room too
    clearLocalState(); // also returns the desk to Urdu
    setSessionError(null);
    resettingRef.current = true;
    setResetting(true);
    setSwitchingTo(null); // a reset supersedes any in-flight desk switch
    setSession(null); // unmounts the room -> disconnect -> local tracks stopped
    setSessionStartedAt(null);
    try {
      await createSession(DESKS.urdu, gen);
    } finally {
      if (gen === genRef.current) {
        resettingRef.current = false;
        setResetting(false);
      }
    }
  }

  function endCall() {
    // Ignore the old room's disconnect callback while a reset reconnect is in
    // flight, so it cannot clear the freshly created session.
    if (resettingRef.current) return;
    const id = leadIdRef.current;
    const started = sessionStartedAt;
    setSession(null);
    setSessionStartedAt(null);
    if (id && started) {
      const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      apiPatch(`/api/leads/${id}`, {
        callDuration: `${mm}:${ss}`,
        status: 'Contacted',
      }).catch(() => {});
    }
  }

  const registry = (
    <RegistryCard
      lead={lead}
      justFilled={justFilled}
      matches={matches}
      visits={visits}
      handoff={handoff}
    />
  );

  const lastTool = toolLog.length > 0 ? toolLog[toolLog.length - 1] : null;

  if (session) {
    return (
      <UpliftAIRoom
        key={session.token}
        room={roomRef.current || undefined}
        token={session.token}
        serverUrl={session.wsUrl}
        connect
        audio
        video={false}
        tools={tools}
        onDisconnected={endCall}
      >
        <div className="shell">
          <LanguageHandoff
            handoffRef={languageHandoffRef}
            desk={desk}
            leadRef={leadRef}
            matchesRef={matchesRef}
          />
          <HeaderBar desk={desk}>
            <LiveControls onReset={handleFullReset} />
          </HeaderBar>
          <div className="columns">
            <div className="col-left">
              <AudioUnlock />
              <CallPanel resetEpoch={resetEpoch} switchNotice={switchNotice} />
              <StatusRail lastTool={lastTool} startedAt={sessionStartedAt} lastAnswer={lastAnswer} desk={desk} />
            </div>
            <div className="col-right">{registry}</div>
          </div>
        </div>
      </UpliftAIRoom>
    );
  }

  if (resetting || switchingTo) {
    return (
      <div className="shell">
        <HeaderBar desk={desk} />
        <div className="columns">
          <div className="col-left">
            <div className="card">
              <p className="agent-state">
                {switchingTo ? `switching to ${DESK_LABEL[switchingTo]} desk…` : 'resetting…'}
              </p>
            </div>
          </div>
          <div className="col-right">{registry}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <HeaderBar desk={desk}>
        <button type="button" className="btn-quiet" onClick={clearLocalState}>
          Reset
        </button>
      </HeaderBar>
      <div className="columns">
        <div className="col-left">
          <div className="card">
            <button onClick={startCall} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Start call'}
            </button>
            {micError && (
              <p className="error-text">
                <strong>{micError}</strong>
              </p>
            )}
            {sessionError && (
              <div>
                <p className="error-text">
                  Session creation failed — HTTP status: <strong>{sessionError.status}</strong>
                </p>
                <pre className="error-body">{sessionError.body}</pre>
                <button onClick={startCall} disabled={connecting}>
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="col-right">{registry}</div>
      </div>
    </div>
  );
}
