import React from "react";
import clsx from "clsx";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  className,
  ...rest
}) => (
  <div
    aria-orientation={orientation}
    className={clsx(
      orientation === "horizontal"
        ? "w-full h-px bg-border-base my-1"
        : "h-full w-px bg-border-base mx-1",
      className,
    )}
    role="separator"
    {...rest}
  />
);
