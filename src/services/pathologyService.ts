import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  PathologyTest,
  PathologyCategory,
  PathologyUnit,
  PathologyParameter,
  PathologyTestType,
} from "../types/models";

const PATHOLOGY_TESTS_COLLECTION = "pathologyTests";
const PATHOLOGY_CATEGORIES_COLLECTION = "pathologyCategories";
const PATHOLOGY_UNITS_COLLECTION = "pathologyUnits";
const PATHOLOGY_PARAMETERS_COLLECTION = "pathologyParameters";
const PATHOLOGY_TEST_TYPES_COLLECTION = "pathologyTestTypes";

// Helper to strip out undefined values before sending data to Firestore
function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });

  return cleaned as T;
}

/**
 * Service for managing pathology data
 */
export const pathologyService = {
  // ============= PATHOLOGY TESTS =============

  /**
   * Get all pathology tests for a specific clinic
   * Note: patientId is now optional, patientName is required
   */
  async getTestsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyTest[]> {
    try {
      const testsRef = collection(db, PATHOLOGY_TESTS_COLLECTION);
      let q = query(
        testsRef,

        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          testsRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const tests: PathologyTest[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        tests.push({
          id: doc.id,
          ...data,
          // Ensure patientId is optional (may not exist in older records)
          patientId: data.patientId || undefined,
          // Ensure patientName exists (required field)
          patientName: data.patientName || "Unknown",
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyTest);
      });

      // Sort by createdAt descending in memory to avoid index error
      return tests.sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting pathology tests by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a pathology test by ID
   */
  async getTestById(id: string): Promise<PathologyTest | null> {
    try {
      const docRef = doc(db, PATHOLOGY_TESTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyTest;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology test by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology test
   */
  async createTest(
    testData: Omit<PathologyTest, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const testsRef = collection(db, PATHOLOGY_TESTS_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...testData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(testsRef, data);

      console.log("Pathology test created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology test:", error);
      throw error;
    }
  },

  /**
   * Update a pathology test
   */
  async updateTest(
    id: string,
    updates: Partial<Omit<PathologyTest, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_TESTS_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Pathology test updated successfully");
    } catch (error) {
      console.error("Error updating pathology test:", error);
      throw error;
    }
  },

  /**
   * Delete a pathology test (soft delete)
   */
  async deleteTest(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_TESTS_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Pathology test deleted successfully");
    } catch (error) {
      console.error("Error deleting pathology test:", error);
      throw error;
    }
  },

  // ============= PATHOLOGY CATEGORIES =============

  /**
   * Get all pathology categories for a specific clinic
   */
  async getCategoriesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyCategory[]> {
    try {
      const categoriesRef = collection(db, PATHOLOGY_CATEGORIES_COLLECTION);
      let q = query(
        categoriesRef,

        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          categoriesRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const categories: PathologyCategory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        categories.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyCategory);
      });

      // Sort by name ascending in memory
      return categories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting pathology categories by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a pathology category by ID
   */
  async getCategoryById(id: string): Promise<PathologyCategory | null> {
    try {
      const docRef = doc(db, PATHOLOGY_CATEGORIES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyCategory;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology category by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology category
   */
  async createCategory(
    categoryData: Omit<PathologyCategory, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const categoriesRef = collection(db, PATHOLOGY_CATEGORIES_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...categoryData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(categoriesRef, data);

      console.log("Pathology category created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology category:", error);
      throw error;
    }
  },

  /**
   * Update a pathology category
   */
  async updateCategory(
    id: string,
    updates: Partial<Omit<PathologyCategory, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_CATEGORIES_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Pathology category updated successfully");
    } catch (error) {
      console.error("Error updating pathology category:", error);
      throw error;
    }
  },

  /**
   * Delete a pathology category (soft delete)
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_CATEGORIES_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Pathology category deleted successfully");
    } catch (error) {
      console.error("Error deleting pathology category:", error);
      throw error;
    }
  },

  // ============= PATHOLOGY UNITS =============

  /**
   * Get all pathology units for a specific clinic
   */
  async getUnitsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyUnit[]> {
    try {
      const unitsRef = collection(db, PATHOLOGY_UNITS_COLLECTION);
      let q = query(
        unitsRef,

        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          unitsRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const units: PathologyUnit[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        units.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyUnit);
      });

      // Sort by name ascending in memory
      return units.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting pathology units by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a pathology unit by ID
   */
  async getUnitById(id: string): Promise<PathologyUnit | null> {
    try {
      const docRef = doc(db, PATHOLOGY_UNITS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyUnit;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology unit by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology unit
   */
  async createUnit(
    unitData: Omit<PathologyUnit, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const unitsRef = collection(db, PATHOLOGY_UNITS_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...unitData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(unitsRef, data);

      console.log("Pathology unit created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology unit:", error);
      throw error;
    }
  },

  /**
   * Update a pathology unit
   */
  async updateUnit(
    id: string,
    updates: Partial<Omit<PathologyUnit, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_UNITS_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Pathology unit updated successfully");
    } catch (error) {
      console.error("Error updating pathology unit:", error);
      throw error;
    }
  },

  /**
   * Delete a pathology unit (soft delete)
   */
  async deleteUnit(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_UNITS_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Pathology unit deleted successfully");
    } catch (error) {
      console.error("Error deleting pathology unit:", error);
      throw error;
    }
  },

  // ============= PATHOLOGY PARAMETERS =============

  /**
   * Get all pathology parameters for a specific clinic
   */
  async getParametersByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyParameter[]> {
    try {
      const parametersRef = collection(db, PATHOLOGY_PARAMETERS_COLLECTION);
      let q = query(
        parametersRef,

        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          parametersRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const parameters: PathologyParameter[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        parameters.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyParameter);
      });

      // Sort by name ascending in memory
      return parameters.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting pathology parameters by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a pathology parameter by ID
   */
  async getParameterById(id: string): Promise<PathologyParameter | null> {
    try {
      const docRef = doc(db, PATHOLOGY_PARAMETERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyParameter;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology parameter by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology parameter
   */
  async createParameter(
    parameterData: Omit<PathologyParameter, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const parametersRef = collection(db, PATHOLOGY_PARAMETERS_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...parameterData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(parametersRef, data);

      console.log("Pathology parameter created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology parameter:", error);
      throw error;
    }
  },

  /**
   * Update a pathology parameter
   */
  async updateParameter(
    id: string,
    updates: Partial<
      Omit<PathologyParameter, "id" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_PARAMETERS_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Pathology parameter updated successfully");
    } catch (error) {
      console.error("Error updating pathology parameter:", error);
      throw error;
    }
  },

  /**
   * Delete a pathology parameter (soft delete)
   */
  async deleteParameter(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_PARAMETERS_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Pathology parameter deleted successfully");
    } catch (error) {
      console.error("Error deleting pathology parameter:", error);
      throw error;
    }
  },

  // ============= PATHOLOGY TEST TYPES =============

  /**
   * Get all pathology test types for a specific clinic
   */
  async getTestTypesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyTestType[]> {
    try {
      const testTypesRef = collection(db, PATHOLOGY_TEST_TYPES_COLLECTION);
      let q = query(
        testTypesRef,

        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          testTypesRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const testTypes: PathologyTestType[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        testTypes.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyTestType);
      });

      // Sort by name ascending in memory
      return testTypes.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting pathology test types by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a pathology test type by ID
   */
  async getTestTypeById(id: string): Promise<PathologyTestType | null> {
    try {
      const docRef = doc(db, PATHOLOGY_TEST_TYPES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PathologyTestType;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology test type by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology test type
   */
  async createTestType(
    testTypeData: Omit<PathologyTestType, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const testTypesRef = collection(db, PATHOLOGY_TEST_TYPES_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...testTypeData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(testTypesRef, data);

      console.log("Pathology test type created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology test type:", error);
      throw error;
    }
  },

  /**
   * Update a pathology test type
   */
  async updateTestType(
    id: string,
    updates: Partial<Omit<PathologyTestType, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_TEST_TYPES_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Pathology test type updated successfully");
    } catch (error) {
      console.error("Error updating pathology test type:", error);
      throw error;
    }
  },

  /**
   * Delete a pathology test type (soft delete)
   */
  async deleteTestType(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATHOLOGY_TEST_TYPES_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Pathology test type deleted successfully");
    } catch (error) {
      console.error("Error deleting pathology test type:", error);
      throw error;
    }
  },
};
