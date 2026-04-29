import React from "react";
import clsx from "clsx";

type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";
type ChipVariant = "solid" | "flat" | "bordered" | "light";
type ChipSize = "sm" | "md" | "lg";

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: ChipColor;
  variant?: ChipVariant;
  size?: ChipSize;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  onClose?: () => void;
  isCloseable?: boolean;
}

const baseChip =
  "inline-flex items-center gap-1 rounded-full text-xs font-medium transition-colors";

const sizeMap: Record<ChipSize, string> = {
  sm: "px-2 py-0.5",
  md: "px-3 py-1",
  lg: "px-4 py-1.5 text-sm",
};

const solidMap: Record<ChipColor, string> = {
  default: "bg-surface-2 text-text-main",
  primary: "bg-primary text-white",
  secondary: "bg-success text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-error text-white",
};

const flatMap: Record<ChipColor, string> = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-success/10 text-success",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-error/10 text-error",
};

const borderedMap: Record<ChipColor, string> = {
  default: "border border-border-base text-text-main",
  primary: "border border-primary text-primary",
  secondary: "border border-success text-success",
  success: "border border-success text-success",
  warning: "border border-warning text-warning",
  danger: "border border-error text-error",
};

export const Chip: React.FC<ChipProps> = ({
  color = "default",
  variant = "solid",
  size = "md",
  startContent,
  endContent,
  onClose,
  isCloseable,
  className,
  children,
  ...rest
}) => {
  const colorClasses =
    variant === "solid"
      ? solidMap[color]
      : variant === "flat"
        ? flatMap[color]
        : variant === "bordered"
          ? borderedMap[color]
          : flatMap[color];

  return (
    <div
      className={clsx(baseChip, sizeMap[size], colorClasses, className)}
      {...rest}
    >
      {startContent && (
        <span className="inline-flex items-center">{startContent}</span>
      )}
      <span>{children}</span>
      {endContent && (
        <span className="inline-flex items-center">{endContent}</span>
      )}
      {(isCloseable || onClose) && (
        <button
          className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full text-[10px] text-text-muted hover:bg-surface-3"
          type="button"
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
};
