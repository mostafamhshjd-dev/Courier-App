/**
 * Haversine distance formula in kilometers between two GPS coordinates.
 */
export function calculateHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance cleanly for Arabic or English UI.
 */
export function formatDistance(km: number | null | undefined, lang: 'ar' | 'en'): string {
  if (km === null || km === undefined || Number.isNaN(km)) {
    return lang === 'ar' ? '--' : '--';
  }
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return lang === 'ar' ? `${meters} م` : `${meters} m`;
  }
  const rounded = km.toFixed(1);
  return lang === 'ar' ? `${rounded} كم` : `${rounded} km`;
}

/**
 * Estimate urban courier ETA in minutes from distance in km.
 */
export function estimateMinutes(km: number): number {
  const avgUrbanSpeedKmH = 22;
  return Math.max(2, Math.round((km / avgUrbanSpeedKmH) * 60));
}

/**
 * Normalize phone numbers for WhatsApp https://wa.me/ links (defaults Egypt +20 if starting with 01).
 */
export function formatWhatsAppUrl(phone: string): string {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  if (!digits) return 'https://wa.me/';
  if (digits.startsWith('+')) {
    return `https://wa.me/${digits.slice(1)}`;
  }
  if (digits.startsWith('00')) {
    return `https://wa.me/${digits.slice(2)}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `https://wa.me/2${digits}`;
  }
  return `https://wa.me/${digits}`;
}

/**
 * Build Google Maps external navigation link.
 */
export function buildGoogleMapsUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  fallbackAddress?: string
): string {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  const query = encodeURIComponent(fallbackAddress || 'Cairo, Egypt');
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
