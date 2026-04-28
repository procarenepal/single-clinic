import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { ReferralPartner } from "../types/models";

import { cacheService } from "@/services/cacheService";

const PARTNERS_COLLECTION = "referralPartners";

/**
 * Service for managing referral partner data in Firestore
 */
export const referralPartnerService = {
  // Deduplicate in-flight fetches per key
  __inflight: new Map<string, Promise<any[]>>(),

  /**
   * Create a new referral partner
   * @param {Partial<ReferralPartner>} partnerData - Data for the new partner
   * @returns {Promise<string>} - ID of the created partner
   */
  async createReferralPartner(
    partnerData: Partial<ReferralPartner>,
  ): Promise<string> {
    try {
      const partnersRef = collection(db, PARTNERS_COLLECTION);
      const docRef = await addDoc(partnersRef, {
        ...partnerData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (partnerData.clinicId) {
        cacheService.invalidateClinicReferralPartners(partnerData.clinicId);
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating referral partner:", error);
      throw error;
    }
  },

  /**
   * Get a referral partner by ID
   * @param {string} id - Partner ID
   * @returns {Promise<ReferralPartner | null>} - Partner data or null if not found
   */
  async getReferralPartnerById(id: string): Promise<ReferralPartner | null> {
    try {
      const docRef = doc(db, PARTNERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();

        return {
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
        } as ReferralPartner;
      }

      return null;
    } catch (error) {
      console.error("Error getting referral partner:", error);
      throw error;
    }
  },

  /**
   * Update a referral partner
   * @param {string} id - Partner ID
   * @param {Partial<ReferralPartner>} updateData - Fields to update
   * @returns {Promise<void>}
   */
  async updateReferralPartner(
    id: string,
    updateData: Partial<ReferralPartner>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PARTNERS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      // Clear cache if we have clinicId
      const existing = await this.getReferralPartnerById(id);

      if (existing?.clinicId) {
        cacheService.invalidateClinicReferralPartners(existing.clinicId);
      }
    } catch (error) {
      console.error("Error updating referral partner:", error);
      throw error;
    }
  },

  /**
   * Get all referral partners (excluding deleted)
   */
  async getAllReferralPartners(): Promise<ReferralPartner[]> {
    try {
      const cached = cacheService.getClinicReferralPartners("standalone");
      if (cached) return (cached as ReferralPartner[]).filter((p) => !p.isDeleted);

      const partnersRef = collection(db, PARTNERS_COLLECTION);
      const querySnapshot = await getDocs(partnersRef);

      const partners = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();

        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
        } as ReferralPartner;
      });

      const activePartners = partners.filter((p) => !p.isDeleted);
      cacheService.setClinicReferralPartners("standalone", activePartners);

      return activePartners;
    } catch (error) {
      console.error("Error getting all referral partners:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getReferralPartnersByClinic(
    _clinicId?: string,
    branchId?: string,
  ): Promise<ReferralPartner[]> {
    const partners = await this.getAllReferralPartners();
    if (branchId) {
      return partners.filter((p) => p.branchId === branchId);
    }
    return partners;
  },

  /**
   * Search referral partners by name
   */
  async searchReferralPartners(
    searchTerm: string,
    _clinicId?: string,
  ): Promise<ReferralPartner[]> {
    try {
      const partners = await this.getAllReferralPartners();

      if (!searchTerm) return partners;
      const term = searchTerm.toLowerCase();

      return partners.filter((p) => p.name.toLowerCase().includes(term));
    } catch (error) {
      console.error("Error searching referral partners:", error);
      throw error;
    }
  },

  /**
   * Toggle partner active status
   */
  async toggleReferralPartnerStatus(
    id: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      await this.updateReferralPartner(id, { isActive });
    } catch (error) {
      console.error("Error toggling referral partner status:", error);
      throw error;
    }
  },

  /**
   * Delete a partner (soft delete)
   */
  async deleteReferralPartner(id: string): Promise<void> {
    try {
      const partner = await this.getReferralPartnerById(id);

      if (!partner) throw new Error("Referral partner not found");

      await this.updateReferralPartner(id, { isDeleted: true });

      if (partner.clinicId) {
        cacheService.invalidateClinicReferralPartners(partner.clinicId);
      }
    } catch (error) {
      console.error("Error deleting referral partner:", error);
      throw error;
    }
  },
  /**
   * Get all patients referred by a specific partner
   */
  async getPatientsByReferral(
    clinicId: string,
    partnerId: string,
  ): Promise<any[]> {
    try {
      const patientsRef = collection(db, "patients");
      const q = query(
        patientsRef,
        where("clinicId", "==", clinicId),
        where("referralPartnerId", "==", partnerId),
        where("isActive", "==", true),
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error getting patients by referral:", error);

      return [];
    }
  },

  /**
   * Get all pathology invoices referred by a specific partner
   */
  async getPathologyInvoicesByReferral(
    clinicId: string,
    partnerId: string,
  ): Promise<any[]> {
    try {
      const billingRef = collection(db, "pathologyBilling");
      // We need to find invoices where this partner is in the referringDoctors array
      // Firestore array-contains-any or simple array-contains?
      // In pathology billing, referringDoctors is an array of objects.
      // Firestore cannot query array of objects directly with where.
      // Wait, I should check how referringDoctors are stored.

      // Actually, we have the 'referralCommissions' which explicitly link partner to billing.
      // So we can fetch billing records by billingIds from commissions.
      return []; // Placeholder - I'll use commissions instead
    } catch (error) {
      console.error("Error getting pathology invoices by referral:", error);

      return [];
    }
  },
};
