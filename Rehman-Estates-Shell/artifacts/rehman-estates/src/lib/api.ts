import type { Lead, LeadStatus } from '../data/types';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

export type ApiLead = Lead & {
  sessionId?: string;
  society?: string | null;
  phase?: string | null;
  budgetMaxPKR?: number | null;
  features?: string[];
};

export async function fetchLeads(): Promise<ApiLead[]> {
  const data = await apiFetch<{ result: ApiLead[] }>('/api/leads');
  return Array.isArray(data.result) ? data.result : [];
}

export async function fetchLead(id: string): Promise<ApiLead> {
  const data = await apiFetch<{ result: ApiLead }>(`/api/leads/${encodeURIComponent(id)}`);
  return data.result;
}

export async function createOrUpdateLead(
  patch: Record<string, unknown>,
  sessionId: string,
): Promise<ApiLead> {
  const data = await apiFetch<{ result: string; lead: ApiLead }>('/api/leads', {
    method: 'POST',
    headers: { 'X-Session-Id': sessionId },
    body: JSON.stringify(patch),
  });
  return data.lead;
}

export async function patchLead(
  id: string,
  patch: {
    status?: LeadStatus;
    notes?: string;
    name?: string;
    phone?: string;
    transcript?: string;
    callDuration?: string;
  },
): Promise<ApiLead> {
  const data = await apiFetch<{ result: ApiLead }>(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.result;
}

export async function removeLead(id: string): Promise<void> {
  await apiFetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type ApiStats = {
  activeCalls: number;
  leadsToday: number;
  followUpsPending: number;
  conversionRate: number;
  totalLeads: number;
  visits: number;
  handoffs: number;
};

export async function fetchStats(): Promise<ApiStats> {
  const data = await apiFetch<{ result: ApiStats }>('/api/stats');
  return data.result;
}

export async function searchListingsApi(criteria: Record<string, unknown>) {
  const data = await apiFetch<{ result: unknown[] }>('/api/listings/search', {
    method: 'POST',
    body: JSON.stringify(criteria),
  });
  return Array.isArray(data.result) ? data.result : [];
}

export async function bumpActiveCalls(delta: 1 | -1): Promise<number> {
  const data = await apiFetch<{ result: { activeCalls: number } }>('/api/calls/active', {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });
  return data.result.activeCalls;
}

export type ApiNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  urgent: boolean;
  leadId: string | null;
  kind: string;
  at: number;
};

export async function fetchNotifications(): Promise<ApiNotification[]> {
  const data = await apiFetch<{ result: ApiNotification[] }>('/api/notifications');
  return Array.isArray(data.result) ? data.result : [];
}

export async function scheduleFollowUpApi(leadId: string, note?: string) {
  const data = await apiFetch<{ result: unknown }>('/api/follow-ups', {
    method: 'POST',
    body: JSON.stringify({ leadId, note }),
  });
  return data.result;
}

export async function sendListingsEmailApi(leadId: string, listingIds: string[] = []) {
  const data = await apiFetch<{ result: unknown }>(
    `/api/leads/${encodeURIComponent(leadId)}/send-listings`,
    {
      method: 'POST',
      body: JSON.stringify({ listingIds }),
    },
  );
  return data.result;
}

export type ApiFollowUp = {
  id: string;
  leadId: string;
  when: string;
  note: string;
  createdAt: number;
};

export async function fetchFollowUps(): Promise<ApiFollowUp[]> {
  const data = await apiFetch<{ result: ApiFollowUp[] }>('/api/follow-ups');
  return Array.isArray(data.result) ? data.result : [];
}

export async function scheduleVisitApi(
  body: {
    listingId: string;
    preferredDay: string;
    preferredTime?: string;
    callerName?: string;
    callerPhone?: string;
  },
  sessionId?: string,
) {
  const data = await apiFetch<{ result: { reference: string } }>('/api/visits', {
    method: 'POST',
    headers: sessionId ? { 'X-Session-Id': sessionId } : undefined,
    body: JSON.stringify(body),
  });
  return data.result;
}
