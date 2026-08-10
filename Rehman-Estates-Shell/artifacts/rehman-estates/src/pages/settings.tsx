import { Save, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '9px 13px',
  fontSize: '13px',
  fontFamily: 'var(--app-font-sans)',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--app-font-sans)',
  color: '#64748B',
  marginBottom: '6px',
  letterSpacing: '0.03em',
};

const DIVIDER: React.CSSProperties = {
  height: '1px',
  background: 'rgba(148,163,184,0.14)',
};

type Persona = 'professional' | 'warm';

const GREETINGS: Record<Persona, string> = {
  professional: 'السلام علیکم، رحمان اسٹیٹس میں خوش آمدید۔ میں طارق ہوں۔ آپ کس قسم کی پراپرٹی تلاش کر رہے ہیں؟',
  warm: 'السلام علیکم جی! رحمان اسٹیٹس میں آپ کا بہت خوش آمدید۔ میں طارق ہوں، آپ کی خدمت کے لیے حاضر ہوں۔ بتائیے، کس طرح کی پراپرٹی کی تلاش میں ہیں آپ؟',
};

const STORAGE_KEY = 'rehman-estates-settings';

interface SettingsState {
  agencyName: string;
  phone: string;
  location: string;
  persona: Persona;
  greeting: string;
  greetingCustomized: boolean;
  afterHours: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  agencyName: 'Rehman Estates',
  phone: '+92 300 1234567',
  location: 'Lahore, Pakistan',
  persona: 'professional',
  greeting: GREETINGS.professional,
  greetingCustomized: false,
  afterHours: false,
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const selectPersona = (persona: Persona) => {
    setSettings(prev => ({
      ...prev,
      persona,
      // Only swap the greeting script if the caller hasn't hand-edited it —
      // otherwise switching tabs would clobber their custom wording.
      greeting: prev.greetingCustomized ? prev.greeting : GREETINGS[persona],
    }));
  };

  const handleGreetingChange = (value: string) => {
    setSettings(prev => ({ ...prev, greeting: value, greetingCustomized: value !== GREETINGS[prev.persona] }));
  };

