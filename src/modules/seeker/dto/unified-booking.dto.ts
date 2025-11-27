export class UnifiedBookingDto {
  id: string;
  type: 'order' | 'service_request';
  displayStatus: 'searching' | 'matched' | 'in_progress' | 'no_accept' | 'completed' | 'cancelled' | 'pending';
  originalStatus: string;
  title: string;
  description?: string;
  providerName?: string;
  providerPhone?: string;
  providerEmail?: string;
  providerId?: string;
  serviceStartDate: Date;
  serviceEndDate?: Date;
  location?: {
    address: string;
    coordinates: number[];
    village?: string;
    district?: string;
    state?: string;
  };
  totalAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  category?: any;
  subcategory?: any;
  images?: string[];
  orderType?: string;
  quantity?: number;
  unitOfMeasure?: string;

  // Service request specific fields
  budget?: {
    min: number;
    max: number;
  };
  urgency?: string;
  waveCount?: number;
  matchedProvidersCount?: number;
  isSearching?: boolean;
  searchElapsedMinutes?: number;
  nextWaveAt?: Date;
  expiresAt?: Date;
  orderId?: string;
}