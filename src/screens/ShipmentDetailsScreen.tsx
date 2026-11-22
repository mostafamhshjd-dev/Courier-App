import React from 'react';
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  PackageCheck,
  Phone,
  StickyNote,
  Store,
  User,
} from 'lucide-react';
import { Language, ShipmentTask } from '../types/courier';
import { t } from '../i18n/translations';
import { buildGoogleMapsUrl, formatWhatsAppUrl } from '../utils/geo';

interface ShipmentDetailsScreenProps {
  shipment: ShipmentTask;
  lang: Language;
  loading?: boolean;
  confirmingPickup?: boolean;
  onOpenOutcomeSheet: () => void;
  onConfirmPickup?: (shipment: ShipmentTask) => void;
}

export const ShipmentDetailsScreen: React.FC<ShipmentDetailsScreenProps> = ({
  shipment,
  lang,
  loading,
  confirmingPickup = false,
  onOpenOutcomeSheet,
  onConfirmPickup,
}) => {
  const mapsUrl = buildGoogleMapsUrl(shipment.lat, shipment.lng, shipment.address);
  const whatsappUrl = formatWhatsAppUrl(shipment.customerPhone);
  const isPickup = shipment.category === 'pickup';
  const isPickedUp =
    shipment.statusId === 5 ||
    shipment.status === 'picked_up' ||
    shipment.status === 'in_custody';

  const statusText = (() => {
    if (shipment.statusLabel) return shipment.statusLabel;
    if (shipment.statusId === 4 || shipment.status === 'awaiting_pickup') {
      return t(lang, 'pickupStatusAwaiting');
    }
    if (shipment.statusId === 5 || shipment.status === 'picked_up') {
      return t(lang, 'pickupStatusInCustody');
    }
    switch (shipment.status) {
      case 'delivered':
        return t(lang, 'deliveredStatus');
      case 'partial_return':
        return t(lang, 'partialReturnStatus');
      case 'full_return':
        return t(lang, 'fullReturnStatus');
      case 'postponed':
        return t(lang, 'postponedStatus');
      default:
        return t(lang, 'outForDelivery');
    }
  })();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-32 space-y-4">
      {loading && (
        <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-primary animate-pulse rounded-full" />
        </div>
      )}

      {/* Top Waybill & Status Card */}
      <section className="flex items-center justify-between gap-3 bg-surface-container-low border border-outline-variant/25 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant">
            {t(lang, 'shipmentNumber')}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="font-telemetry text-xl font-bold text-on-surface tabular-nums"
              dir="ltr"
            >
              #{shipment.trackingNumber}
            </span>
            <BadgeCheck className="w-5 h-5 text-primary" />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-primary/15 border border-primary/30 px-3 py-1.5 rounded-full text-xs font-bold text-primary whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>{statusText}</span>
        </span>
      </section>

      {/* COD Financial Highlight Banner */}
      {shipment.isPrepaid || shipment.codAmount <= 0 ? (
        <section className="flex items-center justify-between bg-primary/15 border border-primary/30 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-primary">
                {t(lang, 'prepaid')}
              </span>
              <span className="font-display text-base font-bold text-on-surface">
                {t(lang, 'prepaidOrder')}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-between bg-secondary/15 border border-secondary/35 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-secondary">
                {t(lang, 'codRequired')}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-telemetry text-3xl font-extrabold text-secondary tabular-nums leading-tight">
                  {shipment.codAmount.toLocaleString('en-US')}
                </span>
                <span className="text-sm font-bold text-secondary">
                  {t(lang, 'currency')}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Receiver Profile Pod */}
      <section className="bg-surface-container-low border border-outline-variant/25 p-4 rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display text-base font-bold text-on-surface truncate">
                {shipment.customerName}
              </span>
              {shipment.customerRating && (
                <span className="text-xs text-on-surface-variant">
                  ★ {shipment.customerRating.toFixed(1)} · {shipment.district}
                </span>
              )}
            </div>
          </div>

          <a
            href={`tel:${shipment.customerPhone}`}
            className="inline-flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-bright px-3 py-2 rounded-full text-xs font-bold text-on-surface transition"
            dir="ltr"
          >
            <Phone className="w-3.5 h-3.5 text-primary" />
            <span className="font-telemetry tabular-nums">{shipment.customerPhone}</span>
          </a>
        </div>

        <div className="flex items-start gap-2 text-on-surface-variant pt-1 border-t border-outline-variant/20">
          <MapPin className="w-4 h-4 mt-1 text-outline shrink-0" />
          <span className="text-sm leading-relaxed">{shipment.address}</span>
        </div>

        {shipment.notes && (
          <div className="bg-surface-container p-3 rounded-xl border border-secondary/25 flex items-start gap-2">
            <StickyNote className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-secondary">{t(lang, 'customerNote')}: </strong>
              {shipment.notes}
            </div>
          </div>
        )}

        {/* Quick Contact & Navigation Actions */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <a
            href={`tel:${shipment.customerPhone}`}
            className="min-h-[46px] rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Phone className="w-4 h-4 text-primary" />
            <span>{t(lang, 'call')}</span>
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <MessageCircle className="w-4 h-4 text-primary" />
            <span>{t(lang, 'whatsapp')}</span>
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] rounded-xl bg-surface-container-highest hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Navigation className="w-4 h-4 text-primary" />
            <span>{t(lang, 'navigate')}</span>
          </a>
        </div>
      </section>

      {/* Order Items & Merchant Summary */}
      <section className="bg-surface-container-low border border-outline-variant/25 p-4 rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-on-surface-variant truncate">
              {shipment.merchantName}
            </span>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0 tabular-nums">
            {t(lang, 'piecesCount', { count: shipment.itemsCount })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant/25 flex items-center justify-center text-primary shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-bold text-on-surface leading-snug">
              {shipment.itemsSummary}
            </span>
            {shipment.weightKg && (
              <span className="text-xs text-on-surface-variant mt-0.5 tabular-nums">
                {shipment.weightKg} kg
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Fixed Bottom Primary Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-4 pb-safe bg-gradient-to-t from-surface via-surface/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          {isPickup && onConfirmPickup ? (
            isPickedUp ? (
              <div className="w-full min-h-[54px] rounded-2xl bg-primary/15 border border-primary/35 text-primary font-display text-sm font-bold flex items-center justify-center gap-2">
                <PackageCheck className="w-5 h-5" />
                <span>{t(lang, 'pickupConfirmedBadge')}</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={confirmingPickup}
                onClick={() => onConfirmPickup(shipment)}
                className="w-full min-h-[56px] rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-base font-bold shadow-[0_8px_28px_-4px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
              >
                {confirmingPickup ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t(lang, 'confirmingPickup')}</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-5 h-5" />
                    <span>{t(lang, 'confirmPickupBtn')}</span>
                  </>
                )}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onOpenOutcomeSheet}
              className="w-full min-h-[56px] rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-base font-bold shadow-[0_8px_28px_-4px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <ClipboardCheck className="w-5 h-5" />
              <span>{t(lang, 'recordOutcomeCta')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
