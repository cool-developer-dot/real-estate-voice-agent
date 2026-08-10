/** Demo store for leads / visits / handoffs. Persists to data/persisted-store.json. */

import fs from "node:fs";
import path from "node:path";

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Closed";
export type DashboardPropertyType = "Buy" | "Rent" | "Invest";

export type LeadRecord = {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  email?: string;
  propertyType: DashboardPropertyType;
  budget: string;
  location: string;
  status: LeadStatus;
  createdAt: string;
  callDuration: string;
  transcript: string;
  notes: string;
  updatedAt: number;
  intent?: string | null;
  agentPropertyType?: string | null;
  sizeMarla?: number | null;
  sizeLabel?: string | null;
  society?: string | null;
  phase?: string | null;
  budgetMaxPKR?: number | null;
  budgetLabel?: string | null;
  features?: string[];
  timeline?: string | null;
  financing?: string | null;
};

export type VisitRecord = Record<string, unknown> & {
  reference: string;
  createdAt: number;
  sessionId?: string;
  leadId?: string;
};

export type HandoffRecord = {
  id: string;
  reason: string;
  summary: string;
  at: number;
  sessionId?: string;
  leadId?: string;
};

export type FollowUpRecord = {
  id: string;
  leadId: string;
  when: string;
  note: string;
  createdAt: number;
};

export type EmailSendRecord = {
  id: string;
  leadId: string;
  listingIds: string[];
  createdAt: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  urgent: boolean;
  leadId: string | null;
  kind: "lead" | "handoff" | "visit" | "followup";
  at: number;
};

type PersistedShape = {
  leads: LeadRecord[];
  visits: VisitRecord[];
  handoffs: HandoffRecord[];
  followUps: FollowUpRecord[];
  emailSends: EmailSendRecord[];
};

const STORE_PATH = path.join(process.cwd(), "data", "persisted-store.json");

const leadsBySession = new Map<string, LeadRecord>();
const leadsById = new Map<string, LeadRecord>();
const visits: VisitRecord[] = [];
const handoffs: HandoffRecord[] = [];
const followUps: FollowUpRecord[] = [];
const emailSends: EmailSendRecord[] = [];
let activeCalls = 0;

function loadPersisted() {
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as PersistedShape;
    for (const lead of data.leads || []) {
      if (!lead?.id || !lead?.sessionId) continue;
      leadsById.set(lead.id, lead);
      leadsBySession.set(lead.sessionId, lead);
    }
    visits.push(...(data.visits || []));
    handoffs.push(...(data.handoffs || []));
    followUps.push(...(data.followUps || []));
    emailSends.push(...(data.emailSends || []));
  } catch (err) {
    console.warn("[store] failed to load persisted data", err);
  }
}

function persistNow() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload: PersistedShape = {
      leads: [...leadsById.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
      visits: [...visits],
      handoffs: [...handoffs],
      followUps: [...followUps],
      emailSends: [...emailSends],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("[store] failed to persist", err);
  }
}

loadPersisted();

function nextLeadId(): string {
  return "LD-" + String(Math.floor(1000 + Math.random() * 9000));
}

function mapIntent(intent: unknown): DashboardPropertyType {
  if (intent === "rent") return "Rent";
  if (intent === "invest") return "Invest";
  return "Buy";
}

function formatBudget(patch: Record<string, unknown>, prev?: LeadRecord): string {
  const n =
    typeof patch.budgetMaxPKR === "number"
      ? patch.budgetMaxPKR
      : prev?.budgetMaxPKR;
  if (typeof n === "number" && Number.isFinite(n)) {
    if (n >= 10_000_000) {
      const crore = n / 10_000_000;
      return `${Number.isInteger(crore) ? crore : crore.toFixed(1)} crore`;
    }
    if (n >= 100_000) {
      const lakh = n / 100_000;
      return `${Number.isInteger(lakh) ? lakh : lakh.toFixed(1)} lakh`;
    }
    return `PKR ${n.toLocaleString("en-PK")}`;
  }
  if (typeof patch.budgetLabel === "string" && patch.budgetLabel.trim()) {
    return patch.budgetLabel.trim();
  }
  return prev?.budget || "—";
}

