import { useState, useEffect } from "react";
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
} from "lucide-react";

import { Carousel } from "@/components/ui/Carousel";
import {
  landingPageService,
  LandingPageContent,
} from "@/services/landingPageService";
import { clinicService } from "@/services/clinicService";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import MeetTheTeam from "@/components/MeetTheTeam";


export default function IndexPage() {
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicAddress, setClinicAddress] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const fetchClinicAddress = async () => {
      try {
        const all = await clinicService.getAllClinics();
        if (cancelled || all.length === 0) return;
        const clinic = all[0];
        const parts = [clinic.address, clinic.city, clinic.state, clinic.country].filter(Boolean);
        if (parts.length > 0) setClinicAddress(parts.join(", "));
      } catch {
        /* silently fall back to landing page content */
      }
    };
    fetchClinicAddress();
    return () => { cancelled = true; };
  }, []);

  const testimonials = [
    {
      name: "Ji-Su Park",
      role: "Patient",
      text: "The glass skin facial here is incredible. My skin has never looked this radiant. The clinicians are so professional and the products they use are clearly premium.",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
      rating: 5,
    },
    {
      name: "Sarah Jenkins",
      role: "Patient",
      text: "I was struggling with pigmentation for years. After just three sessions of their laser therapy, I see a massive difference. Highly recommend this clinic!",
      image: "https://images.unsplash.com/photo-1554151228-14d9def656e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
      rating: 5,
    },
  ];

  if (loading || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-bg))" }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent" style={{ borderColor: "rgb(var(--color-primary))", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const resolveIcon = (name: string) =>
    name === "Users" ? Users
      : name === "ClipboardList" ? ClipboardList
        : name === "Building2" ? Building2
          : name === "Stethoscope" ? Stethoscope
            : name === "Building" ? Building
              : name === "Calendar" ? Calendar
                : MapPin;

  return (
    <div className="min-h-screen" style={{ background: "rgb(var(--color-bg))", color: "rgb(var(--color-text))" }}>

      {/* ─────────────────────────────────────────────────────────────────────
          HERO
      ───────────────────────────────────────────────────────────────────── */}
      <section className="border-b" style={{ borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12 lg:py-28 flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Copy */}
          <div className="flex-1 max-w-xl text-center lg:text-left">
            {/* Eyebrow */}
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--color-primary))" }}>
              Advanced Aesthetic Medicine
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 leading-tight tracking-tight" style={{ color: "rgb(var(--color-text))" }}>
              {content.hero.title}
            </h1>

            <p className="text-base lg:text-lg leading-relaxed mb-8" style={{ color: "rgb(var(--color-text-muted))" }}>
              {content.hero.subtitle}
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8 lg:mb-12 items-center lg:items-start">
              <Link
                to={content.hero.ctaLink}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-lg transition-opacity duration-150 hover:opacity-90"
                style={{ background: "rgb(var(--color-primary))" }}
              >
                {content.hero.ctaText}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold rounded-lg border transition-colors duration-150"
                style={{ color: "rgb(var(--color-text))", borderColor: "rgb(var(--color-border))", background: "rgb(var(--color-surface))" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgb(var(--color-surface-2))"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgb(var(--color-surface))"; }}
              >
                View Services
              </Link>
            </div>

            {/* Trust row */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-6 lg:pt-8 border-t" style={{ borderColor: "rgb(var(--color-border))" }}>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    alt="Patient"
                    className="w-9 h-9 rounded-full border-2 object-cover"
                    src={`https://i.pravatar.cc/100?u=skin-doc${i}`}
                    style={{ borderColor: "rgb(var(--color-bg))" }}
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-sm font-bold ml-1">4.9</span>
                </div>
                <p className="text-xs" style={{ color: "rgb(var(--color-text-muted))" }}>
                  Trusted by 5,000+ patients
                </p>
              </div>
            </div>
          </div>

          {/* Carousel */}
          <div className="flex-1 w-full max-w-2xl">
            <div
              className="rounded-2xl overflow-hidden border"
              style={{ borderColor: "rgb(var(--color-border))", background: "rgb(var(--color-surface))" }}
            >
              <div className="h-[260px] sm:h-[340px] lg:h-[500px]">
                <Carousel
                  autoPlayInterval={5000}
                  items={[
                    <div key="1" className="relative w-full h-full group">
                      <img alt="Glass Skin" className="w-full h-full object-cover" src="/images/banner_1.png" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">Natural Glow</p>
                        <p className="text-lg font-bold">The Signature Glass Skin</p>
                      </div>
                    </div>,
                    <div key="2" className="relative w-full h-full group">
                      <img alt="Advanced Tech" className="w-full h-full object-cover" src="/images/banner_2.png" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">Medical Grade</p>
                        <p className="text-lg font-bold">Advanced K-Laser Therapy</p>
                      </div>
                    </div>,
                    <div key="3" className="relative w-full h-full group">
                      <img alt="Clinic Interior" className="w-full h-full object-cover" src="/images/banner_3.png" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">Serene Wellness</p>
                        <p className="text-lg font-bold">Premium Aesthetic Sanctuary</p>
                      </div>
                    </div>,
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          STATS
      ───────────────────────────────────────────────────────────────────── */}
      <section className="border-b" style={{ background: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[rgb(var(--color-border))]">
            {content.stats.map((stat, index) => {
              const IconComponent = resolveIcon(stat.icon);
              return (
                <div key={index} className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-7 lg:py-10">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(var(--color-primary),0.08)" }}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: "rgb(var(--color-primary))" }} />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "rgb(var(--color-text))" }}>
                      {stat.number}
                    </p>
                    <p className="text-[11px] sm:text-xs font-medium mt-0.5 leading-snug" style={{ color: "rgb(var(--color-text-muted))" }}>
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SERVICES
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          {/* Header */}
          <div className="mb-10 lg:mb-16 text-center lg:text-left max-w-2xl lg:max-w-2xl mx-auto lg:mx-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--color-primary))" }}>
              Our Services
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4" style={{ color: "rgb(var(--color-text))" }}>
              Medical Aesthetic Services
            </h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: "rgb(var(--color-text-muted))" }}>
              Precision-engineered protocols fusing advanced dermatological science with Korean aesthetic innovation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.services.map((service, index) => {
              const IconComponent = resolveIcon(service.icon);
              return (
                <div
                  key={index}
                  className="group flex flex-col rounded-xl border overflow-hidden transition-shadow duration-200 hover:shadow-lg"
                  style={{ background: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border))" }}
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
                  <div className="p-7 flex flex-col flex-1">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                      style={{ background: "rgba(var(--color-primary),0.08)" }}
                    >
                      <IconComponent className="w-5 h-5" style={{ color: "rgb(var(--color-primary))" }} />
                    </div>

                    <h3 className="text-lg font-bold mb-3 tracking-tight" style={{ color: "rgb(var(--color-text))" }}>
                      {service.title}
                    </h3>
                    <p className="text-sm leading-relaxed flex-1" style={{ color: "rgb(var(--color-text-muted))" }}>
                      {service.description}
                    </p>

                    <div className="mt-6 pt-5 border-t" style={{ borderColor: "rgb(var(--color-border))" }}>
                      <Link
                        to="/features"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-75"
                        style={{ color: "rgb(var(--color-primary))" }}
                      >
                        Learn more <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          PROMO BANNER
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-4 px-5 lg:px-8 max-w-7xl mx-auto mb-6 lg:mb-10">
        <div
          className="relative h-[220px] sm:h-[280px] lg:h-[360px] rounded-2xl overflow-hidden border"
          style={{ borderColor: "rgb(var(--color-border))" }}
        >
          <img
            alt="Promotion"
            className="absolute inset-0 w-full h-full object-cover"
            src="/images/promo_banner.png"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />

          <div className="absolute inset-0 flex items-center px-7 sm:px-10 lg:px-16">
            <div className="max-w-xs sm:max-w-sm text-white">
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded mb-3 sm:mb-5"
                style={{ background: "rgb(var(--color-primary))" }}
              >
                Limited Offer
              </span>
              <h2 className="text-lg sm:text-2xl lg:text-4xl font-bold mb-2 sm:mb-4 leading-tight">
                Signature Glass Skin Protocol
              </h2>
              <p className="text-xs sm:text-sm text-white/80 mb-4 sm:mb-7 leading-relaxed hidden sm:block">
                First-time clients save 20% this month on our medical-grade facial series.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "white", color: "rgb(var(--color-text))" }}
              >
                Claim Offer <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          HOW IT WORKS
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24 border-t border-b" style={{ background: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="mb-10 lg:mb-14 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--color-primary))" }}>
              Process
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4" style={{ color: "rgb(var(--color-text))" }}>
              Your Treatment Journey
            </h2>
            <p className="text-sm sm:text-base" style={{ color: "rgb(var(--color-text-muted))" }}>
              A structured, evidence-based approach to skin health and aesthetic excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {content.process.map((item, i) => (
              <div key={i} className="flex flex-col">
                {/* Step indicator */}
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: "rgb(var(--color-primary))" }}
                  >
                    {item.step}
                  </div>
                  {i < content.process.length - 1 && (
                    <div className="hidden md:block flex-1 h-px" style={{ background: "rgb(var(--color-border))" }} />
                  )}
                </div>

                {/* Image */}
                <div className="aspect-[16/10] rounded-xl overflow-hidden mb-6 border" style={{ borderColor: "rgb(var(--color-border))" }}>
                  <img
                    alt={item.title}
                    className="w-full h-full object-cover"
                    src={`/images/step_${i + 1}.png`}
                  />
                </div>

                <h4 className="text-base font-bold mb-2" style={{ color: "rgb(var(--color-text))" }}>
                  {item.title}
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--color-text-muted))" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          PRECISION / TECH
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24 border-b" style={{ borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Image */}
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgb(var(--color-border))" }}>
            <img
              alt={content.precisionSection.title}
              className="w-full h-auto object-cover"
              src={content.precisionSection.imageUrl}
            />
          </div>

          {/* Copy */}
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-4 lg:mb-5" style={{ color: "rgb(var(--color-primary))" }}>
              Why Choose Us
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 lg:mb-5 tracking-tight leading-tight" style={{ color: "rgb(var(--color-text))" }}>
              {content.precisionSection.title}
            </h2>
            <p className="text-sm sm:text-base leading-relaxed mb-7 lg:mb-10" style={{ color: "rgb(var(--color-text-muted))" }}>
              {content.precisionSection.description}
            </p>

            <ul className="space-y-4 lg:space-y-5 text-left">
              {[
                { title: "K-Beauty Innovation", desc: "Latest medical technologies from Seoul's top aesthetic laboratories." },
                { title: "Certified Experts", desc: "Dermatologists trained in the latest Korean skincare protocols." },
                { title: "Holistic Approach", desc: "Focused on long-term skin health and natural-looking results." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "rgb(var(--color-primary))" }} />
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: "rgb(var(--color-text))" }}>{item.title}</p>
                    <p className="text-sm" style={{ color: "rgb(var(--color-text-muted))" }}>{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          BEFORE & AFTER
      ───────────────────────────────────────────────────────────────────── */}
      <BeforeAfterGallery />

      {/* ─────────────────────────────────────────────────────────────────────
          TESTIMONIALS
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24 border-b" style={{ background: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="mb-8 lg:mb-14 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--color-primary))" }}>
              Testimonials
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3" style={{ color: "rgb(var(--color-text))" }}>
              Patient Experiences
            </h2>
            <p className="text-sm sm:text-base" style={{ color: "rgb(var(--color-text-muted))" }}>
              Confidence restored, skin transformed through expert care.
            </p>
          </div>

          <div className="min-h-[280px] lg:h-72">
            <Carousel
              autoPlayInterval={8000}
              items={testimonials.map((t, i) => (
                <div key={i} className="h-full px-1 sm:px-2">
                  <div
                    className="h-full rounded-2xl border p-5 sm:p-8 lg:p-12 flex flex-col justify-center"
                    style={{ background: "rgb(var(--color-bg))", borderColor: "rgb(var(--color-border))" }}
                  >
                    {/* Stars */}
                    <div className="flex gap-1 mb-6">
                      {Array.from({ length: t.rating }).map((_, s) => (
                        <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <p className="text-sm sm:text-base lg:text-xl font-medium leading-relaxed mb-5 sm:mb-8" style={{ color: "rgb(var(--color-text))" }}>
                      "{t.text}"
                    </p>

                    <div className="flex items-center gap-4">
                      <img
                        alt={t.name}
                        className="w-12 h-12 rounded-full object-cover border"
                        src={t.image}
                        style={{ borderColor: "rgb(var(--color-border))" }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: "rgb(var(--color-text))" }}>{t.name}</p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-2.5 h-2.5" /> Verified
                          </div>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "rgb(var(--color-text-muted))" }}>{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          MEET THE TEAM
      ───────────────────────────────────────────────────────────────────── */}
      <MeetTheTeam />

      {/* ─────────────────────────────────────────────────────────────────────
          CONTACT
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24 border-b" style={{ borderColor: "rgb(var(--color-border))" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Info */}
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-4 lg:mb-5" style={{ color: "rgb(var(--color-primary))" }}>
              Location & Contact
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-7 lg:mb-10 tracking-tight" style={{ color: "rgb(var(--color-text))" }}>
              Visit Our Clinic
            </h2>

            <div className="space-y-5 lg:space-y-6 text-left">
              {[
                { icon: <MapPin className="w-4 h-4" />, label: "Address", value: clinicAddress ?? content.contact.location },
                { icon: <Clock className="w-4 h-4" />, label: "Hours", value: content.contact.hours },
                { icon: <Phone className="w-4 h-4" />, label: "Phone", value: content.contact.phone },
                { icon: <Mail className="w-4 h-4" />, label: "Email", value: content.contact.email },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(var(--color-primary),0.08)", color: "rgb(var(--color-primary))" }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgb(var(--color-text-muted))" }}>
                      {item.label}
                    </p>
                    <p className="text-sm font-medium" style={{ color: "rgb(var(--color-text))" }}>
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map placeholder */}
          <div
            className="w-full h-[260px] sm:h-[320px] lg:h-[380px] rounded-2xl overflow-hidden border relative"
            style={{ background: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border))" }}
          >
            <img
              alt="Clinic"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "rgb(var(--color-primary))" }}
              >
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-bold mb-1" style={{ color: "rgb(var(--color-text))" }}>Clinic Location</p>
                <p className="text-sm mb-5" style={{ color: "rgb(var(--color-text-muted))" }}>{clinicAddress ?? content.contact.location}</p>
              </div>
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "rgb(var(--color-primary))" }}
              >
                <MapPin className="w-4 h-4" /> Get Directions
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          CTA
      ───────────────────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div
            className="relative rounded-2xl overflow-hidden border"
            style={{ borderColor: "rgb(var(--color-border))" }}
          >
            {/* Background */}
            <img
              alt="CTA background"
              className="absolute inset-0 w-full h-full object-cover"
              src="/images/cta_bg.png"
            />
            <div
              className="absolute inset-0"
              style={{ background: "rgba(var(--color-primary),0.88)" }}
            />

            {/* Content */}
            <div className="relative z-10 px-5 sm:px-8 py-14 sm:py-20 lg:py-24 text-center text-white max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-widest mb-4 sm:mb-5 opacity-75">
                Get Started
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold mb-4 sm:mb-6 tracking-tight leading-tight">
                Begin Your Journey to Healthier Skin
              </h2>
              <p className="text-sm sm:text-base text-white/75 mb-7 sm:mb-10 leading-relaxed">
                Join thousands of patients who have transformed their skin with our evidence-based Korean aesthetic protocols.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={content.hero.ctaLink}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: "white", color: "rgb(var(--color-primary))" }}
                >
                  Book Consultation <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg text-sm font-semibold border border-white/30 text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
