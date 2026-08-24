import { useState, useEffect, useRef, ReactNode, TouchEvent } from "react";

interface CarouselProps {
  items: ReactNode[];
  autoPlayInterval?: number;
  className?: string;
}

// Minimum horizontal drag distance (px) before a touch gesture counts as a swipe.
const SWIPE_THRESHOLD = 40;
export function Carousel({
  items,
  autoPlayInterval = 5000,
  className = "",
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    if (!autoPlayInterval) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, items.length, autoPlayInterval]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? items.length - 1 : prevIndex - 1,
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
  };

  // ── Touch swipe handling ──
  // touchAction: "pan-y" (below) tells the browser this element drives horizontal
  // gestures itself while still allowing native vertical page scroll to pass through,
  // so we never need to fight the browser with preventDefault mid-gesture.
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isSwiping.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Once vertical intent is clear, bail out and let the page scroll normally.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      isSwiping.current = false;
      setDragOffset(0);

      return;
    }
    setDragOffset(dx);
  };

  const handleTouchEnd = () => {
    if (isSwiping.current) {
      if (dragOffset > SWIPE_THRESHOLD) {
        goToPrev();
      } else if (dragOffset < -SWIPE_THRESHOLD) {
        goToNext();
      }
    }
    isSwiping.current = false;
    setDragOffset(0);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Slides container */}
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
          transition: dragOffset === 0 ? "transform 500ms ease-in-out" : "none",
          touchAction: "pan-y",
        }}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        {items.map((item, index) => (
          <div key={index} className="w-full flex-shrink-0 h-full">
            {item}
          </div>
        ))}
      </div>

      {/* Navigation Buttons — hidden on mobile (swipe covers it there; narrow slide
          content, like the testimonial text cards, has no room to spare without
          the arrows overlapping it) and 44px min touch target from sm: up. */}
      <button
        aria-label="Previous slide"
        className="hidden sm:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 w-11 h-11 lg:w-10 lg:h-10 items-center justify-center rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] shadow-sm transition-all z-10 p-0 active:scale-95"
        onClick={goToPrev}
      >
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <button
        aria-label="Next slide"
        className="hidden sm:flex absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 w-11 h-11 lg:w-10 lg:h-10 items-center justify-center rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] shadow-sm transition-all z-10 p-0 active:scale-95"
        onClick={goToNext}
      >
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {items.map((_, index) => (
          // p-2.5 / -m-2.5 expands the tap target well past the visual dot
          // without changing the dots' visual spacing in the flex row.
          <button
            key={index}
            aria-label={`Go to slide ${index + 1}`}
            className="p-2.5 -m-2.5 flex items-center justify-center"
            onClick={() => goToSlide(index)}
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${currentIndex === index
                ? "bg-[rgb(var(--color-primary))] w-6"
                : "bg-[rgb(var(--color-border))] w-2"
                }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
