import React from 'react';
import { ChevronLeft, ChevronRight, Lock, Radio } from 'lucide-react';
import webstackLogo from '../assets/webstack-logo.png';
import { CourierProfile, Language } from '../types/courier';
import { t } from '../i18n/translations';

interface AppHeaderProps {
  title: string;
  courier: CourierProfile;
  lang: Language;
  shiftActive: boolean;
  isDemo?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onAvatarClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  courier,
  lang,
  shiftActive,
  isDemo,
  showBack,
  onBack,
  onAvatarClick,
}) => {
  const initials = courier.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-surface-container-low/90 backdrop-blur-xl border-b border-outline-variant/25 pt-safe shadow-sm">
      <div className="max-w-2xl mx-auto h-15 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface active:scale-95 transition cursor-pointer shrink-0"
            >
              {lang === 'ar' ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm shrink-0">
              <img
                src={webstackLogo}
                alt="WebStack"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-on-surface-variant font-medium leading-none truncate">
              {t(lang, 'appShort')}
              {isDemo ? ` · ${t(lang, 'demoBanner')}` : ''}
            </span>
            <h1 className="font-display text-base font-bold text-on-surface truncate leading-tight mt-0.5">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
              shiftActive
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${shiftActive ? 'text-primary' : 'text-outline'}`} />
            <span>{shiftActive ? t(lang, 'online') : t(lang, 'offline')}</span>
            {shiftActive && <Lock className="w-3 h-3 opacity-75" />}
          </span>

          <button
            type="button"
            onClick={onAvatarClick}
            aria-label={t(lang, 'navProfile')}
            className="w-10 h-10 rounded-full bg-surface-container-high ring-2 ring-primary/40 flex items-center justify-center overflow-hidden text-xs font-bold text-primary cursor-pointer shrink-0"
          >
            {courier.avatarUrl ? (
              <img
                src={courier.avatarUrl}
                alt={courier.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials || 'WS'}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
