/**
 * Shared invoice/payment status pill — used across the appointment, pathology,
 * and pharmacy billing list/detail views so the same status always renders
 * with the same color and shape everywhere, instead of independently
 * hand-styled copies. Colors/shape match Pathology's HeroUI `<Chip>` (the
 * app's reference billing-table style): semantic success/warning/danger
 * tokens, uppercase text, pill shape.
 */
const S_COLORS: Record<string, string> = {
  paid: "bg-success-50 text-success-600 border-success-200",
  finalized: "bg-primary/10 text-primary border-primary/20",
  partial: "bg-warning-50 text-warning-600 border-warning-200",
  pending: "bg-warning-50 text-warning-600 border-warning-200",
  unpaid: "bg-danger-50 text-danger-600 border-danger-200",
  overdue: "bg-danger-50 text-danger-600 border-danger-200",
  cancelled: "bg-danger-50 text-danger-600 border-danger-200",
  default: "bg-surface-2 text-text-muted border-border-base",
};

export function StatusBadge({
  status,
}: {
  status: string;
  /** Reserved for a future status/payment visual distinction; both render identically today. */
  type?: "status" | "payment";
}) {
  const color = S_COLORS[status] || S_COLORS.default;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border uppercase ${color}`}
    >
      {status}
    </span>
  );
}
