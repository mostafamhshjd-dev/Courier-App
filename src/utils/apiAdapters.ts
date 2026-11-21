import {
  CourierProfile,
  CustodyParcel,
  CustodySummary,
  ShipmentTask,
  TaskCategory,
} from '../types/courier';
import { DEMO_COURIER, DEMO_CUSTODY } from '../data/previewData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function extractAuthPayload(raw: AnyRecord): {
  token: string;
  courier: CourierProfile;
} {
  const container = raw?.data ?? raw ?? {};
  const token =
    container.token ||
    container.access_token ||
    container.api_token ||
    raw?.token ||
    '';

  const u = container.user || container.courier || container.profile || container;
  const courier: CourierProfile = {
    id: String(u.id ?? u.courier_id ?? DEMO_COURIER.id),
    name: String(u.name ?? u.full_name ?? u.courier_name ?? DEMO_COURIER.name),
    code: String(u.code ?? u.employee_code ?? `#CP-${u.id ?? '1048'}`),
    phone: String(u.phone ?? u.mobile ?? u.username ?? ''),
    zone: String(u.zone ?? u.area ?? u.region ?? DEMO_COURIER.zone),
    branch: String(u.branch ?? u.hub_name ?? u.branch_name ?? DEMO_COURIER.branch),
    zoneTag: String(u.zone_tag ?? u.sector ?? DEMO_COURIER.zoneTag),
    vehicle: String(u.vehicle ?? u.vehicle_info ?? DEMO_COURIER.vehicle),
    shiftLabel: String(u.shift_label ?? u.shift_name ?? DEMO_COURIER.shiftLabel),
    avatarUrl: u.avatar || u.avatar_url || u.photo || undefined,
    deliveryRate: toNumber(u.delivery_rate ?? u.success_rate, DEMO_COURIER.deliveryRate),
    deliveryRateDelta: String(u.delivery_rate_delta ?? '+2.4%'),
    completedToday: toNumber(u.completed_today ?? u.delivered_today, DEMO_COURIER.completedToday),
    totalToday: toNumber(u.total_today ?? u.assigned_today, DEMO_COURIER.totalToday),
    rating: toNumber(u.rating, DEMO_COURIER.rating),
    ratingCount: toNumber(u.rating_count ?? u.reviews_count, DEMO_COURIER.ratingCount),
    weeklyCompleted: toNumber(u.weekly_completed, DEMO_COURIER.weeklyCompleted),
    weeklyTarget: toNumber(u.weekly_target, DEMO_COURIER.weeklyTarget),
    weeklyBonus: toNumber(u.weekly_bonus, DEMO_COURIER.weeklyBonus),
    dispatcherPhone: String(u.dispatcher_phone ?? u.branch_phone ?? DEMO_COURIER.dispatcherPhone),
  };

  return { token, courier };
}

function normalizeCategory(rawCat: unknown, status: string): TaskCategory {
  const c = String(rawCat || '').toLowerCase();
  const s = status.toLowerCase();
  if (c.includes('pickup') || c.includes('collect') || s.includes('pickup')) return 'pickup';
  if (c.includes('return') || s.includes('return') || s.includes('refus') || s.includes('postpon')) {
    return 'returns';
  }
  return 'delivery';
}

