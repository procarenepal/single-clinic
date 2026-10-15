import { useState, useEffect, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  Users,
  Calendar,
  ClipboardList,
  Stethoscope,
  Building,
  ShieldCheck,
  ArrowRight,
  Star,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  Sparkles,
  Zap,
  Heart,
} from "lucide-react";

import { Carousel } from "@/components/ui/Carousel";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { useParallax } from "@/hooks/useParallax";
import {
  landingPageService,
  LandingPageContent,
} from "@/services/landingPageService";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import MeetTheTeam from "@/components/MeetTheTeam";

// Shared brand gradient used for icon badges throughout the landing page.
const BRAND_GRADIENT =
  "linear-gradient(135deg, rgb(var(--color-primary)) 0%, color-mix(in srgb, rgb(var(--color-primary)) 70%, #a78bfa) 100%)";
// Illustrated stat icons, keyed by the icon name stored in the homepage content.
// Both the current defaults and the older names resolve, so saved content works.
const STAT_IMAGES: Record<string, string> = {
  Users: "/images/stat_clients.png",
  Calendar: "/images/stat_experience.png",
  Building2: "/images/stat_experience.png",
  ShieldCheck: "/images/stat_certified.png",
  ClipboardList: "/images/stat_certified.png",
  Stethoscope: "/images/stat_rating.png",
};
// Editorial display serif for headlines — loaded in index.html, scoped to this page only.
const SERIF = { fontFamily: "'Fraunces', serif" };

