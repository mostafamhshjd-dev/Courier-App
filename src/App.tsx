import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearAuthSession,
  getAuthToken,
  getStoredCourier,
  saveAuthSession,
  setUnauthorizedHandler,
  STORAGE_KEYS,
  webstackApi,
} from './config/api.js';
import {
  ActiveTab,
  CourierProfile,
  CustodyParcel,
  CustodySummary,
  GeoPoint,
  Language,
  ShipmentTask,
  ThemeMode,
} from './types/courier';
import {
  DEFAULT_CAIRO_COORDS,
  DEMO_COURIER,
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
import {
  PickupBatchScreen,
  PickupConfirmActionPayload,
} from './screens/PickupBatchScreen';
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

  const [tasks, setTasks] = useState<ShipmentTask[]>([]);
  const [custody, setCustody] = useState<CustodySummary>({
    totalCodCash: 0,
    shiftLabelAr: 'الوردية الحالية',
    shiftLabelEn: 'Current Shift',
    successfulOrders: 0,
    electronicPaidAmount: 0,
    shippingFeesAmount: 0,
    deadlineTimeAr: '07:00 م',
    deadlineTimeEn: '07:00 PM',
    masterBarcode: 'MASTER-EOD',
    shiftNumber: '--',
    lastUpdatedAr: 'جاري التحديث...',
    lastUpdatedEn: 'Syncing...',
    pendingParcels: [],
  });
  const [tasksLoading, setTasksLoading] = useState(false);
  const [custodyLoading, setCustodyLoading] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState<ShipmentTask | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState<ShipmentTask | null>(null);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [confirmingPickupId, setConfirmingPickupId] = useState<string | null>(null);
  const [focusedMapTaskId, setFocusedMapTaskId] = useState<string | null>(null);

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
      setSelectedShipment(null);
      setOutcomeTarget(null);
      notify(t(lang, 'sessionExpired'), 'error');
    });
    return () => setUnauthorizedHandler(null);
  }, [lang, notify]);

  // Fetch tasks from GET /courier/tasks.php
  const loadTasks = useCallback(async () => {
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
  }, [lang, notify]);

  // Fetch custody from GET /courier/custody.php
  const loadCustody = useCallback(async () => {
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
  }, [lang, notify]);

  // Load initial data after sign in
  useEffect(() => {
    if (!isAuthenticated) return;
    loadTasks();
    loadCustody();
  }, [isAuthenticated, loadTasks, loadCustody]);

  // Live GPS Watch + periodic POST /courier/location.php when shiftActive is ON
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const sendCoordsIfDue = (pt: GeoPoint) => {
      if (!shiftActive) return;
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
  }, [isAuthenticated, shiftActive]);

  // Login Handler -> POST /auth/login.php
  const handleLoginSubmit = async (identifier: string, password: string) => {
    const raw = await webstackApi.login(identifier, password);
    const { token, courier: profile } = extractAuthPayload(raw);
    if (!token) {
      const err = new Error(
        lang === 'ar'
          ? 'لم يتم استلام رمز المصادقة من الخادم'
          : 'Authentication token not returned by server'
      ) as Error & { status?: number; rawText?: string; url?: string };
      err.status = raw?.__httpStatus ?? 200;
      err.rawText = raw?.__rawText ?? (raw ? JSON.stringify(raw) : '');
      err.url = raw?.__url ?? '/api/v1/auth/login.php';
      throw err;
    }
    saveAuthSession(token, profile, false);
    setCourier(profile);
    setIsAuthenticated(true);
    setActiveTab('tasks');
    notify(
      lang === 'ar' ? `مرحباً يا ${profile.name}` : `Welcome back, ${profile.name}`,
      'success'
    );
  };

  // Logout Handler -> POST /auth/logout.php
  const handleLogout = async () => {
    try {
      await webstackApi.logout();
    } catch {
      // Proceed with local sign-out even if offline
    }
    clearAuthSession();
    setIsAuthenticated(false);
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
      if (next) {
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
      await webstackApi.updateShipmentStatus(payload as unknown as Record<string, unknown>);

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

      loadTasks();
      loadCustody();
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

  // Confirm Pickup Order / Batch -> POST /courier/update_status.php (status_id = 5, received_via = 'qr' | 'manual')
  const handleConfirmPickup = async ({
    task,
    receivedVia,
    waybills,
  }: PickupConfirmActionPayload) => {
    setConfirmingPickupId(task.id);
    const confirmedTrackingNumbers = waybills.map((w) => w.trackingNumber);
    const confirmedIds = waybills.map((w) => w.id);

    try {
      await webstackApi.confirmPickup({
        shipment_id: task.isPickupBatch ? undefined : task.id,
        id: task.isPickupBatch ? task.batchId ?? task.id : task.id,
        batch_id: task.batchId,
        pickup_batch_id: task.batchId,
        tracking_number: task.trackingNumber,
        tracking_numbers: confirmedTrackingNumbers,
        shipment_ids: confirmedIds,
        received_count: waybills.length,
        received_via: receivedVia,
        is_batch: task.isPickupBatch ? 1 : 0,
      });

      const applyConfirmed = (item: ShipmentTask): ShipmentTask => {
        if (item.id !== task.id) return item;
        const nextWaybills = (item.batchShipments || waybills).map((w) =>
          confirmedTrackingNumbers.includes(w.trackingNumber)
            ? {
                ...w,
                status: 'picked_up',
                statusId: 5,
                received: true,
                receivedVia,
              }
            : w
        );
        return {
          ...item,
          status: 'picked_up',
          statusId: 5,
          receivedVia,
          statusLabel:
            lang === 'ar'
              ? 'بيك أب في عهدتي — مطلوب تسليمها للمخزن'
              : 'Pickup In My Custody — Handover to Warehouse',
          batchShipments: nextWaybills,
        };
      };

      setTasks((prev) => prev.map(applyConfirmed));
      setSelectedShipment((prev) => (prev && prev.id === task.id ? applyConfirmed(prev) : prev));

      if (soundEnabled) playFeedbackChime();
      notify(t(lang, 'pickupConfirmedToast'), 'success');
      loadTasks();
      loadCustody();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : lang === 'ar'
            ? 'تعذر تأكيد استلام أمر البيك أب، حاول مرة أخرى'
            : 'Could not confirm pickup, please retry';
      notify(msg, 'error');
    } finally {
      setConfirmingPickupId(null);
    }
  };

  const handleOpenTaskOnMap = useCallback(
    (task: ShipmentTask) => {
      if (task.lat === null || task.lng === null) {
        notify(
          lang === 'ar'
            ? 'لا تتوفر إحداثيات GPS لهذا التاجر حالياً'
            : 'No GPS coordinates available for this merchant yet',
          'info'
        );
        return;
      }
      setSelectedShipment(null);
      setFocusedMapTaskId(task.id);
      setActiveTab('map');
    },
    [lang, notify]
  );

  // Merge confirmed status_id = 5 pickup orders into Custody parcels automatically.
  // Status 4 (awaiting pickup) is NEVER included; once warehouse receives them (status 6 / removed by server), they vanish automatically.
  const effectiveCustody = useMemo<CustodySummary>(() => {
    const existingTracking = new Set(
      custody.pendingParcels.map((p) => p.trackingNumber.toUpperCase())
    );
    const confirmedPickups: CustodyParcel[] = [];

    tasks.forEach((task) => {
      if (task.category !== 'pickup') return;
      const isInCourierCustody =
        task.statusId === 5 || task.status === 'picked_up' || task.status === 'in_custody';
      if (!isInCourierCustody) return;

      const code = task.batchCode || task.trackingNumber;
      if (existingTracking.has(code.toUpperCase())) return;
      existingTracking.add(code.toUpperCase());

      const count = Math.max(
        task.shipmentsCount ?? 0,
        task.batchShipments?.length ?? 0,
        task.itemsCount ?? 1
      );

      confirmedPickups.push({
        id: `pickup-custody-${task.id}`,
        trackingNumber: code,
        type: 'pickup_in_custody',
        typeLabelAr: 'بيك أب في عهدتي — مطلوب للمخزن',
        typeLabelEn: 'Pickup In Custody — Warehouse Due',
        summaryAr: `${count} شحنة مستلمة من التاجر (${task.merchantName || task.customerName})`,
        summaryEn: `${count} shipment(s) picked up from ${task.merchantName || task.customerName}`,
        metaAr:
          task.receivedVia === 'qr'
            ? 'تم الاستلام عبر مسح QR • مطلوب تسليمها للمخزن'
            : 'مطلوب تسليمها لأمين المخزن (حالة 5)',
        metaEn:
          task.receivedVia === 'qr'
            ? 'Received via QR scan • Handover to warehouse'
            : 'Pending warehouse handover (Status 5)',
        pieces: count,
      });
    });

    return {
      ...custody,
      pendingParcels: [...confirmedPickups, ...custody.pendingParcels],
    };
  }, [custody, tasks]);

  if (!isAuthenticated) {
    return (
      <>
        <ToastBanner toast={toast} />
        <LoginScreen
          lang={lang}
          onToggleLanguage={setLang}
          onLoginSubmit={handleLoginSubmit}
        />
      </>
    );
  }

  const pendingTaskCount = tasks.filter(
    (item) => item.category === 'pickup' || (item.status !== 'delivered' && item.statusId !== 8)
  ).length;

  const headerTitle = selectedShipment
    ? selectedShipment.category === 'pickup'
      ? t(lang, 'titlePickupBatch')
      : t(lang, 'titleDetails')
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
        showBack={Boolean(selectedShipment)}
        onBack={() => setSelectedShipment(null)}
        onAvatarClick={() => {
          setSelectedShipment(null);
          setActiveTab('profile');
        }}
      />

      <main className="flex-1 w-full pt-15">
        {selectedShipment ? (
          selectedShipment.category === 'pickup' ? (
            <PickupBatchScreen
              batch={selectedShipment}
              lang={lang}
              loading={detailsLoading}
              submitting={confirmingPickupId === selectedShipment.id}
              onOpenOnMap={handleOpenTaskOnMap}
              onConfirmPickup={handleConfirmPickup}
            />
          ) : (
            <ShipmentDetailsScreen
              shipment={selectedShipment}
              lang={lang}
              loading={detailsLoading}
              onOpenOutcomeSheet={() => setOutcomeTarget(selectedShipment)}
            />
          )
        ) : activeTab === 'tasks' ? (
          <TasksScreen
            courier={courier}
            tasks={tasks}
            cashCustody={effectiveCustody.totalCodCash}
            courierLocation={courierLocation}
            shiftActive={shiftActive}
            loading={tasksLoading}
            lang={lang}
            onToggleShift={handleToggleShift}
            onRefresh={loadTasks}
            onSelectShipment={handleOpenShipmentDetails}
            onOpenOnMap={handleOpenTaskOnMap}
          />
        ) : activeTab === 'map' ? (
          <SmartMapScreen
            tasks={tasks}
            courierLocation={courierLocation}
            gpsIsLive={gpsIsLive}
            lang={lang}
            theme={theme}
            focusedTaskId={focusedMapTaskId}
            onClearFocusedTask={() => setFocusedMapTaskId(null)}
            onOpenShipmentDetails={handleOpenShipmentDetails}
            onOpenOutcomeDirect={(shipment) => setOutcomeTarget(shipment)}
            onNotify={notify}
          />
        ) : activeTab === 'custody' ? (
          <CustodyScreen
            custody={effectiveCustody}
            lang={lang}
            loading={custodyLoading}
            onRefresh={() => {
              loadTasks();
              loadCustody();
            }}
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
