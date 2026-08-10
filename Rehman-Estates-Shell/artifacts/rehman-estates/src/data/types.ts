export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Closed';
export type PropertyType = 'Buy' | 'Rent' | 'Invest';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  propertyType: PropertyType;
  budget: string;
  location: string;
  status: LeadStatus;
  createdAt: string;
  callDuration: string;
  transcript: string;
  notes: string;
  /** plot | house | apartment | commercial from the voice agent */
  agentPropertyType?: string | null;
  sizeMarla?: number | null;
  sizeLabel?: string | null;
  society?: string | null;
  phase?: string | null;
}
