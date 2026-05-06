import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  IoMenuOutline,
  IoCloseOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoAppsOutline,
  IoGridOutline,
  IoWarningOutline,
  IoRefreshOutline,
  IoHeadsetOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useNavigation } from "@/hooks/useNavigation";
import { useTheme } from "@/context/ThemeContext";
import { DashboardHeader } from "@/components/dashboard-header";
import { NavItem } from "@/services/navigationService";
import { prefetchChunks } from "@/utils/prefetchRoutes";
// Custom UI components — no HeroUI
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

export interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentUser, userData } = useAuthContext();
  const { isDark } = useTheme();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const { navItems, loading, error, refreshNavigation } = useNavigation();

  // Prefetch likely next routes after first render
  useEffect(() => {
    if (loading) return;
    const topLevel = navItems.slice(0, 4);

    prefetchChunks(
      topLevel.map((i) => ({
        path: i.href,
        importChunk: () => {
          if (i.href.startsWith("/dashboard/patients"))
            return import("@/pages/dashboard/patients");
          if (i.href.startsWith("/dashboard/appointments"))
            return import("@/pages/dashboard/appointments");
          if (i.href.startsWith("/dashboard/doctors"))
            return import("@/pages/dashboard/doctors");
          if (i.href.startsWith("/dashboard/medicine-management"))
            return import("@/pages/dashboard/medicine-management/index");

          return Promise.resolve();
        },
      })),
    );
  }, [loading, navItems]);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-expand parent menus when a child page is active
  useEffect(() => {
    if (loading || navItems.length === 0) return;
    const expanded = new Set<string>();

    const check = (items: NavItem[]) => {
      items.forEach((item) => {
        if (item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            isPathActive(child),
          );

          if (hasActiveChild) expanded.add(item.href);
          check(item.children);
        }
      });
    };

    check(navItems);
    setExpandedMenus(expanded);
  }, [location.pathname, navItems, loading]);

  const toggleSubMenu = (href: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);

      next.has(href) ? next.delete(href) : next.add(href);

      return next;
    });
  };

  const isPathActive = (item: NavItem): boolean => {
    if (location.pathname === item.href) return true;
    if (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
      return true;

    return item.children.some((child) => isPathActive(child));
  };

  // ── Render a nav item recursively ──────────────────────────────────────────
  const renderNavItem = (item: NavItem, level = 0): React.ReactNode => {
    const hasChildren = item.children.length > 0;
    const isExpanded = expandedMenus.has(item.href);
    const isActive = isPathActive(item);

    const itemBase = clsx(
      "relative group flex items-center px-3 py-1 text-[14px] font-medium rounded-xl transition-all duration-300 select-none cursor-pointer mb-0",
      level > 0 && "ml-3",
      isActive
        ? "text-primary"
        : "text-text-muted hover:text-text-main hover:bg-primary/5 dark:hover:bg-primary/10",
    );

    return (
      <motion.div
        key={item.href}
        layout
        animate={{ opacity: 1, x: 0 }}
        initial={{ opacity: 0, x: -5 }}
        transition={{ duration: 0.2 }}
      >
        {hasChildren ? (
          <div
            className={clsx(
              "flex items-center rounded-lg overflow-hidden group/nav",
              level > 0 && "ml-3",
            )}
          >
            {/* Clickable link area */}
            <Link
              className={clsx(
                "relative flex items-center flex-1 px-3 py-1 text-[14.5px] font-medium transition-all duration-300 rounded-l-xl",
                isActive
                  ? "text-primary font-semibold"
                  : "text-text-muted hover:text-text-main hover:bg-primary/5 dark:hover:bg-primary/10",
              )}
              to={item.href}
            >
              {isActive && (
                <>
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-primary/5 dark:bg-primary/10 rounded-lg z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-full z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                </>
              )}
              <span className="relative z-10 mr-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity [&>svg]:w-4 [&>svg]:h-4">
                {item.icon}
              </span>
              <span className="relative z-10 truncate">{item.title}</span>
            </Link>

            {/* Subtree toggle */}
            <button
              aria-label={isExpanded ? "Collapse" : "Expand"}
              className={clsx(
                "relative z-10 flex items-center justify-center w-8 py-1 shrink-0 transition-all duration-300 rounded-r-xl",
                isActive
                  ? "text-primary hover:bg-primary/10"
                  : "text-text-muted hover:text-text-main hover:bg-primary/5 dark:hover:bg-primary/10",
              )}
              onClick={() => toggleSubMenu(item.href)}
            >
              <IoChevronForwardOutline className={clsx("w-3 h-3 transition-transform duration-300", isExpanded && "rotate-90")} />
            </button>
          </div>
        ) : (
          <Link className={itemBase} to={item.href}>
            {isActive && (
              <>
                <motion.div
                  layoutId="active-nav-bg"
                  className="absolute inset-0 bg-primary/5 dark:bg-primary/10 rounded-lg z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              </>
            )}
            <span className="relative z-10 mr-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity [&>svg]:w-4 [&>svg]:h-4">
              {item.icon}
            </span>
            <span className="relative z-10 truncate">{item.title}</span>
          </Link>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-5 mt-1 space-y-0.5 mb-1 border-l-2 border-primary/10 dark:border-primary/5 pl-2">
            {item.children.map((child) => renderNavItem(child, level + 1))}
          </div>
        )}
      </motion.div>
    );
  };

  const toggleSidebar = () => setIsSidebarOpen((v) => !v);

  const formatRole = (role?: string): string => {
    if (!role) return "User";
    const map: Record<string, string> = {
      "system-owner": "System Owner",
      "clinic-admin": "Clinic Admin",
      doctor: "Doctor",
      nurse: "Nurse",
      receptionist: "Receptionist",
      staff: "Staff",
      "front-office": "Front Office",
    };

    return (
      map[role] ??
      role.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* ── Top header ──────────────────────────────────────────────────── */}
      <DashboardHeader
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div className="flex flex-1 pt-14">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside
          aria-label="Sidebar navigation"
          className={clsx(
            "fixed inset-y-0 top-14 left-0 z-20 w-[240px]",
            "transition-all duration-300 ease-in-out",
            "bg-surface/80 backdrop-blur-xl border-r border-border-base flex flex-col print:hidden",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ height: "calc(100vh - 3.5rem)" }}
        >


          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950">
            {loading ? (
              // Skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 animate-pulse"
                >
                  <div className="w-3.5 h-3.5 rounded bg-zinc-700" />
                  <div
                    className="h-3 rounded bg-zinc-700 flex-1"
                    style={{ width: `${50 + ((i * 13) % 40)}%` }}
                  />
                </div>
              ))
            ) : error ? (
              <div className="text-center py-4">
                <IoWarningOutline className="w-4 h-4 mx-auto mb-1.5 text-red-400" />
                <p className="text-[11px] text-zinc-500">Navigation failed</p>
                <button
                  className="text-[11px] text-teal-400 hover:underline mt-1"
                  onClick={refreshNavigation}
                >
                  Retry
                </button>
              </div>
            ) : navItems.length > 0 ? (
              (() => {
                const categories: ("MAIN" | "CLINICAL" | "OPERATIONS" | "ADMIN")[] = [
                  "MAIN",
                  "CLINICAL",
                  "OPERATIONS",
                  "ADMIN",
                ];

                return categories.map((cat) => {
                  const items = navItems.filter((i) => i.category === cat);

                  if (items.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-0.5">
                      {cat !== "MAIN" && (
                        <div className="px-4 pt-1.5 pb-0 text-[12px] font-bold text-primary/70 uppercase tracking-[0.1em]">
                          {cat}
                        </div>
                      )}
                      <div className="px-2 space-y-0.5">
                        {items.map((item) => renderNavItem(item))}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              renderNavItem({
                title: "Dashboard",
                href: "/dashboard",
                icon: <IoAppsOutline />,
                children: [],
                category: "MAIN",
              })
            )}
          </nav>

          {/* Bottom action */}
          <div className="px-4 py-3 shrink-0 border-t border-border-base bg-surface-2/30 flex gap-2">
            <Button
              className="flex-1 text-[13.5px] h-[32px] text-text-muted hover:bg-surface-3 hover:text-primary transition-all duration-200"
              color="default"
              size="sm"
              startContent={<IoHeadsetOutline className="w-4 h-4" />}
              variant="light"
            >
              Support
            </Button>
            <Button
              isIconOnly
              aria-label="Refresh navigation"
              className="text-text-muted hover:bg-surface-3 hover:text-primary h-[32px] w-[32px] min-w-0"
              disabled={loading}
              title="Refresh navigation"
              variant="light"
              onClick={refreshNavigation}
            >
              <IoRefreshOutline
                className={clsx("w-3.5 h-3.5", loading && "animate-spin")}
              />
            </Button>
          </div>
        </aside>


        <main
          className={clsx(
            "flex-1 w-full flex flex-col items-start justify-start transition-all duration-300 ease-in-out overflow-hidden relative",
            "bg-bg mesh-gradient",
            isSidebarOpen ? "md:pl-[240px]" : "",
          )}
          style={{ height: "calc(100vh - 3.5rem)" }}
        >
          {/* Content well with subtle mesh gradient */}
          <div
            className="w-full h-full overflow-auto print:p-0 cv-auto will-scroll relative z-10"
            id="dashboard-scroll-container"
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="w-full px-4 py-3 pb-10 min-h-full"
              initial={{ opacity: 0, y: 10 }}
              key={location.pathname}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </main>

        {/* ── Mobile overlay ────────────────────────────────────────────── */}
        {isSidebarOpen && (
          <div
            aria-hidden
            className="fixed inset-0 z-10 bg-black/30 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* ── Mobile FAB toggle ────────────────────────────────────────── */}
        <Button
          isIconOnly
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="fixed bottom-5 right-5 z-30 md:hidden w-9 h-9"
          color="primary"
          radius="full"
          size="sm"
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? (
            <IoCloseOutline className="w-5 h-5" />
          ) : (
            <IoMenuOutline className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