export function normalizeShipment(item: AnyRecord): ShipmentTask {
  const status = String(item.status ?? item.shipment_status ?? 'out_for_delivery');
  const cod = toNumber(item.cod_amount ?? item.cod ?? item.amount_to_collect ?? item.cash_on_delivery, 0);
  const tracking = String(
    item.tracking_number ?? item.waybill ?? item.awb ?? item.code ?? `WS-${item.id ?? '00000'}`
  ).replace(/^#/, '');

  const rawPriority = String(item.priority ?? '').toLowerCase();
  let priority: 'urgent' | 'high_value' | 'normal' = 'normal';
  if (rawPriority === 'urgent' || rawPriority === 'express' || item.is_urgent) {
    priority = 'urgent';
  } else if (rawPriority === 'high_value' || cod >= 1000) {
    priority = 'high_value';
  }

  return {
    id: String(item.id ?? item.shipment_id ?? tracking),
    trackingNumber: tracking,
    category: normalizeCategory(item.type ?? item.task_type ?? item.category, status),
    status,
    priority,
    timeWindow: item.time_window || item.delivery_slot || undefined,
    customerName: String(
      item.customer_name ?? item.receiver_name ?? item.recipient_name ?? item.client_name ?? 'عميل'
    ),
    customerPhone: String(
      item.customer_phone ?? item.receiver_phone ?? item.recipient_phone ?? item.phone ?? ''
    ),
    customerRating: item.customer_rating ? toNumber(item.customer_rating, 4.8) : undefined,
    address: String(
      item.address ?? item.delivery_address ?? item.receiver_address ?? item.full_address ?? ''
    ),
    district: String(item.district ?? item.area ?? item.city ?? item.zone ?? ''),
    lat: toNullableNumber(item.lat ?? item.latitude ?? item.delivery_lat ?? item.coords?.lat),
    lng: toNullableNumber(item.lng ?? item.lon ?? item.longitude ?? item.delivery_lng ?? item.coords?.lng),
    codAmount: cod,
    isPrepaid:
      item.is_prepaid !== undefined
        ? Boolean(item.is_prepaid)
        : item.payment_type === 'prepaid' || cod <= 0,
    merchantName: String(item.merchant_name ?? item.sender_name ?? item.store_name ?? 'WebStack Merchant'),
    itemsSummary: String(
      item.items_summary ?? item.description ?? item.contents ?? item.product_name ?? 'طرد شحن قياسي'
    ),
    itemsCount: Math.max(1, toNumber(item.items_count ?? item.pieces ?? item.quantity, 1)),
    weightKg: item.weight ? toNumber(item.weight, 1) : undefined,
    notes: item.notes ?? item.delivery_notes ?? item.instructions ?? undefined,
    otpRequired: item.otp_required !== undefined ? Boolean(item.otp_required) : true,
    updatedAt: item.updated_at || undefined,
  };
}

export function normalizeTasksResponse(raw: AnyRecord): {
  tasks: ShipmentTask[];
  cashCustody?: number;
  completedToday?: number;
  totalToday?: number;
} {
  const payload = raw?.data ?? raw ?? {};
  const list: AnyRecord[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.tasks)
      ? payload.tasks
      : Array.isArray(payload.shipments)
        ? payload.shipments
        : Array.isArray(payload.orders)
          ? payload.orders
          : [];

  return {
    tasks: list.map(normalizeShipment),
    cashCustody:
      payload.cash_custody !== undefined || payload.total_cod !== undefined
        ? toNumber(payload.cash_custody ?? payload.total_cod, 0)
        : undefined,
    completedToday:
      payload.completed_today !== undefined ? toNumber(payload.completed_today, 0) : undefined,
    totalToday: payload.total_today !== undefined ? toNumber(payload.total_today, 0) : undefined,
  };
}

export function normalizeCustodyResponse(raw: AnyRecord): CustodySummary {
  const d = raw?.data ?? raw ?? {};
  const parcelsRaw: AnyRecord[] = Array.isArray(d.parcels)
    ? d.parcels
    : Array.isArray(d.returns)
      ? d.returns
      : Array.isArray(d.pending_parcels)
        ? d.pending_parcels
        : [];

  const pendingParcels: CustodyParcel[] = parcelsRaw.map((p, idx) => {
    const rawType = String(p.type ?? p.status ?? 'full_return').toLowerCase();
    const type: CustodyParcel['type'] = rawType.includes('partial')
      ? 'partial_return'
      : rawType.includes('postpon')
        ? 'postponed'
        : 'full_return';

    const tracking = String(p.tracking_number ?? p.waybill ?? p.code ?? `WS-R-${idx + 1}`).replace(/^#/, '');
    const pieces = Math.max(1, toNumber(p.returned_pieces ?? p.pieces ?? p.items_count, 1));

    return {
      id: String(p.id ?? tracking),
      trackingNumber: tracking,
      type,
      typeLabelAr:
        type === 'partial_return'
          ? 'مرتجع جزئي -R'
          : type === 'postponed'
            ? 'مؤجل بطلب العميل'
            : 'مرتجع كلي - رفض استلام',
      typeLabelEn:
        type === 'partial_return'
          ? 'Partial Return -R'
          : type === 'postponed'
            ? 'Postponed'
            : 'Full Return',
      summaryAr: String(p.reason ?? p.summary ?? `${pieces} قطعة مرتجعة للمخزن`),
      summaryEn: String(p.reason_en ?? p.reason ?? p.summary ?? `${pieces} piece(s) pending warehouse scan`),
      metaAr: String(p.merchant_name ?? p.customer_name ?? 'فرع العمليات الرئيسي'),
      metaEn: String(p.merchant_name ?? p.customer_name ?? 'Main Operations Hub'),
      pieces,
    };
  });

  const totalCash = toNumber(d.total_cod_cash ?? d.cash_custody ?? d.total_cash ?? d.cod_due, 0);

  return {
    totalCodCash: totalCash,
    shiftLabelAr: String(d.shift_label ?? DEMO_CUSTODY.shiftLabelAr),
    shiftLabelEn: String(d.shift_label_en ?? DEMO_CUSTODY.shiftLabelEn),
    successfulOrders: toNumber(d.successful_orders ?? d.delivered_count, 0),
    electronicPaidAmount: toNumber(d.electronic_paid ?? d.prepaid_total, 0),
    shippingFeesAmount: toNumber(d.shipping_fees ?? d.delivery_fees, 0),
    deadlineTimeAr: String(d.deadline_time ?? DEMO_CUSTODY.deadlineTimeAr),
    deadlineTimeEn: String(d.deadline_time_en ?? DEMO_CUSTODY.deadlineTimeEn),
    masterBarcode: String(
      d.master_barcode ?? `MASTER-EOD-${Math.round(totalCash)}-${pendingParcels.length}P`
    ),
    shiftNumber: String(d.shift_number ?? DEMO_CUSTODY.shiftNumber),
    lastUpdatedAr: 'تم التحديث الآن',
    lastUpdatedEn: 'Updated just now',
    pendingParcels,
  };
}
