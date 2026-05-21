import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { siteConfig } from "@/config/site";
import { Carousel } from "@/components/ui/Carousel";

export default function AboutPage() {
  const { clinicId } = useAuthContext();
  const [clinicName, setClinicName] = useState<string>(siteConfig.name);

  // Fetch clinic branding
  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;

    clinicService
      .getClinicById(clinicId)
      .then((clinic) => {
        if (cancelled || !clinic) return;
        setClinicName(clinic.name);
      })
      .catch(() => {
        /* silently fall back */
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  return (
    <div className="bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] min-h-screen selection:bg-[rgb(var(--color-primary)/0.2)]">
      {/* Hero Section - Split Layout */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 px-4 overflow-hidden">
        {/* Subtle Background Tints */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[rgb(var(--color-primary)/0.02)] rounded-bl-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 text-center lg:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-primary))]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))]">
                Laser Hospital
              </span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-[rgb(var(--color-text))] leading-[1.2] tracking-tight">
              Empowering Your Glow at{" "}
              <span className="text-[rgb(var(--color-primary))]">
                {clinicName}
              </span>
            </h1>

            <p className="text-base lg:text-lg text-[rgb(var(--color-text-muted))] leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
              Redefining aesthetic standards in Kathmandu through the fusion of
              authentic Korean skincare philosophy and advanced medical
              technology.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-10 lg:gap-16 pt-10 border-t border-[rgb(var(--color-border))]">
              {[
                { value: "2023", label: "Established" },
                { value: "5k+", label: "Journeys" },
                { value: "100%", label: "Authentic" },
              ].map((stat, i) => (
                <div key={i} className="relative group">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[rgb(var(--color-primary)/0.15)] rounded-full group-hover:bg-[rgb(var(--color-primary))] transition-all duration-500" />
                  <div className="flex flex-col">
                    <p className="text-2xl lg:text-3xl font-black text-[rgb(var(--color-primary))] tracking-tighter tabular-nums leading-none mb-2">
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 w-full relative">
            <div className="relative bg-[rgb(var(--color-surface))] p-2 rounded-2xl border border-[rgb(var(--color-border))] shadow-[0_10px_40px_-10px_rgba(var(--color-primary)/0.15)] overflow-hidden">
              <div className="h-[350px] lg:h-[450px]">
                <Carousel
                  autoPlayInterval={5000}
                  items={[
                    <div key="c1" className="w-full h-full relative">
                      <img
                        alt="Clinic Interior"
                        className="w-full h-full object-cover rounded-xl"
                        src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </div>,
                    <div key="c2" className="w-full h-full relative">
                      <img
                        alt="Skincare Technology"
                        className="w-full h-full object-cover rounded-xl"
                        src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </div>,
                    <div key="c3" className="w-full h-full relative">
                      <img
                        alt="Clinical Procedure"
                        className="w-full h-full object-cover rounded-xl"
                        src="https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </div>,
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 border-y border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] relative">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative group order-2 lg:order-1">
            <div className="absolute -inset-4 bg-[rgb(var(--color-primary)/0.05)] rounded-2xl -rotate-2 scale-95 group-hover:rotate-0 group-hover:scale-100 transition-all duration-700" />
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-2xl border border-[rgb(var(--color-border))]">
              <img
                alt="The Science of Glow"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                src="https://images.unsplash.com/photo-1616391182219-e080b4d1043a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
              />
            </div>
          </div>

          <div className="max-w-xl order-1 lg:order-2">
            <div className="inline-block px-3 py-1 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))] mb-6">
              Our Clinical Philosophy
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[rgb(var(--color-primary))] mb-8 tracking-tight">
              The "Glow" Science
            </h2>
            <div className="space-y-6 text-base lg:text-lg text-[rgb(var(--color-text-muted))] leading-relaxed font-medium">
              <p>
                At ProCare, we believe that true beauty stems from biological
                health. Our journey began with a singular vision: to bring the
                legendary "Glass Skin" expertise of Seoul to the heart of
                Kathmandu.
              </p>
              <p>
                We have meticulously curated every treatment, from our signature
                10-step facials to advanced laser therapies, ensuring they meet
                the rigorous standards of K-Beauty certification while
                respecting the unique environmental factors of the Himalayan
                region.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 px-4 bg-[rgb(var(--color-bg))]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-[rgb(var(--color-primary))] mb-6 tracking-tight">
              Clinical Pillars
            </h2>
            <p className="text-base lg:text-lg text-[rgb(var(--color-text-muted))] font-medium max-w-2xl mx-auto">
              Four concrete values defining our patient care and clinical
              execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "K-Beauty Precision",
                description:
                  "Fusing centuries-old Korean skincare wisdom with modern pharmacological breakthroughs for unprecedented results.",
                icon: (
                  <Sparkles className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                ),
                image:
                  "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
              },
              {
                title: "Medical Authority",
                description:
                  "All procedures are supervised by board-certified clinicians using FDA-approved and K-certified medical technologies.",
                icon: (
                  <ShieldCheck className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                ),
                image:
                  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
              },
              {
                title: "Himalayan Adaptation",
                description:
                  "Treatment protocols specifically optimized for the high-altitude and environmental conditions of Kathmandu.",
                icon: (
                  <Activity className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                ),
                image:
                  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
              },
              {
                title: "Bespoke Care",
                description:
                  "Every patient undergoes a 3D digital skin analysis before a customized treatment roadmap is engineered.",
                icon: (
                  <MonitorSmartphone className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                ),
                image:
                  "https://images.unsplash.com/photo-1516533075015-a3838414c3ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
              },
            ].map((approach, index) => (
              <div
                key={index}
                className="group relative flex gap-6 p-8 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl hover:shadow-xl hover:border-[rgb(var(--color-primary)/0.3)] transition-all duration-500 overflow-hidden"
              >
                {/* Background Image Accent */}
                <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
                  <img
                    alt=""
                    className="w-full h-full object-cover grayscale"
                    src={approach.image}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--color-surface))] via-[rgb(var(--color-surface))/0.98] to-[rgb(var(--color-surface))/0.9] z-[1] pointer-events-none" />

                <div className="relative z-10 w-12 h-12 bg-white flex-shrink-0 border border-[rgb(var(--color-border))] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-500">
                  {approach.icon}
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-[rgb(var(--color-primary))] mb-3 tracking-tight">
                    {approach.title}
                  </h3>
                  <p className="text-base text-[rgb(var(--color-text-muted))] font-medium leading-relaxed">
                    {approach.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="py-24 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="max-w-xl">
              <div className="inline-block px-3 py-1 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))] mb-6">
                Our Founder
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-[rgb(var(--color-primary))] mb-8 tracking-tight">
                Visionary Care
              </h2>
              <p className="text-xl text-[rgb(var(--color-text))] font-bold mb-6 leading-relaxed">
                "Our mission is to democratize high-end clinical skincare in
                Nepal, ensuring every patient has access to the world's most
                advanced aesthetic solutions right here in Kathmandu."
              </p>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-[rgb(var(--color-text))]">
                  Sanjeev Baral
                </h3>
                <p className="text-[10px] font-bold text-[rgb(var(--color-primary))] uppercase tracking-widest">
                  Founder & Medical Director
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-[rgb(var(--color-primary))] opacity-[0.03] rounded-full blur-3xl" />
              <div className="relative w-full max-w-md mx-auto aspect-square rounded-2xl overflow-hidden border border-[rgb(var(--color-border))] shadow-2xl">
                <img
                  alt="Sanjeev Baral"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  src="https://procarenepal.com/assets/founder-DS_eS69g.jpeg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal CTA */}
      <section className="py-24 bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg))] px-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl font-bold mb-8 tracking-tight">
            Begin Your Glow Journey
          </h2>
          <p className="text-[rgb(var(--color-bg))] opacity-70 text-lg mb-12 font-medium leading-relaxed max-w-2xl mx-auto">
            Book your comprehensive digital skin analysis and experience the
            standard of authentic Korean clinical care.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              className="bg-[rgb(var(--color-primary))] text-white font-bold px-12 py-5 text-xs uppercase tracking-widest hover:bg-white hover:text-[rgb(var(--color-text))] transition-all duration-500 rounded-xl shadow-lg"
              to="/book"
            >
              Book Appointment
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
