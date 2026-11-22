import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  Keyboard,
  Loader2,
  PackageCheck,
  RefreshCw,
  Settings,
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

function playScanBeep(matched: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (matched) {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.11, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.17);
    }
  } catch {
    // Ignore audio restrictions
  }
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
  const readerElementId = `ws-fullscreen-reader-${reactId}`;

  const isNative = Capacitor.isNativePlatform();

  const [cameraState, setCameraState] = useState<
    'starting' | 'active' | 'permission_denied' | 'error'
  >('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [retryCounter, setRetryCounter] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const webScannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const nativeActiveRef = useRef<boolean>(false);
  const listenerRef = useRef<PluginListenerHandle | null>(null);
  const errorListenerRef = useRef<PluginListenerHandle | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const feedbackTimerRef = useRef<number | null>(null);

  const waybillsRef = useRef(waybills);
  const scannedRef = useRef(scannedTrackingNumbers);
  const onScanMatchRef = useRef(onScanMatch);

  waybillsRef.current = waybills;
  scannedRef.current = scannedTrackingNumbers;
  onScanMatchRef.current = onScanMatch;

  const showLiveFeedback = (type: 'success' | 'info' | 'error', text: string) => {
    setFeedback({ type, text });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, 2800);
  };

  const processScannedCode = (rawText: string) => {
    const clean = normalizeCode(rawText);
    if (!clean) return;

    // Debounce identical rapid frames within 1.5s while allowing instant scanning of DIFFERENT waybills
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
      playScanBeep(false);
      showLiveFeedback('error', t(lang, 'scannerNotInBatch', { code: clean }));
      return;
    }

    const already = scannedRef.current.some(
      (code) => normalizeCode(code) === normalizeCode(matched.trackingNumber)
    );
    if (already) {
      showLiveFeedback('info', t(lang, 'scannerAlreadyScanned', { code: matched.trackingNumber }));
      return;
    }

    onScanMatchRef.current(matched.trackingNumber);
    playScanBeep(true);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(75);
      }
    } catch {
      // Ignore vibration restrictions
    }
    showLiveFeedback('success', t(lang, 'scannerMatchedToast', { code: matched.trackingNumber }));
  };

  const stopAllScanners = async () => {
    document.documentElement.classList.remove('barcode-scanner-active');
    document.body.classList.remove('barcode-scanner-active');

    if (listenerRef.current) {
      try {
        await listenerRef.current.remove();
      } catch {
        // ignore
      }
      listenerRef.current = null;
    }

    if (errorListenerRef.current) {
      try {
        await errorListenerRef.current.remove();
      } catch {
        // ignore
      }
      errorListenerRef.current = null;
    }

    if (nativeActiveRef.current) {
      nativeActiveRef.current = false;
      try {
        await BarcodeScanner.disableTorch();
      } catch {
        // ignore
      }
      try {
        await BarcodeScanner.stopScan();
      } catch {
        // ignore
      }
    }

    if (webScannerRef.current) {
      const inst = webScannerRef.current;
      webScannerRef.current = null;
      try {
        await inst.stop();
      } catch {
        // ignore
      }
      try {
        inst.clear();
      } catch {
        // ignore
      }
    }

    setTorchEnabled(false);
    setTorchAvailable(false);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setCameraState('starting');
    setCameraError(null);
    setFeedback(null);
    setManualDrawerOpen(false);
    setTorchEnabled(false);
    setTorchAvailable(false);

    const startNativeScanner = async () => {
      try {
        // 1. Check & request native Android/iOS Camera permission before starting
        let perm = await BarcodeScanner.checkPermissions();
        if (perm.camera !== 'granted' && perm.camera !== 'limited') {
          perm = await BarcodeScanner.requestPermissions();
        }
        if (cancelled) return;

        if (perm.camera !== 'granted' && perm.camera !== 'limited') {
          setCameraState('permission_denied');
          return;
        }

        // 2. Make WebView & document root transparent so Full-Screen Native CameraX shows behind HUD
        document.documentElement.classList.add('barcode-scanner-active');
        document.body.classList.add('barcode-scanner-active');

        // 3. Register continuous barcode scan listener (all formats: QR, Code128, EAN, Code39, etc.)
        const handle = await BarcodeScanner.addListener('barcodesScanned', (event) => {
          if (cancelled || !event?.barcodes?.length) return;
          event.barcodes.forEach((barcode) => {
            const value = barcode.rawValue || barcode.displayValue || '';
            if (value) {
              processScannedCode(value);
            }
          });
        });

        const errHandle = await BarcodeScanner.addListener('scanError', (event) => {
          if (cancelled) return;
          if (event?.message) {
            setCameraError(event.message);
          }
        });

        if (cancelled) {
          await handle.remove().catch(() => {});
          await errHandle.remove().catch(() => {});
          document.documentElement.classList.remove('barcode-scanner-active');
          document.body.classList.remove('barcode-scanner-active');
          return;
        }

        listenerRef.current = handle;
        errorListenerRef.current = errHandle;

        // 4. Launch Full-Screen Native Back Camera with auto-focus & all barcode formats enabled
        await BarcodeScanner.startScan({
          lensFacing: LensFacing.Back,
        });

        if (cancelled) {
          await BarcodeScanner.stopScan().catch(() => {});
          document.documentElement.classList.remove('barcode-scanner-active');
          document.body.classList.remove('barcode-scanner-active');
          return;
        }

        nativeActiveRef.current = true;
        setCameraState('active');

        // 5. Detect hardware Flashlight / Torch availability
        try {
          const torchRes = await BarcodeScanner.isTorchAvailable();
          if (!cancelled) {
            setTorchAvailable(Boolean(torchRes?.available));
          }
        } catch {
          // Ignore torch capability error on devices without flash
        }
      } catch (err) {
        document.documentElement.classList.remove('barcode-scanner-active');
        document.body.classList.remove('barcode-scanner-active');
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err || '');
          if (/permission|denied|not allowed/i.test(msg)) {
            setCameraState('permission_denied');
          } else {
            setCameraState('error');
            setCameraError(
              lang === 'ar'
                ? 'تعذر تشغيل كاميرا الهاتف. يمكنك إعادة المحاولة أو استخدام الإدخال اليدوي بالأسفل.'
                : msg || 'Could not start native camera. Retry or use manual entry below.'
            );
          }
        }
      }
    };

    const startWebFullScreenFallback = async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        if (cancelled) return;

        if (
          typeof navigator !== 'undefined' &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === 'function'
        ) {
          let preflight: MediaStream | null = null;
          try {
            preflight = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: 'environment' } },
              audio: false,
            });
          } finally {
            if (preflight) {
              preflight.getTracks().forEach((tr) => tr.stop());
            }
          }
          if (cancelled) return;
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(readerElementId, { verbose: false });
        webScannerRef.current = scanner;

        const scanConfig = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const boxW = Math.min(300, Math.round(viewfinderWidth * 0.78));
            const boxH = Math.min(220, Math.round(viewfinderHeight * 0.34));
            return { width: Math.max(180, boxW), height: Math.max(140, boxH) };
          },
        };

        try {
          await scanner.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => processScannedCode(decodedText),
            () => {}
          );
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) throw new Error('NO_CAMERA_FOUND');
          const rear =
            cameras.find((c) => /back|rear|environment/i.test(c.label || '')) ||
            cameras[cameras.length - 1] ||
            cameras[0];
          await scanner.start(
            rear.id,
            scanConfig,
            (decodedText) => processScannedCode(decodedText),
            () => {}
          );
        }

        if (!cancelled) {
          setCameraState('active');
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err || '');
          if (/NotAllowedError|Permission|denied/i.test(msg)) {
            setCameraState('permission_denied');
          } else {
            setCameraState('error');
            setCameraError(
              lang === 'ar'
                ? 'تعذر تشغيل الكاميرا في المتصفح. تأكد من السماح بإذن الكاميرا أو استخدم الإدخال اليدوي بالأسفل.'
                : msg || 'Could not start camera. Allow camera permission or use manual entry below.'
            );
          }
        }
      }
    };

    if (isNative) {
      startNativeScanner();
    } else {
      startWebFullScreenFallback();
    }

    return () => {
      cancelled = true;
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      stopAllScanners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isNative, readerElementId, lang, retryCounter]);

  if (!open) return null;

  const handleToggleTorch = async () => {
    if (!isNative || !torchAvailable) return;
    try {
      await BarcodeScanner.toggleTorch();
      const status = await BarcodeScanner.isTorchEnabled();
      setTorchEnabled(Boolean(status?.enabled));
    } catch {
      // Ignore torch toggle failures
    }
  };

  const handleOpenSettings = async () => {
    if (isNative) {
      try {
        await BarcodeScanner.openSettings();
      } catch {
        // ignore
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode);
    setManualCode('');
  };

  const handleCloseSafe = async () => {
    await stopAllScanners();
    onClose();
  };

  const handleConfirmSafe = async () => {
    await stopAllScanners();
    onConfirmScanned();
  };

  const scannedCount = scannedTrackingNumbers.length;
  const totalCount = waybills.length;
  const remainingCount = Math.max(0, totalCount - scannedCount);
  const isPartial = scannedCount > 0 && remainingCount > 0;
  const isComplete = scannedCount > 0 && remainingCount === 0;
  const isTransparentNativeView = isNative && cameraState === 'active';

  const overlay = (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className={`fixed inset-0 z-[9999] flex flex-col justify-between overflow-hidden ${
        isTransparentNativeView ? 'bg-transparent' : 'bg-black'
      }`}
    >
      {/* Full-Screen Web Camera Viewport (ONLY used when running in a web browser, never in Android APK) */}
      {!isNative && (
        <div
          id={readerElementId}
          className="ws-fullscreen-web-reader absolute inset-0 w-full h-full z-0"
        />
      )}

      {/* TOP HUD BAR: Close + Live Scanned Counter + Hardware Torch/Flash Toggle */}
      <div className="relative z-20 pt-safe bg-gradient-to-b from-black/80 via-black/45 to-transparent px-4 pt-4 pb-6">
        <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
          <button
            type="button"
            onClick={handleCloseSafe}
            aria-label={t(lang, 'close')}
            className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center min-w-0 px-2">
            <span className="font-display text-sm font-bold text-white truncate">
              {t(lang, 'scannerModalTitle')}
            </span>
            <span className="mt-0.5 px-3 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs font-bold tabular-nums">
              {t(lang, 'verifiedProgress', { done: scannedCount, total: totalCount })}
            </span>
          </div>

          {isNative && torchAvailable ? (
            <button
              type="button"
              onClick={handleToggleTorch}
              aria-label={torchEnabled ? t(lang, 'torchOn') : t(lang, 'torchOff')}
              className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0 ${
                torchEnabled
                  ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.55)]'
                  : 'bg-black/55 border-white/20 text-white'
              }`}
            >
              {torchEnabled ? (
                <FlashlightOff className="w-5 h-5" />
              ) : (
                <Flashlight className="w-5 h-5" />
              )}
            </button>
          ) : (
            <div className="w-11 h-11 shrink-0" />
          )}
        </div>
      </div>

      {/* CENTER FULL-SCREEN VIEWFINDER / PERMISSION / LOADING STATE */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pointer-events-none">
        {cameraState === 'active' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            {/* Crisp Transparent Full-Screen Reticle Frame */}
            <div className="relative w-full aspect-[4/3] max-h-[240px]">
              {/* Top-Left Corner */}
              <span className="absolute top-0 left-0 w-9 h-9 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              {/* Top-Right Corner */}
              <span className="absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              {/* Bottom-Left Corner */}
              <span className="absolute bottom-0 left-0 w-9 h-9 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              {/* Bottom-Right Corner */}
              <span className="absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />

              {/* Animated Emerald Scan Laser */}
              <div className="absolute inset-x-3 top-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] ws-scan-line" />
            </div>

            <p className="text-xs font-semibold text-white/90 text-center bg-black/55 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              {t(lang, 'scanWaybillsPrompt')}
            </p>
          </div>
        )}

        {cameraState === 'starting' && (
          <div className="pointer-events-auto flex flex-col items-center gap-3 bg-slate-900/90 border border-white/15 rounded-3xl px-6 py-7 text-center max-w-xs">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-sm font-bold text-white">{t(lang, 'scannerStarting')}</span>
          </div>
        )}

        {cameraState === 'permission_denied' && (
          <div className="pointer-events-auto flex flex-col items-center gap-3.5 bg-slate-900/95 border border-amber-400/35 rounded-3xl p-6 text-center max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <h4 className="font-display text-base font-bold text-white">
              {t(lang, 'cameraPermissionDeniedTitle')}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t(lang, 'cameraPermissionDeniedDesc')}
            </p>
            <div className="flex flex-col gap-2 w-full pt-1">
              {isNative && (
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>{t(lang, 'openAppSettingsBtn')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setRetryCounter((c) => c + 1)}
                className="w-full min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t(lang, 'retryCameraBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="pointer-events-auto flex flex-col items-center gap-3 bg-slate-900/95 border border-red-400/35 rounded-3xl p-6 text-center max-w-sm shadow-2xl">
            <Camera className="w-9 h-9 text-amber-400" />
            <p className="text-xs text-slate-200 leading-relaxed">{cameraError}</p>
            <button
              type="button"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="w-full min-h-[44px] px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t(lang, 'retryCameraBtn')}</span>
            </button>
          </div>
        )}

        {/* Live Scan Match Toast Pill */}
        {feedback && (
          <div
            className={`mt-4 px-4 py-2.5 rounded-2xl backdrop-blur-md border text-xs font-bold flex items-center gap-2 max-w-sm shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-600/90 border-emerald-300/60 text-white'
                : feedback.type === 'info'
                  ? 'bg-amber-600/90 border-amber-300/60 text-white'
                  : 'bg-red-600/90 border-red-300/60 text-white'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.text}</span>
          </div>
        )}
      </div>

      {/* BOTTOM FLOATING CONTROL DOCK: Backup Manual Input + Dynamic Partial/Full Confirm CTA */}
      <div className="relative z-20 pb-safe bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 pt-6 pb-4">
        <div className="max-w-xl mx-auto space-y-2.5">
          {/* Collapsible Backup Manual Waybill Input (for damaged stickers) */}
          {manualDrawerOpen && (
            <form
              onSubmit={handleManualSubmit}
              className="p-3 rounded-2xl bg-slate-900/95 border border-white/20 backdrop-blur-xl space-y-2 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t(lang, 'scannerManualFallback')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setManualDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={t(lang, 'scannerManualPlaceholder')}
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl bg-slate-950/90 border border-white/25 text-sm font-telemetry font-semibold text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer shrink-0 active:scale-95 transition"
                >
                  {t(lang, 'scannerMatchBtn')}
                </button>
              </div>
            </form>
          )}

          {/* Primary Confirm CTA (Full or Partial with Remaining Cancellation) */}
          <button
            type="button"
            disabled={scannedCount === 0 || submitting}
            onClick={handleConfirmSafe}
            className={`w-full min-h-[52px] px-4 py-2.5 rounded-2xl font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition disabled:opacity-45 cursor-pointer text-center leading-snug ${
              isPartial
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span>{t(lang, 'confirmingPickup')}</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-5 h-5 shrink-0" />
                <span>
                  {isPartial
                    ? t(lang, 'confirmPartialPickupBtn', {
                        received: scannedCount,
                        cancelled: remainingCount,
                      })
                    : isComplete
                      ? t(lang, 'confirmAllPickupBtn', { count: scannedCount })
                      : t(lang, 'scannerConfirmScannedBtn', { count: scannedCount })}
                </span>
              </>
            )}
          </button>

          {/* Secondary Row: Manual Entry Backup Toggle + Close */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setManualDrawerOpen((prev) => !prev)}
              className="min-h-[44px] px-3 rounded-xl bg-white/12 hover:bg-white/18 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{t(lang, 'manualEntryBackupBtn')}</span>
            </button>

            <button
              type="button"
              onClick={handleCloseSafe}
              className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>{t(lang, 'close')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
