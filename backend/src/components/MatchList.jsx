export default function MatchList({ matches = [] }) {
  if (matches.length === 0) {
    return <p className="matches-empty">No matches yet — keep talking.</p>;
  }
  return (
    <div>
      {matches.map((m, i) => (
        <div className="match-row" key={m.id ?? m.listingId ?? i}>
          <span className="match-main">
            {m.sizeMarla != null ? `${m.sizeMarla} marla` : ''}
            {m.block ? ` · ${m.block}` : m.phase ? ` · ${m.phase}` : ''}
          </span>
          {Array.isArray(m.features) && m.features.length > 0 && (
            <span className="match-chip">{m.features[0]}</span>
          )}
          <span className="match-price">
            {m.priceLabelUrdu ?? m.priceLabel ?? (m.pricePKR != null ? m.pricePKR.toLocaleString() : '')}
          </span>
        </div>
      ))}
    </div>
  );
}
