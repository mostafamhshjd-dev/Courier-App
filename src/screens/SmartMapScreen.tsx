import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Banknote,
  CheckCircle2,
  Compass,
  Crosshair,
  ExternalLink,
  Hand,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import {
  GeoPoint,
  Language,
  MerchantReturnBatch,
  ShipmentTask,
  ThemeMode,
} from '../types/courier';
import { t } from '../i18n/translations';
import {
  buildGoogleMapsUrl,
  calculateHaversineKm,
  estimateMinutes,
  formatDistance,
} from '../utils/geo';

interface SmartMapScreenProps {
  tasks: ShipmentTask[];
  merchantReturnBatches?: MerchantReturnBatch[];
  courierLocation: GeoPoint;
  lang: Language;
  theme: ThemeMode;
  focusedTaskId?: string | null;
  onClearFocusedTask?: () => void;
  onOpenShipmentDetails: (shipment: ShipmentTask) => void;
  onOpenOutcomeDirect: (shipment: ShipmentTask) => void;
  onNotify: (message: string, variant?: 'success' | 'info' | 'error') => void;
}

type SelectionMode = 'auto' | 'manual';

interface OSRMRouteState {
  coords: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
  isFallback: boolean;
}

function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const SmartMapScreen: React.FC<SmartMapScreenProps> = ({
  tasks,
  merchantReturnBatches = [],
  courierLocation,
  lang,
  theme,
  focusedTaskId = null,
  onClearFocusedTask,
  onOpenShipmentDetails,
  onOpenOutcomeDirect,
  onNotify,
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('auto');
  const [manualShipmentId, setManualShipmentId] = useState<string | null>(null);
  const [navigatingShipmentId, setNavigatingShipmentId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [osrmRoute, setOsrmRoute] = useState<OSRMRouteState | null>(null);
  const [liveHeading, setLiveHeading] = useState<number>(0);
  const [headingUpEnabled, setHeadingUpEnabled] = useState<boolean>(true);
  const [navGpsPoint, setNavGpsPoint] = useState<GeoPoint | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const shipmentMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeGlowLayerRef = useRef<L.Polyline | null>(null);
  const routeMainLayerRef = useRef<L.Polyline | null>(null);
  const prevGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const initialFitDoneRef = useRef<boolean>(false);

  const activeCourierPos = navGpsPoint || courierLocation;
  const isNavigating = navigatingShipmentId !== null;

  // 1. Filter delivery shipments, active merchant pickups, and merchant return batches with valid coordinates
  const rankedShipments = useMemo(() => {
    const returnTargets: ShipmentTask[] = merchantReturnBatches.map((batch) => ({
      id: batch.id,
      trackingNumber: batch.batchCode,
      category: 'merchant_returns',
      status: batch.status,
      statusId: batch.statusId,
      isPickupBatch: true,
      batchId: batch.batchId,
      batchCode: batch.batchCode,
      shipmentsCount: batch.shipmentsCount,
      customerName: batch.merchantName,
      customerPhone: batch.merchantPhone,
      address: batch.address,
      district: '',
      lat: batch.lat,
      lng: batch.lng,
      codAmount: batch.cashToMerchant,
      isPrepaid: batch.cashToMerchant <= 0,
      merchantName: batch.merchantName,
      itemsSummary: `${batch.shipmentsCount}`,
      itemsCount: batch.totalPieces,
    }));

    return [...tasks, ...returnTargets]
      .filter(
        (item) =>
          (item.category === 'delivery' ||
            item.category === 'pickup' ||
            item.category === 'merchant_returns') &&
          item.status !== 'delivered' &&
          item.statusId !== 8 &&
          item.statusId !== 6 &&
          typeof item.lat === 'number' &&
          typeof item.lng === 'number' &&
          !Number.isNaN(item.lat) &&
          !Number.isNaN(item.lng)
      )
      .map((item) => ({
        shipment: item,
        distanceKm: calculateHaversineKm(
          activeCourierPos.lat,
          activeCourierPos.lng,
          item.lat as number,
          item.lng as number
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }));
  }, [tasks, merchantReturnBatches, activeCourierPos.lat, activeCourierPos.lng]);

  // Honor external focus request (e.g., tapping "فتح اللوكيشن على الخريطة" from Pickup or Merchant Return Batch)
  useEffect(() => {
    if (!focusedTaskId) return;
    const target = rankedShipments.find((r) => r.shipment.id === focusedTaskId);
    if (target) {
      setSelectionMode('manual');
      setManualShipmentId(target.shipment.id);
      if (mapInstanceRef.current && target.shipment.lat !== null && target.shipment.lng !== null) {
        mapInstanceRef.current.flyTo([target.shipment.lat, target.shipment.lng], 15, {
          duration: 0.7,
        });
        window.setTimeout(() => {
          const marker = shipmentMarkersRef.current.get(target.shipment.id);
          if (
            marker &&
            (target.shipment.category === 'pickup' ||
              target.shipment.category === 'merchant_returns')
          ) {
            marker.openPopup();
          }
        }, 450);
      }
    }
    onClearFocusedTask?.();
  }, [focusedTaskId, rankedShipments, onClearFocusedTask]);

  // Resolve currently focused shipment
  const selectedEntry = useMemo(() => {
    if (rankedShipments.length === 0) return null;
    if (navigatingShipmentId) {
      const navMatch = rankedShipments.find((r) => r.shipment.id === navigatingShipmentId);
      if (navMatch) return navMatch;
    }
    if (selectionMode === 'manual' && manualShipmentId) {
      const manualMatch = rankedShipments.find((r) => r.shipment.id === manualShipmentId);
      if (manualMatch) return manualMatch;
    }
    return rankedShipments[0];
  }, [rankedShipments, selectionMode, manualShipmentId, navigatingShipmentId]);

  // Track heading changes from courierLocation when not in active nav watch
  useEffect(() => {
    if (typeof activeCourierPos.heading === 'number' && !Number.isNaN(activeCourierPos.heading)) {
      setLiveHeading(activeCourierPos.heading);
    } else if (prevGpsRef.current) {
      const movedKm = calculateHaversineKm(
        prevGpsRef.current.lat,
        prevGpsRef.current.lng,
        activeCourierPos.lat,
        activeCourierPos.lng
      );
      if (movedKm > 0.008) {
        setLiveHeading(
          computeBearingDeg(
            prevGpsRef.current.lat,
            prevGpsRef.current.lng,
            activeCourierPos.lat,
            activeCourierPos.lng
          )
        );
      }
    }
    prevGpsRef.current = { lat: activeCourierPos.lat, lng: activeCourierPos.lng };
  }, [activeCourierPos.lat, activeCourierPos.lng, activeCourierPos.heading]);

  // 2. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [activeCourierPos.lat, activeCourierPos.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      courierMarkerRef.current = null;
      shipmentMarkersRef.current.clear();
      routeGlowLayerRef.current = null;
      routeMainLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Free keyless OpenStreetMap tiles (never requires an API key)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
  }, [theme]);

  // 4. High-accuracy GPS watchPosition during Live Navigation Mode
  useEffect(() => {
    if (!isNavigating) {
      setNavGpsPoint(null);
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPt: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        setNavGpsPoint(nextPt);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([nextPt.lat, nextPt.lng], {
            animate: true,
            duration: 0.6,
          });
        }
      },
      () => {
        // Keep last known courier location cleanly without spamming errors
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 12000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating]);

  // 5. Fetch real OSRM driving route when entering Live Navigation Mode
  const fetchOsrmRoute = async (
    fromLat: number,
    fromLng: number,
    target: ShipmentTask
  ) => {
    const toLat = target.lat as number;
    const toLng = target.lng as number;
    setRouteLoading(true);

    // Point heading initially toward destination if no live GPS heading yet
    if (liveHeading === 0) {
      setLiveHeading(computeBearingDeg(fromLat, fromLng, toLat, toLng));
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OSRM failed');
      const json = await res.json();
      const route = json?.routes?.[0];
      const rawCoords: Array<[number, number]> = route?.geometry?.coordinates || [];

      if (rawCoords.length < 2) throw new Error('No geometry');

      // OSRM returns [lng, lat] -> Leaflet needs [lat, lng]
      const leafletCoords: Array<[number, number]> = rawCoords.map(([lng, lat]) => [lat, lng]);
      const distanceKm = (route.distance || 0) / 1000;
      const durationMin = Math.max(1, Math.round((route.duration || 0) / 60));

      setOsrmRoute({
        coords: leafletCoords,
        distanceKm,
        durationMin,
        isFallback: false,
      });

      if (mapInstanceRef.current) {
        const bounds = L.latLngBounds(leafletCoords);
        mapInstanceRef.current.fitBounds(bounds, {
          paddingTopLeft: [40, 110],
          paddingBottomRight: [40, 170],
          maxZoom: 16,
          animate: true,
        });
      }
    } catch {
      const distKm = calculateHaversineKm(fromLat, fromLng, toLat, toLng);
      setOsrmRoute({
        coords: [
          [fromLat, fromLng],
          [toLat, toLng],
        ],
        distanceKm: distKm,
        durationMin: estimateMinutes(distKm),
        isFallback: true,
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(
          L.latLngBounds([
            [fromLat, fromLng],
            [toLat, toLng],
          ]),
          { padding: [60, 130], maxZoom: 15, animate: true }
        );
      }
    } finally {
      setRouteLoading(false);
    }
  };

  // Start Live Navigation handler
  const handleStartNavigation = () => {
    if (!selectedEntry) return;
    setNavigatingShipmentId(selectedEntry.shipment.id);
    fetchOsrmRoute(activeCourierPos.lat, activeCourierPos.lng, selectedEntry.shipment);
  };

  // Exit Live Navigation handler
  const handleEndNavigation = () => {
    setNavigatingShipmentId(null);
    setOsrmRoute(null);
    if (mapInstanceRef.current && rankedShipments.length > 0) {
      const pts: Array<[number, number]> = [
        [activeCourierPos.lat, activeCourierPos.lng],
        ...rankedShipments.map(
          (r) => [r.shipment.lat as number, r.shipment.lng as number] as [number, number]
        ),
      ];
      mapInstanceRef.current.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: [40, 90],
        paddingBottomRight: [40, 220],
        maxZoom: 14,
        animate: true,
      });
    }
  };

  // 6. Render Courier Marker with Glowing Halo & Heading Direction Arrow
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const arrowRotation = headingUpEnabled && isNavigating ? 0 : liveHeading;

    const courierIcon = L.divIcon({
      className: 'ws-courier-pin-wrapper',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: `
        <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
          <div class="ws-pulse-ring" style="position:absolute;width:44px;height:44px;border-radius:9999px;background:rgba(16,185,129,0.28);"></div>
          <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:linear-gradient(135deg,#10B981,#0EA5E9);border:3px solid #0B1326;box-shadow:0 0 18px rgba(16,185,129,0.85);display:flex;align-items:center;justify-content:center;transform:rotate(${arrowRotation}deg);transition:transform 0.35s ease;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L19.5 20.5L12 16.5L4.5 20.5L12 2Z" />
            </svg>
          </div>
        </div>
      `,
    });

    if (!courierMarkerRef.current) {
      courierMarkerRef.current = L.marker([activeCourierPos.lat, activeCourierPos.lng], {
        icon: courierIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      courierMarkerRef.current.setLatLng([activeCourierPos.lat, activeCourierPos.lng]);
      courierMarkerRef.current.setIcon(courierIcon);
    }
  }, [activeCourierPos.lat, activeCourierPos.lng, liveHeading, headingUpEnabled, isNavigating]);

  // 7. Render Numbered Shipment Pins (1, 2, 3...) & Highlight Selected in Amber #F59E0B
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old pins
    shipmentMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    shipmentMarkersRef.current.clear();

    const visibleEntries = isNavigating && selectedEntry ? [selectedEntry] : rankedShipments;

    visibleEntries.forEach(({ shipment, rank, distanceKm }) => {
      const isSelected = selectedEntry?.shipment.id === shipment.id;
      const isMerchantPin =
        shipment.category === 'pickup' || shipment.category === 'merchant_returns';
      const isPickup = shipment.category === 'pickup';
      const distText = formatDistance(distanceKm, lang);
      const pickupCount =
        shipment.shipmentsCount ?? shipment.batchShipments?.length ?? shipment.itemsCount ?? 1;
      const codTag = isMerchantPin
        ? `${pickupCount} ${t(lang, 'shipmentUnit')}`
        : shipment.codAmount > 0 && !shipment.isPrepaid
          ? `${shipment.codAmount} ${t(lang, 'currency')}`
          : t(lang, 'prepaid');

      const pinHtml = isMerchantPin
        ? `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-86%);">
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              ${isSelected ? '<div class="ws-pulse-ring" style="position:absolute;width:52px;height:52px;border-radius:9999px;background:rgba(245,158,11,0.4);"></div>' : ''}
              <div style="position:relative;width:${isSelected ? 40 : 34}px;height:${isSelected ? 40 : 34}px;border-radius:12px;background:${isSelected ? '#F59E0B' : '#0F172A'};color:${isSelected ? '#1F1300' : '#F59E0B'};border:2.5px solid ${isSelected ? '#0B1326' : '#F59E0B'};box-shadow:0 6px 18px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
                  <path d="M2 7h20"/>
                </svg>
              </div>
              <span style="position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 4px;border-radius:9999px;background:#10B981;color:#022C22;font-family:Outfit,Cairo,sans-serif;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #0F172A;">
                ${pickupCount}
              </span>
            </div>
            <div style="margin-top:3px;padding:2px 8px;border-radius:9999px;background:rgba(15,23,42,0.94);border:1px solid rgba(245,158,11,0.65);color:#FCD34D;font-family:Cairo,sans-serif;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.45);">
              ${escapeHtml(shipment.merchantName || shipment.customerName)}
            </div>
          </div>
        `
        : isSelected
          ? `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-82%);">
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div class="ws-pulse-ring" style="position:absolute;width:48px;height:48px;border-radius:9999px;background:rgba(245,158,11,0.35);"></div>
              <div style="position:relative;width:38px;height:38px;border-radius:9999px;background:#F59E0B;color:#1F1300;border:3px solid #0B1326;box-shadow:0 0 22px rgba(245,158,11,0.85);font-family:Outfit,Cairo,sans-serif;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;">
                ${rank}
              </div>
            </div>
            <div style="width:3px;height:7px;background:#F59E0B;border-radius:0 0 4px 4px;margin-top:-1px;"></div>
            <div style="margin-top:3px;padding:2px 8px;border-radius:9999px;background:rgba(15,23,42,0.94);border:1px solid rgba(245,158,11,0.55);color:#FCD34D;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.45);">
              ${distText} • ${codTag}
            </div>
          </div>
        `
          : `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-78%);">
            <div style="width:30px;height:30px;border-radius:9999px;background:#1E293B;color:#F8FAFC;border:2px solid #10B981;box-shadow:0 4px 12px rgba(0,0,0,0.45);font-family:Outfit,Cairo,sans-serif;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;">
              ${rank}
            </div>
            <div style="margin-top:2px;padding:1px 6px;border-radius:9999px;background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.3);color:#CBD5E1;font-size:9px;font-weight:600;white-space:nowrap;">
              ${escapeHtml(shipment.district || `#${rank}`)}
            </div>
          </div>
        `;

      const icon = L.divIcon({
        className: 'ws-shipment-pin-wrapper',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: pinHtml,
      });

      const marker = L.marker([shipment.lat as number, shipment.lng as number], {
        icon,
        zIndexOffset: isSelected ? 700 : isMerchantPin ? 450 : 300 - rank,
      }).addTo(map);

      if (isMerchantPin) {
        const googleMapsHref = buildGoogleMapsUrl(shipment.lat, shipment.lng, shipment.address);
        const pinRoleLabel = isPickup
          ? t(lang, 'merchantPinLabel')
          : t(lang, 'merchantReturnPinLabel');
        const popupHtml = `
          <div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="min-width:210px;font-family:Cairo,system-ui,sans-serif;color:#0F172A;padding:2px 0;">
            <div style="font-size:11px;font-weight:700;color:#D97706;margin-bottom:2px;">
              ${escapeHtml(pinRoleLabel)} • ${pickupCount} ${escapeHtml(t(lang, 'shipmentUnit'))}
            </div>
            <div style="font-size:14px;font-weight:800;margin-bottom:4px;">
              ${escapeHtml(shipment.merchantName || shipment.customerName)}
            </div>
            ${
              shipment.address
                ? `<div style="font-size:12px;color:#475569;line-height:1.45;margin-bottom:8px;">${escapeHtml(shipment.address)}</div>`
                : ''
            }
            <a href="${escapeHtml(googleMapsHref)}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;padding:8px 10px;border-radius:10px;background:#10B981;color:#022C22;font-size:12px;font-weight:800;text-decoration:none;">
              ${escapeHtml(t(lang, 'navigateGoogleMaps'))}
            </a>
          </div>
        `;
        marker.bindPopup(popupHtml, { offset: [0, -28] });
      }

      marker.on('click', () => {
        if (isNavigating) return;
        setSelectionMode('manual');
        setManualShipmentId(shipment.id);
        if (isMerchantPin) {
          marker.openPopup();
        }
      });

      shipmentMarkersRef.current.set(shipment.id, marker);
    });

    // Fit map once on first load when shipments exist
    if (!initialFitDoneRef.current && rankedShipments.length > 0 && !isNavigating) {
      initialFitDoneRef.current = true;
      const pts: Array<[number, number]> = [
        [activeCourierPos.lat, activeCourierPos.lng],
        ...rankedShipments.map(
          (r) => [r.shipment.lat as number, r.shipment.lng as number] as [number, number]
        ),
      ];
      map.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: [40, 90],
        paddingBottomRight: [40, 230],
        maxZoom: 14,
      });
    }
  }, [rankedShipments, selectedEntry, isNavigating, lang, activeCourierPos.lat, activeCourierPos.lng]);

  // 8. Draw Glowing OSRM Polyline (Active Nav) OR Dashed Guide Polyline (Selection Mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeGlowLayerRef.current) {
      map.removeLayer(routeGlowLayerRef.current);
      routeGlowLayerRef.current = null;
    }
    if (routeMainLayerRef.current) {
      map.removeLayer(routeMainLayerRef.current);
      routeMainLayerRef.current = null;
    }

    if (!selectedEntry) return;

    if (isNavigating && osrmRoute && osrmRoute.coords.length >= 2) {
      if (osrmRoute.isFallback) {
        routeMainLayerRef.current = L.polyline(osrmRoute.coords, {
          color: '#10B981',
          weight: 4,
          opacity: 0.9,
          dashArray: '8, 10',
          lineCap: 'round',
        }).addTo(map);
      } else {
        // Outer luminous glow line + crisp road core line
        routeGlowLayerRef.current = L.polyline(osrmRoute.coords, {
          color: '#10B981',
          weight: 12,
          opacity: 0.28,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        routeMainLayerRef.current = L.polyline(osrmRoute.coords, {
          color: '#34D399',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
      return;
    }

    // Standard Auto/Manual selection dashed amber/emerald guide line
    const targetLat = selectedEntry.shipment.lat as number;
    const targetLng = selectedEntry.shipment.lng as number;

    routeMainLayerRef.current = L.polyline(
      [
        [activeCourierPos.lat, activeCourierPos.lng],
        [targetLat, targetLng],
      ],
      {
        color: '#F59E0B',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 10',
        lineCap: 'round',
      }
    ).addTo(map);
  }, [
    selectedEntry,
    isNavigating,
    osrmRoute,
    activeCourierPos.lat,
    activeCourierPos.lng,
  ]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([activeCourierPos.lat, activeCourierPos.lng], isNavigating ? 16 : 14, {
      duration: 0.7,
    });
  };

  // Compute live remaining distance & ETA during Active Navigation
  const liveNavDistanceKm = useMemo(() => {
    if (!selectedEntry) return 0;
    const haversine = selectedEntry.distanceKm;
    if (osrmRoute && !osrmRoute.isFallback) {
      // As courier moves closer, keep route distance responsive to live GPS
      return Math.min(osrmRoute.distanceKm, Math.max(haversine, osrmRoute.distanceKm * 0.9));
    }
    return haversine;
  }, [selectedEntry, osrmRoute]);

  const liveNavEtaMin = useMemo(() => {
    if (osrmRoute && !osrmRoute.isFallback && osrmRoute.durationMin > 0) {
      return osrmRoute.durationMin;
    }
    return estimateMinutes(liveNavDistanceKm);
  }, [osrmRoute, liveNavDistanceKm]);

  const mapRotationStyle: React.CSSProperties =
    isNavigating && headingUpEnabled && liveHeading !== 0
      ? {
          transform: `rotate(${-liveHeading}deg) scale(1.42)`,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }
      : {
          transform: 'rotate(0deg) scale(1)',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        };

  return (
    <div className="relative w-full h-[calc(100dvh-8.25rem)] min-h-[540px] max-w-2xl mx-auto overflow-hidden bg-surface-container-lowest">
      {/* Leaflet Canvas (Supports smooth heading-up rotation during active navigation) */}
      <div className="w-full h-full overflow-hidden relative">
        <div
          ref={mapContainerRef}
          style={mapRotationStyle}
          className="w-full h-full"
        />
      </div>

      {/* TOP FLOATING HUD */}
      {isNavigating && selectedEntry ? (
        /* ACTIVE NAVIGATION COMPACT TOP HUD BAR */
        <div className="absolute top-3 inset-x-3 z-20 pointer-events-auto">
          <div className="rounded-2xl bg-surface-container-high/95 backdrop-blur-xl border border-primary/40 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                {routeLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-telemetry text-lg font-extrabold text-primary tabular-nums leading-none">
                    {formatDistance(liveNavDistanceKm, lang)}
                  </span>
                  <span className="text-xs font-bold text-secondary tabular-nums">
                    • {liveNavEtaMin} {lang === 'ar' ? 'دقيقة' : 'min'}
                  </span>
                </div>
                <span className="text-xs font-bold text-on-surface truncate mt-1">
                  {selectedEntry.shipment.customerName}
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  #{selectedEntry.shipment.trackingNumber} · {selectedEntry.shipment.district}
                </span>
              </div>
            </div>

            {/* Compass Heading-Up / North-Up Toggle */}
            <button
              type="button"
              onClick={() => {
                setHeadingUpEnabled((prev) => {
                  const next = !prev;
                  onNotify(
                    next
                      ? lang === 'ar'
                        ? 'تم تفعيل دوران الخريطة مع اتجاه الحركة'
                        : 'Heading-up map rotation enabled'
                      : lang === 'ar'
                        ? 'تم تثبيت اتجاه الشمال للخريطة'
                        : 'North-up map lock enabled',
                    'info'
                  );
                  return next;
                });
              }}
              title={lang === 'ar' ? 'تدوير مع الحركة' : 'Toggle heading-up rotation'}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition cursor-pointer shrink-0 ${
                headingUpEnabled
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-surface-container border-outline-variant/40 text-on-surface-variant'
              }`}
            >
              <Compass
                className="w-5 h-5 transition-transform"
                style={{ transform: `rotate(${liveHeading}deg)` }}
              />
            </button>
          </div>
        </div>
      ) : (
        /* AUTO NEAREST vs MANUAL SELECT FLOATING SWITCHER */
        <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center bg-surface-container-low/95 backdrop-blur-xl p-1 rounded-full border border-outline-variant/35 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <button
              type="button"
              onClick={() => {
                setSelectionMode('auto');
                setManualShipmentId(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectionMode === 'auto'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t(lang, 'modeAutoNearest')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectionMode('manual')}
              className={`flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectionMode === 'manual'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Hand className="w-3.5 h-3.5 shrink-0" />
              <span>{t(lang, 'modeManualSelect')}</span>
            </button>
          </div>

          {/* Floating "موقعي" My Location Button */}
          <button
            type="button"
            onClick={handleRecenter}
            aria-label={t(lang, 'myLocation')}
            title={t(lang, 'myLocation')}
            className="pointer-events-auto px-3 min-h-[44px] rounded-full bg-surface-container-low/95 backdrop-blur-xl text-primary border border-outline-variant/35 flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition hover:bg-surface-container-high cursor-pointer shrink-0"
          >
            <Crosshair className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">{t(lang, 'myLocation')}</span>
          </button>
        </div>
      )}

      {/* Re-center Button during Active Navigation */}
      {isNavigating && (
        <div className="absolute ltr:right-3 rtl:left-3 bottom-[228px] z-20 flex flex-col items-end gap-2 pointer-events-none">
          <button
            type="button"
            onClick={handleRecenter}
            aria-label={t(lang, 'myLocation')}
            className="pointer-events-auto w-11 h-11 rounded-full bg-surface-container-high/95 backdrop-blur-xl border border-primary/40 text-primary flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* BOTTOM FLOATING COCKPIT CARD */}
      <div className="absolute bottom-3 inset-x-3 z-20 pointer-events-auto">
        {!selectedEntry ? (
          <div className="rounded-2xl bg-surface-container-high/95 backdrop-blur-2xl p-4 border border-outline-variant/35 text-center text-sm text-on-surface-variant shadow-xl">
            {t(lang, 'noCoordsShipments')}
          </div>
        ) : isNavigating ? (
          /* ACTIVE NAVIGATION QUICK ACTION BAR */
          <div className="rounded-2xl bg-surface-container-high/95 backdrop-blur-2xl p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] border border-primary/35 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant px-0.5">
              <span className="truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                <span className="truncate">{selectedEntry.shipment.address}</span>
              </span>
              {selectedEntry.shipment.codAmount > 0 && !selectedEntry.shipment.isPrepaid && (
                <span className="font-telemetry font-bold text-secondary shrink-0 tabular-nums">
                  {selectedEntry.shipment.codAmount} {t(lang, 'currency')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Primary CTA: Arrived / Record Delivery -> Opens OutcomeBottomSheet */}
              <button
                type="button"
                onClick={() => onOpenOutcomeDirect(selectedEntry.shipment)}
                className="flex-1 min-h-[50px] px-3 rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-sm font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(16,185,129,0.35)] active:scale-[0.98] transition cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="truncate">
                  {lang === 'ar' ? 'وصلت / تسجيل التسليم' : 'Arrived / Record Delivery'}
                </span>
              </button>

              {/* Secondary: End Navigation */}
              <button
                type="button"
                onClick={handleEndNavigation}
                className="min-h-[50px] px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-error font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'إنهاء التوجيه' : 'End'}</span>
              </button>

              {/* Optional Small Icon: Open in Google Maps */}
              <a
                href={buildGoogleMapsUrl(
                  selectedEntry.shipment.lat,
                  selectedEntry.shipment.lng,
                  selectedEntry.shipment.address
                )}
                target="_blank"
                rel="noopener noreferrer"
                title={lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                aria-label={lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                className="w-12 h-[50px] rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-primary flex items-center justify-center active:scale-95 transition shrink-0"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>
        ) : (
          /* STANDARD SELECTED SHIPMENT CARD (AUTO OR MANUAL) */
          <div className="flex flex-col rounded-2xl bg-surface-container-high/95 backdrop-blur-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)] border border-outline-variant/35 transition-all">
            {/* Top Badge & Tracking Row */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-outline-variant/25">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 border tabular-nums ${
                  selectionMode === 'auto'
                    ? 'bg-primary/15 text-primary border-primary/25'
                    : 'bg-secondary/15 text-secondary border-secondary/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    selectionMode === 'auto' ? 'bg-primary' : 'bg-secondary'
                  }`}
                />
                <span>
                  {selectionMode === 'auto'
                    ? t(lang, 'nearestNowBadge', {
                        dist: formatDistance(selectedEntry.distanceKm, lang),
                      })
                    : t(lang, 'manualSelectedBadge', {
                        dist: formatDistance(selectedEntry.distanceKm, lang),
                      })}{' '}
                  {t(lang, 'etaMinutes', {
                    min: estimateMinutes(selectedEntry.distanceKm),
                  })}
                </span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-5 h-5 rounded-full bg-secondary text-on-secondary font-telemetry text-[11px] font-extrabold flex items-center justify-center">
                  {selectedEntry.rank}
                </span>
                <span
                  className="font-telemetry text-[11px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md tabular-nums"
                  dir="ltr"
                >
                  #{selectedEntry.shipment.trackingNumber}
                </span>
              </div>
            </div>

            {/* Merchant / Customer + Address + Count/COD Card */}
            <div className="flex items-start justify-between gap-3 py-3">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {selectedEntry.shipment.category === 'pickup' ||
                  selectedEntry.shipment.category === 'merchant_returns' ? (
                    <Store className="w-4 h-4 text-secondary shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <h2 className="font-display text-base font-bold text-on-surface truncate">
                    {selectedEntry.shipment.category === 'pickup' ||
                    selectedEntry.shipment.category === 'merchant_returns'
                      ? selectedEntry.shipment.merchantName || selectedEntry.shipment.customerName
                      : selectedEntry.shipment.customerName}
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant mt-1 leading-snug flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-outline shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{selectedEntry.shipment.address}</span>
                </p>
              </div>

              {selectedEntry.shipment.category === 'pickup' ||
              selectedEntry.shipment.category === 'merchant_returns' ? (
                <div className="flex flex-col items-end shrink-0 bg-secondary/15 border border-secondary/35 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-bold text-secondary">
                    {selectedEntry.shipment.category === 'pickup'
                      ? t(lang, 'merchantPinLabel')
                      : t(lang, 'merchantReturnPinLabel')}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-telemetry text-lg font-extrabold text-secondary leading-none tabular-nums">
                      {selectedEntry.shipment.shipmentsCount ??
                        selectedEntry.shipment.batchShipments?.length ??
                        selectedEntry.shipment.itemsCount ??
                        1}
                    </span>
                    <span className="text-[10px] font-bold text-secondary">
                      {t(lang, 'shipmentUnit')}
                    </span>
                  </div>
                </div>
              ) : selectedEntry.shipment.isPrepaid || selectedEntry.shipment.codAmount <= 0 ? (
                <div className="flex flex-col items-end shrink-0 bg-primary/15 border border-primary/30 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-bold text-primary">
                    {t(lang, 'prepaid')}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-primary mt-1" />
                </div>
              ) : (
                <div className="flex flex-col items-end shrink-0 bg-secondary/15 border border-secondary/35 px-3 py-1.5 rounded-xl">
                  <div className="flex items-center gap-1 text-secondary">
                    <Banknote className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">COD</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-telemetry text-lg font-extrabold text-secondary leading-none tabular-nums">
                      {selectedEntry.shipment.codAmount}
                    </span>
                    <span className="text-[10px] font-bold text-secondary">
                      {t(lang, 'currency')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: Responsive layout preventing clipping on mobile screens */}
            {selectedEntry.shipment.category === 'pickup' ||
            selectedEntry.shipment.category === 'merchant_returns' ? (
              <div className="flex flex-col gap-2 pt-0.5 w-full">
                <div className="flex items-center gap-2 w-full">
                  <a
                    href={buildGoogleMapsUrl(
                      selectedEntry.shipment.lat,
                      selectedEntry.shipment.lng,
                      selectedEntry.shipment.address
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(16,185,129,0.3)] active:scale-[0.98] transition"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(lang, 'navigateGoogleMaps')}</span>
                  </a>

                  <a
                    href={`tel:${selectedEntry.shipment.customerPhone}`}
                    aria-label={t(lang, 'call')}
                    className="w-11 h-[44px] rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-primary flex items-center justify-center active:scale-95 transition shrink-0"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

                {selectedEntry.shipment.category === 'pickup' && (
                  <button
                    type="button"
                    onClick={() => onOpenShipmentDetails(selectedEntry.shipment)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-on-surface text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                  >
                    <Package className="w-4 h-4 text-secondary shrink-0" />
                    <span className="truncate">{t(lang, 'reviewAndReceiveBatch')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-0.5 w-full">
                <button
                  type="button"
                  onClick={handleStartNavigation}
                  className="flex-1 min-w-0 min-h-[46px] px-3 rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(16,185,129,0.3)] active:scale-[0.98] transition cursor-pointer"
                >
                  <Navigation className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t(lang, 'startNavigation')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenShipmentDetails(selectedEntry.shipment)}
                  className="min-h-[46px] px-3 rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-on-surface text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0"
                >
                  <Package className="w-4 h-4 text-on-surface-variant shrink-0" />
                  <span className="whitespace-nowrap">{t(lang, 'shipmentDetailsBtn')}</span>
                </button>

                <a
                  href={`tel:${selectedEntry.shipment.customerPhone}`}
                  aria-label={t(lang, 'call')}
                  className="w-11 h-[46px] rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/35 text-primary flex items-center justify-center active:scale-95 transition shrink-0"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
