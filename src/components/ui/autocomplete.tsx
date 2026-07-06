/**
 * Custom Autocomplete — no HeroUI dependency.
 * Renders a text input with a filtered dropdown list.
 */
import React, { useRef, useState, useEffect, useMemo } from "react";

// ── AutocompleteItem ──────────────────────────────────────────────────────────
export interface AutocompleteItemProps {
  key?: React.Key;
  textValue?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Marker component only — Autocomplete extracts its data via React.Children */
export function AutocompleteItem(_: AutocompleteItemProps) {
  return null;
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
export interface AutocompleteProps {
  label?: string;
  placeholder?: string;
  selectedKey?: React.Key | null;
  defaultSelectedKey?: React.Key | null;
  onSelectionChange?: (key: React.Key | null) => void;
  isLoading?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  className?: string;
  /** Ignored (compat shim) */
  onOpenChange?: (open: boolean) => void;
  popoverProps?: any;
  listboxProps?: any;
  children?: React.ReactNode;
}

export function Autocomplete({
  label,
  placeholder = "Search…",
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  isLoading,
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  description,
  className,
  children,
}: AutocompleteProps) {
  // ── Build item list from children ─────────────────────────────────────────
  const rawItems = useMemo(() => {
    const list: {
      key: React.Key;
      textValue: string;
      label: React.ReactNode;
    }[] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const p = child.props as AutocompleteItemProps;
      const key = (child.key as React.Key) ?? p.key;

      if (key == null) return;
      list.push({
        key,
        textValue:
          p.textValue ??
          (typeof p.children === "string" ? p.children : String(key)),
        label: p.children ?? p.textValue ?? String(key),
      });
    });

    return list;
  }, [children]);

  // ── Controlled / uncontrolled ─────────────────────────────────────────────
  const isControlled = selectedKey !== undefined;
  const [internalKey, setInternalKey] = useState<React.Key | null>(
    defaultSelectedKey ?? null,
  );
  const currentKey = isControlled ? (selectedKey ?? null) : internalKey;

  const currentLabel =
    rawItems.find((i) => String(i.key) === String(currentKey))?.textValue ?? "";

  const [query, setQuery] = useState(currentLabel);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query when controlled selection changes from outside
  useEffect(() => {
    setQuery(currentLabel);
  }, [currentLabel]);

  const filtered = useMemo(() => {
    if (!query.trim() || query === currentLabel) return rawItems;
    const q = query.trim().toLowerCase();

    return rawItems.filter((i) => i.textValue.toLowerCase().includes(q));
  }, [query, rawItems, currentLabel]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // Restore label text if user typed but didn't pick
        setQuery(currentLabel);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, [currentLabel]);

  const handleSelect = (key: React.Key) => {
    const item = rawItems.find((i) => i.key === key);
    const newLabel = item?.textValue ?? "";

    setQuery(newLabel);
    setOpen(false);
    if (!isControlled) setInternalKey(key);
    onSelectionChange?.(key);
  };

  const handleClear = () => {
    setQuery("");
    setOpen(false);
    if (!isControlled) setInternalKey(null);
    onSelectionChange?.(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1 ${className ?? ""}`}
    >
      {label && (
        <label className="text-sm font-medium text-text-main">
          {label}
          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div
        className={`flex items-center border rounded-lg min-h-[38px] bg-surface transition-colors cursor-text ${
          isInvalid
            ? "border-red-400 focus-within:ring-red-100"
            : "border-border-base focus-within:border-primary focus-within:ring-primary/20"
        } focus-within:ring-1 ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className="flex-1 text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/70 w-full"
          disabled={isDisabled}
          placeholder={placeholder}
          required={isRequired}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onDoubleClick={(e) => {
            if (e.target instanceof HTMLInputElement) {
              e.target.select();
            }
          }}
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
        />
        {isLoading ? (
          <span className="pr-2 text-text-muted text-xs">Loading…</span>
        ) : currentKey ? (
          <button
            aria-label="Clear selection"
            className="pr-2 text-text-muted hover:text-text-main shrink-0"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            aria-label="Toggle dropdown"
            className="pr-2 text-text-muted hover:text-text-main shrink-0"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && !isDisabled && (
        <div className="absolute top-full left-0 right-0 z-[1100] mt-1 bg-surface border border-border-base rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-text-muted italic">
              No results
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.key}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-primary/5 hover:text-primary transition-colors ${
                  String(item.key) === String(currentKey)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-main"
                }`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item.key);
                }}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      )}

      {!isInvalid && description && (
        <p className="text-xs text-text-muted">{description}</p>
      )}
      {isInvalid && errorMessage && (
        <p className="text-xs text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}
