import { apiPost } from './api.js';

const FAILURE_PRESENTATION =
  'Tell the caller you are having a technical issue and offer to call back.';

// Wire format (verified at runtime): payload is {"tool": "<name>", "arguments": {...}}
function resolveArgs(toolName, data) {
  return JSON.parse(data.payload).arguments;
}

function guardArgs(toolName, args) {
  if (args === null || args === undefined || typeof args !== 'object') {
    console.error(`${toolName}: could not resolve arguments from payload`, args);
    return false;
  }
  return true;
}

function fail(err) {
  return JSON.stringify({
    error: String(err),
    presentationInstructions: FAILURE_PRESENTATION,
  });
}

function hasLeadData(lead) {
  if (!lead) return false;
  return Boolean(
    lead.intent ||
      lead.propertyType ||
      lead.society ||
      lead.sizeMarla != null ||
      lead.budgetMaxPKR != null ||
      lead.name ||
      lead.phone,
  );
}

export function makeTools({
  leadRef,
  matchesRef,
  mergeLead,
  setMatches,
  addVisit,
  setHandoff,
  setLastAnswer,
  deskRef,
  switchDesk,
  onToolCall,
}) {
  return [
    {
      name: 'get_call_context',
      description:
        'Load in-progress lead fields and listing matches from this browser session. Call IMMEDIATELY after a language desk switch before speaking, or whenever you are unsure what was already discussed.',
      parameters: { type: 'object', properties: {}, required: [] },
      timeout: 5,
      handler: async (data) => {
        try {
          onToolCall('get_call_context', {});
          const lead = leadRef.current || {};
          const matches = Array.isArray(matchesRef?.current) ? matchesRef.current : [];
          const continued = hasLeadData(lead) || matches.length > 0;
          return JSON.stringify({
            result: { continued, lead, matches },
            presentationInstructions: continued
              ? 'This is a continued call after a language switch. Speak immediately in your desk language. Do not re-greet as a new call. Briefly acknowledge the switch, use the known requirements and listings, and continue. Do not re-ask known fields.'
              : 'No prior context. Greet normally and begin.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'update_lead',
      description:
        "Record newly learned details about the caller's property requirement. Call immediately whenever any new detail is learned, even a single field. Do not batch and do not wait.",
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['buy', 'rent', 'sell', 'invest'] },
          propertyType: { type: 'string', enum: ['plot', 'house', 'apartment', 'commercial'] },
          sizeMarla: { type: 'number', description: '1 kanal = 20 marla' },
          sizeLabel: { type: 'string', description: 'exactly what the caller said' },
          society: { type: 'string' },
          phase: { type: 'string' },
          budgetMaxPKR: { type: 'number', description: 'integer rupees, e.g. 20000000' },
          budgetLabel: { type: 'string', description: 'raw utterance, e.g. do crore' },
          features: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['corner', 'park_facing', 'possession', 'file', 'boulevard'],
            },
          },
          timeline: { type: 'string' },
          financing: { type: 'string', enum: ['cash', 'installments'] },
          name: { type: 'string' },
          phone: { type: 'string' },
        },
        required: [],
      },
      timeout: 5,
      handler: async (data) => {
        try {
          const args = resolveArgs('update_lead', data);
          if (!guardArgs('update_lead', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('update_lead', args);
          mergeLead(args);
          // Persist in background — do not block speech on API latency.
          apiPost('/api/leads', args).then((api) => {
            if (!api.ok) console.warn('[update_lead] API sync failed', api.error);
          });
          return JSON.stringify({
            result: 'saved',
            presentationInstructions:
              'Noted. Continue the conversation naturally. Do not read the saved fields back to the caller.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'search_listings',
      description:
        'Search Rehman Estates inventory. Call once propertyType and either society or budget are known.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['buy', 'rent', 'sell', 'invest'] },
          propertyType: { type: 'string', enum: ['plot', 'house', 'apartment', 'commercial'] },
          sizeMarla: { type: 'number' },
          society: { type: 'string' },
          phase: { type: 'string' },
          budgetMaxPKR: { type: 'number' },
          features: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['corner', 'park_facing', 'possession', 'file', 'boulevard'],
            },
          },
        },
        required: [],
      },
      timeout: 8,
      handler: async (data) => {
        try {
          const args = resolveArgs('search_listings', data);
          if (!guardArgs('search_listings', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('search_listings', args);

          // Merge args over everything known so far, so a partial call still
          // searches on the full picture; also persist the new details.
          const criteria = { ...leadRef.current };
          for (const [key, value] of Object.entries(args)) {
            if (value !== null && value !== undefined && value !== '') criteria[key] = value;
          }
          mergeLead(args);

          const api = await apiPost('/api/listings/search', {
            intent: criteria.intent,
            propertyType: criteria.propertyType,
            sizeMarla: criteria.sizeMarla,
            society: criteria.society,
            phase: criteria.phase,
            budgetMaxPKR: criteria.budgetMaxPKR,
            features: criteria.features,
          });
          if (!api.ok) return fail(api.error);

          const top3 = Array.isArray(api.data?.result) ? api.data.result : [];
          setMatches(top3);

          return JSON.stringify({
            result: top3,
            presentationInstructions:
              top3.length > 0
                ? 'Read these out in Urdu, at most three. For each say size, block, one feature, and the price using priceLabelUrdu exactly as written. Then ask which sounds closest. Do not mention any property not in this list.'
                : 'No matches. Tell the caller honestly that nothing matches, then suggest ONE alternative: a nearby society, a smaller size, or a slightly higher budget. Do not invent a property.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'schedule_visit',
      description: 'Schedule a site visit for a specific listing.',
      parameters: {
        type: 'object',
        properties: {
          listingId: { type: 'string' },
          preferredDay: { type: 'string' },
          preferredTime: { type: 'string' },
          callerName: { type: 'string' },
          callerPhone: { type: 'string' },
        },
        required: ['listingId', 'preferredDay'],
      },
      timeout: 5,
      handler: async (data) => {
        try {
          const args = resolveArgs('schedule_visit', data);
          if (!guardArgs('schedule_visit', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('schedule_visit', args);

          const api = await apiPost('/api/visits', args);
          if (!api.ok) return fail(api.error);
          const reference = api.data?.result?.reference;
          if (!reference) return fail(new Error('visit response missing result.reference'));

          addVisit({ ...args, reference });
          if (args.callerName || args.callerPhone) {
            mergeLead({ name: args.callerName, phone: args.callerPhone });
          }
          return JSON.stringify({
            result: { reference },
            presentationInstructions:
              'Confirm the visit warmly in one sentence with the day and time. Give the reference number. Then ask for their name and phone if you do not have both.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'answer_property_question',
      description:
        'Answer a general question about the Pakistani property market - file vs possession, transfer process, bayana, NOC, instalments, taxes, society development, rental norms. Call this whenever the caller asks something factual that is NOT about a specific listing. Do not answer from memory - always call this first.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: "the caller's question, in English or roman Urdu",
          },
        },
        required: ['question'],
      },
      timeout: 5,
      handler: async (data) => {
        try {
          const args = resolveArgs('answer_property_question', data);
          if (!guardArgs('answer_property_question', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('answer_property_question', args);

          const api = await apiPost('/api/knowledge/answer', {
            question: args.question || '',
          });
          if (!api.ok) return fail(api.error);

          const chunk = api.data?.result ?? null;
          if (!chunk) {
            setLastAnswer(null);
            return JSON.stringify({
              result: null,
              presentationInstructions:
                'Tell the caller you are not certain and will confirm with the office and call back. Do not guess. Do not quote any number.',
            });
          }
          setLastAnswer({ id: chunk.id, topic: chunk.topic });
          return JSON.stringify({
            result: { id: chunk.id, topic: chunk.topic, text: chunk.text },
            presentationInstructions:
              'Explain this to the caller in Urdu, in TWO short spoken sentences maximum. Use plain dealer language, not formal Urdu. Do not read it out verbatim and do not list every detail. Then return to what you were discussing before.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'switch_language',
      description:
        'Switch the conversation to another language desk. Call this when the caller speaks or asks for Punjabi or English, or asks to switch back to Urdu. Announce the switch in ONE short sentence before calling.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['urdu', 'punjabi', 'english'] },
        },
        required: ['language'],
      },
      timeout: 5,
      handler: async (data) => {
        try {
          const args = resolveArgs('switch_language', data);
          if (!guardArgs('switch_language', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('switch_language', args);
          const language = args.language;
          if (!['urdu', 'punjabi', 'english'].includes(language)) {
            return fail(new Error(`unknown language: ${language}`));
          }
          if (language === deskRef.current) {
            return JSON.stringify({
              result: 'already',
              presentationInstructions: 'Continue normally. Do not mention switching.',
            });
          }
          // Not awaited: switchDesk tears down this room, which would strand
          // the in-flight RPC. Return immediately; the new desk continues with handoff context.
          switchDesk(language);
          return JSON.stringify({
            result: { desk: language },
            presentationInstructions:
              'Say nothing further. A new language desk is connecting and will continue this same call.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: 'handoff_to_dealer',
      description: 'Hand the conversation off to the human dealer.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: ['price_negotiation', 'complex_query', 'caller_requested', 'agent_uncertain'],
          },
          summary: { type: 'string' },
        },
        required: ['reason', 'summary'],
      },
      timeout: 5,
      handler: async (data) => {
        try {
          const args = resolveArgs('handoff_to_dealer', data);
          if (!guardArgs('handoff_to_dealer', args)) {
            return fail(new Error('arguments missing or unresolvable in tool payload'));
          }
          onToolCall('handoff_to_dealer', args);

          const api = await apiPost('/api/handoffs', {
            reason: args.reason,
            summary: args.summary,
          });
          if (!api.ok) return fail(api.error);

          setHandoff({ reason: args.reason, summary: args.summary, at: Date.now() });
          return JSON.stringify({
            result: 'handoff recorded',
            presentationInstructions:
              'Tell the caller Rehman sahib will call back shortly. Ask for the best time to call. Then close politely.',
          });
        } catch (err) {
          return fail(err);
        }
      },
    },
  ];
}