function formatLocation(patch: Record<string, unknown>, prev?: LeadRecord): string {
  const society =
    (typeof patch.society === "string" && patch.society) || prev?.society || "";
  const phase = (typeof patch.phase === "string" && patch.phase) || prev?.phase || "";
  const loc = [society, phase].filter(Boolean).join(" ");
  return loc || prev?.location || "—";
}

function opsNotesFrom(prev?: LeadRecord): string[] {
  if (!prev?.notes) return [];
  return prev.notes
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => /^(Sent |Handoff|Follow-up)/i.test(s));
}

function buildNotes(
  next: Pick<
    LeadRecord,
    | "agentPropertyType"
    | "sizeMarla"
    | "sizeLabel"
    | "features"
    | "timeline"
    | "financing"
  >,
  prev?: LeadRecord,
): string {
  const prefs: string[] = [];
  if (next.agentPropertyType) {
    prefs.push(`Property: ${next.agentPropertyType}`);
  }
  if (next.sizeLabel) prefs.push(`Size: ${next.sizeLabel}`);
  else if (typeof next.sizeMarla === "number") prefs.push(`Size: ${next.sizeMarla} marla`);
  if (next.features?.length) prefs.push(`Features: ${next.features.join(", ")}`);
  if (next.timeline) prefs.push(`Timeline: ${next.timeline}`);
  if (next.financing) prefs.push(`Financing: ${next.financing}`);
  return [...prefs, ...opsNotesFrom(prev)].filter(Boolean).join("\n");
}

function hasSubstance(lead: LeadRecord): boolean {
  return Boolean(
    lead.society ||
      lead.budgetMaxPKR != null ||
      lead.agentPropertyType ||
      lead.sizeMarla != null ||
      (lead.name && lead.name !== "Unknown caller") ||
      (lead.phone && lead.phone !== "—"),
  );
}

function inferStatus(prev: LeadRecord | undefined, next: LeadRecord): LeadStatus {
  if (prev?.status === "Closed" || prev?.status === "Qualified") return prev.status;
  if (prev?.status === "Contacted") return "Contacted";
  if (hasSubstance(next)) return "Contacted";
  return prev?.status || "New";
}

export function upsertLead(
  sessionId: string,
  patch: Record<string, unknown>,
): LeadRecord {
  const prev = leadsBySession.get(sessionId);
  const id = prev?.id || nextLeadId();
  const name =
    (typeof patch.name === "string" && patch.name.trim()) ||
    prev?.name ||
    "Unknown caller";
  const phone =
    (typeof patch.phone === "string" && patch.phone.trim()) ||
    prev?.phone ||
    "—";

  const agentPropertyType =
    (typeof patch.propertyType === "string" ? patch.propertyType : null) ??
    prev?.agentPropertyType ??
    null;
  const sizeMarla =
    typeof patch.sizeMarla === "number" ? patch.sizeMarla : prev?.sizeMarla ?? null;
  const sizeLabel =
    typeof patch.sizeLabel === "string" ? patch.sizeLabel : prev?.sizeLabel ?? null;
  const features = Array.isArray(patch.features)
    ? (patch.features as string[])
    : prev?.features || [];
  const timeline =
    typeof patch.timeline === "string" ? patch.timeline : prev?.timeline ?? null;
  const financing =
    typeof patch.financing === "string" ? patch.financing : prev?.financing ?? null;

  const draft: LeadRecord = {
    id,
    sessionId,
    name,
    phone,
    email: prev?.email,
    propertyType: patch.intent != null ? mapIntent(patch.intent) : prev?.propertyType || "Buy",
    budget: formatBudget(patch, prev),
    location: formatLocation(patch, prev),
    status: prev?.status || "New",
    createdAt: prev?.createdAt || new Date().toISOString(),
    callDuration:
      typeof patch.callDuration === "string"
        ? patch.callDuration
        : prev?.callDuration || "—",
    transcript:
      typeof patch.transcript === "string"
        ? patch.transcript
        : prev?.transcript || "",
    notes: "",
    updatedAt: Date.now(),
    intent: (patch.intent as string) ?? prev?.intent ?? null,
    agentPropertyType,
    sizeMarla,
    sizeLabel,
    society: typeof patch.society === "string" ? patch.society : prev?.society ?? null,
    phase: typeof patch.phase === "string" ? patch.phase : prev?.phase ?? null,
    budgetMaxPKR:
      typeof patch.budgetMaxPKR === "number"
        ? patch.budgetMaxPKR
        : prev?.budgetMaxPKR ?? null,
    budgetLabel:
      typeof patch.budgetLabel === "string"
        ? patch.budgetLabel
        : prev?.budgetLabel ?? null,
    features,
    timeline,
    financing,
  };

  draft.notes = buildNotes(draft, prev);
  draft.status = inferStatus(prev, draft);

  leadsBySession.set(sessionId, draft);
  leadsById.set(id, draft);
  persistNow();
  return draft;
}

