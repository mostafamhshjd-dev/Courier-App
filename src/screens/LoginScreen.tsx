import React, { useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  Lock,
  LogIn,
  Phone,
  ShieldCheck,
  Terminal,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import webstackLogo from '../assets/webstack-logo.png';
import { Language } from '../types/courier';
import { t } from '../i18n/translations';
import { DEMO_COURIER } from '../data/previewData';

interface LoginScreenProps {
  lang: Language;
  onToggleLanguage: (lang: Language) => void;
  onLoginSubmit: (identifier: string, password: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  lang,
  onToggleLanguage,
  onLoginSubmit,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorDetail(null);
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال رقم الهاتف أو اسم المستخدم وكلمة المرور'
          : 'Please enter your phone/username and password'
      );
      return;
    }

    setLoading(true);
    try {
      await onLoginSubmit(identifier.trim(), password);
    } catch (err) {
      const apiErr = err as Error & {
        status?: number;
        rawText?: string;
        url?: string;
      };
      const msg =
        apiErr instanceof Error && apiErr.message
          ? apiErr.message
          : lang === 'ar'
            ? 'تعذر تسجيل الدخول. تحقق من البيانات أو اتصال الشبكة.'
            : 'Unable to sign in. Check credentials or network connection.';
      const statusLabel =
        typeof apiErr?.status === 'number' && apiErr.status > 0
          ? `HTTP ${apiErr.status}`
          : 'HTTP 0 (Network)';
      const rawSource =
        typeof apiErr?.rawText === 'string' && apiErr.rawText.trim()
          ? apiErr.rawText
          : apiErr instanceof Error && apiErr.message
            ? apiErr.message
            : String(err || 'Empty response');
      const snippet = rawSource.replace(/\s+/g, ' ').trim().slice(0, 150);
      setErrorMsg(msg);
      setErrorDetail(`${statusLabel} — ${snippet}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh w-full bg-surface text-on-surface flex flex-col justify-between relative overflow-hidden pt-safe pb-safe">
      {/* Subtle Ambient Cockpit Aura */}
      <div className="absolute -top-24 right-1/2 translate-x-1/2 w-80 h-80 bg-primary/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-secondary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col justify-between min-h-dvh px-5 py-5">
        {/* Top Operational Status & Language Bar */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant/25 px-3.5 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
              {t(lang, 'serverReady')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-on-surface-variant text-[11px] font-medium">
              <Zap className="w-3.5 h-3.5 text-secondary" />
              <span>{t(lang, 'instantSystem')}</span>
            </div>
            <button
              type="button"
              onClick={() => onToggleLanguage(lang === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>
        </div>

        {/* Center Brand & Login Form */}
        <div className="flex flex-col items-center w-full my-auto py-8">
          {/* Brand Logo Container */}
          <div className="relative mb-6 group">
            <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl transition duration-500 group-hover:bg-primary/30" />
            <div className="relative w-24 h-24 rounded-full p-2.5 bg-white shadow-xl ring-4 ring-surface-container-high flex items-center justify-center overflow-hidden">
              <img
                src={webstackLogo}
                alt="WebStack Courier Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-1 ltr:-right-1 rtl:-left-1 bg-surface-container-highest border border-outline-variant/40 text-primary rounded-full p-1.5 shadow-md">
              <Truck className="w-4 h-4" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mb-1.5">
              {t(lang, 'appBrand')}
            </h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              {t(lang, 'loginSubtitle')}
            </p>
          </div>

          {/* Error Feedback */}
          {errorMsg && (
            <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-error-container/30 border border-error/40 text-error text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span>{errorMsg}</span>
                {errorDetail && (
                  <code
                    dir="ltr"
                    className="block text-[11px] font-mono font-normal text-error/90 bg-black/20 rounded-lg px-2 py-1.5 break-all text-left select-all"
                  >
                    {errorDetail}
                  </code>
                )}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            {/* Phone / Username */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="courier-id"
                className="text-xs font-semibold text-on-surface-variant px-2 flex items-center justify-between"
              >
                <span>{t(lang, 'identifierLabel')}</span>
                <span className="text-primary text-[11px] font-bold">
                  {t(lang, 'required')}
                </span>
              </label>
              <div className="relative flex items-center bg-surface-container-low border border-outline-variant/35 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 rounded-full shadow-sm transition-all">
                <div className="ps-4 pe-2 flex items-center pointer-events-none text-on-surface-variant">
                  <Phone className="w-5 h-5" />
                </div>
                <input
                  id="courier-id"
                  name="courier-id"
                  type="text"
                  autoComplete="username"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t(lang, 'identifierPlaceholder')}
                  className={`w-full bg-transparent font-telemetry text-base font-semibold text-on-surface py-3.5 pe-4 ps-1 focus:outline-none placeholder:text-on-surface-variant/45 ${
                    lang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label
                htmlFor="password-input"
                className="text-xs font-semibold text-on-surface-variant px-2 flex items-center justify-between"
              >
                <span>{t(lang, 'passwordLabel')}</span>
                <span className="text-secondary text-[11px] font-semibold">
                  {t(lang, 'encryptedBadge')}
                </span>
              </label>
              <div className="relative flex items-center bg-surface-container-low border border-outline-variant/35 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 rounded-full shadow-sm transition-all">
                <div className="ps-4 pe-2 flex items-center pointer-events-none text-on-surface-variant">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-transparent font-telemetry text-base font-semibold text-on-surface py-3.5 px-1 focus:outline-none tracking-widest placeholder:text-on-surface-variant/45 ${
                    lang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                  className="pe-4 ps-2 min-h-[44px] flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Assistance */}
            <div className="flex items-center justify-end px-1">
              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="text-xs font-semibold text-secondary hover:text-secondary-fixed transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
              >
                <Headphones className="w-4 h-4" />
                <span>{t(lang, 'forgotPassword')}</span>
              </button>
            </div>

            {/* Primary Login Trigger */}
            <div className="pt-3 w-full">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[56px] py-3.5 bg-primary hover:bg-primary-fixed active:bg-primary-container text-on-primary font-display text-base font-bold rounded-full shadow-[0_10px_28px_-4px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t(lang, 'loggingIn')}</span>
                  </>
                ) : (
                  <>
                    <span>{t(lang, 'loginButton')}</span>
                    <LogIn className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Operational Shift Security Notice */}
          <div className="mt-7 w-full bg-surface-container-low border border-outline-variant/25 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t(lang, 'securityNotice')}
            </p>
          </div>
        </div>

        {/* Footer Version */}
        <footer className="text-center pt-2">
          <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant text-[11px] font-medium">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>{t(lang, 'footerVersion')}</span>
          </div>
        </footer>
      </div>

      {/* Branch Support Modal */}
      {showSupportModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-surface-container-high border border-outline-variant/40 p-5 space-y-4 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-on-surface">
                {t(lang, 'forgotModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {t(lang, 'forgotModalDesc')}
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`tel:${DEMO_COURIER.dispatcherPhone}`}
                className="w-full min-h-[48px] rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>{t(lang, 'callBranchSupport')}</span>
              </a>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-full min-h-[44px] rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold cursor-pointer"
              >
                {t(lang, 'close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
