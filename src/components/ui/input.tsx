import React from "react";
import clsx from "clsx";
import { IoCloseOutline } from "react-icons/io5";

// ── Input ─────────────────────────────────────────────────────────────────────
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "bordered" | "flat";
  isClearable?: boolean;
  onClear?: () => void;
  /** Alias for onChange with string value */
  onValueChange?: (value: string) => void;
  fullWidth?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  classNames?: {
    base?: string;
    inputWrapper?: string;
    input?: string;
    label?: string;
  };
}

const SIZE_WRAPPER: Record<NonNullable<InputProps["size"]>, string> = {
  sm: "min-h-[32px] text-xs",
  md: "min-h-[40px] text-xs",
  lg: "min-h-[44px] text-sm",
};

const SIZE_INNER: Record<NonNullable<InputProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      errorMessage,
      startContent,
      endContent,
      size = "md",
      variant = "bordered",
      isClearable,
      onClear,
      onValueChange,
      fullWidth = true,
      className,
      isRequired,
      isReadOnly,
      isDisabled,
      isInvalid,
      classNames,
      onChange,
      value,
      defaultValue,
      ...rest
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState(defaultValue ?? "");
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internal;
    const hasValue = currentValue !== undefined && currentValue !== "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternal(e.target.value);
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      if (!isControlled) setInternal("");
      onClear?.();
      onValueChange?.("");
    };

    return (
      <div
        className={clsx(
          "flex flex-col gap-1.5 w-full min-w-0",
          classNames?.base,
        )}
      >
        {label && (
          <label
            className={clsx(
              "text-xs font-medium text-text-main",
              classNames?.label,
            )}
          >
            {label}
            {isRequired && <span className="text-error ml-0.5">*</span>}
          </label>
        )}

        {/* Input wrapper */}
        <div
          className={clsx(
            "flex items-center gap-2 rounded-md border bg-surface text-text-main border-border-base focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 min-h-[40px] w-full",
            (isInvalid || errorMessage) &&
            "!border-error focus-within:!ring-error/20",
            isDisabled && "opacity-50 cursor-not-allowed",
            SIZE_WRAPPER[size],
            fullWidth && "w-full",
            classNames?.inputWrapper,
            className,
          )}
        >
          {startContent && (
            <span className="pl-2 shrink-0 text-text-muted inline-flex items-center">
              {startContent}
            </span>
          )}

          <input
            ref={ref}
            className={clsx(
              "flex-1 min-w-0 h-full bg-transparent outline-none border-none",
              "placeholder:text-text-muted/60 text-text-main",
              !startContent && "pl-2",
              !endContent && !isClearable && "pr-2",
              SIZE_INNER[size],
              classNames?.input,
            )}
            disabled={isDisabled ?? rest.disabled}
            readOnly={isReadOnly ?? rest.readOnly}
            required={isRequired ?? rest.required}
            value={currentValue}
            onChange={handleChange}
            {...rest}
          />

          {isClearable && hasValue && (
            <button
              className="shrink-0 pr-1.5 text-mountain-400 hover:text-mountain-600 inline-flex items-center"
              tabIndex={-1}
              type="button"
              onClick={handleClear}
            >
              <IoCloseOutline className="w-3.5 h-3.5" />
            </button>
          )}

          {endContent && (
            <span className="pr-2 shrink-0 text-mountain-400 inline-flex items-center">
              {endContent}
            </span>
          )}
        </div>

        {description && !errorMessage && (
          <p className="text-[11px] text-text-muted">{description}</p>
        )}
        {errorMessage && (
          <p className="text-[11px] text-error">{errorMessage}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

// ── Textarea ──────────────────────────────────────────────────────────────────
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  fullWidth?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      errorMessage,
      fullWidth = true,
      className,
      isInvalid,
      isDisabled,
      isRequired,
      ...rest
    },
    ref,
  ) => (
    <div className={clsx("flex flex-col gap-0.5", fullWidth && "w-full")}>
      {label && (
        <label className="text-xs font-medium text-text-main">
          {label}
          {isRequired && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded border border-border-base bg-surface px-2.5 py-1.5",
          "text-xs text-text-main placeholder:text-text-muted/60",
          "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
          "transition-colors duration-200 resize-y",
          (isInvalid || errorMessage) && "!border-error",
          isDisabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        disabled={isDisabled ?? rest.disabled}
        {...rest}
      />
      {description && !errorMessage && (
        <p className="text-[11px] text-text-muted">{description}</p>
      )}
      {errorMessage && (
        <p className="text-[11px] text-error">{errorMessage}</p>
      )}
    </div>
  ),
);
Textarea.displayName = "Textarea";
