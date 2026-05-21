import React from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

// ── Card ──────────────────────────────────────────────────────────────────────
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  isPressable?: boolean;
  isHoverable?: boolean;
  onPress?: () => void;
  /** Removes padding from CardBody — useful when embedding tables */
  isBlurred?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      isPressable,
      isHoverable,
      isBlurred,
      onPress,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) onPress?.();
    };

    return (
      <motion.div
        ref={ref as any}
        layout
        animate={{ opacity: 1, y: 0 }}
        className={clsx(
          "bg-surface border border-border-base rounded-xl overflow-hidden transition-all duration-300",
          isBlurred && "glass-morphism shadow-xl shadow-black/5",
          isPressable && "cursor-pointer select-none",
          (isPressable || isHoverable) && "hover-glow hover:border-primary/30",
          className,
        )}
        initial={{ opacity: 0, y: 10 }}
        role={isPressable ? "button" : undefined}
        tabIndex={isPressable ? 0 : undefined}
        whileHover={isHoverable || isPressable ? { y: -2 } : {}}
        onClick={handleClick}
        onKeyDown={
          isPressable
            ? (e) => {
                if (e.key === "Enter") onPress?.();
              }
            : undefined
        }
        {...(rest as any)}
      />
    );
  },
);
Card.displayName = "Card";

// ── CardHeader ────────────────────────────────────────────────────────────────
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={clsx(
      "flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface-2/30",
      className,
    )}
    {...rest}
  />
));
CardHeader.displayName = "CardHeader";

// ── CardBody ──────────────────────────────────────────────────────────────────
export const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div ref={ref} className={clsx("px-3 py-3", className)} {...rest} />
));
CardBody.displayName = "CardBody";

// ── CardFooter ────────────────────────────────────────────────────────────────
export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={clsx(
      "flex items-center justify-end gap-2 px-3 py-2 border-t border-border-base bg-surface-2/50",
      className,
    )}
    {...rest}
  />
));
CardFooter.displayName = "CardFooter";
