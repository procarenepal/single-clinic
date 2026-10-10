/**
 * What a row on the front-office board shows: for every stage, sub-state
 * and role, exactly ONE primary action or ONE status chip, plus the
 * overflow menu.
 *
 * The old board rendered placeholders ("Waiting for Doctor", "Billing
 * Pending", "Checkout Completed") as live buttons with empty handlers, and
 * offered the same move twice from side-by-side buttons with different
 * write sets. This table is the single source for the row, and its test
 * asserts the invariant: never both a primary and a chip, never neither,
 * and no primary without a real action.
 *
 * Pure: facts in, labels and action ids out. The desk maps action ids to
 * handlers.
 */

import type { UserRole } from "@/types/models";

import type { VisitStage } from "./visitLifecycleCore";

export type BillingSubState = "to-settle" | "filed-unpaid" | "reissue";

export type BoardActionId =
  | "check-in"
  | "retry-fee"
  | "collect-deposit"
  | "triage-and-send"
  | "send-to-cabin"
  | "collect-and-send"
  | "finish-consultation"
  | "prescription"
  | "record-procedure"
  | "finish-without-procedure"
  | "settle"
  | "collect-balance"
  | "reissue-invoice"
  | "view-invoice"
  | "print-invoice"
  | "print-advance-receipt"
  | "add-service"
  | "remove-line"
  | "reroute"
  | "send-back"
  | "skip-triage"
  | "hold"
  | "mark-urgent"
  | "undo-check-in"
  | "cancel-visit"
  | "mark-no-show"
  | "reschedule"
  | "reinstate"
  | "act-for-clinician";

export interface BoardAction {
  id: BoardActionId;
  label: string;
}

export interface BoardRow {
  primary?: BoardAction;
  chip?: string;
  overflow: BoardAction[];
  /** Shown beside the primary or chip when a prescription is unfulfilled. */
  rxPending?: boolean;
}

export interface BoardVisitFacts {
  stage: VisitStage;
  billingSubState?: BillingSubState;
  hasDoctor: boolean;
  hasExpert: boolean;
  /** The clinician the next send targets (doctor first). */
  targetClinicianName?: string;
  roomName?: string;
  waitMinutes?: number;
  scheduledTime?: string;
  /** Check-in-scope amount still due (0 when covered). */
  checkInDue: number;
  /** True when the last deposit attempt failed and must be retried. */
  depositFailed?: boolean;
  /** All-scope amount still due, for the collect-before-performing mode. */
  allDue?: number;
  /** Triage required before the cabin (doctor visit, or the clinic setting). */
  triageRequired: boolean;
  triageDone: boolean;
  /** Label the settle plan produced, e.g. "Settle · NPR 1,808.00 due". */
  settleLabel?: string;
  /** Balance on a filed invoice still owed. */
  invoiceBalance?: number;
  invoiceNumber?: string;
  closedWithoutInvoice?: boolean;
  rxPending?: boolean;
  hasDeposit?: boolean;
  isSession?: boolean;
}

export interface BoardSettings {
  collectProcedureBeforePerforming: boolean;
  canSettle: boolean;
  canSkipTriage: boolean;
  canRemoveLine: boolean;
}

