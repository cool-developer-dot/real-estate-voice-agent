const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

let sessionId = 'default';

export function setApiSessionId(id) {
  sessionId = id && String(id).trim() ? String(id).trim() : 'default';
}

export function getApiSessionId() {
  return sessionId;
}

/**
 * POST JSON to the api-server. Never throws — returns { ok, data } or { ok: false, error }.
 * `timeoutMs` aborts hung fetches so the voice agent does not sit silent until the tool timeout.
 */
export async function apiPatch(path, body, { timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
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
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: `API timeout after ${timeoutMs}ms` };
    }
    return { ok: false, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost(path, body, { timeoutMs = 2500 } = {}) {
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
    let data = null;
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
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: `API timeout after ${timeoutMs}ms` };
    }
    return { ok: false, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}
