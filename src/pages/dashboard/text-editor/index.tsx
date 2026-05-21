import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IoAddOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoEllipsisHorizontalOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { TextEditorComponent } from "@/components/text-editor/TextEditorComponent";
import { TextDocument } from "@/types/textEditor";
import { textEditorService } from "@/services/textEditorService";
import { branchService } from "@/services/branchService";
import { useAuthContext } from "@/context/AuthContext";
import { Branch } from "@/types/models";

export default function TextEditorPage() {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clinicId, currentUser, userData } = useAuthContext();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isMultiBranch, setIsMultiBranch] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<TextDocument | null>(
    null,
  );

  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<TextDocument | null>(
    null,
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const isEditMode = documentId || searchParams.get("mode") === "create";

  useEffect(() => {
    if (!clinicId) return;
    loadInitialData();
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    if (isEditMode) return;
    loadDocuments();
  }, [clinicId, selectedBranchId, currentPage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const isMultiBranchEnabled =
        await branchService.isMultiBranchEnabled(clinicId);

      setIsMultiBranch(isMultiBranchEnabled);

      if (isMultiBranchEnabled) {
        const branchList = await branchService.getClinicBranches(clinicId);

        setBranches(branchList);
        if (userData?.branchId) {
          setSelectedBranchId(userData.branchId);
        } else if (branchList.length > 0) {
          const mainBranch =
            branchList.find((b) => b.isMainBranch) || branchList[0];

          setSelectedBranchId(mainBranch.id);
        }
      }

      if (documentId) {
        await handleEditDocument(documentId);
      } else if (searchParams.get("mode") === "create") {
        setIsEditorOpen(true);
        setEditingDocument(null);
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
      addToast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const branchId = isMultiBranch ? selectedBranchId : undefined;
      const result = await textEditorService.getDocuments(
        clinicId,
        branchId,
        10,
        currentPage > 1 ? (documents[documents.length - 1] as any) : undefined,
      );

      setDocuments(result.documents);
      setTotalPages(Math.ceil(result.documents.length / 10));
    } catch (error) {
      console.error("Error loading documents:", error);
      addToast({
        title: "Error",
        description: "Failed to load documents",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDocuments();

      return;
    }
    try {
      setSearching(true);
      const branchId = isMultiBranch ? selectedBranchId : undefined;
      const results = await textEditorService.searchDocuments(
        clinicId,
        searchQuery.trim(),
        branchId,
      );

      setDocuments(results);
    } catch (error) {
      console.error("Error searching documents:", error);
      addToast({
        title: "Error",
        description: "Failed to search documents",
        color: "danger",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleCreateNew = () => {
    setEditingDocument(null);
    setIsEditorOpen(true);
  };

  const handleEditDocument = async (docId: string) => {
    try {
      const document = await textEditorService.getDocumentById(docId);

      if (document) {
        setEditingDocument(document);
        setIsEditorOpen(true);
      } else {
        addToast({
          title: "Error",
          description: "Document not found",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error loading document:", error);
      addToast({
        title: "Error",
        description: "Failed to load document",
        color: "danger",
      });
    }
  };

  const handleSaveDocument = (savedDocument: TextDocument) => {
    if (editingDocument) {
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === savedDocument.id ? savedDocument : doc)),
      );
    } else {
      setDocuments((prev) => [savedDocument, ...prev]);
    }
    setIsEditorOpen(false);
    setEditingDocument(null);
    if (searchParams.get("mode") === "create") {
      navigate("/dashboard/text-editor", { replace: true });
    }
  };

  const handleCancelEdit = () => {
    setIsEditorOpen(false);
    setEditingDocument(null);
    if (documentId || searchParams.get("mode") === "create") {
      navigate("/dashboard/text-editor", { replace: true });
    }
  };

  const handleDeleteDocument = async () => {
    if (!deletingDocument) return;
    try {
      await textEditorService.deleteDocument(deletingDocument.id);
      setDocuments((prev) =>
        prev.filter((doc) => doc.id !== deletingDocument.id),
      );
      addToast({
        title: "Success",
        description: "Document deleted successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      addToast({
        title: "Error",
        description: "Failed to delete document",
        color: "danger",
      });
    } finally {
      setDeleteOpen(false);
      setDeletingDocument(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading && !documents.length) {
    return (
      <div className="flex items-center justify-center min-h-96 text-[rgb(var(--color-text-muted))]">
        Loading documents...
      </div>
    );
  }

  if (isEditorOpen) {
    return (
      <TextEditorComponent
        branchId={isMultiBranch ? selectedBranchId : undefined}
        clinicId={clinicId}
        document={editingDocument || undefined}
        onCancel={handleCancelEdit}
        onSave={handleSaveDocument}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="clarity-page-header">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Text Editor & Documents
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Create, edit, and manage clinical documents and templates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="clarity-btn clarity-btn-primary"
            type="button"
            onClick={handleCreateNew}
          >
            <IoAddOutline aria-hidden className="w-4 h-4" />
            New Document
          </button>
        </div>
      </div>

      <div className="clarity-card p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6 relative">
            <IoSearchOutline
              aria-hidden
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-text-muted))] pointer-events-none"
            />
            <input
              aria-label="Search documents"
              className="clarity-input with-left-icon w-full"
              placeholder="Search documents..."
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          {isMultiBranch && branches.length > 0 && (
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                Branch
              </label>
              <select
                aria-label="Branch"
                className="clarity-input w-full"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} {branch.isMainBranch ? "(Main)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <button
              className="clarity-btn clarity-btn-primary w-full md:w-auto"
              disabled={searching}
              type="button"
              onClick={handleSearch}
            >
              <IoSearchOutline aria-hidden className="w-4 h-4" />
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      </div>

      <div className="clarity-card overflow-hidden">
        <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
          <h3 className="text-base font-semibold text-[rgb(var(--color-text))]">
            {searchQuery ? `Search Results (${documents.length})` : "Documents"}
          </h3>
        </div>
        <div className="p-3">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <IoDocumentTextOutline
                aria-hidden
                className="mx-auto text-[rgb(var(--color-text-muted))] text-4xl mb-3"
              />
              <h3 className="text-base font-medium text-[rgb(var(--color-text))] mb-2">
                {searchQuery ? "No documents found" : "No documents yet"}
              </h3>
              <p className="text-sm text-[rgb(var(--color-text-muted))] mb-4">
                {searchQuery
                  ? "Try adjusting your search terms or filters"
                  : "Create your first document to get started"}
              </p>
              {!searchQuery && (
                <button
                  className="clarity-btn clarity-btn-primary"
                  type="button"
                  onClick={handleCreateNew}
                >
                  <IoAddOutline aria-hidden className="w-4 h-4" />
                  Create Document
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table
                  aria-label="Documents table"
                  className="clarity-table w-full"
                >
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Tags</th>
                      <th>Modified</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div>
                            <p className="font-medium text-[rgb(var(--color-text))]">
                              {doc.title}
                            </p>
                            <p className="text-xs text-[rgb(var(--color-text-muted))] line-clamp-1">
                              {doc.content.substring(0, 60)}...
                            </p>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {(doc.tags || []).slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="clarity-badge bg-teal-100 text-teal-700"
                              >
                                {tag}
                              </span>
                            ))}
                            {(doc.tags || []).length > 2 && (
                              <span className="text-xs text-[rgb(var(--color-text-muted))]">
                                +{(doc.tags || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <p className="text-sm text-[rgb(var(--color-text))]">
                            {formatDate(doc.updatedAt)}
                          </p>
                        </td>
                        <td>
                          <div
                            ref={
                              openDropdownId === doc.id
                                ? dropdownRef
                                : undefined
                            }
                            className="relative"
                          >
                            <button
                              aria-expanded={openDropdownId === doc.id}
                              aria-haspopup="true"
                              aria-label="Document actions"
                              className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
                              type="button"
                              onClick={() =>
                                setOpenDropdownId(
                                  openDropdownId === doc.id ? null : doc.id,
                                )
                              }
                            >
                              <IoEllipsisHorizontalOutline
                                aria-hidden
                                className="w-4 h-4"
                              />
                            </button>
                            {openDropdownId === doc.id && (
                              <div
                                className="absolute right-0 top-full mt-1 min-w-[140px] clarity-card py-1 z-10"
                                role="menu"
                              >
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleEditDocument(doc.id);
                                  }}
                                >
                                  <IoPencilOutline
                                    aria-hidden
                                    className="w-4 h-4 shrink-0"
                                  />
                                  Edit
                                </button>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setDeletingDocument(doc);
                                    setOpenDropdownId(null);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <IoTrashOutline
                                    aria-hidden
                                    className="w-4 h-4 shrink-0"
                                  />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {documents.length > 0 && totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    className="clarity-btn clarity-btn-ghost"
                    disabled={currentPage <= 1}
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="flex items-center px-3 text-sm text-[rgb(var(--color-text-muted))]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="clarity-btn clarity-btn-ghost"
                    disabled={currentPage >= totalPages}
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isDeleteOpen && (
        <div
          aria-labelledby="delete-doc-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setDeleteOpen(false);
              setDeletingDocument(null);
            }}
          />
          <div className="clarity-panel w-full max-w-md p-4 relative z-10">
            <h3
              className="text-base font-semibold text-[rgb(var(--color-text))] mb-2"
              id="delete-doc-modal-title"
            >
              Confirm Deletion
            </h3>
            <p className="text-sm text-[rgb(var(--color-text))] mb-4">
              Are you sure you want to delete &quot;{deletingDocument?.title}
              &quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletingDocument(null);
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-danger"
                type="button"
                onClick={handleDeleteDocument}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
