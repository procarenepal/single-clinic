/**
 * Small "N days overdue" pill shown inline on billing list rows for unpaid
 * records — surfaces staleness where staff already are, instead of only in
 * the separate Outstanding Balances report. Bucket thresholds/colors match
 * that report's AgingBucket scheme (0-30/31-60/61-90/90+) for consistency.
 */
export function AgingTag({ date }: { date: Date | string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const daysOverdue = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysOverdue < 1) return null;

  const colorClass =
    daysOverdue > 90
      ? "bg-danger-50 text-danger-600 border-danger-200"
      : daysOverdue > 60
        ? "bg-warning-50 text-warning-700 border-warning-200"
        : daysOverdue > 30
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-default-100 text-default-500 border-default-200";

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium border whitespace-nowrap ${colorClass}`}
    >
      {daysOverdue}d overdue
    </span>
  );
}
