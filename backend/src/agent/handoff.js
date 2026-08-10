const DESK_LABEL = { urdu: 'Urdu', punjabi: 'Punjabi', english: 'English' };

function leadSummary(lead) {
  if (!lead || typeof lead !== 'object') return 'none yet';
  const parts = [];
  if (lead.intent) parts.push(`intent=${lead.intent}`);
  if (lead.propertyType) parts.push(`type=${lead.propertyType}`);
  if (lead.sizeLabel || lead.sizeMarla != null) {
    parts.push(`size=${lead.sizeLabel || `${lead.sizeMarla} marla`}`);
  }
  if (lead.society) parts.push(`society=${lead.society}`);
  if (lead.phase) parts.push(`phase=${lead.phase}`);
  if (lead.budgetLabel || lead.budgetMaxPKR != null) {
    parts.push(`budget=${lead.budgetLabel || lead.budgetMaxPKR}`);
  }
  if (Array.isArray(lead.features) && lead.features.length) {
    parts.push(`features=${lead.features.join('+')}`);
  }
  if (lead.name) parts.push(`name=${lead.name}`);
  if (lead.phone) parts.push(`phone=${lead.phone}`);
  if (lead.timeline) parts.push(`timeline=${lead.timeline}`);
  return parts.length ? parts.join(', ') : 'none yet';
}

function matchesSummary(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return 'none shown yet';
  return matches
    .slice(0, 3)
    .map((m, i) => {
      const id = m.id || m.listingId || `match-${i + 1}`;
      const size = m.sizeLabel || m.size || '';
      const price = m.priceLabelUrdu || m.priceLabel || m.price || '';
      const where = [m.society, m.block, m.phase].filter(Boolean).join(' ');
      return `${i + 1}) ${id} ${size} ${where} ${price}`.trim();
    })
    .join(' | ');
}

/** Instruction pushed to the new desk after a language switch (new Uplift session). */
export function buildLanguageHandoffInstruction(lang, lead, matches) {
  const label = DESK_LABEL[lang] || lang;
  return `
RUNTIME HANDOFF — MID-CALL LANGUAGE SWITCH (not a new call)
You are Tareeq, Rehman Estates front-desk receptionist. Keep using your tools.
The caller just switched to the ${label} desk. Continue entirely in ${label}.

Already known requirements: ${leadSummary(lead)}
Listings already discussed: ${matchesSummary(matches)}

CRITICAL BEHAVIOR:
- Speak IMMEDIATELY. Do not wait silently for the caller.
- Do NOT open with a full new-call greeting (no fresh السلام علیکم welcome as if the call just started).
- In ONE short sentence acknowledge the language switch, then continue from the known plot/requirements and any listings above.
- Do not re-ask for fields you already know unless the caller corrects them.
`.trim();
}
