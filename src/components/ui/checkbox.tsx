import React from "react";
import clsx from "clsx";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  isSelected?: boolean;
  /** Tri-state visual. When true, shows a minus and sets input.indeterminate */
  isIndeterminate?: boolean;
  onValueChange?: (value: boolean) => void;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  color?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger";
}

export const Checkbox: React.FC<CheckboxProps> = ({
  isSelected,
  isIndeterminate,
  onValueChange,
  size = "md",
  color = "primary",
  checked,
  defaultChecked,
  children,
  className,
  disabled,
  ...rest
}) => {
  const [internalChecked, setInternalChecked] =
    React.useState<boolean>(!!defaultChecked);
  const isControlled =
    typeof isSelected === "boolean" || typeof checked === "boolean";
  const value =
    (typeof isSelected === "boolean" ? isSelected : checked) ?? internalChecked;
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Native indeterminate state must be set imperatively
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!isIndeterminate && !value;
    }
  }, [isIndeterminate, value]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.checked;

    if (!isControlled) {
      setInternalChecked(next);
    }
    onValueChange?.(next);
    rest.onChange?.(e);
  };

  const boxSize =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const activeClasses =
    color === "primary"
      ? "bg-primary border-primary text-white"
      : color === "secondary" || color === "success"
        ? "bg-success border-success text-white"
        : color === "warning"
          ? "bg-warning border-warning text-white"
          : color === "danger"
            ? "bg-danger border-danger text-white"
            : "bg-text-main border-text-main text-white";

  return (
    <label
      className={clsx(
        "inline-flex items-center gap-2 text-sm text-text-main",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded border border-border-base bg-surface",
          boxSize,
          (value || isIndeterminate) && activeClasses,
        )}
      >
        {isIndeterminate && !value ? (
          <span className="text-[12px] leading-none font-bold">−</span>
        ) : value ? (
          <span className="text-[10px] leading-none">✓</span>
        ) : null}
      </span>
      <input
        {...rest}
        ref={inputRef}
        aria-checked={isIndeterminate && !value ? "mixed" : value}
        checked={value}
        className="sr-only"
        disabled={disabled}
        type="checkbox"
        onChange={handleChange}
      />
      {children && <span>{children}</span>}
    </label>
  );
};

export interface CheckboxGroupProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
  children: React.ReactNode;
  className?: string;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  value,
  defaultValue = [],
  onValueChange,
  children,
  className,
}) => {
  const [internal, setInternal] = React.useState<string[]>(defaultValue);
  const isControlled = Array.isArray(value);
  const current = isControlled ? (value as string[]) : internal;

  const toggle = (val: string) => {
    const exists = current.includes(val);
    const next = exists ? current.filter((v) => v !== val) : [...current, val];

    if (!isControlled) {
      setInternal(next);
    }
    onValueChange?.(next);
  };

  const items = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const val = (child.props as any).value as string | undefined;

    if (!val) return child;
    const checked = current.includes(val);

    return React.cloneElement(child as React.ReactElement<any>, {
      isSelected: checked,
      onValueChange: (selected: boolean) => {
        toggle(val);
        if (typeof (child.props as any).onValueChange === "function") {
          (child.props as any).onValueChange(selected);
        }
      },
    });
  });

  return <div className={clsx("flex flex-col gap-2", className)}>{items}</div>;
};
