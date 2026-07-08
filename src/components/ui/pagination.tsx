import React from "react";
import clsx from "clsx";
import { IoChevronBackOutline, IoChevronForwardOutline } from "react-icons/io5";

export interface PaginationProps {
  total: number;
  page: number;
  onChange?: (page: number) => void;
  className?: string;
}

function getVisiblePages(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  onChange,
  className,
}) => {
  if (total <= 1) return null;

  const handleChange = (next: number) => {
    if (next < 1 || next > total) return;
    onChange?.(next);
  };

  const pages = getVisiblePages(page, total);

  return (
    <nav
      className={clsx(
        "flex items-center justify-center gap-1.5 text-sm",
        className,
      )}
    >
      <button
        aria-label="Previous page"
        className={clsx(
          "h-8 px-2 flex items-center justify-center gap-1 rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary hover:bg-surface-2 transition-all",
        )}
        disabled={page <= 1}
        type="button"
        onClick={() => handleChange(page - 1)}
      >
        <IoChevronBackOutline className="w-4 h-4" />
        <span>Prev</span>
      </button>
      {pages.map((p, index) => {
        if (p === "...") {
          return (
            <span key={`ellipsis-${index}`} className="px-1 text-text-muted">
              ...
            </span>
          );
        }

        return (
          <button
            key={p}
            className={clsx(
              "min-w-[32px] h-8 px-1.5 flex items-center justify-center rounded border text-sm font-medium transition-all",
              p === page
                ? "bg-primary text-white border-primary shadow-sm"
                : "border-border-base text-text-muted hover:border-primary/50 hover:text-primary hover:bg-surface-2",
            )}
            type="button"
            onClick={() => handleChange(p as number)}
          >
            {p}
          </button>
        );
      })}
      <button
        aria-label="Next page"
        className={clsx(
          "h-8 px-2 flex items-center justify-center gap-1 rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary hover:bg-surface-2 transition-all",
        )}
        disabled={page >= total}
        type="button"
        onClick={() => handleChange(page + 1)}
      >
        <span>Next</span>
        <IoChevronForwardOutline className="w-4 h-4" />
      </button>
    </nav>
  );
};
