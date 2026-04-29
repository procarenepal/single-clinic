import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Users,
  Settings,
  Server,
  Calendar,
  ShieldCheck,
  ClipboardList,
  FileText,
  Building,
  Computer,
  Stethoscope,
  Pill,
  CreditCard,
  FileClock,
  LayoutDashboard,
  ShieldAlert,
  Archive,
  BookOpen,
} from "lucide-react";

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
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Theme-aware background decoration */}
        <div className="absolute inset-0 mesh-gradient opacity-40" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.05]" />

        <motion.div
          animate="visible"
          className="relative z-10 max-w-5xl mx-auto flex flex-col items-center justify-center text-center"
          initial="hidden"
          variants={containerVariants}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-primary-light/50 backdrop-blur-xl text-primary px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase border border-primary/20 mb-8 shadow-sm"
            variants={itemVariants}
          >
            <Settings className="w-4 h-4 animate-spin-slow" />
            <span>Clinic Clarity Architecture v2</span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 text-[rgb(var(--color-text))] tracking-tight leading-[1.1]"
            variants={itemVariants}
          >
            Sovereign Healthcare <br />{" "}
            <span className="text-primary">Digital Infrastructure</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-[rgb(var(--color-text-muted))] mb-12 max-w-2xl mx-auto font-medium leading-relaxed"
            variants={itemVariants}
          >
            Engineered for clinical velocity. Native light and dark mode
            optimization. The definitive platform for medical excellence.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={itemVariants}
          >
            <Link className="no-underline" to="/demo">
              <Button className="px-12 py-7 text-base font-bold rounded-xl" color="primary" size="lg">
                Book Specialized Demo
              </Button>
            </Link>
            <Link className="no-underline" to="/contact">
              <Button
                className="px-12 py-7 text-base font-bold rounded-xl"
                color="default"
                size="lg"
                variant="bordered"
              >
                Contact Sales
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Patient Management Features */}
      <section className="py-24 bg-[rgb(var(--color-bg))] relative overflow-hidden px-4 border-y border-[rgb(var(--color-border))]">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-light/30 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-primary/10 mb-4 backdrop-blur-sm">
              <Users className="w-4 h-4" />
              Patient Care Hub
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Absolute Patient Management
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              Maintain meticulously organized, accessible, and comprehensive
              patient records designed specifically to support clinical
              demographic nuances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "In-Depth Registration",
                description:
                  "Capture extensive patient demographics, including full BS/AD date support, emergency contacts, local addresses, and immediate familial links.",
                icon: <ClipboardList className="w-6 h-6" />,
              },
              {
                title: "Medical Histories",
                description:
                  "Secure, chronological tracking of a patient's entire medical background. Easily jump between past diagnoses, procedures, and long-term treatment strategies.",
                icon: <Archive className="w-6 h-6" />,
              },
              {
                title: "Structured Medical Notes",
                description:
                  "Provide doctors with logical, multi-sectional note formats. Standardized templates ensure consistency in symptom tracking and care directives.",
                icon: <FileText className="w-6 h-6" />,
              },
              {
                title: "Synchronized Billing",
                description:
                  "All financial interactions directly tied to patient profiles. Seamlessly generate NPR invoices and track outstanding balances over the patient lifecycle.",
                icon: <CreditCard className="w-6 h-6" />,
              },
              {
                title: "Appointment Timelines",
                description:
                  "Instantly view all historical visits and upcoming scheduled appointments associated with an individual's digital health record.",
                icon: <FileClock className="w-6 h-6" />,
              },
              {
                title: "NMC Validation Ready",
                description:
                  "Structure data to conform with governmental standards. Easily retrieve and export demographic summaries for mandatory compliance reporting.",
                icon: <ShieldCheck className="w-6 h-6" />,
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="clarity-card p-8 group hover:border-primary/50 hover-lift transition-all duration-300"
                variants={itemVariants}
              >
                <div className="w-14 h-14 bg-primary-light/50 rounded-xl flex items-center justify-center border border-primary/10 mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                  <div className="text-primary group-hover:text-white">
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

      {/* Appointment Engine */}
      <section className="py-24 px-4 bg-[rgb(var(--color-surface-2))] relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-light/30 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-primary/10 mb-4 backdrop-blur-sm">
              <Calendar className="w-4 h-4" />
              Operational Scheduling
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              A Powerhouse Appointment Engine
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              Prevent overbooking and minimize wait times. Intelligent
              scheduling guarantees maximum throughput without burning out your
              medical staff.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {[
                {
                  title: "Dynamic Appointment Rules",
                  description:
                    "Configure new consultations, follow-ups, and urgent triage setups. Attach distinct billing rules and buffer times automatically.",
                },
                {
                  title: "Live Doctor Availability",
                  description:
                    "Calendar interfaces update in real-time, preventing double bookings. Receptionists can spot gaps and optimize the daily flow instantly.",
                },
                {
                  title: "Zero No-Show Optimization",
                  description:
                    "Categorize appointment statuses dynamically. Track when patients arrive, are waiting, or if they skip—helping you blacklist chronic offenders.",
                },
                {
                  title: "Automated Rescheduling",
                  description:
                    "Doctor suddenly unavailable? Quickly bulk-reschedule a block of patients with automated notifications dispatched to their profiles.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="clarity-card group flex gap-5 p-6 hover:border-primary/30 transition-all duration-300"
                  variants={itemVariants}
                >
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0 group-hover:scale-150 shadow-[0_0_8px_rgba(var(--color-primary),0.5)] transition-transform" />
                  <div>
                    <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-1 group-hover:text-primary transition-colors">
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
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-transparent rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
              <div className="relative p-2 clarity-card overflow-hidden">
                <img
                  alt="Clinic Scheduling Interface Preview"
                  className="rounded-lg border border-[rgb(var(--color-border))] w-full h-auto object-cover aspect-[4/3] group-hover:scale-[1.01] transition-transform duration-700"
                  src="/images/banner_features.png"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?auto=format&fit=crop&w=800&q=80";
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Advanced Pharmacy & Inventory */}
      <section className="py-24 bg-[rgb(var(--color-bg))] border-y border-[rgb(var(--color-border))] px-4 relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-light/30 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-primary/10 mb-4 backdrop-blur-sm">
              <Pill className="w-4 h-4" />
              Dispensary Control
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Clinical Pharmacy & Inventory
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] max-w-2xl mx-auto leading-relaxed">
              Eliminate revenue leakage from paper-based tracking. Our rigorous
              inventory ledger connects clinical prescriptions to physical
              dispensary stock.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Deep Cataloging",
                description:
                  "Index items by generic names, specific brand configurations, and rigid clinical categories.",
                icon: <BookOpen className="w-8 h-8" />,
              },
              {
                title: "Active Stock Balancing",
                description:
                  "Monitor stock minimums. Automated triggers engage before crucial medications hit low levels.",
                icon: <LayoutDashboard className="w-8 h-8" />,
              },
              {
                title: "Purchase Pipeline",
                description:
                  "Integration mapping suppliers, recording inward goods, and logging wholesale invoices natively.",
                icon: <Computer className="w-8 h-8" />,
              },
              {
                title: "Expiry Deterrence",
                description:
                  "Batch-level tracking isolates approaching expiration dates, ensuring operative safety.",
                icon: <ShieldAlert className="w-8 h-8" />,
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="clarity-card p-8 group hover:border-primary/50 hover-lift transition-all duration-300 text-center"
                variants={itemVariants}
              >
                <div className="w-20 h-20 bg-primary-light/50 rounded-2xl flex items-center justify-center mb-6 border border-primary/10 mx-auto group-hover:bg-primary group-hover:text-white transition-all duration-500">
                  <div className="text-primary group-hover:text-white">
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

      {/* Enterprise Capabilities */}
      <section className="py-24 px-4 bg-[rgb(var(--color-bg))] relative overflow-hidden">
        <motion.div
          animate="visible"
          className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10"
          initial="hidden"
          variants={containerVariants}
        >
          <motion.div
            className="clarity-card p-10 group hover-glow hover:border-primary/50 transition-all duration-300"
            variants={itemVariants}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-primary-light/50 rounded-2xl flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                <Building className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[rgb(var(--color-text))]">
                Multi-Facility Administration
              </h3>
            </div>
            <p className="text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed text-lg">
              For expanding healthcare groups, standard solutions don't scale.
              Anchor a primary headquarters while spinning up distinct regional
              branches, all isolated yet centrally monitored.
            </p>
            <ul className="space-y-4">
              {[
                "Independent Operating Hours & Tax Identifiers",
                "Strict Data Partitioning Between Branches",
                "Central Administrative Dashboard Control",
                "Cross-Clinic Staff Reassignments",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[rgb(var(--color-text))] font-medium group cursor-default"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="clarity-card p-10 group hover-glow hover:border-primary/50 transition-all duration-300"
            variants={itemVariants}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-primary-light/50 rounded-2xl flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                <Stethoscope className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[rgb(var(--color-text))]">
                Staff & Physician Mastery
              </h3>
            </div>
            <p className="text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed text-lg">
              Handle complex employment parameters effortlessly. Distinguish
              between permanent organizational doctors and visiting specialists
              by structuring flexible commission paradigms.
            </p>
            <ul className="space-y-4">
              {[
                "Detailed Doctor Profiles with NMC Tracking",
                "Advanced Visit & Commission Algorithms",
                "Granular Role-Based Data Access (RBAC)",
                "Full System Activity Audit Logs",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[rgb(var(--color-text))] font-medium group cursor-default"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]" />
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
            className="text-4xl md:text-6xl font-bold mb-8 text-[rgb(var(--color-text))] tracking-tight leading-tight"
            variants={itemVariants}
          >
            Deploy Powerful <br /> Software Today
          </motion.h2>
          <motion.p
            className="text-[rgb(var(--color-text-muted))] text-xl mb-12 max-w-2xl font-medium leading-relaxed"
            variants={itemVariants}
          >
            Eliminate clerical friction and elevate patient focus. Our system is
            robust, meticulously styled for low visual strain, and engineered
            for velocity.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            variants={itemVariants}
          >
            <Link className="no-underline w-full sm:w-auto" to="/demo">
              <Button className="w-full sm:w-auto px-12 py-7 text-base font-bold rounded-xl shadow-xl" color="primary">
                Initialize Demo Deployment
              </Button>
            </Link>
            <Link className="no-underline w-full sm:w-auto" to="/contact">
              <Button
                className="w-full sm:w-auto px-12 py-7 text-base font-bold rounded-xl"
                color="default"
                variant="bordered"
              >
                Direct Integration Consult
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