  const handleSave = () => {
    setSaved(false);
    setIsSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setIsSaving(false);
      setSaved(true);
      saveTimer.current = setTimeout(() => setSaved(false), 2200);
    }, 700);
  };

  const personaCard = (persona: Persona, title: string, desc: string) => {
    const active = settings.persona === persona;
    return (
      <label
        onClick={() => selectPersona(persona)}
        className={`rounded-xl p-4 cursor-pointer transition-all relative ${active ? '' : 'glass-light'}`}
        style={
          active
            ? {
                background: 'rgba(91,106,248,0.07)',
                border: '1.5px solid rgba(91,106,248,0.45)',
                boxShadow: '0 2px 14px rgba(91,106,248,0.12)',
              }
            : undefined
        }
      >
        <input type="radio" name="persona" className="sr-only" checked={active} readOnly />
        {active && (
          <div className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#5B6AF8' }}>
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        )}
        <div className="font-semibold text-sm mb-1 pr-5" style={{ fontFamily: 'var(--app-font-sans)', color: active ? '#5B6AF8' : '#0F172A' }}>
          {title}
        </div>
        <div className="text-xs" style={{ color: '#64748B', lineHeight: '1.5' }}>
          {desc}
        </div>
      </label>
    );
  };

  return (
    <div className="w-full space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
          System Configuration
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
          Manage agency details and voice agent preferences.
        </p>
      </div>

      {/* Agency Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            Agency Profile
          </h2>
          <p className="text-sm mt-1.5" style={{ color: '#64748B', lineHeight: '1.6' }}>
            This information is used by the voice agent to introduce the firm.
          </p>
        </div>
        <div className="glass-card md:col-span-2" style={{ padding: '24px' }}>
          <div className="space-y-5">
              <div>
              <label style={LABEL}>Agency Name</label>
              <input type="text" value={settings.agencyName} onChange={e => update('agencyName', e.target.value)} className="glass-input" style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Primary Phone Number</label>
              <input type="text" value={settings.phone} onChange={e => update('phone', e.target.value)} className="glass-input" style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Office Location</label>
              <input type="text" value={settings.location} onChange={e => update('location', e.target.value)} className="glass-input" style={INPUT} />
            </div>
          </div>
        </div>
      </div>

      <div style={DIVIDER} />

      {/* Voice Agent Tuning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            Voice Agent Tuning
          </h2>
          <p className="text-sm mt-1.5" style={{ color: '#64748B', lineHeight: '1.6' }}>
            Configure the behavior and personality of the AI front desk.
          </p>
        </div>
        <div className="glass-card md:col-span-2" style={{ padding: '24px' }}>
          <div className="space-y-6">

            {/* Persona */}
            <div>
              <label style={LABEL}>Agent Persona</label>
              <div className="grid grid-cols-2 gap-3">
                {personaCard('professional', 'Professional & Precise', 'Direct, confident, authoritative tone suitable for luxury real estate.')}
                {personaCard('warm', 'Warm & Welcoming', 'Friendly, conversational, emphasizes hospitality and comfort.')}
              </div>
            </div>

            {/* Greeting prompt */}
            <div>
              <label style={LABEL}>Greeting Prompt</label>
              <textarea
                rows={3}
                value={settings.greeting}
                onChange={e => handleGreetingChange(e.target.value)}
                className="glass-input"
                style={{
                  ...INPUT,
                  resize: 'none',
                  fontFamily: "'Noto Nastaliq Urdu', serif",
                  fontSize: '14px',
                  lineHeight: '2',
                  direction: 'rtl',
                  textAlign: 'right',
                }}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
                  {settings.greetingCustomized ? 'Custom greeting — persona switch will no longer overwrite it.' : `Auto-filled from the ${settings.persona === 'professional' ? 'Professional & Precise' : 'Warm & Welcoming'} persona.`}
                </span>
                {settings.greetingCustomized && (
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, greeting: GREETINGS[prev.persona], greetingCustomized: false }))}
                    className="text-[10px] font-medium flex-shrink-0 ml-2"
                    style={{ color: '#5B6AF8', fontFamily: 'var(--app-font-sans)' }}
                  >
                    Reset to persona default
                  </button>
                )}
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between py-3"
              style={{ borderTop: '1px solid rgba(148,163,184,0.14)', marginTop: '4px' }}>
              <div>
                <div className="text-sm font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
                  After-hours Voicemail Routing
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  Direct calls to voicemail outside business hours instead of AI.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.afterHours}
                onClick={() => update('afterHours', !settings.afterHours)}
                className="relative inline-flex items-center flex-shrink-0 ml-4 transition-colors"
                style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '9999px',
                  background: settings.afterHours ? '#5B6AF8' : 'rgba(148,163,184,0.30)',
                  border: settings.afterHours ? '1px solid rgba(91,106,248,0.60)' : '1px solid rgba(148,163,184,0.30)',
                  boxShadow: settings.afterHours ? '0 0 0 3px rgba(91,106,248,0.12)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: settings.afterHours ? '20px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    transition: 'left 0.18s ease',
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={DIVIDER} />

      {/* Voice Identity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
            Voice Identity
          </h2>
          <p className="text-sm mt-1.5" style={{ color: '#64748B', lineHeight: '1.6' }}>
            The AI persona presented to callers.
          </p>
        </div>
        <div className="glass-card md:col-span-2" style={{ padding: '24px' }}>
          <div className="flex items-center gap-5">
            {/* AI Orb — small */}
            <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75) 0%, transparent 45%), conic-gradient(from 0deg at 50% 50%, #38BDF8, #818CF8, #E879F9, #38BDF8)',
                boxShadow: '0 8px 24px rgba(91,106,248,0.28)',
              }} />
            </div>
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: 'var(--app-font-sans)', color: '#0F172A' }}>
                Tareeq — طارق
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                Pakistani AI Property Consultant · Male · Urdu-native · {settings.persona === 'professional' ? 'Professional tone' : 'Warm tone'}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981', display: 'inline-block' }} />
                <span className="text-xs font-mono" style={{ color: '#10B981' }}>Active · Listening for calls</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end items-center gap-3 pt-2">
        {saved && (
          <span className="text-xs" style={{ color: '#94A3B8', fontFamily: 'var(--app-font-sans)' }}>
            Preferences saved to this device.
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: saved
              ? 'rgba(16,185,129,0.12)'
              : isSaving
                ? 'rgba(148,163,184,0.15)'
                : 'linear-gradient(135deg, #5B6AF8, #818CF8)',
            color: saved ? '#059669' : isSaving ? '#94A3B8' : '#fff',
            fontFamily: 'var(--app-font-sans)',
            border: saved ? '1px solid rgba(16,185,129,0.22)' : 'none',
            boxShadow: saved || isSaving ? 'none' : '0 4px 16px rgba(91,106,248,0.25)',
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {saved
            ? <><Check className="w-4 h-4" /> Saved!</>
            : isSaving
              ? <span>Saving…</span>
              : <><Save className="w-4 h-4" /> Save Configuration</>
          }
        </button>
      </div>
    </div>
  );
}
