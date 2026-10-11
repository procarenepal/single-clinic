import type { KeyboardEvent } from "react";

/**
 * Upper-cases the first letter of every word ("namita giri" → "Namita Giri").
 * Only the first letter is touched — the rest is left as typed so "PO Box" or
 * "McDonald" survive — and scripts without case (e.g. Devanagari) are untouched.
 * Safe to run on every keystroke: it never trims, so a trailing space stays.
 */
export function capitalizeWords(value: string): string {
  return value.replace(
    /(^|[\s-])(\p{Ll})/gu,
    (_match, boundary: string, letter: string) =>
      boundary + letter.toLocaleUpperCase(),
  );
}

const BS_DATE_PART_LENGTHS = [4, 2, 2];

/**
 * Formats a Nepali (BS) date as YYYY/MM/DD while it is being typed or pasted:
 * "20020314" → "2002/03/14". A "/" (or "-", ".", space) typed by hand closes
 * the part, zero-padding a one-digit month/day: "2080/6/" → "2080/06/".
 * Anything that is not a digit or one of those separators is dropped.
 */
export function formatBsDateInput(value: string): string {
  const parts = [""];

  for (const ch of value) {
    const current = parts.length - 1;

    if (/\d/.test(ch)) {
      if (parts[current].length < BS_DATE_PART_LENGTHS[current]) {
        parts[current] += ch;
      } else if (current < 2) {
        parts.push(ch); // part is full — the digit starts the next one
      }
    } else if (/[/.\s-]/.test(ch) && current < 2 && parts[current]) {
      // A typed separator closes the part; the year is only closed once complete.
      if (current === 0 && parts[0].length < 4) continue;
      if (current > 0) parts[current] = parts[current].padStart(2, "0");
      parts.push("");
    }
  }

  return parts.join("/");
}

/**
 * Where the caret belongs after `typed` was rewritten to `next` (the browser
 * throws it to the end whenever the value is replaced). At the end of the text it
 * stays at the end; mid-text it goes after the same number of letters/digits.
 */
export function caretAfterTransform(
  typed: string,
  next: string,
  caret: number,
): number {
  if (caret >= typed.length) return next.length;

  const isAlnum = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
  let remaining = Array.from(typed.slice(0, caret)).filter(isAlnum).length;
  let position = 0;

  while (remaining > 0 && position < next.length) {
    if (isAlnum(next[position])) remaining--;
    position++;
  }

  return position;
}

const NAVIGABLE_FIELD = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "select",
  "textarea",
].join(",");

/**
 * Moves focus to the next editable field of the same <form>, in DOM order.
 * Returns false when there is no next field (current one is the last).
 */
export function focusNextField(current: HTMLElement): boolean {
  const form = current.closest("form");

  if (!form) return false;

  const fields = Array.from(
    form.querySelectorAll<HTMLInputElement>(NAVIGABLE_FIELD),
  );
  const start = fields.indexOf(current as HTMLInputElement);

  if (start === -1) return false;

  const next = fields
    .slice(start + 1)
    .find(
      (el) =>
        !el.disabled &&
        !el.readOnly &&
        el.tabIndex >= 0 &&
        el.offsetParent !== null,
    );

  if (!next) return false;

  next.focus();
  // Same as arriving with Tab: existing text is selected, ready to overtype.
  if (next instanceof HTMLInputElement) next.select();

  return true;
}

/**
 * onKeyDown handler: Enter jumps to the next field instead of submitting.
 * On the last field it does nothing, so the form's normal Enter behaviour stays.
 */
export function handleEnterToNext(e: KeyboardEvent<HTMLElement>): void {
  if (
    e.key !== "Enter" ||
    e.shiftKey ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey ||
    e.nativeEvent.isComposing
  )
    return;

  if (focusNextField(e.currentTarget)) e.preventDefault();
}
