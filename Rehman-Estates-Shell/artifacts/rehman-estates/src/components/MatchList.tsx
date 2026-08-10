import { useQuery } from '@tanstack/react-query';
import { searchListingsApi } from '../lib/api';
import type { Listing } from '../lib/searchListings';
import type { RegistryLeadData } from './RegistryCard';

// ---------------------------------------------------------------------------
// Feature label map — Pakistani terminology
// ---------------------------------------------------------------------------

const FEATURE_UR: Record<string, string> = {
  corner:      'کارنر',
  park_facing: 'پارک فیسنگ',
  possession:  'قبضہ دستیاب',
  boulevard:   'بلیوارڈ',
  file:        'فائل',
};

function featureLabelUr(f: string): string {
  return FEATURE_UR[f] ?? f.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// ListingCard — one property record row
// ---------------------------------------------------------------------------

function ListingCard({ listing }: { listing: Listing }) {
  const displayFeatures = listing.features.filter(f => f !== 'possession');

  return (
    <div className="match-card">
      <div className="match-card__id">{listing.id}</div>

      <div className="match-card__top">
        <div className="match-card__left">
          <span className="match-card__block">{listing.block}</span>
          <span className="match-card__location">
            {listing.society} · {listing.phase}
          </span>
          {listing.bedrooms !== null && (
            <span className="match-card__beds">{listing.bedrooms} Bed</span>
          )}
        </div>

        <div className="match-card__price-wrap">
          <span className="match-card__price-ur" lang="ur" dir="rtl">
            {listing.priceLabelUrdu}
          </span>
          <span className="match-card__price-en">
            PKR {listing.priceLabel}
          </span>
        </div>
      </div>

      <div className="match-card__meta">
        <span className="match-card__meta-ur" lang="ur" dir="rtl">
          {listing.sizeLabelUrdu}
        </span>
        {displayFeatures.map(f => (
          <span key={f} className="match-card__feature" lang="ur" dir="rtl">
            · {featureLabelUr(f)}
          </span>
        ))}
        <span className="match-card__status" style={{ marginLeft: 'auto' }}>
          {listing.status}
        </span>
      </div>

      {listing.note && (
        <p className="match-card__note">{listing.note}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchList
// ---------------------------------------------------------------------------

interface MatchListProps {
  lead: RegistryLeadData;
}

export function MatchList({ lead }: MatchListProps) {
  const hasAnyCriteria =
    lead.society      !== null ||
    lead.phase        !== null ||
    lead.propertyType !== null ||
    lead.sizeMarla    !== null ||
    lead.budgetMaxPKR !== null;

  const { data: matches = [], isFetching } = useQuery({
    queryKey: [
      'listings-search',
      lead.intent,
      lead.propertyType,
      lead.sizeMarla,
      lead.society,
      lead.phase,
      lead.budgetMaxPKR,
      lead.features,
    ],
    queryFn: () =>
      searchListingsApi({
        intent: lead.intent,
        propertyType: lead.propertyType,
        sizeMarla: lead.sizeMarla,
        society: lead.society,
        phase: lead.phase,
        budgetMaxPKR: lead.budgetMaxPKR,
        features: lead.features,
      }) as Promise<Listing[]>,
    enabled: hasAnyCriteria,
  });

  return (
    <div className="match-list">
      <div className="match-list__header">
        <span className="match-list__title">Matches</span>
        <span className="match-list__count">— {isFetching ? '…' : matches.length}</span>
      </div>

      <div className="match-list__divider" />

      {!hasAnyCriteria ? (
        <div className="match-list__empty">
          <p className="match-list__empty-body">
            Property matches will appear as lead criteria are captured from the call.
          </p>
        </div>
      ) : matches.length === 0 ? (
        <div className="match-list__empty">
          <p className="match-list__empty-title">No Matches Found</p>
          <p className="match-list__empty-body">
            Try adjusting society, size, or budget.
          </p>
        </div>
      ) : (
        <div className="match-list__cards">
          {matches.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