const money = (n: number) =>
  `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const minutes = (m?: number) =>
  typeof m === "number" && m >= 0 ? ` · ${Math.round(m)} min` : "";

const sendLabel = (f: BoardVisitFacts) =>
  `Send to ${f.targetClinicianName || "cabin"}${f.roomName ? ` · ${f.roomName}` : ""}`;

const withLabel = (id: BoardActionId, label: string): BoardAction => ({
  id,
  label,
});

/** The overflow actions available at a pre-cabin stage. */
function preCabinOverflow(f: BoardVisitFacts, s: BoardSettings): BoardAction[] {
  const items: BoardAction[] = [];

  if (f.triageRequired && !f.triageDone && s.canSkipTriage) {
    items.push(withLabel("skip-triage", "Send to cabin without triage"));
  }
  items.push(withLabel("collect-deposit", "Collect deposit…"));
  items.push(
    withLabel("hold", "Hold"),
    withLabel("mark-urgent", "Mark urgent"),
  );
  items.push(
    withLabel(
      f.hasDeposit ? "cancel-visit" : "undo-check-in",
      f.hasDeposit ? "Cancel visit…" : "Undo check-in",
    ),
  );
  if (f.hasDeposit) items.push(withLabel("undo-check-in", "Undo check-in"));

  return items;
}

/**
 * The row for one visit as seen by one role. `role` is the viewer's role;
 * clinicians see chips for everything that is not their own step.
 */
export function boardRowFor(
  f: BoardVisitFacts,
  role: UserRole,
  s: BoardSettings,
): BoardRow {
  const desk = role === "clinic-admin" || role === "staff" || role === "hr";
  const row: BoardRow = { overflow: [], rxPending: Boolean(f.rxPending) };

  switch (f.stage) {
    case "scheduled": {
      if (desk) {
        row.primary = withLabel("check-in", "Check In");
        row.overflow = [
          withLabel("mark-no-show", "Mark no-show"),
          withLabel("cancel-visit", "Cancel visit…"),
          withLabel("reschedule", "Reschedule"),
        ];
      } else {
        row.chip = `Scheduled${f.scheduledTime ? ` · ${f.scheduledTime}` : ""}`;
      }

      return row;
    }

    case "lobby":
    case "triage-done": {
      const feeDue = f.checkInDue >= 0.005;

      if (feeDue) {
        if (desk) {
          row.primary = withLabel(
            "retry-fee",
            `${f.depositFailed ? "Retry fee" : "Collect"} ${money(f.checkInDue)}`,
          );
          row.overflow = [
            withLabel("undo-check-in", "Undo check-in"),
            withLabel("cancel-visit", "Cancel visit…"),
          ];
        } else {
          row.chip = "Fee pending at desk";
        }

        return row;
      }

      const collectFirst =
        s.collectProcedureBeforePerforming && (f.allDue || 0) >= 0.005;

      if (!desk) {
        const mine =
          (role === "doctor" && f.hasDoctor) ||
          (role === "expert" && f.hasExpert && !f.hasDoctor);

        row.chip = mine
          ? `Waiting${minutes(f.waitMinutes)}`
          : `Waiting${minutes(f.waitMinutes)}`;

        return row;
      }

      if (collectFirst) {
        row.primary = withLabel(
          "collect-and-send",
          `Collect ${money(f.allDue || 0)} & Send`,
        );
      } else if (f.triageRequired && !f.triageDone) {
        row.primary = withLabel("triage-and-send", "Triage & Send");
      } else {
        row.primary = withLabel("send-to-cabin", sendLabel(f));
      }
      row.overflow = f.triageDone
        ? [
            withLabel("reroute", "Reroute…"),
            withLabel("send-back", "Send back…"),
            withLabel("collect-deposit", "Collect deposit…"),
          ]
        : preCabinOverflow(f, s);

      return row;
    }

    case "doctor": {
      if (role === "doctor") {
        row.primary = withLabel("finish-consultation", "Finish Consultation");
        row.overflow = [
          withLabel("prescription", "Prescription"),
          withLabel("record-procedure", "Record Procedure"),
        ];
      } else if (desk) {
        row.chip = `With ${f.targetClinicianName || "doctor"}${f.roomName ? ` · ${f.roomName}` : ""}${minutes(f.waitMinutes)}`;
        row.overflow = [
          withLabel("act-for-clinician", "Act for doctor…"),
          withLabel("reroute", "Reroute…"),
          withLabel("send-back", "Send back…"),
        ];
      } else {
        row.chip = `With doctor${minutes(f.waitMinutes)}`;
      }

      return row;
    }

    case "expert": {
      if (role === "expert") {
        row.primary = withLabel("record-procedure", "Record Procedure");
        row.overflow = [
          withLabel("finish-without-procedure", "Finish without procedure"),
        ];
      } else if (desk) {
        row.chip = `With ${f.targetClinicianName || "expert"}${f.roomName ? ` · ${f.roomName}` : ""}${minutes(f.waitMinutes)}`;
        row.overflow = [
          withLabel("act-for-clinician", "Act for expert…"),
          withLabel("reroute", "Reroute…"),
          withLabel("send-back", "Send back…"),
        ];
      } else {
        row.chip = `With expert${minutes(f.waitMinutes)}`;
      }

      return row;
    }

    case "billing": {
      const sub: BillingSubState = f.billingSubState || "to-settle";

      if (!desk || !s.canSettle) {
        row.chip = "At billing desk";

        return row;
      }
      if (sub === "filed-unpaid") {
        row.primary = withLabel(
          "collect-balance",
          `Collect ${money(f.invoiceBalance || 0)}`,
        );
        row.overflow = [
          withLabel("view-invoice", "View invoice"),
          withLabel("reissue-invoice", "Reissue invoice…"),
        ];

        return row;
      }
      if (sub === "reissue") {
        row.primary = withLabel("reissue-invoice", "Reissue invoice…");
        row.overflow = [withLabel("view-invoice", "View invoice")];

        return row;
      }
      row.primary = withLabel("settle", f.settleLabel || "Settle");
      row.overflow = [withLabel("add-service", "Add service…")];
      if (s.canRemoveLine)
        row.overflow.push(withLabel("remove-line", "Remove line…"));
      if (f.hasDeposit)
        row.overflow.push(
          withLabel("print-advance-receipt", "Print advance receipt"),
        );
      row.overflow.push(withLabel("send-back", "Send back…"));

      return row;
    }

    case "pharmacy":
    case "completed": {
      row.chip = f.closedWithoutInvoice
        ? "Closed · no invoice"
        : `Closed${f.invoiceNumber ? ` · ${f.invoiceNumber}` : ""}`;
      if (!f.closedWithoutInvoice) {
        row.overflow = [
          withLabel("view-invoice", "View invoice"),
          withLabel("print-invoice", "Print"),
        ];
      }

      return row;
    }

    case "no-show":
    case "cancelled": {
      row.chip = f.stage === "no-show" ? "No-show" : "Cancelled";
      if (desk) row.overflow = [withLabel("reinstate", "Reinstate")];

      return row;
    }
  }

  // Unreachable with a closed VisitStage union; keeps the invariant if a
  // stage is ever added without a row.
  row.chip = "—";

  return row;
}
