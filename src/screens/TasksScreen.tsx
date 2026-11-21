import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Power,
  RefreshCw,
  Shield,
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
}) => {
  const [activeCategory, setActiveCategory] = useState<TaskCategory>('delivery');

  const counts = useMemo(() => {
    const active = tasks.filter(
      (item) => item.status !== 'delivered'
    );
    return {
      delivery: active.filter((i) => i.category === 'delivery').length,
      pickup: active.filter((i) => i.category === 'pickup').length,
      returns: active.filter((i) => i.category === 'returns').length,
      totalRemaining: active.length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((item) => item.category === activeCategory && item.status !== 'delivered')
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
              onClick={() => setActiveCategory(tab.id)}
              className={`flex-1 min-h-[42px] py-2 px-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                  selected
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </section>

      {/* Section Header + Manual Refresh */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="font-display text-base sm:text-lg font-bold text-on-surface">
          {t(lang, 'upcomingShipments')}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant hidden sm:inline">
            {t(lang, 'smartOrderNearest')}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/25 text-xs font-semibold text-primary hover:bg-surface-container-high transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t(lang, 'refresh')}</span>
          </button>
        </div>
      </div>

      {/* Shipment Cards Queue */}
      {loading && filteredTasks.length === 0 ? (
        <div className="py-12 text-center text-sm text-on-surface-variant">
          {t(lang, 'loadingTasks')}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-8 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto opacity-80" />
          <p className="text-sm font-semibold text-on-surface">
            {t(lang, 'noTasksInTab')}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTasks.map(({ item, distKm }, idx) => {
            const isFirst = idx === 0 && activeCategory === 'delivery';
            const mapsUrl = buildGoogleMapsUrl(item.lat, item.lng, item.address);
            const whatsappUrl = formatWhatsAppUrl(item.customerPhone);

            return (
              <article
                key={item.id}
                className="bg-surface-container-low border border-outline-variant/25 hover:border-primary/40 rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-colors"
              >
                {/* Clickable Top Section -> Opens Shipment Details */}
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
                  {/* Waybill + Priority + Haversine Distance */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-telemetry text-xs font-bold bg-surface-container-highest text-on-surface px-2.5 py-1 rounded-full tabular-nums"
                        dir="ltr"
                      >
                        #{item.trackingNumber}
                      </span>

                      {item.priority === 'urgent' && (
                        <span className="bg-tertiary-container text-on-tertiary-container text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {t(lang, 'urgentDelivery')}
                        </span>
                      )}

                      {item.priority === 'high_value' && (
                        <span className="bg-secondary/15 text-secondary text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {t(lang, 'highValue')}
                        </span>
                      )}

                      {item.priority === 'normal' && item.timeWindow && (
                        <span className="bg-surface-container text-on-surface-variant text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.timeWindow}
                        </span>
                      )}
                    </div>

                    {distKm !== null && (
                      <span className="text-xs font-bold text-primary inline-flex items-center gap-1 tabular-nums">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{formatDistance(distKm, lang)}</span>
                      </span>
                    )}
                  </div>

                  {/* Customer Name & Address */}
                  <div className="space-y-1">
                    <h3 className="font-display text-base font-bold text-on-surface flex items-center gap-2">
                      <User className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{item.customerName}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant flex items-start gap-1.5 leading-relaxed">
                      <MapPin className="w-4 h-4 text-outline shrink-0 mt-0.5" />
                      <span>{item.address}</span>
                    </p>
                  </div>

                  {/* COD / Prepaid Strip */}
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
                </div>

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
