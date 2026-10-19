import { useState } from "react";

import { addToast } from "@/components/ui/toast";
import { describeCbmsResponseCode } from "@/utils/cbmsResponseCodes";

/**
 * Shared IRD sync status pill (Synced / Failed + Retry / N/A) — used by
 * every billing list/detail view (appointment, pathology, pharmacy) so the
 * same state always renders with the same colors and copy, instead of four
 * independently hand-styled copies.
 *
 * `attempted` must reflect whether a real IRD sync call was ever made for
 * this record — NOT the record's own draft/finalized/paid workflow status.
 * The Java backend syncs synchronously at invoice CREATION time, entirely
 * independent of any later local status change, so gating this on
 * "finalized" or "paid" hides real Synced/Failed results behind an
 * unrelated step (and for a while, pharmacy's caller literally passed
 * `paymentStatus === "paid"` here, making the badge look payment-gated).
 * Pass `Boolean(record.cbmsResponseCode)` — set only when IRD sync was
 * actually attempted (irrespective of success) — never a workflow status.
 */
export function IrdSyncBadge({
  attempted,
  synced,
  recordId,
  invoiceType,
  onSynced,
  /** The record's own cbmsResponseCode, when it has one — the backend mirrors
   * this onto the record from every sync attempt. Shown directly under a
   * Failed badge (no click required) instead of making staff retry just to
   * learn why it's already failing. */
  responseCode,
}: {
  attempted: boolean;
  synced: boolean;
  recordId: string;
  invoiceType: "appointment" | "pathology" | "pharmacy";
  onSynced?: () => void;
  responseCode?: string | null;
}) {
  const [liveReason, setLiveReason] = useState<string | null>(null);
  if (!attempted) {
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
        setLiveReason(res.message || null);
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

  // Prefer what this attempt just said (liveReason) over the record's own
  // stored code, so a second failure explains itself without a page reload.
  const reason = liveReason || describeCbmsResponseCode(responseCode);

  return (
    <div className="flex flex-col gap-1 items-start max-w-[220px]">
      <span className="text-[10px] bg-danger-50 text-danger-600 px-1.5 py-0.5 rounded font-medium border border-danger-200">
        ⚠️ Failed
      </span>
      {reason && (
        <p className="text-[10px] text-text-muted leading-snug">{reason}</p>
      )}
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
