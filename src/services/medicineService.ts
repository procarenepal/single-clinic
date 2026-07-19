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

      // Clear cache on mutation
      if (typeof window !== "undefined") {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith("cache_medicines_")) sessionStorage.removeItem(key);
        });
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine:", error);
      throw error;
    }
  },

  async getMedicinesByClinic(
    clinicId?: string,
    isActive?: boolean,
    branchId?: string,
  ): Promise<Medicine[]> {
    try {
      const cacheKey = `cache_medicines_${clinicId}_${isActive}_${branchId}`;
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // 5-minute cache for medicine definitions (they rarely change)
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            // Restore dates
            return data.map((m: any) => ({
              ...m,
              createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
              updatedAt: m.updatedAt ? new Date(m.updatedAt) : undefined,
              expiryDate: m.expiryDate ? new Date(m.expiryDate) : undefined,
            }));
          }
        }
      }

      const constraints: any[] = [];
      if (typeof isActive === "boolean") {
        constraints.push(where("isActive", "==", isActive));
      }

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(collection(db, MEDICINES_COLLECTION), ...constraints);

      const querySnapshot = await getDocs(q);
      const medicines = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
        } as Medicine;
      });

      const sortedMedicines = medicines.sort((a, b) => a.name.localeCompare(b.name));

      if (typeof window !== "undefined") {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: sortedMedicines,
          timestamp: Date.now()
        }));
      }

      return sortedMedicines;
    } catch (error) {
      console.error("Error fetching medicines:", error);
      throw error;
    }
  },

  async getMedicinesByClinicPaginated(
    clinicId?: string,
    options: {
      pageSize: number;
      lastDoc?: QueryDocumentSnapshot | null;
      searchPrefix?: string;
      branchId?: string;
    } = {} as any,
  ): Promise<{ medicines: Medicine[]; lastDoc: QueryDocumentSnapshot | null }> {
    try {
      const { pageSize, lastDoc, searchPrefix, branchId } = options;
      const baseConstraints: any[] = [];
      /*
      if (clinicId && clinicId !== "standalone" && clinicId !== "default") {
        baseConstraints.push(where("clinicId", "==", clinicId));
      }
      */

      if (branchId) {
        baseConstraints.push(where("branchId", "==", branchId));
      }

      // Fetch all to handle in-memory search and pagination without composite indices
      const q = query(collection(db, MEDICINES_COLLECTION), ...baseConstraints);

      const querySnapshot = await getDocs(q);
      let allMedicines = querySnapshot.docs.map((d) => {
        const data = d.data();

        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
        } as Medicine;
      });

      // Handle search in memory
      if (searchPrefix != null && searchPrefix !== "") {
        const prefix = searchPrefix.toLowerCase().trim();

        allMedicines = allMedicines.filter((m) =>
          m.name.toLowerCase().startsWith(prefix),
        );
      }

      // Sort by name in memory
      allMedicines.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      // Handle pagination in memory
      let startIndex = 0;

      if (lastDoc) {
        startIndex = allMedicines.findIndex((m) => m.id === lastDoc.id) + 1;
      }

      const paginatedMedicines = allMedicines.slice(
        startIndex,
        startIndex + pageSize,
      );
      const last =
        paginatedMedicines.length === pageSize
          ? querySnapshot.docs.find(
            (d) =>
              d.id === paginatedMedicines[paginatedMedicines.length - 1].id,
          ) || null
          : null;

      return { medicines: paginatedMedicines, lastDoc: last as any };
    } catch (error) {
      console.error("Error fetching medicines (paginated):", error);
      throw error;
    }
  },

  async getMedicinesCountByClinic(
    clinicId?: string,
    searchPrefix?: string,
    branchId?: string,
  ): Promise<number> {
    try {
      const baseConstraints: any[] = [];
      /*
      if (clinicId && clinicId !== "standalone" && clinicId !== "default") {
        baseConstraints.push(where("clinicId", "==", clinicId));
      }
      */

      if (branchId) {
        baseConstraints.push(where("branchId", "==", branchId));
      }

      const q = query(collection(db, MEDICINES_COLLECTION), ...baseConstraints);

      const querySnapshot = await getDocs(q);
      let count = querySnapshot.size;

      if (searchPrefix != null && searchPrefix !== "") {
        const prefix = searchPrefix.toLowerCase().trim();

        count = querySnapshot.docs.filter((doc) =>
          (doc.data().name || "").toLowerCase().startsWith(prefix),
        ).length;
      }

      return count;
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

      // Clear cache on mutation
      if (typeof window !== "undefined") {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith("cache_medicines_")) sessionStorage.removeItem(key);
        });
      }
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
        ...this.stripUndefined(stockData),
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
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
        );
      } else {
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
        );
      }
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return null;

      // Aggregate all active stock entries for this medicine
      const stocks: MedicineStock[] = querySnapshot.docs.map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          ...data,
          currentStock: data.currentStock ?? 0,
          schemeStock: data.schemeStock ?? 0,
          expiryDate: data.expiryDate?.toDate
            ? data.expiryDate.toDate()
            : data.expiryDate
              ? new Date(data.expiryDate)
              : undefined,
          manufactureDate: data.manufactureDate?.toDate
            ? data.manufactureDate.toDate()
            : data.manufactureDate
              ? new Date(data.manufactureDate)
              : undefined,
          lastRestocked: data.lastRestocked?.toDate
            ? data.lastRestocked.toDate()
            : data.lastRestocked
              ? new Date(data.lastRestocked)
              : undefined,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt
              ? new Date(data.createdAt)
              : undefined,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : data.updatedAt
              ? new Date(data.updatedAt)
              : undefined,
        } as MedicineStock;
      });

      // Sum up regular and scheme stocks
      const totalCurrentStock = stocks.reduce(
        (acc, curr) => acc + curr.currentStock,
        0,
      );
      const totalSchemeStock = stocks.reduce(
        (acc, curr) => acc + curr.schemeStock,
        0,
      );

      // Find the first stock document to preserve main details (min stock, reorder levels, etc.)
      const baseStock = stocks[0];

      return {
        ...baseStock,
        currentStock: totalCurrentStock,
        schemeStock: totalSchemeStock,
      };
    } catch (error) {
      console.error("Error fetching medicine stock:", error);
      throw error;
    }
  },

  async getMedicineStocks(
    medicineId: string,
    clinicId?: string,
  ): Promise<MedicineStock[]> {
    try {
      let q;

      if (clinicId) {
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
        );
      } else {
        q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          where("medicineId", "==", medicineId),
        );
      }
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          ...data,
          expiryDate: data.expiryDate?.toDate
            ? data.expiryDate.toDate()
            : data.expiryDate
              ? new Date(data.expiryDate)
              : undefined,
          manufactureDate: data.manufactureDate?.toDate
            ? data.manufactureDate.toDate()
            : data.manufactureDate
              ? new Date(data.manufactureDate)
              : undefined,
          lastRestocked: data.lastRestocked?.toDate
            ? data.lastRestocked.toDate()
            : data.lastRestocked
              ? new Date(data.lastRestocked)
              : undefined,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt
              ? new Date(data.createdAt)
              : undefined,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : data.updatedAt
              ? new Date(data.updatedAt)
              : undefined,
        } as MedicineStock;
      });
    } catch (error) {
      console.error("Error fetching medicine stocks:", error);
      throw error;
    }
  },

  async getMedicineStockByBatch(
    medicineId: string,
    batchNumber: string,
    clinicId: string,
  ): Promise<MedicineStock | null> {
    try {
      const q = query(
        collection(db, MEDICINE_STOCK_COLLECTION),
        where("medicineId", "==", medicineId),
        where("batchNumber", "==", batchNumber),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return null;

      const docVal = querySnapshot.docs[0];
      const data = docVal.data();

      return {
        id: docVal.id,
        ...data,
        expiryDate: data.expiryDate?.toDate(),
        manufactureDate: data.manufactureDate?.toDate(),
        lastRestocked: data.lastRestocked?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as MedicineStock;
    } catch (error) {
      console.error("Error getting medicine stock by batch:", error);
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
      // Create a deterministic cache key
      const sortedIds = [...medicineIds].sort().join(",");
      // Use a hashing mechanism for the cache key to avoid excessively long strings in sessionStorage
      let hash = 0;
      for (let i = 0; i < sortedIds.length; i++) {
        const char = sortedIds.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const cacheKey = `cache_stock_${clinicId}_${branchId}_${hash}`;

      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // 2-minute cache for stock quantities 
          // (Safe because actual checkout reads live DB inside runTransaction anyway)
          if (Date.now() - timestamp < 2 * 60 * 1000) {
            return data;
          }
        }
      }

      const BATCH_SIZE = 30; // Firestore 'in' query limit
      const results: {
        medicineId: string;
        currentStock: number;
        schemeStock: number;
      }[] = [];

      const promises = [];

      for (let i = 0; i < medicineIds.length; i += BATCH_SIZE) {
        const batch = medicineIds.slice(i, i + BATCH_SIZE);
        const constraints: any[] = [where("medicineId", "in", batch)];

        if (branchId) {
          constraints.push(where("branchId", "==", branchId));
        }

        const q = query(
          collection(db, MEDICINE_STOCK_COLLECTION),
          ...constraints,
        );

        promises.push(getDocs(q));
      }

      const snapshots = await Promise.all(promises);

      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const existing = results.find(
            (r) => r.medicineId === data.medicineId,
          );

          if (existing) {
            existing.currentStock += data.currentStock ?? 0;
            existing.schemeStock += data.schemeStock ?? 0;
          } else {
            results.push({
              medicineId: data.medicineId,
              currentStock: data.currentStock ?? 0,
              schemeStock: data.schemeStock ?? 0,
            });
          }
        });
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: results,
          timestamp: Date.now()
        }));
      }

      return results;
    } catch (error) {
      console.error("Error fetching stock by medicine IDs:", error);
      throw error;
    }
  },

  // Helper to remove undefined fields before sending to Firestore
  stripUndefined(obj: any): any {
    const newObj: any = {};

    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        newObj[key] = obj[key];
      }
    });

    return newObj;
  },

  async updateMedicineStock(
    id: string,
    updateData: Partial<MedicineStock>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_STOCK_COLLECTION, id);

      await updateDoc(docRef, {
        ...this.stripUndefined(updateData),
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
        ...this.stripUndefined(transactionData),
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

      const q = query(
        collection(db, STOCK_TRANSACTIONS_COLLECTION),
        ...constraints,
      );
      const querySnapshot = await getDocs(q);

      const transactions = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
          isSchemeStock: data.isSchemeStock ?? false, // Default to false for backward compatibility
        } as StockTransaction;
      });

      // Sort in-memory to avoid compound index requirements
      transactions.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;

        return timeB - timeA; // Descending
      });

      // Apply limit in memory
      return transactions.slice(0, limitCount);
    } catch (error: any) {
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

      // We'll filter in memory

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

      // Sort by createdAt desc in memory
      transactions.sort((a, b) => {
        const dateA = a.createdAt
          ? a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
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
        ...this.stripUndefined(supplierData),
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

          where("branchId", "==", branchId),
        );
      } else {
        q = query(collection(db, SUPPLIERS_COLLECTION));
      }
      const querySnapshot = await getDocs(q);

      const suppliers = querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Supplier;
      });

      // Sort by name in memory
      return suppliers.sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
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
        ...this.stripUndefined(updateData),
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
        ...this.stripUndefined(recordData),
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

          where("branchId", "==", branchId),
        );
      } else {
        q = query(collection(db, PURCHASE_RECORDS_COLLECTION));
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

      // Sort by purchaseDate desc in memory
      return records.sort(
        (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime(),
      );
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
        ...this.stripUndefined(updateData),
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
        );
      } else {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),
          where("supplierId", "==", supplierId),
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

      // Sort by purchaseDate desc in memory
      return records.sort(
        (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime(),
      );
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

          where("branchId", "==", branchId),
          where("paymentStatus", "in", ["pending", "partial"]),
        );
      } else {
        q = query(
          collection(db, PURCHASE_RECORDS_COLLECTION),

          where("paymentStatus", "in", ["pending", "partial"]),
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

      // Sort by purchaseDate asc in memory
      records.sort(
        (a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime(),
      );

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
      const payload: Record<string, any> = this.stripUndefined({
        ...paymentData,
        date:
          paymentData.date instanceof Date
            ? paymentData.date
            : new Date(paymentData.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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

          where("branchId", "==", branchId),
        );
      } else {
        q = query(collection(db, SUPPLIER_PAYMENTS_COLLECTION));
      }

      const snapshot = await getDocs(q);

      const payments = snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierPayment;
      });

      // Sort by date desc in memory
      return payments.sort((a, b) => {
        const dateA = a.date
          ? a.date instanceof Date
            ? a.date.getTime()
            : new Date(a.date).getTime()
          : 0;
        const dateB = b.date
          ? b.date instanceof Date
            ? b.date.getTime()
            : new Date(b.date).getTime()
          : 0;

        return dateB - dateA;
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

          where("branchId", "==", branchId),
          where("supplierId", "==", supplierId),
        );
      } else {
        q = query(
          collection(db, SUPPLIER_PAYMENTS_COLLECTION),

          where("supplierId", "==", supplierId),
        );
      }

      const snapshot = await getDocs(q);

      const payments = snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierPayment;
      });

      // Sort by date desc in memory
      return payments.sort((a, b) => {
        const dateA = a.date
          ? a.date instanceof Date
            ? a.date.getTime()
            : new Date(a.date).getTime()
          : 0;
        const dateB = b.date
          ? b.date instanceof Date
            ? b.date.getTime()
            : new Date(b.date).getTime()
          : 0;

        return dateB - dateA;
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
        ...this.stripUndefined(updateData),
        updatedAt: serverTimestamp(),
      };

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

          where("branchId", "==", branchId),
          where("supplierId", "==", supplierId),
        );
      } else {
        q = query(
          collection(db, SUPPLIER_LEDGER_ENTRIES_COLLECTION),

          where("supplierId", "==", supplierId),
        );
      }

      const snapshot = await getDocs(q);

      const entries = snapshot.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          ...data,
          transactionDate: data.transactionDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SupplierLedgerEntry;
      });

      // Sort in memory by createdAt to avoid composite index requirement
      return entries.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;

        return timeA - timeB;
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
  // ============= SEEDING =============
  async seedDefaultMedicines(
    clinicId: string,
    branchId: string | undefined,
    userId: string,
  ): Promise<void> {
    try {
      // 1. Create categories
      const categories = [
        { name: "Analgesic", description: "Pain relief" },
        { name: "Antibiotic", description: "Infection treatment" },
        { name: "Antihistamine", description: "Allergy relief" },
        { name: "Supplements", description: "Vitamins and minerals" },
        { name: "Cardiovascular", description: "Heart and lipid medications" },
        {
          name: "Gastrointestinal",
          description: "Stomach and bowel medications",
        },
        { name: "Antidiabetic", description: "Blood sugar control" },
        { name: "Antihypertensive", description: "Blood pressure control" },
        { name: "Respiratory", description: "Asthma and allergy inhalers" },
        { name: "Dermatological", description: "Skin ointments and gels" },
        { name: "Pediatric", description: "Children suspensions and drops" },
      ];

      const catMap: Record<string, string> = {};

      for (const cat of categories) {
        const id = await this.createMedicineCategory({
          ...cat,
          clinicId,
          branchId: branchId || "",
          isActive: true,
          createdBy: userId,
        });

        catMap[cat.name] = id;
      }

      // 1.5. Create brands
      const brandsList = [
        { name: "GSK", description: "GlaxoSmithKline plc" },
        { name: "Pfizer", description: "Pfizer Inc." },
        { name: "Novartis", description: "Novartis International AG" },
        { name: "Cipla", description: "Cipla Limited" },
        { name: "Sun Pharma", description: "Sun Pharmaceutical Industries" },
        { name: "Abbott", description: "Abbott Laboratories" },
        { name: "Torrent", description: "Torrent Pharmaceuticals" },
        { name: "Alkem", description: "Alkem Laboratories" },
        { name: "Lupin", description: "Lupin Limited" },
        { name: "NPL", description: "Nepal Pharmaceuticals Laboratory" },
      ];

      const brandMap: Record<string, string> = {};

      for (const b of brandsList) {
        const id = await this.createMedicineBrand({
          ...b,
          clinicId,
          branchId: branchId || "",
          isActive: true,
          createdBy: userId,
        });

        brandMap[b.name] = id;
      }

      // 2. Create medicines (exactly 50 items)
      const meds = [
        // Analgesics (5)
        {
          name: "Paracetamol 500mg",
          genericName: "Paracetamol",
          categoryId: catMap["Analgesic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: false,
          price: 5,
          costPrice: 2,
          isActive: true,
        },
        {
          name: "Ibuprofen 400mg",
          genericName: "Ibuprofen",
          categoryId: catMap["Analgesic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "400mg",
          prescriptionRequired: false,
          price: 8,
          costPrice: 4,
          isActive: true,
        },
        {
          name: "Diclofenac Sodium 50mg",
          genericName: "Diclofenac",
          categoryId: catMap["Analgesic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "50mg",
          prescriptionRequired: true,
          price: 10,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Tramadol Hydrochloride 50mg",
          genericName: "Tramadol",
          categoryId: catMap["Analgesic"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "50mg",
          prescriptionRequired: true,
          price: 25,
          costPrice: 10,
          isActive: true,
        },
        {
          name: "Morphine Sulfate 10mg",
          genericName: "Morphine",
          categoryId: catMap["Analgesic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: true,
          price: 80,
          costPrice: 40,
          isActive: true,
        },
        // Antibiotics (5)
        {
          name: "Amoxicillin 250mg",
          genericName: "Amoxicillin",
          categoryId: catMap["Antibiotic"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "250mg",
          prescriptionRequired: true,
          price: 15,
          costPrice: 8,
          isActive: true,
        },
        {
          name: "Amoxicillin 500mg",
          genericName: "Amoxicillin",
          categoryId: catMap["Antibiotic"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "500mg",
          prescriptionRequired: true,
          price: 25,
          costPrice: 12,
          isActive: true,
        },
        {
          name: "Azithromycin 500mg",
          genericName: "Azithromycin",
          categoryId: catMap["Antibiotic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: true,
          price: 50,
          costPrice: 22,
          isActive: true,
        },
        {
          name: "Ciprofloxacin 500mg",
          genericName: "Ciprofloxacin",
          categoryId: catMap["Antibiotic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: true,
          price: 30,
          costPrice: 15,
          isActive: true,
        },
        {
          name: "Doxycycline 100mg",
          genericName: "Doxycycline",
          categoryId: catMap["Antibiotic"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "100mg",
          prescriptionRequired: true,
          price: 20,
          costPrice: 9,
          isActive: true,
        },
        // Antihistamines (4)
        {
          name: "Cetirizine 10mg",
          genericName: "Cetirizine",
          categoryId: catMap["Antihistamine"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: false,
          price: 8,
          costPrice: 3,
          isActive: true,
        },
        {
          name: "Loratadine 10mg",
          genericName: "Loratadine",
          categoryId: catMap["Antihistamine"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: false,
          price: 12,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Fexofenadine 120mg",
          genericName: "Fexofenadine",
          categoryId: catMap["Antihistamine"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "120mg",
          prescriptionRequired: false,
          price: 22,
          costPrice: 10,
          isActive: true,
        },
        {
          name: "Levocetirizine 5mg",
          genericName: "Levocetirizine",
          categoryId: catMap["Antihistamine"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "5mg",
          prescriptionRequired: false,
          price: 10,
          costPrice: 4,
          isActive: true,
        },
        // Supplements (5)
        {
          name: "Vitamin D3",
          genericName: "Cholecalciferol",
          categoryId: catMap["Supplements"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "60000 IU",
          prescriptionRequired: false,
          price: 25,
          costPrice: 12,
          isActive: true,
        },
        {
          name: "Vitamin C 500mg",
          genericName: "Ascorbic Acid",
          categoryId: catMap["Supplements"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: false,
          price: 6,
          costPrice: 2,
          isActive: true,
        },
        {
          name: "B-Complex with Zinc",
          genericName: "Multivitamin",
          categoryId: catMap["Supplements"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "Standard",
          prescriptionRequired: false,
          price: 10,
          costPrice: 4,
          isActive: true,
        },
        {
          name: "Calcium Carbonate 500mg",
          genericName: "Calcium",
          categoryId: catMap["Supplements"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: false,
          price: 12,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Iron Polymaltose 100mg",
          genericName: "Iron",
          categoryId: catMap["Supplements"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "100mg",
          prescriptionRequired: false,
          price: 18,
          costPrice: 8,
          isActive: true,
        },
        // Antidiabetic (5)
        {
          name: "Metformin 500mg",
          genericName: "Metformin",
          categoryId: catMap["Antidiabetic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "500mg",
          prescriptionRequired: true,
          price: 6,
          costPrice: 2,
          isActive: true,
        },
        {
          name: "Metformin 850mg",
          genericName: "Metformin",
          categoryId: catMap["Antidiabetic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "850mg",
          prescriptionRequired: true,
          price: 9,
          costPrice: 4,
          isActive: true,
        },
        {
          name: "Glimepiride 1mg",
          genericName: "Glimepiride",
          categoryId: catMap["Antidiabetic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "1mg",
          prescriptionRequired: true,
          price: 12,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Glimepiride 2mg",
          genericName: "Glimepiride",
          categoryId: catMap["Antidiabetic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "2mg",
          prescriptionRequired: true,
          price: 18,
          costPrice: 8,
          isActive: true,
        },
        {
          name: "Sitagliptin 50mg",
          genericName: "Sitagliptin",
          categoryId: catMap["Antidiabetic"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "50mg",
          prescriptionRequired: true,
          price: 35,
          costPrice: 15,
          isActive: true,
        },
        // Antihypertensive (5)
        {
          name: "Amlodipine 5mg",
          genericName: "Amlodipine",
          categoryId: catMap["Antihypertensive"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "5mg",
          prescriptionRequired: true,
          price: 5,
          costPrice: 2,
          isActive: true,
        },
        {
          name: "Amlodipine 10mg",
          genericName: "Amlodipine",
          categoryId: catMap["Antihypertensive"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: true,
          price: 8,
          costPrice: 3,
          isActive: true,
        },
        {
          name: "Losartan 50mg",
          genericName: "Losartan",
          categoryId: catMap["Antihypertensive"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "50mg",
          prescriptionRequired: true,
          price: 12,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Losartan 100mg",
          genericName: "Losartan",
          categoryId: catMap["Antihypertensive"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "100mg",
          prescriptionRequired: true,
          price: 20,
          costPrice: 9,
          isActive: true,
        },
        {
          name: "Telmisartan 40mg",
          genericName: "Telmisartan",
          categoryId: catMap["Antihypertensive"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "40mg",
          prescriptionRequired: true,
          price: 15,
          costPrice: 6,
          isActive: true,
        },
        // Cardiovascular (4)
        {
          name: "Atorvastatin 10mg",
          genericName: "Atorvastatin",
          categoryId: catMap["Cardiovascular"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: true,
          price: 18,
          costPrice: 8,
          isActive: true,
        },
        {
          name: "Atorvastatin 20mg",
          genericName: "Atorvastatin",
          categoryId: catMap["Cardiovascular"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "20mg",
          prescriptionRequired: true,
          price: 28,
          costPrice: 12,
          isActive: true,
        },
        {
          name: "Rosuvastatin 10mg",
          genericName: "Rosuvastatin",
          categoryId: catMap["Cardiovascular"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: true,
          price: 25,
          costPrice: 10,
          isActive: true,
        },
        {
          name: "Clopidogrel 75mg",
          genericName: "Clopidogrel",
          categoryId: catMap["Cardiovascular"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "75mg",
          prescriptionRequired: true,
          price: 16,
          costPrice: 7,
          isActive: true,
        },
        // Gastrointestinal (5)
        {
          name: "Pantoprazole 40mg",
          genericName: "Pantoprazole",
          categoryId: catMap["Gastrointestinal"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "40mg",
          prescriptionRequired: false,
          price: 12,
          costPrice: 5,
          isActive: true,
        },
        {
          name: "Omeprazole 20mg",
          genericName: "Omeprazole",
          categoryId: catMap["Gastrointestinal"],
          type: "capsule" as const,
          unit: "capsule" as const,
          strength: "20mg",
          prescriptionRequired: false,
          price: 8,
          costPrice: 3,
          isActive: true,
        },
        {
          name: "Ranitidine 150mg",
          genericName: "Ranitidine",
          categoryId: catMap["Gastrointestinal"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "150mg",
          prescriptionRequired: false,
          price: 5,
          costPrice: 2,
          isActive: true,
        },
        {
          name: "Domperidone 10mg",
          genericName: "Domperidone",
          categoryId: catMap["Gastrointestinal"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: false,
          price: 7,
          costPrice: 3,
          isActive: true,
        },
        {
          name: "Oral Rehydration Salts (ORS)",
          genericName: "Sachet",
          categoryId: catMap["Gastrointestinal"],
          type: "sachet" as const,
          unit: "sachet" as const,
          strength: "20.5g",
          prescriptionRequired: false,
          price: 15,
          costPrice: 5,
          isActive: true,
        },
        // Respiratory (3)
        {
          name: "Montelukast 10mg",
          genericName: "Montelukast",
          categoryId: catMap["Respiratory"],
          type: "tablet" as const,
          unit: "tablet" as const,
          strength: "10mg",
          prescriptionRequired: true,
          price: 20,
          costPrice: 8,
          isActive: true,
        },
        {
          name: "Salbutamol Inhaler 100mcg",
          genericName: "Salbutamol",
          categoryId: catMap["Respiratory"],
          type: "inhaler" as const,
          unit: "device" as const,
          strength: "100mcg",
          prescriptionRequired: true,
          price: 280,
          costPrice: 150,
          isActive: true,
        },
        {
          name: "Levosalbutamol 1.25mg",
          genericName: "Levosalbutamol",
          categoryId: catMap["Respiratory"],
          type: "respules" as const,
          unit: "vial" as const,
          strength: "1.25mg",
          prescriptionRequired: true,
          price: 15,
          costPrice: 6,
          isActive: true,
        },
        // Dermatological (5)
        {
          name: "Hydrocortisone Cream 1%",
          genericName: "Hydrocortisone",
          categoryId: catMap["Dermatological"],
          type: "cream" as const,
          unit: "tube" as const,
          strength: "1%",
          prescriptionRequired: false,
          price: 60,
          costPrice: 25,
          isActive: true,
        },
        {
          name: "Ketoconazole Cream 2%",
          genericName: "Ketoconazole",
          categoryId: catMap["Dermatological"],
          type: "cream" as const,
          unit: "tube" as const,
          strength: "2%",
          prescriptionRequired: false,
          price: 110,
          costPrice: 50,
          isActive: true,
        },
        {
          name: "Mupirocin Ointment 2%",
          genericName: "Mupirocin",
          categoryId: catMap["Dermatological"],
          type: "ointment" as const,
          unit: "tube" as const,
          strength: "2%",
          prescriptionRequired: true,
          price: 180,
          costPrice: 80,
          isActive: true,
        },
        {
          name: "Salicylic Acid Gel 2%",
          genericName: "Salicylic Acid",
          categoryId: catMap["Dermatological"],
          type: "gel" as const,
          unit: "tube" as const,
          strength: "2%",
          prescriptionRequired: false,
          price: 140,
          costPrice: 60,
          isActive: true,
        },
        {
          name: "Clindamycin Gel 1%",
          genericName: "Clindamycin",
          categoryId: catMap["Dermatological"],
          type: "gel" as const,
          unit: "tube" as const,
          strength: "1%",
          prescriptionRequired: true,
          price: 160,
          costPrice: 70,
          isActive: true,
        },
        // Pediatric (4)
        {
          name: "Paracetamol Syrup 125mg/5ml",
          genericName: "Paracetamol",
          categoryId: catMap["Pediatric"],
          type: "syrup" as const,
          unit: "bottle" as const,
          strength: "125mg/5ml",
          prescriptionRequired: false,
          price: 45,
          costPrice: 20,
          isActive: true,
        },
        {
          name: "Ibuprofen Suspension 100mg/5ml",
          genericName: "Ibuprofen",
          categoryId: catMap["Pediatric"],
          type: "suspension" as const,
          unit: "bottle" as const,
          strength: "100mg/5ml",
          prescriptionRequired: false,
          price: 55,
          costPrice: 25,
          isActive: true,
        },
        {
          name: "Multivitamin Drops",
          genericName: "Vitamin Drops",
          categoryId: catMap["Pediatric"],
          type: "drops" as const,
          unit: "bottle" as const,
          strength: "Standard",
          prescriptionRequired: false,
          price: 90,
          costPrice: 40,
          isActive: true,
        },
        {
          name: "Zinc Sulfate Syrup 20mg/5ml",
          genericName: "Zinc Sulfate",
          categoryId: catMap["Pediatric"],
          type: "syrup" as const,
          unit: "bottle" as const,
          strength: "20mg/5ml",
          prescriptionRequired: false,
          price: 65,
          costPrice: 30,
          isActive: true,
        },
      ];

      let index = 0;
      const brandKeys = Object.keys(brandMap);

      for (const med of meds) {
        // Clinically assign a brand or fallback to random
        let brandName = "GSK";

        if (med.categoryId === catMap["Analgesic"])
          brandName = index % 2 === 0 ? "GSK" : "Novartis";
        else if (med.categoryId === catMap["Antibiotic"])
          brandName = index % 2 === 0 ? "GSK" : "Pfizer";
        else if (med.categoryId === catMap["Antihistamine"])
          brandName = index % 2 === 0 ? "GSK" : "Pfizer";
        else if (med.categoryId === catMap["Supplements"])
          brandName = index % 2 === 0 ? "Abbott" : "Pfizer";
        else if (med.categoryId === catMap["Antidiabetic"])
          brandName = index % 2 === 0 ? "Sun Pharma" : "Novartis";
        else if (med.categoryId === catMap["Antihypertensive"])
          brandName = index % 2 === 0 ? "Sun Pharma" : "Torrent";
        else if (med.categoryId === catMap["Cardiovascular"])
          brandName = index % 2 === 0 ? "Lupin" : "Sun Pharma";
        else if (med.categoryId === catMap["Gastrointestinal"])
          brandName = index % 2 === 0 ? "Alkem" : "NPL";
        else if (med.categoryId === catMap["Respiratory"]) brandName = "Cipla";
        else if (med.categoryId === catMap["Dermatological"])
          brandName = index % 2 === 0 ? "Pfizer" : "Alkem";
        else if (med.categoryId === catMap["Pediatric"]) brandName = "NPL";

        const brandId =
          brandMap[brandName] || brandKeys[index % brandKeys.length];

        const medicineId = await this.createMedicine({
          ...med,
          brandId,
          manufacturer: brandName,
          clinicId,
          branchId: branchId || "",
          createdBy: userId,
        });

        // Determine a realistic stock count (make 5 items low stock, others high stock)
        const isLowStockItem = index < 5;
        const currentStock = isLowStockItem
          ? Math.floor(3 + Math.random() * 6)
          : Math.floor(100 + Math.random() * 150);

        // Generate a future expiry date (e.g. 1 to 2 years from now)
        const futureExpiry = new Date();

        futureExpiry.setMonth(
          futureExpiry.getMonth() + Math.floor(12 + Math.random() * 12),
        );

        const seededBatchNumber =
          "B" + Math.floor(100000 + Math.random() * 900000);

        // Create Stock Record
        await this.createMedicineStock({
          medicineId,
          currentStock,
          schemeStock: 0,
          minimumStock: 10,
          reorderLevel: 20,
          clinicId,
          branchId: branchId || "",
          updatedBy: userId,
          batchNumber: seededBatchNumber,
          expiryDate: futureExpiry,
          costPrice: med.costPrice,
          salePrice: med.price,
        });

        // Create Stock Transaction for Audit Trail
        await this.createStockTransaction({
          medicineId,
          type: "purchase" as const,
          quantity: currentStock,
          previousStock: 0,
          newStock: currentStock,
          batchNumber: seededBatchNumber,
          expiryDate: futureExpiry,
          costPrice: med.costPrice,
          salePrice: med.price,
          clinicId,
          branchId: branchId || "",
          createdBy: userId,
        });

        index++;
      }
    } catch (error) {
      console.error("Error seeding medicines:", error);
      throw error;
    }
  },
};
