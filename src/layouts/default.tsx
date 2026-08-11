import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { Navbar } from "@/components/navbar";
import { siteConfig } from "@/config/site";
import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { storage, APPWRITE_BUCKET_ID } from "@/config/appwrite";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clinicId } = useAuthContext();
  const [clinicName, setClinicName] = useState<string>(siteConfig.name);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  const [clinicPhone, setClinicPhone] = useState<string>(siteConfig.links.phone);
  const [clinicEmail, setClinicEmail] = useState<string>(siteConfig.links.email);
  const [clinicAddress, setClinicAddress] = useState<string>("Kathmandu, Nepal");
  const [clinicDescription, setClinicDescription] = useState<string>(siteConfig.description);

  // Helper to map DB file ID to Appwrite URL
  const getLogoUrl = (logo?: string) => {
    if (!logo) return null;
    if (logo.startsWith("http")) return logo;
    try {
      const url = storage.getFileView(APPWRITE_BUCKET_ID, logo);

      return `${url.toString()}&t=${Date.now()}`;
    } catch {
      return null;
    }
  };

  // Fetch clinic branding — works with or without auth
  useEffect(() => {
    let cancelled = false;

    const fetchClinic = async () => {
      try {
        let clinic = null;

        if (clinicId) {
          clinic = await clinicService.getClinicById(clinicId);
        } else {
          // Public page: fetch the first clinic from the database
          const all = await clinicService.getAllClinics();

          if (all.length > 0) clinic = all[0];
        }

        if (cancelled || !clinic) return;
        setClinicName(clinic.name);
        if (clinic.logo) setClinicLogo(getLogoUrl(clinic.logo));
        if (clinic.phone) setClinicPhone(clinic.phone);
        if (clinic.email) setClinicEmail(clinic.email);
        const parts = [clinic.address, clinic.city, clinic.state, clinic.country].filter(Boolean);

        if (parts.length > 0) setClinicAddress(parts.join(", "));
        if (clinic.description) setClinicDescription(clinic.description);
      } catch {
        /* silently fall back to defaults */
      }
    };

    fetchClinic();

    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[rgb(var(--color-bg))] font-sans text-[rgb(var(--color-text))] transition-colors duration-300">
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col pt-6">{children}</main>

      {/* Footer Area */}
      <footer className="w-full mt-20 transition-colors duration-300" style={{ background: "rgb(var(--color-surface))", borderTop: "1px solid rgb(var(--color-border))" }}>
        {/* Gradient accent bar */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, rgb(var(--color-primary)) 0%, rgba(var(--color-primary),0.4) 50%, transparent 100%)" }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-14">
            {/* ── Brand & Mission ── */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(var(--color-primary),0.15), rgba(var(--color-primary),0.05))", border: "1.5px solid rgba(var(--color-primary),0.3)" }}
                >
                  <img
                    alt={`${clinicName} Logo`}
                    className="w-10 h-10 object-contain"
                    src={clinicLogo || "/logo.png"}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "/logo.png";
                    }}
                  />
                  <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(135deg, white 0%, transparent 60%)" }} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg leading-tight" style={{ color: "rgb(var(--color-text))" }}>
                    {clinicName}
                  </h3>
                  <span
                    className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(var(--color-primary),0.12)", color: "rgb(var(--color-primary))" }}
                  >
                    Healthcare
                  </span>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-6 pr-6 max-w-xs" style={{ color: "rgb(var(--color-text-muted))" }}>
                {clinicDescription}
              </p>
              <div className="flex gap-3">
                {[
                  { href: "#", label: "Twitter / X", path: "M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" },
                  { href: "#", label: "YouTube", path: "M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" },
                  { href: "#", label: "LinkedIn", path: "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" },
                ].map((s) => (
                  <a
                    key={s.label}
                    aria-label={s.label}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                    href={s.href}
                    style={{ background: "rgba(var(--color-primary),0.08)", border: "1px solid rgba(var(--color-primary),0.15)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(var(--color-primary),0.2)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(var(--color-primary),0.08)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" style={{ color: "rgb(var(--color-primary))" }} viewBox="0 0 24 24">
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Platform Links ── */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "rgb(var(--color-primary))" }}>
                Platform
              </h4>
              <ul className="space-y-3">
                {[
                  { label: "Features", to: "/features" },
                  { label: "Pricing Plans", to: "/pricing" },
                  { label: "Book a Demo", to: "/demo" },
                  { label: "Clinic Login", to: "/login" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      className="group flex items-center gap-1.5 text-sm transition-all duration-150"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                      to={item.to}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-primary))"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-text-muted))"; }}
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs" style={{ color: "rgb(var(--color-primary))" }}>›</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Company Links ── */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "rgb(var(--color-primary))" }}>
                Company
              </h4>
              <ul className="space-y-3">
                {[
                  { label: "About Us", to: "/about" },
                  { label: "Blog & News", to: "/blog" },
                  { label: "Careers", to: "/careers" },
                  { label: "Contact Sales", to: "/contact" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      className="group flex items-center gap-1.5 text-sm transition-all duration-150"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                      to={item.to}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-primary))"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-text-muted))"; }}
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs" style={{ color: "rgb(var(--color-primary))" }}>›</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Support & Contact ── */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "rgb(var(--color-primary))" }}>
                Support
              </h4>
              <ul className="space-y-3 mb-6">
                {[
                  { label: "Help Center", to: "/help" },
                  { label: "System Status", to: "/status" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      className="group flex items-center gap-1.5 text-sm transition-all duration-150"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                      to={item.to}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-primary))"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-text-muted))"; }}
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs" style={{ color: "rgb(var(--color-primary))" }}>›</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* ── Glassmorphism Contact Card ── */}
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--color-primary),0.08), rgba(var(--color-primary),0.03))",
                  border: "1px solid rgba(var(--color-primary),0.2)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "rgb(var(--color-success))" }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "rgb(var(--color-success))" }} />
                  </span>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--color-text))" }}>
                    {clinicName}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgb(var(--color-primary))" }} viewBox="0 0 24 24">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs leading-snug" style={{ color: "rgb(var(--color-text-muted))" }}>{clinicAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgb(var(--color-primary))" }} viewBox="0 0 24 24">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <a
                    className="text-xs font-semibold transition-colors"
                    href={`tel:${clinicPhone}`}
                    style={{ color: "rgb(var(--color-text-muted))" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-primary))"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-text-muted))"; }}
                  >
                    {clinicPhone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgb(var(--color-primary))" }} viewBox="0 0 24 24">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <a
                    className="text-xs font-semibold transition-colors truncate"
                    href={`mailto:${clinicEmail}`}
                    style={{ color: "rgb(var(--color-text-muted))" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-primary))"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgb(var(--color-text-muted))"; }}
                  >
                    {clinicEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
            <div className="flex flex-col items-center md:items-start gap-1">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--color-text-muted))" }}>
                © {new Date().getFullYear()}{" "}
                <span className="font-bold" style={{ color: "rgb(var(--color-primary))" }}>{clinicName}</span>
                . All rights reserved.
              </p>
              <div className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: "rgb(var(--color-text-muted))" }}>
                <span>Designed & Engineered in</span>
                <span>🇳🇵</span>
                <span className="font-semibold">Nepal</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: "Terms", to: "/terms" },
                { label: "Privacy", to: "/privacy" },
                { label: "Security", to: "/security" },
                { label: "Compliance", to: "/compliance" },
              ].map((item, i, arr) => (
                <span key={item.label} className="flex items-center">
                  <Link
                    className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all duration-150"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                    to={item.to}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = "rgb(var(--color-primary))";
                      el.style.background = "rgba(var(--color-primary),0.08)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = "rgb(var(--color-text-muted))";
                      el.style.background = "transparent";
                    }}
                  >
                    {item.label}
                  </Link>
                  {i < arr.length - 1 && (
                    <span className="text-xs opacity-30 select-none" style={{ color: "rgb(var(--color-text-muted))" }}>·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
      {/* ── Floating WhatsApp Button ── */}
      <WhatsAppButton phone={clinicPhone} name={clinicName} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Floating Button
// ─────────────────────────────────────────────────────────────────────────────
function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Strip to digits only for wa.me URL
  const digits = phone.replace(/\D/g, "");
  const message = encodeURIComponent(
    `Hi ${name}! I'd like to book a consultation. Please let me know your available slots.`,
  );
  const waUrl = `https://wa.me/${digits}?text=${message}`;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
    >
      {/* Expandable card */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? "260px" : "0px",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div
          className="w-72 rounded-2xl p-5"
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#25D366" }}
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <p className="text-xs text-gray-500">Typically replies within minutes</p>
              </div>
            </div>
          </div>

          {/* Message bubble */}
          <div
            className="rounded-xl rounded-tl-none p-3 mb-4 text-sm text-gray-700 leading-relaxed"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            👋 Hi! How can we help you today? Tap below to chat with us on WhatsApp.
          </div>

          {/* CTA */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#25D366" }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Start Chat
          </a>
        </div>
      </div>

      {/* Trigger button */}
      <button
        aria-label="Chat on WhatsApp"
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{ background: "#25D366" }}
      >
        {!open && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: "#25D366" }}
          />
        )}
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        )}
      </button>
    </div>
  );
}
