import { clsx, type ClassValue } from "clsx";

/**
 * Utility to merge class names using clsx.
 * Note: tailwind-merge is not currently installed, so we use clsx only.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
