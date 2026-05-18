import React from "react";
import clsx from "clsx";

type BadgeColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";
type BadgeVariant = "solid" | "flat" | "bordered";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  variant?: BadgeVariant;
}

const baseBadge =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

const solidMap: Record<BadgeColor, string> = {
  default: "bg-surface-2 text-text-main",
  primary: "bg-primary text-white",
  secondary: "bg-success text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
};

const flatMap: Record<BadgeColor, string> = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-success/10 text-success",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const borderedMap: Record<BadgeColor, string> = {
  default: "border border-border-base text-text-main",
  primary: "border border-primary text-primary",
  secondary: "border border-success text-success",
  success: "border border-success text-success",
  warning: "border border-warning text-warning",
  danger: "border border-danger text-danger",
};

export const Badge: React.FC<BadgeProps> = ({
  color = "default",
  variant = "solid",
  className,
  children,
  ...rest
}) => {
  const colorClasses =
    variant === "solid"
      ? solidMap[color]
      : variant === "flat"
        ? flatMap[color]
        : borderedMap[color];

  return (
    <span className={clsx(baseBadge, colorClasses, className)} {...rest}>
      {children}
    </span>
  );
};
