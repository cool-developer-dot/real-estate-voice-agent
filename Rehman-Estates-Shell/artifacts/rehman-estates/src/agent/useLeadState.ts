import { useState, useRef, useEffect, useCallback } from 'react';
import type { RegistryLeadData } from '@/components/RegistryCard';

const EMPTY_LEAD: RegistryLeadData & {
  financing: string | null;
  features: string[];
} = {
  intent: null,
  propertyType: null,
  sizeMarla: null,
  sizeLabel: null,
  society: null,
  phase: null,
  budgetMaxPKR: null,
  budgetLabel: null,
  features: [],
  timeline: null,
  financing: null,
  name: null,
  phone: null,
};

export default function useLeadState() {
  const [lead, setLead] = useState(EMPTY_LEAD);
  const [matches, setMatches] = useState<unknown[]>([]);
  const [visits, setVisits] = useState<unknown[]>([]);
  const [handoff, setHandoff] = useState<unknown>(null);

  const leadRef = useRef(lead);
  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);

  const matchesRef = useRef(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const shadowRef = useRef(EMPTY_LEAD);

  const mergeLead = useCallback((patch: Record<string, unknown>) => {
    if (!patch || typeof patch !== 'object') return;
    const prev = shadowRef.current;
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in EMPTY_LEAD)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (JSON.stringify((prev as any)[key]) === JSON.stringify(value)) continue;
      clean[key] = value;
    }
    if (Object.keys(clean).length === 0) return;
    shadowRef.current = { ...prev, ...clean } as typeof EMPTY_LEAD;
    setLead((p) => ({ ...p, ...clean }));
  }, []);

  const addVisit = useCallback((visit: unknown) => {
    setVisits((prev) => [...prev, visit]);
  }, []);

  const reset = useCallback(() => {
    shadowRef.current = EMPTY_LEAD;
    setLead(EMPTY_LEAD);
    setMatches([]);
    setVisits([]);
    setHandoff(null);
  }, []);

  return {
    lead,
    leadRef,
    mergeLead,
    matches,
    matchesRef,
    setMatches,
    visits,
    addVisit,
    handoff,
    setHandoff,
    reset,
  };
}
