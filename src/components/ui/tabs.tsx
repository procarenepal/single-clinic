import React from "react";
import clsx from "clsx";

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedKey?: React.Key;
  defaultSelectedKey?: React.Key;
  onSelectionChange?: (key: React.Key) => void;
  variant?: "solid" | "bordered" | "underlined";
  color?: "default" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  classNames?: {
    tabList?: string;
    tab?: string;
    tabContent?: string;
    cursor?: string;
  };
}

export interface TabProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
}

export const Tab: React.FC<TabProps> = ({ children }) => {
  // This component is only used as a configuration child for Tabs
  return <>{children}</>;
};

export const Tabs: React.FC<TabsProps> = ({
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  variant = "underlined",
  color = "primary",
  size = "md",
  className,
  classNames,
  children,
  ...rest
}) => {
  const items: {
    key: React.Key;
    title: React.ReactNode;
    content: React.ReactNode;
  }[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === Tab) {
      const key = child.key;

      if (key == null) return;
      items.push({
        key,
        title: child.props.title ?? child.props["aria-label"] ?? key,
        content: child.props.children,
      });
    }
  });

  const firstKey = items[0]?.key;

  const [internalKey, setInternalKey] = React.useState<React.Key | undefined>(
    selectedKey ?? defaultSelectedKey ?? firstKey,
  );

  const currentKey = selectedKey ?? internalKey ?? firstKey;

  const handleSelect = (key: React.Key) => {
    if (key === currentKey) return;
    if (selectedKey === undefined) {
      setInternalKey(key);
    }
    onSelectionChange?.(key);
  };

  const sizeClasses =
    size === "sm"
      ? "text-xs h-9"
      : size === "lg"
        ? "text-sm h-11"
        : "text-sm h-10";

  const activeColor =
    color === "primary"
      ? "text-nepal-700"
      : color === "secondary"
        ? "text-health-700"
        : "text-mountain-800";

  const cursorColor =
    color === "primary"
      ? "bg-nepal-600"
      : color === "secondary"
        ? "bg-health-600"
        : "bg-mountain-700";

  return (
    <div className={className} {...rest}>
      <div
        className={clsx(
          "flex w-full border-b border-mountain-200 dark:border-zinc-800 overflow-x-auto scrollbar-none",
          classNames?.tabList,
        )}
      >
        {items.map((item) => {
          const isActive = String(item.key) === String(currentKey);

          return (
            <button
              key={item.key}
              className={clsx(
                "relative px-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-md transition-all duration-200",
                "text-mountain-600 dark:text-zinc-400 hover:text-mountain-900 dark:hover:text-zinc-100 hover:bg-mountain-50 dark:hover:bg-zinc-800/50",
                sizeClasses,
                isActive && activeColor,
                classNames?.tab,
              )}
              type="button"
              onClick={() => handleSelect(item.key)}
            >
              <span
                className={clsx(
                  "flex items-center gap-2",
                  isActive && classNames?.tabContent,
                )}
              >
                {item.title}
              </span>
              {variant === "underlined" && (
                <span
                  className={clsx(
                    "pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-transparent",
                    isActive && cursorColor,
                    classNames?.cursor,
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2">
        {items.map((item) =>
          String(item.key) === String(currentKey) ? (
            <div key={item.key}>{item.content}</div>
          ) : null,
        )}
      </div>
    </div>
  );
};
