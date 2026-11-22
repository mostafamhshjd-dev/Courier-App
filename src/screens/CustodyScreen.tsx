import React, { useState } from 'react';
import {
  Barcode,
  Clock,
  Package,
  PackageCheck,
  PackageX,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { CustodyParcel, CustodySummary, Language } from '../types/courier';
import { t } from '../i18n/translations';
import { BarcodeModal } from '../components/BarcodeModal';
import { PullToRefresh } from '../components/PullToRefresh';

interface CustodyScreenProps {
  custody: CustodySummary;
  lang: Language;
  loading: boolean;
  onRefresh: () => void;
}

export const CustodyScreen: React.FC<CustodyScreenProps> = ({
  custody,
  lang,
  loading,
  onRefresh,
}) => {
  const [modalState, setModalState] = useState<{
    open: boolean;
    code: string;
    title: string;
  }>({ open: false, code: '', title: '' });

  const openBarcode = (code: string, title: string) => {
    setModalState({ open: true, code, title });
  };

  const renderParcelIcon = (type: CustodyParcel['type']) => {
    if (type === 'pickup_in_custody') return <PackageCheck className="w-5 h-5 text-primary shrink-0" />;
    if (type === 'postponed') return <Clock className="w-5 h-5 text-primary shrink-0" />;
    if (type === 'full_return') return <PackageX className="w-5 h-5 text-tertiary shrink-0" />;
    return <Package className="w-5 h-5 text-primary shrink-0" />;
  };

  const renderBadgeClass = (type: CustodyParcel['type']) => {
    if (type === 'pickup_in_custody') return 'bg-primary/15 text-primary border-primary/35';
    if (type === 'partial_return') return 'bg-secondary/15 text-secondary border-secondary/30';
    if (type === 'full_return') return 'bg-tertiary/15 text-tertiary border-tertiary/30';
    return 'bg-surface-container-highest text-on-surface border-outline-variant/40';
  };

  return (
    <PullToRefresh lang={lang} refreshing={loading} onRefresh={onRefresh}>
      <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-28 space-y-5">
      {/* Context & Refresh Row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-semibold text-on-surface-variant">
          {t(lang, 'liveTreasuryParcels')}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/25 text-xs font-medium text-on-surface-variant hover:text-on-surface transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
          <span>{lang === 'ar' ? custody.lastUpdatedAr : custody.lastUpdatedEn}</span>
        </button>
      </div>

      {/* 1. Prominent Cash Custody Wallet Card */}
      <section className="relative overflow-hidden rounded-3xl bg-surface-container-high border border-outline-variant/30 p-5 shadow-md">
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-on-surface-variant">
                  {t(lang, 'currentCodCustody')}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-secondary/15 text-secondary text-[11px] font-bold whitespace-nowrap">
                {lang === 'ar' ? custody.shiftLabelAr : custody.shiftLabelEn}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              {t(lang, 'totalCashDueDesc')}
            </p>
          </div>

          {/* Massive Cash Telemetry Display */}
          <div className="flex items-baseline gap-2 py-0.5 flex-wrap">
            <span className="font-telemetry text-4xl font-extrabold text-secondary tracking-tight tabular-nums">
              {custody.totalCodCash.toLocaleString('en-US')}
            </span>
            <span className="font-display text-base sm:text-lg font-bold text-secondary/90">
              {t(lang, 'currencyFull')}
            </span>
          </div>

          {/* 3-Column Mini Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col p-3 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-on-surface-variant truncate">
                {t(lang, 'successful')}
              </span>
              <span className="text-sm font-bold text-primary mt-1 tabular-nums">
                {custody.successfulOrders} {t(lang, 'ordersUnit')}
              </span>
            </div>
            <div className="flex flex-col p-3 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-on-surface-variant truncate">
                {t(lang, 'electronicPay')}
              </span>
              <span className="text-sm font-bold text-secondary mt-1 tabular-nums">
                {custody.electronicPaidAmount.toLocaleString('en-US')} {t(lang, 'currency')}
              </span>
            </div>
            <div className="flex flex-col p-3 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-on-surface-variant truncate">
                {t(lang, 'shippingFees')}
              </span>
              <span className="text-sm font-bold text-on-surface mt-1 tabular-nums">
                {custody.shippingFeesAmount.toLocaleString('en-US')} {t(lang, 'currency')}
              </span>
            </div>
          </div>

          {/* Shift Deadline Alert */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-surface-container border border-outline-variant/25 text-secondary">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold">
              {t(lang, 'dueBeforeShiftEnd', {
                time: lang === 'ar' ? custody.deadlineTimeAr : custody.deadlineTimeEn,
              })}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Pending Warehouse Parcels (Returns & Postponed) */}
      <section className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-on-surface">
                {t(lang, 'pendingWarehouseParcels')}
              </h2>
              <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-tertiary/20 text-tertiary text-xs font-bold flex items-center justify-center tabular-nums">
                {custody.pendingParcels.length}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">
              {t(lang, 'mustDeliverAll')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            {t(lang, 'handoverWarehouseGuide')}
          </p>
        </div>

        {custody.pendingParcels.length === 0 ? (
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center text-sm text-on-surface-variant">
            {t(lang, 'noPendingParcels')}
          </div>
        ) : (
          <div className="space-y-3">
            {custody.pendingParcels.map((parcel) => (
              <div
                key={parcel.id}
                className="flex flex-col p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 shadow-sm gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {renderParcelIcon(parcel.type)}
                    <span
                      className="font-telemetry text-sm font-bold text-primary tracking-wide tabular-nums"
                      dir="ltr"
                    >
                      #{parcel.trackingNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${renderBadgeClass(
                      parcel.type
                    )}`}
                  >
                    {lang === 'ar' ? parcel.typeLabelAr : parcel.typeLabelEn}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-on-surface">
                    {lang === 'ar' ? parcel.summaryAr : parcel.summaryEn}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {lang === 'ar' ? parcel.metaAr : parcel.metaEn}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openBarcode(
                      parcel.trackingNumber,
                      lang === 'ar'
                        ? `${parcel.typeLabelAr} • ${parcel.trackingNumber}`
                        : `${parcel.typeLabelEn} • ${parcel.trackingNumber}`
                    )
                  }
                  className="w-full min-h-[48px] rounded-full bg-surface-container-high hover:bg-surface-container-highest active:scale-[0.98] transition flex items-center justify-center gap-2 text-on-surface text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <Barcode className="w-5 h-5 text-primary" />
                  <span>{t(lang, 'showBarcodeWarehouse')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Master Handover Trigger (NO Self-Clear Button!) */}
      <section className="flex flex-col gap-3 p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-display text-base sm:text-lg font-bold text-on-surface truncate">
              {t(lang, 'handoverCustodyTitle')}
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant truncate tabular-nums">
              {t(lang, 'settleSummary', {
                amount: custody.totalCodCash.toLocaleString('en-US'),
                count: custody.pendingParcels.length,
              })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            openBarcode(
              custody.masterBarcode,
              lang === 'ar'
                ? `كود التصفية الشاملة - الوردية رقم ${custody.shiftNumber}`
                : `Master Handover Code - Shift #${custody.shiftNumber}`
            )
          }
          className="w-full min-h-[54px] px-4 rounded-full bg-primary hover:bg-primary-fixed text-on-primary active:scale-[0.98] transition flex items-center justify-center gap-2 text-xs sm:text-sm font-bold shadow-[0_8px_28px_-4px_rgba(16,185,129,0.35)] cursor-pointer"
        >
          <QrCode className="w-5 h-5 shrink-0" />
          <span className="truncate">{t(lang, 'masterBarcodeBtn')}</span>
        </button>

        {/* Strict Security Notice — Courier cannot clear custody */}
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-surface-container border border-secondary/25">
          <ShieldAlert className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            <strong className="text-secondary font-bold">
              {t(lang, 'securityNoticeLabel')}{' '}
            </strong>
            {t(lang, 'securityCustodyWarning')}
          </p>
        </div>
      </section>

      <BarcodeModal
        open={modalState.open}
        code={modalState.code}
        title={modalState.title}
        lang={lang}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
      />
      </div>
    </PullToRefresh>
  );
};
