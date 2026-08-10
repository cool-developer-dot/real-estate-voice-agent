import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  PhoneCall,
  Clock,
  Calendar,
  ChevronRight,
  PhoneForwarded,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchLeads, fetchStats, fetchFollowUps } from '../lib/api';

/* ─── metric card color-blob configs ───
   Existing accent colors are LOCKED — glass material only changes depth. */
const KPI_CONFIGS = [
  {
    // Active Calls — indigo/blue
    blobColor: '#5B6AF8',
    blobColorSoft: '#93C5FD',
    iconBg: 'rgba(99,102,241,0.12)',
    iconColor: '#5B6AF8',
    Icon: PhoneCall,
  },
  {
    // Leads Captured — purple
    blobColor: '#8B5CF6',
    blobColorSoft: '#C4B5FD',
    iconBg: 'rgba(139,92,246,0.12)',
    iconColor: '#7C3AED',
    Icon: UserPlus,
  },
  {
    // Follow-ups Pending — cyan
    blobColor: '#06AED4',
    blobColorSoft: '#A5F3FC',
    iconBg: 'rgba(6,182,212,0.10)',
    iconColor: '#0891B2',
    Icon: Clock,
  },
  {
    // Conversion Rate — orange
    blobColor: '#F0790A',
    blobColorSoft: '#FDBA74',
    iconBg: 'rgba(234,88,12,0.08)',
    iconColor: '#EA580C',
    Icon: TrendingUp,
  },
];

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  QUALIFIED: { background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.22)' },
  CONTACTED: { background: 'rgba(245,158,11,0.10)', color: '#D97706', border: '1px solid rgba(245,158,11,0.22)' },
  NEW:        { background: 'rgba(91,106,248,0.10)', color: '#5B6AF8', border: '1px solid rgba(91,106,248,0.22)' },
  CLOSED:     { background: 'rgba(148,163,184,0.10)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' },
};

