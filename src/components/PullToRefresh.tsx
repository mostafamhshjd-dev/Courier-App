import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Language } from '../types/courier';
import { t } from '../i18n/translations';

interface PullToRefreshProps {
  lang: Language;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}

const MAX_PULL_PX = 84;
const TRIGGER_PX = 56;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  lang,
  refreshing,
  onRefresh,
  children,
}) => {
  const startYRef = useRef<number | null>(null);
  const [pullPx, setPullPx] = useState(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    if (window.scrollY > 2) return;
    if (e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || refreshing) return;
    if (window.scrollY > 2) {
      startYRef.current = null;
      setPullPx(0);
      return;
    }
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullPx(0);
      return;
    }
    const damped = Math.min(MAX_PULL_PX, Math.round(delta * 0.45));
    setPullPx(damped);
  };

  const handleTouchEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullPx >= TRIGGER_PX && !refreshing) {
      setPullPx(0);
      onRefresh();
    } else {
      setPullPx(0);
    }
  };

  const ready = pullPx >= TRIGGER_PX;
  const visibleHeight = refreshing ? 0 : pullPx;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="w-full"
    >
      <div
        className="overflow-hidden flex items-center justify-center transition-[height] duration-150 ease-out"
        style={{ height: `${visibleHeight}px` }}
        aria-hidden={visibleHeight === 0}
      >
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
            ready
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant'
          }`}
        >
          <RefreshCw
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: `rotate(${Math.min(180, pullPx * 3)}deg)` }}
          />
          <span>{ready ? t(lang, 'releaseToRefresh') : t(lang, 'pullToRefresh')}</span>
        </div>
      </div>
      {children}
    </div>
  );
};
