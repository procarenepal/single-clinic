/**
 * PatientNotesTab — Clinic Clarity, zero HeroUI
 * Flat card sections, native textarea, inline modals.
 */
import { useState, useEffect } from "react";
import {
  IoSaveOutline,
  IoDocumentTextOutline,
  IoTimeOutline,
  IoWarningOutline,
  IoTrashOutline,
  IoPencilOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { NotesSection, PatientNoteEntry } from "@/types/models";
import { notesSectionService } from "@/services/notesSectionService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { useAuthContext } from "@/context/AuthContext";

interface PatientNotesTabProps {
  patientId: string;
  clinicId: string;
}

// ── Section badge ────────────────────────────────────────────────────────────
function SectionBadge({ label }: { label: string }) {
  return (
    <span className="text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
      {label}
    </span>
  );
}

// ── Inline modal wrapper ─────────────────────────────────────────────────────
function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-surface border border-border-base rounded w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="px-4 py-3 border-b border-border-base/50">
          <p className="text-[14px] font-semibold text-text-main">{title}</p>
          {subtitle && <div className="mt-1">{subtitle}</div>}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 pb-4">{footer}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientNotesTab({
  patientId,
  clinicId,
}: PatientNotesTabProps) {
  const { currentUser } = useAuthContext();
  const [sections, setSections] = useState<NotesSection[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteEntries, setNoteEntries] = useState<PatientNoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit modal
  const [editEntry, setEditEntry] = useState<PatientNoteEntry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete modal
  const [deleteEntry, setDeleteEntry] = useState<PatientNoteEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fmtDateTime = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sects, entries] = await Promise.all([
        notesSectionService.getActiveSectionsByClinic(clinicId),
        PatientNoteEntriesService.getPatientNoteEntries(clinicId, patientId),
      ]);

      setSections(sects);
      setNoteEntries(entries);
      const init: Record<string, string> = {};

      sects.forEach((s) => {
        init[s.sectionKey] = "";
      });
      setNotes(init);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load notes.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId && patientId) loadData();
  }, [clinicId, patientId]);

  const handleNoteChange = (key: string, val: string) => {
    setNotes((p) => ({ ...p, [key]: val }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentUser) {
      addToast({ title: "Not logged in", color: "danger" });

      return;
    }
    const entries = Object.entries(notes).filter(([, v]) => v.trim());

    if (!entries.length) {
      addToast({ title: "Nothing to save", color: "warning" });

      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        entries.map(([key, content]) => {
          const s = sections.find((x) => x.sectionKey === key)!;

          return PatientNoteEntriesService.saveNoteEntry(
            clinicId,
            patientId,
            key,
            s.sectionLabel,
            content,
            currentUser.uid,
          );
        }),
      );
      const cleared: Record<string, string> = {};

      sections.forEach((s) => {
        cleared[s.sectionKey] = "";
      });
      setNotes(cleared);
      setHasChanges(false);
      await loadData();
      addToast({ title: `${entries.length} note(s) saved`, color: "success" });
    } catch {
      addToast({ title: "Save failed", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setEditLoading(true);
    try {
      await PatientNoteEntriesService.updateNoteEntry(
        editEntry.id,
        editContent,
      );
      await loadData();
      addToast({ title: "Note updated", color: "success" });
      setEditEntry(null);
    } catch {
      addToast({ title: "Update failed", color: "danger" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteEntry) return;
    setDeleteLoading(true);
    try {
      await PatientNoteEntriesService.deleteNoteEntry(deleteEntry.id);
      await loadData();
      addToast({ title: "Note deleted", color: "success" });
      setDeleteEntry(null);
    } catch {
      addToast({ title: "Delete failed", color: "danger" });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Loading / empty ────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading notes…" size="lg" />
      </div>
    );

  if (sections.length === 0) {
    return (
      <div className="py-16 text-center">
        <IoWarningOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
        <h3 className="text-[13px] font-semibold text-text-main mb-1">
          No Notes Sections Configured
        </h3>
        <p className="text-[12px] text-text-muted">
          Contact your clinic administrator to configure notes sections.
        </p>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-section-title text-text-main">Patient Notes</h2>
          <p className="text-[12.5px] text-text-muted">
            Document patient notes in configured sections
          </p>
        </div>
        <Button
          color="primary"
          disabled={!hasChanges || saving}
          isLoading={saving}
          size="sm"
          startContent={
            !saving ? <IoSaveOutline className="w-3.5 h-3.5" /> : undefined
          }
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save Notes"}
        </Button>
      </div>

      {/* Unsaved banner */}
      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-2 bg-saffron-50 border border-saffron-200 rounded">
          <IoWarningOutline className="w-4 h-4 text-saffron-600 shrink-0" />
          <span className="text-[12px] text-saffron-700">
            You have unsaved changes. Remember to save.
          </span>
        </div>
      )}

      {/* Form */}
      <div className="bg-surface border border-border-base rounded overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
          <IoDocumentTextOutline className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-text-main">
            Add New Notes
          </h3>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text-main">
                {s.sectionLabel}
              </label>
              {s.description && (
                <p className="text-[10.5px] text-text-muted">{s.description}</p>
              )}
              <textarea
                className="w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main
                  placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
                  resize-y"
                placeholder={`Enter notes for ${s.sectionLabel.toLowerCase()}…`}
                rows={4}
                value={notes[s.sectionKey] || ""}
                onChange={(e) => handleNoteChange(s.sectionKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* History table */}
      {noteEntries.length > 0 && (
        <div className="bg-surface border border-border-base rounded overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
            <div className="flex items-center gap-2">
              <IoTimeOutline className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-text-main">
                Notes History
              </h3>
            </div>
            <span className="text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
              {noteEntries.length}{" "}
              {noteEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border-base/50">
                  {["Section", "Content", "Date & Time", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="py-2 px-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-muted/60"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mountain-100">
                {noteEntries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-surface-2 transition-colors"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SectionBadge label={e.sectionLabel} />
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <p className="text-[12px] text-text-main/80 line-clamp-3">
                        {e.content}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-[11.5px] text-text-muted whitespace-nowrap">
                      {fmtDateTime(e.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Edit"
                          className="p-1 rounded text-teal-600 hover:bg-teal-50 transition-colors"
                          type="button"
                          onClick={() => {
                            setEditEntry(e);
                            setEditContent(e.content);
                          }}
                        >
                          <IoPencilOutline className="w-3.5 h-3.5" />
                        </button>
                        <button
                          aria-label="Delete"
                          className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                          type="button"
                          onClick={() => setDeleteEntry(e)}
                        >
                          <IoTrashOutline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {noteEntries.length === 0 && (
        <div className="bg-surface-2/50 border border-dashed border-border-base rounded py-10 text-center">
          <IoDocumentTextOutline className="mx-auto w-8 h-8 text-text-muted/30 mb-2" />
          <h3 className="text-[13px] font-medium text-text-main mb-1">
            No Notes Yet
          </h3>
          <p className="text-[12px] text-text-muted">
            Start documenting patient notes using the form above.
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editEntry && (
        <Modal
          footer={
            <>
              <Button
                color="default"
                disabled={editLoading}
                size="sm"
                variant="bordered"
                onClick={() => setEditEntry(null)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={!editContent.trim()}
                isLoading={editLoading}
                size="sm"
                startContent={
                  !editLoading ? (
                    <IoSaveOutline className="w-3.5 h-3.5" />
                  ) : undefined
                }
                onClick={handleSaveEdit}
              >
                {editLoading ? "Saving…" : "Save"}
              </Button>
            </>
          }
          subtitle={<SectionBadge label={editEntry.sectionLabel} />}
          title="Edit Note Entry"
          onClose={() => setEditEntry(null)}
        >
          <textarea
            className="w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-y"
            placeholder="Enter note content…"
            rows={6}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
        </Modal>
      )}

      {/* Delete modal */}
      {deleteEntry && (
        <Modal
          footer={
            <>
              <Button
                color="default"
                disabled={deleteLoading}
                size="sm"
                variant="bordered"
                onClick={() => setDeleteEntry(null)}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                isLoading={deleteLoading}
                size="sm"
                startContent={
                  !deleteLoading ? (
                    <IoTrashOutline className="w-3.5 h-3.5" />
                  ) : undefined
                }
                onClick={handleConfirmDelete}
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </Button>
            </>
          }
          subtitle={
            <span className="text-[11.5px] text-text-muted">
              This action cannot be undone.
            </span>
          }
          title="Delete Note Entry"
          onClose={() => setDeleteEntry(null)}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
              <IoWarningOutline className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[12px] text-red-700">
                You're about to permanently delete this note entry.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-medium text-text-muted">
                  Section:
                </span>
                <SectionBadge label={deleteEntry.sectionLabel} />
              </div>
              <div>
                <span className="text-[11.5px] font-medium text-text-muted">
                  Content preview:
                </span>
                <p className="text-[12px] text-text-muted bg-surface-2 border border-border-base/50 rounded p-2 mt-1 line-clamp-3">
                  {deleteEntry.content}
                </p>
              </div>
              <p className="text-[11px] text-text-muted/60">
                Created: {fmtDateTime(deleteEntry.createdAt)}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
