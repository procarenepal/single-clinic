import React from "react";
import clsx from "clsx";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md" | "lg";
  color?: "primary" | "default" | "danger" | "success" | "warning";
  label?: string;
}

const TRACK_SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "w-3   h-3   border-[1.5px]",
  sm: "w-4   h-4   border-2",
  md: "w-5   h-5   border-2",
  lg: "w-7   h-7   border-[3px]",
};

const TRACK_COLOR: Record<NonNullable<SpinnerProps["color"]>, string> = {
  primary: "border-primary/20 border-t-primary",
  default: "border-border-base border-t-text-muted",
  danger: "border-danger/20    border-t-danger",
  success: "border-success/20 border-t-success",
  warning: "border-warning/20 border-t-warning",
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  color = "primary",
  label,
  className,
  ...rest
}) => (
  <span
    aria-label={label ?? "Loading"}
    className={clsx("inline-flex items-center gap-2", className)}
    role="status"
    {...rest}
  >
    <span
      className={clsx(
        "inline-block rounded-full animate-spin",
        TRACK_SIZE[size],
        TRACK_COLOR[color],
      )}
    />
    {label && <span className="text-[11px] text-text-muted">{label}</span>}
  </span>
);
