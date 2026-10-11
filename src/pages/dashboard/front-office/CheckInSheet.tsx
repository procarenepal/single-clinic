import React, { useEffect, useState } from "react";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  PaymentCapture,
  initialPaymentCapture,
  paymentCaptureProblem,
  type PaymentCaptureValue,
  type PaymentMethodSettings,
} from "@/components/billing/PaymentCapture";
import {
  describeCheckInPlan,
  type CheckInPlan,
} from "@/services/core/checkInCore";

/**
 * The compact check-in sheet. It opens only when money changes hands:
 * patient, service, performer, the derived fee line, the payment method
 * (default pre-selected, a reference when required) and one confirm. A
 * visit with nothing to collect never sees it — Check In is one click.
 *
 * The same sheet collects a fee that is still due on a visit already in
 * the lobby (a failed deposit, or standing credit that was spent).
 */
export interface CheckInSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** "check-in" also moves the visit to the lobby; "collect" only takes money. */
  mode: "check-in" | "collect";
  patientName: string;
  regNumber?: string;
  serviceName?: string;
  performerName?: string;
  plan: CheckInPlan;
  /** True when the last attempt to take this fee failed and this is a retry. */
  depositFailed?: boolean;
  settings: PaymentMethodSettings | null | undefined;
  saving?: boolean;
  onConfirm: (capture: PaymentCaptureValue | null) => void | Promise<void>;
}

const money = (n: number) =>
  `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CheckInSheet: React.FC<CheckInSheetProps> = ({
  isOpen,
  onClose,
  mode,
  patientName,
  regNumber,
  serviceName,
  performerName,
  plan,
  depositFailed,
  settings,
  saving,
  onConfirm,
}) => {
  const [capture, setCapture] = useState<PaymentCaptureValue>(() =>
    initialPaymentCapture(settings),
  );

  useEffect(() => {
    if (isOpen) setCapture(initialPaymentCapture(settings));
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const collectNow = plan.kind === "collect" ? plan.collectNow : 0;
  const takesMoney = collectNow > 0;
  const problem = takesMoney ? paymentCaptureProblem(settings, capture) : null;
  const confirmLabel =
    mode === "collect"
      ? takesMoney
        ? `${depositFailed ? "Retry" : "Collect"} ${money(collectNow)}`
        : "Nothing to collect"
      : takesMoney
        ? `Collect ${money(collectNow)} & Check In`
        : "Check In";
  const tone =
    plan.kind === "refused"
      ? "text-danger"
      : plan.kind === "collect"
        ? "text-text-main"
        : "text-text-muted";

  return (
    <Modal isDismissable={!saving} isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          <div>
            <p className="text-[14px] font-bold text-text-main">
              {mode === "collect" ? "Collect fee" : "Check in"} · {patientName}
            </p>
            {regNumber && (
              <p className="text-[11.5px] text-text-muted">Reg #{regNumber}</p>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                  Service
                </p>
                <p className="text-text-main font-medium">
                  {serviceName || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                  Clinician
                </p>
                <p className="text-text-main font-medium">
                  {performerName || "—"}
                </p>
              </div>
            </div>
            <p
              className={`text-[13px] font-semibold ${tone}`}
              data-testid="checkin-fee-line"
            >
              {plan.kind === "refused" ? "⚠ " : ""}
              {describeCheckInPlan(plan)}
            </p>
            {depositFailed && takesMoney && (
              <p className="text-[11.5px] text-warning-600 font-medium">
                The last attempt to record this payment failed; nothing was
                taken. Try again.
              </p>
            )}
            {takesMoney && (
              <PaymentCapture
                disabled={saving}
                idPrefix="checkin"
                settings={settings}
                value={capture}
                onChange={setCapture}
              />
            )}
            {plan.kind === "refused" && mode === "check-in" && (
              <p className="text-[11.5px] text-text-muted">
                The patient is checked in without this charge; fix the setting
                and collect the fee from the queue.
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors disabled:opacity-50"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-semibold hover:bg-primary/95 transition-colors disabled:opacity-50"
            data-testid="checkin-confirm"
            disabled={
              saving || Boolean(problem) || (mode === "collect" && !takesMoney)
            }
            title={problem || undefined}
            type="button"
            onClick={() => onConfirm(takesMoney ? capture : null)}
          >
            {saving ? "Working…" : confirmLabel}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
