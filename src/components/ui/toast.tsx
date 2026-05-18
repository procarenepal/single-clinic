/**
 * Clinic Clarity — Custom Toast System
 * No HeroUI. Flat design, compact, theme-aware.
 * Usage:
 *   toast.success("Saved successfully")
 *   toast.error("Failed to save")
 *   toast.info("12 patients loaded")
 *   toast({ title: "Done", description: "Patient updated." })
 *   addToast({ title: "Done", description: "...", color: "success" })  ← HeroUI compat
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import clsx from "clsx";
import {
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoInformationCircleOutline,
  IoCloseOutline,
  IoWarningOutline,
} from "react-icons/io5";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastColor =
  | "default"
  | "success"
  | "danger"
  | "warning"
  | "primary";

export interface ToastOptions {
  title: string;
  description?: string;
  color?: ToastColor;
  duration?: number; // ms — default 4000
  id?: string;
}

interface ToastItem
  extends Required<Pick<ToastOptions, "id" | "title" | "duration" | "color">> {
  description?: string;
  removing?: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface ToastCtx {
  add: (opts: ToastOptions) => string;
  remove: (id: string) => void;
}

const Ctx = createContext<ToastCtx>({
  add: () => "",
  remove: () => {},
});

let _add: ((opts: ToastOptions) => string) | null = null;

// ── Provider ──────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children?: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const remove = useCallback((id: string) => {
    // Fade out first, then remove
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const add = useCallback(
    (opts: ToastOptions): string => {
      const id = opts.id ?? `toast-${++counterRef.current}-${Date.now()}`;
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        color: opts.color ?? "default",
        duration: opts.duration ?? 4000,
      };

      setToasts((prev) => [...prev.slice(-4), item]); // max 5 visible
      if (item.duration > 0) {
        setTimeout(() => remove(id), item.duration);
      }

      return id;
    },
    [remove],
  );

  // Expose globally so `addToast` works outside React tree
  useEffect(() => {
    _add = add;

    return () => {
      _add = null;
    };
  }, [add]);

  return (
    <Ctx.Provider value={{ add, remove }}>
      {children}
      {/* Toast portal — fixed top-right stack */}
      <div
        aria-atomic="false"
        aria-live="polite"
        className="fixed top-3 right-3 z-[10000] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastEl
            key={toast.id}
            toast={toast}
            onDismiss={() => remove(toast.id)}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
};

// ── Single toast element ──────────────────────────────────────────────────────
const COLOR_STYLES: Record<
  ToastColor,
  {
    bar: string;
    icon: React.FC<{ className?: string }>;
    iconCls: string;
  }
> = {
  default: {
    bar: "bg-text-muted",
    icon: IoInformationCircleOutline,
    iconCls: "text-text-muted",
  },
  primary: {
    bar: "bg-primary",
    icon: IoInformationCircleOutline,
    iconCls: "text-primary",
  },
  success: {
    bar: "bg-success",
    icon: IoCheckmarkCircleOutline,
    iconCls: "text-success",
  },
  danger: {
    bar: "bg-danger",
    icon: IoAlertCircleOutline,
    iconCls: "text-danger",
  },
  warning: {
    bar: "bg-warning",
    icon: IoWarningOutline,
    iconCls: "text-warning",
  },
};

const ToastEl: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const {
    bar,
    icon: Icon,
    iconCls,
  } = COLOR_STYLES[toast.color] ?? COLOR_STYLES.default;

  return (
    <div
      className={clsx(
        // Layout
        "relative flex items-start gap-2.5 pointer-events-auto",
        "w-[300px] max-w-[90vw]",
        // Flat design — border only, no shadow
        "bg-surface border border-border-base rounded shadow-lg",
        "px-3 py-2.5 overflow-hidden",
        // Transition
        "transition-all duration-200",
        toast.removing
          ? "opacity-0 translate-x-4"
          : "opacity-100 translate-x-0",
      )}
      role="alert"
    >
      {/* Left color bar */}
      <div className={clsx("absolute left-0 inset-y-0 w-1 rounded-l", bar)} />

      {/* Icon */}
      <span className={clsx("mt-0.5 shrink-0", iconCls)}>
        <Icon className="w-4 h-4" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-text-main leading-tight">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs text-text-muted mt-0.5 leading-tight">
            {toast.description}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        aria-label="Dismiss"
        className="shrink-0 text-text-muted hover:text-text-main transition-colors"
        type="button"
        onClick={onDismiss}
      >
        <IoCloseOutline className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(Ctx);

  return {
    toast: ctx.add,
    dismiss: ctx.remove,
  };
}

// ── Imperative API ────────────────────────────────────────────────────────────
// Works outside React tree — e.g. in service functions.
// Drop-in replacement for HeroUI's `addToast`.
export function addToast(opts: ToastOptions): string {
  if (_add) return _add(opts);
  console.warn(
    "[Toast] ToastProvider not mounted. Toast not shown:",
    opts.title,
  );

  return "";
}

// Shorthand helpers
export const toast = {
  success: (title: string, description?: string) =>
    addToast({ title, description, color: "success" }),
  error: (title: string, description?: string) =>
    addToast({ title, description, color: "danger" }),
  warning: (title: string, description?: string) =>
    addToast({ title, description, color: "warning" }),
  info: (title: string, description?: string) =>
    addToast({ title, description, color: "primary" }),
  show: (opts: ToastOptions) => addToast(opts),
};
