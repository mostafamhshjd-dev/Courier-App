import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAuthSession,
  getAuthToken,
  getStoredCourier,
  isDemoSession,
  saveAuthSession,
  setUnauthorizedHandler,
  STORAGE_KEYS,
  webstackApi,
} from './config/api.js';
import {
  ActiveTab,
  CourierProfile,
  CustodySummary,
  GeoPoint,
  Language,
  ShipmentTask,
  ThemeMode,
} from './types/courier';
import {
  DEFAULT_CAIRO_COORDS,
  DEMO_COURIER,
  DEMO_CUSTODY,
  DEMO_TASKS,
} from './data/previewData';
import {
  extractAuthPayload,
  normalizeCustodyResponse,
  normalizeShipment,
  normalizeTasksResponse,
} from './utils/apiAdapters';
import { t } from './i18n/translations';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { ToastBanner, ToastMessage } from './components/ToastBanner';
import {
  OutcomeBottomSheet,
  OutcomeSubmissionPayload,
} from './components/OutcomeBottomSheet';
import { LoginScreen } from './screens/LoginScreen';
import { TasksScreen } from './screens/TasksScreen';
import { ShipmentDetailsScreen } from './screens/ShipmentDetailsScreen';
import { CustodyScreen } from './screens/CustodyScreen';
import { SmartMapScreen } from './screens/SmartMapScreen';
import { ProfileScreen } from './screens/ProfileScreen';

function playFeedbackChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LANG) === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getAuthToken()));
  const [isDemo, setIsDemo] = useState<boolean>(() => isDemoSession());
  const [courier, setCourier] = useState<CourierProfile>(() => getStoredCourier() || DEMO_COURIER);

  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [shiftActive, setShiftActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIFT_ACTIVE);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [tasks, setTasks] = useState<ShipmentTask[]>(DEMO_TASKS);
  const [custody, setCustody] = useState<CustodySummary>(DEMO_CUSTODY);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [custodyLoading, setCustodyLoading] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState<ShipmentTask | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState<ShipmentTask | null>(null);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);

  const [courierLocation, setCourierLocation] = useState<GeoPoint>(DEFAULT_CAIRO_COORDS);
  const [gpsIsLive, setGpsIsLive] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const lastLocationSyncRef = useRef<number>(0);

  const notify = useCallback(
    (text: string, variant: 'success' | 'info' | 'error' = 'success') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: Date.now(), text, variant });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 3400);
    },
    []
  );

  // Sync HTML dir/lang & dark class
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F8FAFC');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Register global 401 handler -> clears token and returns to Login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      setIsDemo(false);
      setSelectedShipment(null);
      setOutcomeTarget(null);
      notify(t(lang, 'sessionExpired'), 'error');
    });
    return () => setUnauthorizedHandler(null);
  }, [lang, notify]);

  // Fetch tasks from GET /courier/tasks.php
  const loadTasks = useCallback(async () => {
    if (isDemo) return;
    setTasksLoading(true);
    try {
      const raw = await webstackApi.getTasks();
      const parsed = normalizeTasksResponse(raw);
      setTasks(parsed.tasks);
      if (parsed.cashCustody !== undefined) {
        setCustody((prev) => ({ ...prev, totalCodCash: parsed.cashCustody as number }));
      }
      if (parsed.completedToday !== undefined || parsed.totalToday !== undefined) {
        setCourier((prev) => ({
          ...prev,
          completedToday: parsed.completedToday ?? prev.completedToday,
          totalToday: parsed.totalToday ?? prev.totalToday,
        }));
      }
    } catch (err) {
      if ((err as { status?: number })?.status !== 401) {
        notify(
          lang === 'ar' ? 'تعذر تحديث قائمة المهام من الخادم' : 'Could not refresh tasks from server',
          'error'
        );
      }
    } finally {
      setTasksLoading(false);
    }
  }, [isDemo, lang, notify]);

  // Fetch custody from GET /courier/custody.php
  const loadCustody = useCallback(async () => {
    if (isDemo) return;
    setCustodyLoading(true);
    try {
      const raw = await webstackApi.getCustody();
      setCustody(normalizeCustodyResponse(raw));
    } catch (err) {
      if ((err as { status?: number })?.status !== 401) {
        notify(
          lang === 'ar' ? 'تعذر تحميل بيانات العهدة' : 'Could not load custody summary',
          'error'
        );
      }
    } finally {
      setCustodyLoading(false);
    }
  }, [isDemo, lang, notify]);

  // Load initial data after sign in
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isDemo) {
      setTasks(DEMO_TASKS);
      setCustody(DEMO_CUSTODY);
      return;
    }
    loadTasks();
    loadCustody();
  }, [isAuthenticated, isDemo, loadTasks, loadCustody]);

  // Live GPS Watch + periodic POST /courier/location.php when shiftActive is ON
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const sendCoordsIfDue = (pt: GeoPoint) => {
      if (!shiftActive || isDemo) return;
      const now = Date.now();
      if (now - lastLocationSyncRef.current < 20000) return;
      lastLocationSyncRef.current = now;
      webstackApi
        .sendLocation({
          lat: pt.lat,
          lng: pt.lng,
          accuracy: pt.accuracy,
          heading: pt.heading,
          speed: pt.speed,
          timestamp: new Date(pt.timestamp).toISOString(),
        })
        .catch(() => {
          // Silent retry on next interval
        });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setCourierLocation(pt);
        setGpsIsLive(true);
        sendCoordsIfDue(pt);
      },
      () => {
        setGpsIsLive(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isAuthenticated, shiftActive, isDemo]);

  // Login Handler -> POST /auth/login.php
  const handleLoginSubmit = async (identifier: string, password: string) => {
    const raw = await webstackApi.login(identifier, password);
    const { token, courier: profile } = extractAuthPayload(raw);
    if (!token) {
      throw new Error(
        lang === 'ar'
          ? 'لم يتم استلام رمز المصادقة من الخادم'
          : 'Authentication token not returned by server'
      );
    }
    saveAuthSession(token, profile, false);
    setCourier(profile);
    setIsDemo(false);
    setIsAuthenticated(true);
    setActiveTab('tasks');
    notify(
      lang === 'ar' ? `مرحباً يا ${profile.name}` : `Welcome back, ${profile.name}`,
      'success'
    );
  };

  const handleDemoLogin = () => {
    saveAuthSession('demo-preview-token', DEMO_COURIER, true);
    setCourier(DEMO_COURIER);
    setTasks(DEMO_TASKS);
    setCustody(DEMO_CUSTODY);
    setIsDemo(true);
    setIsAuthenticated(true);
    setActiveTab('tasks');
    notify(
      lang === 'ar'
        ? 'تم تفعيل وضع المعاينة التجريبي بجميع الشاشات'
        : 'Interactive demo preview activated',
      'info'
    );
  };

  // Logout Handler -> POST /auth/logout.php
  const handleLogout = async () => {
    if (!isDemo) {
      try {
        await webstackApi.logout();
      } catch {
        // Proceed with local sign-out even if offline
      }
    }
    clearAuthSession();
    setIsAuthenticated(false);
    setIsDemo(false);
    setSelectedShipment(null);
    setOutcomeTarget(null);
    setActiveTab('tasks');
  };

  const handleToggleShift = () => {
    setShiftActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.SHIFT_ACTIVE, String(next));
      } catch {
        // ignore
      }
      if (next && !isDemo) {
        webstackApi
          .sendLocation({
            lat: courierLocation.lat,
            lng: courierLocation.lng,
            accuracy: courierLocation.accuracy,
            heading: courierLocation.heading,
            timestamp: new Date().toISOString(),
          })
          .catch(() => {});
      }
      notify(
        next
          ? lang === 'ar'
            ? 'تم تفعيل الشفت وإرسال الموقع الحي'
            : 'Shift started — live GPS sync enabled'
          : lang === 'ar'
            ? 'تم إيقاف تتبع الشفت مؤقتاً'
            : 'Shift GPS sync paused',
        'info'
      );
      return next;
    });
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(next));
      } catch {
        // ignore
      }
      if (next) playFeedbackChime();
      return next;
    });
  };

  // Open Shipment Details -> calls GET /courier/shipment_details.php
  const handleOpenShipmentDetails = async (shipment: ShipmentTask) => {
    setSelectedShipment(shipment);
    if (isDemo) return;
    setDetailsLoading(true);
    try {
      const raw = await webstackApi.getShipmentDetails(shipment.id, shipment.trackingNumber);
      const data = raw?.data ?? raw?.shipment ?? raw;
      if (data && typeof data === 'object') {
        const fresh = normalizeShipment(data);
        setSelectedShipment({ ...shipment, ...fresh });
      }
    } catch {
      // Keep existing task data cleanly if detail endpoint fails
    } finally {
      setDetailsLoading(false);
    }
  };

  // Submit Delivery Outcome -> calls POST /courier/update_status.php
  const handleOutcomeSubmit = async (payload: OutcomeSubmissionPayload) => {
    setOutcomeSubmitting(true);
    try {
      if (!isDemo) {
        await webstackApi.updateShipmentStatus(payload as unknown as Record<string, unknown>);
      }

      // Optimistically update local tasks & custody state
      setTasks((prev) =>
        prev.map((item) => {
          if (item.id !== payload.shipment_id) return item;
          return {
            ...item,
            status: payload.status,
            category:
              payload.status === 'full_return' || payload.status === 'postponed'
                ? 'returns'
                : item.category,
          };
        })
      );

      if (payload.status === 'delivered' || payload.status === 'partial_return') {
        const collected = payload.collected_amount || 0;
        setCustody((prev) => {
          const nextParcels = [...prev.pendingParcels];
          if (payload.status === 'partial_return') {
            nextParcels.unshift({
              id: `ret-${Date.now()}`,
              trackingNumber: `${payload.tracking_number}-R`,
              type: 'partial_return',
              typeLabelAr: 'مرتجع جزئي -R',
              typeLabelEn: 'Partial Return -R',
              summaryAr: `${payload.returned_pieces || 1} قطعة مرتجعة (${payload.reason || ''})`,
              summaryEn: `${payload.returned_pieces || 1} piece(s) returned`,
              metaAr: `المحصّل: ${collected} ج.م`,
              metaEn: `Collected: ${collected} EGP`,
              pieces: payload.returned_pieces || 1,
            });
          }
          return {
            ...prev,
            totalCodCash: prev.totalCodCash + collected,
            successfulOrders: prev.successfulOrders + 1,
            pendingParcels: nextParcels,
          };
        });
        setCourier((prev) => ({
          ...prev,
          completedToday: prev.completedToday + 1,
        }));
      } else if (payload.status === 'full_return' || payload.status === 'postponed') {
        setCustody((prev) => ({
          ...prev,
          pendingParcels: [
            {
              id: `ret-${Date.now()}`,
              trackingNumber:
                payload.status === 'full_return'
                  ? `${payload.tracking_number}-R`
                  : payload.tracking_number,
              type: payload.status === 'full_return' ? 'full_return' : 'postponed',
              typeLabelAr:
                payload.status === 'full_return' ? 'مرتجع كلي - رفض استلام' : 'مؤجل بطلب العميل',
              typeLabelEn: payload.status === 'full_return' ? 'Full Return' : 'Postponed',
              summaryAr: payload.reason || 'طرد معلق للمخزن',
              summaryEn: payload.reason || 'Pending warehouse parcel',
              metaAr: `رقم الشحنة #${payload.tracking_number}`,
              metaEn: `Waybill #${payload.tracking_number}`,
              pieces: payload.returned_pieces || 1,
            },
            ...prev.pendingParcels,
          ],
        }));
      }

      if (soundEnabled) playFeedbackChime();
      notify(t(lang, 'outcomeSavedToast'), 'success');
      setOutcomeTarget(null);
      setSelectedShipment(null);

      if (!isDemo) {
        loadTasks();
        loadCustody();
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : lang === 'ar'
            ? 'تعذر حفظ نتيجة التسليم، حاول مرة أخرى'
            : 'Failed to save outcome, please retry';
      notify(msg, 'error');
    } finally {
      setOutcomeSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <ToastBanner toast={toast} />
        <LoginScreen
          lang={lang}
          onToggleLanguage={setLang}
          onLoginSubmit={handleLoginSubmit}
          onDemoLogin={handleDemoLogin}
        />
      </>
    );
  }

  const pendingTaskCount = tasks.filter((item) => item.status !== 'delivered').length;

  const headerTitle = selectedShipment
    ? t(lang, 'titleDetails')
    : activeTab === 'tasks'
      ? t(lang, 'titleTasks')
      : activeTab === 'map'
        ? t(lang, 'titleMap')
        : activeTab === 'custody'
          ? t(lang, 'titleCustody')
          : t(lang, 'titleProfile');

  return (
    <div className="min-h-dvh w-full bg-surface text-on-surface flex flex-col">
      <ToastBanner toast={toast} />

      <AppHeader
        title={headerTitle}
        courier={courier}
        lang={lang}
        shiftActive={shiftActive}
        isDemo={isDemo}
        showBack={Boolean(selectedShipment)}
        onBack={() => setSelectedShipment(null)}
        onAvatarClick={() => {
          setSelectedShipment(null);
          setActiveTab('profile');
        }}
      />

      <main className="flex-1 w-full pt-15">
        {selectedShipment ? (
          <ShipmentDetailsScreen
            shipment={selectedShipment}
            lang={lang}
            loading={detailsLoading}
            onOpenOutcomeSheet={() => setOutcomeTarget(selectedShipment)}
          />
        ) : activeTab === 'tasks' ? (
          <TasksScreen
            courier={courier}
            tasks={tasks}
            cashCustody={custody.totalCodCash}
            courierLocation={courierLocation}
            shiftActive={shiftActive}
            loading={tasksLoading}
            lang={lang}
            onToggleShift={handleToggleShift}
            onRefresh={loadTasks}
            onSelectShipment={handleOpenShipmentDetails}
          />
        ) : activeTab === 'map' ? (
          <SmartMapScreen
            tasks={tasks}
            courierLocation={courierLocation}
            gpsIsLive={gpsIsLive}
            lang={lang}
            theme={theme}
            onOpenShipmentDetails={handleOpenShipmentDetails}
            onOpenOutcomeDirect={(shipment) => setOutcomeTarget(shipment)}
            onNotify={notify}
          />
        ) : activeTab === 'custody' ? (
          <CustodyScreen
            custody={custody}
            lang={lang}
            loading={custodyLoading}
            onRefresh={loadCustody}
          />
        ) : (
          <ProfileScreen
            courier={courier}
            lang={lang}
            theme={theme}
            shiftActive={shiftActive}
            soundEnabled={soundEnabled}
            onChangeLanguage={setLang}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            onToggleShift={handleToggleShift}
            onToggleSound={handleToggleSound}
            onLogout={handleLogout}
          />
        )}
      </main>

      {!selectedShipment && (
        <BottomNav
          activeTab={activeTab}
          lang={lang}
          pendingCount={pendingTaskCount}
          onChange={(tab) => {
            setSelectedShipment(null);
            setActiveTab(tab);
          }}
        />
      )}

      {/* Shared Record Delivery Outcome Bottom Sheet (accessible from Shipment Details & Smart Map Live Navigation) */}
      <OutcomeBottomSheet
        open={Boolean(outcomeTarget)}
        shipment={outcomeTarget}
        lang={lang}
        submitting={outcomeSubmitting}
        onClose={() => setOutcomeTarget(null)}
        onSubmit={handleOutcomeSubmit}
        onNotify={notify}
      />
    </div>
  );
}
