import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Keyboard,
  Loader2,
  PackageCheck,
  QrCode,
  X,
} from 'lucide-react';
import { Language, PickupWaybillItem } from '../types/courier';
import { t } from '../i18n/translations';

interface QrBarcodeScannerModalProps {
  open: boolean;
  lang: Language;
  waybills: PickupWaybillItem[];
  scannedTrackingNumbers: string[];
  submitting: boolean;
  onScanMatch: (trackingNumber: string) => void;
  onConfirmScanned: () => void;
  onClose: () => void;
}

function normalizeCode(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase();
}

export const QrBarcodeScannerModal: React.FC<QrBarcodeScannerModalProps> = ({
  open,
  lang,
  waybills,
  scannedTrackingNumbers,
  submitting,
  onScanMatch,
  onConfirmScanned,
  onClose,
}) => {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const readerElementId = `ws-qr-reader-${reactId}`;

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'error'>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [manualCode, setManualCode] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const waybillsRef = useRef(waybills);
  const scannedRef = useRef(scannedTrackingNumbers);
  const onScanMatchRef = useRef(onScanMatch);

  waybillsRef.current = waybills;
  scannedRef.current = scannedTrackingNumbers;
  onScanMatchRef.current = onScanMatch;

  const processScannedCode = (rawText: string) => {
    const clean = normalizeCode(rawText);
    if (!clean) return;

    // Debounce identical rapid scans within 1.5s
    const now = Date.now();
    if (lastScanRef.current.code === clean && now - lastScanRef.current.time < 1500) {
      return;
    }
    lastScanRef.current = { code: clean, time: now };

    const matched = waybillsRef.current.find((w) => {
      const target = normalizeCode(w.trackingNumber);
      return target === clean || clean.includes(target) || target.includes(clean);
    });

    if (!matched) {
      setFeedback({
        type: 'error',
        text: t(lang, 'scannerNotInBatch', { code: clean }),
      });
      return;
    }

    const already = scannedRef.current.some(
      (code) => normalizeCode(code) === normalizeCode(matched.trackingNumber)
    );
    if (already) {
      setFeedback({
        type: 'info',
        text: t(lang, 'scannerAlreadyScanned', { code: matched.trackingNumber }),
      });
      return;
    }

    onScanMatchRef.current(matched.trackingNumber);
    setFeedback({
      type: 'success',
      text: t(lang, 'scannerMatchedToast', { code: matched.trackingNumber }),
    });
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setCameraState('starting');
    setCameraError(null);
    setFeedback(null);

    const startCamera = async () => {
      try {
        // Wait a tick for DOM container to mount cleanly
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        if (cancelled) return;

        const scanner = new Html5Qrcode(readerElementId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 170 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            processScannedCode(decodedText);
          },
          () => {
            // Ignore per-frame decode misses
          }
        );

        if (!cancelled) {
          setCameraState('active');
        }
      } catch (err) {
        if (!cancelled) {
          setCameraState('error');
          setCameraError(
            lang === 'ar'
              ? 'تعذر فتح الكاميرا. تأكد من منح إذن الكاميرا أو استخدم الإدخال اليدوي بالأسفل.'
              : err instanceof Error
                ? err.message
                : 'Could not start camera. Allow camera permission or enter code manually below.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        instance
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              instance.clear();
            } catch {
              // ignore
            }
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, readerElementId, lang]);

  if (!open) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode);
    setManualCode('');
  };

  const scannedCount = scannedTrackingNumbers.length;
  const totalCount = waybills.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-high border border-outline-variant/40 p-4 sm:p-5 space-y-4 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-on-surface truncate">
                {t(lang, 'scannerModalTitle')}
              </h3>
              <p className="text-[11px] font-semibold text-primary tabular-nums">
                {t(lang, 'verifiedProgress', { done: scannedCount, total: totalCount })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hint */}
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {t(lang, 'scannerModalHint')}
        </p>

        {/* Camera Viewport */}
        <div className="relative w-full min-h-[240px] rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/35 flex items-center justify-center">
          <div id={readerElementId} className="w-full" />

          {cameraState === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container-lowest/95 text-on-surface-variant">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <span className="text-xs font-semibold">{t(lang, 'scannerStarting')}</span>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center bg-surface-container-lowest/95">
              <Camera className="w-8 h-8 text-secondary" />
              <p className="text-xs text-on-surface-variant leading-relaxed">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Live Scan Feedback Banner */}
        {feedback && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-primary/15 border-primary/40 text-primary'
                : feedback.type === 'info'
                  ? 'bg-secondary/15 border-secondary/40 text-secondary'
                  : 'bg-error-container/30 border-error/40 text-error'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Manual Code Match Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-1.5">
          <label className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-primary" />
            <span>{t(lang, 'scannerManualFallback')}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t(lang, 'scannerManualPlaceholder')}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/35 text-sm font-telemetry font-semibold text-on-surface focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-on-surface text-xs font-bold cursor-pointer shrink-0"
            >
              {t(lang, 'scannerMatchBtn')}
            </button>
          </div>
        </form>

        {/* Confirm Scanned CTA */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={scannedCount === 0 || submitting}
            onClick={onConfirmScanned}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t(lang, 'confirmingPickup')}</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-5 h-5" />
                <span>{t(lang, 'scannerConfirmScannedBtn', { count: scannedCount })}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-surface-container text-on-surface-variant text-xs font-bold cursor-pointer"
          >
            {t(lang, 'close')}
          </button>
        </div>
      </div>
    </div>
  );
};
