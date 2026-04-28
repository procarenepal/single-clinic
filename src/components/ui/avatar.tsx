import React from "react";
import clsx from "clsx";

export interface AvatarProps {
  size?: "xs" | "sm" | "md" | "lg";
  src?: string;
  alt?: string;
  name?: string;
  /** Color variant for the initials background */
  color?: "primary" | "secondary" | "default" | "danger" | "warning";
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "w-5  h-5  text-[9px]",
  sm: "w-6  h-6  text-[10px]",
  md: "w-8  h-8  text-xs",
  lg: "w-10 h-10 text-sm",
};

const COLOR: Record<NonNullable<AvatarProps["color"]>, string> = {
  primary: "bg-teal-100   text-teal-700",
  secondary: "bg-health-100 text-health-700",
  default: "bg-mountain-100 text-mountain-700",
  danger: "bg-red-100    text-red-700",
  warning: "bg-saffron-100 text-saffron-700",
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  size = "md",
  src,
  alt,
  name,
  color = "primary",
  className,
}) => {
  const [hasError, setHasError] = React.useState(false);

  const base = clsx(
    "rounded-full inline-flex items-center justify-center shrink-0 font-semibold select-none overflow-hidden",
    SIZE[size],
    className,
  );

  if (src && !hasError) {
    return (
      <img
        alt={alt ?? name ?? "avatar"}
        className={clsx(base, "object-cover bg-mountain-100")}
        src={src}
        onError={() => setHasError(true)}
      />
    );
  }

  return <div className={clsx(base, COLOR[color])}>{initials(name)}</div>;
};
