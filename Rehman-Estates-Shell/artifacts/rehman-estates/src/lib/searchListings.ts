import type { RegistryLeadData } from '../components/RegistryCard';

// ---------------------------------------------------------------------------
// Types — matches the real listings.json schema
// ---------------------------------------------------------------------------

export interface Listing {
  id: string;
  listingType: 'sale' | 'rent';
  propertyType: string;
  society: string;
  phase: string;
  block: string;
  sizeMarla: number | null;       // null for apartments (sq-ft only)
  sizeLabel: string;
  sizeLabelUrdu: string;
  pricePKR: number;
  priceLabel: string;
  priceLabelUrdu: string;
  status: string;
  features: string[];
  bedrooms: number | null;
  note: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ± tolerance in marla when matching plot/house size */
const SIZE_TOLERANCE_MARLA = 1;

/** Map lead intent to the listing type we should filter for */
function intentToListingType(intent: string | null): 'sale' | 'rent' | null {
  if (!intent) return null;
  if (intent === 'rent') return 'rent';
  if (intent === 'buy' || intent === 'invest') return 'sale';
  return null;
}

// ---------------------------------------------------------------------------
// searchListings
//
// Filters listings against lead criteria.  Each criterion is only applied when
// the lead has a non-null value for it — a partially-filled lead still returns
// sensible results.
//
// Budget is a strict maximum: pricePKR > budgetMaxPKR is excluded.
// Features are not used as a hard filter (they are displayed on the card for
// the agent to discuss with the caller).
// ---------------------------------------------------------------------------

export function searchListings(
  lead: RegistryLeadData,
  listings: Listing[],
): Listing[] {
  const targetListingType = intentToListingType(lead.intent);

  return listings.filter(listing => {

    // Listing type — sale vs rent based on intent
    if (targetListingType !== null) {
      if (listing.listingType !== targetListingType) return false;
    }

    // Society — exact, case-insensitive
    if (lead.society !== null) {
      if (listing.society.toLowerCase() !== lead.society.toLowerCase()) return false;
    }

    // Phase — exact, case-insensitive
    if (lead.phase !== null) {
      if (listing.phase.toLowerCase() !== lead.phase.toLowerCase()) return false;
    }

    // Property type — exact, case-insensitive
    if (lead.propertyType !== null) {
      if (listing.propertyType.toLowerCase() !== lead.propertyType.toLowerCase()) return false;
    }

    // Size — within tolerance; skip if listing has no marla value (apartments)
    if (lead.sizeMarla !== null && listing.sizeMarla !== null) {
      if (Math.abs(listing.sizeMarla - lead.sizeMarla) > SIZE_TOLERANCE_MARLA) return false;
    }

    // Budget — listing price must be ≤ lead's maximum (strict)
    if (lead.budgetMaxPKR !== null) {
      if (listing.pricePKR > lead.budgetMaxPKR) return false;
    }

    return true;
  });
}
