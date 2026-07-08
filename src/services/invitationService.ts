import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

import { db } from "../config/firebase";
import { Invitation } from "../types/models";

const INVITATIONS_COLLECTION = "invitations";

/**
 * Service for managing clinic invitations
 */
export const invitationService = {
  /**
   * Create a new invitation
   * @param {string} email - Email to invite
   * @param {string} clinicId - Clinic ID
   * @param {string} role - Role to assign
   * @param {string} invitedBy - User ID who created invitation
   * @returns {Promise<string>} - ID of the created invitation
   */
  async createInvitation(
    email: string,
    clinicId: string,
    role: string,
    invitedBy: string,
  ): Promise<string> {
    try {
      // Check if there's an active invitation for this email and clinic
      const invitationsRef = collection(db, INVITATIONS_COLLECTION);
      const q = query(
        invitationsRef,
        where("email", "==", email),

        where("status", "==", "pending"),
      );
      const existingInvites = await getDocs(q);

      if (!existingInvites.empty) {
        // There's already a pending invitation
        return existingInvites.docs[0].id;
      }

      // Create a new invitation
      const expiryDate = new Date();

      expiryDate.setDate(expiryDate.getDate() + 7); // Expire after 7 days

      const invitationData = {
        id: uuidv4(),
        email,
        clinicId,
        role,
        status: "pending",
        invitedBy,
        invitedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiryDate),
      };

      const docRef = doc(db, INVITATIONS_COLLECTION, invitationData.id);

      await setDoc(docRef, invitationData);

      return invitationData.id;
    } catch (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }
  },

  /**
   * Get invitation by ID
   * @param {string} id - Invitation ID
   * @returns {Promise<Invitation | null>} - Invitation data or null if not found
   */
  async getInvitationById(id: string): Promise<Invitation | null> {
    try {
      const docRef = doc(db, INVITATIONS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          invitedAt: data.invitedAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          acceptedAt: data.acceptedAt?.toDate() || undefined,
        } as Invitation;
      }

      return null;
    } catch (error) {
      console.error("Error getting invitation:", error);
      throw error;
    }
  },

  /**
   * Get all pending invitations for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Invitation[]>} - Array of pending invitations
   */
  async getPendingInvitationsByClinic(clinicId: string): Promise<Invitation[]> {
    try {
      const invitationsRef = collection(db, INVITATIONS_COLLECTION);
      const q = query(
        invitationsRef,

        where("status", "==", "pending"),
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          invitedAt: data.invitedAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          acceptedAt: data.acceptedAt?.toDate() || undefined,
        } as Invitation;
      });
    } catch (error) {
      console.error("Error getting clinic invitations:", error);
      throw error;
    }
  },

  /**
   * Get all invitations by email address
   * @param {string} email - Email address
   * @returns {Promise<Invitation[]>} - Array of invitations
   */
  async getInvitationsByEmail(email: string): Promise<Invitation[]> {
    try {
      const invitationsRef = collection(db, INVITATIONS_COLLECTION);
      const q = query(
        invitationsRef,
        where("email", "==", email),
        where("status", "==", "pending"),
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          invitedAt: data.invitedAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          acceptedAt: data.acceptedAt?.toDate() || undefined,
        } as Invitation;
      });
    } catch (error) {
      console.error("Error getting email invitations:", error);
      throw error;
    }
  },

  /**
   * Accept an invitation
   * @param {string} id - Invitation ID
   * @returns {Promise<void>}
   */
  async acceptInvitation(id: string): Promise<void> {
    try {
      const docRef = doc(db, INVITATIONS_COLLECTION, id);

      await updateDoc(docRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      throw error;
    }
  },

  /**
   * Cancel an invitation
   * @param {string} id - Invitation ID
   * @returns {Promise<void>}
   */
  async cancelInvitation(id: string): Promise<void> {
    try {
      const docRef = doc(db, INVITATIONS_COLLECTION, id);

      await updateDoc(docRef, {
        status: "expired",
      });
    } catch (error) {
      console.error("Error canceling invitation:", error);
      throw error;
    }
  },

  /**
   * Clean up expired invitations (can be run periodically)
   * @returns {Promise<number>} - Number of expired invitations processed
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const now = new Date();
      const invitationsRef = collection(db, INVITATIONS_COLLECTION);

      const q = query(
        invitationsRef,
        where("status", "==", "pending"),
        where("expiresAt", "<=", Timestamp.fromDate(now)),
      );

      const expiredInvites = await getDocs(q);

      const batch: Promise<void>[] = [];

      expiredInvites.forEach((doc) => {
        batch.push(updateDoc(doc.ref, { status: "expired" }));
      });

      await Promise.all(batch);

      return batch.length;
    } catch (error) {
      console.error("Error cleaning up invitations:", error);
      throw error;
    }
  },
};
