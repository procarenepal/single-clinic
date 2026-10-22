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
  paymentCaptureProblem,
  type PaymentCaptureValue,
  type PaymentMethodSettings,
} from "@/components/billing/PaymentCapture";
import {
  settlePrimaryLabel,
  DISCOUNT_REASON_OPTIONS,
  type SettlePlan,
} from "@/services/core/visitSettleCore";
import { discountExceedsCap } from "@/services/core/frontOfficePermissionCore";

/**
 * Stage 4 of the front-office redesign: file, pay and close a visit in one
 * confirm. Every line with its performer and VAT mark, the discount
 * (editable only for a permitted role — others see it read-only), the
 * deposit held and its method, standing wallet credit, VAT, total, the
 * amount due now with its own payment capture, and one confirm. After
 * confirm the sheet shows the filed invoice with Print and Done instead of
 * navigating away.
 *
 * Presentational: the plan is computed by the caller (buildSettlePlan) and
 * recomputed live as the discount or standing-credit toggle changes, the
 * same split CheckInSheet already uses for its own plan prop.
 */
export interface SettleSheetLine {
  name: string;
  performerName?: string;
  price: number;
  quantity: number;
  isTaxable: boolean;
}

export interface SettleSheetResult {
  billingId: string;
  invoiceNumber: string;
  totalAmount: number;
}

