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
  IoChatbubbleEllipsesOutline,
  IoNotificationsOutline,
} from "react-icons/io5";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";
import { NotificationService } from "@/services/notificationService";

import { useAuthContext } from "@/context/AuthContext";
import { ThemeSwitch } from "@/components/theme-switch";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { enquiryService } from "@/services/enquiryService";
import { clinicService } from "@/services/clinicService";
import { expertService } from "@/services/expertService";
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

  // ── Notifications state ────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [currentExpertId, setCurrentExpertId] = useState<string | null>(null);

  // Fetch current user's matching doctor/expert ID if applicable
  useEffect(() => {
    if (!clinicId || !currentUser?.email) return;
    
    // Resolve doctor ID
    doctorService.getDoctorsByClinic(clinicId).then((docs) => {
      const docMatch = docs.find(d => d.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (docMatch) {
        setCurrentDoctorId(docMatch.id);
      }
    });

    // Resolve expert ID
    expertService.getExpertsByClinic(clinicId).then((exps) => {
      const expMatch = exps.find(e => e.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (expMatch) {
        setCurrentExpertId(expMatch.id);
      }
    });
  }, [clinicId, currentUser?.email]);

  useEffect(() => {
    if (!clinicId) return;

    const notificationsCollection = collection(db, "notifications");
    const q = query(
      notificationsCollection,
      where("clinicId", "==", clinicId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        let unread = 0;
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const notif: any = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          };

          // Filter by role / user
          const isTargeted =
            (!data.targetRole && !data.targetUserId) ||
            (userData?.role && data.targetRole === userData.role) ||
            (currentUser?.uid && data.targetUserId === currentUser.uid) ||
            (currentDoctorId && data.targetUserId === currentDoctorId) ||
            (currentExpertId && data.targetUserId === currentExpertId);

          if (isTargeted) {
            list.push(notif);
            if (!notif.read) {
              unread++;
            }
          }
        });

        // Sort descending by createdAt in memory
        const sorted = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Check if unread count increased — do side effects OUTSIDE the setter
        setNotifications((prev) => {
          const prevUnread = prev.filter((n) => !n.read).length;
          const currentUnread = sorted.filter((n) => !n.read).length;
          if (currentUnread > prevUnread) {
            // Schedule side effects after state update completes
            setTimeout(() => {
              try {
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav");
                audio.volume = 0.5;
                audio.play();
              } catch (e) {
                console.log("Audio play blocked by browser:", e);
              }
              const latest = sorted[0];
              if (latest) {
                addToast({
                  title: latest.title,
                  description: latest.message,
                  color: "primary",
                });
              }
            }, 0);
          }
          return sorted;
        });

        setUnreadCount(unread);
      },
      (err) => {
        console.error("Notifications subscription error:", err);
      }
    );

    return () => unsubscribe();
  }, [clinicId, userData?.role, currentUser?.uid, currentDoctorId, currentExpertId]);

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        const [patients, doctors, enquiries] = await Promise.all([
          patientService.getPatientsByClinic(clinicId),
          doctorService.getDoctorsByClinic(clinicId),
          enquiryService.getEnquiries(clinicId, undefined, {
            dateField: "createdAt",
          }),
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

        enquiries.forEach((e) => {
          if (
            e.fullName?.toLowerCase().includes(ql) ||
            e.phone?.toLowerCase().includes(ql) ||
            e.reasonForVisit?.toLowerCase().includes(ql)
          ) {
            results.push({
              id: e.id,
              type: "enquiry" as any,
              title: e.fullName,
              subtitle: `Enquiry: ${e.reasonForVisit || "General"}`,
              extraInfo: e.phone,
              href: "/dashboard/enquiries",
            });
          }
        });

        // Sort by match position and type
        results.sort((a, b) => {
          const aIndex = a.title.toLowerCase().indexOf(ql);
          const bIndex = b.title.toLowerCase().indexOf(ql);

          if (aIndex !== bIndex) return aIndex - bIndex;

          const typeOrder = { patient: 0, doctor: 1, enquiry: 2 };
          return (typeOrder[a.type as keyof typeof typeOrder] ?? 99) - (typeOrder[b.type as keyof typeof typeOrder] ?? 99);
        });

        setSearchResults(results.slice(0, 10));
        setShowResults(true);
      } catch (err) {
        console.error("Search error:", err);
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
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-surface/80 backdrop-blur-xl border-b border-border-base flex items-center px-4 gap-4 print:hidden shadow-sm transition-all duration-300">
      {/* ── Left: toggle + logo ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <Link
          className="flex items-center gap-2.5 text-text-main no-underline font-bold transition-all hover:opacity-90"
          to="/"
        >
          <div className="w-10 h-10 rounded-md bg-white dark:bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden shadow-sm shadow-primary/20 ring-1 ring-border-base p-1">
            <img
              alt="Clinic Logo"
              className="w-full h-full object-contain"
              src={clinicData?.logo ? getLogoUrl(clinicData.logo) || "/logo.png" : "/logo.png"}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = "/logo.png";
              }}
            />
          </div>
        </Link>

        <Button
          isIconOnly
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="text-text-muted bg-surface-2 hover:bg-surface-3 hover:text-primary border border-border-base/50 shadow-sm transition-all duration-200 ml-1"
          color="default"
          radius="lg"
          size="sm"
          variant="flat"
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? (
            <IoMenuOutline className="w-[18px] h-[18px]" />
          ) : (
            <IoMenuOutline className="w-[18px] h-[18px]" />
          )}
        </Button>
      </div>

      {/* ── Center: search ─────────────────────────────────────────────── */}
      <div
        className="hidden md:block absolute left-1/2 -translate-x-1/2 w-full max-w-[440px] transition-all"
      >
        <Input
          ref={searchInputRef}
          fullWidth
          classNames={{
            inputWrapper: "rounded-xl bg-surface-2/50 border border-border-base/50 hover:bg-surface-2/80 focus-within:!bg-surface focus-within:shadow-md focus-within:shadow-primary/5 focus-within:!border-primary/50 h-9 px-3 transition-all duration-300",
            input: "text-[13px] text-text-main placeholder:text-text-muted/60"
          }}
          endContent={
            <div className="flex items-center gap-1.5 ml-1">
              {searchQuery ? (
                <button
                  className="text-text-muted hover:text-text-main transition-colors bg-surface-3 rounded-md p-0.5"
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowResults(false);
                  }}
                >
                  <IoCloseOutline className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border-base bg-surface-3 px-1.5 font-mono text-[10px] font-medium text-text-muted opacity-100">
                  <span className="text-[10px]">⌘</span>K
                </kbd>
              )}
            </div>
          }
          placeholder="Search specialists, patients, or records…"
          startContent={
            isSearching ? (
              <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <IoSearchOutline className="w-3.5 h-3.5 text-text-muted/60 group-focus-within:text-primary transition-colors" />
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
                            ? "bg-primary/10 text-primary"
                            : result.type === "doctor"
                              ? "bg-success/10 text-success"
                              : "bg-amber-500/10 text-amber-600"
                            }`}
                        >
                          {result.type === "patient" ? (
                            <IoPersonOutline className="w-3.5 h-3.5" />
                          ) : result.type === "doctor" ? (
                            <IoMedicalOutline className="w-3.5 h-3.5" />
                          ) : (
                            <IoChatbubbleEllipsesOutline className="w-3.5 h-3.5" />
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
        {/* Real-time Notifications Bell */}
        <div ref={notifContainerRef} className="relative">
          <button
            aria-label="Notifications"
            className="relative p-2 rounded-full border border-border-base/40 bg-surface-2/30 hover:bg-surface-2 hover:border-border-base transition-all duration-200"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <IoNotificationsOutline className="w-[18px] h-[18px] text-text-muted hover:text-primary transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-white/10 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border-base shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-border-base bg-surface-2 flex justify-between items-center">
                <span className="text-[12.5px] font-bold text-text-main">
                  Notifications ({unreadCount} unread)
                </span>
                {unreadCount > 0 && (
                  <button
                    className="text-[11px] text-primary hover:underline font-medium"
                    onClick={() => {
                      if (clinicId) {
                        NotificationService.markAllAsRead(clinicId, {
                          userId: currentUser?.uid,
                          role: userData?.role,
                          doctorId: currentDoctorId ?? undefined,
                          expertId: currentExpertId ?? undefined,
                        });
                      }
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[300px] overflow-y-auto divide-y divide-border-base">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-text-muted">
                    <p className="text-[12px]">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-[12px] space-y-1 hover:bg-surface-2 transition-colors cursor-pointer relative ${!notif.read ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      onClick={() => {
                        if (notif.id) {
                          NotificationService.markAsRead(notif.id);
                        }
                        setIsNotifOpen(false);
                      }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={`font-semibold text-text-main ${!notif.read ? "text-primary" : ""}`}>
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-text-muted whitespace-nowrap">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-text-muted leading-snug">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme switch */}
        <ThemeSwitch />

        {/* User menu */}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <button
              aria-label="User menu"
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-border-base/40 bg-surface-2/30 hover:bg-surface-2 hover:border-border-base transition-all duration-200 ml-1 group"
              type="button"
            >
              <Avatar
                className="ring-2 ring-surface shadow-sm w-7 h-7"
                color="primary"
                name={displayName}
                size="sm"
                src={userData?.photoURL || currentUser?.photoURL || ""}
              />
              <span className="hidden sm:block text-[13px] font-semibold text-text-main max-w-[100px] truncate ml-0.5">
                {displayName}
              </span>
              <IoChevronDownOutline className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
            </button>
          </DropdownTrigger>

          <DropdownMenu aria-label="User actions">
            {/* Header info */}
            <DropdownSection showDivider>
              <div className="px-3 py-1.5">
                <p className="text-[11px] font-semibold text-text-main truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-text-muted truncate">
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
