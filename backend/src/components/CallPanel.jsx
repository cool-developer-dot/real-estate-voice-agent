import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useUpliftAIRoom,
  useVoiceAssistant,
  useTracks,
  AudioTrack,
  BarVisualizer,
  RoomAudioRenderer,
} from '@upliftai/assistants-react';
import { useRoomContext, useTranscriptions, useConnectionState } from '@livekit/components-react';
import { Track } from 'livekit-client';

const URDU_RE = /[؀-ۿ]/;

function segmentId(item) {
  const attrs = item.streamInfo?.attributes || {};
  return attrs['lk.segment_id'] || item.streamInfo?.id || item.id;
}

export default function CallPanel({ resetEpoch = 0, switchNotice = null }) {
  const { agentParticipant } = useUpliftAIRoom();
  const { state } = useVoiceAssistant();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  const agentTrack = tracks.find((t) => !t.participant.isLocal);

  const transcriptions = useTranscriptions();
  const localIdentity = room?.localParticipant?.identity;

  // Reset support: transcriptions is SDK-owned and cannot be cleared, so on
  // reset we snapshot the current segment ids and exclude them from the view.
  const [clearedIds, setClearedIds] = useState(() => new Set());
  const transcriptionsRef = useRef(transcriptions);
  transcriptionsRef.current = transcriptions;
  const lastEpochRef = useRef(resetEpoch);
  useEffect(() => {
    if (resetEpoch !== lastEpochRef.current) {
      lastEpochRef.current = resetEpoch;
      setClearedIds((prev) => {
        const s = new Set(prev);
        transcriptionsRef.current.forEach((item) => {
          const id = segmentId(item);
          if (id) s.add(id);
        });
        return s;
      });
    }
  }, [resetEpoch]);

  // { id, role: 'agent'|'caller', text, final } — de-duplicated on segment id
  // (interim segments UPDATE the existing entry), capped at the last 50 turns.
  const transcript = useMemo(() => {
    const byId = new Map();
    for (const item of transcriptions) {
      const id = segmentId(item);
      if (!id || clearedIds.has(id)) continue;
      const attrs = item.streamInfo?.attributes || {};
      const identity = item.participantInfo?.identity;
      byId.set(id, {
        id,
        role: identity && identity === localIdentity ? 'caller' : 'agent',
        text: item.text,
        final: attrs['lk.transcription_final'] === 'true',
      });
    }
    return Array.from(byId.values()).slice(-50);
  }, [transcriptions, localIdentity, clearedIds]);

  // Auto-scroll to the newest turn without stealing focus.
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // Stop every local media track on disconnect/unmount so the recording
  // indicator turns off.
  useEffect(() => {
    if (!room) return undefined;
    const stopLocalTracks = () => {
      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.track) {
          pub.track.stop();
          if (pub.track.mediaStreamTrack) pub.track.mediaStreamTrack.stop();
        }
      });
    };
    room.on('disconnected', stopLocalTracks);
    return () => {
      room.off('disconnected', stopLocalTracks);
      stopLocalTracks();
    };
  }, [room]);

  const reconnecting = connectionState === 'reconnecting';

  return (
    <section className="card">
      <RoomAudioRenderer />
      {agentTrack && <AudioTrack trackRef={agentTrack} />}
      <div className="viz-box">
        {agentTrack ? (
          <BarVisualizer state={state} trackRef={agentTrack} barCount={20} style={{ height: 80 }} />
        ) : null}
      </div>
      <p className="agent-state">{reconnecting ? 'reconnecting…' : state || 'connecting'}</p>
      <hr className="divider" />
      <div className="transcript" ref={scrollRef}>
        {switchNotice && <div className="desk-divider">{switchNotice}</div>}
        {transcript.map((turn) => (
          <div className="turn" key={turn.id}>
            <div className="turn-label">{turn.role === 'agent' ? 'TARIQ' : 'CALLER'}</div>
            <div className={URDU_RE.test(turn.text) ? 'turn-text urdu' : 'turn-text'}>
              {turn.text}
            </div>
          </div>
        ))}
        {transcript.length === 0 && (
          <p className="matches-empty">
            {agentParticipant ? 'Say something — the transcript appears here.' : 'Waiting for Tariq to join…'}
          </p>
        )}
      </div>
    </section>
  );
}
