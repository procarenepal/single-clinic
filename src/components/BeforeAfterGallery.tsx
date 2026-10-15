import { useState, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Reveal } from "@/components/ui/Reveal";
import {
  DEFAULT_CONTENT,
  LandingPageContent,
} from "@/services/landingPageService";

const SERIF = { fontFamily: "'Fraunces', serif" };

type GalleryContent = LandingPageContent["gallerySection"];

interface Case {
  id: number;
  tag: string;
  label: string;
  sessions: string;
  image: string;
  result: string;
}

function SliderCard({ item }: { item: Case }) {
  const [pct, setPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calcPct = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(5, Math.min(95, raw)));
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) calcPct(e.clientX);
    },
    [dragging, calcPct],
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      calcPct(e.touches[0].clientX);
    },
    [calcPct],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden select-none cursor-col-resize"
      style={{ boxShadow: "0 20px 40px -20px rgba(0,0,0,0.3)" }}
      onMouseMove={onMouseMove}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      {/* AFTER — full image underneath (right half of split image) */}
      <img
        alt="After"
        className="absolute inset-0 w-full h-full object-cover"
        src={item.image}
        draggable={false}
        style={{ objectPosition: "right center" }}
      />

      {/* BEFORE — clipped overlay on the left */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      >
        <img
          alt="Before"
          className="absolute inset-0 w-full h-full object-cover"
          src={item.image}
          draggable={false}
          style={{ objectPosition: "left center" }}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute inset-y-0 w-0.5 pointer-events-none"
        style={{
          left: `${pct}%`,
          background: "white",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
        }}
      />

      {/* Drag Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center z-10 touch-none"
        style={{
          left: `${pct}%`,
          background: "white",
          boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
          cursor: "col-resize",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onTouchStart={(e) => {
          calcPct(e.touches[0].clientX);
        }}
        onTouchMove={onTouchMove}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M9 18l-6-6 6-6M15 6l6 6-6 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Labels */}
      <span
        className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white pointer-events-none"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      >
        Before
      </span>
      <span
        className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white pointer-events-none"
        style={{
          background: "rgba(var(--color-primary),0.9)",
          backdropFilter: "blur(4px)",
        }}
      >
        After
      </span>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 py-3 flex items-center justify-between pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
        }}
      >
        <div>
          <p className="text-white text-xs font-bold">{item.label}</p>
          <p className="text-white/70 text-[11px]">{item.sessions}</p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
          style={{ background: "rgba(var(--color-primary),0.9)" }}
        >
          {item.result}
        </span>
      </div>
    </div>
  );
}

export default function BeforeAfterGallery({
  content = DEFAULT_CONTENT.gallerySection,
}: {
  content?: GalleryContent;
}) {
  const [activeTab, setActiveTab] = useState("All");

  const cases: Case[] = content.cases.map((c, i) => ({
    id: i,
    tag: c.tag,
    label: c.label,
    sessions: c.sessions,
    image: c.imageUrl,
    result: c.result,
  }));
  // Filter tabs follow the cases: "All" plus each distinct tag, in order.
  const tabs = [
    "All",
    ...Array.from(new Set(cases.map((c) => c.tag).filter(Boolean))),
  ];

  const filtered =
    activeTab === "All" ? cases : cases.filter((c) => c.tag === activeTab);

  return (
    <section
      className="py-10 lg:py-24"
      style={{ borderColor: "rgb(var(--color-border))" }}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        {/* Header */}
        <Reveal className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8 lg:mb-14">
          <div className="text-center lg:text-left">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
              style={{
                background: "rgba(var(--color-primary),0.08)",
                border: "1px solid rgba(var(--color-primary),0.18)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "rgb(var(--color-primary))" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgb(var(--color-primary))" }}
              >
                {content.eyebrow}
              </span>
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl mb-3 leading-tight tracking-tight"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              {content.title}
            </h2>
            <p
              className="text-sm sm:text-base"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              {content.subtitle}
            </p>
          </div>

          {/* Filter tabs */}
          <div
            className="flex flex-wrap justify-center lg:justify-end gap-2"
            hidden={tabs.length <= 2}
          >
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-150"
                style={
                  activeTab === t
                    ? {
                        background: "rgb(var(--color-primary))",
                        color: "white",
                        borderColor: "rgb(var(--color-primary))",
                      }
                    : {
                        background: "transparent",
                        color: "rgb(var(--color-text-muted))",
                        borderColor: "rgb(var(--color-border))",
                      }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== t)
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgb(var(--color-primary))";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== t)
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgb(var(--color-border))";
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Slider cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {filtered.map((item, i) => (
            <Reveal
              key={item.id}
              delay={i * 100}
              className={i % 2 === 1 ? "sm:mt-8" : ""}
            >
              <SliderCard item={item} />
            </Reveal>
          ))}
        </div>

        {/* Results stats strip */}
        <Reveal className="mt-8 lg:mt-14">
          <div
            className="rounded-2xl p-5 lg:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center"
            style={{
              background: "rgb(var(--color-surface))",
              border: "1px solid rgb(var(--color-border))",
              boxShadow: "0 20px 40px -28px rgba(0,0,0,0.15)",
            }}
          >
            {content.stats.map((s, i) => (
              <div key={i}>
                <p
                  className="text-2xl lg:text-3xl mb-1 tabular-nums"
                  style={{
                    ...SERIF,
                    fontWeight: 600,
                    color: "rgb(var(--color-primary))",
                  }}
                >
                  {s.value}
                </p>
                <p
                  className="text-xs font-medium"
                  style={{ color: "rgb(var(--color-text-muted))" }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            to={content.ctaLink}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(135deg, rgb(var(--color-primary)) 0%, color-mix(in srgb, rgb(var(--color-primary)) 70%, #a78bfa) 100%)",
              boxShadow: "0 16px 32px -12px rgba(var(--color-primary),0.5)",
            }}
          >
            {content.ctaText} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
