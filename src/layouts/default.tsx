import { useState, useEffect } from "react";
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

  // Fetch clinic branding
  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;

    clinicService
      .getClinicById(clinicId)
      .then((clinic) => {
        if (cancelled || !clinic) return;
        setClinicName(clinic.name);
        if (clinic.logo) setClinicLogo(getLogoUrl(clinic.logo));
      })
      .catch(() => {
        /* silently fall back to defaults */
      });

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
      <footer className="w-full bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] mt-20 pb-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
            {/* Brand & Mission */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 border border-[rgb(var(--color-border))] rounded-lg bg-[rgb(var(--color-surface-2))] shadow-sm flex items-center justify-center">
                  <img
                    alt={`${clinicName} Logo`}
                    className="w-8 h-8 object-contain"
                    src={clinicLogo || "/logo.png"}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;

                      target.onerror = null;
                      target.src = "/logo.png";
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-[rgb(var(--color-text))] tracking-tight">
                    {clinicName}
                  </h3>
                  <p className="text-xs text-[rgb(var(--color-primary))] font-bold uppercase tracking-wider">
                    Aesthetic Sanctuary
                  </p>
                </div>
              </div>
              <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed mb-6 pr-4">
                {siteConfig.description}
              </p>
              <div className="flex gap-4">
                <a
                  className="w-8 h-8 rounded-full border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-primary-light))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] transition-all"
                  href="#"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </a>
                <a
                  className="w-8 h-8 rounded-full border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-primary-light))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] transition-all"
                  href="#"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                  </svg>
                </a>
                <a
                  className="w-8 h-8 rounded-full border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-primary-light))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] transition-all"
                  href="#"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[rgb(var(--color-primary))] mb-5">
                Platform
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/features"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/pricing"
                  >
                    Pricing Plans
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/demo"
                  >
                    Book a Demo
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/login"
                  >
                    Clinic Login
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[rgb(var(--color-primary))] mb-5">
                Company
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/about"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/blog"
                  >
                    Blog & News
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/careers"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/contact"
                  >
                    Contact Sales
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support Space */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[rgb(var(--color-primary))] mb-5">
                Support
              </h4>
              <ul className="space-y-3 mb-6">
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/help"
                  >
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline underline-offset-4 transition-all"
                    to="/status"
                  >
                    System Status
                  </Link>
                </li>
              </ul>

              {/* Contact Box */}
              <div className="p-4 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded-md clarity-card">
                <p className="text-xs font-bold text-[rgb(var(--color-text))] uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[rgb(var(--color-success))]" />
                  Kathmandu HQ
                </p>
                <div className="space-y-1.5 text-sm text-[rgb(var(--color-text-muted))]">
                  <p>Tripureshwor, Kathmandu, Nepal</p>
                  <p className="pt-2">
                    <a
                      className="font-medium hover:text-[rgb(var(--color-primary))] transition-colors"
                      href={`tel:${siteConfig.links.phone ?? ""}`}
                    >
                      {siteConfig.links.phone ?? "+977-1-XX-XXXX"}
                    </a>
                  </p>
                  <p>
                    <a
                      className="font-medium hover:text-[rgb(var(--color-primary))] transition-colors"
                      href={`mailto:${siteConfig.links.email ?? ""}`}
                    >
                      {siteConfig.links.email ?? "hello@procaresoftware.com"}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-4">
          <div className="pt-8 border-t border-[rgb(var(--color-border))] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <p className="text-[rgb(var(--color-text-muted))] text-sm font-medium">
                © {new Date().getFullYear()} {clinicName}. All rights reserved.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))] opacity-70">
                <span>Designed & Engineered in</span>
                <span className="text-red-500">🇳🇵</span>
                <span className="font-medium text-[rgb(var(--color-text-muted))]">
                  Nepal
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              <Link
                className="text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors text-uppercase tracking-wide uppercase"
                to="/terms"
              >
                Terms
              </Link>
              <Link
                className="text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors text-uppercase tracking-wide uppercase"
                to="/privacy"
              >
                Privacy
              </Link>
              <Link
                className="text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors text-uppercase tracking-wide uppercase"
                to="/security"
              >
                Security
              </Link>
              <Link
                className="text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors text-uppercase tracking-wide uppercase"
                to="/compliance"
              >
                Compliance
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
