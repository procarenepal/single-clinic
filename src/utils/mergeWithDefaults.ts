const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  typeof (v as any).toDate !== "function";

/**
 * Lays saved content over the defaults. Objects merge field by field, so a
 * document saved before a field existed still gets that field's default. Arrays
 * are taken as saved (so deleting or reordering an item sticks), with each item
 * topped up from the default at the same position. A saved value of the wrong
 * type is ignored in favour of the default.
 */
export function mergeWithDefaults<T>(defaultsIn: T, saved: unknown): T {
  const defaults: any = defaultsIn;

  if (saved === undefined || saved === null) return defaultsIn;

  if (Array.isArray(defaults)) {
    if (!Array.isArray(saved)) return defaultsIn;

    return saved.map((item: unknown, i: number) =>
      isPlainObject(item) && isPlainObject(defaults[i])
        ? mergeWithDefaults(defaults[i], item)
        : item,
    ) as unknown as T;
  }

  if (isPlainObject(defaults)) {
    if (!isPlainObject(saved)) return defaultsIn;
    const out: Record<string, any> = { ...defaults };

    for (const key of Object.keys(saved)) {
      out[key] =
        key in defaults
          ? mergeWithDefaults(defaults[key], saved[key])
          : saved[key];
    }

    return out as T;
  }

  return typeof saved === typeof defaults ? (saved as T) : defaultsIn;
}
