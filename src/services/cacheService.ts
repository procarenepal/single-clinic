// src/services/cacheService.ts
import { Page } from "@/types/models";

interface CacheEntry<T> {
  data: T;
  etag: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface NavigationCacheData {
  navItems: any[];
  userRole: string;
  clinicId: string;
  userId: string;
  isMultiBranchEnabled?: boolean;
  isBillingEnabled?: boolean;
}

interface UserPermissionsData {
  accessiblePages: Page[];
  pagePermissions: Map<string, boolean>;
  pathToPageIdMap: Map<string, string>;
}

// Lightweight record types for common lists
type ByClinicKey = string; // `${entity}:${clinicId}`
type ByClinicDoctorKey = string; // `${entity}:${clinicId}:${doctorId}`

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PERMISSIONS_TTL = 10 * 60 * 1000; // 10 minutes for permissions
  private readonly STORAGE_PREFIX = "procaresoft-cache:";
  private readonly LIST_TTL = 3 * 60 * 1000; // 3 minutes for data lists

  private isStorageAvailable(): boolean {
    try {
      if (typeof window === "undefined" || !("localStorage" in window))
        return false;
      const testKey = "__cache_test__";

      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);

      return true;
    } catch {
      return false;
    }
  }

  private storageSet(key: string, value: any) {
    if (!this.isStorageAvailable()) return;
    try {
      window.localStorage.setItem(
        `${this.STORAGE_PREFIX}${key}`,
        JSON.stringify(value),
      );
    } catch {}
  }

  private storageGet<T = any>(key: string): T | null {
    if (!this.isStorageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);

      if (!raw) return null;

      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private storageDelete(key: string) {
    if (!this.isStorageAvailable()) return;
    try {
      window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
    } catch {}
  }

  /**
   * Generate ETag from data
   */
  private generateETag(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);

      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Generate cache key for navigation data
   */
  private generateNavigationCacheKey(
    userId: string,
    clinicId: string,
    role: string,
  ): string {
    return `nav:${userId}:${clinicId}:${role}`;
  }

  /**
   * Generate cache key for user permissions
   */
  private generatePermissionsCacheKey(
    userId: string,
    clinicId: string,
  ): string {
    return `permissions:${userId}:${clinicId}`;
  }

  /**
   * Generate cache key for clinic pages
   */
  private generateClinicPagesCacheKey(clinicId: string): string {
    return `clinic_pages:${clinicId}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValidCacheEntry(entry: CacheEntry<any>): boolean {
    const now = Date.now();

    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Get navigation data from cache
   */
  getNavigationCache(
    userId: string,
    clinicId: string,
    role: string,
  ): NavigationCacheData | null {
    const key = this.generateNavigationCacheKey(userId, clinicId, role);
    const entry = this.cache.get(key);

    if (!entry || !this.isValidCacheEntry(entry)) {
      return null;
    }

    return entry.data;
  }

  /**
   * Set navigation data in cache
   */
  setNavigationCache(
    userId: string,
    clinicId: string,
    role: string,
    data: NavigationCacheData,
    ttl: number = this.DEFAULT_TTL,
  ): string {
    const key = this.generateNavigationCacheKey(userId, clinicId, role);
    const etag = this.generateETag(data);

    const entry: CacheEntry<NavigationCacheData> = {
      data,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);

    return etag;
  }

  /**
   * Check if navigation data has changed by comparing ETags
   */
  hasNavigationChanged(
    userId: string,
    clinicId: string,
    role: string,
    clientETag: string,
  ): boolean {
    const key = this.generateNavigationCacheKey(userId, clinicId, role);
    const entry = this.cache.get(key);

    if (!entry || !this.isValidCacheEntry(entry)) {
      return true; // Cache miss or expired, assume changed
    }

    return entry.etag !== clientETag;
  }

  /**
   * Invalidate navigation cache for a user
   */
  invalidateNavigationCache(
    userId: string,
    clinicId: string,
    role: string,
  ): void {
    const key = this.generateNavigationCacheKey(userId, clinicId, role);

    this.cache.delete(key);
    this.storageDelete(key);
  }

  /**
   * Invalidate all navigation caches for a clinic
   */
  invalidateClinicNavigationCache(clinicId: string): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.includes(`:${clinicId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.storageDelete(key);
    });
  }

  /**
   * Cache user permissions data
   */
  setUserPermissions(
    userId: string,
    clinicId: string,
    data: UserPermissionsData,
    ttl: number = this.PERMISSIONS_TTL,
  ): string {
    const key = this.generatePermissionsCacheKey(userId, clinicId);
    const etag = this.generateETag(data);

    const entry: CacheEntry<UserPermissionsData> = {
      data: {
        ...data,
        // Maps are kept as Maps in memory
        pagePermissions: new Map(data.pagePermissions),
        pathToPageIdMap: new Map(data.pathToPageIdMap),
      },
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);

    // Persist to storage as plain objects
    this.storageSet(key, {
      etag,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      data: {
        accessiblePages: data.accessiblePages,
        pagePermissions: Array.from(data.pagePermissions.entries()),
        pathToPageIdMap: Array.from(data.pathToPageIdMap.entries()),
      },
    });

    return etag;
  }

  /**
   * Get cached user permissions data
   */
  getUserPermissions(
    userId: string,
    clinicId: string,
  ): UserPermissionsData | null {
    const key = this.generatePermissionsCacheKey(userId, clinicId);
    const entry = this.cache.get(key);

    if (entry) {
      // Check if expired
      if (Date.now() - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
      } else {
        return entry.data;
      }
    }

    // Try to hydrate from storage if memory miss or expired
    const stored = this.storageGet<{
      etag: string;
      timestamp: number;
      ttl: number;
      data: {
        accessiblePages: Page[];
        pagePermissions: [string, boolean][];
        pathToPageIdMap: [string, string][];
      };
    }>(key);

    if (!stored) return null;

    if (Date.now() - stored.timestamp >= stored.ttl) {
      return null;
    }

    const hydrated: CacheEntry<UserPermissionsData> = {
      etag: stored.etag,
      timestamp: stored.timestamp,
      ttl: stored.ttl,
      data: {
        accessiblePages: stored.data.accessiblePages,
        pagePermissions: new Map(stored.data.pagePermissions),
        pathToPageIdMap: new Map(stored.data.pathToPageIdMap),
      },
    };

    this.cache.set(key, hydrated);

    return hydrated.data;
  }

  /**
   * Cache clinic pages (available pages for a clinic)
   */
  setClinicPages(
    clinicId: string,
    pages: Page[],
    ttl: number = this.PERMISSIONS_TTL,
  ): string {
    const key = this.generateClinicPagesCacheKey(clinicId);
    const etag = this.generateETag(pages);

    const entry: CacheEntry<Page[]> = {
      data: pages,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, {
      etag,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      data: pages,
    });

    return etag;
  }

  /**
   * Get cached clinic pages
   */
  getClinicPages(clinicId: string): Page[] | null {
    const key = this.generateClinicPagesCacheKey(clinicId);
    const entry = this.cache.get(key);

    if (entry) {
      // Check if expired
      if (Date.now() - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
      } else {
        return entry.data;
      }
    }

    // Try hydration from storage
    const stored = this.storageGet<{
      etag: string;
      timestamp: number;
      ttl: number;
      data: Page[];
    }>(key);

    if (!stored) return null;
    if (Date.now() - stored.timestamp >= stored.ttl) return null;

    const hydrated: CacheEntry<Page[]> = {
      etag: stored.etag,
      timestamp: stored.timestamp,
      ttl: stored.ttl,
      data: stored.data,
    };

    this.cache.set(key, hydrated);

    return hydrated.data;
  }

  /**
   * Check if user has permission for a specific page (from cache)
   */
  hasPagePermissionCached(
    userId: string,
    clinicId: string,
    pageId: string,
  ): boolean | null {
    const permissions = this.getUserPermissions(userId, clinicId);

    if (!permissions) return null;

    return permissions.pagePermissions.get(pageId) ?? false;
  }

  /**
   * Get page ID by path (from cache)
   */
  getPageIdByPath(
    userId: string,
    clinicId: string,
    path: string,
  ): string | null {
    const permissions = this.getUserPermissions(userId, clinicId);

    if (!permissions) return null;

    return permissions.pathToPageIdMap.get(path) ?? null;
  }

  /**
   * Clear user permissions cache (useful when user role changes)
   */
  clearUserPermissions(userId: string, clinicId: string): void {
    const key = this.generatePermissionsCacheKey(userId, clinicId);
    this.cache.delete(key);

    // Also invalidate any navigation caches for this user
    const navPrefix = `nav:${userId}:${clinicId}:`;
    const keysToDelete: string[] = [key]; // include the permissions key for storage deletion
    
    this.cache.forEach((_, cacheKey) => {
      if (cacheKey.startsWith(navPrefix)) {
        keysToDelete.push(cacheKey);
        this.cache.delete(cacheKey);
      }
    });

    // Remove from localStorage if available
    if (this.isStorageAvailable()) {
      try {
        keysToDelete.forEach(k => {
          window.localStorage.removeItem(`${this.STORAGE_PREFIX}${k}`);
        });
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Clear clinic pages cache
   */
  clearClinicPages(clinicId: string): void {
    const key = this.generateClinicPagesCacheKey(clinicId);

    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
    if (this.isStorageAvailable()) {
      try {
        const prefix = this.STORAGE_PREFIX;

        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);

          if (key && key.startsWith(prefix)) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // Ignore storage cleanup errors
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp >= entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  // -------- Generic helpers for list caching (patients, doctors, appointments, types) --------

  private makeClinicKey(entity: string, clinicId: string): ByClinicKey {
    return `${entity}:${clinicId}`;
  }

  private makeClinicDoctorKey(
    entity: string,
    clinicId: string,
    doctorId: string,
  ): ByClinicDoctorKey {
    return `${entity}:${clinicId}:${doctorId}`;
  }

  // Patients by clinic
  setClinicPatients(
    clinicId: string,
    patients: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicKey("patients", clinicId);
    const etag = this.generateETag(patients);
    const entry: CacheEntry<any[]> = {
      data: patients,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicPatients(clinicId: string): any[] | null {
    const key = this.makeClinicKey("patients", clinicId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  // Invalidate clinic patients cache
  invalidateClinicPatients(clinicId: string): void {
    const key = this.makeClinicKey("patients", clinicId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {}
    }
  }

  // Invalidate doctor patients cache
  invalidateDoctorPatients(clinicId: string, doctorId: string): void {
    const key = this.makeClinicDoctorKey("patients_doctor", clinicId, doctorId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {}
    }
  }

  // Patients by doctor
  setDoctorPatients(
    clinicId: string,
    doctorId: string,
    patients: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicDoctorKey("patients_doctor", clinicId, doctorId);
    const etag = this.generateETag(patients);
    const entry: CacheEntry<any[]> = {
      data: patients,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getDoctorPatients(clinicId: string, doctorId: string): any[] | null {
    const key = this.makeClinicDoctorKey("patients_doctor", clinicId, doctorId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  // Doctors by clinic
  setClinicDoctors(
    clinicId: string,
    doctors: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicKey("doctors", clinicId);
    const etag = this.generateETag(doctors);
    const entry: CacheEntry<any[]> = {
      data: doctors,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicDoctors(clinicId: string): any[] | null {
    const key = this.makeClinicKey("doctors", clinicId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  invalidateClinicDoctors(clinicId: string): void {
    const key = this.makeClinicKey("doctors", clinicId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {
        // Ignore storage cleanup errors
      }
    }
  }

  // Referral Partners by clinic
  setClinicReferralPartners(
    clinicId: string,
    partners: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicKey("referral_partners", clinicId);
    const etag = this.generateETag(partners);
    const entry: CacheEntry<any[]> = {
      data: partners,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicReferralPartners(clinicId: string): any[] | null {
    const key = this.makeClinicKey("referral_partners", clinicId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  invalidateClinicReferralPartners(clinicId: string): void {
    const key = this.makeClinicKey("referral_partners", clinicId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {
        // Ignore storage cleanup errors
      }
    }
  }

  // Appointment types by clinic
  setClinicAppointmentTypes(
    clinicId: string,
    types: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicKey("appointment_types", clinicId);
    const etag = this.generateETag(types);
    const entry: CacheEntry<any[]> = {
      data: types,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicAppointmentTypes(clinicId: string): any[] | null {
    const key = this.makeClinicKey("appointment_types", clinicId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  invalidateClinicAppointmentTypes(clinicId: string): void {
    const key = this.makeClinicKey("appointment_types", clinicId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {
        // Ignore storage cleanup errors
      }
    }
  }

  // Appointments by clinic
  setClinicAppointments(
    clinicId: string,
    appointments: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicKey("appointments", clinicId);
    const etag = this.generateETag(appointments);
    const entry: CacheEntry<any[]> = {
      data: appointments,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicAppointments(clinicId: string): any[] | null {
    const key = this.makeClinicKey("appointments", clinicId);
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  invalidateClinicAppointments(clinicId: string): void {
    const key = this.makeClinicKey("appointments", clinicId);

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {}
    }
  }

  // Appointments by clinic + doctor
  setClinicDoctorAppointments(
    clinicId: string,
    doctorId: string,
    appointments: any[],
    ttl: number = this.LIST_TTL,
  ) {
    const key = this.makeClinicDoctorKey(
      "appointments_doctor",
      clinicId,
      doctorId,
    );
    const etag = this.generateETag(appointments);
    const entry: CacheEntry<any[]> = {
      data: appointments,
      etag,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.storageSet(key, entry);

    return etag;
  }

  getClinicDoctorAppointments(
    clinicId: string,
    doctorId: string,
  ): any[] | null {
    const key = this.makeClinicDoctorKey(
      "appointments_doctor",
      clinicId,
      doctorId,
    );
    const mem = this.cache.get(key);

    if (mem) {
      if (this.isValidCacheEntry(mem)) return mem.data;
      this.cache.delete(key);
    }
    const stored = this.storageGet<CacheEntry<any[]>>(key);

    if (!stored) return null;
    if (!this.isValidCacheEntry(stored)) return null;
    this.cache.set(key, stored);

    return stored.data;
  }

  invalidateClinicDoctorAppointments(clinicId: string, doctorId: string): void {
    const key = this.makeClinicDoctorKey(
      "appointments_doctor",
      clinicId,
      doctorId,
    );

    this.cache.delete(key);
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      } catch {}
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Auto cleanup every 10 minutes
setInterval(
  () => {
    cacheService.cleanup();
  },
  10 * 60 * 1000,
);
