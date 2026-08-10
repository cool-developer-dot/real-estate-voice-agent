// Prefer same-origin /api (Vite proxy). Fall back to absolute API base.
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

let sessionId = 'default';

export function setApiSessionId(id: string) {
  sessionId = id && String(id).trim() ? String(id).trim() : 'default';
}

export function getApiSessionId() {
  return sessionId;
}

export async function apiPost(
  path: string,
  body?: Record<string, unknown>,
  { timeoutMs = 2500 }: { timeoutMs?: number } = {},
): Promise<{ ok: true; data: any } | { ok: false; error: string; data?: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      const message =
        (data && (data.error || data.message)) || `HTTP ${res.status}: ${text}`;
      return { ok: false, error: message, data };
    }
    return { ok: true, data };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: `API timeout after ${timeoutMs}ms` };
    }
    return { ok: false, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}
