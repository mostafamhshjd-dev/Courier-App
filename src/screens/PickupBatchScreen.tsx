import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  ShieldAlert,
  Square,
  Store,
  User,
  X,
} from 'lucide-react';
import { Language, PickupWaybillItem, ShipmentTask } from '../types/courier';
import { t } from '../i18n/translations';
import { buildGoogleMapsUrl, formatWhatsAppUrl } from '../utils/geo';
import { QrBarcodeScannerModal } from '../components/QrBarcodeScannerModal';
import { BarcodeModal } from '../components/BarcodeModal';

export interface PickupConfirmActionPayload {
  task: ShipmentTask;
  receivedVia: 'qr' | 'manual';
  waybills: PickupWaybillItem[];
  unreceivedWaybills: PickupWaybillItem[];
  cancelUnreceived: boolean;
}

interface PickupBatchScreenProps {
  batch: ShipmentTask;
  lang: Language;
  loading?: boolean;
  submitting: boolean;
  onOpenOnMap: (batch: ShipmentTask) => void;
  onConfirmPickup: (payload: PickupConfirmActionPayload) => Promise<void>;
}

export const PickupBatchScreen: React.FC<PickupBatchScreenProps> = ({
  batch,
  lang,
  loading = false,
  submitting,
  onOpenOnMap,
  onConfirmPickup,
}) => {
  const isPickedUp =
    batch.statusId === 5 ||
    batch.status === 'picked_up' ||
    batch.status === 'in_custody';

  const waybills: PickupWaybillItem[] = useMemo(() => {
    if (batch.batchShipments && batch.batchShipments.length > 0) {
      return batch.batchShipments;
    }
    return [
      {
        id: batch.id,
        trackingNumber: batch.trackingNumber,
        pieces: batch.itemsCount || 1,
        itemsSummary: batch.itemsSummary,
        notes: batch.notes,
        statusId: batch.statusId,
        status: batch.status,
        received: isPickedUp,
        receivedVia: batch.receivedVia,
      },
    ];
  }, [batch, isPickedUp]);

  const [qrScannedSet, setQrScannedSet] = useState<string[]>([]);
  const [manualSelectedSet, setManualSelectedSet] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [partialConfirmPending, setPartialConfirmPending] = useState<{
    receivedVia: 'qr' | 'manual';
    receivedWaybills: PickupWaybillItem[];
    unreceivedWaybills: PickupWaybillItem[];
  } | null>(null);
  const [warehouseBarcodeOpen, setWarehouseBarcodeOpen] = useState(false);

  const expectedCount = Math.max(batch.shipmentsCount ?? 0, waybills.length, 1);
  const mapsUrl = buildGoogleMapsUrl(batch.lat, batch.lng, batch.address);
  const whatsappUrl = formatWhatsAppUrl(batch.customerPhone);
  const merchantDisplayName = batch.merchantName || batch.customerName;

  const verifiedNumbers = useMemo(() => {
    const merged = new Set<string>([...qrScannedSet, ...manualSelectedSet]);
    return merged;
  }, [qrScannedSet, manualSelectedSet]);

  const selectedCount = verifiedNumbers.size;
  const totalCount = waybills.length;
  const unreceivedCount = Math.max(0, totalCount - selectedCount);
  const isPartialSelection = selectedCount > 0 && unreceivedCount > 0;
  const isAllSelected = selectedCount > 0 && unreceivedCount === 0;

  const toggleManualWaybill = (trackingNumber: string) => {
    if (isPickedUp) return;
    setManualSelectedSet((prev) =>
      prev.includes(trackingNumber)
        ? prev.filter((code) => code !== trackingNumber)
        : [...prev, trackingNumber]
    );
  };

  const handleSelectAllManual = () => {
    if (isPickedUp) return;
    if (verifiedNumbers.size === waybills.length) {
      setManualSelectedSet([]);
      setQrScannedSet([]);
    } else {
      setManualSelectedSet(waybills.map((w) => w.trackingNumber));
    }
  };

  const handleScanMatch = (trackingNumber: string) => {
    setQrScannedSet((prev) =>
      prev.includes(trackingNumber) ? prev : [...prev, trackingNumber]
    );
  };

  const handleSubmitQrScanned = async () => {
    const matchedWaybills = waybills.filter((w) =>
      qrScannedSet.includes(w.trackingNumber)
    );
    if (matchedWaybills.length === 0) return;

    const missingWaybills = waybills.filter(
      (w) => !qrScannedSet.includes(w.trackingNumber)
    );

    setScannerOpen(false);

    if (missingWaybills.length > 0) {
      setPartialConfirmPending({
        receivedVia: 'qr',
        receivedWaybills: matchedWaybills,
        unreceivedWaybills: missingWaybills,
      });
      return;
    }

    await onConfirmPickup({
      task: batch,
      receivedVia: 'qr',
      waybills: matchedWaybills,
      unreceivedWaybills: [],
      cancelUnreceived: false,
    });
  };

  const handlePrimaryConfirmClick = async () => {
    if (selectedCount === 0) {
      setConfirmAllOpen(true);
      return;
    }

    const chosen = waybills.filter((w) => verifiedNumbers.has(w.trackingNumber));
    const missing = waybills.filter((w) => !verifiedNumbers.has(w.trackingNumber));
    const allQr = chosen.every((w) => qrScannedSet.includes(w.trackingNumber));
    const receivedVia: 'qr' | 'manual' = allQr ? 'qr' : 'manual';

    if (missing.length > 0) {
      setPartialConfirmPending({
        receivedVia,
        receivedWaybills: chosen,
        unreceivedWaybills: missing,
      });
      return;
    }

    setConfirmAllOpen(true);
  };

  const handleSubmitPartialConfirmed = async () => {
    if (!partialConfirmPending) return;
    await onConfirmPickup({
      task: batch,
      receivedVia: partialConfirmPending.receivedVia,
      waybills: partialConfirmPending.receivedWaybills,
      unreceivedWaybills: partialConfirmPending.unreceivedWaybills,
      cancelUnreceived: true,
    });
    setPartialConfirmPending(null);
  };

  const handleSubmitConfirmAll = async () => {
    const allQr =
      waybills.length > 0 && waybills.every((w) => qrScannedSet.includes(w.trackingNumber));
    await onConfirmPickup({
      task: batch,
      receivedVia: allQr ? 'qr' : 'manual',
      waybills,
      unreceivedWaybills: [],
      cancelUnreceived: false,
    });
    setConfirmAllOpen(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-44 space-y-4">
      {loading && (
        <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-secondary animate-pulse rounded-full" />
        </div>
      )}

      {/* Batch Code & Lifecycle Status Card */}
      <section className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-4 shadow-sm space-y-3 overflow-hidden">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-on-surface-variant">
              {batch.isPickupBatch ? t(lang, 'pickupBatchLabel') : t(lang, 'shipmentNumber')}
            </span>
            <span
              className="font-telemetry text-xl font-bold text-on-surface tabular-nums truncate"
              dir="ltr"
            >
              #{batch.batchCode || batch.trackingNumber}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold ${
              isPickedUp ? 'text-primary' : 'text-secondary'
            }`}
          >
            {isPickedUp ? (
              <PackageCheck className="w-4 h-4 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isPickedUp
                ? t(lang, 'pickupStatusInCustody')
                : batch.statusLabel || t(lang, 'pickupStatusAwaiting')}
            </span>
          </span>
        </div>

        {/* Custody Policy Notice */}
        <div
          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
            isPickedUp
              ? 'bg-primary/10 border-primary/30 text-on-surface'
              : 'bg-secondary/10 border-secondary/30 text-on-surface'
          }`}
        >
          {isPickedUp ? (
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          )}
          <span>
            {isPickedUp
              ? t(lang, 'pickupInCustodyNotice')
              : t(lang, 'pickupNotInCustodyNotice')}
          </span>
        </div>
      </section>

      {/* Merchant Details & Location Card */}
      <section className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-4 shadow-sm space-y-3 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-on-surface-variant">
                {t(lang, 'merchantLabel')}
              </span>
              <h2 className="font-display text-base font-bold text-on-surface truncate">
                {merchantDisplayName}
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/25">
            <span className="text-[10px] text-on-surface-variant">
              {t(lang, 'expectedShipmentsLabel')}
            </span>
            <span className="font-telemetry text-lg font-extrabold text-secondary tabular-nums leading-tight">
              {expectedCount}
            </span>
          </div>
        </div>

        {batch.address && (
          <div className="flex items-start gap-2 text-on-surface-variant pt-2 border-t border-outline-variant/20">
            <MapPin className="w-4 h-4 mt-0.5 text-secondary shrink-0" />
            <span className="text-sm leading-relaxed break-words min-w-0">{batch.address}</span>
          </div>
        )}

        {/* Merchant Contact & Map Controls */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenOnMap(batch)}
            className="min-h-[46px] px-3 rounded-xl bg-secondary/15 hover:bg-secondary/20 border border-secondary/35 text-secondary text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer min-w-0"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{t(lang, 'openLocationOnMap')}</span>
          </button>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] px-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition min-w-0"
          >
            <ExternalLink className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{t(lang, 'navigateGoogleMaps')}</span>
          </a>

          <a
            href={`tel:${batch.customerPhone}`}
            className="min-h-[44px] px-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition min-w-0"
          >
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <span className="font-telemetry tabular-nums truncate" dir="ltr">
              {batch.customerPhone || t(lang, 'call')}
            </span>
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition min-w-0"
          >
            <MessageCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{t(lang, 'whatsapp')}</span>
          </a>
        </div>
      </section>

      {/* Waybills Review & Verification List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-on-surface">
              {t(lang, 'waybillsListTitle')}
            </h3>
            {!isPickedUp && (
              <p className="text-xs font-semibold text-primary tabular-nums mt-0.5">
                {t(lang, 'verifiedProgress', {
                  done: selectedCount,
                  total: totalCount,
                })}
              </p>
            )}
          </div>

          {!isPickedUp && waybills.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAllManual}
              className="px-3 min-h-[38px] rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-on-surface hover:bg-surface-container-high transition cursor-pointer shrink-0"
            >
              {isAllSelected
                ? t(lang, 'clearSelection')
                : t(lang, 'selectAllWaybills')}
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {waybills.map((waybill) => {
            const scannedQr = qrScannedSet.includes(waybill.trackingNumber);
            const checkedManual = manualSelectedSet.includes(waybill.trackingNumber);
            const isVerified = isPickedUp || waybill.received || scannedQr || checkedManual;

            return (
              <div
                key={waybill.id + '-' + waybill.trackingNumber}
                role={isPickedUp ? undefined : 'button'}
                tabIndex={isPickedUp ? undefined : 0}
                onClick={() => toggleManualWaybill(waybill.trackingNumber)}
                onKeyDown={(e) => {
                  if (!isPickedUp && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggleManualWaybill(waybill.trackingNumber);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-colors flex items-start gap-3 min-w-0 overflow-hidden ${
                  isPickedUp ? '' : 'cursor-pointer'
                } ${
                  isVerified
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-surface-container-low border-outline-variant/25 hover:border-secondary/50'
                }`}
              >
                {/* Check Indicator */}
                <div className="pt-0.5 shrink-0">
                  {isPickedUp || waybill.received ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : scannedQr || checkedManual ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-on-surface-variant" />
                  )}
                </div>

                {/* Waybill Details */}
                <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span
                      className="font-telemetry text-sm font-bold text-on-surface tabular-nums truncate"
                      dir="ltr"
                    >
                      #{waybill.trackingNumber}
                    </span>

                    <span className="text-[11px] font-bold text-secondary tabular-nums inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {waybill.pieces} {t(lang, 'pieceUnit')}
                      </span>
                    </span>
                  </div>

                  {waybill.recipientName && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface truncate">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{waybill.recipientName}</span>
                    </div>
                  )}

                  <p className="text-xs font-medium text-on-surface-variant truncate">
                    {waybill.itemsSummary}
                  </p>

                  {waybill.notes && (
                    <p className="text-[11px] text-secondary truncate">
                      {waybill.notes}
                    </p>
                  )}

                  {scannedQr && !isPickedUp && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary pt-0.5">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{t(lang, 'scannedViaQr')}</span>
                    </div>
                  )}

                  {!scannedQr && checkedManual && !isPickedUp && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary pt-0.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t(lang, 'selectedManually')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-3.5 pb-safe bg-gradient-to-t from-surface via-surface/95 to-transparent">
        <div className="max-w-2xl mx-auto space-y-2">
          {isPickedUp ? (
            <button
              type="button"
              onClick={() => setWarehouseBarcodeOpen(true)}
              className="w-full min-h-[54px] px-4 rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-sm font-bold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
            >
              <Barcode className="w-5 h-5" />
              <span>{t(lang, 'showBatchBarcode')}</span>
            </button>
          ) : (
            <>
              {/* Method 1: Camera QR / Barcode Scan */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => setScannerOpen(true)}
                className="w-full min-h-[50px] px-4 rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-sm font-bold shadow-[0_8px_24px_-4px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
              >
                <Camera className="w-5 h-5 shrink-0" />
                <span>{t(lang, 'scanWithCameraBtn')}</span>
              </button>

              {/* Method 2: Partial Confirm (with Cancel Remaining) OR Full Batch Confirm */}
              <button
                type="button"
                disabled={submitting}
                onClick={handlePrimaryConfirmClick}
                className={`w-full min-h-[50px] px-4 py-2 rounded-2xl font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition disabled:opacity-60 cursor-pointer text-center leading-snug ${
                  isPartialSelection
                    ? 'bg-secondary hover:bg-secondary-fixed text-on-secondary'
                    : 'bg-surface-container-high hover:bg-surface-bright border border-primary/45 text-primary'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{t(lang, 'confirmingPickup')}</span>
                  </>
                ) : isPartialSelection ? (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {t(lang, 'confirmPartialPickupBtn', {
                        received: selectedCount,
                        cancelled: unreceivedCount,
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {t(lang, 'confirmAllPickupBtn', {
                        count: isAllSelected ? selectedCount : expectedCount,
                      })}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Camera QR / Barcode Scanner Modal */}
      <QrBarcodeScannerModal
        open={scannerOpen}
        lang={lang}
        waybills={waybills}
        scannedTrackingNumbers={qrScannedSet}
        submitting={submitting}
        onScanMatch={handleScanMatch}
        onConfirmScanned={handleSubmitQrScanned}
        onClose={() => setScannerOpen(false)}
      />

      {/* Partial Pickup & Permanent Cancellation Warning Modal */}
      {partialConfirmPending && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => !submitting && setPartialConfirmPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-surface-container-high border border-error/45 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-error-container/35 text-error flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-on-surface leading-snug">
                  {t(lang, 'confirmPartialModalTitle')}
                </h3>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setPartialConfirmPending(null)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-primary/12 border border-primary/30 p-3 text-center">
                <span className="block text-[11px] font-semibold text-primary">
                  {lang === 'ar' ? 'ستدخل عهدتك' : 'Entering Custody'}
                </span>
                <span className="font-telemetry text-xl font-extrabold text-primary tabular-nums">
                  {partialConfirmPending.receivedWaybills.length}
                </span>
              </div>
              <div className="rounded-xl bg-error-container/25 border border-error/35 p-3 text-center">
                <span className="block text-[11px] font-semibold text-error">
                  {lang === 'ar' ? 'سيتم إلغاؤها وحذفها' : 'Cancelled & Deleted'}
                </span>
                <span className="font-telemetry text-xl font-extrabold text-error tabular-nums">
                  {partialConfirmPending.unreceivedWaybills.length}
                </span>
              </div>
            </div>

            <p className="text-sm text-on-surface leading-relaxed">
              {t(lang, 'confirmPartialModalBody', {
                received: partialConfirmPending.receivedWaybills.length,
                cancelled: partialConfirmPending.unreceivedWaybills.length,
              })}
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitPartialConfirmed}
                className="w-full min-h-[50px] px-4 rounded-2xl bg-error hover:opacity-95 text-white font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition disabled:opacity-70 cursor-pointer text-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{t(lang, 'confirmingPickup')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {t(lang, 'yesConfirmPartial', {
                        received: partialConfirmPending.receivedWaybills.length,
                        cancelled: partialConfirmPending.unreceivedWaybills.length,
                      })}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setPartialConfirmPending(null)}
                className="w-full min-h-[44px] rounded-xl bg-surface-container text-on-surface-variant text-xs font-bold cursor-pointer"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Receive All Verification Dialog */}
      {confirmAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => !submitting && setConfirmAllOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-surface-container-high border border-outline-variant/40 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-on-surface">
                  {t(lang, 'confirmAllModalTitle')}
                </h3>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmAllOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              {t(lang, 'confirmAllModalBody', {
                count: expectedCount,
                merchant: merchantDisplayName,
              })}
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitConfirmAll}
                className="w-full min-h-[50px] rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition disabled:opacity-70 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t(lang, 'confirmingPickup')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t(lang, 'yesConfirmAll')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmAllOpen(false)}
                className="w-full min-h-[44px] rounded-xl bg-surface-container text-on-surface-variant text-xs font-bold cursor-pointer"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Handover Barcode Modal (for status_id = 5) */}
      <BarcodeModal
        open={warehouseBarcodeOpen}
        code={batch.batchCode || batch.trackingNumber}
        title={
          lang === 'ar'
            ? `دفعة بيك أب #${batch.batchCode || batch.trackingNumber} (${expectedCount} شحنة)`
            : `Pickup Batch #${batch.batchCode || batch.trackingNumber} (${expectedCount} shipments)`
        }
        lang={lang}
        onClose={() => setWarehouseBarcodeOpen(false)}
      />
    </div>
  );
};
