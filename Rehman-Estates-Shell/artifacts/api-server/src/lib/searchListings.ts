type Listing = {
  id: string;
  listingType: string;
  propertyType: string;
  society?: string;
  phase?: string;
  sizeMarla: number | null;
  pricePKR: number;
  features?: string[];
  [key: string]: unknown;
};

type Criteria = {
  intent?: string | null;
  propertyType?: string | null;
  sizeMarla?: number | null;
  society?: string | null;
  phase?: string | null;
  budgetMaxPKR?: number | null;
  features?: string[] | null;
};

/** Same filter/sort semantics as the voice-agent tools.js handler. */
export function searchListings(listings: Listing[], criteria: Criteria): Listing[] {
  const wantedType = criteria.intent === "rent" ? "rent" : "sale";

  let results = listings.filter((l) => {
    if (l.listingType !== wantedType) return false;
    if (criteria.propertyType && l.propertyType !== criteria.propertyType) return false;
    if (criteria.sizeMarla != null) {
      if (l.sizeMarla == null) return false;
      if (
        l.sizeMarla < criteria.sizeMarla * 0.75 ||
        l.sizeMarla > criteria.sizeMarla * 1.25
      ) {
        return false;
      }
    }
    if (criteria.society) {
      const haystack = `${l.society || ""} ${l.phase || ""}`.toLowerCase();
      if (!haystack.includes(String(criteria.society).toLowerCase())) return false;
    }
    if (criteria.budgetMaxPKR != null && l.pricePKR > criteria.budgetMaxPKR * 1.05) {
      return false;
    }
    return true;
  });

  const wantedFeatures = Array.isArray(criteria.features) ? criteria.features : [];
  const societyMatched = (l: Listing) =>
    criteria.society
      ? `${l.society || ""} ${l.phase || ""}`
          .toLowerCase()
          .includes(String(criteria.society).toLowerCase())
        ? 1
        : 0
      : 0;
  const featureCount = (l: Listing) =>
    wantedFeatures.filter((f) => (l.features || []).includes(f)).length;
  const budgetGap = (l: Listing) => {
    if (criteria.budgetMaxPKR == null) return Number.MAX_SAFE_INTEGER;
    const gap = criteria.budgetMaxPKR - l.pricePKR;
    return gap >= 0 ? gap : Number.MAX_SAFE_INTEGER;
  };

  results = results.sort(
    (a, b) =>
      societyMatched(b) - societyMatched(a) ||
      featureCount(b) - featureCount(a) ||
      budgetGap(a) - budgetGap(b),
  );

  return results.slice(0, 3);
}
