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
  const rawToken = String(
    container.token ||
      container.access_token ||
      container.api_token ||
      container.auth_token ||
      container.bearer_token ||
      raw?.token ||
      raw?.access_token ||
      raw?.api_token ||
      ''
  ).trim();
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();

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

function normalizeCategory(
  rawCat: unknown,
  status: string,
  statusId?: number | null,
  statusLabel?: string
): TaskCategory {
  if (statusId === 4 || statusId === 5) return 'pickup';
  if (statusId === 7) return 'delivery';

  const c = String(rawCat || '').toLowerCase();
  const s = `${status} ${statusLabel || ''}`.toLowerCase();

  if (
    c.includes('pickup') ||
    c.includes('collect') ||
    c.includes('batch') ||
    s.includes('pickup') ||
    s.includes('picked_up') ||
    s.includes('awaiting_pickup') ||
    s.includes('بيك') ||
    s.includes('استلام المندوب') ||
    s.includes('في عهدة المندوب')
  ) {
    return 'pickup';
  }
  if (
    c.includes('return') ||
    s.includes('return') ||
    s.includes('refus') ||
    s.includes('postpon') ||
    s.includes('مرتجع') ||
    s.includes('مؤجل') ||
    s.includes('رفض')
  ) {
    return 'returns';
  }
  return 'delivery';
}

