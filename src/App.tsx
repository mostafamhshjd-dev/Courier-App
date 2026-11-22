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
import { startSilentLocationService } from './services/backgroundLocation';

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
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
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
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const tasksBaselineReadyRef = useRef<boolean>(false);
  const tasksInFlightRef = useRef<boolean>(false);
  const custodyInFlightRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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

  // Track network connectivity for normal online/offline badge
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Fetch tasks from GET /courier/tasks.php (supports silent Smart Auto-Sync)
  const loadTasks = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (tasksInFlightRef.current) return;
      tasksInFlightRef.current = true;
      if (!silent) setTasksLoading(true);
      try {
        const raw = await webstackApi.getTasks();
        const parsed = normalizeTasksResponse(raw);

        // Detect newly assigned tasks after initial baseline load
        const incomingActive = parsed.tasks.filter(
          (item) =>
            item.category === 'pickup' || (item.status !== 'delivered' && item.statusId !== 8)
        );

        if (tasksBaselineReadyRef.current) {
          let newCount = 0;
          incomingActive.forEach((item) => {
            if (!knownTaskIdsRef.current.has(item.id)) {
              newCount += 1;
            }
          });
          if (newCount > 0) {
            try {
              if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate([120, 60, 120]);
              }
            } catch {
              // Ignore vibration restrictions
            }
            if (soundEnabledRef.current) {
              playFeedbackChime();
            }
            notify(
              newCount === 1
                ? t(lang, 'newTaskArrived')
                : t(lang, 'newTasksArrived', { count: newCount }),
              'info'
            );
          }
        } else {
          tasksBaselineReadyRef.current = true;
        }

        knownTaskIdsRef.current = new Set(parsed.tasks.map((item) => item.id));
        setTasks(parsed.tasks);

        // Keep currently viewed shipment/pickup batch in sync with latest server data
        setSelectedShipment((prev) => {
          if (!prev) return prev;
          const updated = parsed.tasks.find((item) => item.id === prev.id);
          return updated ? { ...prev, ...updated } : prev;
        });

        if (parsed.cashCustody !== undefined) {
          setCustody((prev) => ({ ...prev, totalCodCash: parsed.cashCustody as number }));
        }

        if (
          parsed.completedToday !== undefined ||
          parsed.totalToday !== undefined ||
          parsed.branchName
        ) {
          setCourier((prev) => {
            const nextCourier: CourierProfile = {
              ...prev,
              completedToday: parsed.completedToday ?? prev.completedToday,
              totalToday: parsed.totalToday ?? prev.totalToday,
              branch: parsed.branchName || prev.branch,
            };
            if (parsed.branchName && parsed.branchName !== prev.branch) {
              saveAuthSession(getAuthToken(), nextCourier, false);
            }
            return nextCourier;
          });
        }
      } catch (err) {
        if (!silent && (err as { status?: number })?.status !== 401) {
          notify(
            lang === 'ar'
              ? 'تعذر تحديث قائمة المهام من الخادم'
              : 'Could not refresh tasks from server',
            'error'
          );
        }
      } finally {
        tasksInFlightRef.current = false;
        if (!silent) setTasksLoading(false);
      }
    },
    [lang, notify]
  );

  // Fetch custody from GET /courier/custody.php (supports silent Smart Auto-Sync)
  const loadCustody = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (custodyInFlightRef.current) return;
      custodyInFlightRef.current = true;
      if (!silent) setCustodyLoading(true);
      try {
        const raw = await webstackApi.getCustody();
        setCustody(normalizeCustodyResponse(raw));
      } catch (err) {
        if (!silent && (err as { status?: number })?.status !== 401) {
          notify(
            lang === 'ar' ? 'تعذر تحميل بيانات العهدة' : 'Could not load custody summary',
            'error'
          );
        }
      } finally {
        custodyInFlightRef.current = false;
        if (!silent) setCustodyLoading(false);
      }
    },
    [lang, notify]
  );

  // Smart Auto-Sync:
  // - Initial load on sign in
  // - Silent 10s polling ONLY while app is visible (pauses when visibilityState === 'hidden')
  // - Immediate silent sync on visibilitychange (visible), window focus, and network online
  useEffect(() => {
    if (!isAuthenticated) {
      tasksBaselineReadyRef.current = false;
      knownTaskIdsRef.current = new Set();
      return;
    }

    loadTasks();
    loadCustody();

    let pollTimer: number | null = null;

    const triggerSilentSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadTasks({ silent: true });
      loadCustody({ silent: true });
    };

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadTasks({ silent: true });
          loadCustody({ silent: true });
        }
      }, 10_000);
    };

    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSilentSync();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleFocus = () => {
      triggerSilentSync();
      if (document.visibilityState === 'visible') {
        startPolling();
      }
    };

    const handleOnline = () => {
      triggerSilentSync();
      if (document.visibilityState === 'visible') {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, loadTasks, loadCustody]);

  // Always-on silent Background Geolocation service (Android foreground service + 30s / 50m updates)
  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = startSilentLocationService((point) => {
      setCourierLocation(point);
    });
    return () => {
      handle.stop();
    };
  }, [isAuthenticated]);

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

      loadTasks({ silent: true });
      loadCustody({ silent: true });
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

  // Finalize Pickup Order / Batch -> POST /api/v1/courier/pickup_receive.php
  // Supports full receive or partial receive with permanent cancellation of unreceived shipments
  const handleConfirmPickup = async ({
    task,
    receivedVia,
    waybills,
    unreceivedWaybills,
    cancelUnreceived,
  }: PickupConfirmActionPayload) => {
    setConfirmingPickupId(task.id);
    const confirmedTrackingNumbers = waybills.map((w) => w.trackingNumber);
    const confirmedIds = waybills.map((w) => w.id);
    const unreceivedIds = unreceivedWaybills.map((w) => w.id);
    const resolvedBatchId = task.batchId ?? task.id.replace(/^batch-/, '');

    try {
      await webstackApi.finalizePickup({
        action: 'finalize_pickup',
        cancel_unreceived: cancelUnreceived,
        batch_id: resolvedBatchId,
        pickup_batch_id: resolvedBatchId,
        shipment_id: task.isPickupBatch ? undefined : task.id,
        id: task.isPickupBatch ? resolvedBatchId : task.id,
        tracking_number: task.trackingNumber,
        received_shipment_ids: confirmedIds,
        received_tracking_numbers: confirmedTrackingNumbers,
        unreceived_shipment_ids: unreceivedIds,
        shipment_ids: confirmedIds,
        tracking_numbers: confirmedTrackingNumbers,
        received_count: waybills.length,
        cancelled_count: unreceivedWaybills.length,
        received_via: receivedVia,
        is_batch: task.isPickupBatch ? 1 : 0,
      });

      const applyConfirmed = (item: ShipmentTask): ShipmentTask => {
        if (item.id !== task.id) return item;
        // Retain ONLY received waybills (cancelled/unreceived shipments are removed)
        const nextWaybills = (item.batchShipments || waybills)
          .filter((w) => confirmedTrackingNumbers.includes(w.trackingNumber))
          .map((w) => ({
            ...w,
            status: 'picked_up',
            statusId: 5,
            received: true,
            receivedVia,
          }));

        return {
          ...item,
          status: 'picked_up',
          statusId: 5,
          receivedVia,
          shipmentsCount: nextWaybills.length || waybills.length,
          itemsCount: nextWaybills.length || waybills.length,
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
      notify(
        cancelUnreceived && unreceivedWaybills.length > 0
          ? t(lang, 'partialPickupConfirmedToast', {
              received: waybills.length,
              cancelled: unreceivedWaybills.length,
            })
          : t(lang, 'pickupConfirmedToast'),
        'success'
      );
      loadTasks({ silent: true });
      loadCustody({ silent: true });
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
            ? 'لا تتوفر إحداثيات موقع لهذا التاجر حالياً'
            : 'No location coordinates available for this merchant yet',
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
        isOnline={isOnline}
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
            isOnline={isOnline}
            loading={tasksLoading}
            lang={lang}
            onRefresh={() => {
              loadTasks();
              loadCustody({ silent: true });
            }}
            onSelectShipment={handleOpenShipmentDetails}
            onOpenOnMap={handleOpenTaskOnMap}
          />
        ) : activeTab === 'map' ? (
          <SmartMapScreen
            tasks={tasks}
            courierLocation={courierLocation}
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
              loadTasks({ silent: true });
              loadCustody();
            }}
          />
        ) : (
          <ProfileScreen
            courier={courier}
            lang={lang}
            theme={theme}
            soundEnabled={soundEnabled}
            onChangeLanguage={setLang}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
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