const money = (n: number) =>
  `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface SettleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  regNumber?: string;
  lines: SettleSheetLine[];
  plan: SettlePlan;
  /** The clinic's role list grants this user the discount action. */
  canDiscount: boolean;
  discountType: "flat" | "percent";
  discountValue: number;
  onDiscountChange: (type: "flat" | "percent", value: number) => void;
  discountReason: string;
  onDiscountReasonChange: (reason: string) => void;
  /** This role's discount ceiling as a %, or null when unlimited. */
  discountCapPercent: number | null;
  /** Wallet credit beyond this visit's own deposit, when the patient has any. */
  standingCreditAvailable: number;
  applyStandingCredit: boolean;
  onApplyStandingCreditChange: (apply: boolean) => void;
  settings: PaymentMethodSettings | null | undefined;
  capture: PaymentCaptureValue;
  onCaptureChange: (next: PaymentCaptureValue) => void;
  saving?: boolean;
  error?: string | null;
  result: SettleSheetResult | null;
  onConfirm: () => void | Promise<void>;
  onPrint: () => void;
  onDone: () => void;
}

export const SettleSheet: React.FC<SettleSheetProps> = ({
  isOpen,
  onClose,
  patientName,
  regNumber,
  lines,
  plan,
  canDiscount,
  discountType,
  discountValue,
  onDiscountChange,
  discountReason,
  onDiscountReasonChange,
  discountCapPercent,
  standingCreditAvailable,
  applyStandingCredit,
  onApplyStandingCreditChange,
  settings,
  capture,
  onCaptureChange,
  saving,
  error,
  result,
  onConfirm,
  onPrint,
  onDone,
}) => {
  const [discountValueText, setDiscountValueText] = useState(
    discountValue ? String(discountValue) : "",
  );
  // The dropdown's own selection — "Other" when the reason is free text (or
  // nothing picked yet), a preset label when it matches one exactly.
  const [reasonPreset, setReasonPreset] = useState(
    discountReason && !(DISCOUNT_REASON_OPTIONS as readonly string[]).includes(discountReason)
      ? "Other"
      : discountReason,
  );

  useEffect(() => {
    if (!isOpen) return;
    setDiscountValueText(discountValue ? String(discountValue) : "");
    setReasonPreset(
      discountReason &&
        !(DISCOUNT_REASON_OPTIONS as readonly string[]).includes(discountReason)
        ? "Other"
        : discountReason,
    );
  }, [isOpen]);

  if (!isOpen) return null;

  if (result) {
    return (
      <Modal isDismissable isOpen={isOpen} size="md" onClose={onDone}>
        <ModalContent>
          <ModalHeader>
            <p className="text-[14px] font-bold text-text-main">
              Invoice {result.invoiceNumber}
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-[13px] text-text-muted">
                Filed and closed for {patientName}.
              </p>
              <p className="text-[22px] font-bold text-text-main">
                {money(result.totalAmount)}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors"
              type="button"
              onClick={onPrint}
            >
              Print
            </button>
            <button
              className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-semibold hover:bg-primary/95 transition-colors"
              type="button"
              onClick={onDone}
            >
              Done
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  const takesMoney = plan.dueNow > 0;
  const problem = takesMoney ? paymentCaptureProblem(settings, capture) : null;
  const confirmLabel = `${settlePrimaryLabel(plan)}${takesMoney ? ` & Close Visit` : ""}`;
  const capExceeded = discountExceedsCap(
    discountType,
    discountValue,
    plan.totals.subtotal,
    discountCapPercent,
  );
  const commitDiscount = () => {
    const parsed = parseFloat(discountValueText);

    onDiscountChange(discountType, isNaN(parsed) ? 0 : Math.max(0, parsed));
  };

  const selectReasonPreset = (preset: string) => {
    setReasonPreset(preset);
    onDiscountReasonChange(preset === "Other" ? "" : preset);
  };

  return (
    <Modal isDismissable={!saving} isOpen={isOpen} size="lg" onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          <div>
            <p className="text-[14px] font-bold text-text-main">
              Settle · {patientName}
            </p>
            {regNumber && (
              <p className="text-[11.5px] text-text-muted">Reg #{regNumber}</p>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            {!plan.filesInvoice ? (
              <p className="text-[13px] text-text-muted">
                Nothing chargeable on this visit — it closes with no invoice.
              </p>
            ) : (
              <div className="space-y-1 border border-border-base rounded-lg p-3">
                {lines
                  .filter((l) => l.price > 0)
                  .map((l, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-[12.5px] gap-2"
                    >
                      <span className="text-text-main">
                        {l.name}
                        {l.performerName && (
                          <span className="text-text-muted">
                            {" "}
                            · {l.performerName}
                          </span>
                        )}
                      </span>
                      <span className="text-text-main font-medium whitespace-nowrap">
                        {l.quantity} × {money(l.price)}
                        <span className="text-text-muted ml-1">
                          {l.isTaxable ? "VAT ✓" : "VAT –"}
                        </span>
                      </span>
                    </div>
                  ))}
                <div className="border-t border-border-base my-1.5" />
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="text-text-main">
                    {money(plan.totals.subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12.5px] gap-2">
                  <span className="text-text-muted">Discount</span>
                  {canDiscount ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        className="h-7 px-1.5 text-[11.5px] border border-border-base rounded bg-surface"
                        disabled={saving}
                        value={discountType}
                        onChange={(e) => {
                          onDiscountChange(
                            e.target.value as "flat" | "percent",
                            discountValue,
                          );
                        }}
                      >
                        <option value="percent">%</option>
                        <option value="flat">NPR</option>
                      </select>
                      <input
                        className="h-7 w-20 px-2 text-[11.5px] border border-border-base rounded bg-surface text-right"
                        disabled={saving}
                        min={0}
                        type="number"
                        value={discountValueText}
                        onBlur={commitDiscount}
                        onChange={(e) => setDiscountValueText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitDiscount()}
                      />
                    </div>
                  ) : (
                    <span className="text-text-muted">
                      {discountValue > 0
                        ? `${discountValue}${discountType === "percent" ? "%" : " NPR"} (not permitted for your role)`
                        : "none"}
                    </span>
                  )}
                </div>
                {canDiscount && discountValue > 0 && (
                  <div className="space-y-1">
                    <select
                      className="h-7 w-full px-1.5 text-[11.5px] border border-border-base rounded bg-surface"
                      disabled={saving}
                      value={reasonPreset}
                      onChange={(e) => selectReasonPreset(e.target.value)}
                    >
                      <option value="">Reason (optional)</option>
                      {DISCOUNT_REASON_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {reasonPreset === "Other" && (
                      <input
                        className="h-7 w-full px-2 text-[11.5px] border border-border-base rounded bg-surface"
                        disabled={saving}
                        placeholder="Specify the reason"
                        type="text"
                        value={discountReason}
                        onChange={(e) => onDiscountReasonChange(e.target.value)}
                      />
                    )}
                    {discountCapPercent !== null && (
                      <p
                        className={`text-[11px] ${capExceeded ? "text-danger font-medium" : "text-text-muted"}`}
                      >
                        {capExceeded
                          ? `Over your limit of ${discountCapPercent}% — ask a role with a higher or no cap to apply this.`
                          : `Up to ${discountCapPercent}% without a higher-capped role.`}
                      </p>
                    )}
                  </div>
                )}
                {plan.totals.discountAmount > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-text-muted/60 italic ml-2">
                      Discount amount
                    </span>
                    <span className="text-danger">
                      − {money(plan.totals.discountAmount)}
                    </span>
                  </div>
                )}
                {plan.totals.taxAmount > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-text-muted">
                      VAT on {money(plan.totals.taxableAmount)}
                    </span>
                    <span className="text-text-main">
                      {money(plan.totals.taxAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[13.5px] font-bold border-t border-border-base pt-1.5 mt-1">
                  <span>Total</span>
                  <span>{money(plan.totals.totalAmount)}</span>
                </div>

                {plan.depositToApply > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-text-muted">Deposit held</span>
                    <span className="text-success-600">
                      − {money(plan.depositToApply)}
                    </span>
                  </div>
                )}
                {plan.depositShortfall > 0.005 && (
                  <p className="text-[11px] text-warning-600">
                    {money(plan.depositShortfall)} of the recorded deposit is
                    no longer in the wallet (spent elsewhere since check-in)
                    — added to what's due now.
                  </p>
                )}
                {standingCreditAvailable > 0.005 && (
                  <label className="flex items-center gap-2 text-[12px] text-text-main cursor-pointer">
                    <input
                      checked={applyStandingCredit}
                      disabled={saving}
                      type="checkbox"
                      onChange={(e) =>
                        onApplyStandingCreditChange(e.target.checked)
                      }
                    />
                    Apply {money(standingCreditAvailable)} of standing wallet
                    credit
                  </label>
                )}
                {plan.standingCreditToApply > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-text-muted">
                      Standing credit applied
                    </span>
                    <span className="text-success-600">
                      − {money(plan.standingCreditToApply)}
                    </span>
                  </div>
                )}
                {plan.excessToWallet > 0.005 && (
                  <p className="text-[11px] text-text-muted">
                    {money(plan.excessToWallet)} more than the total stays as
                    wallet credit.
                  </p>
                )}

                <div className="flex justify-between text-[14px] font-bold border-t border-border-base pt-1.5 mt-1">
                  <span>Due now</span>
                  <span>{money(plan.dueNow)}</span>
                </div>
              </div>
            )}

            {takesMoney && (
              <PaymentCapture
                disabled={saving}
                idPrefix="settle"
                settings={settings}
                value={capture}
                onChange={onCaptureChange}
              />
            )}
            {error && (
              <p className="text-[12px] text-danger font-medium">{error}</p>
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
            disabled={saving || Boolean(problem) || capExceeded}
            title={
              problem ||
              (capExceeded ? "This discount is over your role's limit." : undefined)
            }
            type="button"
            onClick={() => onConfirm()}
          >
            {saving ? "Working…" : confirmLabel}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
