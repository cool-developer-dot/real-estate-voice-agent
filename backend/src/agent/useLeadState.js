import { useState, useRef, useEffect, useCallback } from 'react';

const EMPTY_LEAD = {
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
  const [justFilled, setJustFilled] = useState(() => new Set());
  const [matches, setMatches] = useState([]);
  const [visits, setVisits] = useState([]);
  const [handoff, setHandoff] = useState(null);

  const leadRef = useRef(lead);
  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);

  const matchesRef = useRef(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  // One timer per key, cleared on unmount.
  const timersRef = useRef(new Map());
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  // Synchronous mirror used only for diffing inside mergeLead, so state
  // updaters stay pure (no side effects inside setLead) and back-to-back
  // merges in the same tick diff against the latest values.
  const shadowRef = useRef(EMPTY_LEAD);

  const mergeLead = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    const prev = shadowRef.current;
    const clean = {};
    const changed = [];
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in EMPTY_LEAD)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (JSON.stringify(prev[key]) === JSON.stringify(value)) continue;
      clean[key] = value;
      changed.push(key);
    }
    if (changed.length === 0) return;

    shadowRef.current = { ...prev, ...clean };
    setLead((p) => ({ ...p, ...clean }));
    setJustFilled((prevSet) => {
      const s = new Set(prevSet);
      changed.forEach((k) => s.add(k));
      return s;
    });
    changed.forEach((key) => {
      const timers = timersRef.current;
      if (timers.has(key)) clearTimeout(timers.get(key));
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          setJustFilled((prevSet) => {
            if (!prevSet.has(key)) return prevSet;
            const s = new Set(prevSet);
            s.delete(key);
            return s;
          });
        }, 400)
      );
    });
  }, []);

  const addVisit = useCallback((visit) => {
    setVisits((prev) => [...prev, visit]);
  }, []);

  const reset = useCallback(() => {
    shadowRef.current = EMPTY_LEAD;
    setLead(EMPTY_LEAD);
    setMatches([]);
    setVisits([]);
    setHandoff(null);
    // (No transcript state exists yet; when it is added, reset must clear it too.)
    setJustFilled(new Set());
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  return {
    lead,
    leadRef,
    mergeLead,
    justFilled,
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
