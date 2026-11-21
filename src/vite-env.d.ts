/// <reference types="vite/client" />

declare module '../config/api.js' {
  export const API_BASE_URL: string;
  export const STORAGE_KEYS: {
    TOKEN: string;
    COURIER: string;
    DEMO_MODE: string;
    THEME: string;
    LANG: string;
    SHIFT_ACTIVE: string;
    SOUND_ENABLED: string;
  };
  export function setUnauthorizedHandler(handler: (() => void) | null): void;
  export function getAuthToken(): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getStoredCourier(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function saveAuthSession(token: string, courier: any, isDemo?: boolean): void;
  export function isDemoSession(): boolean;
  export function clearAuthSession(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function apiRequest(endpoint: string, options?: any): Promise<any>;
  export const webstackApi: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    login: (identifier: string, password: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logout: () => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getTasks: (params?: Record<string, string | number | undefined>) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getShipmentDetails: (shipmentId: string, trackingNumber?: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateShipmentStatus: (payload: Record<string, unknown>) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCustody: () => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendLocation: (coords: Record<string, unknown>) => Promise<any>;
  };
}
