import { addToast } from "@/components/ui/toast";

/**
 * Shared IRD sync status pill (Synced / Failed + Retry / N/A) — used by
 * every billing list/detail view (appointment, pathology, pharmacy) so the
 * same state always renders with the same colors and copy, instead of four
 * independently hand-styled copies.
 */
export function IrdSyncBadge({
  finalized,
  synced,
  recordId,
  invoiceType,
  onSynced,
}: {
  finalized: boolean;
  synced: boolean;
  recordId: string;
  invoiceType: "appointment" | "pathology" | "pharmacy";
  onSynced?: () => void;
}) {
  if (!finalized) {
    return (
      <span className="text-[10px] text-text-muted/60">➖ N/A</span>
    );
  }

  if (synced) {
    return (
      <span className="text-[10px] bg-success-50 text-success-600 px-1.5 py-0.5 rounded font-medium border border-success-200">
        ✅ Synced
      </span>
    );
  }

  const handleRetry = async () => {
    try {
      const { retryIrdSync } = await import("@/services/irdCbmsService");
      const res = await retryIrdSync(recordId, invoiceType);

      if (res.success) {
        addToast({ title: "IRD Sync successful!", color: "success" });
        onSynced?.();
      } else {
        addToast({
          title: "IRD Sync failed",
          description: res.message,
          color: "danger",
        });
      }
    } catch (e) {
      addToast({ title: "Error during retry sync", color: "danger" });
    }
  };

  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="text-[10px] bg-danger-50 text-danger-600 px-1.5 py-0.5 rounded font-medium border border-danger-200">
        ⚠️ Failed
      </span>
      <button
        className="text-[10px] text-primary hover:underline"
        type="button"
        onClick={handleRetry}
      >
        Retry Sync
      </button>
    </div>
  );
}
