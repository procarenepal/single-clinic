import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  Users,
  Calendar,
  ClipboardList,
  Stethoscope,
  Pill,
  Building,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

import { Carousel } from "@/components/ui/Carousel";
import { landingPageService, LandingPageContent } from "@/services/landingPageService";

export default function IndexPage() {
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [loading, setLoading] = useState(true);

  // In a single-clinic system, we use a fixed ID or fetch the primary clinic
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

  const testimonials = [
    {
      name: "Ji-Su Park",
      role: "Patient",
      text: "The glass skin facial here is incredible. My skin has never looked this radiant. The clinicians are so professional and the products they use are clearly premium.",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
    },
    {
      name: "Sarah Jenkins",
      role: "Patient",
      text: "I was struggling with pigmentation for years. After just three sessions of their laser therapy, I see a massive difference. Highly recommend this clinic!",
      image: "https://images.unsplash.com/photo-1554151228-14d9def656e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
    }
  ];

  if (loading || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-bg))]">
        <div className="w-8 h-8 border-4 border-[rgb(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] selection:bg-[rgb(var(--color-primary)/0.2)] selection:text-[rgb(var(--color-primary))]">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-[rgb(var(--color-bg))]">
        {/* Subtle Background Tints */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[rgb(var(--color-primary)/0.02)] rounded-bl-[100px]" />
          <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-[rgb(var(--color-primary)/0.01)] rounded-tr-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 text-center lg:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-primary))]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                Seoul's Aesthetic Excellence
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-6 text-[rgb(var(--color-text))] leading-[1.2] tracking-tight">
              {content.hero.title.split(' ').slice(0, -1).join(' ')} <span className="text-[rgb(var(--color-primary))]">{content.hero.title.split(' ').pop()}</span>
            </h1>

            <p className="mb-8 text-base lg:text-lg text-[rgb(var(--color-text-muted))] leading-relaxed max-w-xl mx-auto lg:mx-0">
              {content.hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Link
                className="inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all bg-[rgb(var(--color-primary))] rounded-xl hover:bg-[rgb(var(--color-primary-hover))] shadow-lg shadow-[rgb(var(--color-primary)/0.2)] hover:shadow-[rgb(var(--color-primary)/0.4)] hover:-translate-y-1 active:translate-y-0"
                to={content.hero.ctaLink}
              >
                {content.hero.ctaText}
              </Link>
              <Link
                className="inline-flex items-center justify-center px-8 py-4 font-bold text-[rgb(var(--color-text))] transition-all bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl hover:bg-[rgb(var(--color-surface-2))] hover:-translate-y-1 active:translate-y-0"
                to="/features"
              >
                Our Procedures
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-[rgb(var(--color-bg))] overflow-hidden bg-[rgb(var(--color-surface-2))] shadow-sm transition-transform hover:scale-110 hover:z-10 duration-300">
                    <img
                      src={`https://i.pravatar.cc/100?u=skin-doc${i}`}
                      alt="Specialist"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="text-left border-l border-[rgb(var(--color-border))] pl-8 py-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-black text-[rgb(var(--color-primary))] tracking-tight">
                    5k+ Glowing Results
                  </p>
                  <div className="w-4 h-4 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center">
                    <ShieldCheck className="w-2.5 h-2.5" />
                  </div>
                </div>
                <p className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">Certified Aesthetic Specialists</p>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full relative">
            <div className="relative bg-[rgb(var(--color-surface))] p-2 rounded-2xl border border-[rgb(var(--color-border))] shadow-[0_10px_40px_-10px_rgba(var(--color-primary)/0.15)] overflow-hidden">
              <div className="h-[400px] lg:h-[500px]">
                <Carousel
                  autoPlayInterval={5000}
                  items={[
                    <div className="w-full h-full relative group">
                      <img src="/images/banner_1.png" alt="Glass Skin" className="w-full h-full object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Natural Glow</p>
                        <p className="text-lg font-bold">The Signature Glass Skin</p>
                      </div>
                    </div>,
                    <div className="w-full h-full relative group">
                      <img src="/images/banner_2.png" alt="Advanced Tech" className="w-full h-full object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Medical Grade</p>
                        <p className="text-lg font-bold">Advanced K-Laser Therapy</p>
                      </div>
                    </div>,
                    <div className="w-full h-full relative group">
                      <img src="/images/banner_3.png" alt="Clinic Interior" className="w-full h-full object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      <div className="absolute bottom-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Serene Wellness</p>
                        <p className="text-lg font-bold">Premium Aesthetic Sanctuary</p>
                      </div>
                    </div>
                  ]}
                />
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-[rgb(var(--color-surface))] px-5 py-4 pr-8 rounded-xl border border-[rgb(var(--color-border))] shadow-md hidden lg:block z-20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[rgb(var(--color-primary)/0.1)] flex items-center justify-center text-[rgb(var(--color-primary))]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase">Next Available</p>
                    <p className="text-sm font-bold text-[rgb(var(--color-text))]">Consult Today</p>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators / Stats */}
      <div className="max-w-7xl mx-auto px-4 relative z-20 -mt-10 lg:-mt-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl shadow-sm overflow-hidden divide-x divide-y lg:divide-y-0 divide-[rgb(var(--color-border))]">
          {content.stats.map((stat, index) => {
            const IconComponent = stat.icon === "Users" ? Users :
              stat.icon === "ClipboardList" ? ClipboardList :
                stat.icon === "Building2" ? Building2 :
                  Stethoscope;
            
            const statImages = [
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Happy Clients
              "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Years Expertise
              "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // K-Certified Products
              "https://images.unsplash.com/photo-1516533075015-a3838414c3ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"  // Patient Rating
            ];

            return (
              <div
                key={index}
                className="group relative flex items-center gap-4 p-6 lg:p-8 justify-center hover:bg-[rgb(var(--color-surface-2))] transition-all duration-300 overflow-hidden"
              >
                {/* Individual Background Image */}
                <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none">
                  <img src={statImages[index]} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 bg-white/60 z-[1] pointer-events-none" />

                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white backdrop-blur-sm text-[rgb(var(--color-primary))] flex items-center justify-center border border-[rgb(var(--color-border))] shadow-sm">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl lg:text-2xl font-bold text-[rgb(var(--color-primary))] tabular-nums">
                      {stat.number}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-tight text-[rgb(var(--color-text-muted))]">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="py-24 px-4 bg-[rgb(var(--color-bg))] relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-[rgb(var(--color-primary)/0.02)] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-[rgb(var(--color-primary)/0.03)] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-primary))] text-[10px] font-bold uppercase tracking-widest mb-6 border border-[rgb(var(--color-border))]">
              <Sparkles className="w-3 h-3" />
              Professional Portfolio
            </div>
            <h2 className="text-3xl lg:text-5xl font-black text-[rgb(var(--color-primary))] mb-6 tracking-tight leading-tight">
              Medical Aesthetic Services
            </h2>
            <p className="text-base lg:text-lg text-[rgb(var(--color-text-muted))] leading-relaxed font-medium">
              Precision-engineered protocols fusing high-altitude environmental science 
              with world-leading Korean dermatological innovation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {content.services.map((service, index) => {
              const IconComponent = service.icon === "Users" ? Users :
                service.icon === "Stethoscope" ? Stethoscope :
                  service.icon === "Building" ? Building :
                    service.icon === "ClipboardList" ? ClipboardList :
                      service.icon === "Calendar" ? Calendar :
                        MapPin;

              return (
                <div
                  key={index}
                  className="group relative flex flex-col bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-[rgb(var(--color-primary)/0.08)] transition-all duration-500 hover:-translate-y-2"
                >
                  {/* Service Image Container */}
                  <div className="aspect-[16/11] w-full overflow-hidden relative">
                    <img
                      src={`/images/service_${index + 1}.png`}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--color-surface))] via-transparent to-transparent opacity-60" />
                    
                    {/* Floating Icon Badge */}
                    <div className="absolute -bottom-6 left-8 w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-[rgb(var(--color-border))] shadow-xl group-hover:rotate-6 transition-transform duration-500 z-10">
                      <div className="w-10 h-10 rounded-xl bg-[rgb(var(--color-primary)/0.05)] flex items-center justify-center text-[rgb(var(--color-primary))]">
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-8 pt-12 flex flex-col flex-1">
                    <h3 className="text-xl font-extrabold text-[rgb(var(--color-primary))] mb-4 tracking-tight">
                      {service.title}
                    </h3>
                    <p className="text-[rgb(var(--color-text-muted))] leading-relaxed text-base mb-8 font-medium flex-1">
                      {service.description}
                    </p>

                    <div className="pt-6 border-t border-[rgb(var(--color-border))] flex items-center justify-between">
                      <Link 
                        to="/features" 
                        className="text-[11px] font-black uppercase tracking-widest text-[rgb(var(--color-primary))] flex items-center gap-2 group/link"
                      >
                        Explore Treatment
                        <ArrowRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1" />
                      </Link>
                      <span className="text-[9px] font-black text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-40">
                        K-Certified
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Promotional Ads Banner */}
      <section className="py-12 px-4 max-w-7xl mx-auto">
        <div className="relative h-[300px] lg:h-[400px] rounded-2xl overflow-hidden shadow-sm border border-[rgb(var(--color-border))] group">
          <img
            src="/images/promo_banner.png"
            alt="Glass Skin Promotion"
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />

          <div className="absolute inset-0 flex items-center p-8 lg:p-20">
            <div className="max-w-md text-white">
              <div className="inline-block px-4 py-1.5 bg-[rgb(var(--color-primary))] text-white text-[10px] font-bold uppercase tracking-widest rounded mb-6 shadow-lg shadow-[rgb(var(--color-primary)/0.2)]">
                Exclusive Treatment Offer
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight leading-tight">
                Signature <span className="text-[rgb(var(--color-primary-light))]">Glass Skin</span> Protocol
              </h2>
              <p className="text-white/80 text-sm lg:text-lg mb-10 font-medium leading-relaxed">
                Unlock your natural radiance with our medical-grade facial series.
                <span className="block mt-2 text-white font-bold">First-time clients: Save 20% this month.</span>
              </p>
              <Link
                className="inline-flex items-center justify-center px-10 py-4 bg-white text-[rgb(var(--color-text))] font-bold text-[10px] uppercase tracking-widest rounded-md hover:bg-[rgb(var(--color-surface-2))] transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
                to="/contact"
              >
                Claim Your Offer <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[rgb(var(--color-surface-2))] border-y border-[rgb(var(--color-border))]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-2xl lg:text-3xl font-bold text-[rgb(var(--color-primary))] mb-2 tracking-tight">Your Glow Journey</h2>
            <p className="text-base text-[rgb(var(--color-text-muted))]">Experience the clinical standard of Seoul's skincare excellence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {content.process.map((item, i) => (
              <div key={i} className="bg-[rgb(var(--color-surface))] rounded-xl border border-[rgb(var(--color-border))] overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="aspect-[16/10] w-full overflow-hidden relative">
                  <img
                    src={`/images/step_${i + 1}.png`}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[rgb(var(--color-primary))] text-white flex items-center justify-center font-bold text-sm shadow-lg">
                    {item.step}
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="text-lg font-bold text-[rgb(var(--color-primary))] mb-3 tracking-tight">{item.title}</h4>
                  <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contextual & Tech Section */}
      <section className="py-24 bg-[rgb(var(--color-surface))] border-y border-[rgb(var(--color-border))] overflow-hidden transition-colors">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-[rgb(var(--color-surface-2))] rounded-xl transform -rotate-2 group-hover:-rotate-3 transition-transform duration-500 border border-[rgb(var(--color-border))]" />
            <div className="p-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl relative z-10 transition-transform duration-500 group-hover:translate-y-1">
              <div className="rounded-lg border border-[rgb(var(--color-border)/0.5)] overflow-hidden bg-[rgb(var(--color-surface-2))]">
                <img
                  alt={content.precisionSection.title}
                  className="w-full h-auto object-cover"
                  src={content.precisionSection.imageUrl}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="inline-block px-3 py-1 bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] text-[rgb(var(--color-primary))] text-xs font-bold uppercase tracking-widest rounded mb-6">
              Aesthetic Precision
            </div>
            <h2 className="text-3xl font-bold text-[rgb(var(--color-primary))] mb-6 tracking-tight">
              {content.precisionSection.title}
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed">
              {content.precisionSection.description}
            </p>

            <div className="space-y-6">
              {[
                {
                  title: "K-Beauty Innovation",
                  desc: "Latest medical technologies from Seoul's top aesthetic labs.",
                },
                {
                  title: "Certified Experts",
                  desc: "Dermatologists trained in the latest Korean skincare protocols.",
                },
                {
                  title: "Holistic Approach",
                  desc: "We focus on long-term skin health and natural-looking results.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] flex items-center justify-center mt-1">
                    <ShieldCheck className="w-3 h-3 text-[rgb(var(--color-primary))]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[rgb(var(--color-text))] mb-1 tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-sm text-[rgb(var(--color-text-muted))]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-[rgb(var(--color-surface-2)/0.3)] border-y border-[rgb(var(--color-border))] relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[rgb(var(--color-primary)/0.03)] rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[rgb(var(--color-primary)/0.03)] rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

        <div className="text-center mb-16 max-w-2xl mx-auto px-4 relative z-10">
          <div className="inline-block px-3 py-1 rounded-full bg-[rgb(var(--color-primary)/0.05)] text-[rgb(var(--color-primary))] text-[10px] font-bold uppercase tracking-wider mb-4 border border-[rgb(var(--color-primary)/0.1)]">
            Results That Speak
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-[rgb(var(--color-primary))] mb-2 tracking-tight">
            Client Success Stories
          </h2>
          <p className="text-base text-[rgb(var(--color-text-muted))]">
            Confidence restored, skin transformed through expert care.
          </p>
        </div>

        <div className="max-w-5xl mx-auto px-4 h-80 relative z-10">
          <Carousel
            autoPlayInterval={8000}
            items={testimonials.map((t, i) => (
              <div key={i} className="h-full px-4">
                <div className="h-full p-10 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-[0_4px_20px_-4px_rgba(var(--color-primary)/0.05)] flex flex-col justify-center items-center text-center relative overflow-hidden group">
                  {/* Quote Icon */}
                  <div className="absolute top-6 left-10 text-[rgb(var(--color-primary)/0.1)] group-hover:text-[rgb(var(--color-primary)/0.2)] transition-colors duration-500">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C15.4647 8 15.017 8.44772 15.017 9V12C15.017 12.5523 14.5693 13 14.017 13H12.017V9C12.017 6.79086 13.8079 5 16.017 5H19.017C21.2261 5 23.017 6.79086 23.017 9V15C23.017 18.3137 20.3307 21 17.017 21H14.017ZM2.01697 21L2.01697 18C2.01697 16.8954 2.9124 16 4.01697 16H7.01697C7.56925 16 8.01697 15.5523 8.01697 15V9C8.01697 8.44772 7.56925 8 7.01697 8H4.01697C3.46469 8 3.01697 8.44772 3.01697 9V12C3.01697 12.5523 2.56925 13 2.01697 13H0.0169678V9C0.0169678 6.79086 1.80783 5 4.01697 5H7.01697C9.22611 5 11.017 6.79086 11.017 9V15C11.017 18.3137 8.33068 21 5.01697 21H2.01697Z" />
                    </svg>
                  </div>

                  <div className="w-20 h-20 rounded-full overflow-hidden mb-6 border-2 border-[rgb(var(--color-primary)/0.1)] p-1 bg-white">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover rounded-full" />
                  </div>

                  <p className="text-lg lg:text-xl font-medium text-[rgb(var(--color-text))] mb-8 leading-relaxed max-w-2xl">
                    "{t.text}"
                  </p>

                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[rgb(var(--color-text))] uppercase tracking-widest text-xs">{t.name}</h4>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[8px] font-bold uppercase tracking-tighter border border-green-100">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Verified
                      </div>
                    </div>
                    <p className="text-[10px] text-[rgb(var(--color-primary))] font-bold uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          />
        </div>
      </section>

      {/* Contact & Location Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto border-t border-[rgb(var(--color-border))]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[rgb(var(--color-primary))] mb-8 tracking-tight">
              Visit Our Aesthetic Clinic
            </h2>

            <div className="space-y-6">
              {[
                { icon: <MapPin className="w-5 h-5" />, title: "Clinic Location", content: content.contact.location },
                { icon: <Building2 className="w-5 h-5" />, title: "Opening Hours", content: content.contact.hours },
                { icon: <Stethoscope className="w-5 h-5" />, title: "Concierge Desk", content: `Phone: ${content.contact.phone} • ${content.contact.email}` },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0 text-[rgb(var(--color-primary))]">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">{item.title}</h4>
                    <p className="text-sm text-[rgb(var(--color-text-muted))]">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full h-[400px] bg-[rgb(var(--color-surface))] rounded-2xl border border-[rgb(var(--color-border))] overflow-hidden relative shadow-sm flex flex-col group">
            {/* Background Image Layer */}
            <div className="absolute inset-0">
              <img 
                src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Clinic Interior" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] group-hover:bg-white/70 transition-colors duration-500" />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center text-center p-8 z-10">
              <div className="w-14 h-14 bg-[rgb(var(--color-primary))] rounded-xl shadow-lg flex items-center justify-center mb-6">
                <MapPin className="w-7 h-7 text-white" />
              </div>

              <h3 className="font-bold text-lg text-[rgb(var(--color-text))] mb-2">Location Map</h3>
              <p className="text-xs text-[rgb(var(--color-text-muted))] max-w-xs mx-auto mb-6">
                {content.contact.location}
              </p>

              <button className="px-6 py-2 bg-[rgb(var(--color-primary))] text-white rounded-md font-bold text-[10px] uppercase tracking-wider hover:bg-[rgb(var(--color-primary)/0.9)] transition-colors shadow-sm">
                Get Directions
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Layer */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto rounded-3xl relative overflow-hidden h-[400px] lg:h-[500px] flex items-center justify-center group">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/cta_bg.png"
              alt="Glowing Skin Background"
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--color-primary)/0.9)] to-[rgb(var(--color-primary)/0.6)] mix-blend-multiply" />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          {/* Decorative Glow Bubbles */}
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />

          {/* Glass Content */}
          <div className="relative z-10 text-center text-white px-8 py-12 lg:py-20 backdrop-blur-[2px] bg-white/5 border border-white/10 rounded-2xl max-w-3xl mx-4">
            <div className="inline-block px-3 py-1 bg-white/20 border border-white/30 text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
              Start Your Journey
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight leading-tight">
              Begin your journey to <span className="text-[rgb(var(--color-surface))] underline decoration-white/30 underline-offset-8">glowing skin.</span>
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
              Join thousands of clients who have achieved their skin goals with our signature Korean aesthetic protocols.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                className="px-8 py-4 bg-white text-[rgb(var(--color-primary))] font-bold text-xs uppercase tracking-widest rounded-md hover:bg-[rgb(var(--color-surface-2))] transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                to={content.hero.ctaLink}
              >
                Book Consultation
              </Link>
              <Link
                className="px-8 py-4 bg-[rgb(var(--color-primary))] text-white border border-white/20 font-bold text-xs uppercase tracking-widest rounded-md hover:bg-[rgb(var(--color-primary)/0.9)] transition-all backdrop-blur-sm shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                to="/contact"
              >
                Inquire Services
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