export function noteSearchResults(sessionId: string, matchCount: number): void {
  const lead = leadsBySession.get(sessionId);
  if (!lead) return;
  if (matchCount > 0 && (lead.status === "New" || lead.status === "Contacted")) {
    updateLead(lead.id, { status: "Qualified" });
  }
}

export function listLeads(): LeadRecord[] {
  return [...leadsById.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function getLead(id: string): LeadRecord | undefined {
  return leadsById.get(id);
}

export function getLeadBySession(sessionId: string): LeadRecord | undefined {
  return leadsBySession.get(sessionId);
}

export function updateLead(
  id: string,
  patch: Partial<LeadRecord>,
): LeadRecord | undefined {
  const prev = leadsById.get(id);
  if (!prev) return undefined;
  const next: LeadRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    sessionId: prev.sessionId,
    updatedAt: Date.now(),
  };
  leadsById.set(id, next);
  leadsBySession.set(prev.sessionId, next);
  persistNow();
  return next;
}

export function deleteLead(id: string): boolean {
  const prev = leadsById.get(id);
  if (!prev) return false;
  leadsById.delete(id);
  leadsBySession.delete(prev.sessionId);
  persistNow();
  return true;
}

export function addVisit(visit: Record<string, unknown>): VisitRecord {
  const sessionId =
    typeof visit.sessionId === "string" ? visit.sessionId : undefined;
  const lead = sessionId ? leadsBySession.get(sessionId) : undefined;
  const reference =
    typeof visit.reference === "string" && visit.reference
      ? visit.reference
      : "RE-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const record: VisitRecord = {
    ...visit,
    reference,
    createdAt: Date.now(),
    sessionId,
    leadId: lead?.id,
  };
  visits.push(record);
  if (lead && (lead.status === "New" || lead.status === "Contacted")) {
    updateLead(lead.id, { status: "Qualified" });
  }
  if (lead && (visit.callerName || visit.callerPhone)) {
    upsertLead(lead.sessionId, {
      name: visit.callerName,
      phone: visit.callerPhone,
    });
  }
  persistNow();
  return record;
}

export function listVisits(): VisitRecord[] {
  return [...visits].sort((a, b) => b.createdAt - a.createdAt);
}

export function addHandoff(handoff: {
  reason: string;
  summary: string;
  sessionId?: string;
}): HandoffRecord {
  const lead = handoff.sessionId
    ? leadsBySession.get(handoff.sessionId)
    : undefined;
  const record: HandoffRecord = {
    id: "HO-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
    reason: handoff.reason,
    summary: handoff.summary,
    at: Date.now(),
    sessionId: handoff.sessionId,
    leadId: lead?.id,
  };
  handoffs.push(record);
  if (lead) {
    const notes = [lead.notes, `Handoff (${handoff.reason}): ${handoff.summary}`]
      .filter(Boolean)
      .join("\n");
    updateLead(lead.id, {
      status: lead.status === "Closed" ? "Closed" : "Contacted",
      notes,
    });
  } else {
    persistNow();
  }
  return record;
}

export function listHandoffs(): HandoffRecord[] {
  return [...handoffs].sort((a, b) => b.at - a.at);
}

export function setActiveCalls(delta: number): number {
  activeCalls = Math.max(0, activeCalls + delta);
  return activeCalls;
}

export function getActiveCalls(): number {
  return activeCalls;
}