export default function Dashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 4000,
  });
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 4000,
  });
  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: fetchFollowUps,
    refetchInterval: 4000,
  });

  const recentLeads = leads.slice(0, 4);
  const pendingActions = [
    ...followUps.slice(0, 3).map((f) => {
      const lead = leads.find((l) => l.id === f.leadId);
      return {
        id: f.id,
        leadId: f.leadId,
        name: lead?.name || 'Lead',
        detail: f.note,
        when: new Date(f.when).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        urgent: true,
        kind: 'followup' as const,
      };
    }),
    ...leads
      .filter((l) => l.status === 'New' || l.status === 'Contacted')
      .slice(0, 3)
      .map((l) => ({
        id: `pending-${l.id}`,
        leadId: l.id,
        name: l.name,
        detail: `${l.propertyType} — ${l.location} (${l.budget})`,
        when: l.status === 'New' ? 'Needs contact' : 'Follow up',
        urgent: l.status === 'New',
        kind: 'lead' as const,
      })),
  ].slice(0, 4);
  const liveStats = [
    { label: 'Inbound Active', value: String(stats?.activeCalls ?? 0), change: '0', trend: 'neutral' as const },
    { label: 'Leads Captured (Today)', value: String(stats?.leadsToday ?? 0), change: String(stats?.totalLeads ?? 0), trend: 'up' as const },
    { label: 'Follow-ups Pending', value: String(stats?.followUpsPending ?? 0), change: String(stats?.handoffs ?? 0), trend: 'down' as const },
    { label: 'Conversion Rate', value: `${stats?.conversionRate ?? 0}%`, change: `${stats?.visits ?? 0} visits`, trend: 'up' as const },
  ];

  return (
    <div className="w-full space-y-6">

      {/* ── AI Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.40, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel glass-reflect relative overflow-hidden text-center py-12 px-6"
      >
        {/* Subtle background gradient zones */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 80% at 15% 50%, rgba(147,197,253,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 70% at 85% 50%, rgba(196,181,253,0.15) 0%, transparent 65%)',
          }}
        />

        {/* AI Orb */}
        <div className="flex justify-center mb-6">
          <div className="ai-orb">
            <div className="ai-orb__sphere" />
            <div className="ai-orb__ring" aria-hidden="true" />
            <div className="ai-orb__ring2" aria-hidden="true" />
          </div>
        </div>

        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}
        >
          Inbound Front Desk
        </h1>
        <p className="text-base mb-1" style={{ color: '#64748B', fontFamily: 'var(--app-font-sans)' }}>
          Tareeq answers inbound callers and captures leads into this dashboard.
        </p>
        <p
          className="text-sm mb-6"
          style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}
        >
          Tareeq — Pakistani AI Property Consultant&ensp;·&ensp;طارق
        </p>

        {/* Status + secondary preview CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
            style={{
              background: (stats?.activeCalls ?? 0) > 0 ? 'rgba(224,64,64,0.06)' : 'rgba(16,185,129,0.08)',
              border: (stats?.activeCalls ?? 0) > 0
                ? '1px solid rgba(224,64,64,0.18)'
                : '1px solid rgba(16,185,129,0.22)',
            }}
          >
            {(stats?.activeCalls ?? 0) > 0 ? (
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#E04040' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#E04040' }} />
              </div>
            ) : (
              <span className="inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#10B981' }} />
            )}
            <span
              className="text-sm font-medium"
              style={{
                color: (stats?.activeCalls ?? 0) > 0 ? '#E04040' : '#059669',
                fontFamily: 'var(--app-font-sans)',
              }}
            >
              {(stats?.activeCalls ?? 0) > 0
                ? `${stats?.activeCalls} inbound active`
                : 'Listening for inbound calls'}
            </span>
          </div>

          <Link href="/call">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(91,106,248,0.28)',
                color: '#5B6AF8',
                fontFamily: 'var(--app-font-sans)',
                boxShadow: '0 2px 10px rgba(91,106,248,0.10)',
              }}
            >
              <PhoneCall className="w-4 h-4" />
              See what a call looks like
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveStats.map((stat, i) => {
          const cfg = KPI_CONFIGS[i];
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 + 0.15, duration: 0.28 }}
              className="glass-card glass-hover relative overflow-hidden p-5 flex flex-col gap-3 group cursor-default"
            >
              {/* Color blobs — organic, blurred accent shapes unique to this card, clipped by overflow-hidden */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: '150px',
                  height: '150px',
                  top: '-58px',
                  right: '-46px',
                  background: `radial-gradient(circle at 38% 35%, ${cfg.blobColorSoft} 0%, ${cfg.blobColor} 55%, transparent 78%)`,
                  borderRadius: '42% 58% 65% 35% / 45% 40% 60% 55%',
                  filter: 'blur(26px)',
                  opacity: 0.55,
                  pointerEvents: 'none',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: '70px',
                  height: '70px',
                  bottom: '-26px',
                  left: '-22px',
                  background: cfg.blobColor,
                  borderRadius: '58% 42% 38% 62% / 55% 45% 55% 45%',
                  filter: 'blur(22px)',
                  opacity: 0.14,
                  pointerEvents: 'none',
                }}
              />

              {/* Icon badge */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                style={{ background: cfg.iconBg }}>
                <cfg.Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
              </div>

              <div className="relative">
                <span className="text-[9px] uppercase tracking-[0.14em] font-bold block mb-1"
                  style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}>
                  {stat.label}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-semibold tabular-nums"
                    style={{ fontFamily: 'var(--app-font-mono)', color: '#0F172A' }}>
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium flex items-center gap-0.5"
                    style={{
                      fontFamily: 'var(--app-font-mono)',
                      color: stat.trend === 'up' ? '#059669' : stat.trend === 'down' ? '#94A3B8' : '#94A3B8',
                    }}>
                    {stat.trend === 'up'   && <ArrowUpRight className="w-3 h-3" />}
                    {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
                    {stat.change !== '0' && stat.change}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Inquiries */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
              Recent Inquiries
            </h2>
            <Link href="/leads">
              <span className="text-xs flex items-center gap-0.5 cursor-pointer transition-opacity hover:opacity-70"
                style={{ fontFamily: 'var(--app-font-sans)', color: '#5B6AF8' }}>
                View all <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
            {recentLeads.length === 0 && (
              <div className="p-6 text-sm" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                No leads captured yet — they’ll appear here when callers reach Tareeq.
              </div>
            )}
            {recentLeads.map((lead, i) => (
              <Link key={lead.id} href={`/leads/${lead.id}`}>
                <div
                  className="p-4 cursor-pointer flex items-center justify-between transition-colors"
                  style={{ borderBottom: i !== recentLeads.length - 1 ? '1px solid rgba(148,163,184,0.10)' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(91,106,248,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: 'rgba(91,106,248,0.10)', color: '#5B6AF8', fontFamily: 'var(--app-font-sans)' }}>
                      {lead.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>
                        {lead.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-mono)' }}>
                        <span className="flex items-center gap-1"><PhoneCall className="w-3 h-3" /> {lead.phone}</span>
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {lead.propertyType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="px-2 py-0.5 rounded text-[9px] font-bold tracking-[0.10em] uppercase"
                      style={{ fontFamily: 'var(--app-font-mono)', ...(STATUS_STYLES[lead.status.toUpperCase()] ?? STATUS_STYLES['CLOSED']), borderRadius: '4px' }}>
                      {lead.status}
                    </div>
                    <span className="text-[10px]" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-mono)' }}>
                      {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Action Center */}
        <div className="space-y-4">
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            Action Center
          </h2>

          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="space-y-3 mb-5">
              <p className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                Pending Callbacks
              </p>

              {pendingActions.length === 0 && (
                <p className="text-sm py-2" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                  No pending follow-ups. New and contacted inbound leads show up here.
                </p>
              )}

              {pendingActions.map((item) => (
                <Link key={item.id} href={`/leads/${item.leadId}`}>
                  <div className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: item.urgent ? 'rgba(245,158,11,0.06)' : 'rgba(148,163,184,0.06)',
                      border: item.urgent ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(148,163,184,0.16)',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = item.urgent ? 'rgba(245,158,11,0.09)' : 'rgba(148,163,184,0.09)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = item.urgent ? 'rgba(245,158,11,0.06)' : 'rgba(148,163,184,0.06)')}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: item.urgent ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.10)',
                        border: item.urgent ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(148,163,184,0.20)',
                      }}>
                      {item.kind === 'followup'
                        ? <Calendar className="w-4 h-4" style={{ color: item.urgent ? '#D97706' : '#64748B' }} />
                        : <PhoneForwarded className="w-4 h-4" style={{ color: item.urgent ? '#D97706' : '#64748B' }} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#0F172A', fontFamily: 'var(--app-font-sans)' }}>{item.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748B', fontFamily: 'var(--app-font-sans)', lineHeight: '1.5' }}>
                        {item.detail}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: item.urgent ? '#D97706' : '#94A3B8', fontFamily: 'var(--app-font-mono)' }}>
                        <Clock className="w-3 h-3" /> {item.when}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '16px' }}>
              <Link href="/leads">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: 'rgba(91,106,248,0.08)',
                    color: '#5B6AF8',
                    fontFamily: 'var(--app-font-sans)',
                    border: '1px solid rgba(91,106,248,0.22)',
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  View all captured leads
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
