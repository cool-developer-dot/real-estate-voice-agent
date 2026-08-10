import { useState, useMemo, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  UpliftAIRoom,
  useUpliftAIRoom,
  useVoiceAssistant,
  RoomAudioRenderer,
} from '@upliftai/assistants-react';
import { buildLanguageHandoffInstruction } from '@/agent/handoff';
import {
  useConnectionState,
  useRoomContext,
  useTranscriptions,
} from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
import { CallPanel, type AgentState, type TranscriptLine } from '@/components/CallPanel';
import { RegistryCard } from '@/components/RegistryCard';
import { MatchList } from '@/components/MatchList';
import useLeadState from '@/agent/useLeadState';
import { makeTools } from '@/agent/tools';
import { setApiSessionId, getApiSessionId } from '@/agent/api';
import { bumpActiveCalls, patchLead, createOrUpdateLead } from '@/lib/api';

const DESKS: Record<string, string> = {
  urdu: import.meta.env.VITE_ASSISTANT_ID || '306b7318-ee5d-47e4-9f4e-27d945585881',
  punjabi: import.meta.env.VITE_ASSISTANT_ID_PUNJABI || '035c9b36-74f2-496f-a2d1-864631d6b7b8',
  english: import.meta.env.VITE_ASSISTANT_ID_ENGLISH || 'ba542e3f-cb15-401b-a25a-6f7064a3f6af',
};

const DESK_LABEL: Record<string, string> = {
  urdu: 'Urdu',
  punjabi: 'Punjabi',
  english: 'English',
};

const MIC_BLOCKED =
  "Microphone blocked. Allow access in your browser's address bar, then start the call again.";

