/**
 * Notification payload interfaces for typed event emissions
 */

export interface ServiceRequestNotificationPayload {
  requestId: string;
  title: string;
  description: string;
  categoryName: string;
  subCategoryName?: string;
  distanceKm: number;
  serviceStartDate: Date;
  serviceEndDate: Date;
}

export interface ServiceRequestAcceptedPayload {
  requestId: string;
  providerId: string;
  providerName: string;
  orderId: string;
  totalAmount: number;
}

export interface ServiceRequestClosedPayload {
  requestId: string;
  reason: 'expired' | 'cancelled' | 'accepted_by_another';
}

export interface ServiceRequestExpiredPayload {
  requestId: string;
  message: string;
}

export interface ServiceRequestNoProvidersPayload {
  requestId: string;
  message: string;
}

export type NotificationEvent =
  | 'service-request-new-opportunity'
  | 'service-request-accepted'
  | 'service-request-closed'
  | 'service-request-expired'
  | 'service-request-no-providers';
