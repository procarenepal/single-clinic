import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  MedicinePurchase,
  MedicinePurchaseReturn,
  MedicineUsage,
  PharmacySettings,
  PaymentMethod,
} from "../types/models";

import { medicineService } from "./medicineService";

const MEDICINE_PURCHASES_COLLECTION = "medicinePurchases";
const MEDICINE_USAGE_COLLECTION = "medicineUsage";
const PHARMACY_SETTINGS_COLLECTION = "pharmacySettings";

/**
 * Service for managing pharmacy operations including purchases, usage tracking, and settings
 */
export const pharmacyService = {
  // =================== MEDICINE PURCHASES ===================

  /**
   * Create a new medicine purchase record
   * Also decreases stock for medicine items and creates stock transactions
   */
  async createMedicinePurchase(
    purchaseData: Omit<MedicinePurchase, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const medicineItems = purchaseData.items.filter(
        (item) => item.type === "medicine" || !item.type,
      );

      // Pre-fetch stock document references
      const stockRefs: Record<string, any> = {};
      for (const item of medicineItems) {
        if (!stockRefs[item.medicineId]) {
          const q = query(
            collection(db, "medicineStock"),
            where("medicineId", "==", item.medicineId),
            where("clinicId", "==", purchaseData.clinicId),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            stockRefs[item.medicineId] = doc(db, "medicineStock", snap.docs[0].id);
          }
        }
      }

      const purchaseId = await runTransaction(db, async (transaction) => {
        // 1. Read all stock documents
        const stockSnaps: Record<string, any> = {};
        for (const medicineId in stockRefs) {
          const snap = await transaction.get(stockRefs[medicineId]);
          if (snap.exists()) {
            stockSnaps[medicineId] = snap.data();
          }
        }

        // 2. Prepare data for updates
        const stockUpdates: Record<string, any> = {};
        const transactionLogs: any[] = [];

        for (const item of medicineItems) {
          const currentStockData = stockSnaps[item.medicineId];
          if (!currentStockData) continue;

          let remainingQty = item.quantity;
          let newRegularStock = currentStockData.currentStock || 0;
          let newSchemeStock = currentStockData.schemeStock || 0;

          const itemWithPrices = item as any;
          const regularSalePrice =
            itemWithPrices.regularSalePrice || item.salePrice;
          const schemeSalePrice =
            itemWithPrices.schemeSalePrice || item.salePrice;
          const stockType = (item as any).stockType || "regular";
          
          let schemeQtyUsed = 0;
          let regularQtyUsed = 0;

          if (stockType === "regular") {
            if (remainingQty > 0 && newRegularStock > 0) {
              regularQtyUsed = Math.min(remainingQty, newRegularStock);
              newRegularStock -= regularQtyUsed;
              remainingQty -= regularQtyUsed;
            }
            if (remainingQty > 0 && newSchemeStock > 0) {
              schemeQtyUsed = Math.min(remainingQty, newSchemeStock);
              newSchemeStock -= schemeQtyUsed;
              remainingQty -= schemeQtyUsed;
            }
          } else {
            if (remainingQty > 0 && newSchemeStock > 0) {
              schemeQtyUsed = Math.min(remainingQty, newSchemeStock);
              newSchemeStock -= schemeQtyUsed;
              remainingQty -= schemeQtyUsed;
            }
            if (remainingQty > 0 && newRegularStock > 0) {
              regularQtyUsed = Math.min(remainingQty, newRegularStock);
              newRegularStock -= regularQtyUsed;
              remainingQty -= regularQtyUsed;
            }
          }

          // Queue stock update
          stockUpdates[item.medicineId] = {
            currentStock: newRegularStock,
            schemeStock: newSchemeStock,
            updatedBy: purchaseData.createdBy,
            updatedAt: serverTimestamp(),
          };

          const priceToUse =
            stockType === "scheme" ? schemeSalePrice : regularSalePrice;

          if (schemeQtyUsed > 0) {
            transactionLogs.push({
              medicineId: item.medicineId,
              type: "sale",
              quantity: schemeQtyUsed,
              previousStock: currentStockData.schemeStock || 0,
              newStock: newSchemeStock,
              isSchemeStock: true,
              salePrice: priceToUse,
              unitPrice: priceToUse,
              totalAmount: priceToUse * schemeQtyUsed,
              referenceId: purchaseData.purchaseNo,
              clinicId: purchaseData.clinicId,
              branchId: purchaseData.branchId,
              createdBy: purchaseData.createdBy,
            });
          }

          if (regularQtyUsed > 0) {
            transactionLogs.push({
              medicineId: item.medicineId,
              type: "sale",
              quantity: regularQtyUsed,
              previousStock: currentStockData.currentStock || 0,
              newStock: newRegularStock,
              isSchemeStock: false,
              salePrice: priceToUse,
              unitPrice: priceToUse,
              totalAmount: priceToUse * regularQtyUsed,
              referenceId: purchaseData.purchaseNo,
              clinicId: purchaseData.clinicId,
              branchId: purchaseData.branchId,
              createdBy: purchaseData.createdBy,
            });
          }
        }

        // 3. Perform Writes
        // Create Purchase
        const purchaseRef = doc(collection(db, MEDICINE_PURCHASES_COLLECTION));
        transaction.set(purchaseRef, {
          ...purchaseData,
          id: purchaseRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update Stocks
        for (const medicineId in stockUpdates) {
          transaction.update(stockRefs[medicineId], stockUpdates[medicineId]);
        }

        // Create Stock Transactions
        for (const log of transactionLogs) {
          const logRef = doc(collection(db, "stockTransactions"));
          transaction.set(logRef, {
            ...log,
            createdAt: serverTimestamp(),
          });
        }

        return purchaseRef.id;
      });

      return purchaseId;
    } catch (error) {
      console.error("Error creating medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Get a medicine purchase by ID
   */
  async getMedicinePurchaseById(id: string): Promise<MedicinePurchase | null> {
    try {
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const purchase: MedicinePurchase = {
          id: docSnap.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;

        // Normalise returns array date fields (if any)
        if (Array.isArray((data as any).returns)) {
          purchase.returns = (data as any).returns.map((ret: any) => ({
            ...ret,
            createdAt: ret.createdAt?.toDate
              ? ret.createdAt.toDate()
              : ret.createdAt,
          })) as MedicinePurchaseReturn[];
        }

        return purchase;
      }

      return null;
    } catch (error) {
      console.error("Error getting medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Get all medicine purchases for a clinic
   */
  async getMedicinePurchasesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<MedicinePurchase[]> {
    try {
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(purchasesRef, ...constraints);
      const querySnapshot = await getDocs(q);

      const purchases = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;
      });

      return purchases.sort((a, b) => {
        const dateA = a.purchaseDate ? (a.purchaseDate instanceof Date ? a.purchaseDate.getTime() : new Date(a.purchaseDate).getTime()) : 0;
        const dateB = b.purchaseDate ? (b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime()) : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting medicine purchases:", error);
      throw error;
    }
  },

  /**
   * Update a medicine purchase
   */
  async updateMedicinePurchase(
    id: string,
    updateData: Partial<
      Omit<MedicinePurchase, "id" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Create a sales return record for an existing medicine purchase.
   * This keeps the original purchase immutable while tracking adjustments.
   */
  async addMedicinePurchaseReturn(
    purchaseId: string,
    returnData: Omit<MedicinePurchaseReturn, "id" | "createdAt">,
  ): Promise<string> {
    try {
      const purchaseRef = doc(db, MEDICINE_PURCHASES_COLLECTION, purchaseId);
      
      const medicineItems = returnData.items;
      const stockRefs: Record<string, any> = {};
      
      for (const item of medicineItems) {
        const q = query(
          collection(db, "medicineStock"),
          where("medicineId", "==", item.medicineId),
          where("clinicId", "==", returnData.clinicId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          stockRefs[item.medicineId] = doc(db, "medicineStock", snap.docs[0].id);
        }
      }

      const returnId = await runTransaction(db, async (transaction) => {
        // 1. Read Purchase Document
        const purchaseSnap = await transaction.get(purchaseRef);
        if (!purchaseSnap.exists()) {
          throw new Error("Purchase not found");
        }
        const originalPurchase = purchaseSnap.data() as MedicinePurchase;
        
        // 2. Read all Stock Documents
        const stockSnaps: Record<string, any> = {};
        for (const medicineId in stockRefs) {
          const snap = await transaction.get(stockRefs[medicineId]);
          if (snap.exists()) {
            stockSnaps[medicineId] = snap.data();
          }
        }

        // 3. Prepare data
        const now = Timestamp.now();
        const generatedId = doc(collection(db, "temp")).id;
        
        const returnRecord: any = {
          id: generatedId,
          clinicId: returnData.clinicId,
          branchId: returnData.branchId || "",
          purchaseId: returnData.purchaseId,
          totalAmount: returnData.totalAmount,
          refundMethod: returnData.refundMethod,
          items: returnData.items.map((item: any) => ({
            id: item.id,
            purchaseItemId: item.purchaseItemId,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            quantity: item.quantity,
            amount: item.amount,
            ...(item.reason && { reason: item.reason }),
          })),
          createdBy: returnData.createdBy,
          createdAt: now,
          ...(returnData.notes && { notes: returnData.notes }),
        };

        const existingReturns = originalPurchase.returns || [];
        const allReturns = [...existingReturns, returnRecord];
        const totalReturnedAmount = allReturns.reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );

        // Map for item types
        const purchaseItemTypeMap = new Map<string, string>();
        if (originalPurchase.items) {
          originalPurchase.items.forEach((item: any) => {
            purchaseItemTypeMap.set(item.id, item.type || "medicine");
          });
        }

        // 4. Perform Writes
        // Update Purchase
        transaction.update(purchaseRef, {
          returns: allReturns,
          totalReturnedAmount,
          updatedAt: now,
        });

        // Update Stock and Create Transactions
        for (const item of medicineItems) {
          const itemType = purchaseItemTypeMap.get(item.purchaseItemId);
          if (itemType !== "medicine" && itemType !== undefined) continue;

          const currentStockData = stockSnaps[item.medicineId];
          if (currentStockData) {
            const newStock = (currentStockData.currentStock || 0) + item.quantity;
            
            // Update stock
            transaction.update(stockRefs[item.medicineId], {
              currentStock: newStock,
              updatedBy: returnData.createdBy,
              updatedAt: now,
            });

            // Create stock transaction
            const logRef = doc(collection(db, "stockTransactions"));
            transaction.set(logRef, {
              medicineId: item.medicineId,
              type: "returned",
              quantity: item.quantity,
              previousStock: currentStockData.currentStock || 0,
              newStock: newStock,
              unitPrice: Math.abs(item.amount / item.quantity),
              totalAmount: Math.abs(item.amount),
              referenceId: originalPurchase.purchaseNo || purchaseId,
              reason: item.reason || "Return from pharmacy sale",
              clinicId: returnData.clinicId,
              branchId: returnData.branchId,
              createdBy: returnData.createdBy,
              createdAt: now,
            });
          }
        }

        return generatedId;
      });

      return returnId;
    } catch (error) {
      console.error("Error creating medicine purchase return:", error);
      throw error;
    }
  },

  /**
   * Delete a medicine purchase
   */
  async deleteMedicinePurchase(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Get purchases by payment status
   */
  async getMedicinePurchasesByPaymentStatus(
    clinicId: string,
    paymentStatus: "paid" | "pending" | "partial",
    branchId?: string,
  ): Promise<MedicinePurchase[]> {
    try {
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);
      let q = query(
        purchasesRef,
        where("paymentStatus", "==", paymentStatus),
      );

      if (branchId) {
        q = query(
          purchasesRef,
          where("branchId", "==", branchId),
          where("paymentStatus", "==", paymentStatus),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;
      });
    } catch (error) {
      console.error(
        "Error getting medicine purchases by payment status:",
        error,
      );
      throw error;
    }
  },

  // =================== MEDICINE USAGE ===================

  /**
   * Create a new medicine usage record
   */
  async createMedicineUsage(
    usageData: Omit<MedicineUsage, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);

      const now = Timestamp.now();
      const data = {
        ...usageData,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(usageRef, data);

      console.log("Medicine usage created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine usage:", error);
      throw error;
    }
  },

  /**
   * Get a medicine usage record by ID
   */
  async getMedicineUsageById(id: string): Promise<MedicineUsage | null> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      }

      return null;
    } catch (error) {
      console.error("Error getting medicine usage:", error);
      throw error;
    }
  },

  /**
   * Get all medicine usage records for a clinic
   */
  async getMedicineUsageByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(usageRef);

      // Filter by branch if specified
      if (branchId) {
        q = query(
          usageRef,
          where("branchId", "==", branchId),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage records:", error);
      throw error;
    }
  },

  /**
   * Get medicine usage records for a specific medicine
   */
  async getMedicineUsageByMedicine(
    clinicId: string,
    medicineId: string,
    branchId?: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(
        usageRef,
        where("medicineId", "==", medicineId),
      );

      if (branchId) {
        q = query(
          usageRef,
          where("branchId", "==", branchId),
          where("medicineId", "==", medicineId),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage by medicine:", error);
      throw error;
    }
  },

  /**
   * Get medicine usage records for a specific patient
   */
  async getMedicineUsageByPatient(
    clinicId: string,
    patientId: string,
    branchId?: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(
        usageRef,
        where("patientId", "==", patientId),
      );

      if (branchId) {
        q = query(
          usageRef,
          where("branchId", "==", branchId),
          where("patientId", "==", patientId),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage by patient:", error);
      throw error;
    }
  },

  /**
   * Update a medicine usage record
   */
  async updateMedicineUsage(
    id: string,
    updateData: Partial<Omit<MedicineUsage, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating medicine usage:", error);
      throw error;
    }
  },

  /**
   * Delete a medicine usage record
   */
  async deleteMedicineUsage(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine usage:", error);
      throw error;
    }
  },

  // =================== REPORTING & ANALYTICS ===================

  /**
   * Get purchase summary for a date range
   */
  async getPurchaseSummary(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<{
    totalPurchases: number;
    totalAmount: number;
    totalItems: number;
    averageOrderValue: number;
  }> {
    try {
      const purchases = await this.getMedicinePurchasesByClinic(
        clinicId,
        branchId,
      );

      const filteredPurchases = purchases.filter(
        (purchase) =>
          purchase.purchaseDate >= startDate &&
          purchase.purchaseDate <= endDate,
      );

      const totalPurchases = filteredPurchases.length;
      const totalAmount = filteredPurchases.reduce(
        (sum, purchase) => sum + purchase.netAmount,
        0,
      );
      const totalItems = filteredPurchases.reduce(
        (sum, purchase) =>
          sum +
          purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );
      const averageOrderValue =
        totalPurchases > 0 ? totalAmount / totalPurchases : 0;

      return {
        totalPurchases,
        totalAmount,
        totalItems,
        averageOrderValue,
      };
    } catch (error) {
      console.error("Error getting purchase summary:", error);
      throw error;
    }
  },

  /**
   * Get usage summary for a date range
   */
  async getUsageSummary(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<{
    totalUsageRecords: number;
    totalQuantityUsed: number;
    mostUsedMedicines: Array<{
      medicineId: string;
      medicineName: string;
      totalUsed: number;
    }>;
  }> {
    try {
      const usageRecords = await this.getMedicineUsageByClinic(
        clinicId,
        branchId,
      );

      const filteredUsage = usageRecords.filter(
        (usage) => usage.usageDate >= startDate && usage.usageDate <= endDate,
      );

      const totalUsageRecords = filteredUsage.length;
      const totalQuantityUsed = filteredUsage.reduce(
        (sum, usage) => sum + usage.quantityUsed,
        0,
      );

      // Calculate most used medicines
      const medicineUsageMap = new Map<
        string,
        { medicineName: string; totalUsed: number }
      >();

      filteredUsage.forEach((usage) => {
        const existing = medicineUsageMap.get(usage.medicineId);

        if (existing) {
          existing.totalUsed += usage.quantityUsed;
        } else {
          medicineUsageMap.set(usage.medicineId, {
            medicineName: usage.medicineName,
            totalUsed: usage.quantityUsed,
          });
        }
      });

      const mostUsedMedicines = Array.from(medicineUsageMap.entries())
        .map(([medicineId, data]) => ({
          medicineId,
          medicineName: data.medicineName,
          totalUsed: data.totalUsed,
        }))
        .sort((a, b) => b.totalUsed - a.totalUsed)
        .slice(0, 10); // Top 10 most used medicines

      return {
        totalUsageRecords,
        totalQuantityUsed,
        mostUsedMedicines,
      };
    } catch (error) {
      console.error("Error getting usage summary:", error);
      throw error;
    }
  },

  // =================== PHARMACY SETTINGS ===================

  /**
   * Get pharmacy settings for a clinic/branch
   */
  async getPharmacySettings(
    clinicId: string,
    branchId?: string,
  ): Promise<PharmacySettings | null> {
    try {
      const settingsRef = collection(db, PHARMACY_SETTINGS_COLLECTION);
      let q = query(settingsRef, where("clinicId", "==", clinicId));

      if (branchId) {
        q = query(
          settingsRef,
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
        );
      }

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PharmacySettings;
      }

      return null;
    } catch (error) {
      console.error("Error getting pharmacy settings:", error);
      throw error;
    }
  },

  /**
   * Create or update pharmacy settings
   */
  async savePharmacySettings(
    settingsData: Omit<PharmacySettings, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      // Check if settings already exist
      const existingSettings = await this.getPharmacySettings(
        settingsData.clinicId,
        settingsData.branchId,
      );

      const now = Timestamp.now();

      if (existingSettings) {
        // Update existing settings
        const docRef = doc(
          db,
          PHARMACY_SETTINGS_COLLECTION,
          existingSettings.id,
        );

        await updateDoc(docRef, {
          ...settingsData,
          updatedAt: now,
        });

        return existingSettings.id;
      } else {
        // Create new settings with deterministic ID so future look-ups are cheap
        const docId = settingsData.branchId
          ? `${settingsData.clinicId}_${settingsData.branchId}`
          : settingsData.clinicId;
        const docRef = doc(db, PHARMACY_SETTINGS_COLLECTION, docId);
        const data = {
          ...settingsData,
          id: docId,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(docRef, data);
        console.log("Pharmacy settings created with ID:", docRef.id);

        return docRef.id;
      }
    } catch (error) {
      console.error("Error saving pharmacy settings:", error);
      throw error;
    }
  },

  /**
   * Get default pharmacy settings for new clinics
   */
  getDefaultPharmacySettings(): PharmacySettings {
    const defaultPaymentMethods: PaymentMethod[] = [
      {
        id: "cash",
        name: "Cash",
        key: "cash",
        isEnabled: true,
        requiresReference: false,
        icon: "💵",
        description: "Cash payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "card",
        name: "Credit/Debit Card",
        key: "card",
        isEnabled: true,
        requiresReference: true,
        icon: "💳",
        description: "Credit or debit card payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        key: "bank_transfer",
        isEnabled: true,
        requiresReference: true,
        icon: "🏦",
        description: "Bank transfer or wire payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "mobile_banking",
        name: "Mobile Banking",
        key: "mobile_banking",
        isEnabled: true,
        requiresReference: true,
        icon: "📱",
        description: "Mobile banking apps (eSewa, Khalti, etc.)",
        isCustom: false,
        createdAt: new Date(),
      },
    ];

    return {
      id: "",
      clinicId: "",
      branchId: "",
      // Tax Configuration
      defaultTaxPercentage: 13, // Default VAT in Nepal
      enableTax: true,
      taxLabel: "VAT",

      // Payment Methods Configuration
      enabledPaymentMethods: defaultPaymentMethods,
      defaultPaymentMethod: "cash",

      // Other Settings
      enableDiscount: true,
      defaultDiscountPercentage: 0,
      invoicePrefix: "INV",
      nextInvoiceNumber: 1001,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "",
    };
  },

  // Helper function to generate unique key from name
  generatePaymentMethodKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .substring(0, 20); // Limit length
  },

  // Add a new custom payment method
  async addPaymentMethod(
    clinicId: string,
    paymentMethodData: Omit<
      PaymentMethod,
      "id" | "key" | "isCustom" | "createdAt"
    >,
    branchId?: string,
  ): Promise<string> {
    try {
      const id = doc(collection(db, "temp")).id; // Generate unique ID
      const key = this.generatePaymentMethodKey(paymentMethodData.name);

      const newPaymentMethod: PaymentMethod = {
        ...paymentMethodData,
        id,
        key,
        isCustom: true,
        createdAt: new Date(),
      };

      // Get current settings or create default ones
      let currentSettings = await this.getPharmacySettings(clinicId, branchId);

      if (!currentSettings) {
        // Create default settings if they don't exist
        const defaultSettings = this.getDefaultPharmacySettings();
        const settingsData = {
          ...defaultSettings,
          clinicId,
          branchId: branchId || "",
          updatedBy: "", // Will be set by the caller
        };

        // Save default settings first
        await this.savePharmacySettings(settingsData);

        // Get the newly created settings
        currentSettings = await this.getPharmacySettings(clinicId, branchId);

        if (!currentSettings) {
          throw new Error("Failed to create default pharmacy settings");
        }
      }

      // Check if key already exists
      const keyExists = currentSettings.enabledPaymentMethods.some(
        (pm) => pm.key === key,
      );

      if (keyExists) {
        throw new Error("A payment method with this name already exists");
      }

      // Add to existing payment methods
      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: [
          ...currentSettings.enabledPaymentMethods,
          newPaymentMethod,
        ],
      };

      await this.savePharmacySettings(updatedSettings);

      return id;
    } catch (error) {
      console.error("Error adding payment method:", error);
      throw error;
    }
  },

  // Update an existing payment method
  async updatePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
    updates: Partial<Omit<PaymentMethod, "id" | "isCustom" | "createdAt">>,
    branchId?: string,
  ): Promise<void> {
    try {
      const currentSettings = await this.getPharmacySettings(
        clinicId,
        branchId,
      );

      if (!currentSettings) {
        throw new Error(
          "Pharmacy settings not found. Please save settings first.",
        );
      }

      const updatedPaymentMethods = currentSettings.enabledPaymentMethods.map(
        (pm) => {
          if (pm.id === paymentMethodId) {
            const updatedMethod = { ...pm, ...updates };

            // If name is being updated, regenerate key
            if (updates.name && updates.name !== pm.name) {
              updatedMethod.key = this.generatePaymentMethodKey(updates.name);
            }

            return updatedMethod;
          }

          return pm;
        },
      );

      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: updatedPaymentMethods,
      };

      await this.savePharmacySettings(updatedSettings);
    } catch (error) {
      console.error("Error updating payment method:", error);
      throw error;
    }
  },

  // Delete a payment method
  async deletePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
    branchId?: string,
  ): Promise<void> {
    try {
      const currentSettings = await this.getPharmacySettings(
        clinicId,
        branchId,
      );

      if (!currentSettings) {
        throw new Error(
          "Pharmacy settings not found. Please save settings first.",
        );
      }

      // Find the payment method to delete
      const paymentMethodToDelete = currentSettings.enabledPaymentMethods.find(
        (pm) => pm.id === paymentMethodId,
      );

      if (!paymentMethodToDelete) {
        throw new Error("Payment method not found");
      }

      // Don't allow deleting non-custom payment methods
      if (!paymentMethodToDelete.isCustom) {
        throw new Error("Cannot delete default payment methods");
      }

      // Remove from payment methods array
      const updatedPaymentMethods =
        currentSettings.enabledPaymentMethods.filter(
          (pm) => pm.id !== paymentMethodId,
        );

      // If this was the default payment method, set a new default
      let newDefaultPaymentMethod = currentSettings.defaultPaymentMethod;

      if (currentSettings.defaultPaymentMethod === paymentMethodToDelete.key) {
        const enabledMethod = updatedPaymentMethods.find((pm) => pm.isEnabled);

        newDefaultPaymentMethod = enabledMethod ? enabledMethod.key : "cash";
      }

      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: updatedPaymentMethods,
        defaultPaymentMethod: newDefaultPaymentMethod,
      };

      await this.savePharmacySettings(updatedSettings);
    } catch (error) {
      console.error("Error deleting payment method:", error);
      throw error;
    }
  },
};

export default pharmacyService;
