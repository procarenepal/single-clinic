import {
  useState,
  useEffect,
  useRef,
  useCallback,
  startTransition,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IoMenuOutline,
  IoGridOutline,
  IoSearchOutline,
  IoPersonOutline,
  IoMedicalOutline,
  IoLogOutOutline,
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoChevronDownOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { ThemeSwitch } from "@/components/theme-switch";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { clinicService } from "@/services/clinicService";
import { Clinic } from "@/types/models";
import { storage, APPWRITE_BUCKET_ID } from "@/config/appwrite";
// Custom UI — zero HeroUI
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@/components/ui/dropdown";
import { addToast } from "@/components/ui/toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type SearchResult = {
  id: string;
  type: "patient" | "doctor";
  title: string;
  subtitle: string;
  extraInfo?: string;
  href: string;
};

export interface DashboardHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const DashboardHeader = ({
  isSidebarOpen,
  toggleSidebar,
}: DashboardHeaderProps) => {
  const { currentUser, userData, logout, clinicId } = useAuthContext();
  const navigate = useNavigate();

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [clinicData, setClinicData] = useState<Clinic | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
      addToast({
        title: "Logged out",
        description: "See you soon!",
        color: "success",
      });
    } catch {
      addToast({
        title: "Error",
        description: "Failed to log out. Try again.",
        color: "danger",
      });
    }
  };

  // ── Fetch clinic branding ──────────────────────────────────────────────────
  const fetchBranding = useCallback(async () => {
    if (!clinicId) return;
    try {
      const data = await clinicService.getClinicById(clinicId);

      startTransition(() => {
        setClinicData(data);
      });
    } catch (err) {
      console.error("Failed to fetch clinic branding:", err);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Listen for branding updates from other components (like ClinicSettingsPage)
  useEffect(() => {
    const handleUpdate = () => fetchBranding();

    window.addEventListener("clinic-branding-updated", handleUpdate);

    return () =>
      window.removeEventListener("clinic-branding-updated", handleUpdate);
  }, [fetchBranding]);

  const getLogoUrl = (logo?: string) => {
    if (!logo) return null;
    if (logo.startsWith("http")) return logo;
    try {
      // Add timestamp to bust cache
      const url = storage.getFileView(APPWRITE_BUCKET_ID, logo);

      return `${url.toString()}&t=${Date.now()}`;
    } catch {
      return null;
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const performSearch = useCallback(
    async (query: string) => {
      if (!clinicId || !query.trim()) return;

      setIsSearching(true);
      try {
        const [patients, doctors] = await Promise.all([
          patientService.getPatientsByClinic(clinicId),
          doctorService.getDoctorsByClinic(clinicId),
        ]);

        const ql = query.toLowerCase();
        const results: SearchResult[] = [];

        patients.forEach((p) => {
          if (
            p.name?.toLowerCase().includes(ql) ||
            p.email?.toLowerCase().includes(ql) ||
            p.mobile?.toLowerCase().includes(ql) ||
            p.regNumber?.toLowerCase().includes(ql)
          ) {
            results.push({
              id: p.id,
              type: "patient",
              title: p.name,
              subtitle: `Reg# ${p.regNumber}`,
              extraInfo: p.mobile || p.email,
              href: `/dashboard/patients/${p.id}`,
            });
          }
        });

        doctors.forEach((d) => {
          if (
            d.name?.toLowerCase().includes(ql) ||
            d.speciality?.toLowerCase().includes(ql) ||
            d.nmcNumber?.toLowerCase().includes(ql)
          ) {
            results.push({
              id: d.id,
              type: "doctor",
              title: d.name,
              subtitle: d.speciality,
              extraInfo: d.nmcNumber ? `NMC: ${d.nmcNumber}` : undefined,
              href: `/dashboard/doctors/${d.id}`,
            });
          }
        });

        // Patients first, then sort by match position
        results.sort((a, b) => {
          if (a.type === "patient" && b.type === "doctor") return -1;
          if (a.type === "doctor" && b.type === "patient") return 1;

          return (
            a.title.toLowerCase().indexOf(ql) -
            b.title.toLowerCase().indexOf(ql)
          );
        });

        setSearchResults(results.slice(0, 8));
        setShowResults(true);
      } catch {
        addToast({ title: "Search failed", color: "danger" });
      } finally {
        setIsSearching(false);
      }
    },
    [clinicId],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);

      return;
    }
    debounceRef.current = setTimeout(() => performSearch(searchQuery), 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, performSearch]);

  // Close results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl/Cmd+K → focus search; Esc → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handler);

    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.href);
    setSearchQuery("");
    setShowResults(false);
  };

  const displayName =
    currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-lg border-b border-mountain-200/60 dark:border-zinc-800/60 flex items-center px-4 gap-4 print:hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] dark:shadow-none transition-all duration-300">
      {/* ── Left: toggle + logo ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <Button
          isIconOnly
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="text-mountain-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-mountain-50 dark:hover:bg-zinc-800 border border-mountain-200/60 dark:border-zinc-800/60 shadow-sm transition-all"
          color="default"
          radius="md"
          size="sm"
          variant="flat"
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? (
            <IoGridOutline className="w-[18px] h-[18px]" />
          ) : (
            <IoMenuOutline className="w-[18px] h-[18px]" />
          )}
        </Button>

        <Link
          className="flex items-center gap-2.5 text-mountain-900 dark:text-zinc-100 no-underline font-bold transition-all hover:opacity-90 ml-1"
          to="/"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 overflow-hidden shadow-sm shadow-teal-600/30 ring-1 ring-white/20 dark:ring-white/10">
            {clinicData?.logo ? (
              <img
                alt="logo"
                className="w-full h-full object-cover"
                src={getLogoUrl(clinicData.logo) || ""}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <span className="text-white text-[15px] font-bold">
                {clinicData?.name?.charAt(0) || "P"}
              </span>
            )}
          </div>
          <span className="font-bold text-[14px] hidden sm:block leading-none text-mountain-900 dark:text-zinc-100 tracking-tight">
            {clinicData?.name || "ProCare Software"}
          </span>
        </Link>
      </div>

      {/* ── Center: search ─────────────────────────────────────────────── */}
      <div
        className="hidden md:block absolute left-1/2 -translate-x-1/2 w-full max-w-[480px] transition-all"
      >
        <Input
          ref={searchInputRef}
          fullWidth
          classNames={{
            inputWrapper: "rounded-xl bg-mountain-50/80 dark:bg-zinc-900/60 border border-mountain-200/50 dark:border-zinc-800/50 hover:bg-mountain-100/80 dark:hover:bg-zinc-800/80 focus-within:!bg-white dark:focus-within:!bg-zinc-950 focus-within:shadow-sm focus-within:!border-teal-500/50 h-9 px-3 transition-all duration-300",
            input: "text-[13px]"
          }}
          endContent={
            searchQuery && (
              <button
                className="text-mountain-400 hover:text-mountain-600 dark:hover:text-zinc-300 transition-colors bg-mountain-100 dark:bg-zinc-800 rounded-full p-0.5 ml-1"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowResults(false);
                }}
              >
                <IoCloseOutline className="w-3.5 h-3.5" />
              </button>
            )
          }
          placeholder="Search specialists, patients, or records… (⌘K)"
          startContent={
            isSearching ? (
              <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <IoSearchOutline className="w-3.5 h-3.5 text-mountain-400/80 dark:text-zinc-500" />
            )
          }
          value={searchQuery}
          variant="flat"
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery && searchResults.length > 0) setShowResults(true);
          }}
        />

        {/* Search results popover */}
        {showResults && (
          <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50">
            <Card className="border border-mountain-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-xl shadow-mountain-900/5 dark:shadow-none rounded-xl overflow-hidden">
              <CardBody className="p-2">
                {searchResults.length === 0 ? (
                  <div className="text-center py-4">
                    <IoSearchOutline className="w-5 h-5 mx-auto mb-1 text-text-muted/30" />
                    <p className="text-xs text-text-muted">
                      No results for "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left hover:bg-surface-2 transition-colors duration-75 focus:outline-none focus:bg-surface-2"
                        type="button"
                        onClick={() => handleResultClick(result)}
                      >
                        {/* Icon */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${result.type === "patient"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-health-100 text-health-700"
                            }`}
                        >
                          {result.type === "patient" ? (
                            <IoPersonOutline className="w-3.5 h-3.5" />
                          ) : (
                            <IoMedicalOutline className="w-3.5 h-3.5" />
                          )}
                        </div>
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-main truncate">
                            {result.title}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">
                            {result.subtitle}
                          </p>
                        </div>
                        {/* Type badge */}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-text-muted shrink-0 capitalize">
                          {result.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* ── Right: actions + user ───────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {/* Theme switch */}
        <ThemeSwitch />

        {/* User menu */}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <button
              aria-label="User menu"
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-transparent hover:bg-mountain-50/80 hover:border-mountain-200/50 dark:hover:bg-zinc-900/50 dark:hover:border-zinc-800/50 transition-all duration-200 ml-1 group"
              type="button"
            >
              <Avatar src={userData?.photoURL || currentUser?.photoURL || ""} color="primary" name={displayName} size="sm" className="ring-2 ring-white dark:ring-zinc-950 shadow-sm w-7 h-7" />
              <span className="hidden sm:block text-[13px] font-medium text-mountain-900 dark:text-zinc-200 max-w-[100px] truncate ml-0.5">
                {displayName}
              </span>
              <IoChevronDownOutline className="w-3.5 h-3.5 text-mountain-400 dark:text-zinc-500 group-hover:text-mountain-600 dark:group-hover:text-zinc-300 transition-colors" />
            </button>
          </DropdownTrigger>

          <DropdownMenu aria-label="User actions">
            {/* Header info */}
            <DropdownSection showDivider>
              <div className="px-3 py-1.5">
                <p className="text-[11px] font-semibold text-mountain-900 truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-mountain-400 truncate">
                  {currentUser?.email}
                </p>
              </div>
            </DropdownSection>

            <DropdownSection showDivider>
              <DropdownItem
                startContent={<IoPersonCircleOutline className="w-3.5 h-3.5" />}
                onClick={() => navigate("/dashboard/profile")}
              >
                My Profile
              </DropdownItem>
              <DropdownItem
                startContent={<IoSettingsOutline className="w-3.5 h-3.5" />}
                onClick={() => navigate("/dashboard/settings")}
              >
                System Settings
              </DropdownItem>
            </DropdownSection>

            <DropdownItem
              color="danger"
              startContent={<IoLogOutOutline className="w-3.5 h-3.5" />}
              onClick={handleLogout}
            >
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </header>
  );
};
