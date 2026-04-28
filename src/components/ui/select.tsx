import React from "react";
import clsx from "clsx";

export interface SelectItemProps {
  children: React.ReactNode;
  startContent?: React.ReactNode;
  value?: string;
}

export const SelectItem: React.FC<SelectItemProps> = () => null;

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  placeholder?: string;
  variant?: "bordered" | "flat" | "underlined";
  radius?: "sm" | "md" | "lg";
  size?: "sm" | "md" | "lg";
  isRequired?: boolean;
  isDisabled?: boolean;
  selectedKeys?: Iterable<React.Key> | "all";
  defaultSelectedKeys?: Iterable<React.Key> | "all";
  onSelectionChange?: (keys: Set<React.Key>) => void;
  fullWidth?: boolean;
  classNames?: {
    trigger?: string;
    value?: string;
  };
}

const baseWrapper =
  "flex items-center gap-2 rounded-md border bg-white dark:bg-zinc-950 text-mountain-900 dark:text-zinc-100 border-mountain-200 dark:border-zinc-800 focus-within:ring-2 " +
  "focus-within:ring-nepal-500 focus-within:border-nepal-500 transition-all duration-200";

const variantClasses: Record<NonNullable<SelectProps["variant"]>, string> = {
  bordered: "border-mountain-200 bg-white",
  flat: "border-transparent bg-mountain-50",
  underlined: "border-0 border-b border-mountain-200 rounded-none",
};

const sizeClasses: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-8 text-xs",
  md: "h-10 text-sm",
  lg: "h-11 text-base",
};

const radiusClasses: Record<NonNullable<SelectProps["radius"]>, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
};

export const Select: React.FC<SelectProps> = ({
  label,
  description,
  errorMessage,
  placeholder,
  variant = "bordered",
  radius = "md",
  size = "md",
  isRequired,
  isDisabled,
  fullWidth,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  className,
  classNames,
  children,
  ...rest
}) => {
  const items: { key: React.Key; label: React.ReactNode }[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const key = child.key ?? (child.props as any).itemKey;

      if (key == null) return;
      items.push({ key, label: child.props.children });
    }
  });

  const initialKey =
    selectedKeys && selectedKeys !== "all"
      ? Array.from(selectedKeys)[0]
      : defaultSelectedKeys && defaultSelectedKeys !== "all"
        ? Array.from(defaultSelectedKeys)[0]
        : undefined;

  const [internalKey, setInternalKey] = React.useState<React.Key | undefined>(
    initialKey,
  );

  const isControlled = selectedKeys !== undefined;
  const currentKey =
    selectedKeys && selectedKeys !== "all"
      ? Array.from(selectedKeys)[0]
      : internalKey;

  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const nextKey = e.target.value;

    if (!isControlled) {
      setInternalKey(nextKey);
    }
    if (onSelectionChange) {
      onSelectionChange(new Set<React.Key>([nextKey]));
    }
    rest.onChange?.(e);
  };

  const valueLabel =
    items.find((i) => String(i.key) === String(currentKey))?.label ?? "";

  return (
    <div className={clsx("flex flex-col gap-1", fullWidth && "w-full", className)}>
      {label && (
        <label className="text-xs font-medium text-mountain-700 dark:text-zinc-400">
          {label}
        </label>
      )}
      <div
        className={clsx(
          baseWrapper,
          "px-2.5",
          variantClasses[variant],
          radiusClasses[radius],
          sizeClasses[size],
          fullWidth && "w-full",
          errorMessage && "!border-red-500 focus-within:ring-red-500",
          classNames?.trigger,
        )}
      >
        <select
          {...rest}
          className={clsx(
            "flex-1 bg-transparent outline-none border-none text-[13px] text-mountain-900 dark:text-zinc-100",
            "appearance-none pr-6",
            classNames?.value,
          )}
          disabled={isDisabled ?? rest.disabled}
          required={isRequired ?? rest.required}
          value={currentKey !== undefined ? String(currentKey) : ""}
          onChange={handleChange}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {items.map((item) => (
            <option key={item.key} value={String(item.key)}>
              {item.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none relative -mr-1 flex h-full items-center text-mountain-400 dark:text-zinc-500">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            focusable="false"
            viewBox="0 0 20 20"
          >
            <path
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      {description && !errorMessage && (
        <p className="text-xs text-mountain-500">{description}</p>
      )}
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
};
