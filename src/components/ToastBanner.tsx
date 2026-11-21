import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'info' | 'error';
}

interface ToastBannerProps {
  toast: ToastMessage | null;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast }) => {
  if (!toast) return null;

  const styles =
    toast.variant === 'error'
      ? 'bg-error-container text-error border-error/40'
      : toast.variant === 'info'
        ? 'bg-surface-container-highest text-on-surface border-primary/40'
        : 'bg-primary text-on-primary border-primary-fixed/40';

  const Icon =
    toast.variant === 'error'
      ? AlertCircle
      : toast.variant === 'info'
        ? Info
        : CheckCircle2;

  return (
    <div className="fixed top-18 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div
        className={`max-w-md w-full px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 text-sm font-bold pointer-events-auto ${styles}`}
        role="status"
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="leading-snug">{toast.text}</span>
      </div>
    </div>
  );
};
