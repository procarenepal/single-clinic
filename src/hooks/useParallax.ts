import { useEffect, useRef } from "react";

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Returns a ref to attach to an element; while it's near the viewport, its
 * translateY is nudged by (distance from viewport center * speed) on scroll.
 * speed > 0 drifts down relative to scroll, speed < 0 drifts up (typical
 * background/decorative parallax feel). No-ops under prefers-reduced-motion.
 *
 * If the element also needs a static transform (e.g. a fixed translate/rotate
 * for positioning), pass it as `baseTransform` rather than setting it via the
 * React `style` prop — this hook writes `element.style.transform` directly on
 * scroll, so a React-controlled transform would fight it and snap back on
 * every re-render.
 */
export function useParallax<T extends HTMLElement>(speed: number, baseTransform = "") {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const offset = (viewportCenter - elementCenter) * speed;
      el.style.transform = `${baseTransform} translate3d(0, ${offset}px, 0)`.trim();
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed, baseTransform]);

  return ref;
}
