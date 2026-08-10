import { useRef } from 'react';
import MatchList from './MatchList.jsx';

const FIELDS = [
  ['intent', 'Intent'],
  ['propertyType', 'Property type'],
  ['sizeMarla', 'Size (marla)'],
  ['sizeLabel', 'Size (as said)'],
  ['society', 'Society'],
  ['phase', 'Phase'],
  ['budgetMaxPKR', 'Budget max (PKR)'],
  ['budgetLabel', 'Budget (as said)'],
  ['features', 'Features'],
  ['timeline', 'Timeline'],
  ['financing', 'Financing'],
  ['name', 'Name'],
  ['phone', 'Phone'],
];

function formatValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value);
}

export default function RegistryCard({ lead, justFilled, matches = [], visits = [], handoff = null }) {
  const refNumber = useRef('#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'));

  return (
    <section className="card">
      {handoff && (
        <div className="handoff-banner">Handoff requested — {handoff.reason}</div>
      )}
      <div className="registry-header">
        <span className="registry-title">LEAD RECORD</span>
        <span className="registry-ref">{refNumber.current}</span>
      </div>
      <hr className="divider" />
      {FIELDS.map(([key, label]) => {
        const value = formatValue(lead[key]);
        const stamped = justFilled && justFilled.has(key);
        return (
          <div className="field-row" key={key}>
            <span className="field-label">{label}</span>
            <span
              className={
                'field-value' + (value === null ? ' empty' : '') + (stamped ? ' stamped' : '')
              }
            >
              {value === null ? '—' : value}
              {value !== null && <span className="field-check">✓</span>}
            </span>
          </div>
        );
      })}
      <hr className="divider" />
      <h2 className="section-title">MATCHES</h2>
      <MatchList matches={matches} />
      {visits.map((v) => (
        <div className="visit-row" key={v.reference}>
          Visit confirmed — {v.preferredDay}
          {v.preferredTime ? ` ${v.preferredTime}` : ''} · {v.reference}
        </div>
      ))}
    </section>
  );
}
