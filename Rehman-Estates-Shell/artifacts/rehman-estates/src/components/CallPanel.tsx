import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Save, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentState = 'listening' | 'thinking' | 'speaking';

export interface TranscriptLine {
  role: 'agent' | 'caller';
  text: string;
}

interface CallPanelProps {
  agentName?: string;
  agentState: AgentState;
  transcript: TranscriptLine[];
  callStatus: 'connecting' | 'active' | 'ended';
  isMuted: boolean;
  callerNumber: string;
  onMuteToggle: () => void;
  onEndCall: () => void;
}

// ---------------------------------------------------------------------------
// Bilingual state labels — English primary, Urdu supporting
// ---------------------------------------------------------------------------

const STATE_LABEL: Record<AgentState, { en: string; ur: string }> = {
  listening: { en: 'Listening',      ur: 'سن رہا ہوں...'       },
  thinking:  { en: 'Thinking',       ur: 'سوچ رہا ہوں...'      },
  speaking:  { en: 'Speaking',       ur: 'جواب دے رہا ہوں...'  },
};

// ---------------------------------------------------------------------------
// CallPanel
// ---------------------------------------------------------------------------

export function CallPanel({
  agentName = 'TAREEQ',
  agentState,
  transcript,
  callStatus,
  isMuted,
  callerNumber,
  onMuteToggle,
  onEndCall,
}: CallPanelProps) {
  const isActive = callStatus === 'active';
  const stateLabels = STATE_LABEL[agentState];

  return (
    <div className="call-panel">
      {/* ── Header: LIVE + bilingual state ── */}
      <div className="call-panel__status">
        <div className="call-panel__live">
          <span
            className={`call-panel__live-dot ${isActive ? 'call-panel__live-dot--active' : ''}`}
            aria-hidden="true"
          />
          <span className="call-panel__live-label">LIVE</span>
        </div>

        <div className="call-panel__state-block" aria-live="polite">
          <span className="call-panel__state-en">{stateLabels.en}</span>
          <span className="call-panel__state-ur" lang="ur" dir="rtl">
            {stateLabels.ur}
          </span>
        </div>
      </div>

      {/* ── Waveform ── */}
      <div className="call-panel__waveform" aria-hidden="true">
        {isActive ? (
          Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="call-panel__wave-bar"
              animate={{
                height: [
                  6,
                  Math.random() * 52 + 10,
                  Math.random() * 24 + 6,
                  6,
                ],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.06,
              }}
            />
          ))
        ) : (
          <div className="call-panel__wave-flat" />
        )}
      </div>

      {/* ── Caller info ── */}
      <div className="call-panel__caller">
        <p className="call-panel__caller-number">{callerNumber}</p>
        <p className="call-panel__caller-label">
          Inbound Caller&ensp;
          <span lang="ur" dir="rtl" className="call-panel__caller-label-ur">
            — کال آ رہی ہے
          </span>
        </p>
      </div>

      {/* ── Urdu transcript ── */}
      <div className="call-panel__transcript" role="log" aria-label="Call transcript">
        <AnimatePresence>
          {transcript.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`call-panel__line call-panel__line--${line.role}`}
            >
              {/* Role label — always LTR */}
              <span className="call-panel__line-role" dir="ltr">
                {line.role === 'agent' ? agentName : 'CALLER'}
              </span>
              {/* Urdu text — RTL, Nastaliq */}
              <p className="call-panel__line-text" lang="ur" dir="rtl">
                {line.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div className="call-panel__controls">
        <button
          onClick={onMuteToggle}
          disabled={!isActive}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={isMuted}
          className={`call-panel__btn-icon ${isMuted ? 'call-panel__btn-icon--active' : ''}`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onEndCall}
          disabled={callStatus === 'ended'}
          aria-label="End call"
          className="call-panel__btn-end"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {/* ── Footer CTA ── */}
      <div className="call-panel__footer">
        {callStatus === 'ended' ? (
          <div className="call-panel__saving">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>Saving Lead Data…</span>
          </div>
        ) : (
          <button onClick={onEndCall} className="call-panel__save-btn">
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>End Call &amp; Save Lead</span>
          </button>
        )}
      </div>
    </div>
  );
}