export function addFollowUp(input: {
  leadId: string;
  when?: string;
  note?: string;
}): FollowUpRecord | null {
  const lead = leadsById.get(input.leadId);
  if (!lead) return null;
  const when =
    input.when ||
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const note = input.note || `Follow-up reminder for ${lead.name}`;
  const record: FollowUpRecord = {
    id: "FU-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
    leadId: lead.id,
    when,
    note,
    createdAt: Date.now(),
  };
  followUps.push(record);
  const notes = [
    lead.notes,
    `Follow-up scheduled: ${new Date(when).toLocaleString()} — ${note}`,
  ]
    .filter(Boolean)
    .join("\n");
  updateLead(lead.id, {
    status: lead.status === "New" ? "Contacted" : lead.status,
    notes,
  });
  return record;
}

export function listFollowUps(): FollowUpRecord[] {
  return [...followUps].sort((a, b) => b.createdAt - a.createdAt);
}

export function sendListingsEmail(input: {
  leadId: string;
  listingIds?: string[];
}): EmailSendRecord | null {
  const lead = leadsById.get(input.leadId);
  if (!lead) return null;
  const listingIds = input.listingIds || [];
  const record: EmailSendRecord = {
    id: "EM-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
    leadId: lead.id,
    listingIds,
    createdAt: Date.now(),
  };
  emailSends.push(record);
  const notes = [
    lead.notes,
    listingIds.length
      ? `Sent ${listingIds.length} matching listing(s): ${listingIds.join(", ")}`
      : "Sent matching listings via email",
  ]
    .filter(Boolean)
    .join("\n");
  updateLead(lead.id, { notes });
  return record;
}

function relativeTime(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function listNotifications(): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const lead of listLeads().slice(0, 8)) {
    const detail = [
      lead.propertyType,
      lead.agentPropertyType,
      lead.sizeLabel || (lead.sizeMarla != null ? `${lead.sizeMarla} marla` : null),
      lead.location !== "—" ? lead.location : null,
    ]
      .filter(Boolean)
      .join(" · ");
    items.push({
      id: `lead-${lead.id}`,
      title: "New Lead Captured",
      body: `${lead.name} — ${detail || "details pending"}`,
      time: relativeTime(Date.parse(lead.createdAt)),
      urgent: lead.status === "New",
      leadId: lead.id,
      kind: "lead",
      at: Date.parse(lead.createdAt) || lead.updatedAt,
    });
  }

  for (const h of listHandoffs().slice(0, 5)) {
    items.push({
      id: `handoff-${h.id}`,
      title: "Dealer Handoff",
      body: h.summary,
      time: relativeTime(h.at),
      urgent: true,
      leadId: h.leadId || null,
      kind: "handoff",
      at: h.at,
    });
  }

  for (const v of listVisits().slice(0, 5)) {
    items.push({
      id: `visit-${v.reference}`,
      title: "Visit Scheduled",
      body: `Ref ${v.reference} — ${String(v.preferredDay || "")} ${String(v.preferredTime || "")}`.trim(),
      time: relativeTime(v.createdAt),
      urgent: false,
      leadId: (v.leadId as string) || null,
      kind: "visit",
      at: v.createdAt,
    });
  }

  for (const f of listFollowUps().slice(0, 5)) {
    items.push({
      id: `followup-${f.id}`,
      title: "Follow-up Due",
      body: f.note,
      time: `Due ${new Date(f.when).toLocaleString()}`,
      urgent: true,
      leadId: f.leadId,
      kind: "followup",
      at: f.createdAt,
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, 12);
}

export function getStats() {
  const all = listLeads();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leadsToday = all.filter((l) => Date.parse(l.createdAt) >= today.getTime());
  const pending = all.filter(
    (l) => l.status === "New" || l.status === "Contacted",
  ).length;
  const closed = all.filter((l) => l.status === "Closed").length;
  const conversion =
    all.length === 0 ? 0 : Math.round((closed / all.length) * 1000) / 10;
  return {
    activeCalls,
    leadsToday: leadsToday.length,
    followUpsPending: pending + followUps.length,
    conversionRate: conversion,
    totalLeads: all.length,
    visits: visits.length,
    handoffs: handoffs.length,
  };
}
