import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  Medicine,
  MedicineBrand,
  MedicineCategory,
  MedicineStock,
  StockTransaction,
  Supplier,
  SupplierLedgerEntry,
  SupplierPayment,
  SupplierPurchaseRecord,
} from "../types/models";

const MEDICINES_COLLECTION = "medicines";
const MEDICINE_BRANDS_COLLECTION = "medicineBrands";
const MEDICINE_CATEGORIES_COLLECTION = "medicineCategories";
const MEDICINE_STOCK_COLLECTION = "medicineStock";
const STOCK_TRANSACTIONS_COLLECTION = "stockTransactions";
const SUPPLIERS_COLLECTION = "suppliers";
const PURCHASE_RECORDS_COLLECTION = "supplier_purchase_records";
const SUPPLIER_PAYMENTS_COLLECTION = "supplier_payments";
const SUPPLIER_LEDGER_ENTRIES_COLLECTION = "supplier_ledger_entries";
const DAILY_STOCK_SNAPSHOTS_COLLECTION = "dailyStockSnapshots";

export const medicineService = {
  // ============= MEDICINE BRANDS =============
  async createMedicineBrand(
    brandData: Omit<MedicineBrand, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const brandsRef = collection(db, MEDICINE_BRANDS_COLLECTION);
      const docRef = await addDoc(brandsRef, {
        ...brandData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine brand:", error);
      throw error;
    }
  },

  async getMedicineBrandsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<MedicineBrand[]> {
    try {
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(
        collection(db, MEDICINE_BRANDS_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      const brands = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as MedicineBrand[];

      // Sort in memory by name
      return brands.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error fetching medicine brands:", error);
      throw error;
    }
  },

  async updateMedicineBrand(
    id: string,
    updateData: Partial<MedicineBrand>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_BRANDS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating medicine brand:", error);
      throw error;
    }
  },

  async deleteMedicineBrand(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_BRANDS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine brand:", error);
      throw error;
    }
  },

  // ============= MEDICINE CATEGORIES =============
  async createMedicineCategory(
    categoryData: Omit<MedicineCategory, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const categoriesRef = collection(db, MEDICINE_CATEGORIES_COLLECTION);
      const docRef = await addDoc(categoriesRef, {
        ...categoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine category:", error);
      throw error;
    }
  },

  async getMedicineCategoriesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<MedicineCategory[]> {
    try {
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(
        collection(db, MEDICINE_CATEGORIES_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      const categories = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as MedicineCategory[];

      // Sort in memory by name
      return categories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error fetching medicine categories:", error);
      throw error;
    }
  },

  async updateMedicineCategory(
    id: string,
    updateData: Partial<MedicineCategory>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_CATEGORIES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating medicine category:", error);
      throw error;
    }
  },

  async deleteMedicineCategory(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_CATEGORIES_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine category:", error);
      throw error;
    }
  },

  // ============= MEDICINES =============
  async createMedicine(
    medicineData: Omit<Medicine, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const medicinesRef = collection(db, MEDICINES_COLLECTION);
      const docRef = await addDoc(medicinesRef, {
        ...medicineData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine:", error);
      throw error;
    }
  },

  async getMedicinesByClinic(
    clinicId: string,
    isActive?: boolean,
    branchId?: string,
  ): Promise<Medicine[]> {
    try {
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (typeof isActive === "boolean") {
        constraints.push(where("isActive", "==", isActive));
      }

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(collection(db, MEDICINES_COLLECTION), ...constraints);

      const querySnapshot = await getDocs(q);

      const medicines = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiryDate: doc.data().expiryDate?.toDate(),
      })) as Medicine[];

      // Sort in memory by name
      return medicines.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error fetching medicines:", error);
      throw error;
    }
  },

  async getMedicinesByClinicPaginated(
    clinicId: string,
    options: {
      pageSize: number;
      lastDoc?: QueryDocumentSnapshot | null;
      searchPrefix?: string;
      branchId?: string;
    },
  ): Promise<{ medicines: Medicine[]; lastDoc: QueryDocumentSnapshot | null }> {
    try {
      const { pageSize, lastDoc, searchPrefix, branchId } = options;

      const baseConstraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        baseConstraints.push(where("branchId", "==", branchId));
      }

      let q = query(
        collection(db, MEDICINES_COLLECTION),
        ...baseConstraints,
        orderBy("name"),
      );

      if (searchPrefix != null && searchPrefix !== "") {
        const prefix = searchPrefix.trim();
        const prefixEnd = prefix + "\uf8ff";

        q = query(
          collection(db, MEDICINES_COLLECTION),
          ...baseConstraints,
          where("name", ">=", prefix),
          where("name", "<=", prefixEnd),
          orderBy("name"),
        );
      }

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      q = query(q, limit(pageSize));
      const querySnapshot = await getDocs(q);
      const medicines = querySnapshot.docs.map((d) => {
        const data = d.data();

        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
        } as Medicine;
      });
      const last =
        querySnapshot.docs.length === pageSize
          ? querySnapshot.docs[querySnapshot.docs.length - 1]
          : null;

      return { medicines, lastDoc: last };
    } catch (error) {
      console.error("Error fetching medicines (paginated):", error);
      throw error;
    }
  },

  async getMedicinesCountByClinic(
    clinicId: string,
    searchPrefix?: string,
    branchId?: string,
  ): Promise<number> {
    try {
      const baseConstraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        baseConstraints.push(where("branchId", "==", branchId));
      }

      let q = query(
        collection(db, MEDICINES_COLLECTION),
        ...baseConstraints,
        orderBy("name"),
      );

      if (searchPrefix != null && searchPrefix !== "") {
        const prefix = searchPrefix.trim();
        const prefixEnd = prefix + "\uf8ff";

        q = query(
          collection(db, MEDICINES_COLLECTION),
          ...baseConstraints,
          where("name", ">=", prefix),
          where("name", "<=", prefixEnd),
          orderBy("name"),
        );
      }
      const snapshot = await getCountFromServer(q);

      return snapshot.data().count;
    } catch (error) {
      console.error("Error fetching medicines count:", error);
      throw error;
    }
  },

  async getMedicineById(id: string): Promise<Medicine | null> {
    try {
      const docRef = doc(db, MEDICINES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
        } as Medicine;
      }

      return null;
    } catch (error) {
      console.error("Error fetching medicine:", error);
      throw error;
    }
  },

  async updateMedicine(
    id: string,
    updateData: Partial<Medicine>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating medicine:", error);
      throw error;
    }
  },

  async deleteMedicine(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINES_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine:", error);
      throw error;
    }
  },

  async searchMedicines(
    clinicId: string,
    searchTerm: string,
    limit: number = 10,
  ): Promise<Medicine[]> {
    try {
      // For now, we'll get all medicines and filter client-side
      // In production, you might want to use Algolia or similar for better search
      const medicines = await this.getMedicinesByClinic(clinicId, true);
      const filteredMedicines = medicines
        .filter(
          (medicine) =>
            medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            medicine.genericName
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()),
        )
        .slice(0, limit);

      return filteredMedicines;
    } catch (error) {
      console.error("Error searching medicines:", error);
      throw error;
    }
  },

  // ============= MEDICINE STOCK =============
  async createMedicineStock(
    stockData: Omit<MedicineStock, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const stockRef = collection(db, MEDICINE_STOCK_COLLECTION);
      const docRef = await addDoc(stockRef, {
        ...stockData,
        schemeStock: stockData.schemeStock ?? 0, // Default to 0 if not provided
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine stock:", error);
      throw error;
    }
  },

  async getMedicineStock(
    medicineId: string,
    clinicId?: string,
  ): Promise<MedicineStock | null> {
    try {
      let q;

      if (clinicId) {
        // Query with both medicineId and clinicId for better permission handling
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
          where("clinicId", "==", clinicId),
        );
      } else {
        // Fallback to medicineId only (for backward compatibility)
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
        );
      }
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          schemeStock: data.schemeStock ?? 0, // Default to 0 for backward compatibility
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastRestocked: data.lastRestocked?.toDate(),
        } as MedicineStock;
      }

      return null;
    } catch (error) {
      console.error("Error fetching medicine stock:", error);
      throw error;
    }
  },

  async getStockByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<(MedicineStock & { medicine: Medicine })[]> {
    try {
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(
        collection(db, MEDICINE_STOCK_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      const stockWithMedicines = await Promise.all(
        querySnapshot.docs.map(async (stockDoc) => {
          const stockData = stockDoc.data();
          const medicine = await this.getMedicineById(stockData.medicineId);

          return {
            id: stockDoc.id,
            ...stockData,
            schemeStock: stockData.schemeStock ?? 0, // Default to 0 for backward compatibility
            createdAt: stockData.createdAt?.toDate(),
            updatedAt: stockData.updatedAt?.toDate(),
            lastRestocked: stockData.lastRestocked?.toDate(),
            medicine: medicine!,
          } as MedicineStock & { medicine: Medicine };
        }),
      );

      return stockWithMedicines.filter((item) => item.medicine); // Filter out items where medicine is null
    } catch (error) {
      console.error("Error fetching stock by clinic:", error);
      throw error;
    }
  },

  async getStockByMedicineIds(
    clinicId: string,
    medicineIds: string[],
    branchId?: string,
  ): Promise<
    { medicineId: string; currentStock: number; schemeStock: number }[]
  > {
    if (medicineIds.length === 0) return [];
    try {
      const BATCH_SIZE = 30; // Firestore 'in' query limit
      const results: {
        medicineId: string;
        currentStock: number;
        schemeStock: number;
      }[] = [];

      for (let i = 0; i < medicineIds.length; i += BATCH_SIZE) {
        const batch = medicineIds.slice(i, i + BATCH_SIZE);
        const constraints: any[] = [
          where("clinicId", "==", clinicId),
          where("medicineId", "in", batch),
        ];

        if (branchId) {
          constraints.push(where("branchId", "==", branchId));
        }

        const q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          ...constraints,
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach((d) => {
          const data = d.data();

          results.push({
            medicineId: data.medicineId,
            currentStock: data.currentStock ?? 0,
            schemeStock: data.schemeStock ?? 0,
          });
        });
      }

      return results;
    } catch (error) {
      console.error("Error fetching stock by medicine IDs:", error);
      throw error;
    }
  },

  async updateMedicineStock(
    id: string,
    updateData: Partial<MedicineStock>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_STOCK_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating medicine stock:", error);
      throw error;
    }
  },

  // ============= STOCK TRANSACTIONS =============
  async createStockTransaction(
    transactionData: Omit<StockTransaction, "id" | "createdAt">,
  ): Promise<string> {
    try {
      const transactionsRef = collection(db, STOCK_TRANSACTIONS_COLLECTION);
      const docRef = await addDoc(transactionsRef, {
        ...transactionData,
        createdAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating stock transaction:", error);
      throw error;
    }
  },

  async getStockTransactions(
    medicineId: string,
    limitCount: number = 50,
    branchId?: string,
  ): Promise<StockTransaction[]> {
    try {
      const constraints: any[] = [where("medicineId", "==", medicineId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(limit(limitCount));

      const q = query(
        collection(db, STOCK_TRANSACTIONS_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
          isSchemeStock: data.isSchemeStock ?? false, // Default to false for backward compatibility
        } as StockTransaction;
      });
    } catch (error) {
      console.error("Error fetching stock transactions:", error);
      throw error;
    }
  },

  async getExpiryDatesForMedicineIds(
    medicineIds: string[],
  ): Promise<Record<string, Date>> {
    const expiryMap: Record<string, Date> = {};

    if (medicineIds.length === 0) return expiryMap;
    try {
      await Promise.all(
        medicineIds.map(async (medicineId) => {
          try {
            const transactions = await this.getStockTransactions(
              medicineId,
              50,
            );
            const withExpiry = transactions
              .filter((t) => t.expiryDate)
              .sort(
                (a, b) =>
                  (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
              );

            if (withExpiry[0]?.expiryDate) {
              expiryMap[medicineId] = withExpiry[0].expiryDate;
            }
          } catch {
            // skip this medicine
          }
        }),
      );

      return expiryMap;
    } catch (error) {
      console.error("Error fetching expiry dates for medicine IDs:", error);

      return expiryMap;
    }
  },

  async getStockTransactionsByClinic(
    clinicId: string,
    branchId?: string,
    type?:
      | "purchase"
      | "sale"
      | "adjustment"
      | "expired"
      | "damaged"
      | "returned",
    startDate?: Date,
    endDate?: Date,
  ): Promise<StockTransaction[]> {
    try {
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      if (type) {
        constraints.push(where("type", "==", type));
      }

      if (startDate || endDate) {
        // For date filtering, we need to filter after fetching since Firestore doesn't support date range queries easily
        // We'll order by createdAt and filter in memory
        constraints.push(orderBy("createdAt", "desc"));
      } else {
        constraints.push(orderBy("createdAt", "desc"));
      }

      const q = query(
        collection(db, STOCK_TRANSACTIONS_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      let transactions = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
          isSchemeStock: data.isSchemeStock ?? false,
        } as StockTransaction;
      });

      // Filter by date range if provided
      if (startDate || endDate) {
        transactions = transactions.filter((t) => {
          if (!t.createdAt) return false;
          const transactionDate =
            t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);

          if (startDate && transactionDate < startDate) return false;
          if (endDate) {
            const endOfDay = new Date(endDate);

            endOfDay.setHours(23, 59, 59, 999);
            if (transactionDate > endOfDay) return false;
          }

          return true;
        });
      }

      return transactions;
    } catch (error) {
      console.error("Error fetching stock transactions by clinic:", error);
      throw error;
    }
  },

  // ============= SUPPLIERS =============
  async createSupplier(
    supplierData: Omit<Supplier, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const suppliersRef = collection(db, SUPPLIERS_COLLECTION);
      const docRef = await addDoc(suppliersRef, {
        ...supplierData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating supplier:", error);
      throw error;
    }
  },

  async getSuppliersByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<Supplier[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, SUPPLIERS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          orderBy("name"),
        );
      } else {
        q = query(
          collection(db, SUPPLIERS_COLLECTION),
          where("clinicId", "==", clinicId),
          orderBy("name"),
        );
      }
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Supplier;
      });
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      throw error;
    }
  },

  async updateSupplier(
    id: string,
    updateData: Partial<Supplier>,
  ): Promise<void> {
    try {
      const docRef = doc(db, SUPPLIERS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating supplier:", error);
      throw error;
    }
  },

  async deleteSupplier(id: string): Promise<void> {
    try {
      const docRef = doc(db, SUPPLIERS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting supplier:", error);
      throw error;
    }
  },

  // ============= SUPPLIER PURCHASE RECORDS =============
  async createSupplierPurchaseRecord(
    recordData: Omit<SupplierPurchaseRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const recordsRef = collection(db, PURCHASE_RECORDS_COLLECTION);
      const docRef = await addDoc(recordsRef, {
        ...recordData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Also create a ledger entry for this purchase
      try {
        await this.createSupplierLedgerEntry({
          supplierId: recordData.supplierId,
          supplierName: recordData.supplierName,
          billNumber: recordData.billNumber,
          transactionDate:
            recordData.purchaseDate instanceof Date
              ? recordData.purchaseDate
              : new Date(recordData.purchaseDate),
          debitAmount: recordData.totalAmount,
          creditAmount: 0,
          type: "purchase",
          notes: recordData.notes,
          clinicId: recordData.clinicId,
          branchId: recordData.branchId,
          createdBy: recordData.createdBy,
        });
      } catch (ledgerError) {
        console.error(
          "Error creating ledger entry for purchase record:",
          ledgerError,
        );
        // Don't throw - purchase record is created, ledger entry failure is logged
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating purchase record:", error);
      throw error;
    }
  },

  async getSupplierPurchaseRecords(
    clinicId: string,
    branchId?: string,
  ): Promise<SupplierPurchaseRecord[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          orderBy("purchaseDate", "desc"),
        );
      } else {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("clinicId", "==", clinicId),
          orderBy("purchaseDate", "desc"),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as SupplierPurchaseRecord;
      });
    } catch (error) {
      console.error("Error fetching purchase records:", error);
      throw error;
    }
  },

  async updateSupplierPurchaseRecord(
    id: string,
    updateData: Partial<SupplierPurchaseRecord>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PURCHASE_RECORDS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating purchase record:", error);
      throw error;
    }
  },

  async deleteSupplierPurchaseRecord(id: string): Promise<void> {
    try {
      const docRef = doc(db, PURCHASE_RECORDS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting purchase record:", error);
      throw error;
    }
  },

  async getPurchaseRecordsBySupplier(
    supplierId: string,
    branchId?: string,
  ): Promise<SupplierPurchaseRecord[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("supplierId", "==", supplierId),
          where("branchId", "==", branchId),
          orderBy("purchaseDate", "desc"),
        );
      } else {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("supplierId", "==", supplierId),
          orderBy("purchaseDate", "desc"),
        );
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as SupplierPurchaseRecord;
      });
    } catch (error) {
      console.error("Error fetching purchase records by supplier:", error);
      throw error;
    }
  },

  async getOverduePurchaseRecords(
    clinicId: string,
    branchId?: string,
  ): Promise<SupplierPurchaseRecord[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          where("paymentStatus", "in", ["pending", "partial"]),
          orderBy("purchaseDate", "asc"),
        );
      } else {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("paymentStatus", "in", ["pending", "partial"]),
          orderBy("purchaseDate", "asc"),
        );
      }

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as SupplierPurchaseRecord;
      });

      // Filter for records that are overdue (older than 30 days and not paid)
      const thirtyDaysAgo = new Date();

      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return records.filter(
        (record) => record.purchaseDate < thirtyDaysAgo && record.dueAmount > 0,
      );
    } catch (error) {
      console.error("Error fetching overdue purchase records:", error);
      throw error;
    }
  },

  // Get purchase records statistics for dashboard
  async getPurchaseRecordsStats(
    clinicId: string,
    branchId?: string,
  ): Promise<{
    totalRecords: number;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    overdueCount: number;
  }> {
    try {
      const [allRecords, overdueRecords] = await Promise.all([
        this.getSupplierPurchaseRecords(clinicId, branchId),
        this.getOverduePurchaseRecords(clinicId, branchId),
      ]);

      const totalAmount = allRecords.reduce(
        (sum, record) => sum + record.totalAmount,
        0,
      );
      const paidAmount = allRecords.reduce(
        (sum, record) => sum + record.paidAmount,
        0,
      );
      const dueAmount = allRecords.reduce(
        (sum, record) => sum + record.dueAmount,
        0,
      );

      return {
        totalRecords: allRecords.length,
        totalAmount,
        paidAmount,
        dueAmount,
        overdueCount: overdueRecords.length,
      };
    } catch (error) {
      console.error("Error fetching purchase records stats:", error);
      throw error;
    }
  },

  // ============= SUPPLIER PAYMENTS / LEDGER =============
  async createSupplierPayment(
    paymentData: Omit<SupplierPayment, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const paymentsRef = collection(db, SUPPLIER_PAYMENTS_COLLECTION);
      const payload: Record<string, any> = {
        ...paymentData,
        date:
          paymentData.date instanceof Date
            ? paymentData.date
            : new Date(paymentData.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!payload.referenceNumber) {
        delete payload.referenceNumber;
      }
      if (!payload.notes) {
        delete payload.notes;
      }

      const docRef = await addDoc(paymentsRef, payload);

      return docRef.id;
    } catch (error) {
      console.error("Error recording supplier payment:", error);
      throw error;
    }
  },

  async getSupplierPayments(
    clinicId: string,
    branchId?: string,
  ): Promise<SupplierPayment[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, SUPPLIER_PAYMENTS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          orderBy("date", "desc"),
        );
      } else {
        q = query(
          collection(db, SUPPLIER_PAYMENTS_COLLECTION),
          where("clinicId", "==", clinicId),
          orderBy("date", "desc"),
        );
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierPayment;
      });
    } catch (error) {
      console.error("Error loading supplier payments:", error);
      throw error;
    }
  },

  async getSupplierPaymentsBySupplier(
    supplierId: string,
    clinicId: string,
    branchId?: string,
  ): Promise<SupplierPayment[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, SUPPLIER_PAYMENTS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          where("supplierId", "==", supplierId),
          orderBy("date", "desc"),
        );
      } else {
        q = query(
          collection(db, SUPPLIER_PAYMENTS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("supplierId", "==", supplierId),
          orderBy("date", "desc"),
        );
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierPayment;
      });
    } catch (error) {
      console.error("Error loading supplier payments by supplier:", error);
      throw error;
    }
  },

  async deleteSupplierPayment(id: string): Promise<void> {
    try {
      const docRef = doc(db, SUPPLIER_PAYMENTS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting supplier payment:", error);
      throw error;
    }
  },

  async updateSupplierPayment(
    id: string,
    updateData: Partial<SupplierPayment>,
  ): Promise<void> {
    try {
      const docRef = doc(db, SUPPLIER_PAYMENTS_COLLECTION, id);
      const payload: Record<string, any> = {
        ...updateData,
        updatedAt: serverTimestamp(),
      };

      if (payload.referenceNumber === undefined) {
        delete payload.referenceNumber;
      }
      if (payload.notes === undefined) {
        delete payload.notes;
      }

      await updateDoc(docRef, payload);
    } catch (error) {
      console.error("Error updating supplier payment:", error);
      throw error;
    }
  },

  // ============= SUPPLIER LEDGER ENTRIES =============
  async getSupplierLedgerEntries(
    supplierId: string,
    clinicId: string,
    branchId?: string,
  ): Promise<SupplierLedgerEntry[]> {
    try {
      let q;

      if (branchId) {
        q = query(
          collection(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          where("supplierId", "==", supplierId),
          orderBy("createdAt", "asc"), // Order by creation time to show entries in the order they were created
        );
      } else {
        q = query(
          collection(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION),
          where("clinicId", "==", clinicId),
          where("supplierId", "==", supplierId),
          orderBy("createdAt", "asc"),
        );
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          transactionDate: data.transactionDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierLedgerEntry;
      });
    } catch (error) {
      console.error("Error loading supplier ledger entries:", error);
      throw error;
    }
  },

  async getSupplierLedgerBalances(
    clinicId: string,
    branchId?: string,
  ): Promise<Record<string, number>> {
    try {
      const constraints = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(
        collection(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION),
        ...constraints,
      );
      const snapshot = await getDocs(q);

      const balances: Record<string, { balance: number; createdAt: Date }> = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const supplierId = data.supplierId as string;

        if (!supplierId) return;
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(0);
        const balanceAmount =
          typeof data.balanceAmount === "number" ? data.balanceAmount : 0;

        if (
          !balances[supplierId] ||
          balances[supplierId].createdAt < createdAt
        ) {
          balances[supplierId] = {
            balance: balanceAmount,
            createdAt,
          };
        }
      });

      const result: Record<string, number> = {};

      Object.keys(balances).forEach((supplierId) => {
        result[supplierId] = balances[supplierId].balance;
      });

      return result;
    } catch (error) {
      console.error("Error loading supplier ledger balances:", error);
      throw error;
    }
  },

  async calculateSupplierBalance(
    supplierId: string,
    clinicId: string,
    branchId?: string,
  ): Promise<number> {
    try {
      const entries = await this.getSupplierLedgerEntries(
        supplierId,
        clinicId,
        branchId,
      );

      if (entries.length === 0) {
        return 0;
      }

      // Return the balance from the last entry (most recent)
      return entries[entries.length - 1].balanceAmount;
    } catch (error) {
      console.error("Error calculating supplier balance:", error);
      throw error;
    }
  },

  async createSupplierLedgerEntry(
    entryData: Omit<
      SupplierLedgerEntry,
      "id" | "createdAt" | "updatedAt" | "balanceAmount"
    >,
  ): Promise<string> {
    try {
      // Get all existing entries for this supplier to calculate running balance
      const existingEntries = await this.getSupplierLedgerEntries(
        entryData.supplierId,
        entryData.clinicId,
        entryData.branchId,
      );

      // Calculate previous balance (from last entry, or 0 if no entries)
      const previousBalance =
        existingEntries.length > 0
          ? existingEntries[existingEntries.length - 1].balanceAmount
          : 0;

      // Calculate new balance: previousBalance + debitAmount - creditAmount
      const balanceAmount =
        previousBalance + entryData.debitAmount - entryData.creditAmount;

      const entriesRef = collection(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION);
      const payload: Record<string, any> = {
        ...entryData,
        balanceAmount,
        transactionDate:
          entryData.transactionDate instanceof Date
            ? entryData.transactionDate
            : new Date(entryData.transactionDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Remove undefined optional fields
      if (!payload.billNumber) {
        delete payload.billNumber;
      }
      if (!payload.notes) {
        delete payload.notes;
      }
      if (!payload.referenceNumber) {
        delete payload.referenceNumber;
      }

      const docRef = await addDoc(entriesRef, payload);

      return docRef.id;
    } catch (error) {
      console.error("Error creating supplier ledger entry:", error);
      throw error;
    }
  },

  async updateSupplierLedgerEntry(
    id: string,
    updateData: Partial<SupplierLedgerEntry>,
  ): Promise<void> {
    try {
      const entryDoc = await getDoc(
        doc(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION, id),
      );

      if (!entryDoc.exists()) {
        throw new Error("Ledger entry not found");
      }

      const entryData = entryDoc.data() as SupplierLedgerEntry;
      const supplierId = entryData.supplierId;
      const clinicId = entryData.clinicId;
      const branchId = entryData.branchId;

      // If balance-affecting fields are updated, recalculate all subsequent balances
      if (
        updateData.debitAmount !== undefined ||
        updateData.creditAmount !== undefined ||
        updateData.transactionDate
      ) {
        // Get all entries for this supplier
        const allEntries = await this.getSupplierLedgerEntries(
          supplierId,
          clinicId,
          branchId,
        );

        // Find the index of the entry being updated
        const entryIndex = allEntries.findIndex((e) => e.id === id);

        if (entryIndex === -1) {
          throw new Error("Entry not found in supplier ledger");
        }

        // Recalculate balance for this entry
        const previousBalance =
          entryIndex > 0 ? allEntries[entryIndex - 1].balanceAmount : 0;
        const debitAmount =
          updateData.debitAmount !== undefined
            ? updateData.debitAmount
            : entryData.debitAmount;
        const creditAmount =
          updateData.creditAmount !== undefined
            ? updateData.creditAmount
            : entryData.creditAmount;
        const newBalance = previousBalance + debitAmount - creditAmount;

        // Update this entry
        const docRef = doc(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION, id);
        const payload: Record<string, any> = {
          ...updateData,
          balanceAmount: newBalance,
          updatedAt: serverTimestamp(),
        };

        if (payload.transactionDate) {
          payload.transactionDate =
            payload.transactionDate instanceof Date
              ? payload.transactionDate
              : new Date(payload.transactionDate);
        }

        await updateDoc(docRef, payload);

        // Recalculate balances for all subsequent entries
        let runningBalance = newBalance;

        for (let i = entryIndex + 1; i < allEntries.length; i++) {
          const subsequentEntry = allEntries[i];

          runningBalance =
            runningBalance +
            subsequentEntry.debitAmount -
            subsequentEntry.creditAmount;

          const subsequentDocRef = doc(
            db,
            SUPPLIER_LEDGER_ENTRIES_COLLECTION,
            subsequentEntry.id,
          );

          await updateDoc(subsequentDocRef, {
            balanceAmount: runningBalance,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        // Simple update without balance recalculation
        const docRef = doc(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION, id);
        const payload: Record<string, any> = {
          ...updateData,
          updatedAt: serverTimestamp(),
        };

        if (payload.billNumber === undefined) {
          delete payload.billNumber;
        }
        if (payload.notes === undefined) {
          delete payload.notes;
        }
        if (payload.referenceNumber === undefined) {
          delete payload.referenceNumber;
        }

        await updateDoc(docRef, payload);
      }
    } catch (error) {
      console.error("Error updating supplier ledger entry:", error);
      throw error;
    }
  },

  async deleteSupplierLedgerEntry(id: string): Promise<void> {
    try {
      const entryDoc = await getDoc(
        doc(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION, id),
      );

      if (!entryDoc.exists()) {
        throw new Error("Ledger entry not found");
      }

      const entryData = entryDoc.data() as SupplierLedgerEntry;
      const supplierId = entryData.supplierId;
      const clinicId = entryData.clinicId;
      const branchId = entryData.branchId;

      // Delete the entry
      await deleteDoc(doc(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION, id));

      // Recalculate balances for all subsequent entries
      const allEntries = await this.getSupplierLedgerEntries(
        supplierId,
        clinicId,
        branchId,
      );
      const deletedEntryIndex = allEntries.findIndex((e) => e.id === id);

      if (deletedEntryIndex !== -1) {
        // Recalculate from the entry before the deleted one
        const previousBalance =
          deletedEntryIndex > 0
            ? allEntries[deletedEntryIndex - 1].balanceAmount
            : 0;

        let runningBalance = previousBalance;

        for (let i = deletedEntryIndex; i < allEntries.length; i++) {
          const entry = allEntries[i];

          runningBalance =
            runningBalance + entry.debitAmount - entry.creditAmount;

          const entryDocRef = doc(
            db,
            SUPPLIER_LEDGER_ENTRIES_COLLECTION,
            entry.id,
          );

          await updateDoc(entryDocRef, {
            balanceAmount: runningBalance,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Error deleting supplier ledger entry:", error);
      throw error;
    }
  },

  // ============= UTILITY FUNCTIONS =============
  async getLowStockItems(
    clinicId: string,
  ): Promise<(MedicineStock & { medicine: Medicine })[]> {
    try {
      const stockItems = await this.getStockByClinic(clinicId);

      return stockItems.filter(
        (item) => item.currentStock <= item.reorderLevel,
      );
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      throw error;
    }
  },

  async getExpiringMedicines(
    clinicId: string,
    daysAhead: number = 30,
  ): Promise<Medicine[]> {
    try {
      const medicines = await this.getMedicinesByClinic(clinicId, true);
      const cutoffDate = new Date();

      cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

      return medicines.filter(
        (medicine) => medicine.expiryDate && medicine.expiryDate <= cutoffDate,
      );
    } catch (error) {
      console.error("Error fetching expiring medicines:", error);
      throw error;
    }
  },

  // ============= DAILY STOCK SNAPSHOTS =============
  async saveDailyStockSnapshot(
    clinicId: string,
    branchId: string | undefined,
    date: Date,
    totalStock: number,
  ): Promise<void> {
    try {
      // Create date string in YYYY-MM-DD format for consistent querying
      const dateStr = date.toISOString().split("T")[0];
      const docId = `${clinicId}_${branchId || "main"}_${dateStr}`;

      const snapshotData = {
        id: docId,
        clinicId,
        branchId: branchId || "",
        date: dateStr,
        totalStock,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, DAILY_STOCK_SNAPSHOTS_COLLECTION, docId);

      await setDoc(docRef, snapshotData, { merge: true });
    } catch (error) {
      console.error("Error saving daily stock snapshot:", error);
      throw error;
    }
  },

  async getDailyStockSnapshot(
    clinicId: string,
    branchId: string | undefined,
    date: Date,
  ): Promise<number | null> {
    try {
      const dateStr = date.toISOString().split("T")[0];
      const docId = `${clinicId}_${branchId || "main"}_${dateStr}`;

      const docRef = doc(db, DAILY_STOCK_SNAPSHOTS_COLLECTION, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return data.totalStock || null;
      }

      return null;
    } catch (error) {
      console.error("Error getting daily stock snapshot:", error);

      return null;
    }
  },
};
