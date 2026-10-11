import React from "react";

import type { PaymentMethod } from "@/types/models";

/**
 * The one place money is captured at the desk: the method, pre-selected
 * from Settings › Appointment Billing's default, and a reference when the
 * method requires one. The check-in sheet, the settle sheet and the package
 * sale all render this; none keeps its own hardcoded list of methods.
 */
export interface PaymentCaptureValue {
  method: string;
  reference: string;
}

export interface PaymentMethodSettings {
  paymentMethods?: PaymentMethod[] | null;
  defaultPaymentMethod?: string | null;
}

export const enabledPaymentMethods = (
  settings: PaymentMethodSettings | null | undefined,
): PaymentMethod[] =>
  (settings?.paymentMethods || []).filter((m) => m.isEnabled !== false);

/** The starting value: the configured default, else the first enabled method. */
export const initialPaymentCapture = (
  settings: PaymentMethodSettings | null | undefined,
): PaymentCaptureValue => {
  const methods = enabledPaymentMethods(settings);
  const preferred = settings?.defaultPaymentMethod;
  const method =
    (preferred && methods.some((m) => m.key === preferred) && preferred) ||
    methods[0]?.key ||
    "cash";

  return { method, reference: "" };
};

export const paymentMethodRequiresReference = (
  settings: PaymentMethodSettings | null | undefined,
  method: string,
): boolean =>
  enabledPaymentMethods(settings).find((m) => m.key === method)
    ?.requiresReference === true;

/** Null when complete, else the sentence the confirm button should show. */
export const paymentCaptureProblem = (
  settings: PaymentMethodSettings | null | undefined,
  value: PaymentCaptureValue,
): string | null => {
  if (!value.method) return "Choose a payment method.";
  if (
    paymentMethodRequiresReference(settings, value.method) &&
    !value.reference.trim()
  ) {
    const name =
      enabledPaymentMethods(settings).find((m) => m.key === value.method)
        ?.name || value.method;

    return `Enter the ${name} reference.`;
  }

  return null;
};

export const paymentMethodLabel = (
  settings: PaymentMethodSettings | null | undefined,
  method: string,
): string =>
  enabledPaymentMethods(settings).find((m) => m.key === method)?.name ||
  method.replace(/_/g, " ");

interface PaymentCaptureProps {
  settings: PaymentMethodSettings | null | undefined;
  value: PaymentCaptureValue;
  onChange: (next: PaymentCaptureValue) => void;
  disabled?: boolean;
  /** Field ids, so two captures on one screen do not share labels. */
  idPrefix?: string;
}

export const PaymentCapture: React.FC<PaymentCaptureProps> = ({
  settings,
  value,
  onChange,
  disabled,
  idPrefix = "pay",
}) => {
  const methods = enabledPaymentMethods(settings);
  const needsReference = paymentMethodRequiresReference(settings, value.method);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <label
          className="text-[11.5px] font-semibold text-text-muted"
          htmlFor={`${idPrefix}-method`}
        >
          Payment method
        </label>
        <select
          className="h-9 w-full px-2.5 text-[13px] border border-border-base rounded bg-surface text-text-main outline-none focus:border-primary"
          disabled={disabled}
          id={`${idPrefix}-method`}
          value={value.method}
          onChange={(e) =>
            onChange({ method: e.target.value, reference: value.reference })
          }
        >
          {methods.length === 0 && <option value="cash">Cash</option>}
          {methods.map((m) => (
            <option key={m.key} value={m.key}>
              {m.icon ? `${m.icon} ` : ""}
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {needsReference && (
        <div className="flex flex-col gap-1">
          <label
            className="text-[11.5px] font-semibold text-text-muted"
            htmlFor={`${idPrefix}-reference`}
          >
            Reference <span className="text-red-500">*</span>
          </label>
          <input
            className="h-9 w-full px-2.5 text-[13px] border border-border-base rounded bg-surface text-text-main outline-none focus:border-primary"
            disabled={disabled}
            id={`${idPrefix}-reference`}
            placeholder="Transaction id"
            type="text"
            value={value.reference}
            onChange={(e) =>
              onChange({ method: value.method, reference: e.target.value })
            }
          />
        </div>
      )}
    </div>
  );
};
