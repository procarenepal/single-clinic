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
} from "lucide-react";

import { Carousel } from "@/components/ui/Carousel";

export default function IndexPage() {
  const testimonials = [
    <div className="p-8 text-center bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md clarity-card h-full flex flex-col justify-center items-center transition-colors">
      <div className="w-16 h-16 bg-[rgb(var(--color-surface-2))] rounded-full mb-4 flex items-center justify-center border border-[rgb(var(--color-border))] text-xl overflow-hidden">
        <img
          alt="Dr"
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
        />
      </div>
      <p className="text-lg italic text-[rgb(var(--color-text))] mb-6">
        "Procare Software transformed our clinic completely. You'll notice the
        difference on day one - we reduced paperwork by 80% and our patients
        love the digital prescriptions."
      </p>
      <h4 className="font-bold text-[rgb(var(--color-text))]">Dr. Rajesh Shrestha</h4>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Medical Director, Shrestha Medical Center
      </p>
    </div>,
    <div className="p-8 text-center bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md clarity-card h-full flex flex-col justify-center items-center transition-colors">
      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center border border-slate-200 text-xl overflow-hidden">
        <img
          alt="Manager"
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
        />
      </div>
      <p className="text-lg italic text-[rgb(var(--color-text))] mb-6">
        "Your staff will appreciate the appointment system. It revolutionized
        how we manage our schedule. SMS reminders in Nepali work perfectly,
        keeping our patients informed."
      </p>
      <h4 className="font-bold text-[rgb(var(--color-text))]">Sita Gurung</h4>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Practice Manager, Pokhara Valley Hospital
      </p>
    </div>,
  ];

  return (
    <div className="bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] font-sans min-h-screen transition-colors duration-300">
      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 px-4 py-16 lg:py-24 max-w-7xl mx-auto">
        <div className="flex-1 text-center lg:text-left max-w-2xl">
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
            <span className="flex items-center gap-1.5 bg-[rgb(var(--color-primary-light))] text-[rgb(var(--color-primary))] px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase border border-[rgb(var(--color-primary)/0.2)]">
              <MapPin className="w-4 h-4" /> Built for Nepal
            </span>
            <span className="flex items-center gap-1.5 bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase border border-[rgb(var(--color-border))]">
              <Building2 className="w-4 h-4" /> Trusted by 100+ Clinics
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl lg:leading-[1.15] font-bold mb-6 text-[rgb(var(--color-text))] tracking-tight">
            Transform <span className="text-[rgb(var(--color-primary))]">Your Practice</span> With
            Modern Healthcare Technology
          </h1>

          <p className="mb-8 text-lg lg:text-xl text-[rgb(var(--color-text-muted))] leading-relaxed font-medium">
            Your patients deserve a seamless experience. Bring your clinic into
            the future with intelligent digital records, automated appointments,
            and comprehensive pharmacy management. Take absolute control of your
            workflow.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
            <Link
              className="bg-[rgb(var(--color-primary))] text-white font-medium px-8 py-3.5 text-sm hover:opacity-90 transition-colors rounded border border-[rgb(var(--color-primary))] text-center inline-block"
              to="/demo"
            >
              Book Your 1-to-1 Demo
            </Link>
            <Link
              className="bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] font-medium px-8 py-3.5 text-sm hover:bg-[rgb(var(--color-surface-2))] transition-colors rounded border border-[rgb(var(--color-border))] text-center inline-block"
              to="/contact"
            >
              Explore Features
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Gov. Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span>Local Support</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full lg:w-auto relative group">
          <div className="absolute inset-0 bg-[rgb(var(--color-primary-light))] rounded-xl transform rotate-2 group-hover:rotate-3 transition-transform duration-500 border border-[rgb(var(--color-primary)/0.2)]" />
          <div className="clarity-card p-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl relative z-10 transition-transform duration-500 group-hover:-translate-y-1">
            <div className="rounded-lg border border-[rgb(var(--color-border)/0.5)] overflow-hidden bg-[rgb(var(--color-surface-2))]">
              <img
                alt="Doctor using modern dashboard"
                className="w-full h-auto object-cover"
                src="/images/hero_doctor_dashboard.png"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 border-y border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { number: "100+", label: "Active Facilities" },
            { number: "500+", label: "Medical Professionals" },
            { number: "30k+", label: "Patient Records" },
            { number: "99.9%", label: "System Uptime" },
          ].map((stat, index) => (
            <div
              key={index}
              className={`p-4 ${index !== 3 ? "lg:border-r border-[rgb(var(--color-border)/0.5)]" : ""}`}
            >
              <p className="text-3xl font-bold text-[rgb(var(--color-primary))] mb-1">
                {stat.number}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] opacity-80">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-4 tracking-tight">
            Everything You Need to Run Your Practice
          </h2>
          <p className="text-lg text-[rgb(var(--color-text-muted))]">
            From patient registration to complex billing, our platform gives you
            the tools to manage every aspect of your clinic through one clean,
            unified interface.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Patient Management",
              description:
                "Give your patients a smooth registration process. Track complete medical history, billing records, and multi-tab patient profiles with Nepali BS date support.",
              icon: <Users className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Advanced Appointments",
              description:
                "You're in control of your schedule. Define custom appointment types, pricing, and instantly track initial visits, follow-ups, and emergencies.",
              icon: <Calendar className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Digital Records",
              description:
                "Your digital filing cabinet. Securely upload X-rays, manage customizable medical reports, and structure patient notes perfectly.",
              icon: <ClipboardList className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Staff & Doctors",
              description:
                "Empower your team. Manage comprehensive profiles with NMC license tracking, calculate commissions instantly, and maintain strict access control.",
              icon: <Stethoscope className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Pharmacy Control",
              description:
                "Never run out of essential stock. Automate inventory alerts, manage expiry dates, and streamline purchase orders with ease.",
              icon: <Pill className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Multi-Branch Management",
              description:
                "Expand your operations seamlessly. Centralize administration across all your clinic locations while keeping branch-specific data isolated.",
              icon: <Building className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md hover:border-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-surface-2))] transition-colors clarity-card group"
            >
              <div className="w-10 h-10 bg-[rgb(var(--color-surface-2))] rounded flex items-center justify-center text-xl border border-[rgb(var(--color-border))] mb-5 group-hover:bg-[rgb(var(--color-primary-light))] group-hover:border-[rgb(var(--color-primary)/0.3)] transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-3">
                {feature.title}
              </h3>
              <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
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
                  alt="Modern Nepali Healthcare Technology"
                  className="w-full h-auto object-cover"
                  src="/images/nepal_healthcare_tech.png"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="inline-block px-3 py-1 bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] text-[rgb(var(--color-primary))] text-xs font-bold uppercase tracking-widest rounded mb-6">
              Empowering Nepali Healthcare
            </div>
            <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Designed For Your Local Environment
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed">
              We understand the challenges you face in Nepal's healthcare
              landscape. Our system is engineered from the ground up to ensure
              your clinic operates without interruption.
            </p>

            <div className="space-y-6">
              {[
                {
                  title: "Low-Bandwidth Optimized",
                  desc: "Your software works swiftly even on slower networks.",
                },
                {
                  title: "Bilingual Interface",
                  desc: "Switch seamlessly between English and Nepali languages.",
                },
                {
                  title: "Local Integrations",
                  desc: "Integrated with local payment gateways and SMS providers.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] flex items-center justify-center mt-1">
                    <svg
                      className="w-3 h-3 text-[rgb(var(--color-primary))]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">
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
      <section className="py-24 bg-[rgb(var(--color-bg))] transition-colors">
        <div className="text-center mb-12 max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-4 tracking-tight">
            Hear From Your Peers
          </h2>
          <p className="text-[rgb(var(--color-text-muted))]">
            See how other clinics in Nepal are revolutionizing their patient
            care.
          </p>
        </div>
        <div className="max-w-4xl mx-auto px-4 h-64">
          <Carousel autoPlayInterval={6000} items={testimonials} />
        </div>
      </section>

      {/* CTA Layer */}
      <section className="py-20 bg-[rgb(var(--color-primary))] dark:bg-[rgb(var(--color-surface-2))] border-y border-[rgb(var(--color-primary-hover)/0.5)] text-center text-white px-4 transition-colors overflow-hidden relative mesh-gradient">
        <div className="absolute inset-0 opacity-10 pointer-events-none dark:opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-[100px] -mr-48 -mt-48 dark:bg-[rgb(var(--color-primary-light))]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-[100px] -ml-48 -mb-48 dark:bg-[rgb(var(--color-primary-light))]" />
        </div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold mb-6 tracking-tight text-white">
            Ready to elevate your medical practice?
          </h2>
          <p className="text-white/80 text-lg mb-10 leading-relaxed font-medium">
            Join the growing network of providers who have modernized their
            operations. Offer your patients the organized, quick, and secure
            medical care they expect.
          </p>
          <Link
            className="inline-block bg-white text-[rgb(var(--color-primary))] font-bold px-10 py-4 text-sm uppercase tracking-wide rounded hover:bg-white/90 transition-colors border-2 border-transparent focus:outline-none"
            to="/demo"
          >
            Start Your Digital Journey Today
          </Link>
          <p className="mt-8 text-sm text-white/60 font-medium">
            No setup fees • Free training • 24/7 dedicated local support
          </p>
        </div>
      </section>
    </div>
  );
}
