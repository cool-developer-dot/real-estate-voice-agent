import { useState, useRef, useEffect } from 'react';
import { Lead, LeadStatus, PropertyType } from '../data/types';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Filter, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown,
  X, LayoutGrid, List, CheckSquare, Square, PhoneCall, Calendar, MapPin, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLeads } from '../lib/api';

/* ─── constants ─── */
const PROPERTY_TYPE_UR: Record<string, string> = {
  Buy: 'خرید', Rent: 'کرایہ', Invest: 'سرمایہ کاری',
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  New:       { background: 'rgba(91,106,248,0.09)',  color: '#5B6AF8',  border: '1px solid rgba(91,106,248,0.20)'  },
  Contacted: { background: 'rgba(245,158,11,0.09)',  color: '#D97706',  border: '1px solid rgba(245,158,11,0.20)'  },
  Qualified: { background: 'rgba(16,185,129,0.09)',  color: '#059669',  border: '1px solid rgba(16,185,129,0.20)'  },
  Closed:    { background: 'rgba(148,163,184,0.09)', color: '#64748B',  border: '1px solid rgba(148,163,184,0.20)' },
};

/* ─── grid-card accents: status is the ONLY source of color, used sparingly
   (top hairline, status pill, icon tint on hover) — the card itself stays
   neutral/white per the production-grade spec. ─── */
const STATUS_ACCENT: Record<string, { color: string }> = {
  New:       { color: '#4F6EF7' },
  Contacted: { color: '#B7791F' },
  Qualified: { color: '#0F9D62' },
  Closed:    { color: '#64748B' },
};

type SortCol = 'name' | 'status' | 'createdAt' | 'budget' | null;
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';
const ALL_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed'];
const ALL_TYPES: PropertyType[] = ['Buy', 'Rent', 'Invest'];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function leadRequirementLine(lead: Lead): string {
  const size = lead.sizeLabel || (lead.sizeMarla != null ? `${lead.sizeMarla} marla` : '');
  const kind = lead.agentPropertyType || '';
  return [size, kind].filter(Boolean).join(' · ');
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className="flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg transition-colors text-left"
      style={{ background: checked ? 'rgba(91,106,248,0.07)' : 'transparent' }}>
      <div style={{ color: checked ? '#5B6AF8' : '#CBD5E1', flexShrink: 0 }}>
        {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
      </div>
      <span className="text-xs" style={{ fontFamily: 'var(--app-font-sans)', color: checked ? '#0F172A' : '#64748B' }}>
        {label}
      </span>
      {checked && <Check className="w-3 h-3 ml-auto" style={{ color: '#5B6AF8', opacity: 0.7 }} />}
    </button>
  );
}

