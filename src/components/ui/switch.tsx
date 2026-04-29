import React from "react";
import clsx from "clsx";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  isSelected?: boolean;
  onValueChange?: (value: boolean) => void;
  label?: React.ReactNode;
}

export const Switch: React.FC<SwitchProps> = ({
  isSelected,
  onValueChange,
  checked,
  defaultChecked,
  label,
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

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.checked;

    if (!isControlled) {
      setInternalChecked(next);
    }
    onValueChange?.(next);
    rest.onChange?.(e);
  };

  return (
    <label
      className={clsx(
        "inline-flex items-center gap-2 cursor-pointer",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        className={clsx(
          "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
          value
            ? "bg-primary border-primary"
            : "bg-surface-3 border-border-base",
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-transform",
            value ? "translate-x-4" : "translate-x-0.5",
          )}
        />
        <input
          {...rest}
          checked={value}
          className="sr-only"
          disabled={disabled}
          type="checkbox"
          onChange={handleChange}
        />
      </span>
      {label && <span className="text-sm text-text-main">{label}</span>}
    </label>
  );
};
