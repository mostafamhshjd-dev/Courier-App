import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  KeyRound,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { DeliveryOutcome, Language, ShipmentTask } from '../types/courier';
import { t } from '../i18n/translations';
import { POSTPONE_REASONS, RETURN_REASONS } from '../data/previewData';

export interface OutcomeSubmissionPayload {
  shipment_id: string;
  tracking_number: string;
  status: DeliveryOutcome;
  otp?: string;
  collected_amount?: number;
  returned_pieces?: number;
  reason?: string;
  postpone_date?: string;
  notes?: string;
  proof_photo_name?: string;
}

interface OutcomeBottomSheetProps {
  open: boolean;
  shipment: ShipmentTask | null;
  lang: Language;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: OutcomeSubmissionPayload) => Promise<void>;
  onNotify: (message: string, variant?: 'success' | 'info' | 'error') => void;
}

export const OutcomeBottomSheet: React.FC<OutcomeBottomSheetProps> = ({
  open,
  shipment,
  lang,
  submitting,
  onClose,
  onSubmit,
  onNotify,
}) => {
  const [outcome, setOutcome] = useState<DeliveryOutcome>('delivered');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [collectedAmount, setCollectedAmount] = useState<string>('');
  const [returnedPieces, setReturnedPieces] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [postponeDate, setPostponeDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>('');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string>('');

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastShipmentIdRef = useRef<string | null>(null);

  // Sync defaults when opening for a new shipment
  if (open && shipment && lastShipmentIdRef.current !== shipment.id) {
    lastShipmentIdRef.current = shipment.id;
    const defaultCollected = shipment.codAmount > 0 ? Math.round(shipment.codAmount * 0.65) : 0;
    setOutcome('delivered');
    setOtpDigits(['', '', '', '']);
    setCollectedAmount(String(defaultCollected));
    setReturnedPieces(1);
    setReason(RETURN_REASONS[lang][0]);
    setNotes('');
    setProofPreview(null);
    setProofName('');
  }

  if (!open || !shipment) return null;

  const totalPieces = Math.max(1, shipment.itemsCount || 1);
  const maxReturned = Math.max(1, totalPieces > 1 ? totalPieces - 1 : 1);
  const safeReturned = Math.min(Math.max(1, returnedPieces), maxReturned);
  const keptPieces = Math.max(0, totalPieces - safeReturned);
  const numericCollected = Math.max(0, Number(collectedAmount) || 0);
  const remainingReturnAmount = Math.max(0, shipment.codAmount - numericCollected);

  const handleOtpChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      const split = clean.slice(0, 4).split('');
      const next = ['', '', '', ''];
      split.forEach((d, idx) => {
        next[idx] = d;
      });
      setOtpDigits(next);
      otpRefs.current[Math.min(3, split.length)]?.focus();
      return;
    }
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (clean && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const outcomeOptions: Array<{
    id: DeliveryOutcome;
    label: string;
    icon: React.ReactNode;
    accentClass: string;
  }> = [
    {
      id: 'delivered',
      label: t(lang, 'outcomeDelivered'),
      icon: <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />,
      accentClass: 'bg-primary/15 border-primary/50 text-on-surface',
    },
    {
      id: 'partial_return',
      label: t(lang, 'outcomePartial'),
      icon: <ArrowLeftRight className="w-5 h-5 text-secondary shrink-0" />,
      accentClass: 'bg-secondary/15 border-secondary/50 text-on-surface',
    },
    {
      id: 'full_return',
      label: t(lang, 'outcomeFullReturn'),
      icon: <XCircle className="w-5 h-5 text-tertiary shrink-0" />,
      accentClass: 'bg-tertiary/15 border-tertiary/50 text-on-surface',
    },
    {
      id: 'postponed',
      label: t(lang, 'outcomePostponed'),
      icon: <Clock className="w-5 h-5 text-secondary shrink-0" />,
      accentClass: 'bg-secondary/15 border-secondary/40 text-on-surface',
    },
  ];

  const activeOutcomeLabel =
    outcomeOptions.find((o) => o.id === outcome)?.label || t(lang, 'outcomeDelivered');

  const reasonsList =
    outcome === 'postponed' ? POSTPONE_REASONS[lang] : RETURN_REASONS[lang];

  const handleSubmit = async () => {
    const otpValue = otpDigits.join('');
    const payload: OutcomeSubmissionPayload = {
      shipment_id: shipment.id,
      tracking_number: shipment.trackingNumber,
      status: outcome,
      notes: notes.trim() || undefined,
      proof_photo_name: proofName || undefined,
    };

    if (outcome === 'delivered') {
      payload.collected_amount = shipment.isPrepaid ? 0 : shipment.codAmount;
      if (otpValue) payload.otp = otpValue;
    } else if (outcome === 'partial_return') {
      payload.collected_amount = numericCollected;
      payload.returned_pieces = safeReturned;
      payload.reason = reason || reasonsList[0];
      if (otpValue) payload.otp = otpValue;
    } else if (outcome === 'full_return') {
      payload.collected_amount = 0;
      payload.returned_pieces = totalPieces;
      payload.reason = reason || reasonsList[0];
    } else if (outcome === 'postponed') {
      payload.reason = reason || reasonsList[0];
      payload.postpone_date = postponeDate;
    }

    await onSubmit(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'recordOutcomeTitle')}
      onClick={onClose}
    >
      <aside
        className="w-full max-w-2xl mx-auto flex flex-col max-h-[90dvh] bg-surface-container-high rounded-t-3xl border-t border-x border-outline-variant/40 shadow-[0_-12px_48px_rgba(0,0,0,0.65)] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div className="w-full flex flex-col items-center pt-3 pb-2 px-4 bg-surface-container-high shrink-0 border-b border-outline-variant/25">
          <div className="w-12 h-1.5 rounded-full bg-outline-variant/70 mb-3" />
          <div className="w-full flex items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-display text-lg font-bold text-on-surface truncate">
                  {t(lang, 'recordOutcomeTitle')}
                </h2>
                <span className="text-xs text-on-surface-variant">
                  {t(lang, 'shipmentLabel')}{' '}
                  <span className="font-telemetry text-primary font-bold" dir="ltr">
                    #{shipment.trackingNumber}
                  </span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t(lang, 'close')}
              className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-4 space-y-4 py-4">
          {/* 4-Outcome Radio Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant block">
              {t(lang, 'fieldDeliveryStatus')}
            </label>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup">
              {outcomeOptions.map((opt) => {
                const selected = outcome === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setOutcome(opt.id);
                      setReason(
                        opt.id === 'postponed'
                          ? POSTPONE_REASONS[lang][0]
                          : RETURN_REASONS[lang][0]
                      );
                    }}
                    className={`flex items-center justify-between p-3.5 min-h-[52px] rounded-2xl border transition-all cursor-pointer ${
                      selected
                        ? `${opt.accentClass} shadow-sm`
                        : 'bg-surface-container border-outline-variant/25 text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon}
                      <span className="text-xs sm:text-sm font-bold truncate">{opt.label}</span>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        selected ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-on-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OTP Verification Section (Delivered & Partial Return) */}
          {(outcome === 'delivered' || outcome === 'partial_return') && (
            <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/25 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <label className="text-xs sm:text-sm font-semibold text-on-surface">
                    {t(lang, 'otpTitle')}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onNotify(t(lang, 'otpResent'), 'info')}
                  className="text-primary hover:text-primary-fixed text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <span>{t(lang, 'resendCode')}</span>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 py-1" dir="ltr">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={digit}
                    aria-label={`OTP digit ${idx + 1}`}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    placeholder="•"
                    className="w-13 h-13 rounded-xl bg-surface-container-high border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/25 text-center font-telemetry text-2xl font-bold text-primary focus:outline-none tabular-nums transition-all"
                  />
                ))}
              </div>
              <p className="text-xs text-center text-on-surface-variant">
                {t(lang, 'otpHelper')}
              </p>
            </div>
          )}

          {/* Partial Return Dynamic Settlement Block */}
          {outcome === 'partial_return' && (
            <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/25 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-bold text-on-surface">
                    {t(lang, 'partialSettlementTitle')}
                  </span>
                </div>
                <span className="text-xs font-semibold text-secondary tabular-nums">
                  {t(lang, 'totalParcelPieces', { count: totalPieces })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Actual Cash Collected */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant font-medium">
                    {t(lang, 'actualCashCollected')}
                  </label>
                  <div className="flex items-center justify-between bg-surface-container-high border border-outline-variant/35 focus-within:border-secondary px-3 h-13 rounded-xl">
                    <input
                      type="number"
                      min={0}
                      max={Math.max(shipment.codAmount, 99999)}
                      value={collectedAmount}
                      onChange={(e) => setCollectedAmount(e.target.value)}
                      className="w-full bg-transparent font-telemetry text-xl font-bold text-secondary focus:outline-none tabular-nums"
                      dir="ltr"
                    />
                    <span className="text-xs font-bold text-secondary shrink-0 ms-1">
                      {t(lang, 'currency')}
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                    {t(lang, 'remainingForReturn', { amount: remainingReturnAmount })}
                  </span>
                </div>

                {/* Returned Pieces Stepper */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant font-medium">
                    {t(lang, 'returnedPiecesCount')}
                  </label>
                  <div className="flex items-center justify-between bg-surface-container-high border border-outline-variant/35 px-2 h-13 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReturnedPieces((p) => Math.max(1, p - 1))}
                      aria-label="Decrease returned pieces"
                      className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-highest active:scale-95 transition cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-telemetry text-lg font-bold text-primary tabular-nums">
                      {safeReturned}{' '}
                      <span className="text-xs font-sans font-medium text-on-surface-variant">
                        {t(lang, 'pieceUnit')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReturnedPieces((p) => Math.min(maxReturned, p + 1))}
                      aria-label="Increase returned pieces"
                      className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-highest active:scale-95 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[11px] text-primary font-medium tabular-nums">
                    {t(lang, 'customerReceivedPieces', { count: keptPieces })}
                  </span>
                </div>
              </div>

              {/* Reverse Waybill Auto-Generation Notice */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-secondary/25 flex items-start gap-2">
                <Info className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  {t(lang, 'reverseWaybillBanner', {
                    code: `#${shipment.trackingNumber}-R`,
                    count: safeReturned,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Reason Selector & Date (Partial Return / Full Return / Postponed) */}
          {outcome !== 'delivered' && (
            <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/25 space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">
                  {outcome === 'postponed'
                    ? t(lang, 'postponeReasonLabel')
                    : t(lang, 'returnReasonLabel')}
                </label>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full appearance-none bg-surface-container-high border border-outline-variant/35 rounded-xl px-3.5 py-3 text-sm text-on-surface font-medium focus:outline-none focus:border-primary pe-10"
                  >
                    {reasonsList.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-on-surface-variant pointer-events-none absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3" />
                </div>
              </div>

              {outcome === 'postponed' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">
                    {t(lang, 'postponeDateLabel')}
                  </label>
                  <input
                    type="date"
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant/35 rounded-xl px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(lang, 'notesPlaceholder')}
                className="w-full bg-surface-container-high border border-outline-variant/35 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary resize-none"
              />
            </div>
          )}

          {/* Proof Photo Capture Row */}
          <div className="flex items-center justify-between gap-3 bg-surface-container p-3.5 rounded-2xl border border-outline-variant/25">
            <div className="flex items-center gap-3 min-w-0">
              {proofPreview ? (
                <img
                  src={proofPreview}
                  alt="Proof attachment"
                  className="w-11 h-11 rounded-xl object-cover border border-primary/40 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-on-surface truncate">
                  {proofPreview ? t(lang, 'photoAttached') : t(lang, 'attachProofTitle')}
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {proofName || t(lang, 'attachProofSub')}
                </span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 min-h-[40px] rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>{t(lang, 'capturePhoto')}</span>
            </button>
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <div className="p-4 pb-safe bg-surface-container-high border-t border-outline-variant/25 shrink-0 space-y-2">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full min-h-[54px] rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-base font-bold shadow-[0_8px_24px_-4px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {submitting
                ? t(lang, 'saving')
                : t(lang, 'confirmSaveOutcome', { label: activeOutcomeLabel })}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-transparent hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-semibold text-center transition-colors cursor-pointer"
          >
            {t(lang, 'cancelReturnDetails')}
          </button>
        </div>
      </aside>
    </div>
  );
};
