import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rectangle" | "circle" | "text";
  isLoaded?: boolean;
}

export function Skeleton({
  className,
  variant = "rectangle",
  isLoaded = false,
  children,
  ...props
}: SkeletonProps) {
  if (isLoaded) return <>{children}</>;

  return (
    <div
      className={cn(
        "animate-pulse bg-zinc-100/80 dark:bg-zinc-800/50 rounded-xl overflow-hidden relative",
        variant === "circle" && "rounded-full",
        variant === "text" && "h-3 w-full rounded-md",
        className
      )}
      {...props}
    >
      {/* Subtle shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
    </div>
  );
}

/**
 * Common Loading Presets
 */

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 border border-border-base rounded-2xl space-y-3 bg-surface">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="w-1/3 h-4" />
          <Skeleton variant="text" className="w-1/4 h-3" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton variant="circle" className="w-8 h-8" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-3 w-1/2" />
            <Skeleton variant="text" className="h-2 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full Page Skeleton matching the requested layout:
 * Header + Stat Cards + Large Content Area
 */
export function PageSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Title & Breadcrumb */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Main Content Area */}
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}
