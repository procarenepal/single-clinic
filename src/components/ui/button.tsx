import React from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────
type BtnColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";
type BtnVariant = "solid" | "flat" | "bordered" | "light" | "ghost";
type BtnSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: BtnColor;
  variant?: BtnVariant;
  size?: BtnSize;
  isDisabled?: boolean;
  isLoading?: boolean;
  isIconOnly?: boolean;
  fullWidth?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  /** HeroUI compat alias for onClick */
  onPress?: () => void;
  radius?: "none" | "sm" | "md" | "lg" | "full";
}

// ── Style maps ────────────────────────────────────────────────────────────────
const SIZE: Record<BtnSize, string> = {
  // Compact: 26px / 30px / 34px heights
  sm: "h-[26px] px-2.5 text-xs gap-1.5",
  md: "h-[30px] px-3   text-xs gap-1.5",
  lg: "h-[34px] px-4   text-sm gap-2",
};

const RADIUS: Record<NonNullable<ButtonProps["radius"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded",
  lg: "rounded-md",
  full: "rounded-full",
};

// Solid: filled background
const SOLID: Record<BtnColor, string> = {
  default:
    "bg-surface-2 text-text-main hover:bg-surface-3 border border-border-base",
  primary: "bg-primary text-white hover:opacity-90 border border-primary",
  secondary:
    "bg-success text-white hover:opacity-90 border border-success",
  success:
    "bg-success text-white hover:opacity-90 border border-success",
  warning:
    "bg-warning text-white hover:opacity-90 border border-warning",
  danger: "bg-danger text-white hover:opacity-90 border border-danger",
};

// Flat: tinted background, no border
const FLAT: Record<BtnColor, string> = {
  default:
    "bg-surface-2 text-text-muted hover:bg-surface-3 border border-transparent",
  primary:
    "bg-primary/10 text-primary hover:bg-primary/20 border border-transparent",
  secondary:
    "bg-success/10 text-success hover:bg-success/20 border border-transparent",
  success:
    "bg-success/10 text-success hover:bg-success/20 border border-transparent",
  warning:
    "bg-warning/10 text-warning hover:bg-warning/20 border border-transparent",
  danger: "bg-danger/10 text-danger hover:bg-danger/20 border border-transparent",
};

// Bordered: transparent bg, colored border
const BORDERED: Record<BtnColor, string> = {
  default:
    "bg-transparent border border-border-base text-text-main hover:bg-surface-2",
  primary:
    "bg-transparent border border-primary text-primary hover:bg-primary/10",
  secondary:
    "bg-transparent border border-success text-success hover:bg-success/10",
  success:
    "bg-transparent border border-success text-success hover:bg-success/10",
  warning:
    "bg-transparent border border-warning text-warning hover:bg-warning/10",
  danger: "bg-transparent border border-danger text-danger hover:bg-danger/10",
};

// Light: text-only with hover bg
const LIGHT: Record<BtnColor, string> = {
  default:
    "bg-transparent text-text-muted hover:bg-surface-2 border border-transparent",
  primary:
    "bg-transparent text-primary hover:bg-primary/10 border border-transparent",
  secondary:
    "bg-transparent text-success hover:bg-success/10 border border-transparent",
  success:
    "bg-transparent text-success hover:bg-success/10 border border-transparent",
  warning:
    "bg-transparent text-warning hover:bg-warning/10 border border-transparent",
  danger:
    "bg-transparent text-danger hover:bg-danger/10 border border-transparent",
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      color = "primary",
      variant = "solid",
      size = "md",
      radius = "md",
      isDisabled,
      isLoading,
      isIconOnly,
      fullWidth,
      startContent,
      endContent,
      className,
      children,
      type = "button",
      onPress,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const colorMap =
      variant === "solid"
        ? SOLID
        : variant === "flat"
          ? FLAT
          : variant === "bordered"
            ? BORDERED
            : variant === "ghost"
              ? BORDERED
              : LIGHT;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented && !isDisabled && !rest.disabled) onPress?.();
    };

    return (
      <motion.button
        ref={ref as any}
        whileHover={!isDisabled && !isLoading ? { scale: 1.01 } : {}}
        whileTap={!isDisabled && !isLoading ? { scale: 0.98 } : {}}
        className={clsx(
          // base
          "inline-flex items-center justify-center font-medium whitespace-nowrap",
          "transition-all duration-300 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/50 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // size
          SIZE[size],
          // radius
          RADIUS[radius],
          // isIconOnly — square button
          isIconOnly && [
            size === "sm"
              ? "!w-[26px] !px-0"
              : size === "lg"
                ? "!w-[34px] !px-0"
                : "!w-[30px] !px-0",
          ],
          // color + variant
          colorMap[color],
          // full width
          fullWidth && "w-full",
          className,
        )}
        disabled={isDisabled || isLoading || rest.disabled}
        type={type}
        onClick={handleClick}
        {...rest as any}
      >
        {startContent && (
          <motion.span
            initial={{ opacity: 0, x: -2 }}
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 inline-flex items-center"
          >
            {startContent}
          </motion.span>
        )}
        {!isIconOnly && children}
        {isIconOnly && children}
        {isLoading && (
          <span className="shrink-0 inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
        )}
        {endContent && (
          <motion.span
            initial={{ opacity: 0, x: 2 }}
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 inline-flex items-center"
          >
            {endContent}
          </motion.span>
        )}
      </motion.button>
    );
  },
);
Button.displayName = "Button";
