export type Language = 'ar' | 'en';
export type ThemeMode = 'dark' | 'light';
export type ActiveTab = 'tasks' | 'map' | 'custody' | 'profile';
export type TaskCategory = 'delivery' | 'pickup' | 'returns' | 'merchant_returns';
export type DeliveryOutcome = 'delivered' | 'partial_return' | 'full_return' | 'postponed';

export interface CourierProfile {
  id: string;
  name: string;
  code: string;
  phone: string;
  zone: string;
  branch: string;
  zoneTag: string;
  vehicle: string;
  shiftLabel: string;
  avatarUrl?: string;
  deliveryRate: number;
  deliveryRateDelta: string;
  completedToday: number;
  totalToday: number;
  rating: number;
  ratingCount: number;
  weeklyCompleted: number;
  weeklyTarget: number;
  weeklyBonus: number;
  dispatcherPhone: string;
}

export interface PickupWaybillItem {
  id: string;
  trackingNumber: string;
  pieces: number;
  recipientName?: string;
  itemsSummary: string;
  notes?: string;
  statusId?: number | null;
  status?: string;
  received?: boolean;
  receivedVia?: 'qr' | 'manual';
}

export interface MerchantReturnShipmentItem {
  id: string;
  trackingNumber: string;
  pieces: number;
  recipientName?: string;
  itemsSummary?: string;
  notes?: string;
  statusId?: number | null;
  status?: string;
}

export interface MerchantReturnBatch {
  id: string;
  batchId: string;
  batchCode: string;
  merchantId?: string;
  merchantName: string;
  merchantPhone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  shipmentsCount: number;
  totalPieces: number;
  cashToMerchant: number;
  status: string;
  statusId?: number | null;
  statusLabel?: string;
  notes?: string;
  shipments: MerchantReturnShipmentItem[];
  updatedAt?: string;
}

export interface MerchantPayoutBatch {
  id: string;
  batchId: string;
  batchCode: string;
  merchantId?: string;
  merchantName: string;
  merchantPhone?: string;
  amount: number;
  shipmentsCount: number;
  status?: string;
}

export interface ShipmentTask {
  id: string;
  trackingNumber: string;
  category: TaskCategory;
  status: string;
  statusId?: number | null;
  statusLabel?: string;
  isPickupBatch?: boolean;
  batchId?: string;
  batchCode?: string;
  shipmentsCount?: number;
  batchShipments?: PickupWaybillItem[];
  receivedVia?: 'qr' | 'manual';
  priority?: 'urgent' | 'high_value' | 'normal';
  timeWindow?: string;
  customerName: string;
  customerPhone: string;
  customerRating?: number;
  address: string;
  district: string;
  lat: number | null;
  lng: number | null;
  codAmount: number;
  isPrepaid: boolean;
  merchantName: string;
  itemsSummary: string;
  itemsCount: number;
  weightKg?: number;
  notes?: string;
  otpRequired?: boolean;
  updatedAt?: string;
}

export interface CustodyParcel {
  id: string;
  trackingNumber: string;
  type: 'partial_return' | 'postponed' | 'full_return' | 'pickup_in_custody';
  typeLabelAr: string;
  typeLabelEn: string;
  summaryAr: string;
  summaryEn: string;
  metaAr: string;
  metaEn: string;
  pieces: number;
}

export interface CustodySummary {
  totalCodCash: number;
  merchantPayoutCustodyTotal: number;
  merchantPayoutBatches: MerchantPayoutBatch[];
  shiftLabelAr: string;
  shiftLabelEn: string;
  successfulOrders: number;
  electronicPaidAmount: number;
  shippingFeesAmount: number;
  deadlineTimeAr: string;
  deadlineTimeEn: string;
  masterBarcode: string;
  shiftNumber: string;
  lastUpdatedAr: string;
  lastUpdatedEn: string;
  pendingParcels: CustodyParcel[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface ShiftSettlementRecord {
  id: string;
  date: string;
  shiftCode: string;
  codSettled: number;
  parcelsReturned: number;
  status: 'settled' | 'verified';
}