export default function Leads() {
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [typeFilter, setTypeFilter]     = useState<PropertyType[]>([]);
  const [viewMode, setViewMode]         = useState<ViewMode>('table');
  const [sortCol, setSortCol]           = useState<SortCol>('createdAt');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [filterOpen, setFilterOpen]     = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const { data: leads = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 4000,
    retry: 1,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── filter ── */
  const filtered = leads.filter(lead => {
    const q = searchTerm.toLowerCase();
    const ok = !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      lead.location.toLowerCase().includes(q) ||
      lead.id.toLowerCase().includes(q) ||
      lead.budget.includes(searchTerm) ||
      lead.status.toLowerCase().includes(q);
    return ok &&
      (statusFilter.length === 0 || statusFilter.includes(lead.status)) &&
      (typeFilter.length === 0   || typeFilter.includes(lead.propertyType));
  });

  /* ── sort ── */
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const av = sortCol === 'name' ? a.name : sortCol === 'status' ? a.status : sortCol === 'createdAt' ? a.createdAt : a.budget;
    const bv = sortCol === 'name' ? b.name : sortCol === 'status' ? b.status : sortCol === 'createdAt' ? b.createdAt : b.budget;
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const activeFilterCount = statusFilter.length + typeFilter.length;
  const clearFilters = () => { setStatusFilter([]); setTypeFilter([]); };

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-25" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="w-3 h-3" style={{ color: '#5B6AF8' }} />
      : <ArrowDown className="w-3 h-3" style={{ color: '#5B6AF8' }} />;
  }

  type ColDef = { label: string; sortKey: SortCol; align?: 'right' };
  const COLS: ColDef[] = [
    { label: 'Lead',          sortKey: 'name'      },
    { label: 'Contact',       sortKey: null         },
    { label: 'Interest',      sortKey: null         },
    { label: 'Budget / Area', sortKey: 'budget'    },
    { label: 'Status',        sortKey: 'status'    },
    { label: 'Received',      sortKey: 'createdAt', align: 'right' },
  ];

  /* ── secondary control styles (glass via class) ── */
  const btnBase: React.CSSProperties = {
    color: '#64748B',
    fontFamily: 'var(--app-font-sans)',
  };

  return (
    <div className="w-full space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            Lead Directory
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
            {isLoading ? 'Loading…' : `${sorted.length} of ${leads.length} leads`}
            {activeFilterCount > 0 && (
              <span style={{ color: '#5B6AF8' }}> · {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            <input
              type="text" placeholder="Search leads..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="glass-input pl-9 pr-8 py-2 text-xs focus:outline-none w-52"
              style={{ ...btnBase, fontSize: '12px', padding: '8px 8px 8px 36px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter */}
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="glass-btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl"
              style={{
                ...btnBase,
                ...(filterOpen || activeFilterCount > 0 ? {
                  background: 'rgba(91,106,248,0.08)',
                  border: '1px solid rgba(91,106,248,0.25)',
                  color: '#5B6AF8',
                } : {}),
              }}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                  style={{ background: '#5B6AF8', fontFamily: 'var(--app-font-mono)' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="glass-popover absolute top-full right-0 mt-2 w-56 z-[90] overflow-hidden"
                >
                  <div className="px-3 pt-3 pb-2">
                    <div className="text-[9px] uppercase tracking-[0.14em] font-bold mb-2"
                      style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}>Status</div>
                    {ALL_STATUSES.map(s => (
                      <Checkbox key={s} checked={statusFilter.includes(s)} label={s}
                        onChange={() => setStatusFilter(prev => toggle(prev, s))} />
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }} />
                  <div className="px-3 pt-3 pb-2">
                    <div className="text-[9px] uppercase tracking-[0.14em] font-bold mb-2"
                      style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}>Property Type</div>
                    {ALL_TYPES.map(t => (
                      <Checkbox key={t} checked={typeFilter.includes(t)} label={`${t} — ${PROPERTY_TYPE_UR[t]}`}
                        onChange={() => setTypeFilter(prev => toggle(prev, t))} />
                    ))}
                  </div>
                  {activeFilterCount > 0 && (
                    <>
                      <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }} />
                      <div className="px-3 py-2.5 flex justify-between items-center">
                        <span className="text-[10px]" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={clearFilters}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
                          style={{ color: '#E04040', background: 'rgba(224,64,64,0.07)', fontFamily: 'var(--app-font-sans)' }}>
                          <X className="w-2.5 h-2.5" /> Clear all
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="glass-control flex items-center overflow-hidden" style={{ borderRadius: '12px', padding: 0 }}>
            <button onClick={() => setViewMode('table')}
              className="flex items-center px-3 py-2 text-xs transition-colors"
              title="Table view"
              style={{
                background: viewMode === 'table' ? 'rgba(91,106,248,0.10)' : 'transparent',
                color: viewMode === 'table' ? '#5B6AF8' : '#94A3B8',
                borderRight: '1px solid rgba(148,163,184,0.18)',
              }}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className="flex items-center px-3 py-2 text-xs transition-colors"
              title="Grid view"
              style={{
                background: viewMode === 'grid' ? 'rgba(91,106,248,0.10)' : 'transparent',
                color: viewMode === 'grid' ? '#5B6AF8' : '#94A3B8',
              }}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isError && (
        <div className="glass-card p-4 mb-4 text-sm" style={{ fontFamily: 'var(--app-font-sans)', color: '#B91C1C' }}>
          Can’t reach the leads API. {String((error as Error)?.message || 'Is the api-server running on :3001?')}
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-3 text-xs font-semibold underline"
            style={{ color: '#5B6AF8' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── No results ── */}
      {!isLoading && !isError && sorted.length === 0 && (
        <div className="glass-card py-16 text-center">
          <div className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--app-font-sans)', color: '#64748B' }}>
            {leads.length === 0 && !searchTerm && activeFilterCount === 0 ? 'No leads yet' : 'No leads found'}
          </div>
          <div className="text-xs" style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}>
            {activeFilterCount > 0
              ? 'Try adjusting your filters.'
              : leads.length === 0
                ? 'Start a preview call — captured requirements show up here live.'
                : `No results matching "${searchTerm}"`}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="mt-4 text-xs px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: 'rgba(91,106,248,0.08)', color: '#5B6AF8', border: '1px solid rgba(91,106,248,0.18)', fontFamily: 'var(--app-font-sans)' }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && sorted.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                  {COLS.map(col => (
                    <th key={col.label}
                      onClick={() => col.sortKey && handleSort(col.sortKey)}
                      className="px-6 py-4 select-none"
                      style={{
                        fontFamily: 'var(--app-font-sans)',
                        fontSize: '9px', letterSpacing: '0.14em',
                        textTransform: 'uppercase', fontWeight: 700,
                        color: sortCol === col.sortKey ? '#5B6AF8' : '#94A3B8',
                        background: 'rgba(248,250,252,0.70)',
                        textAlign: col.align === 'right' ? 'right' : 'left',
                        cursor: col.sortKey ? 'pointer' : 'default',
                      }}>
                      <div className="flex items-center gap-1"
                        style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                        {col.label}
                        {col.sortKey && <SortIcon col={col.sortKey} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead, i) => (
                  <motion.tr key={lead.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.18 }}
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = 'rgba(91,106,248,0.03)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')}
                  >
                    <td className="px-6 py-4">
                      <Link href={`/leads/${lead.id}`}>
                        <div>
                          <div className="font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A', fontSize: '13px' }}>
                            {lead.name}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--app-font-mono)', color: '#CBD5E1' }}>
                            {lead.id}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div style={{ fontFamily: 'var(--app-font-mono)', color: '#475569', fontSize: '12px' }}>{lead.phone}</div>
                      <div className="text-[10px] mt-0.5 truncate max-w-[140px]" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                        {lead.email || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
                        {lead.propertyType}
                        {leadRequirementLine(lead) ? ` · ${leadRequirementLine(lead)}` : ''}
                      </div>
                      <div className="text-[10px] mt-0.5" lang="ur" dir="rtl" style={{ fontFamily: "'Noto Nastaliq Urdu', serif", color: '#94A3B8' }}>
                        {PROPERTY_TYPE_UR[lead.propertyType] ?? lead.propertyType}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div style={{ fontFamily: 'var(--app-font-mono)', color: '#0F172A', fontSize: '12px' }}>{lead.budget}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>{lead.location}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.10em]"
                        style={{ fontFamily: 'var(--app-font-mono)', ...(STATUS_STYLE[lead.status] ?? STATUS_STYLE['Closed']), borderRadius: '5px' }}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div style={{ fontFamily: 'var(--app-font-mono)', color: '#475569', fontSize: '12px' }}>
                        {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-mono)' }}>
                        {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {viewMode === 'grid' && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {sorted.map((lead, i) => {
            const accent = STATUS_ACCENT[lead.status] ?? STATUS_ACCENT['Closed'];
            return (
              <motion.div key={lead.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.18 }}
                className="h-full">
                <Link href={`/leads/${lead.id}`}>
                  <div className="glass-card glass-hover relative flex flex-col h-full cursor-pointer overflow-hidden"
                    style={{ borderRadius: '14px' }}>
                    {/* Thin status hairline — the only large-area use of accent color */}
                    <div aria-hidden="true" style={{ height: '2.5px', background: accent.color, opacity: 0.75, flexShrink: 0 }} />

                    <div className="flex flex-col flex-1 px-4 pt-3.5 pb-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{ background: 'rgba(241,245,249,0.90)', border: '1px solid rgba(148,163,184,0.18)', color: '#1E293B', fontFamily: 'var(--app-font-sans)' }}>
                            {lead.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold leading-tight truncate" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
                              {lead.name}
                            </div>
                            <div className="text-[10.5px] mt-0.5" style={{ fontFamily: 'var(--app-font-mono)', color: '#94A3B8' }}>{lead.id}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-1 rounded-md flex-shrink-0"
                          style={{ fontFamily: 'var(--app-font-mono)', ...(STATUS_STYLE[lead.status] ?? STATUS_STYLE['Closed']) }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: accent.color }} />
                          {lead.status}
                        </span>
                      </div>

                      {/* Contact block */}
                      <div className="space-y-1.5 mb-3.5">
                        <div className="flex items-center gap-2">
                          <PhoneCall className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
                          <span className="text-[12.5px]" style={{ fontFamily: 'var(--app-font-mono)', color: '#334155' }}>{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
                          <span className="text-[12.5px] truncate" style={{ fontFamily: 'var(--app-font-sans)', color: '#475569' }}>{lead.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
                          <span className="text-[12.5px]" style={{ fontFamily: 'var(--app-font-mono)', color: '#94A3B8' }}>
                            {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {lead.callDuration}
                          </span>
                        </div>
                      </div>

                      {/* Property footer — pinned to bottom for equal-height cards */}
                      <div className="mt-auto pt-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(148,163,184,0.14)' }}>
                        <span className="text-xs font-semibold uppercase tracking-[0.04em]" style={{ fontFamily: 'var(--app-font-sans)', color: '#475569' }}>
                          {lead.propertyType}
                          <span className="ml-1.5" lang="ur" dir="rtl" style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                            ({PROPERTY_TYPE_UR[lead.propertyType]})
                          </span>
                        </span>
                        <span className="text-[13px] font-semibold flex-shrink-0" style={{ fontFamily: 'var(--app-font-mono)', color: '#0F172A' }} lang="ur" dir="rtl">
                          {lead.budget}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
