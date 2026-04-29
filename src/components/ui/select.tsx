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
  "flex items-center gap-2 rounded-md border bg-surface text-text-main border-border-base focus-within:ring-2 " +
  "focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 min-h-[40px] w-full";

const variantClasses: Record<NonNullable<SelectProps["variant"]>, string> = {
  bordered: "border-border-base bg-surface",
  flat: "border-transparent bg-surface-2",
  underlined: "border-0 border-b border-border-base rounded-none",
};

const sizeClasses: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "min-h-[32px] text-xs",
  md: "min-h-[40px] text-sm",
  lg: "min-h-[44px] text-base",
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
  fullWidth = true,
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
    <div className={clsx("flex flex-col gap-1.5 w-full", className)}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative w-full">
        <select
          {...rest}
          className={clsx(
            "w-full min-h-[40px] bg-surface border border-border-base text-text-main text-[13.5px] rounded-md px-4 py-2 outline-none",
            "appearance-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer",
            errorMessage && "!border-red-500",
            classNames?.value,
          )}
          style={{ colorScheme: "inherit" }}
          disabled={isDisabled ?? rest.disabled}
          required={isRequired ?? rest.required}
          value={currentKey !== undefined ? String(currentKey) : ""}
          onChange={handleChange}
        >
          {placeholder && (
            <option disabled hidden value="">
              {placeholder}
            </option>
          )}
          {items.map((item) => (
            <option key={item.key} value={String(item.key)}>
              {item.label}
            </option>
          ))}
          {React.Children.map(children, (child: any) => {
            if (child?.type?.name === "SelectItem" || child?.props?.value) {
              return (
                <option key={child.props.value} value={child.props.value}>
                  {child.props.children}
                </option>
              );
            }
            return child;
          })}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 9l-7 7-7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </span>
      </div>
      {description && !errorMessage && (
        <p className="text-xs text-text-muted/80">{description}</p>
      )}
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
};
