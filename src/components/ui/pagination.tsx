import React from "react";
import clsx from "clsx";
import { IoChevronBackOutline, IoChevronForwardOutline } from "react-icons/io5";

export interface PaginationProps {
  total: number;
  page: number;
  onChange?: (page: number) => void;
  className?: string;
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

  const pages = Array.from({ length: total }, (_, i) => i + 1);

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
          "w-8 h-8 flex items-center justify-center rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary hover:bg-surface-2 transition-all",
        )}
        disabled={page <= 1}
        type="button"
        onClick={() => handleChange(page - 1)}
      >
        <IoChevronBackOutline className="w-4 h-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={clsx(
            "w-8 h-8 flex items-center justify-center rounded border text-sm font-medium transition-all",
            p === page
              ? "bg-primary text-white border-primary shadow-sm"
              : "border-border-base text-text-muted hover:border-primary/50 hover:text-primary hover:bg-surface-2",
          )}
          type="button"
          onClick={() => handleChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        className={clsx(
          "w-8 h-8 flex items-center justify-center rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary hover:bg-surface-2 transition-all",
        )}
        disabled={page >= total}
        type="button"
        onClick={() => handleChange(page + 1)}
      >
        <IoChevronForwardOutline className="w-4 h-4" />
      </button>
    </nav>
  );
};
