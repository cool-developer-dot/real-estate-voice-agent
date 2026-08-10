import { useEffect, useState } from 'react';
import { useConnectionState } from '@livekit/components-react';

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Rendered inside UpliftAIRoom. Judge-pointing surface: connection state,
// last tool call with args, session timer.
export default function StatusRail({ lastTool, startedAt, lastAnswer, desk }) {
  const connectionState = useConnectionState();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="status-rail">
      <span>conn: {connectionState}</span>
      <span>
        last tool:{' '}
        {lastTool ? `${lastTool.name} ${JSON.stringify(lastTool.args)}` : '—'}
      </span>
      <span>session: {startedAt ? formatElapsed(now - startedAt) : '—'}</span>
      {lastAnswer && <span>kb: {lastAnswer.topic}</span>}
      {desk && <span>desk: {desk}</span>}
    </div>
  );
}
