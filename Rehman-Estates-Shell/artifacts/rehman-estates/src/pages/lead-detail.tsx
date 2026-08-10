import { useRoute, Link, useLocation } from 'wouter';
import { useState, useRef, useEffect } from 'react';
import { LeadStatus } from '../data/types';
import {
  ArrowLeft,
  PhoneCall,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquareQuote,
  Briefcase,
  MoreHorizontal,
  ChevronDown,
  BellRing,
  Trash2,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import {
  fetchLead,
  patchLead,
  removeLead,
  scheduleFollowUpApi,
  sendListingsEmailApi,
  scheduleVisitApi,
  searchListingsApi,
} from '../lib/api';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  New:       { background: 'rgba(91,106,248,0.09)',  color: '#5B6AF8', border: '1px solid rgba(91,106,248,0.20)' },
  Contacted: { background: 'rgba(245,158,11,0.09)',  color: '#D97706', border: '1px solid rgba(245,158,11,0.20)' },
  Qualified: { background: 'rgba(16,185,129,0.09)',  color: '#059669', border: '1px solid rgba(16,185,129,0.20)' },
  Closed:    { background: 'rgba(148,163,184,0.09)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' },
};

export default function LeadDetail() {
  const [, params] = useRoute('/leads/:id');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params?.id;

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['leads', id],
    queryFn: () => fetchLead(id!),
    enabled: Boolean(id),
    refetchInterval: 4000,
  });

  const [status, setStatus] = useState<LeadStatus | undefined>(undefined);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lead?.status) setStatus(lead.status);
  }, [lead?.status]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (deleted || isError || (!isLoading && !lead)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
          {deleted ? 'Lead deleted' : 'Lead not found'}
        </h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          {deleted ? 'This lead record has been removed.' : "The lead you're looking for doesn't exist or has been removed."}
        </p>
        <Link href="/leads" className="text-sm font-medium" style={{ color: '#5B6AF8' }}>Return to Leads</Link>
      </div>
    );
  }

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: '#94A3B8' }}>
        Loading lead…
      </div>
    );
  }

  const applyStatus = async (next: LeadStatus, label: string) => {
    try {
      await patchLead(lead.id, { status: next });
      setStatus(next);
      setActionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: `Marked as ${label}`, description: `${lead.name}'s status was updated.` });
    } catch (err) {
      toast({ title: 'Update failed', description: String(err) });
    }
  };

  const scheduleFollowUp = async () => {
    setActionsOpen(false);
    try {
      await scheduleFollowUpApi(lead.id, `Callback with ${lead.name} about ${lead.location}`);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      await queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast({ title: 'Follow-up scheduled', description: `Reminder set for ${lead.name} — tomorrow at 10:00 AM.` });
    } catch (err) {
      toast({ title: 'Follow-up failed', description: String(err) });
    }
  };

  const scheduleViewing = async () => {
    try {
      const matches = await searchListingsApi({
        intent: lead.propertyType === 'Rent' ? 'rent' : 'buy',
        society: lead.society || lead.location.split(' ')[0] || undefined,
        budgetMaxPKR: lead.budgetMaxPKR ?? undefined,
      }) as Array<{ id: string }>;
      const listingId = matches[0]?.id || 'RE-001';
      const result = await scheduleVisitApi(
        {
          listingId,
          preferredDay: 'Tomorrow',
          preferredTime: '10:00 AM',
          callerName: lead.name,
          callerPhone: lead.phone,
        },
        lead.sessionId,
      );
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Viewing scheduled',
        description: `Site visit booked (ref ${result.reference}) for ${lead.name}.`,
      });
    } catch (err) {
      toast({ title: 'Could not schedule viewing', description: String(err) });
    }
  };

  const sendListings = async () => {
    try {
      const matches = await searchListingsApi({
        intent: lead.propertyType === 'Rent' ? 'rent' : 'buy',
        society: lead.society || undefined,
        budgetMaxPKR: lead.budgetMaxPKR ?? undefined,
      }) as Array<{ id: string }>;
      const ids = matches.map(m => m.id);
      await sendListingsEmailApi(lead.id, ids);
      await queryClient.invalidateQueries({ queryKey: ['leads', id] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Listings sent',
        description: ids.length
          ? `Emailed ${ids.length} match(es) to ${lead.name}: ${ids.join(', ')}`
          : `Matching listings emailed to ${lead.name}.`,
      });
    } catch (err) {
      toast({ title: 'Send failed', description: String(err) });
    }
  };

  const deleteLead = async () => {
    try {
      await removeLead(lead.id);
      setActionsOpen(false);
      toast({ title: 'Lead deleted', description: `${lead.name} was removed from the directory.` });
      setDeleted(true);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      setTimeout(() => navigate('/leads'), 600);
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err) });
    }
  };

  const callLead = () => {
    toast({ title: 'Opening call desk', description: 'Preview how Tareeq handles an inbound call.' });
    navigate('/call');
  };

  const firstName = lead.name.split(' ')[0];

  return (
    <div className="w-full space-y-6 pb-12">
      <Link href="/leads" className="inline-flex items-center gap-2 text-sm transition-colors" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B6AF8, #818CF8)', fontFamily: 'var(--app-font-sans)', boxShadow: '0 6px 20px rgba(91,106,248,0.28)' }}>
            {lead.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>{lead.name}</h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{ ...(STATUS_STYLE[status ?? 'New'] ?? STATUS_STYLE['Closed']), fontFamily: 'var(--app-font-mono)' }}>
                {status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: '#94A3B8' }}>
              <span style={{ fontFamily: 'var(--app-font-mono)' }}>{lead.id}</span>
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--app-font-sans)' }}>
                <Calendar className="w-3.5 h-3.5" /> {new Date(lead.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Actions dropdown */}
          <div ref={actionsRef} className="relative">
            <button
              onClick={() => setActionsOpen(o => !o)}
              className="glass-btn-secondary px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
              style={{
                background: actionsOpen ? 'rgba(91,106,248,0.08)' : undefined,
                border: actionsOpen ? '1px solid rgba(91,106,248,0.25)' : undefined,
                color: actionsOpen ? '#5B6AF8' : '#334155',
                fontFamily: 'var(--app-font-sans)',
              }}
            >
              <MoreHorizontal className="w-4 h-4" /> Actions
              <ChevronDown className="w-3.5 h-3.5" style={{ transform: actionsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            <AnimatePresence>
              {actionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="glass-popover absolute top-full right-0 mt-2 w-64 z-50 overflow-hidden"
                >
                  <div className="px-3 pt-3 pb-1 text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                    Update Status
                  </div>
                  {(['Contacted', 'Qualified', 'Closed'] as LeadStatus[]).map(s => (
                    <button key={s} onClick={() => applyStatus(s, s)}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,106,248,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-sm" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>Mark as {s}</span>
                      {status === s && <Check className="w-3.5 h-3.5" style={{ color: '#5B6AF8' }} />}
                    </button>
                  ))}

                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }} />

                  <button onClick={scheduleFollowUp}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,106,248,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <BellRing className="w-3.5 h-3.5" style={{ color: '#5B6AF8' }} />
                    <span className="text-sm" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>Schedule follow-up</span>
                  </button>

                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }} />

                  <button onClick={deleteLead}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,64,64,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#E04040' }} />
                    <span className="text-sm" style={{ fontFamily: 'var(--app-font-sans)', color: '#E04040' }}>Delete lead</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Open call desk preview */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={callLead}
            className="px-4 py-2.5 rounded-xl transition-all font-semibold text-sm text-white flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #5B6AF8, #818CF8)',
              boxShadow: '0 4px 16px rgba(91,106,248,0.30)',
              fontFamily: 'var(--app-font-sans)',
              border: 'none',
            }}
          >
            <PhoneCall className="w-4 h-4" /> Open call desk
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Left Column - Details */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 space-y-4"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] pb-2" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
              Contact Info
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <PhoneCall className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#5B6AF8' }} />
                <div>
                  <div className="text-xs" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Phone Number</div>
                  <div className="mt-0.5" style={{ color: '#0F172A', fontFamily: 'var(--app-font-mono)', fontSize: '13px' }}>{lead.phone}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#5B6AF8' }} />
                <div>
                  <div className="text-xs" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Email Address</div>
                  <div className="mt-0.5" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)', fontSize: '13px' }}>{lead.email || 'Not provided'}</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-5 space-y-4"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] pb-2" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
              Property Preferences
            </h3>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Intent</div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(91,106,248,0.08)', color: '#5B6AF8', fontFamily: 'var(--app-font-sans)' }}>
                  <Briefcase className="w-3.5 h-3.5" /> {lead.propertyType}
                </div>
              </div>

              {(lead.agentPropertyType || lead.sizeMarla != null || lead.sizeLabel) && (
                <div>
                  <div className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Looking for</div>
                  <div className="text-sm" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>
                    {[
                      lead.sizeLabel || (lead.sizeMarla != null ? `${lead.sizeMarla} marla` : null),
                      lead.agentPropertyType,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Target Budget</div>
                <div className="flex items-center gap-2" style={{ color: '#0F172A', fontFamily: 'var(--app-font-mono)', fontSize: '13px' }}>
                  <DollarSign className="w-4 h-4" style={{ color: '#C9A84C' }} /> {lead.budget}
                </div>
              </div>

              <div>
                <div className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Preferred Location</div>
                <div className="flex items-center gap-2 text-sm" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#5B6AF8' }} /> {lead.location}
                </div>
              </div>

              {lead.notes?.trim() && (
                <div>
                  <div className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>Notes</div>
                  <div className="text-sm whitespace-pre-wrap" style={{ color: '#475569', fontFamily: 'var(--app-font-sans)' }}>
                    {lead.notes}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Transcript & AI */}
        <div className="md:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-panel p-5"
          >
            <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                <MessageSquareQuote className="w-3.5 h-3.5" /> Call Transcript
              </h3>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-mono)' }}>
                <Clock className="w-3 h-3" /> {lead.callDuration} duration
              </div>
            </div>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-2">
              {!lead.transcript?.trim() ? (
                <p className="text-sm" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                  No transcript captured for this lead yet.
                </p>
              ) : (
                lead.transcript.split('\n').filter(Boolean).map((line, i) => {
                  const isCaller = line.startsWith(`${firstName}:`) || line.startsWith('Caller:');
                  const isAgent = !isCaller;
                  const text = line.replace(/^[^:]+:\s*/, '');
                  return (
                    <div key={i} className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}>
                      <span className="text-[10px] mb-1" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                        {isAgent ? 'Tareeq — AI Agent' : lead.name}
                      </span>
                      <div
                        className="px-4 py-2.5 rounded-2xl max-w-[85%] text-sm"
                        dir="rtl"
                        lang="ur"
                        style={{
                          fontFamily: "'Noto Nastaliq Urdu', serif",
                          lineHeight: '2',
                          textAlign: 'right',
                          ...(isAgent
                            ? {
                                background: 'rgba(148,163,184,0.10)',
                                border: '1px solid rgba(148,163,184,0.18)',
                                color: '#0F172A',
                                borderTopLeftRadius: '4px',
                              }
                            : {
                                background: 'linear-gradient(135deg, #5B6AF8, #818CF8)',
                                color: '#FFFFFF',
                                borderTopRightRadius: '4px',
                                boxShadow: '0 4px 14px rgba(91,106,248,0.25)',
                              }),
                        }}
                      >
                        {text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card p-5"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] pb-3 mb-4" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
              AI Summary &amp; Suggested Actions
            </h3>

            <div className="p-4 rounded-xl text-sm mb-5 leading-relaxed"
              style={{ background: 'rgba(248,250,252,0.80)', border: '1px solid rgba(148,163,184,0.16)', color: '#334155', fontFamily: 'var(--app-font-sans)' }}>
              {lead.notes}
            </div>

            <div className="space-y-2">
              <button
                onClick={scheduleViewing}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-all group"
                style={{ border: '1px solid rgba(148,163,184,0.20)', background: 'rgba(255,255,255,0.60)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(91,106,248,0.35)'; e.currentTarget.style.background = 'rgba(91,106,248,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.20)'; e.currentTarget.style.background = 'rgba(255,255,255,0.60)'; }}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 transition-colors" style={{ color: '#94A3B8' }} />
                  <span className="text-sm font-medium" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>Schedule property viewing</span>
                </div>
                <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#5B6AF8' }}>Execute</span>
              </button>

              <button
                onClick={sendListings}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-all group"
                style={{ border: '1px solid rgba(148,163,184,0.20)', background: 'rgba(255,255,255,0.60)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(91,106,248,0.35)'; e.currentTarget.style.background = 'rgba(91,106,248,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.20)'; e.currentTarget.style.background = 'rgba(255,255,255,0.60)'; }}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 transition-colors" style={{ color: '#94A3B8' }} />
                  <span className="text-sm font-medium" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>Send matching listings via email</span>
                </div>
                <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#5B6AF8' }}>Execute</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
