import React from 'react';
import { ClipboardList, Compass, UserCheck, Wallet } from 'lucide-react';
import { ActiveTab, Language } from '../types/courier';
import { t } from '../i18n/translations';

interface BottomNavProps {
  activeTab: ActiveTab;
  lang: Language;
  pendingCount?: number;
  onChange: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  lang,
  pendingCount = 0,
  onChange,
}) => {
  const items: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      id: 'tasks',
      label: t(lang, 'navTasks'),
      icon: <ClipboardList className="w-5 h-5" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'map',
      label: t(lang, 'navMap'),
      icon: <Compass className="w-5 h-5" />,
    },
    {
      id: 'custody',
      label: t(lang, 'navCustody'),
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: t(lang, 'navProfile'),
      icon: <UserCheck className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-low/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-8px_28px_rgba(0,0,0,0.25)]"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4 items-center h-17 px-2">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-colors cursor-pointer ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-secondary text-on-secondary text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 whitespace-nowrap">{item.label}</span>
              {isActive && (
                <span className="w-5 h-0.5 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