export function normalizeShipment(
  item: AnyRecord,
  forcedCategory?: TaskCategory
): ShipmentTask {
  const statusId = toNullableNumber(
    item.status_id ?? item.shipment_status_id ?? item.current_status_id
  );
  const statusLabel = String(
    item.status_name_ar ??
      item.status_ar ??
      item.status_label ??
      item.status_name ??
      ''
  ).trim() || undefined;

  const defaultStatus =
    statusId === 4
      ? 'awaiting_pickup'
      : statusId === 5
        ? 'picked_up'
        : statusId === 7
          ? 'out_for_delivery'
          : 'out_for_delivery';

  const status = String(
    item.status ?? item.status_code ?? item.status_slug ?? item.shipment_status ?? defaultStatus
  );

  const category =
    forcedCategory ??
    normalizeCategory(item.type ?? item.task_type ?? item.category, status, statusId, statusLabel);

  const cod = toNumber(
    item.cod_amount ?? item.cod ?? item.amount_to_collect ?? item.cash_on_delivery,
    0
  );
  const tracking = String(
    item.tracking_number ??
      item.waybill ??
      item.awb ??
      item.batch_code ??
      item.code ??
      `WS-${item.id ?? item.shipment_id ?? '00000'}`
  ).replace(/^#/, '');

  const rawPriority = String(item.priority ?? '').toLowerCase();
  let priority: 'urgent' | 'high_value' | 'normal' = 'normal';
  if (rawPriority === 'urgent' || rawPriority === 'express' || item.is_urgent) {
    priority = 'urgent';
  } else if (rawPriority === 'high_value' || cod >= 1000) {
    priority = 'high_value';
  }

  const isPickup = category === 'pickup';
  const isPickupBatch = Boolean(
    item.is_pickup_batch || item.is_batch || (item.batch_code && !item.tracking_number)
  );
  const batchIdRaw = item.pickup_batch_id ?? item.batch_id ?? (isPickupBatch ? item.id : undefined);

  const merchantName = String(
    item.merchant_name ??
      item.sender_name ??
      item.store_name ??
      item.client_name ??
      'WebStack Merchant'
  );

  const customerName = isPickup
    ? String(
        item.merchant_name ??
          item.sender_name ??
          item.store_name ??
          item.customer_name ??
          item.client_name ??
          'تاجر'
      )
    : String(
        item.customer_name ??
          item.receiver_name ??
          item.recipient_name ??
          item.client_name ??
          'عميل'
      );

  const customerPhone = isPickup
    ? String(
        item.merchant_phone ??
          item.sender_phone ??
          item.pickup_phone ??
          item.contact_phone ??
          item.customer_phone ??
          item.phone ??
          ''
      )
    : String(
        item.customer_phone ??
          item.receiver_phone ??
          item.recipient_phone ??
          item.phone ??
          ''
      );

  const address = isPickup
    ? String(
        item.pickup_address ??
          item.merchant_address ??
          item.sender_address ??
          item.address ??
          item.full_address ??
          ''
      )
    : String(
        item.address ??
          item.delivery_address ??
          item.receiver_address ??
          item.full_address ??
          ''
      );

  const lat = isPickup
    ? toNullableNumber(
        item.pickup_lat ?? item.merchant_lat ?? item.lat ?? item.latitude ?? item.coords?.lat
      )
    : toNullableNumber(
        item.lat ?? item.latitude ?? item.delivery_lat ?? item.coords?.lat
      );

  const lng = isPickup
    ? toNullableNumber(
        item.pickup_lng ??
          item.merchant_lng ??
          item.lng ??
          item.lon ??
          item.longitude ??
          item.coords?.lng
      )
    : toNullableNumber(
        item.lng ?? item.lon ?? item.longitude ?? item.delivery_lng ?? item.coords?.lng
      );

  const shipmentsCount = toNumber(
    item.shipments_count ?? item.orders_count ?? item.parcels_count ?? item.total_shipments,
    0
  );

  return {
    id: String(item.id ?? item.shipment_id ?? tracking),
    trackingNumber: tracking,
    category,
    status,
    statusId,
    statusLabel,
    isPickupBatch,
    batchId: batchIdRaw !== undefined && batchIdRaw !== null ? String(batchIdRaw) : undefined,
    batchCode: item.batch_code ? String(item.batch_code) : undefined,
    shipmentsCount: shipmentsCount > 0 ? shipmentsCount : undefined,
    priority,
    timeWindow: item.time_window || item.delivery_slot || item.pickup_slot || undefined,
    customerName,
    customerPhone,
    customerRating: item.customer_rating ? toNumber(item.customer_rating, 4.8) : undefined,
    address,
    district: String(item.district ?? item.area ?? item.city ?? item.zone ?? ''),
    lat,
    lng,
    codAmount: cod,
    isPrepaid:
      item.is_prepaid !== undefined
        ? Boolean(item.is_prepaid)
        : item.payment_type === 'prepaid' || cod <= 0,
    merchantName,
    itemsSummary: String(
      item.items_summary ??
        item.description ??
        item.contents ??
        item.product_name ??
        (isPickup ? 'أمر استلام (بيك أب)' : 'طرد شحن قياسي')
    ),
    itemsCount: Math.max(
      1,
      toNumber(item.items_count ?? item.pieces ?? item.quantity ?? shipmentsCount, 1)
    ),
    weightKg: item.weight ? toNumber(item.weight, 1) : undefined,
    notes: item.notes ?? item.pickup_notes ?? item.delivery_notes ?? item.instructions ?? undefined,
    otpRequired: item.otp_required !== undefined ? Boolean(item.otp_required) : !isPickup,
    updatedAt: item.updated_at || item.created_at || undefined,
  };
}

export function normalizePickupBatch(batch: AnyRecord): ShipmentTask {
  const rawId = String(batch.id ?? batch.batch_id ?? batch.pickup_batch_id ?? Date.now());
  const rawStatus = String(batch.status ?? batch.batch_status ?? 'awaiting_pickup').toLowerCase();
  const explicitStatusId = toNullableNumber(batch.status_id);

  const isPickedUp =
    explicitStatusId === 5 ||
    rawStatus.includes('picked') ||
    rawStatus.includes('custody') ||
    rawStatus.includes('collected') ||
    rawStatus.includes('received') ||
    rawStatus.includes('في عهدة');

  const statusId = explicitStatusId ?? (isPickedUp ? 5 : 4);
  const batchCode = String(
    batch.batch_code ?? batch.code ?? batch.reference ?? `PB-${rawId}`
  ).replace(/^#/, '');
  const count = Math.max(
    1,
    toNumber(
      batch.shipments_count ??
        batch.orders_count ??
        batch.parcels_count ??
        batch.total_shipments ??
        batch.count ??
        (Array.isArray(batch.shipments) ? batch.shipments.length : 1),
      1
    )
  );

  return normalizeShipment(
    {
      ...batch,
      id: `batch-${rawId}`,
      batch_id: rawId,
      batch_code: batchCode,
      tracking_number: batchCode,
      is_pickup_batch: true,
      status_id: statusId,
      status: isPickedUp ? 'picked_up' : 'awaiting_pickup',
      shipments_count: count,
      items_count: count,
      is_prepaid: true,
      cod_amount: toNumber(batch.total_cod ?? batch.cod_amount, 0),
    },
    'pickup'
  );
}

export function normalizeTasksResponse(raw: AnyRecord): {
  tasks: ShipmentTask[];
  cashCustody?: number;
  completedToday?: number;
  totalToday?: number;
} {
  const payload = raw?.data ?? raw ?? {};
  const collected: ShipmentTask[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (task: ShipmentTask) => {
    const key = `${task.isPickupBatch ? 'batch' : 'ship'}-${task.batchId ?? task.id}-${task.trackingNumber}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      collected.push(task);
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach((item) => pushUnique(normalizeShipment(item)));
  } else if (payload && typeof payload === 'object') {
    // 1. Mixed primary collections
    const mixedSources = [
      payload.tasks,
      payload.shipments,
      payload.orders,
      payload.items,
      raw?.tasks !== payload.tasks ? raw?.tasks : null,
      raw?.shipments !== payload.shipments ? raw?.shipments : null,
    ];
    mixedSources.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((item) => pushUnique(normalizeShipment(item)));
      }
    });

    // 2. Explicit delivery collections (e.g. status_id = 7)
    const deliverySources = [
      payload.deliveries,
      payload.delivery,
      payload.delivery_shipments,
      payload.out_for_delivery,
      raw?.deliveries !== payload.deliveries ? raw?.deliveries : null,
    ];
    deliverySources.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((item) => pushUnique(normalizeShipment(item, 'delivery')));
      }
    });

    // 3. Explicit pickup shipment collections (status_id = 4 / 5)
    const pickupSources = [
      payload.pickups,
      payload.pickup,
      payload.pickup_shipments,
      payload.pickup_orders,
      payload.awaiting_pickup,
      raw?.pickups !== payload.pickups ? raw?.pickups : null,
    ];
    pickupSources.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((item) => pushUnique(normalizeShipment(item, 'pickup')));
      }
    });

    // 4. Explicit pickup_batches table records
    const batchSources = [
      payload.pickup_batches,
      payload.batches,
      raw?.pickup_batches !== payload.pickup_batches ? raw?.pickup_batches : null,
      raw?.batches !== payload.batches ? raw?.batches : null,
    ];
    batchSources.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((batch) => pushUnique(normalizePickupBatch(batch)));
      }
    });

    // 5. Explicit returns collections
    const returnSources = [
      payload.returns,
      payload.return_shipments,
      raw?.returns !== payload.returns ? raw?.returns : null,
    ];
    returnSources.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((item) => pushUnique(normalizeShipment(item, 'returns')));
      }
    });
  }

  return {
    tasks: collected,
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