function newCallSessionId() {
  return `dash-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function segmentId(item: any): string | null {
  const attrs = item.streamInfo?.attributes || {};
  return attrs['lk.segment_id'] || item.streamInfo?.id || item.id || null;
}

/** After a language switch, push known lead/listings into the new Uplift session. */
function LanguageHandoff({
  handoffRef,
  desk,
  leadRef,
  matchesRef,
}: {
  handoffRef: MutableRefObject<boolean>;
  desk: string;
  leadRef: MutableRefObject<any>;
  matchesRef: MutableRefObject<any[]>;
}) {
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
    <div className="p-3 mb-3 rounded-xl text-sm" style={{ background: 'rgba(91,106,248,0.08)', color: '#5B6AF8' }}>
      <button type="button" onClick={() => room.startAudio().catch(() => {})}>
        Tap to enable audio
      </button>
    </div>
  );
}

function LiveCallBody({
  lead,
  onEndCall,
  desk,
  onTranscriptChange,
}: {
  lead: ReturnType<typeof useLeadState>['lead'];
  onEndCall: () => void;
  desk: string;
  onTranscriptChange?: (lines: TranscriptLine[]) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { state: vaState } = useVoiceAssistant();
  const transcriptions = useTranscriptions();
  const localIdentity = room?.localParticipant?.identity;
  const [isMuted, setIsMuted] = useState(false);

  const agentState: AgentState =
    vaState === 'speaking' || vaState === 'thinking' || vaState === 'listening'
      ? vaState
      : 'listening';

  const callStatus: 'connecting' | 'active' | 'ended' =
    connectionState === 'connected'
      ? 'active'
      : connectionState === 'disconnected'
        ? 'ended'
        : 'connecting';

  const transcript: TranscriptLine[] = useMemo(() => {
    const byId = new Map<string, TranscriptLine>();
    for (const item of transcriptions as any[]) {
      const id = segmentId(item);
      if (!id) continue;
      const identity = item.participantInfo?.identity;
      byId.set(id, {
        role: identity && identity === localIdentity ? 'caller' : 'agent',
        text: item.text,
      });
    }
    return Array.from(byId.values()).slice(-50);
  }, [transcriptions, localIdentity]);

  useEffect(() => {
    onTranscriptChange?.(transcript);
  }, [transcript, onTranscriptChange]);

  const onMuteToggle = async () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!room) return;
    const stopLocalTracks = () => {
      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.track) {
          pub.track.stop();
          pub.track.mediaStreamTrack?.stop();
        }
      });
    };
    room.on('disconnected', stopLocalTracks);
    return () => {
      room.off('disconnected', stopLocalTracks);
      stopLocalTracks();
    };
  }, [room]);

  return (
    <div className="call-view">
      <RoomAudioRenderer />
      <header className="call-view__header">
        <span className="call-view__header-title">REHMAN ESTATES — FRONT DESK</span>
        <div className="call-view__header-live">
          <span
            className={`call-view__header-dot ${callStatus === 'active' ? 'call-view__header-dot--active' : ''}`}
            aria-hidden="true"
          />
          <span className="call-view__header-label">
            {callStatus === 'active' ? `LIVE · ${DESK_LABEL[desk] || desk}` : callStatus === 'connecting' ? 'CONNECTING…' : 'ENDED'}
          </span>
        </div>
      </header>

      <div className="call-view__body">
        <section className="call-view__left" aria-label="Call panel">
          <AudioUnlock />
          <CallPanel
            agentName="TAREEQ"
            agentState={agentState}
            transcript={transcript}
            callStatus={callStatus}
            isMuted={isMuted}
            callerNumber="Browser caller"
            onMuteToggle={onMuteToggle}
            onEndCall={onEndCall}
          />
        </section>

        <section className="call-view__right" aria-label="Lead record and property matches">
          <div className="call-view__right-inner">
            <RegistryCard
              lead={{
                ...lead,
                features: Array.isArray(lead.features) ? lead.features : null,
              }}
            />
            <MatchList
              lead={{
                ...lead,
                features: Array.isArray(lead.features) ? lead.features : null,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CallView() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [connecting, setConnecting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<{ status: string | number; body: string } | null>(null);
  const [session, setSession] = useState<{ token: string; wsUrl: string; roomName?: string } | null>(null);
  const [desk, setDesk] = useState('urdu');
  const deskRef = useRef('urdu');
  const genRef = useRef(0);
  const roomRef = useRef<Room | null>(null);
  const startedAtRef = useRef(Date.now());
  const activeBumped = useRef(false);
  const leadIdRef = useRef<string | null>(null);

  const {
    lead,
    leadRef,
    mergeLead,
    matchesRef,
    setMatches,
    addVisit,
    setHandoff,
    reset,
  } = useLeadState();

  const languageHandoffRef = useRef(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const switchingRef = useRef(false);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const onTranscriptChange = useCallback((lines: TranscriptLine[]) => {
    transcriptRef.current = lines;
  }, []);

  const onToolCall = useCallback((name: string, args: unknown) => {
    console.log('[tool]', name, args);
  }, []);

  const switchDeskRef = useRef<(lang: string) => void>(() => {});

  const toolDepsRef = useRef({
    leadRef,
    matchesRef,
    mergeLead,
    setMatches,
    addVisit,
    setHandoff,
    setLastAnswer: () => {},
    deskRef,
    switchDesk: (lang: string) => switchDeskRef.current(lang),
    onToolCall,
  });
  const tools = useMemo(() => makeTools(toolDepsRef.current), []);

  function prepareRoomInGesture() {
    const room = new Room();
    room.startAudio().catch(() => {});
    roomRef.current = room;
  }

  async function createSession(assistantId: string, gen: number) {
    const stale = () => gen !== genRef.current;
    try {
      const res = await fetch(
        `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantName: 'Dashboard Caller' }),
        },
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
      startedAtRef.current = Date.now();
      return true;
    } catch (err) {
      if (stale()) return false;
      setSessionError({ status: 'network error', body: String(err) });
      return false;
    }
  }

  async function startCall() {
    prepareRoomInGesture();
    setMicError(null);
    setSessionError(null);
    setConnecting(true);
    const callSession = newCallSessionId();
    setApiSessionId(callSession);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      const name = err?.name || 'UnknownError';
      setMicError(name === 'NotAllowedError' ? MIC_BLOCKED : `Microphone error: ${name}`);
      setConnecting(false);
      return;
    }

    try {
      await bumpActiveCalls(1);
      activeBumped.current = true;
    } catch {
      /* ignore */
    }

    const gen = ++genRef.current;
    await createSession(DESKS[deskRef.current], gen);
    if (gen === genRef.current) setConnecting(false);
  }

  async function switchDesk(lang: string) {
    if (!DESKS[lang] || lang === deskRef.current) return;
    const gen = ++genRef.current;
    prepareRoomInGesture();
    languageHandoffRef.current = true;
    switchingRef.current = true;
    deskRef.current = lang;
    setDesk(lang);
    setSwitchingTo(lang);
    setSession(null);
    try {
      await createSession(DESKS[lang], gen);
    } finally {
      if (gen === genRef.current) {
        switchingRef.current = false;
        setSwitchingTo(null);
      }
    }
  }
  switchDeskRef.current = switchDesk;

  // Mirror tool-driven lead updates into the dashboard API (tools also POST).
  useEffect(() => {
    if (!session) return;
    const hasData =
      lead.intent || lead.society || lead.propertyType || lead.name || lead.phone;
    if (!hasData) return;
    createOrUpdateLead(
      {
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
      },
      getApiSessionId(),
    )
      .then((apiLead) => {
        leadIdRef.current = apiLead.id;
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => {});
  }, [lead, session, queryClient]);

  async function endCall() {
    const room = roomRef.current;
    try {
      await room?.disconnect();
    } catch {
      /* ignore */
    }

    const secs = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    try {
      if (leadIdRef.current) {
        const transcriptText = transcriptRef.current
          .map((l) => `${l.role === 'caller' ? 'Caller' : 'Tareeq'}: ${l.text}`)
          .join('\n');
        await patchLead(leadIdRef.current, {
          callDuration: `${mm}:${ss}`,
          status: 'Contacted',
          transcript: transcriptText,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      /* ignore */
    }

    if (activeBumped.current) {
      bumpActiveCalls(-1).catch(() => {});
      activeBumped.current = false;
    }

    const id = leadIdRef.current;
    setSession(null);
    reset();
    setLocation(id ? `/leads/${id}` : '/leads');
  }

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
        onDisconnected={() => {
          /* endCall handles navigation; ignore stray disconnect during switch */
        }}
      >
        <LanguageHandoff
          handoffRef={languageHandoffRef}
          desk={desk}
          leadRef={leadRef}
          matchesRef={matchesRef}
        />
        <LiveCallBody
          lead={lead}
          onEndCall={endCall}
          desk={desk}
          onTranscriptChange={onTranscriptChange}
        />
      </UpliftAIRoom>
    );
  }

  if (switchingTo) {
    return (
      <div className="call-view">
        <header className="call-view__header">
          <span className="call-view__header-title">REHMAN ESTATES — FRONT DESK</span>
          <div className="call-view__header-live">
            <span className="call-view__header-dot" aria-hidden="true" />
            <span className="call-view__header-label">
              SWITCHING TO {DESK_LABEL[switchingTo] || switchingTo}…
            </span>
          </div>
        </header>
        <div className="call-view__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-sm" style={{ color: '#64748B', fontFamily: 'var(--app-font-sans)' }}>
            Keeping your plot details — reconnecting the {DESK_LABEL[switchingTo] || switchingTo} desk…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-view">
      <header className="call-view__header">
        <span className="call-view__header-title">REHMAN ESTATES — FRONT DESK</span>
        <div className="call-view__header-live">
          <span className="call-view__header-dot" aria-hidden="true" />
          <span className="call-view__header-label">READY</span>
        </div>
      </header>

      <div className="call-view__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            See how Tareeq handles a call
          </h1>
          <p className="text-sm" style={{ color: '#64748B', fontFamily: 'var(--app-font-sans)' }}>
            Preview the inbound AI front desk. Speak as a caller — captured leads and matches write to the live dashboard.
          </p>
          <div className="flex gap-2 justify-center">
            {(['urdu', 'punjabi', 'english'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  deskRef.current = d;
                  setDesk(d);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: desk === d ? 'rgba(91,106,248,0.12)' : 'rgba(148,163,184,0.10)',
                  color: desk === d ? '#5B6AF8' : '#64748B',
                  border: desk === d ? '1px solid rgba(91,106,248,0.35)' : '1px solid transparent',
                  fontFamily: 'var(--app-font-sans)',
                }}
              >
                {DESK_LABEL[d]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startCall}
            disabled={connecting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white"
            style={{
              background: 'linear-gradient(135deg, #5B6AF8, #818CF8)',
              boxShadow: '0 4px 16px rgba(91,106,248,0.30)',
              fontFamily: 'var(--app-font-sans)',
              border: 'none',
              opacity: connecting ? 0.7 : 1,
            }}
          >
            {connecting ? 'Connecting…' : 'Start preview call'}
          </button>
          {micError && (
            <p className="text-sm" style={{ color: '#E04040' }}>{micError}</p>
          )}
          {sessionError && (
            <div className="text-left text-xs" style={{ color: '#E04040' }}>
              <p>Session failed — HTTP {sessionError.status}</p>
              <pre className="mt-1 overflow-auto max-h-32">{sessionError.body}</pre>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLocation('/')}
            className="text-sm"
            style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
