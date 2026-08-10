import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Settings,
  Building2,
  Bell,
  Search,
  PhoneForwarded,
  Calendar,
  UserPlus,
  X,
  CheckCheck,
  Menu,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchLeads, fetchNotifications, type ApiNotification } from '../../lib/api';

function notificationIcon(kind: string) {
  if (kind === 'handoff') return PhoneForwarded;
  if (kind === 'visit' || kind === 'followup') return Calendar;
  return UserPlus;
}

/* ─── GlobalSearch ─── */
function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 5000,
  });

  const results = query.trim().length >= 1
    ? leads.filter(l =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.phone.replace(/\s/g, '').includes(query.replace(/\s/g, '')) ||
        l.location.toLowerCase().includes(query.toLowerCase()) ||
        l.id.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = useCallback((leadId: string) => {
    navigate(`/leads/${leadId}`);
    setQuery(''); setOpen(false); setActiveIdx(-1);
    inputRef.current?.blur();
  }, [navigate]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIdx >= 0) go(results[activeIdx].id);
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); }
  };

  const STATUS_COLOR: Record<string, string> = {
    New: '#5B6AF8', Contacted: '#F59E0B', Qualified: '#10B981', Closed: '#94A3B8',
  };

  return (
    <div ref={ref} className="flex-1 max-w-xl relative">
      <Search
        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: '#94A3B8' }}
      />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search leads, phone numbers..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onKeyDown={handleKey}
        onFocus={() => setOpen(true)}
        className="glass-input w-full pl-9 pr-8 py-1.5 text-xs focus:outline-none"
        style={{ fontFamily: 'var(--app-font-sans)' }}
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: '#94A3B8' }}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {open && results.length > 0 && (
        <div className="glass-popover absolute top-full left-0 right-0 mt-2 z-[100] overflow-hidden">
          <div className="px-3 py-2 text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((lead, i) => (
            <button
              key={lead.id}
              onClick={() => go(lead.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{
                background: i === activeIdx ? 'rgba(91,106,248,0.06)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid rgba(148,163,184,0.08)' : 'none',
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                style={{ background: 'rgba(91,106,248,0.10)', color: '#5B6AF8' }}>
                {lead.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>{lead.name}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ color: STATUS_COLOR[lead.status], background: STATUS_COLOR[lead.status] + '18', fontFamily: 'var(--app-font-mono)' }}>
                    {lead.status}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--app-font-mono)', color: '#94A3B8' }}>
                  {lead.phone} · {lead.id}
                </div>
              </div>
            </button>
          ))}
          <div className="px-3 py-2 text-center" style={{ borderTop: '1px solid rgba(148,163,184,0.10)' }}>
            <button onClick={() => { navigate('/leads'); setQuery(''); setOpen(false); }} className="text-[10px] transition-colors"
              style={{ fontFamily: 'var(--app-font-sans)', color: 'rgba(91,106,248,0.70)' }}>
              View all leads →
            </button>
          </div>
        </div>
      )}

      {open && query.trim().length >= 1 && results.length === 0 && (
        <div className="glass-popover absolute top-full left-0 right-0 mt-2 z-[100] px-4 py-5 text-center">
          <div className="text-xs" style={{ fontFamily: 'var(--app-font-sans)', color: '#94A3B8' }}>
            No leads match "{query}"
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── NotificationBell ─── */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 4000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !read.has(n.id)).length;
  const markAll = () => setRead(new Set(notifications.map(n => n.id)));

  const openItem = (n: ApiNotification) => {
    setRead(prev => new Set([...prev, n.id]));
    setOpen(false);
    if (n.leadId) navigate(`/leads/${n.leadId}`);
    else navigate('/leads');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass-control relative w-8 h-8 flex items-center justify-center rounded-xl"
        style={{
          background: open ? 'rgba(91,106,248,0.10)' : undefined,
          border: open ? '1px solid rgba(91,106,248,0.25)' : undefined,
          color: open ? '#5B6AF8' : '#64748B',
        }}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
            style={{ background: '#5B6AF8', fontFamily: 'var(--app-font-mono)' }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass-popover absolute top-full right-0 mt-2 z-[100] overflow-hidden"
          style={{ width: 'min(408px, calc(100vw - 32px))', borderRadius: '20px' }}
        >
          <div className="flex items-center justify-between" style={{ padding: '18px 20px 16px' }}>
            <div>
              <div className="font-semibold leading-tight" style={{ fontFamily: 'var(--app-font-sans)', fontSize: '20px', color: '#0F172A', letterSpacing: '-0.01em' }}>
                Notifications
              </div>
              <div className="mt-1" style={{ fontFamily: 'var(--app-font-sans)', fontSize: '13.5px', color: '#94A3B8' }}>
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </div>
            </div>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1.5 flex-shrink-0 transition-colors"
                style={{
                  fontSize: '12px', fontWeight: 600, padding: '7px 12px', borderRadius: '10px',
                  background: 'rgba(91,106,248,0.08)', color: '#4C5FE8', fontFamily: 'var(--app-font-sans)',
                  border: '1px solid rgba(91,106,248,0.18)',
                }}>
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div style={{ height: '1px', background: 'rgba(148,163,184,0.14)' }} />

          <div>
            {notifications.length === 0 && (
              <div style={{ padding: '20px', fontFamily: 'var(--app-font-sans)', fontSize: '13px', color: '#94A3B8' }}>
                No live notifications yet. Captured leads and handoffs appear here.
              </div>
            )}
            {notifications.map((n, i) => {
              const isRead = read.has(n.id);
              const Icon = notificationIcon(n.kind);
              const tint = n.urgent
                ? { bg: 'rgba(245,158,11,0.12)', fg: '#B45309' }
                : n.kind === 'visit' || n.kind === 'followup'
                  ? { bg: 'rgba(91,106,248,0.10)', fg: '#4C5FE8' }
                  : { bg: 'rgba(16,185,129,0.10)', fg: '#0E9F6E' };
              return (
                <button key={n.id}
                  onClick={() => openItem(n)}
                  className="w-full flex items-start text-left transition-colors"
                  style={{
                    padding: '16px 20px',
                    gap: '13px',
                    background: isRead ? 'transparent' : 'rgba(91,106,248,0.035)',
                    borderBottom: i < notifications.length - 1 ? '1px solid rgba(148,163,184,0.10)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,116,139,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(91,106,248,0.035)')}
                >
                  <div className="rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', background: tint.bg }}>
                    <Icon className="w-[18px] h-[18px]" style={{ color: tint.fg }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ fontFamily: 'var(--app-font-sans)', fontSize: '15px', fontWeight: 600, color: isRead ? '#64748B' : '#0F172A', lineHeight: '1.3' }}>
                        {n.title}
                      </div>
                      {!isRead && <span className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', marginTop: '5px', background: '#4C5FE8' }} />}
                    </div>
                    <div className="mt-1 truncate"
                      style={{ fontFamily: 'var(--app-font-sans)', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                      {n.body}
                    </div>
                    <div className="mt-1.5 uppercase tracking-wide"
                      style={{ fontFamily: 'var(--app-font-mono)', fontSize: '11px', fontWeight: 600, color: n.urgent ? '#B45309' : '#94A3B8' }}>
                      {n.time}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ height: '1px', background: 'rgba(148,163,184,0.14)' }} />
          <div className="text-center" style={{ padding: '12px 20px' }}>
            {unread === 0
              ? <div style={{ fontFamily: 'var(--app-font-sans)', fontSize: '12.5px', color: '#94A3B8' }}>All caught up ✓</div>
              : <button onClick={markAll} className="transition-colors" style={{ fontFamily: 'var(--app-font-sans)', fontSize: '12.5px', color: '#94A3B8' }}>Dismiss all</button>
            }
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SidebarItem ───
   Translucent glass pill for the active route, quiet hover state, and a
   visible keyboard focus ring — per the premium liquid-glass nav spec. */
interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);

  const bg = active
    ? 'rgba(255,255,255,0.76)'
    : hover
      ? 'rgba(255,255,255,0.42)'
      : 'transparent';

  return (
    <Link href={href} aria-current={active ? 'page' : undefined} aria-label={label}>
      <div
        role="link"
        tabIndex={0}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex items-center gap-3 cursor-pointer"
        style={{
          height: '44px',
          padding: '0 14px',
          borderRadius: '11px',
          background: bg,
          border: active ? '1px solid rgba(255,255,255,0.82)' : '1px solid transparent',
          boxShadow: active
            ? '0 2px 10px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)'
            : 'none',
          backdropFilter: active || hover ? 'blur(12px) saturate(1.4)' : undefined,
          WebkitBackdropFilter: active || hover ? 'blur(12px) saturate(1.4)' : undefined,
          outline: focused ? '2px solid rgba(91,106,248,0.55)' : 'none',
          outlineOffset: '1px',
          transition: 'background 180ms var(--lg-ease), border-color 180ms var(--lg-ease), box-shadow 180ms var(--lg-ease)',
        }}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-colors" strokeWidth={active ? 2.25 : 1.9}
          style={{ color: active ? '#4C5FE8' : hover ? '#475569' : '#7C8797' }} />
        <span className="text-[15px] tracking-tight transition-colors"
          style={{
            fontFamily: 'var(--app-font-sans)',
            fontWeight: active ? 600 : 500,
            color: active ? '#1E2A5E' : hover ? '#334155' : '#5B6479',
          }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

/* ─── LiveClock ─── */
function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-xs font-mono tabular-nums" style={{ color: '#94A3B8' }}>{time}</span>
  );
}

/* ─── SidebarContent ───
   Shared nav body rendered inside the fixed desktop rail and inside the
   mobile drawer so both stay perfectly in sync. */
function SidebarContent({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full" onClickCapture={onNavigate}>
      {/* Brand */}
      <div className="flex-shrink-0" style={{ padding: '22px 22px 18px' }}>
        <Link href="/" className="flex items-center gap-3 cursor-pointer">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B6AF8, #818CF8)', boxShadow: '0 4px 14px rgba(91,106,248,0.32)' }}>
            <Building2 className="w-[18px] h-[18px] text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="font-bold leading-none" style={{ fontFamily: 'var(--app-font-sans)', fontSize: '18px', color: '#111A3D', letterSpacing: '-0.01em' }}>
              Rehman Estates
            </div>
            <div className="text-[10.5px] tracking-[0.08em] leading-none mt-1" style={{ fontFamily: 'var(--app-font-sans)', color: '#8992A6' }}>
              Property Intelligence
            </div>
          </div>
        </Link>
      </div>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.22), rgba(148,163,184,0))', margin: '0 22px' }} />

      {/* Nav */}
      <nav aria-label="Primary" className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '22px 16px 0' }}>
        <div className="text-[11px] font-semibold px-3.5 mb-2 uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--app-font-sans)', color: 'rgba(51,65,85,0.50)' }}>Main</div>
        <div className="flex flex-col" style={{ gap: '4px' }}>
          <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/"      active={location === '/'} />
          <SidebarItem icon={Users}           label="Leads"     href="/leads"  active={location.startsWith('/leads')} />
          <SidebarItem icon={PhoneCall}       label="Call preview" href="/call"   active={location === '/call'} />
        </div>

        <div className="text-[11px] font-semibold px-3.5 mb-2 uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--app-font-sans)', color: 'rgba(51,65,85,0.50)', marginTop: '28px' }}>
          System
        </div>
        <div className="flex flex-col" style={{ gap: '4px' }}>
          <SidebarItem icon={Settings} label="Settings" href="/settings" active={location === '/settings'} />
        </div>
      </nav>

      {/* Agent badge — anchored to the bottom */}
      <div className="flex-shrink-0" style={{ padding: '18px 22px 20px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.22), rgba(148,163,184,0))', marginBottom: '16px' }} />
        <div className="glass-light flex items-center gap-3 rounded-xl"
          style={{ padding: '10px 12px', borderRadius: '12px' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #5B6AF8, #818CF8)' }}>
            AG
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ fontFamily: 'var(--app-font-sans)', color: '#1E293B' }}>Agent Desk 1</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#10B981', boxShadow: '0 0 5px rgba(16,185,129,0.5)' }} />
              <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: '#0E9F6E' }}>Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shell ─── */
export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => { setMobileNavOpen(false); }, [location]);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'transparent' }}>
      {/* ── Desktop sidebar — liquid glass rail ── */}
      <aside
        className="glass-sidebar hidden md:flex flex-col flex-shrink-0 relative"
        style={{ width: '264px' }}
      >
        <SidebarContent location={location} />
      </aside>

      {/* ── Mobile drawer ── shown only below md; keeps the exact same nav
          so no route or interaction differs from desktop, per spec §12. */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="scrim"
              className="md:hidden fixed inset-0 z-[300]"
              style={{ background: 'rgba(15,23,42,0.32)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="glass-sidebar md:hidden fixed left-0 top-0 bottom-0 z-[310] flex flex-col"
              style={{ width: '280px', maxWidth: '84vw', boxShadow: '8px 0 32px rgba(15,23,42,0.16)' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              role="dialog" aria-modal="true" aria-label="Navigation"
            >
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="glass-control absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: '#64748B' }}
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent location={location} onNavigate={() => setMobileNavOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="glass-header h-14 flex items-center px-4 md:px-6 gap-3 md:gap-4 flex-shrink-0"
          style={{ position: 'relative', zIndex: 200 }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="glass-control md:hidden w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ color: '#64748B' }}
          >
            <Menu className="w-4 h-4" />
          </button>
          <GlobalSearch />
          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell />
            <LiveClock />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
