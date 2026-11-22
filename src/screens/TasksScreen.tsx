import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  PackageCheck,
  Phone,
  Power,
  RefreshCw,
  Shield,
  Store,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import {
  CourierProfile,
  GeoPoint,
  Language,
  ShipmentTask,
  TaskCategory,
} from '../types/courier';
import { t } from '../i18n/translations';
import {
  buildGoogleMapsUrl,
  calculateHaversineKm,
  formatDistance,
  formatWhatsAppUrl,
} from '../utils/geo';

interface TasksScreenProps {
  courier: CourierProfile;
  tasks: ShipmentTask[];
  cashCustody: number;
  courierLocation: GeoPoint;
  shiftActive: boolean;
  loading: boolean;
  lang: Language;
  onToggleShift: () => void;
  onRefresh: () => void;
  onSelectShipment: (shipment: ShipmentTask) => void;
  onOpenOnMap: (shipment: ShipmentTask) => void;
}

function isPickupInCustody(item: ShipmentTask): boolean {
  const s = (item.status || '').toLowerCase();
  return (
    item.statusId === 5 ||
    s === 'picked_up' ||
    s === 'in_custody' ||
    s === 'collected' ||
    s.includes('في عهدة')
  );
}

function isDeliveryCompleted(item: ShipmentTask): boolean {
  if (item.category === 'pickup') return false;
  const s = (item.status || '').toLowerCase();
  return s === 'delivered' || item.statusId === 8;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  courier,
  tasks,
  cashCustody,
  courierLocation,
  shiftActive,
  loading,
  lang,
  onToggleShift,
  onRefresh,
  onSelectShipment,
  onOpenOnMap,
}) => {
  const [activeCategory, setActiveCategory] = useState<TaskCategory>('delivery');
  const userPickedTabRef = useRef(false);

  const counts = useMemo(() => {
    const active = tasks.filter((item) => !isDeliveryCompleted(item));
    return {
      delivery: active.filter((i) => i.category === 'delivery').length,
      pickup: active.filter((i) => i.category === 'pickup').length,
      returns: active.filter((i) => i.category === 'returns').length,
      totalRemaining: active.length,
    };
  }, [tasks]);

  // If the courier has assigned pickup orders/batches and 0 delivery orders on load,
  // switch automatically to the Pickup tab so they immediately see their pickup assignments.
  useEffect(() => {
    if (userPickedTabRef.current) return;
    if (counts.delivery === 0 && counts.pickup > 0 && activeCategory === 'delivery') {
      setActiveCategory('pickup');
    }
  }, [counts.delivery, counts.pickup, activeCategory]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((item) => item.category === activeCategory && !isDeliveryCompleted(item))
      .map((item) => {
        const distKm =
          item.lat !== null && item.lng !== null
            ? calculateHaversineKm(
                courierLocation.lat,
                courierLocation.lng,
                item.lat,
                item.lng
              )
            : null;
        return { item, distKm };
      })
      .sort((a, b) => {
        // For pickup tab: keep awaiting pickup (status_id = 4) above already picked up (status_id = 5)
        if (activeCategory === 'pickup') {
          const aPicked = isPickupInCustody(a.item) ? 1 : 0;
          const bPicked = isPickupInCustody(b.item) ? 1 : 0;
          if (aPicked !== bPicked) return aPicked - bPicked;
        }
        if (a.distKm === null && b.distKm === null) return 0;
        if (a.distKm === null) return 1;
        if (b.distKm === null) return -1;
        return a.distKm - b.distKm;
      });
  }, [tasks, activeCategory, courierLocation.lat, courierLocation.lng]);

  const progressPct = useMemo(() => {
    const total = Math.max(1, courier.totalToday || courier.completedToday + counts.totalRemaining);
    return Math.min(100, Math.round((courier.completedToday / total) * 100));
  }, [courier.completedToday, courier.totalToday, counts.totalRemaining]);

  const firstName = courier.name.split(' ')[0] || courier.name;

  const sectionTitle =
    activeCategory === 'pickup'
      ? t(lang, 'upcomingPickups')
      : activeCategory === 'returns'
        ? t(lang, 'upcomingReturns')
        : t(lang, 'upcomingShipments');

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-28 space-y-4">
      {/* Driver Header Briefing + Active Shift GPS Toggle */}
      <section className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-surface-container-high ring-2 ring-primary/60 flex items-center justify-center overflow-hidden text-sm font-bold text-primary">
              {courier.avatarUrl ? (
                <img
                  src={courier.avatarUrl}
                  alt={courier.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{firstName.slice(0, 2)}</span>
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-surface-container-low ${
                shiftActive ? 'bg-primary' : 'bg-outline'
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-display text-base sm:text-lg font-bold text-on-surface truncate">
              {t(lang, 'welcomeCaptain')} {firstName}
            </span>
            <span className="text-xs text-on-surface-variant truncate">
              {t(lang, 'workZone')}: {courier.zone}
            </span>
          </div>
        </div>

        {/* Interactive Shift / Live GPS Toggle */}
        <button
          type="button"
          onClick={onToggleShift}
          className={`inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-full border text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 ${
            shiftActive
              ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
              : 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant'
          }`}
        >
          <Power className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">
            {shiftActive ? t(lang, 'shiftActiveGps') : t(lang, 'shiftPaused')}
          </span>
        </button>
      </section>

      {/* Realtime Telemetry KPI Strip */}
      <section className="grid grid-cols-2 gap-3">
        {/* Cash Custody KPI */}
        <div className="bg-surface-container-high border border-outline-variant/25 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-secondary">
              {t(lang, 'cashCustody')}
            </span>
            <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center text-secondary">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-telemetry text-2xl sm:text-3xl font-bold text-secondary tracking-tight tabular-nums">
              {cashCustody.toLocaleString('en-US')}
            </span>
            <span className="text-xs font-semibold text-secondary/85">
              {t(lang, 'currency')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-on-surface-variant">
            <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="truncate">{t(lang, 'readyForDeposit')}</span>
          </div>
        </div>

        {/* Remaining Stops KPI */}
        <div className="bg-surface-container-high border border-outline-variant/25 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-primary">
              {t(lang, 'remainingToday')}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-telemetry text-2xl sm:text-3xl font-bold text-primary tracking-tight tabular-nums">
              {counts.totalRemaining}
            </span>
            <span className="text-xs font-semibold text-primary/85">
              {t(lang, 'shipmentUnit')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-on-surface-variant">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {t(lang, 'planProgress', { pct: progressPct })}
            </span>
          </div>
        </div>
      </section>

      {/* Segmented Category Filter Tabs */}
      <section
        className="flex bg-surface-container-low border border-outline-variant/25 p-1 rounded-full shadow-sm"
        role="tablist"
      >
        {(
          [
            { id: 'delivery', label: t(lang, 'tabDelivery'), count: counts.delivery },
            { id: 'pickup', label: t(lang, 'tabPickup'), count: counts.pickup },
            { id: 'returns', label: t(lang, 'tabReturns'), count: counts.returns },
          ] as const
        ).map((tab) => {
          const selected = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                userPickedTabRef.current = true;
                setActiveCategory(tab.id);
              }}
              className={`flex-1 min-h-[44px] py-2 px-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selected
                  ? tab.id === 'pickup'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                  selected
                    ? tab.id === 'pickup'
                      ? 'bg-on-secondary/20 text-on-secondary'
                      : 'bg-on-primary/20 text-on-primary'
                    : tab.id === 'pickup' && tab.count > 0
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </section>

      {/* Section Header + Manual Instant Refresh */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <h2 className="font-display text-base sm:text-lg font-bold text-on-surface truncate">
          {sectionTitle}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-on-surface-variant hidden sm:inline">
            {t(lang, 'smartOrderNearest')}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-primary hover:bg-surface-container-high active:scale-95 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t(lang, 'refresh')}</span>
          </button>
        </div>
      </div>

      {/* Shipment & Pickup Cards Queue */}
      {loading && filteredTasks.length === 0 ? (
        <div className="py-12 text-center text-sm text-on-surface-variant">
          {t(lang, 'loadingTasks')}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto opacity-80" />
          <p className="text-sm font-semibold text-on-surface">
            {t(lang, 'noTasksInTab')}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-full bg-primary/15 border border-primary/35 text-primary text-xs font-bold hover:bg-primary/20 active:scale-95 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{t(lang, 'refreshNow')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTasks.map(({ item, distKm }, idx) => {
            const isPickup = item.category === 'pickup';
            const pickedUp = isPickup && isPickupInCustody(item);
            const isFirst = idx === 0 && activeCategory === 'delivery';
            const mapsUrl = buildGoogleMapsUrl(item.lat, item.lng, item.address);
            const whatsappUrl = formatWhatsAppUrl(item.customerPhone);
            const waybills = item.batchShipments || [];
            const pickupCount = Math.max(item.shipmentsCount ?? 0, waybills.length, item.itemsCount ?? 1);

            return (
              <article
                key={item.id}
                className={`bg-surface-container-low border rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-colors ${
                  isPickup && !pickedUp
                    ? 'border-secondary/40 hover:border-secondary/70'
                    : 'border-outline-variant/25 hover:border-primary/40'
                }`}
              >
                {/* Clickable Top Section -> Opens Pickup Batch or Shipment Details */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectShipment(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectShipment(item);
                    }
                  }}
                  className="space-y-2.5 cursor-pointer focus:outline-none"
                >
                  {/* Waybill / Batch Code + Status + Haversine Distance */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span
                        className="font-telemetry text-xs font-bold bg-surface-container-highest text-on-surface px-2.5 py-1 rounded-lg tabular-nums"
                        dir="ltr"
                      >
                        #{item.batchCode || item.trackingNumber}
                      </span>

                      {isPickup ? (
                        <>
                          {item.isPickupBatch && (
                            <span className="text-[11px] font-bold text-secondary inline-flex items-center gap-1">
                              <Package className="w-3.5 h-3.5" />
                              {t(lang, 'pickupBatchLabel')}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                              pickedUp ? 'text-primary' : 'text-secondary'
                            }`}
                          >
                            {pickedUp ? (
                              <PackageCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {pickedUp
                                ? t(lang, 'pickupStatusInCustody')
                                : item.statusLabel || t(lang, 'pickupStatusAwaiting')}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          {item.priority === 'urgent' && (
                            <span className="text-tertiary text-[11px] font-bold inline-flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {t(lang, 'urgentDelivery')}
                            </span>
                          )}

                          {item.priority === 'high_value' && (
                            <span className="text-secondary text-[11px] font-bold inline-flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {t(lang, 'highValue')}
                            </span>
                          )}

                          {item.priority === 'normal' && (item.statusLabel || item.timeWindow) && (
                            <span className="text-on-surface-variant text-[11px] font-medium inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.statusLabel || item.timeWindow}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {distKm !== null && (
                      <span className="text-xs font-bold text-primary inline-flex items-center gap-1 tabular-nums">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{formatDistance(distKm, lang)}</span>
                      </span>
                    )}
                  </div>

                  {/* Merchant / Customer Name & Phone & Address */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-on-surface flex items-center gap-2 min-w-0">
                        {isPickup ? (
                          <Store className="w-4 h-4 text-secondary shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span className="truncate">{item.customerName}</span>
                      </h3>
                      {isPickup && item.customerPhone && (
                        <span
                          dir="ltr"
                          className="font-telemetry text-[11px] font-semibold text-on-surface-variant shrink-0 tabular-nums"
                        >
                          {item.customerPhone}
                        </span>
                      )}
                    </div>
                    {item.address && (
                      <p className="text-xs sm:text-sm text-on-surface-variant flex items-start gap-1.5 leading-relaxed">
                        <MapPin className="w-4 h-4 text-outline shrink-0 mt-0.5" />
                        <span>{item.address}</span>
                      </p>
                    )}
                  </div>

                  {/* Pickup Expected Count & Waybill Preview OR COD / Prepaid Strip */}
                  {isPickup ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/20">
                        <div className="flex items-center gap-2 text-secondary text-xs font-bold">
                          <Package className="w-4 h-4 shrink-0" />
                          <span className="tabular-nums">
                            {t(lang, 'expectedShipmentsLabel')}: {pickupCount}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
                          {t(lang, 'reviewAndReceiveBatch')}
                        </span>
                      </div>

                      {waybills.length > 0 && (
                        <div className="rounded-xl bg-surface-container-lowest/70 border border-outline-variant/20 divide-y divide-outline-variant/15">
                          {waybills.slice(0, 3).map((w) => (
                            <div
                              key={w.id + '-' + w.trackingNumber}
                              className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0 flex-1">
                                <span
                                  dir="ltr"
                                  className="font-telemetry font-bold text-on-surface tabular-nums"
                                >
                                  #{w.trackingNumber}
                                </span>
                                <span className="text-on-surface-variant mx-1.5">·</span>
                                <span className="text-on-surface-variant truncate">
                                  {w.notes || w.itemsSummary}
                                </span>
                              </div>
                              <span className="text-secondary font-bold shrink-0 tabular-nums">
                                {w.pieces} {t(lang, 'pieceUnit')}
                              </span>
                            </div>
                          ))}
                          {waybills.length > 3 && (
                            <div className="px-3 py-1.5 text-[11px] font-bold text-primary text-center">
                              +{waybills.length - 3}{' '}
                              {lang === 'ar' ? 'بوالص أخرى — اضغط للمراجعة الكاملة' : 'more waybills — tap to review'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/20">
                      {item.isPrepaid || item.codAmount <= 0 ? (
                        <div className="flex items-center gap-2 text-primary text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{t(lang, 'prepaid')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-secondary text-xs font-bold">
                          <Banknote className="w-4 h-4 shrink-0" />
                          <span>{t(lang, 'codCollect')}:</span>
                          <span className="font-telemetry text-sm font-extrabold tabular-nums">
                            {item.codAmount.toLocaleString('en-US')} {t(lang, 'currency')}
                          </span>
                        </div>
                      )}
                      <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
                        {t(lang, 'tapForDetails')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pickup Primary Action: Open Full Review/QR/Manual Receive Screen */}
                {isPickup && (
                  <div className="flex flex-col gap-2">
                    {pickedUp ? (
                      <button
                        type="button"
                        onClick={() => onSelectShipment(item)}
                        className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-primary/12 border border-primary/35 text-primary text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
                      >
                        <PackageCheck className="w-4 h-4 shrink-0" />
                        <span>{t(lang, 'pickupConfirmedBadge')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectShipment(item)}
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-fixed active:scale-[0.98] text-on-primary text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <PackageCheck className="w-4 h-4 shrink-0" />
                        <span>{t(lang, 'reviewAndReceiveBatch')}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 3-Button Thumb-Sized Driver Action Corridor */}
                <div className="grid grid-cols-3 gap-2 pt-0.5">
                  <a
                    href={`tel:${item.customerPhone}`}
                    className="min-h-[46px] bg-surface-container-high hover:bg-surface-bright active:scale-[0.98] text-on-surface rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all"
                  >
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <span>{t(lang, 'call')}</span>
                  </a>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] bg-surface-container-high hover:bg-surface-bright active:scale-[0.98] text-on-surface rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{t(lang, 'whatsapp')}</span>
                  </a>

                  {isPickup ? (
                    <button
                      type="button"
                      onClick={() => onOpenOnMap(item)}
                      className="min-h-[46px] bg-surface-container-highest hover:bg-surface-bright active:scale-[0.98] text-on-surface rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-secondary shrink-0" />
                      <span>{t(lang, 'navMap')}</span>
                    </button>
                  ) : (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`min-h-[46px] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-[0.98] ${
                        isFirst
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container-highest hover:bg-surface-bright text-on-surface'
                      }`}
                    >
                      <Navigation
                        className={`w-4 h-4 shrink-0 ${isFirst ? 'text-on-primary' : 'text-primary'}`}
                      />
                      <span>{t(lang, 'navigate')}</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Sync Footer Note */}
      <div className="flex items-center justify-center gap-2 py-3 text-on-surface-variant text-xs">
        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
        <span>{t(lang, 'allSynced')}</span>
      </div>
    </div>
  );
};
