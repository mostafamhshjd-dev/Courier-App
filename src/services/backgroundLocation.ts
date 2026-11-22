import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location as BgLocation,
} from '@capacitor-community/background-geolocation';
import { webstackApi } from '../config/api.js';
import { GeoPoint } from '../types/courier';
import { calculateHaversineKm } from '../utils/geo';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

const MIN_INTERVAL_MS = 30_000; // 30 seconds
const MIN_DISTANCE_METERS = 50; // 50 meters

export interface SilentLocationHandle {
  stop: () => void;
}

/**
 * Starts continuous silent location reporting to /courier/location.php.
 * - On native Android (Capacitor): registers @capacitor-community/background-geolocation
 *   with a standard operational foreground notification so updates continue when minimized
 *   or closed.
 * - On Web / PWA fallback: uses browser geolocation watchPosition + 30s heartbeat.
 * Sends coordinates silently every 30s OR whenever courier moves >= 50 meters.
 */
export function startSilentLocationService(
  onPosition: (point: GeoPoint) => void
): SilentLocationHandle {
  let disposed = false;
  let nativeWatcherId: string | null = null;
  let webWatchId: number | null = null;
  let heartbeatTimer: number | null = null;

  let latestPoint: GeoPoint | null = null;
  let lastSentPoint: GeoPoint | null = null;
  let lastSentAt = 0;

  const pushToServerIfDue = (pt: GeoPoint, force = false) => {
    if (disposed) return;
    const now = Date.now();
    const elapsedMs = now - lastSentAt;
    const movedMeters = lastSentPoint
      ? calculateHaversineKm(lastSentPoint.lat, lastSentPoint.lng, pt.lat, pt.lng) * 1000
      : Infinity;

    if (!force && lastSentAt > 0 && elapsedMs < MIN_INTERVAL_MS && movedMeters < MIN_DISTANCE_METERS) {
      return;
    }

    lastSentAt = now;
    lastSentPoint = pt;

    webstackApi
      .sendLocation({
        lat: pt.lat,
        lng: pt.lng,
        accuracy: pt.accuracy,
        heading: pt.heading,
        speed: pt.speed,
        timestamp: new Date(pt.timestamp || now).toISOString(),
      })
      .catch(() => {
        // Silent retry on next cycle
      });
  };

  const handleIncomingPoint = (pt: GeoPoint) => {
    if (disposed) return;
    latestPoint = pt;
    onPosition(pt);
    pushToServerIfDue(pt, lastSentAt === 0);
  };

  const startWebFallback = () => {
    if (disposed) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    try {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          handleIncomingPoint({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        () => {
          // Silent failure — never show tracking warnings in UI
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10_000,
          timeout: 20_000,
        }
      );
    } catch {
      // Ignore geolocation errors in restricted contexts
    }
  };

  const startNativeWatcher = async () => {
    try {
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'WebStack للمناديب',
          backgroundMessage: 'متصل وجاهز لاستقبال أوامر الشحن',
          requestPermissions: true,
          stale: false,
          distanceFilter: MIN_DISTANCE_METERS,
        },
        (location?: BgLocation, error?: CallbackError) => {
          if (disposed || error || !location) return;
          handleIncomingPoint({
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            heading: location.bearing ?? null,
            speed: location.speed ?? null,
            timestamp: location.time || Date.now(),
          });
        }
      );

      if (disposed) {
        BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
        return;
      }
      nativeWatcherId = watcherId;
    } catch {
      // If plugin is unavailable on this runtime, fall back silently to browser geolocation
      startWebFallback();
    }
  };

  if (Capacitor.isNativePlatform()) {
    startNativeWatcher();
  } else {
    startWebFallback();
  }

  // Periodic 30-second silent heartbeat so stationary updates are still reported
  heartbeatTimer = window.setInterval(() => {
    if (disposed) return;
    if (latestPoint) {
      pushToServerIfDue(
        {
          ...latestPoint,
          timestamp: Date.now(),
        },
        false
      );
      return;
    }

    if (
      !Capacitor.isNativePlatform() &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator
    ) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleIncomingPoint({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        () => {
          // Silent
        },
        {
          enableHighAccuracy: true,
          maximumAge: 15_000,
          timeout: 10_000,
        }
      );
    }
  }, MIN_INTERVAL_MS);

  return {
    stop: () => {
      disposed = true;
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (webWatchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
      }
      if (nativeWatcherId !== null) {
        const idToRemove = nativeWatcherId;
        nativeWatcherId = null;
        BackgroundGeolocation.removeWatcher({ id: idToRemove }).catch(() => {});
      }
    },
  };
}