function Eyebrow({
  children,
  plain,
}: {
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 mb-4 ${plain ? "" : "px-4 py-1.5 rounded-full mb-5"}`}
      style={
        plain
          ? undefined
          : {
              background: "rgb(var(--color-primary) / 0.08)",
              border: "1px solid rgb(var(--color-primary) / 0.18)",
            }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: "rgb(var(--color-primary))" }}
      />
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: "rgb(var(--color-primary))" }}
      >
        {children}
      </span>
    </div>
  );
}

function HeroBlobs() {
  const blobA = useParallax<HTMLDivElement>(-0.18);
  const blobB = useParallax<HTMLDivElement>(0.12);

  return (
    <>
      <div
        ref={blobA}
        className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-20"
        style={{
          background: "rgb(var(--color-primary))",
          filter: "blur(100px)",
        }}
      />
      <div
        ref={blobB}
        className="pointer-events-none absolute -bottom-32 -left-32 w-[380px] h-[380px] rounded-full opacity-10"
        style={{
          background: "rgb(var(--color-primary))",
          filter: "blur(100px)",
        }}
      />
    </>
  );
}

export default function IndexPage() {
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [loading, setLoading] = useState(true);

  const CLINIC_ID = "main-clinic";

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await landingPageService.getHomepageContent(CLINIC_ID);

        setContent(data);
      } catch (error) {
        console.error("Failed to fetch landing page content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  // Previously also fetched clinicService.getAllClinics() to override the
  // address with a live clinic record — but that's a super-admin-only read
  // (this is a PUBLIC landing page, visited by unauthenticated visitors) and
  // was always silently failing. content.contact.location (from
  // landingPageService, which already exists precisely for public-facing
  // content) is the correct source for this, not the clinics collection.

  const testimonials = [
    {
      name: "Ji-Su Park",
      role: "Patient",
      text: "The glass skin facial here is incredible. My skin has never looked this radiant. The clinicians are so professional and the products they use are clearly premium.",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
      rating: 5,
    },
    {
      name: "Sarah Jenkins",
      role: "Patient",
      text: "I was struggling with pigmentation for years. After just three sessions of their laser therapy, I see a massive difference. Highly recommend this clinic!",
      image:
        "https://images.unsplash.com/photo-1554151228-14d9def656e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
      rating: 5,
    },
  ];

  if (loading || !content) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "rgb(var(--color-bg))" }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "rgb(var(--color-primary))",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Headline: the last word is set apart in italic brand colour.
  const heroTitleWords = content.hero.title.trim().split(/\s+/);
  const heroTitleAccent = heroTitleWords[heroTitleWords.length - 1];
  const heroTitleLead = heroTitleWords.slice(0, -1).join(" ");

  const resolveIcon = (name: string) =>
    name === "Users"
      ? Users
      : name === "ClipboardList"
        ? ClipboardList
        : name === "Building2"
          ? Building2
          : name === "Stethoscope"
            ? Stethoscope
            : name === "Building"
              ? Building
              : name === "Calendar"
                ? Calendar
                : name === "ShieldCheck"
                  ? ShieldCheck
                  : MapPin;

  // -mt-6 cancels the layout's pt-6 so the hero sits flush under the navbar.
  return (
    <div
      className="min-h-screen -mt-6"
      style={{
        background: "rgb(var(--color-bg))",
        color: "rgb(var(--color-text))",
      }}
    >
      {/* ─────────────────────────────────────────────────────────────────────
          HERO
      ───────────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--color-surface)) 0%, rgb(var(--color-bg)) 100%)",
        }}
      >
        <HeroBlobs />

        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-8 lg:pb-10 flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          {/* Copy */}
          <Reveal className="flex-1 lg:flex-[0.85] max-w-xl text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Eyebrow>Advanced Aesthetic Medicine</Eyebrow>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl mb-6 leading-[1.08] tracking-tight"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              {heroTitleLead}
              {heroTitleLead && " "}
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "rgb(var(--color-primary))",
                }}
              >
                {heroTitleAccent}
              </span>
            </h1>

            <p
              className="text-base lg:text-lg leading-relaxed mb-8"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              {content.hero.subtitle}
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10 items-center sm:justify-center lg:justify-start lg:items-start">
              <Link
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold text-white rounded-xl transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: BRAND_GRADIENT,
                  boxShadow: "0 8px 16px -8px rgba(var(--color-primary),0.25)",
                }}
                to={content.hero.ctaLink}
              >
                {content.hero.ctaText}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                className="inline-flex items-center justify-center px-8 py-4 text-sm font-semibold rounded-xl border-2 transition-colors duration-150"
                style={{
                  color: "rgb(var(--color-text))",
                  borderColor: "rgb(var(--color-border))",
                  background: "rgb(var(--color-surface))",
                }}
                to="/features"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgb(var(--color-surface-2))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgb(var(--color-surface))";
                }}
              >
                View Services
              </Link>
            </div>

            {/* Trust row — elevated card */}
            <div
              className="inline-flex items-center gap-5 px-5 py-4 rounded-2xl mx-auto lg:mx-0"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
                boxShadow: "0 4px 12px -6px rgba(0,0,0,0.08)",
              }}
            >
              <div className="flex -space-x-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    alt="Patient"
                    className="w-9 h-9 rounded-full border-2 object-cover"
                    src={`https://i.pravatar.cc/100?u=skin-doc${i}`}
                    style={{ borderColor: "rgb(var(--color-surface))" }}
                  />
                ))}
              </div>
              <div
                className="w-px h-8 flex-shrink-0"
                style={{ background: "rgb(var(--color-border))" }}
              />
              <div className="text-left">
                <div className="flex items-center gap-1 mb-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                  <span className="text-sm font-bold ml-1">4.9</span>
                </div>
                <p
                  className="text-xs"
                  style={{ color: "rgb(var(--color-text-muted))" }}
                >
                  Trusted by 5,000+ patients
                </p>
              </div>
            </div>
          </Reveal>

          {/* Carousel with overlaid rating + doctor cards */}
          <Reveal
            className="flex-1 lg:flex-[1.25] w-full max-w-2xl relative"
            delay={150}
            direction="scale"
          >
            <div
              className="relative h-[260px] sm:h-[340px] lg:h-auto lg:aspect-[4/3] rounded-[1.75rem] overflow-hidden"
              style={{
                background: "rgb(var(--color-surface))",
                boxShadow: "0 18px 40px -18px rgba(0,0,0,0.18)",
              }}
            >
              <div className="absolute inset-0">
                <Carousel
                  autoPlayInterval={5000}
                  className="h-full"
                  items={[
                    <div key="1" className="relative w-full h-full group">
                      <img
                        alt="Glass Skin"
                        className="w-full h-full object-cover"
                        src="/images/banner_1.png"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute top-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">
                          Natural Glow
                        </p>
                        <p className="text-lg font-bold">
                          The Signature Glass Skin
                        </p>
                      </div>
                    </div>,
                    <div key="2" className="relative w-full h-full group">
                      <img
                        alt="Advanced Tech"
                        className="w-full h-full object-cover"
                        src="/images/banner_2.png"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute top-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">
                          Medical Grade
                        </p>
                        <p className="text-lg font-bold">
                          Advanced K-Laser Therapy
                        </p>
                      </div>
                    </div>,
                    <div key="3" className="relative w-full h-full group">
                      <img
                        alt="Clinic Interior"
                        className="w-full h-full object-cover"
                        src="/images/banner_3.png"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute top-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">
                          Serene Wellness
                        </p>
                        <p className="text-lg font-bold">
                          Premium Aesthetic Sanctuary
                        </p>
                      </div>
                    </div>,
                  ]}
                  variant="counter"
                />
              </div>
            </div>

            {/* Rating card — overlaps the top-right corner */}
            <div
              className="hidden sm:flex absolute -top-5 right-4 flex-col gap-0.5 px-4 py-3 rounded-2xl z-20"
              style={{
                background: "rgb(var(--color-surface))",
                boxShadow: "0 12px 28px -14px rgba(0,0,0,0.2)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="w-3 h-3 fill-amber-400" />
                  ))}
                </div>
                <p
                  className="text-sm font-extrabold leading-none"
                  style={{ color: "rgb(var(--color-text))" }}
                >
                  4.9/5
                </p>
              </div>
              <p
                className="text-[10px] font-medium text-right"
                style={{ color: "rgb(var(--color-text-muted))" }}
              >
                Patient Rating
              </p>
            </div>

            {/* Lead specialist card — bottom-left of the image */}
            <a
              className="hidden sm:flex absolute bottom-4 left-4 items-end z-20 group/doc"
              href="#team"
            >
              <div
                className="relative z-10 rounded-2xl p-1.5"
                style={{
                  background: "rgb(var(--color-surface))",
                  boxShadow: "0 12px 28px -14px rgba(0,0,0,0.25)",
                }}
              >
                <img
                  alt="Dr. Park"
                  className="w-[84px] h-[96px] lg:w-[96px] lg:h-[108px] rounded-xl object-cover object-top"
                  src="/images/team_1.png"
                />
              </div>
              <div
                className="-ml-4 mb-1 pl-7 pr-4 py-3 rounded-2xl flex items-center gap-5"
                style={{
                  background: "rgb(var(--color-surface))",
                  boxShadow: "0 12px 28px -14px rgba(0,0,0,0.25)",
                }}
              >
                <div>
                  <p
                    className="text-sm font-bold leading-tight"
                    style={{ color: "rgb(var(--color-text))" }}
                  >
                    Dr. Park
                  </p>
                  <p
                    className="text-[11px] font-medium mt-0.5"
                    style={{ color: "rgb(var(--color-primary))" }}
                  >
                    Lead Aesthetic Specialist
                  </p>
                </div>
                <ArrowRight
                  className="w-4 h-4 transition-transform duration-200 group-hover/doc:translate-x-0.5"
                  style={{ color: "rgb(var(--color-primary))" }}
                />
              </div>
            </a>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          STATS — flat card directly under the hero
      ───────────────────────────────────────────────────────────────────── */}
      <Reveal
        className="relative z-10 max-w-7xl mx-auto px-5 lg:px-8 mt-6 lg:mt-8"
        delay={100}
      >
        <div
          className="rounded-2xl lg:rounded-[1.75rem] overflow-hidden"
          style={{
            background: "rgb(var(--color-surface))",
            border: "1px solid rgb(var(--color-border))",
            boxShadow: "0 8px 24px -14px rgba(0,0,0,0.08)",
          }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[rgb(var(--color-border))]">
            {content.stats.map((stat, index) => {
              const IconComponent = resolveIcon(stat.icon);
              const statImage = STAT_IMAGES[stat.icon];

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 py-3 lg:py-3.5"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgb(var(--color-primary) / 0.1)" }}
                  >
                    {statImage ? (
                      <img
                        alt=""
                        className="w-7 h-7 object-contain"
                        src={statImage}
                      />
                    ) : (
                      <IconComponent
                        className="w-5 h-5"
                        style={{ color: "rgb(var(--color-primary))" }}
                      />
                    )}
                  </div>
                  <div>
                    <p
                      className="text-lg sm:text-xl font-bold tabular-nums tracking-tight leading-tight"
                      style={{ color: "rgb(var(--color-text))" }}
                    >
                      <CountUp value={stat.number} />
                    </p>
                    <p
                      className="text-xs leading-snug"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* ─────────────────────────────────────────────────────────────────────
          SERVICES
      ───────────────────────────────────────────────────────────────────── */}
      <section className="pt-14 lg:pt-20 pb-10 lg:pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          {/* Header */}
          <Reveal className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 lg:mb-10 text-center lg:text-left">
            <div className="max-w-2xl mx-auto lg:mx-0">
              <div className="flex justify-center lg:justify-start">
                <Eyebrow plain>Our Services</Eyebrow>
              </div>
              <h2
                className="text-3xl sm:text-4xl lg:text-[2.6rem] mb-3 leading-tight tracking-tight"
                style={{
                  ...SERIF,
                  fontWeight: 600,
                  color: "rgb(var(--color-text))",
                }}
              >
                Medical Aesthetic Services
              </h2>
              <p
                className="text-sm sm:text-base leading-relaxed"
                style={{ color: "rgb(var(--color-text-muted))" }}
              >
                Precision-engineered protocols fusing advanced dermatological
                science with Korean aesthetic innovation.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Link
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full border transition-colors hover:bg-[rgb(var(--color-primary)/0.06)]"
                style={{
                  color: "rgb(var(--color-primary))",
                  borderColor: "rgb(var(--color-primary) / 0.35)",
                  background: "rgb(var(--color-surface))",
                }}
                to="/features"
              >
                View All Services
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {content.services.map((service, index) => {
              const IconComponent = resolveIcon(service.icon);

              return (
                <Reveal key={index} className="h-full" delay={index * 90}>
                  <div
                    className="group flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: "rgb(var(--color-surface))",
                      border: "1px solid rgb(var(--color-border))",
                      boxShadow: "0 8px 24px -16px rgba(0,0,0,0.12)",
                    }}
                  >
                    {/* Image */}
                    <div className="aspect-[16/10] overflow-hidden">
                      <img
                        alt={service.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        src={`/images/service_${index + 1}.png`}
                      />
                    </div>

                    {/* Content */}
                    <div className="px-5 pb-5 flex flex-col flex-1">
                      <div
                        className="relative z-10 -mt-6 mb-3 w-12 h-12 rounded-full flex items-center justify-center"
                        style={{
                          background: "rgb(var(--color-surface))",
                          border: "1px solid rgb(var(--color-primary) / 0.2)",
                          boxShadow: "0 6px 14px -8px rgba(0,0,0,0.25)",
                        }}
                      >
                        <IconComponent
                          className="w-5 h-5"
                          style={{ color: "rgb(var(--color-primary))" }}
                        />
                      </div>

                      <h3
                        className="text-base font-semibold mb-2 tracking-tight"
                        style={{ color: "rgb(var(--color-text))" }}
                      >
                        {service.title}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed flex-1"
                        style={{ color: "rgb(var(--color-text-muted))" }}
                      >
                        {service.description}
                      </p>

                      <Link
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-75"
                        style={{ color: "rgb(var(--color-primary))" }}
                        to="/features"
                      >
                        Learn more <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })}

            {/* Explore card */}
            <Reveal className="h-full" delay={content.services.length * 90}>
              <div
                className="flex flex-col items-center justify-center text-center h-full min-h-[280px] rounded-2xl p-7"
                style={{
                  background: "rgb(var(--color-primary) / 0.06)",
                  border: "1px solid rgb(var(--color-primary) / 0.15)",
                }}
              >
                <Sparkles
                  className="w-10 h-10 mb-5"
                  strokeWidth={1.4}
                  style={{ color: "rgb(var(--color-primary))" }}
                />
                <h3
                  className="text-base font-semibold mb-3 tracking-tight"
                  style={{ color: "rgb(var(--color-text))" }}
                >
                  Explore All Treatments
                </h3>
                <p
                  className="text-[13px] leading-relaxed mb-6"
                  style={{ color: "rgb(var(--color-text-muted))" }}
                >
                  Discover our complete range of advanced aesthetic treatments
                  for your unique skin goals.
                </p>
                <Link
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full border transition-colors hover:bg-[rgb(var(--color-primary)/0.08)]"
                  style={{
                    color: "rgb(var(--color-primary))",
                    borderColor: "rgb(var(--color-primary) / 0.35)",
                    background: "rgb(var(--color-surface))",
                  }}
                  to="/features"
                >
                  View All Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          WHY CHOOSE US — "Science meets artistry"
      ───────────────────────────────────────────────────────────────────── */}
      <section
        className="py-12 lg:py-14 overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, rgb(var(--color-primary) / 0.07), rgb(var(--color-primary) / 0.03))",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,0.85fr)] items-center gap-10 lg:gap-10">
          {/* Copy */}
          <Reveal className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Eyebrow plain>Why Choose Us</Eyebrow>
            </div>
            <h2
              className="text-3xl sm:text-4xl leading-[1.1] tracking-tight mb-4"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              Science meets
              <br />
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "rgb(var(--color-primary))",
                }}
              >
                artistry.
              </span>
            </h2>
            <p
              className="text-sm leading-relaxed mb-6 max-w-sm mx-auto lg:mx-0"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              We combine advanced Korean technology, expert care, and a
              personalized approach to help you achieve healthy, radiant, and
              confident skin.
            </p>
            <Link
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full border transition-colors hover:bg-[rgb(var(--color-primary)/0.08)]"
              style={{
                color: "rgb(var(--color-primary))",
                borderColor: "rgb(var(--color-primary) / 0.35)",
                background: "rgb(var(--color-surface))",
              }}
              to="/about"
            >
              Learn More
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>

          {/* Four reasons */}
          <Reveal delay={100}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-8 text-center sm:text-left">
              {[
                {
                  icon: Zap,
                  title: "Korean Technology",
                  desc: "World-class equipment and protocols.",
                },
                {
                  icon: Users,
                  title: "Expert Doctors",
                  desc: "Certified & experienced dermatologists.",
                },
                {
                  icon: Heart,
                  title: "Personalized Care",
                  desc: "Treatments tailored to your skin needs.",
                },
                {
                  icon: ShieldCheck,
                  title: "Safe & Trusted",
                  desc: "FDA-approved & K-Certified products.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex flex-col items-center sm:items-start"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "rgb(var(--color-primary) / 0.1)" }}
                  >
                    <Icon
                      className="w-6 h-6"
                      strokeWidth={1.6}
                      style={{ color: "rgb(var(--color-primary))" }}
                    />
                  </div>
                  <p
                    className="text-sm font-semibold mb-1"
                    style={{ color: "rgb(var(--color-text))" }}
                  >
                    {title}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Portrait */}
          <Reveal
            className="relative mx-auto w-full max-w-[300px] lg:max-w-none"
            delay={200}
          >
            <div
              className="pointer-events-none absolute -right-8 -bottom-8 w-64 h-64 rounded-full"
              style={{ background: "rgb(var(--color-primary) / 0.12)" }}
            />
            <img
              alt="Radiant, healthy skin"
              className="relative w-full h-[300px] lg:h-[340px] object-cover object-center rounded-[2rem]"
              src="/images/banner_1.png"
              style={{ boxShadow: "0 18px 40px -22px rgba(0,0,0,0.3)" }}
            />
            <p
              className="absolute -top-5 -left-2 lg:-left-6 leading-[1.05] -rotate-6 pointer-events-none"
              style={{
                fontFamily: "'Caveat', cursive",
                fontWeight: 600,
                fontSize: "1.6rem",
                color: "rgb(var(--color-primary))",
                textShadow: "0 1px 0 rgba(255,255,255,0.8)",
              }}
            >
              Healthy Skin,
              <br />
              &nbsp;&nbsp;Happier You ♡
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          PROMO BANNER
      ───────────────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="py-4 px-5 lg:px-8 max-w-7xl mx-auto mb-6 lg:mb-10">
          <div
            className="relative h-[220px] sm:h-[280px] lg:h-[360px] rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 24px 48px -24px rgba(0,0,0,0.3)" }}
          >
            <img
              alt="Promotion"
              className="absolute inset-0 w-full h-full object-cover"
              src="/images/promo_banner.png"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-transparent" />

            <div className="absolute inset-0 flex items-center px-7 sm:px-10 lg:px-16">
              <div className="max-w-xs sm:max-w-sm text-white">
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 sm:mb-5"
                  style={{ background: "rgb(var(--color-primary))" }}
                >
                  Limited Offer
                </span>
                <h2
                  className="text-lg sm:text-2xl lg:text-4xl mb-2 sm:mb-4 leading-tight"
                  style={{ ...SERIF, fontWeight: 600 }}
                >
                  Signature Glass Skin Protocol
                </h2>
                <p className="text-xs sm:text-sm text-white/80 mb-4 sm:mb-7 leading-relaxed hidden sm:block">
                  First-time clients save 20% this month on our medical-grade
                  facial series.
                </p>
                <Link
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: "white",
                    color: "rgb(var(--color-text))",
                  }}
                  to="/contact"
                >
                  Claim Offer{" "}
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ─────────────────────────────────────────────────────────────────────
          HOW IT WORKS
      ───────────────────────────────────────────────────────────────────── */}
      <section
        className="py-16 lg:py-24 border-t border-b"
        style={{
          background: "rgb(var(--color-surface))",
          borderColor: "rgb(var(--color-border))",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <Reveal className="mb-10 lg:mb-14 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Eyebrow>Process</Eyebrow>
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl mb-4 leading-tight tracking-tight"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              Your Treatment Journey
            </h2>
            <p
              className="text-sm sm:text-base"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              A structured, evidence-based approach to skin health and aesthetic
              excellence.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-8">
            {content.process.map((item, i) => (
              <Reveal
                key={i}
                className="relative flex flex-col"
                delay={i * 120}
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-4 -left-1 text-[100px] leading-none select-none pointer-events-none opacity-[0.05]"
                  style={{
                    ...SERIF,
                    fontWeight: 700,
                    color: "rgb(var(--color-text))",
                  }}
                >
                  {item.step}
                </span>

                {/* Step indicator */}
                <div className="relative flex items-center gap-4 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{
                      background: BRAND_GRADIENT,
                      boxShadow:
                        "0 8px 16px -6px rgba(var(--color-primary),0.5)",
                    }}
                  >
                    {item.step}
                  </div>
                  {i < content.process.length - 1 && (
                    <div
                      className="hidden md:block flex-1 h-0.5 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(var(--color-primary),0.35), rgba(var(--color-primary),0.03))",
                      }}
                    />
                  )}
                </div>

                {/* Image */}
                <div
                  className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-6"
                  style={{ boxShadow: "0 12px 24px -12px rgba(0,0,0,0.18)" }}
                >
                  <img
                    alt={item.title}
                    className="w-full h-full object-cover"
                    src={`/images/step_${i + 1}.png`}
                  />
                </div>

                <h4
                  className="text-lg mb-2"
                  style={{
                    ...SERIF,
                    fontWeight: 600,
                    color: "rgb(var(--color-text))",
                  }}
                >
                  {item.title}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgb(var(--color-text-muted))" }}
                >
                  {item.desc}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          PRECISION / TECH
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Image */}
          <Reveal className="relative mb-6 lg:mb-0" direction="left">
            <div
              className="hidden lg:block absolute -inset-4 rounded-[2rem] -z-10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(var(--color-primary),0.14), rgba(var(--color-primary),0.02))",
              }}
            />
            <div
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 24px 48px -24px rgba(0,0,0,0.25)" }}
            >
              <img
                alt={content.precisionSection.title}
                className="w-full h-auto object-cover"
                src={content.precisionSection.imageUrl}
              />
            </div>

            {/* Floating stat callout */}
            {content.stats[0] && (
              <div
                className="absolute -bottom-5 left-5 sm:-bottom-6 sm:left-8 rounded-2xl px-5 py-4 flex items-center gap-3"
                style={{
                  background: "rgb(var(--color-surface))",
                  border: "1px solid rgb(var(--color-border))",
                  boxShadow: "0 16px 32px -16px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p
                    className="text-lg font-extrabold leading-none"
                    style={{ color: "rgb(var(--color-text))" }}
                  >
                    {content.stats[0].number}
                  </p>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide mt-1"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                  >
                    {content.stats[0].label}
                  </p>
                </div>
              </div>
            )}
          </Reveal>

          {/* Copy */}
          <Reveal
            className="text-center lg:text-left"
            delay={120}
            direction="right"
          >
            <div className="flex justify-center lg:justify-start">
              <Eyebrow>Why Choose Us</Eyebrow>
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl mb-5 tracking-tight leading-[1.1]"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              {content.precisionSection.title}
            </h2>
            <p
              className="text-sm sm:text-base leading-relaxed mb-5 lg:mb-10"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              {content.precisionSection.description}
            </p>

            <ul className="space-y-4 lg:space-y-5 text-left">
              {[
                {
                  title: "K-Beauty Innovation",
                  desc: "Latest medical technologies from Seoul's top aesthetic laboratories.",
                },
                {
                  title: "Certified Experts",
                  desc: "Dermatologists trained in the latest Korean skincare protocols.",
                },
                {
                  title: "Holistic Approach",
                  desc: "Focused on long-term skin health and natural-looking results.",
                },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(var(--color-primary),0.12)" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4"
                      style={{ color: "rgb(var(--color-primary))" }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: "rgb(var(--color-text))" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          BEFORE & AFTER
      ───────────────────────────────────────────────────────────────────── */}
      <BeforeAfterGallery />

      {/* ─────────────────────────────────────────────────────────────────────
          TESTIMONIALS
      ───────────────────────────────────────────────────────────────────── */}
      <section
        className="py-16 lg:py-24 border-b"
        style={{
          background: "rgb(var(--color-surface))",
          borderColor: "rgb(var(--color-border))",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <Reveal className="mb-8 lg:mb-14 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Eyebrow>Testimonials</Eyebrow>
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl mb-3 leading-tight tracking-tight"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              Patient Experiences
            </h2>
            <p
              className="text-sm sm:text-base"
              style={{ color: "rgb(var(--color-text-muted))" }}
            >
              Confidence restored, skin transformed through expert care.
            </p>
          </Reveal>

          <Reveal
            className="min-h-[300px] lg:h-80"
            delay={150}
            direction="scale"
          >
            <Carousel
              autoPlayInterval={8000}
              items={testimonials.map((t, i) => (
                <div key={i} className="h-full px-1 sm:px-2">
                  <div
                    className="h-full rounded-2xl p-5 sm:p-8 lg:p-12 flex flex-col justify-center relative overflow-hidden"
                    style={{
                      background: "rgb(var(--color-bg))",
                      border: "1px solid rgb(var(--color-border))",
                      boxShadow: "0 20px 40px -28px rgba(0,0,0,0.25)",
                    }}
                  >
                    {/* Decorative quote mark */}
                    <span
                      aria-hidden="true"
                      className="absolute top-0 right-4 sm:right-6 text-[100px] sm:text-[140px] leading-none select-none pointer-events-none"
                      style={{
                        ...SERIF,
                        color: "rgba(var(--color-primary),0.06)",
                      }}
                    >
                      "
                    </span>

                    <div className="relative z-10">
                      {/* Stars */}
                      <div className="flex gap-1 mb-6">
                        {Array.from({ length: t.rating }).map((_, s) => (
                          <Star
                            key={s}
                            className="w-4 h-4 fill-amber-400 text-amber-400"
                          />
                        ))}
                      </div>

                      <p
                        className="text-base sm:text-lg lg:text-2xl leading-relaxed mb-5 sm:mb-8"
                        style={{
                          ...SERIF,
                          fontStyle: "italic",
                          fontWeight: 500,
                          color: "rgb(var(--color-text))",
                        }}
                      >
                        "{t.text}"
                      </p>

                      <div className="flex items-center gap-4">
                        <img
                          alt={t.name}
                          className="w-12 h-12 rounded-full object-cover"
                          src={t.image}
                          style={{
                            border: "2px solid rgb(var(--color-primary))",
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p
                              className="text-sm font-bold"
                              style={{ color: "rgb(var(--color-text))" }}
                            >
                              {t.name}
                            </p>
                            <div
                              className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                color: "rgb(var(--color-success))",
                                background: "rgba(var(--color-success),0.1)",
                                border:
                                  "1px solid rgba(var(--color-success),0.25)",
                              }}
                            >
                              <ShieldCheck className="w-2.5 h-2.5" /> Verified
                            </div>
                          </div>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "rgb(var(--color-text-muted))" }}
                          >
                            {t.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          MEET THE TEAM
      ───────────────────────────────────────────────────────────────────── */}
      <MeetTheTeam />

      {/* ─────────────────────────────────────────────────────────────────────
          CONTACT
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Info */}
          <Reveal className="text-center lg:text-left" direction="left">
            <div className="flex justify-center lg:justify-start">
              <Eyebrow>Location &amp; Contact</Eyebrow>
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl mb-8 lg:mb-10 tracking-tight leading-tight"
              style={{
                ...SERIF,
                fontWeight: 600,
                color: "rgb(var(--color-text))",
              }}
            >
              Visit Our Clinic
            </h2>

            <div
              className="rounded-2xl lg:rounded-3xl p-6 lg:p-8 space-y-5 lg:space-y-6 text-left"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
                boxShadow: "0 20px 40px -28px rgba(0,0,0,0.18)",
              }}
            >
              {[
                {
                  icon: <MapPin className="w-4 h-4" />,
                  label: "Address",
                  value: content.contact.location,
                },
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: "Hours",
                  value: content.contact.hours,
                },
                {
                  icon: <Phone className="w-4 h-4" />,
                  label: "Phone",
                  value: content.contact.phone,
                },
                {
                  icon: <Mail className="w-4 h-4" />,
                  label: "Email",
                  value: content.contact.email,
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(var(--color-primary),0.08)",
                      color: "rgb(var(--color-primary))",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold uppercase tracking-wider mb-1"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "rgb(var(--color-text))" }}
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Map placeholder */}
          <Reveal
            className="w-full h-[260px] sm:h-[320px] lg:h-[380px] lg:mt-[68px]"
            delay={120}
            direction="right"
          >
            <div
              className="w-full h-full rounded-2xl lg:rounded-3xl overflow-hidden relative"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
                boxShadow: "0 24px 48px -24px rgba(0,0,0,0.25)",
              }}
            >
              <img
                alt="Clinic"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
                src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    background: BRAND_GRADIENT,
                    boxShadow:
                      "0 12px 24px -8px rgba(var(--color-primary),0.5)",
                  }}
                >
                  <MapPin className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p
                    className="font-bold mb-1"
                    style={{ color: "rgb(var(--color-text))" }}
                  >
                    Clinic Location
                  </p>
                  <p
                    className="text-sm mb-5"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                  >
                    {content.contact.location}
                  </p>
                </div>
                <button
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "rgb(var(--color-primary))" }}
                >
                  <MapPin className="w-4 h-4" /> Get Directions
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          CTA
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-10 lg:py-24">
        <Reveal className="max-w-7xl mx-auto px-5 lg:px-8" direction="scale">
          <div
            className="relative rounded-2xl lg:rounded-[2rem] overflow-hidden"
            style={{ boxShadow: "0 32px 64px -24px rgba(0,0,0,0.35)" }}
          >
            {/* Background */}
            <img
              alt="CTA background"
              className="absolute inset-0 w-full h-full object-cover"
              src="/images/cta_bg.png"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(165deg, rgb(var(--color-primary) / 96%) 0%, rgb(var(--color-primary) / 90%) 45%, rgb(0 0 0 / 80%) 100%)",
              }}
            />

            {/* Content */}
            <div className="relative z-10 px-5 sm:px-8 py-10 sm:py-20 lg:py-24 text-center text-white max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-widest mb-3 sm:mb-5 opacity-75">
                Get Started
              </p>
              <h2
                className="text-3xl sm:text-4xl lg:text-6xl mb-3 sm:mb-6 tracking-tight leading-[1.05]"
                style={{ ...SERIF, fontWeight: 600 }}
              >
                Begin Your Journey to Healthier Skin
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-5 sm:mb-10 leading-relaxed">
                Join thousands of patients who have transformed their skin with
                our evidence-based Korean aesthetic protocols.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "white",
                    color: "rgb(var(--color-primary))",
                    boxShadow: "0 16px 32px -12px rgba(0,0,0,0.35)",
                  }}
                  to={content.hero.ctaLink}
                >
                  Book Consultation <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                  to="/contact"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.1)";
                  }}
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
