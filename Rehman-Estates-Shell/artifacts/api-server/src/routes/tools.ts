import { Router, type IRouter, type Request, type Response } from "express";
import listings from "../data/listings.json";
import knowledge from "../data/knowledge-base.json";
import { searchListings } from "../lib/searchListings";
import { bestChunk } from "../lib/knowledge";
import {
  upsertLead,
  noteSearchResults,
  addVisit,
  addHandoff,
  listLeads,
  getLead,
  updateLead,
  deleteLead,
  listVisits,
  listHandoffs,
  getStats,
  setActiveCalls,
  getActiveCalls,
  addFollowUp,
  listFollowUps,
  sendListingsEmail,
  listNotifications,
  type LeadStatus,
} from "../lib/store";

const router: IRouter = Router();

type ListingRow = {
  id: string;
  listingType: string;
  propertyType: string;
  society?: string;
  phase?: string;
  sizeMarla: number | null;
  pricePKR: number;
  features?: string[];
  [key: string]: unknown;
};

function sessionId(req: Request): string {
  const header = req.header("x-session-id");
  if (header && header.trim()) return header.trim();
  const bodyId = (req.body as { sessionId?: string } | undefined)?.sessionId;
  if (typeof bodyId === "string" && bodyId.trim()) return bodyId.trim();
  return "default";
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

/** GET /api/leads */
router.get("/leads", (_req, res) => {
  res.json({ result: listLeads() });
});

/** GET /api/leads/:id */
router.get("/leads/:id", (req, res) => {
  const lead = getLead(req.params.id as string);
  if (!lead) return res.status(404).json({ error: "lead not found" });
  res.json({ result: lead });
});

/** POST /api/leads — body: lead fields (camelCase, same as update_lead tool args) */
router.post("/leads", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const { sessionId: _ignore, ...patch } = body as Record<string, unknown>;
    const lead = upsertLead(sessionId(req), patch);
    res.json({ result: "saved", lead });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** PATCH /api/leads/:id — e.g. { status } */
router.patch("/leads/:id", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const allowedStatus: LeadStatus[] = ["New", "Contacted", "Qualified", "Closed"];
    const patch: Record<string, unknown> = {};
    if (typeof body.status === "string") {
      if (!allowedStatus.includes(body.status as LeadStatus)) {
        return badRequest(res, "invalid status");
      }
      patch.status = body.status;
    }
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.phone === "string") patch.phone = body.phone;
    if (typeof body.transcript === "string") patch.transcript = body.transcript;
    if (typeof body.callDuration === "string") patch.callDuration = body.callDuration;
    const lead = updateLead(req.params.id as string, patch);
    if (!lead) return res.status(404).json({ error: "lead not found" });
    res.json({ result: lead });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** DELETE /api/leads/:id */
router.delete("/leads/:id", (req, res) => {
  const ok = deleteLead(req.params.id as string);
  if (!ok) return res.status(404).json({ error: "lead not found" });
  res.json({ result: "deleted" });
});

/** GET /api/stats */
router.get("/stats", (_req, res) => {
  res.json({ result: getStats() });
});

/** GET /api/notifications — live feed for the bell */
router.get("/notifications", (_req, res) => {
  res.json({ result: listNotifications() });
});

/**
 * POST /api/calls/active
 * body: { delta: 1 | -1 } — increment/decrement active call counter
 */
router.post("/calls/active", (req, res) => {
  const delta = Number((req.body as { delta?: number } | undefined)?.delta);
  if (delta !== 1 && delta !== -1) {
    return badRequest(res, "delta must be 1 or -1");
  }
  const count = setActiveCalls(delta);
  res.json({ result: { activeCalls: count } });
});

/** GET /api/calls/active */
router.get("/calls/active", (_req, res) => {
  res.json({ result: { activeCalls: getActiveCalls() } });
});

/** POST /api/follow-ups — body: { leadId, when?, note? } */
router.post("/follow-ups", (req, res) => {
  const body = req.body as { leadId?: string; when?: string; note?: string };
  if (!body?.leadId) return badRequest(res, "leadId is required");
  const record = addFollowUp({
    leadId: body.leadId,
    when: body.when,
    note: body.note,
  });
  if (!record) return res.status(404).json({ error: "lead not found" });
  res.json({ result: record });
});

/** GET /api/follow-ups */
router.get("/follow-ups", (_req, res) => {
  res.json({ result: listFollowUps() });
});

/** POST /api/leads/:id/send-listings — body: { listingIds?: string[] } */
router.post("/leads/:id/send-listings", (req, res) => {
  const listingIds = Array.isArray((req.body as { listingIds?: string[] })?.listingIds)
    ? ((req.body as { listingIds: string[] }).listingIds)
    : [];
  const record = sendListingsEmail({
    leadId: req.params.id as string,
    listingIds,
  });
  if (!record) return res.status(404).json({ error: "lead not found" });
  res.json({ result: record });
});

/** GET /api/visits */
router.get("/visits", (_req, res) => {
  res.json({ result: listVisits() });
});

/** GET /api/handoffs */
router.get("/handoffs", (_req, res) => {
  res.json({ result: listHandoffs() });
});

/** GET /api/listings — full inventory */
router.get("/listings", (_req, res) => {
  res.json({ result: listings });
});

/**
 * POST /api/listings/search
 * body: search criteria (camelCase, same as search_listings tool args)
 * response: { result: Listing[] } — up to 3, full objects including Urdu labels
 */
router.post("/listings/search", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const criteria = body as Record<string, unknown>;
    const sid = sessionId(req);
    // Keep the dashboard lead in sync even if update_lead was skipped/slow.
    upsertLead(sid, criteria);
    const top3 = searchListings(listings as ListingRow[], {
      intent: criteria.intent as string | null | undefined,
      propertyType: criteria.propertyType as string | null | undefined,
      sizeMarla: criteria.sizeMarla as number | null | undefined,
      society: criteria.society as string | null | undefined,
      phase: criteria.phase as string | null | undefined,
      budgetMaxPKR: criteria.budgetMaxPKR as number | null | undefined,
      features: criteria.features as string[] | null | undefined,
    });
    noteSearchResults(sid, top3.length);
    res.json({ result: top3 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/visits
 * body: { listingId, preferredDay, preferredTime?, callerName?, callerPhone? }
 * response: { result: { reference } }
 */
router.post("/visits", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const { listingId, preferredDay } = body as {
      listingId?: string;
      preferredDay?: string;
    };
    if (!listingId || !preferredDay) {
      return badRequest(res, "listingId and preferredDay are required");
    }
    const visit = addVisit({
      ...(body as Record<string, unknown>),
      sessionId: sessionId(req),
    });
    res.json({ result: { reference: visit.reference } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/knowledge/answer
 * body: { question: string }
 * response: { result: { id, topic, text } | null }
 */
router.post("/knowledge/answer", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const question = (body as { question?: string }).question;
    if (typeof question !== "string" || !question.trim()) {
      return badRequest(res, "question is required");
    }
    const chunks = (
      knowledge as {
        chunks: Array<{ id: string; topic: string; keywords?: string[]; text: string }>;
      }
    ).chunks;
    const chunk = bestChunk(chunks, question);
    if (!chunk) {
      res.json({ result: null });
      return;
    }
    res.json({
      result: { id: chunk.id, topic: chunk.topic, text: chunk.text },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/handoffs
 * body: { reason, summary }
 * response: { result: "handoff recorded" }
 */
router.post("/handoffs", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest(res, "body must be an object");
    }
    const { reason, summary } = body as { reason?: string; summary?: string };
    if (!reason || !summary) {
      return badRequest(res, "reason and summary are required");
    }
    addHandoff({ reason, summary, sessionId: sessionId(req) });
    res.json({ result: "handoff recorded" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
