import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Bell,
  Bike,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Headphones,
  History,
  Info,
  LogOut,
  MapPin,
  Moon,
  Star,
  Sun,
  Truck,
  X,
} from 'lucide-react';
import {
  CourierProfile,
  Language,
  ThemeMode,
} from '../types/courier';
import { t } from '../i18n/translations';
import { DEMO_SETTLEMENTS } from '../data/previewData';

interface ProfileScreenProps {
  courier: CourierProfile;
  lang: Language;
  theme: ThemeMode;
  soundEnabled: boolean;
  onChangeLanguage: (lang: Language) => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onLogout: () => Promise<void>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  courier,
  lang,
  theme,
  soundEnabled,
  onChangeLanguage,
  onToggleTheme,
  onToggleSound,
  onLogout,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = courier.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  const todayPct = Math.min(
    100,
    Math.round((courier.completedToday / Math.max(1, courier.totalToday)) * 100)
  );
  const weeklyLeft = Math.max(0, courier.weeklyTarget - courier.weeklyCompleted);
  const ChevronIcon = lang === 'ar' ? ChevronLeft : ChevronRight;

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-28 space-y-4">
      {/* 1. Driver Identity Cockpit Card */}
      <section className="w-full bg-surface-container-low border border-outline-variant/25 rounded-3xl p-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-primary via-primary-container to-transparent" />

        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high border border-primary/40 flex items-center justify-center overflow-hidden font-display text-2xl font-bold text-primary shadow-md">
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
            </div>
            <div className="absolute -bottom-1.5 ltr:-right-1.5 rtl:-left-1.5 bg-primary text-on-primary rounded-full p-1 shadow-sm">
              <BadgeCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-on-surface truncate">
              {courier.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-0.5">
              <span className="text-primary font-bold">{t(lang, 'verifiedCourier')}</span>
              <span aria-hidden="true">·</span>
              <span className="font-telemetry text-on-surface font-semibold" dir="ltr">
                {courier.code}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-2 truncate">
              <Bike className="w-4 h-4 text-secondary shrink-0" />
              <span className="truncate">{courier.vehicle}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high self-start mt-2.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[11px] font-bold text-primary">
                {t(lang, 'connectedReady')}
              </span>
            </div>
          </div>
        </div>

        {/* Real Server Branch Strip */}
        <div className="mt-4 flex items-center justify-between gap-2 bg-surface-container rounded-2xl px-3.5 py-2.5 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate font-semibold text-on-surface">
              {t(lang, 'branchLabel')}: {courier.branch?.trim() || t(lang, 'unassignedBranch')}
            </span>
          </div>
          {courier.zoneTag && courier.zoneTag !== 'النطاق A' && (
            <span className="text-primary font-bold shrink-0">{courier.zoneTag}</span>
          )}
        </div>
      </section>

      {/* 2. Performance Telemetry Pods (Row of 3) */}
      <section className="grid grid-cols-3 gap-2.5">
        {/* Delivery Success Rate */}
        <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant">
              {t(lang, 'successRate')}
            </span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="my-2">
            <div className="font-telemetry text-2xl sm:text-3xl font-extrabold text-primary leading-none tabular-nums">
              {courier.deliveryRate}%
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <svg className="w-10 h-3 text-primary shrink-0" fill="none" viewBox="0 0 48 12">
              <path
                d="M1 10L10 8L20 9L29 4L38 6L47 2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            </svg>
            <span className="text-primary font-bold tabular-nums">
              {courier.deliveryRateDelta}
            </span>
          </div>
        </div>

        {/* Daily Completed */}
        <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant">
              {t(lang, 'todayLabel')}
            </span>
            <Truck className="w-4 h-4 text-secondary" />
          </div>
          <div className="my-2">
            <div className="font-telemetry text-2xl sm:text-3xl font-extrabold text-on-surface leading-none tabular-nums">
              {courier.completedToday}
              <span className="text-xs font-semibold text-on-surface-variant">
                /{courier.totalToday}
              </span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all"
              style={{ width: `${todayPct}%` }}
            />
          </div>
        </div>

        {/* Rating */}
        <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant">
              {t(lang, 'ratingLabel')}
            </span>
            <Star className="w-4 h-4 text-secondary fill-secondary" />
          </div>
          <div className="my-2">
            <div className="font-telemetry text-2xl sm:text-3xl font-extrabold text-secondary leading-none tabular-nums">
              {courier.rating.toFixed(1)}
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant truncate tabular-nums">
            {t(lang, 'customerReviews', { count: courier.ratingCount })}
          </div>
        </div>
      </section>

      {/* 3. Weekly Incentive Banner */}
      <section className="w-full bg-surface-container-low border border-secondary/30 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-secondary">
                {t(lang, 'weeklyIncentive')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold tabular-nums">
                +{courier.weeklyBonus} {t(lang, 'currency')}
              </span>
            </div>
            <span className="text-xs text-on-surface truncate mt-0.5">
              {t(lang, 'completedOfTarget', {
                done: courier.weeklyCompleted,
                target: courier.weeklyTarget,
              })}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold whitespace-nowrap shrink-0">
          {weeklyLeft > 0
            ? t(lang, 'remainingOnly', { left: weeklyLeft })
            : t(lang, 'goalAchieved')}
        </span>
      </section>

      {/* 4. Preferences & Operational Controls */}
      <section className="w-full bg-surface-container-low border border-outline-variant/25 rounded-3xl p-2 shadow-sm divide-y divide-outline-variant/15">
        <div className="px-3 pt-2.5 pb-2 text-xs font-bold text-on-surface-variant">
          {t(lang, 'operationalSettings')}
        </div>

        {/* Language Toggle (Arabic RTL / English LTR) */}
        <div className="flex items-center justify-between p-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'appLanguage')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {t(lang, 'appLanguageSub')}
              </span>
            </div>
          </div>
          <div className="flex items-center p-1 bg-surface-container-lowest border border-outline-variant/30 rounded-full shrink-0">
            <button
              type="button"
              onClick={() => onChangeLanguage('ar')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                lang === 'ar'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage('en')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Dark / Light Mode Toggle */}
        <div className="flex items-center justify-between p-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'appearanceTheme')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {theme === 'dark' ? t(lang, 'darkModeDesc') : t(lang, 'lightModeDesc')}
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label={t(lang, 'appearanceTheme')}
            onClick={onToggleTheme}
            className={`w-13 h-7 rounded-full p-1 flex items-center transition-colors cursor-pointer shrink-0 ${
              theme === 'dark'
                ? 'bg-primary justify-end'
                : 'bg-surface-container-highest justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-on-primary flex items-center justify-center shadow-sm">
              {theme === 'dark' ? (
                <Check className="w-3 h-3 text-primary" />
              ) : (
                <Sun className="w-3 h-3 text-secondary" />
              )}
            </span>
          </button>
        </div>

        {/* Alert Sounds Toggle */}
        <div className="flex items-center justify-between p-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'alertSounds')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {t(lang, 'alertSoundsSub')}
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            onClick={onToggleSound}
            className={`w-13 h-7 rounded-full p-1 flex items-center transition-colors cursor-pointer shrink-0 ${
              soundEnabled
                ? 'bg-primary justify-end'
                : 'bg-surface-container-highest justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-on-primary shadow-sm" />
          </button>
        </div>

        {/* Settlement Archive */}
        <button
          type="button"
          onClick={() => setShowSettlements(true)}
          className="w-full flex items-center justify-between p-3 hover:bg-surface-container-high/60 transition rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 text-start">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'settlementArchive')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {t(lang, 'settlementArchiveSub')}
              </span>
            </div>
          </div>
          <ChevronIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
        </button>

        {/* Direct Field Dispatcher Support */}
        <a
          href={`tel:${courier.dispatcherPhone}`}
          className="w-full flex items-center justify-between p-3 hover:bg-surface-container-high/60 transition rounded-xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 text-start">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'supportCenter')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {t(lang, 'supportCenterSub')}
              </span>
            </div>
          </div>
          <ChevronIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
        </a>

        {/* Build Version Info */}
        <div className="flex items-center justify-between p-3 opacity-85">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-on-surface truncate">
                {t(lang, 'appVersion')}
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                {t(lang, 'appVersionSub')}
              </span>
            </div>
          </div>
          <span className="font-telemetry text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full shrink-0">
            v2.4.0
          </span>
        </div>
      </section>

      {/* 5. Logout & End Shift Trigger */}
      <div className="pt-1 space-y-2.5">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full min-h-[54px] py-3.5 px-4 rounded-2xl bg-error-container/25 hover:bg-error-container/40 border border-error/30 text-error font-display text-sm sm:text-base font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span>{t(lang, 'logoutEndShift')}</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 text-on-surface-variant text-xs text-center px-2">
          <AlertTriangle className="w-4 h-4 text-secondary shrink-0" />
          <span>{t(lang, 'logoutWarning')}</span>
        </div>
      </div>

      {/* Settlement Archive Modal */}
      {showSettlements && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSettlements(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface-container-high border border-outline-variant/40 p-5 space-y-4 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-on-surface">
                {t(lang, 'settlementArchive')}
              </h3>
              <button
                type="button"
                onClick={() => setShowSettlements(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {DEMO_SETTLEMENTS.map((row) => (
                <div
                  key={row.id}
                  className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/25 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-on-surface font-telemetry">
                      {row.shiftCode} · {row.date}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      {lang === 'ar'
                        ? `طرود مرتجعة: ${row.parcelsReturned}`
                        : `Returned parcels: ${row.parcelsReturned}`}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-telemetry text-sm font-bold text-secondary tabular-nums">
                      {row.codSettled.toLocaleString('en-US')} {t(lang, 'currency')}
                    </div>
                    <div className="text-[11px] font-bold text-primary">
                      {lang === 'ar' ? 'تم التوريد' : 'Verified'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-surface-container-high border border-outline-variant/40 p-5 space-y-4 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-error-container/35 text-error flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface">
                {t(lang, 'logoutModalTitle')}
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {t(lang, 'logoutModalBody')}
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={loggingOut}
                onClick={confirmLogout}
                className="flex-1 min-h-[48px] rounded-full bg-tertiary-container text-on-tertiary-container font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {t(lang, 'confirmLogout')}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 min-h-[48px] rounded-full bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
