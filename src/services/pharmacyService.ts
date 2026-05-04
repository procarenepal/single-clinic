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
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);

      const now = Timestamp.now();
      const data = {
        ...purchaseData,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(purchasesRef, data);

      console.log("Medicine purchase created with ID:", docRef.id);

      // Update stock for medicine items (not regular items)
      // Do this after purchase is created so purchase doesn't fail if stock update fails
      const stockUpdatePromises = purchaseData.items
        .filter((item) => item.type === "medicine" || !item.type) // Only process medicine items
        .map(async (item) => {
          try {
            // Get current stock
            const currentStock = await medicineService.getMedicineStock(
              item.medicineId,
              purchaseData.clinicId,
            );

            if (currentStock) {
              const requestedQty = item.quantity;
              let remainingQty = requestedQty;
              let newRegularStock = currentStock.currentStock;
              let newSchemeStock = currentStock.schemeStock || 0;

              // Get prices from item (preferred) or fallback to salePrice
              const itemWithPrices = item as any;
              const regularSalePrice =
                itemWithPrices.regularSalePrice || item.salePrice;
              const schemeSalePrice =
                itemWithPrices.schemeSalePrice || item.salePrice;

              // Respect stock type preference (if specified)
              const stockType = (item as any).stockType || "regular"; // Default to 'regular'
              let schemeQtyUsed = 0;
              let regularQtyUsed = 0;

              if (stockType === "regular") {
                // Use regular stock first, fallback to scheme if insufficient
                if (remainingQty > 0 && newRegularStock > 0) {
                  regularQtyUsed = Math.min(remainingQty, newRegularStock);
                  newRegularStock = Math.max(
                    0,
                    newRegularStock - regularQtyUsed,
                  );
                  remainingQty -= regularQtyUsed;
                }
                // Auto-fallback to scheme stock if regular is insufficient
                if (remainingQty > 0 && newSchemeStock > 0) {
                  schemeQtyUsed = Math.min(remainingQty, newSchemeStock);
                  newSchemeStock = Math.max(0, newSchemeStock - schemeQtyUsed);
                  remainingQty -= schemeQtyUsed;
                }
              } else if (stockType === "scheme") {
                // Use scheme stock first, fallback to regular if insufficient
                if (remainingQty > 0 && newSchemeStock > 0) {
                  schemeQtyUsed = Math.min(remainingQty, newSchemeStock);
                  newSchemeStock = Math.max(0, newSchemeStock - schemeQtyUsed);
                  remainingQty -= schemeQtyUsed;
                }
                // Auto-fallback to regular stock if scheme is insufficient
                if (remainingQty > 0 && newRegularStock > 0) {
                  regularQtyUsed = Math.min(remainingQty, newRegularStock);
                  newRegularStock = Math.max(
                    0,
                    newRegularStock - regularQtyUsed,
                  );
                  remainingQty -= regularQtyUsed;
                }
              }

              // Update stock with both regular and scheme
              await medicineService.updateMedicineStock(currentStock.id, {
                currentStock: newRegularStock,
                schemeStock: newSchemeStock,
                updatedBy: purchaseData.createdBy,
              });

              // Determine which price to use based on selected stock type preference
              // Use the selected stock type's price for all transactions, even if fallback occurs
              const priceToUse =
                stockType === "scheme" ? schemeSalePrice : regularSalePrice;

              // Create stock transaction for scheme stock if used
              if (schemeQtyUsed > 0) {
                await medicineService.createStockTransaction({
                  medicineId: item.medicineId,
                  type: "sale",
                  quantity: schemeQtyUsed,
                  previousStock: currentStock.schemeStock || 0,
                  newStock: newSchemeStock,
                  isSchemeStock: true,
                  salePrice: priceToUse,
                  schemePrice:
                    stockType === "scheme" ? schemeSalePrice : undefined,
                  unitPrice: priceToUse,
                  totalAmount: priceToUse * schemeQtyUsed,
                  referenceId: purchaseData.purchaseNo,
                  clinicId: purchaseData.clinicId,
                  branchId: purchaseData.branchId,
                  createdBy: purchaseData.createdBy,
                });
              }

              // Create stock transaction for regular stock if used
              if (regularQtyUsed > 0) {
                await medicineService.createStockTransaction({
                  medicineId: item.medicineId,
                  type: "sale",
                  quantity: regularQtyUsed,
                  previousStock: currentStock.currentStock,
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

              console.log(
                `Stock updated for medicine ${item.medicineId}: Regular ${currentStock.currentStock} -> ${newRegularStock}, Scheme ${currentStock.schemeStock || 0} -> ${newSchemeStock}`,
              );
            } else {
              // Stock record doesn't exist - log warning but don't fail
              console.warn(
                `Stock record not found for medicine ${item.medicineId}. Purchase created but stock not updated.`,
              );
            }
          } catch (stockError) {
            // Log error but don't fail the purchase creation
            console.error(
              `Error updating stock for medicine ${item.medicineId}:`,
              stockError,
            );
          }
        });

      // Wait for all stock updates (but don't fail if any fail)
      await Promise.allSettled(stockUpdatePromises);

      return docRef.id;
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
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, purchaseId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        throw new Error("Purchase not found");
      }

      const current = snap.data() as any;
      const now = Timestamp.now();
      const generatedId = doc(collection(db, "temp")).id;

      const returnRecord: MedicinePurchaseReturn = {
        ...returnData,
        id: generatedId,
        createdAt: now.toDate(),
      };

      const existingReturns: MedicinePurchaseReturn[] = Array.isArray(
        current.returns,
      )
        ? current.returns.map((r: any) => ({
          ...r,
          createdAt: r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt,
        }))
        : [];

      const allReturns = [...existingReturns, returnRecord];
      const totalReturnedAmount = allReturns.reduce(
        (sum, r) => sum + Math.abs(r.totalAmount || 0),
        0,
      );

      // Clean the return record to remove undefined values (Firebase doesn't allow undefined)
      const cleanReturnRecord: any = {
        id: returnRecord.id,
        clinicId: returnRecord.clinicId,
        branchId: returnRecord.branchId || "",
        purchaseId: returnRecord.purchaseId,
        totalAmount: returnRecord.totalAmount,
        refundMethod: returnRecord.refundMethod,
        items: returnRecord.items.map((item: any) => ({
          id: item.id,
          purchaseItemId: item.purchaseItemId,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          amount: item.amount,
          ...(item.reason && { reason: item.reason }),
        })),
        createdBy: returnRecord.createdBy,
        createdAt: now,
        ...(returnRecord.notes && { notes: returnRecord.notes }),
      };

      await updateDoc(docRef, {
        returns: arrayUnion(cleanReturnRecord),
        totalReturnedAmount,
        updatedAt: now,
      });

      // Update stock for returned medicine items
      // Get the original purchase to check item types
      const originalPurchase = current as MedicinePurchase;

      // Create a map of purchase item IDs to their types
      const purchaseItemTypeMap = new Map<string, "medicine" | "item">();

      if (originalPurchase.items) {
        originalPurchase.items.forEach((item: any) => {
          purchaseItemTypeMap.set(item.id, item.type || "medicine");
        });
      }

      // Update stock for returned medicine items
      const stockUpdatePromises = returnRecord.items
        .filter((item) => {
          // Only process items that were originally medicines
          const itemType = purchaseItemTypeMap.get(item.purchaseItemId);

          return itemType === "medicine" || !itemType;
        })
        .map(async (item) => {
          try {
            // Get current stock
            const currentStock = await medicineService.getMedicineStock(
              item.medicineId,
              returnData.clinicId,
            );

            if (currentStock) {
              // Calculate new stock (increase by returned quantity)
              const newStock = currentStock.currentStock + item.quantity;

              // Update stock
              await medicineService.updateMedicineStock(currentStock.id, {
                currentStock: newStock,
                updatedBy: returnData.createdBy,
              });

              // Create stock transaction record
              await medicineService.createStockTransaction({
                medicineId: item.medicineId,
                type: "returned",
                quantity: item.quantity,
                previousStock: currentStock.currentStock,
                newStock: newStock,
                unitPrice: Math.abs(item.amount / item.quantity), // Calculate unit price from amount
                totalAmount: Math.abs(item.amount),
                referenceId: originalPurchase.purchaseNo || purchaseId,
                reason: item.reason || "Return from pharmacy sale",
                clinicId: returnData.clinicId,
                branchId: returnData.branchId,
                createdBy: returnData.createdBy,
              });

              console.log(
                `Stock increased for medicine ${item.medicineId}: ${currentStock.currentStock} -> ${newStock}`,
              );
            } else {
              // Stock record doesn't exist - log warning but don't fail
              console.warn(
                `Stock record not found for medicine ${item.medicineId}. Return created but stock not updated.`,
              );
            }
          } catch (stockError) {
            // Log error but don't fail the return creation
            console.error(
              `Error updating stock for returned medicine ${item.medicineId}:`,
              stockError,
            );
          }
        });

      // Wait for all stock updates (but don't fail if any fail)
      await Promise.allSettled(stockUpdatePromises);

      return generatedId;
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
