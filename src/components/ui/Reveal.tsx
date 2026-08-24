import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";

type Direction = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: Direction;
}

const OFFSETS: Record<Direction, string> = {
  up: "translateY(40px)",
  left: "translateX(-40px)",
  right: "translateX(40px)",
  scale: "scale(0.92)",
};

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Fades + slides a section into place the first time it enters the viewport.
 * No-ops entirely under prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, className = "", direction = "up" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = prefersReducedMotion
    ? {}
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : OFFSETS[direction],
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
