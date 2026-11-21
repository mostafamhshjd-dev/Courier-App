import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { Language } from '../types/courier';
import { t } from '../i18n/translations';

interface BarcodeModalProps {
  open: boolean;
  code: string;
  title: string;
  lang: Language;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  open,
  code,
  title,
  lang,
  onClose,
}) => {
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!open || !code || !barcodeSvgRef.current) return;
    try {
      const sanitized = code.replace(/^#/, '').trim() || 'WS-00000';
      JsBarcode(barcodeSvgRef.current, sanitized, {
        format: 'CODE128',
        lineColor: '#0B1326',
        background: '#FFFFFF',
        width: 2,
        height: 68,
        displayValue: false,
        margin: 6,
      });
    } catch {
      // Fallback safely if code contains unsupported characters
    }
  }, [open, code]);

  if (!open) return null;

  const cleanCode = code.replace(/^#/, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-surface-container-high border border-outline-variant/40 p-6 flex flex-col items-center gap-4 shadow-2xl relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t(lang, 'closeModal')}
          className="absolute top-4 ltr:right-4 rtl:left-4 w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-1 text-center pt-1">
          <span className="w-10 h-1 rounded-full bg-outline-variant mb-2" />
          <h4 className="font-display text-lg font-bold text-on-surface">{title}</h4>
          <span
            className="font-telemetry text-base font-bold text-primary tracking-wider tabular-nums"
            dir="ltr"
          >
            #{cleanCode}
          </span>
        </div>

        {/* High-contrast white scannable canvas for warehouse optical scanners */}
        <div className="w-full bg-white rounded-2xl p-5 flex flex-col items-center justify-center gap-4 shadow-inner">
          <div className="w-full flex items-center justify-center overflow-hidden">
            <svg ref={barcodeSvgRef} className="w-full max-h-20" />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 flex items-center justify-center">
            <QRCodeSVG
              value={cleanCode}
              size={132}
              bgColor="#0B1326"
              fgColor="#10B981"
              level="M"
            />
          </div>

          <span className="text-[11px] font-mono font-bold text-slate-800 tracking-widest">
            {t(lang, 'scanApproved')}
          </span>
        </div>

        <p className="text-sm text-center text-on-surface-variant leading-relaxed">
          {t(lang, 'pointScannerMsg')}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[48px] rounded-full bg-surface-container hover:bg-surface-container-highest text-on-surface text-sm font-semibold transition-colors cursor-pointer"
        >
          {t(lang, 'closeModal')}
        </button>
      </div>
    </div>
  );
};
