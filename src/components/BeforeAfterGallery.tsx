import { useState, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const cases = [
  {
    id: 1,
    tag: "Glass Skin Facial",
    label: "Glass Skin",
    sessions: "3 Sessions",
    image: "/images/ba_1.png",
    result: "Luminosity +68%",
  },
  {
    id: 2,
    tag: "Laser Therapy",
    label: "Laser Pigmentation",
    sessions: "4 Sessions",
    image: "/images/ba_2.png",
    result: "Spots reduced -82%",
  },
  {
    id: 3,
    tag: "Hydration Boost",
    label: "Deep Hydration",
    sessions: "2 Sessions",
    image: "/images/ba_3.png",
    result: "Hydration +91%",
  },
];

const tabs = ["All", "Glass Skin Facial", "Laser Therapy", "Hydration Boost"];

function SliderCard({ item }: { item: typeof cases[number] }) {
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
    (e: React.MouseEvent) => { if (dragging) calcPct(e.clientX); },
    [dragging, calcPct],
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => { calcPct(e.touches[0].clientX); },
    [calcPct],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border select-none cursor-col-resize"
      style={{ borderColor: "rgb(var(--color-border))" }}
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
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={(e) => { calcPct(e.touches[0].clientX); }}
        onTouchMove={onTouchMove}
      >
        <svg className="w-5 h-5" fill="none" stroke="rgb(var(--color-primary))" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
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
        style={{ background: "rgba(var(--color-primary),0.9)", backdropFilter: "blur(4px)" }}
      >
        After
      </span>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 py-3 flex items-center justify-between pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
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

export default function BeforeAfterGallery() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All"
    ? cases
    : cases.filter((c) => c.tag === activeTab);

  return (
    <section className="py-14 lg:py-24 border-b" style={{ borderColor: "rgb(var(--color-border))" }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 lg:mb-14">
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--color-primary))" }}>
              Real Results
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3" style={{ color: "rgb(var(--color-text))" }}>
              Before &amp; After
            </h2>
            <p className="text-sm sm:text-base" style={{ color: "rgb(var(--color-text-muted))" }}>
              Drag the slider to reveal the transformation. Real patients, real results.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap justify-center lg:justify-end gap-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150"
                style={
                  activeTab === t
                    ? { background: "rgb(var(--color-primary))", color: "white", borderColor: "rgb(var(--color-primary))" }
                    : { background: "transparent", color: "rgb(var(--color-text-muted))", borderColor: "rgb(var(--color-border))" }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== t) (e.currentTarget as HTMLElement).style.borderColor = "rgb(var(--color-primary))";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== t) (e.currentTarget as HTMLElement).style.borderColor = "rgb(var(--color-border))";
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Slider cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {filtered.map((item) => (
            <SliderCard key={item.id} item={item} />
          ))}
        </div>

        {/* Results stats strip */}
        <div
          className="mt-10 lg:mt-14 rounded-2xl p-6 lg:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center"
          style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
        >
          {[
            { value: "5,000+", label: "Treatments Completed" },
            { value: "98%", label: "Patient Satisfaction" },
            { value: "4.9★", label: "Average Rating" },
            { value: "3–5", label: "Sessions to Full Results" },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl lg:text-3xl font-bold mb-1 tabular-nums" style={{ color: "rgb(var(--color-primary))" }}>
                {s.value}
              </p>
              <p className="text-xs font-medium" style={{ color: "rgb(var(--color-text-muted))" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--color-primary))" }}
          >
            Book Your Consultation <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}
