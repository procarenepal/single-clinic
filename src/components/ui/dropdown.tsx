/**
 * Clinic Clarity — Custom Dropdown
 * Fully custom, zero HeroUI dependency.
 * Enhanced premium design with glassmorphism and smooth transitions.
 */
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

// ── Placement ─────────────────────────────────────────────────────────────────
type Placement =
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "top"
  | "top-start"
  | "top-end";

// ── Context ───────────────────────────────────────────────────────────────────
interface DropdownCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  placement: Placement;
}

const Ctx = createContext<DropdownCtx>({
  open: false,
  setOpen: () => { },
  triggerRef: { current: null },
  menuRef: { current: null },
  placement: "bottom-end",
});

// ── Dropdown (root) ───────────────────────────────────────────────────────────
export interface DropdownProps {
  children: ReactNode;
  placement?: Placement;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  placement = "bottom-end",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const isOutsideTrigger =
        triggerRef.current && !triggerRef.current.contains(e.target as Node);
      const isOutsideMenu =
        menuRef.current && !menuRef.current.contains(e.target as Node);

      if (isOutsideTrigger && isOutsideMenu) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handler);

    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen, triggerRef, menuRef, placement }}>
      <div className={clsx("relative inline-flex", className)}>{children}</div>
    </Ctx.Provider>
  );
};

// ── DropdownTrigger ───────────────────────────────────────────────────────────
export interface DropdownTriggerProps {
  children: ReactNode;
  className?: string;
}

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({
  children,
  className,
}) => {
  const { open, setOpen, triggerRef } = useContext(Ctx);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  return (
    <div
      ref={triggerRef}
      aria-expanded={open}
      aria-haspopup="menu"
      className={clsx("inline-flex cursor-pointer", className)}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(!open);
        }
      }}
    >
      {children}
    </div>
  );
};

// ── DropdownMenu ──────────────────────────────────────────────────────────────
export interface DropdownMenuProps {
  children: ReactNode;
  className?: string;
  /** aria-label for accessibility */
  "aria-label"?: string;
  /** Whether the menu should match the width of the trigger */
  matchTriggerWidth?: boolean;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  className,
  "aria-label": ariaLabel,
  matchTriggerWidth,
}) => {
  const { open, setOpen, triggerRef, menuRef, placement } = useContext(Ctx);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width?: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    const gap = 6; // slightly more gap for modern feel

    switch (placement) {
      case "bottom-start":
        top = triggerRect.bottom + gap;
        left = triggerRect.left;
        break;
      case "bottom-end":
        top = triggerRect.bottom + gap;
        left = triggerRect.right - menuRect.width;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
        break;
      case "top-start":
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.left;
        break;
      case "top-end":
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.right - menuRect.width;
        break;
      case "top":
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
        break;
    }

    setCoords({ top, left, width: matchTriggerWidth ? triggerRect.width : undefined });
  }, [placement, matchTriggerWidth]);

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    } else {
      setCoords(null);
    }
  }, [open, updatePosition, children]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      aria-label={ariaLabel}
      className={clsx(
        "z-[9999] min-w-[180px]",
        "bg-surface/85 backdrop-blur-xl border border-border-base rounded-xl",
        "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.1)]",
        "py-1.5 overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-200 cubic-bezier(0.16, 1, 0.3, 1)",
        className,
      )}
      role="menu"
      style={{
        position: "fixed",
        top: coords ? coords.top : -9999,
        left: coords ? coords.left : -9999,
        width: coords?.width,
        opacity: coords ? 1 : 0,
      }}
      onClick={() => setOpen(false)}
    >
      {children}
    </div>,
    document.body,
  );
};

// ── DropdownItem ──────────────────────────────────────────────────────────────
export interface DropdownItemProps {
  children: ReactNode;
  key?: string;
  color?: "default" | "danger" | "primary" | "warning";
  className?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isDisabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPress?: () => void;
  href?: string;
  description?: string;
}

const ITEM_COLOR: Record<NonNullable<DropdownItemProps["color"]>, string> = {
  default: "text-text-main hover:bg-surface-3",
  primary: "text-primary hover:bg-primary/10",
  danger: "text-red-500 hover:bg-red-500/10",
  warning: "text-amber-500 hover:bg-amber-500/10",
};

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  color = "default",
  className,
  startContent,
  endContent,
  isDisabled,
  onClick,
  onPress,
  href,
  description,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (isDisabled) return;
    onClick?.(e);
    if (!e.defaultPrevented) onPress?.();
  };

  const commonClass = clsx(
    "w-[calc(100%-8px)] flex items-center gap-3 px-3 py-1.5 mx-1 my-0.5 rounded-lg text-[12.5px] font-medium",
    "transition-all duration-200 cursor-pointer select-none",
    "focus:outline-none focus:bg-surface-3",
    ITEM_COLOR[color],
    isDisabled && "opacity-40 cursor-not-allowed pointer-events-none",
    className,
  );

  const content = (
    <>
      {startContent && (
        <span className="shrink-0 text-current transition-transform duration-200 group-hover:scale-110">
          {startContent}
        </span>
      )}
      <span className="flex-1 text-left">
        {children}
        {description && (
          <span className="block text-[10px] text-mountain-400 mt-0.5 font-normal">
            {description}
          </span>
        )}
      </span>
      {endContent && (
        <span className="shrink-0 text-mountain-400">{endContent}</span>
      )}
    </>
  );

  if (href) {
    return (
      <a
        className={clsx(commonClass, "group")}
        href={href}
        role="menuitem"
        onClick={handleClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={clsx(commonClass, "group")}
      disabled={isDisabled}
      role="menuitem"
      tabIndex={0}
      type="button"
      onClick={handleClick}
    >
      {content}
    </button>
  );
};

// ── DropdownSection ───────────────────────────────────────────────────────────
export interface DropdownSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
  showDivider?: boolean;
}

export const DropdownSection: React.FC<DropdownSectionProps> = ({
  children,
  title,
  className,
  showDivider,
}) => (
  <div
    className={clsx(
      "py-1",
      showDivider && "border-b border-mountain-100",
      className,
    )}
  >
    {title && (
      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mountain-400">
        {title}
      </div>
    )}
    {children}
  </div>
);
