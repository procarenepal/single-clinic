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
    "bg-mountain-100 text-mountain-900 hover:bg-mountain-200 border border-mountain-200",
  primary: "bg-teal-700 text-white hover:bg-teal-600 border border-teal-700",
  secondary:
    "bg-health-600 text-white hover:bg-health-700 border border-health-600",
  success:
    "bg-health-600 text-white hover:bg-health-700 border border-health-600",
  warning:
    "bg-saffron-500 text-white hover:bg-saffron-600 border border-saffron-500",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
};

// Flat: tinted background, no border
const FLAT: Record<BtnColor, string> = {
  default:
    "bg-mountain-100 text-mountain-800 hover:bg-mountain-200 border border-transparent",
  primary:
    "bg-teal-100 text-teal-700 hover:bg-teal-200 border border-transparent",
  secondary:
    "bg-health-100 text-health-700 hover:bg-health-200 border border-transparent",
  success:
    "bg-health-100 text-health-700 hover:bg-health-200 border border-transparent",
  warning:
    "bg-saffron-100 text-saffron-700 hover:bg-saffron-200 border border-transparent",
  danger: "bg-red-100 text-red-700 hover:bg-red-200 border border-transparent",
};

// Bordered: transparent bg, colored border
const BORDERED: Record<BtnColor, string> = {
  default:
    "bg-transparent border border-mountain-200 text-mountain-800 hover:bg-mountain-50",
  primary:
    "bg-transparent border border-teal-600 text-teal-700 hover:bg-teal-50",
  secondary:
    "bg-transparent border border-health-600 text-health-700 hover:bg-health-50",
  success:
    "bg-transparent border border-health-600 text-health-700 hover:bg-health-50",
  warning:
    "bg-transparent border border-saffron-500 text-saffron-700 hover:bg-saffron-50",
  danger: "bg-transparent border border-red-500 text-red-600 hover:bg-red-50",
};

// Light: text-only with hover bg
const LIGHT: Record<BtnColor, string> = {
  default:
    "bg-transparent text-mountain-700 hover:bg-mountain-100 border border-transparent",
  primary:
    "bg-transparent text-teal-700 hover:bg-teal-50 border border-transparent",
  secondary:
    "bg-transparent text-health-700 hover:bg-health-50 border border-transparent",
  success:
    "bg-transparent text-health-700 hover:bg-health-50 border border-transparent",
  warning:
    "bg-transparent text-saffron-700 hover:bg-saffron-50 border border-transparent",
  danger:
    "bg-transparent text-red-600 hover:bg-red-50 border border-transparent",
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
