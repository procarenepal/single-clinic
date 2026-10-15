import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts the number inside a display string up from 0 every time it scrolls into
 * view (so on every page load, and again when scrolled back to):
 * "5k+" → 0k+ … 5k+, "100%" → 0% … 100%, "4.9/5" → 0.0/5 … 4.9/5.
 * Text around the number is kept as-is; a value with no number is shown unchanged.
 * Under prefers-reduced-motion the final value is shown straight away.
 */
export function CountUp({
  value,
  duration = 1600,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const match = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!match) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setProgress(1);

      return;
    }

    let frame = 0;
    let delay = 0;
    const stop = () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        stop();
        if (!entry.isIntersecting) {
          setProgress(0); // off-screen: rewind so it replays on the next view

          return;
        }
        // Brief pause so the strip's fade-in has finished and the count is seen.
        delay = window.setTimeout(() => {
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);

            setProgress(1 - Math.pow(1 - t, 3)); // ease-out
            if (t < 1) frame = requestAnimationFrame(tick);
          };

          frame = requestAnimationFrame(tick);
        }, 300);
      },
      { threshold: 0.6 },
    );

    if (ref.current) observer.observe(ref.current);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [value, duration]);

  if (!match) return <span className={className}>{value}</span>;

  const [, prefix, digits, suffix] = match;
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  const shown = (parseFloat(digits) * progress).toFixed(decimals);

  return (
    <span ref={ref} aria-label={value} className={className}>
      <span aria-hidden>
        {prefix}
        {shown}
        {suffix}
      </span>
    </span>
  );
}
