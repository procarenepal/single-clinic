import type { ReactNode } from "react";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IoCloseOutline, IoPeopleOutline } from "react-icons/io5";

export interface StageListRow {
  id: string;
  patientId: string;
  name: string;
  reg: string;
  clinician: string;
  time?: string;
  stage: ReactNode;
}

interface StageListModalProps {
  isOpen: boolean;
  title: string;
  rows: StageListRow[];
  onClose: () => void;
}

/**
 * The patients behind one of the front-office stat cards, as a read-only list.
 * It deliberately offers no queue actions, so any role can open any card.
 */
export function StageListModal({
  isOpen,
  title,
  rows,
  onClose,
}: StageListModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />
      <div
        aria-label={title}
        aria-modal="true"
        className="bg-surface rounded border border-border-base shadow-xl max-w-lg w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
        role="dialog"
      >
        <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
          <h3 className="font-bold text-[14.5px] text-text-main flex items-center gap-2">
            {title}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {rows.length}
            </span>
          </h3>
          <button
            aria-label="Close"
            className="text-text-muted hover:text-text-main p-1"
            type="button"
            onClick={onClose}
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <IoPeopleOutline className="w-10 h-10 text-text-muted/20 mb-2" />
            <p className="text-[13px] text-text-muted">
              No patients here right now
            </p>
          </div>
        ) : (
          <ul className="overflow-y-auto divide-y divide-border-base">
            {rows.map((row) => (
              <li
                key={row.id}
                className="px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    className="block truncate text-[13px] font-semibold text-text-main hover:text-primary"
                    to={`/dashboard/patients/${row.patientId}`}
                    onClick={onClose}
                  >
                    {row.name}
                  </Link>
                  <p className="text-[11.5px] text-text-muted truncate">
                    {[row.reg, row.clinician, row.time]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {row.stage}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
