import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Activity,
  Stethoscope,
  HeartPulse,
  MonitorSmartphone,
  Microscope,
  Award,
  Zap,
  FlaskConical,
  Clock,
  MapPin,
  Sun,
} from "lucide-react";

import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function FeaturesPage() {
  const { isDark } = useTheme();

  return (
    <div className="bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] font-sans min-h-screen transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 px-4 overflow-hidden">
        {/* Subtle Background Decoration */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[rgb(var(--color-primary)/0.03)] rounded-bl-[120px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              animate="visible"
              initial="hidden"
              variants={containerVariants}
            >
              <motion.div
                className="inline-flex items-center gap-2 bg-[rgb(var(--color-primary)/0.1)] text-[rgb(var(--color-primary))] px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.2em] border border-[rgb(var(--color-primary)/0.15)] mb-8 shadow-sm"
                variants={itemVariants}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Clinical Portfolio</span>
              </motion.div>

              <motion.h1
                className="text-4xl lg:text-5xl font-bold mb-6 text-[rgb(var(--color-text))] tracking-tight leading-[1.2]"
                variants={itemVariants}
              >
                HSC Laser Hospital <br />{" "}
                <span className="text-[rgb(var(--color-primary))]">
                  Medical Excellence
                </span>
              </motion.h1>

              <motion.p
                className="text-base lg:text-lg text-[rgb(var(--color-text-muted))] mb-8 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed"
                variants={itemVariants}
              >
                Explore our full suite of precision-engineered protocols, fusing
                world-leading K-Beauty innovation with Himalayan environmental
                science.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                variants={itemVariants}
              >
                <Link className="no-underline" to="/login">
                  <Button
                    className="px-10 py-6 text-sm font-bold rounded-xl bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary)/0.9)] text-white border-none shadow-lg shadow-[rgb(var(--color-primary)/0.2)]"
                    size="lg"
                  >
                    Schedule Consultation
                  </Button>
                </Link>
                <Link className="no-underline" to="/contact">
                  <Button
                    className="px-10 py-6 text-sm font-bold rounded-xl border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-2))]"
                    color="default"
                    size="lg"
                    variant="bordered"
                  >
                    View Pricing
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Proper Clinical Hero Image */}
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 w-full relative"
            initial={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative group">
              <div className="absolute -inset-4 bg-[rgb(var(--color-primary)/0.05)] rounded-2xl -rotate-2 scale-95 group-hover:rotate-0 group-hover:scale-100 transition-all duration-700" />
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-[rgb(var(--color-border))]">
                <img
                  alt="HSC Medical Laser Technology"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  src="/images/skincare_hero.png"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-[rgb(var(--color-primary)/0.1)] to-transparent pointer-events-none" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Advanced Laser Section */}
      <section className="py-24 bg-[rgb(var(--color-bg))] relative overflow-hidden px-4 border-y border-[rgb(var(--color-border))]">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[rgb(var(--color-primary)/0.1)] text-[rgb(var(--color-primary))] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-[rgb(var(--color-primary)/0.1)] mb-4 backdrop-blur-sm">
              <Zap className="w-4 h-4" />
              Laser Precision
            </div>
            <h2 className="text-2xl lg:text-4xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Advanced{" "}
              <span className="text-[rgb(var(--color-primary))]">
                K-Laser Technology
              </span>
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              We utilize state-of-the-art Korean laser systems specifically
              calibrated to treat the unique skin profiles of the Himalayan
              region.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Fractional Rejuvenation",
                description:
                  "Non-invasive protocols for deep-tissue collagen stimulation, effectively treating acne scarring and fine lines with minimal downtime.",
                icon: <Activity className="w-6 h-6" />,
              },
              {
                title: "Pigment Eraser",
                description:
                  "High-precision laser bursts targeting sun damage, age spots, and hormonal hyperpigmentation with clinical accuracy.",
                icon: <Sun className="w-6 h-6" />,
              },
              {
                title: "Vascular Clarity",
                description:
                  "Specialized wavelengths to treat redness, spider veins, and rosacea, restoring a uniform and healthy skin tone.",
                icon: <HeartPulse className="w-6 h-6" />,
              },
              {
                title: "Skin Tightening",
                description:
                  "Thermal energy protocols that lift and firm sagging skin, providing a natural-looking non-surgical facelift effect.",
                icon: <ShieldCheck className="w-6 h-6" />,
              },
              {
                title: "Safe for All Tones",
                description:
                  "Our advanced sensors automatically adjust energy levels based on real-time melanin readings for maximum safety.",
                icon: <Microscope className="w-6 h-6" />,
              },
              {
                title: "Rapid Recovery",
                description:
                  "Post-laser cooling and healing protocols imported directly from Seoul's top aesthetic recovery centers.",
                icon: <Clock className="w-6 h-6" />,
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 group hover:border-[rgb(var(--color-primary)/0.5)] transition-all duration-300"
                variants={itemVariants}
              >
                <div className="w-14 h-14 bg-[rgb(var(--color-primary)/0.1)] rounded-xl flex items-center justify-center border border-[rgb(var(--color-primary)/0.1)] mb-6 group-hover:scale-110 group-hover:bg-[rgb(var(--color-primary))] group-hover:text-white transition-all duration-500">
                  <div className="text-[rgb(var(--color-primary))] group-hover:text-white">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-text))] mb-4">
                  {feature.title}
                </h3>
                <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Signature Protocol Section */}
      <section className="py-24 px-4 bg-[rgb(var(--color-surface-2))] relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[rgb(var(--color-primary)/0.1)] text-[rgb(var(--color-primary))] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-[rgb(var(--color-primary)/0.1)] mb-4 backdrop-blur-sm">
              <Award className="w-4 h-4" />
              Signature Protocols
            </div>
            <h2 className="text-2xl lg:text-4xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              The HSC{" "}
              <span className="text-[rgb(var(--color-primary))]">
                Glass Skin Journey
              </span>
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              Experience our legendary 10-step hydration and radiance protocol,
              meticulously adapted for the high-altitude environment of Nepal.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {[
                {
                  title: "Double Cleansing Excellence",
                  description:
                    "Deep pore purification using medical-grade Korean oils and water-based enzymes to prepare the skin's canvas.",
                },
                {
                  title: "Micro-Exfoliation",
                  description:
                    "Gentle removal of dead skin cells and atmospheric pollutants common in Kathmandu's urban environment.",
                },
                {
                  title: "Intense Hydration infusion",
                  description:
                    "Multi-layered hyaluronic acid and ceramide application to combat high-altitude dryness and UV damage.",
                },
                {
                  title: "Clinical Barrier Seal",
                  description:
                    "Final protective layer that locks in nutrients and provides long-lasting dewy radiance for up to 14 days.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl group flex gap-5 p-6 hover:border-[rgb(var(--color-primary)/0.3)] transition-all duration-300"
                  variants={itemVariants}
                >
                  <div className="w-2 h-2 mt-2 rounded-full bg-[rgb(var(--color-primary))] flex-shrink-0 group-hover:scale-150 shadow-[0_0_8px_rgba(var(--color-primary),0.5)] transition-transform" />
                  <div>
                    <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-1 group-hover:text-[rgb(var(--color-primary))] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div className="relative group" variants={itemVariants}>
              <div className="absolute -inset-4 bg-gradient-to-tr from-[rgb(var(--color-primary)/0.1)] to-transparent rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
              <div className="relative p-2 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl overflow-hidden shadow-2xl">
                <img
                  alt="HSC Clinical Facility Interior"
                  className="rounded-lg border border-[rgb(var(--color-border))] w-full h-auto object-cover aspect-[4/3] group-hover:scale-[1.01] transition-transform duration-700"
                  src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Clinical Excellence Pillars */}
      <section className="py-24 bg-[rgb(var(--color-bg))] border-y border-[rgb(var(--color-border))] px-4 relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[rgb(var(--color-primary)/0.1)] text-[rgb(var(--color-primary))] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-[rgb(var(--color-primary)/0.1)] mb-4 backdrop-blur-sm">
              <Stethoscope className="w-4 h-4" />
              Medical Authority
            </div>
            <h2 className="text-2xl lg:text-4xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Clinical{" "}
              <span className="text-[rgb(var(--color-primary))]">
                Excellence Pillars
              </span>
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              Every procedure at HSC Laser Hospital is performed under the
              highest medical oversight to ensure safety, precision, and
              stunning results.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "K-Board Certified",
                description:
                  "Our clinicians undergo continuous training at top aesthetic academies in Seoul, South Korea.",
                icon: <FlaskConical className="w-8 h-8" />,
              },
              {
                title: "FDA Approved Tech",
                description:
                  "We only utilize gold-standard medical technology approved by global and local health authorities.",
                icon: <MonitorSmartphone className="w-8 h-8" />,
              },
              {
                title: "3D Skin Analysis",
                description:
                  "Digital diagnostic mapping of your skin's deep layers before any treatment is initiated.",
                icon: <Microscope className="w-8 h-8" />,
              },
              {
                title: "Post-Care Support",
                description:
                  "Dedicated recovery medical teams available 24/7 for post-treatment monitoring and questions.",
                icon: <ShieldCheck className="w-8 h-8" />,
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 group hover:border-[rgb(var(--color-primary)/0.5)] transition-all duration-300 text-center"
                variants={itemVariants}
              >
                <div className="w-20 h-20 bg-[rgb(var(--color-primary)/0.1)] rounded-2xl flex items-center justify-center mb-6 border border-[rgb(var(--color-primary)/0.1)] mx-auto group-hover:bg-[rgb(var(--color-primary))] group-hover:text-white transition-all duration-500">
                  <div className="text-[rgb(var(--color-primary))] group-hover:text-white">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-text))] mb-3">
                  {feature.title}
                </h3>
                <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Specialty Areas */}
      <section className="py-24 px-4 bg-[rgb(var(--color-bg))] relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <motion.div
            className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-10 group hover:border-[rgb(var(--color-primary)/0.5)] transition-all duration-300"
            variants={itemVariants}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-[rgb(var(--color-primary)/0.1)] rounded-2xl flex items-center justify-center text-[rgb(var(--color-primary))] border border-[rgb(var(--color-primary)/0.2)] group-hover:scale-110 group-hover:bg-[rgb(var(--color-primary))] group-hover:text-white transition-all">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[rgb(var(--color-text))]">
                Himalayan Skin Science
              </h3>
            </div>
            <p className="text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed text-lg font-medium">
              Kathmandu's altitude and UV levels require a unique dermatological
              approach. We have optimized every Korean protocol for local
              conditions.
            </p>
            <ul className="space-y-4">
              {[
                "High-Altitude UV Protection Protocols",
                "Atmospheric Pollutant Defense Facials",
                "Low-Humidity Moisture Retention Science",
                "Environmental Skin Damage Reversal",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[rgb(var(--color-text))] font-bold group cursor-default"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-[rgb(var(--color-primary))] shadow-[0_0_8px_rgba(var(--color-primary),0.5)]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-10 group hover:border-[rgb(var(--color-primary)/0.5)] transition-all duration-300"
            variants={itemVariants}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-[rgb(var(--color-primary)/0.1)] rounded-2xl flex items-center justify-center text-[rgb(var(--color-primary))] border border-[rgb(var(--color-primary)/0.2)] group-hover:scale-110 group-hover:bg-[rgb(var(--color-primary))] group-hover:text-white transition-all">
                <Stethoscope className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[rgb(var(--color-text))]">
                Specialist Aesthetic Team
              </h3>
            </div>
            <p className="text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed text-lg font-medium">
              Our team consists of board-certified dermatologists and aesthetic
              nurses trained in Seoul, ensuring the highest surgical-grade
              precision.
            </p>
            <ul className="space-y-4">
              {[
                "NMC Certified Medical Practitioners",
                "Korean Trained Aesthetic Specialists",
                "Advanced Clinical Nursing Team",
                "Bespoke Patient Roadmap Engineering",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[rgb(var(--color-text))] font-bold group cursor-default"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-[rgb(var(--color-primary))] shadow-[0_0_8px_rgba(var(--color-primary),0.5)]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-10" />

        <motion.div
          animate="visible"
          className="max-w-4xl mx-auto flex flex-col items-center relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <motion.h2
            className="text-3xl md:text-5xl font-bold mb-6 text-[rgb(var(--color-text))] tracking-tight leading-tight"
            variants={itemVariants}
          >
            Begin Your <br />{" "}
            <span className="text-[rgb(var(--color-primary))]">
              Glow Journey
            </span>{" "}
            Today
          </motion.h2>
          <motion.p
            className="text-[rgb(var(--color-text-muted))] text-xl mb-12 max-w-2xl font-medium leading-relaxed"
            variants={itemVariants}
          >
            Join over 5,000 patients who have transformed their skin at HSC
            Laser Hospital. Schedule your digital skin analysis and medical
            consultation today.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            variants={itemVariants}
          >
            <Link className="no-underline w-full sm:w-auto" to="/login">
              <Button
                className="w-full sm:w-auto px-12 py-7 text-base font-bold rounded-xl shadow-xl bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary)/0.9)] text-white border-none"
                size="lg"
              >
                Schedule Consultation
              </Button>
            </Link>
            <Link className="no-underline w-full sm:w-auto" to="/contact">
              <Button
                className="w-full sm:w-auto px-12 py-7 text-base font-bold rounded-xl bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary)/0.9)] text-white border-none shadow-md"
                size="lg"
              >
                Inquire About Pricing
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
