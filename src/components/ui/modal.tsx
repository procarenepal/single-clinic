/**
 * Custom Modal — Clinic Clarity design language, no HeroUI dependency.
 * Provides: Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
 */
import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline } from "react-icons/io5";

// ── useDisclosure ──────────────────────────────────────────────────────────
export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onOpenChange = useCallback((open: boolean) => setIsOpen(open), []);

  return { isOpen, onOpen, onClose, onOpenChange };
}

// ── Size map ───────────────────────────────────────────────────────────────
const sizeMap: Record<string, string> = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-[96vw]",
};

// ── Context ─────────────────────────────────────────────────────────────────
interface ModalCtx {
  onClose: () => void;
  isDismissable: boolean;
  hideCloseButton: boolean;
  scrollBehavior: "inside" | "outside";
  size: string;
}

const ModalContext = React.createContext<ModalCtx>({
  onClose: () => { },
  isDismissable: true,
  hideCloseButton: false,
  scrollBehavior: "inside",
  size: "md",
});

// ── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  size?: string;
  scrollBehavior?: "inside" | "outside";
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  classNames?: { wrapper?: string; backdrop?: string; base?: string };
  children?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  size = "md",
  scrollBehavior = "inside",
  isDismissable = true,
  hideCloseButton = false,
  children,
}: ModalProps) {
  // Lock scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen || !isDismissable) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isDismissable, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <ModalContext.Provider
      value={{ onClose, isDismissable, hideCloseButton, scrollBehavior, size }}
    >
      {/* Backdrop — semi-transparent, clinical */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9998] bg-mountain-900/30"
        onMouseDown={() => {
          if (isDismissable) onClose();
        }}
      />
      {/* Centering wrapper */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6 overflow-hidden pointer-events-none">
        {children}
      </div>
    </ModalContext.Provider>,
    document.body,
  );
}

// ── ModalContent ─────────────────────────────────────────────────────────────
interface ModalContentProps {
  children?: React.ReactNode;
  className?: string;
}

export function ModalContent({ children, className }: ModalContentProps) {
  const { size, scrollBehavior } = React.useContext(ModalContext);
  const widthClass = sizeMap[size] ?? "max-w-lg";

  return (
    <div
      /* Clinic Clarity elevated overlay: semantic surface, 1px border, rounded-md, NO shadow */
      className={[
        "pointer-events-auto relative bg-[rgb(var(--color-surface))]",
        "border border-[rgb(var(--color-border))] rounded-md",
        "flex flex-col w-full",
        widthClass,
        scrollBehavior === "inside" ? "max-h-[92vh]" : "",
        className ?? "",
      ].join(" ")}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ── ModalHeader ───────────────────────────────────────────────────────────────
interface ModalHeaderProps {
  children?: React.ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  const { onClose, hideCloseButton } = React.useContext(ModalContext);

  return (
    <div
      className={[
        "flex items-center justify-between",
        "px-4 py-2.5" /* compact — spec: px-4 py-3 */,
        "border-b border-[rgb(var(--color-border))]",
        "bg-[rgb(var(--color-surface-2))] rounded-t-md" /* subtle tinted header plane */,
        "shrink-0",
        className ?? "",
      ].join(" ")}
    >
      {/* Title area — spec: 15px, weight 700 */}
      <div className="flex flex-col gap-0.5 text-[13px] font-semibold text-[rgb(var(--color-text))] leading-snug tracking-[-0.01em]">
        {children}
      </div>

      {!hideCloseButton && (
        <button
          aria-label="Close"
          className={[
            "ml-3 shrink-0 flex items-center justify-center",
            "w-6 h-6 rounded",
            "text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-2))]",
            "transition-colors",
          ].join(" ")}
          type="button"
          onClick={onClose}
        >
          <IoCloseOutline className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── ModalBody ─────────────────────────────────────────────────────────────────
interface ModalBodyProps {
  children?: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  const { scrollBehavior } = React.useContext(ModalContext);

  return (
    <div
      className={[
        "px-4 py-3" /* spec: content padding px-4 py-3 */,
        "flex-1",
        scrollBehavior === "inside" ? "overflow-y-auto" : "",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// ── ModalFooter ───────────────────────────────────────────────────────────────
interface ModalFooterProps {
  children?: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={[
        "flex justify-end items-center gap-2",
        "px-4 py-2.5",
        "border-t border-[rgb(var(--color-border))]",
        "bg-[rgb(var(--color-surface-2))] rounded-b-md",
        "shrink-0",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

