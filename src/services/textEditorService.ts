import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  limit,
  DocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import {
  TextDocument,
  CreateTextDocumentRequest,
  UpdateTextDocumentRequest,
} from "@/types/textEditor";

const TEXT_DOCUMENTS_COLLECTION = "textDocuments";

class TextEditorService {
  /**
   * Create a new text document
   */
  async createDocument(data: CreateTextDocumentRequest): Promise<string> {
    try {
      // Filter out undefined values to prevent Firestore errors
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }

        return acc;
      }, {} as any);

      const docData = {
        ...cleanData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastModifiedBy: data.createdBy,
      };

      const docRef = await addDoc(
        collection(db, TEXT_DOCUMENTS_COLLECTION),
        docData,
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating text document:", error);
      throw error;
    }
  }

  /**
   * Get a text document by ID
   */
  async getDocumentById(id: string): Promise<TextDocument | null> {
    try {
      const docRef = doc(db, TEXT_DOCUMENTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as TextDocument;
      }

      return null;
    } catch (error) {
      console.error("Error getting text document:", error);
      throw error;
    }
  }

  /**
   * Update a text document
   */
  async updateDocument(
    id: string,
    data: UpdateTextDocumentRequest,
  ): Promise<void> {
    try {
      // Filter out undefined values to prevent Firestore errors
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }

        return acc;
      }, {} as any);

      const docRef = doc(db, TEXT_DOCUMENTS_COLLECTION, id);

      await updateDoc(docRef, {
        ...cleanData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating text document:", error);
      throw error;
    }
  }

  /**
   * Delete a text document
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      const docRef = doc(db, TEXT_DOCUMENTS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting text document:", error);
      throw error;
    }
  }

  /**
   * Get text documents for a clinic (with optional branch filtering)
   */
  async getDocuments(
    clinicId: string,
    branchId?: string,
    pageSize = 20,
    lastDoc?: DocumentSnapshot,
  ): Promise<{
    documents: TextDocument[];
    hasMore: boolean;
    lastDoc?: DocumentSnapshot;
  }> {
    try {
      let q = query(
        collection(db, TEXT_DOCUMENTS_COLLECTION),

        limit(pageSize + 1), // fetch one extra to check hasMore
      );

      // Add branch filtering for multi-branch clinics
      if (branchId) {
        q = query(
          collection(db, TEXT_DOCUMENTS_COLLECTION),

          where("branchId", "==", branchId),
          limit(pageSize + 1),
        );
      }

      const querySnapshot = await getDocs(q);
      const allDocs = querySnapshot.docs;
      const hasMore = allDocs.length > pageSize;
      const pageDocs = hasMore ? allDocs.slice(0, pageSize) : allDocs;

      // Sort client-side by updatedAt descending (avoids composite index requirement)
      const documents: TextDocument[] = pageDocs
        .map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as TextDocument;
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return {
        documents,
        hasMore,
        lastDoc: pageDocs[pageDocs.length - 1],
      };
    } catch (error) {
      console.error("Error getting text documents:", error);
      throw error;
    }
  }

  /**
   * Search documents by title or content
   */
  async searchDocuments(
    clinicId: string,
    searchTerm: string,
    branchId?: string,
  ): Promise<TextDocument[]> {
    try {
      // Note: This is a basic implementation. For better search functionality,
      // consider using Algolia or implementing full-text search with Firestore
      let q = query(
        collection(db, TEXT_DOCUMENTS_COLLECTION),

      );

      if (branchId) {
        q = query(q, where("branchId", "==", branchId));
      }

      // Sort client-side by updatedAt descending (avoids composite index requirement)
      const querySnapshot = await getDocs(q);
      const documents: TextDocument[] = [];

      querySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const document = {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as TextDocument;

        // Client-side filtering by search term
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = document.title.toLowerCase().includes(searchLower);
        const contentMatch = document.content
          .toLowerCase()
          .includes(searchLower);
        const tagsMatch = document.tags?.some((tag) =>
          tag.toLowerCase().includes(searchLower),
        );

        if (titleMatch || contentMatch || tagsMatch) {
          documents.push(document);
        }
      });

      // Sort by updatedAt descending
      return documents.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch (error) {
      console.error("Error searching text documents:", error);
      throw error;
    }
  }
}

export const textEditorService = new TextEditorService();
