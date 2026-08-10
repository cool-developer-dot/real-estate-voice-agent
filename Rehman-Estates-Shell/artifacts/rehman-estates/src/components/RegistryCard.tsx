import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistryLeadData {
  intent: string | null;
  propertyType: string | null;
  sizeMarla: number | null;
  sizeLabel: string | null;      // Urdu spoken phrase, e.g. "سوا پانچ مرلہ"
  society: string | null;
  phase: string | null;
  budgetMaxPKR: number | null;
  budgetLabel: string | null;    // Urdu spoken phrase, e.g. "سوا دو کروڑ"
  features: string[] | null;
  timeline: string | null;
  name: string | null;
  phone: string | null;
}

// ---------------------------------------------------------------------------
// Presentation mappers
// Internal canonical values remain unchanged; only display strings change.
// ---------------------------------------------------------------------------

const INTENT_UR: Record<string, string> = {
  buy:     'خرید',
  rent:    'کرایہ',
  sell:    'فروخت',
  invest:  'سرمایہ کاری',
};

const PROPERTY_TYPE_UR: Record<string, string> = {
  plot:        'پلاٹ',
  house:       'گھر',
  apartment:   'اپارٹمنٹ',
  commercial:  'کمرشل',
};

const FEATURE_UR: Record<string, string> = {
  corner:      'کارنر',
  park_facing: 'پارک فیسنگ',
  possession:  'قبضہ دستیاب',
  boulevard:   'بلیوارڈ',
  file:        'فائل',
};

function displayIntent(v: string): string {
  return INTENT_UR[v] ?? v;
}

function displayPropertyType(v: string): string {
  return PROPERTY_TYPE_UR[v] ?? v;
}

function displayFeatures(features: string[]): string {
  return features
    .map(f => FEATURE_UR[f] ?? f.replace(/_/g, ' '))
    .join('، ');
}

/**
 * Format PKR amount in Pakistani crore/lakh notation.
 * e.g. 22_500_000 → "2 کروڑ 25 لاکھ"
 */
function formatBudgetPKR(pkr: number): string {
  const crore = Math.floor(pkr / 10_000_000);
  const lakh  = Math.round((pkr % 10_000_000) / 100_000);
  const parts: string[] = [];
  if (crore > 0) parts.push(`${crore} کروڑ`);
  if (lakh  > 0) parts.push(`${lakh} لاکھ`);
  return parts.length > 0 ? parts.join(' ') : '0';
}

// ---------------------------------------------------------------------------
// RegistryField
// Handles a single row: fixed 36px height, stamp animation on empty→filled.
// ---------------------------------------------------------------------------

interface RegistryFieldProps {
  label: string;
  value: string | null;
  rawPhrase?: string | null;    // spoken/Urdu phrase shown below main value
  urduValue?: boolean;          // render value in Nastaliq font RTL
}

function RegistryField({ label, value, rawPhrase, urduValue = false }: RegistryFieldProps) {
  const isFilled = value !== null && value !== undefined && value !== '';
  const prevFilledRef = useRef(isFilled);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Only animate on the transition empty → filled, not on initial render
    // or on filled → filled re-renders.
    if (!prevFilledRef.current && isFilled) {
      setIsAnimating(true);
    }
    prevFilledRef.current = isFilled;
  }, [isFilled]);

  const hasRawPhrase = rawPhrase !== null && rawPhrase !== undefined && rawPhrase !== '';
  const rowStyle: React.CSSProperties = { minHeight: 36 };

  return (
    <div
      className="registry-row"
      style={rowStyle}
      aria-label={`${label}: ${isFilled ? value : 'not yet captured'}`}
    >
      {/* Label column — fixed width, always LTR */}
      <span className="registry-row__label">{label}</span>

      {/* Value column */}
      <div className="registry-row__value-wrap">
        {isFilled ? (
          <div
            className={isAnimating ? 'stamp-animate' : ''}
            onAnimationEnd={() => setIsAnimating(false)}
          >
            <span
              className="registry-row__value"
              {...(urduValue ? { lang: 'ur', dir: 'rtl' } : {})}
            >
              {value}
            </span>
            <span className="registry-row__check" aria-hidden="true"> ✓</span>
            {hasRawPhrase && (
              <div className="registry-row__phrase" lang="ur" dir="rtl">
                "{rawPhrase}"
              </div>
            )}
          </div>
        ) : (
          <span className="registry-row__empty" aria-label="not yet captured">—</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegistryCard
// ---------------------------------------------------------------------------

interface RegistryCardProps {
  lead: RegistryLeadData;
}

export function RegistryCard({ lead }: RegistryCardProps) {
  // Derive Pakistani-native display values; internal state is untouched.
  const intentDisplay      = lead.intent      !== null ? displayIntent(lead.intent)           : null;
  const typeDisplay        = lead.propertyType !== null ? displayPropertyType(lead.propertyType) : null;
  const sizeDisplay        = lead.sizeMarla   !== null ? `${lead.sizeMarla} marla`             : null;
  const budgetDisplay      = lead.budgetMaxPKR !== null ? formatBudgetPKR(lead.budgetMaxPKR)   : null;
  const featuresDisplay    =
    lead.features !== null && lead.features.length > 0
      ? displayFeatures(lead.features)
      : null;

  return (
    <div className="registry-card" role="region" aria-label="Lead Record">
      {/* Header */}
      <div className="registry-card__header">
        <span className="registry-card__title">LEAD RECORD</span>
        <span className="registry-card__badge">LIVE</span>
      </div>

      {/* Divider */}
      <div className="registry-card__divider" />

      {/* Rows — always render all 10; never conditionally hide */}
      <div className="registry-card__rows">
        <RegistryField label="INTENT"   value={intentDisplay}   urduValue />
        <RegistryField label="TYPE"     value={typeDisplay}     urduValue />
        <RegistryField label="SIZE"     value={sizeDisplay}     rawPhrase={lead.sizeLabel} />
        <RegistryField label="SOCIETY"  value={lead.society} />
        <RegistryField label="PHASE"    value={lead.phase} />
        <RegistryField label="BUDGET"   value={budgetDisplay}   rawPhrase={lead.budgetLabel} urduValue />
        <RegistryField label="FEATURES" value={featuresDisplay} urduValue />
        <RegistryField label="TIMELINE" value={lead.timeline} />
        <RegistryField label="NAME"     value={lead.name} />
        <RegistryField label="PHONE"    value={lead.phone} />
      </div>
    </div>
  );
}
