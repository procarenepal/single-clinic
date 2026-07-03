import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  IoGridOutline,
  IoBusinessOutline,
  IoCashOutline,
  IoSettingsOutline,
  IoCloseOutline,
  IoMenuOutline,
  IoAlertCircleOutline,
  IoChevronDownOutline,
} from "react-icons/io5";

import { Button, Avatar } from "@/components/ui";
import { useAuthContext } from "@/context/AuthContext";
import { AdminHeader } from "@/components/admin-header";
import { DeletionProgressIndicator } from "@/components/DeletionProgressIndicator";
import { prefetchChunks } from "@/utils/prefetchRoutes";

// Sidebar navigation item interface
interface NavItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
  submenu?: {
    title: string;
    href: string;
  }[];
}

// Admin sidebar navigation items
const adminSidebarNavItems: NavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: <IoGridOutline className="w-5 h-5" />,
  },
  {
    title: "Clinics",
    href: "#",
    icon: <IoBusinessOutline className="w-5 h-5" />,
    submenu: [
      {
        title: "All Clinics",
        href: "/admin/clinics",
      },
      {
        title: "Clinic Types",
        href: "/admin/clinic-types",
      },
      {
        title: "Impersonation",
        href: "/admin/clinics/impersonation",
      },
    ],
  },
  {
    title: "Subscriptions",
    href: "/admin/subscriptions",
    icon: <IoCashOutline className="w-5 h-5" />,
  },
  {
    title: "System Settings",
    href: "#",
    icon: <IoSettingsOutline className="w-5 h-5" />,
    submenu: [
      {
        title: "Pages Management",
        href: "/admin/system/pages",
      },
    ],
  },
];

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentUser } = useAuthContext();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  // Toggle submenu
  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prefetch common admin sections
  useEffect(() => {
    prefetchChunks([
      {
        path: "/admin/clinics",
        importChunk: () => import("@/pages/admin/clinics/index"),
      },
      {
        path: "/admin/subscriptions",
        importChunk: () => import("@/pages/admin/subscriptions/index"),
      },
    ]);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-mountain-950 transition-colors duration-200">
      {/* Platform Admin Header */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div className="flex flex-1 pt-12">
        {/* Sidebar */}
        <aside
          aria-label="Admin sidebar navigation"
          className={clsx(
            "fixed inset-y-0 top-12 left-0 z-20 w-[220px]",
            "border-r border-mountain-200 dark:border-mountain-800 transition-transform duration-200 ease-out overflow-y-auto",
            "bg-white dark:bg-mountain-900 flex flex-col print:hidden",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ height: "calc(100vh - 3rem)" }}
        >
          {/* User identity strip */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-mountain-100 dark:border-mountain-800 shrink-0">
            {currentUser && (
              <>
                <Avatar
                  className="shrink-0 ring-2 ring-mountain-100 dark:ring-mountain-700"
                  color="primary"
                  name={
                    currentUser.displayName ||
                    currentUser.email?.split("@")[0] ||
                    "Admin"
                  }
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold truncate leading-tight text-mountain-900 dark:text-mountain-100">
                    {currentUser.displayName ||
                      currentUser.email?.split("@")[0] ||
                      "Admin"}
                  </p>
                  <p className="text-[10px] truncate text-mountain-400 dark:text-mountain-500">
                    Super Administrator
                  </p>
                </div>
              </>
            )}
          </div>

          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
            {adminSidebarNavItems.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "#" &&
                  location.pathname.startsWith(item.href)) ||
                (item.submenu &&
                  item.submenu.some(
                    (submenuItem) =>
                      location.pathname === submenuItem.href ||
                      location.pathname.startsWith(submenuItem.href),
                  ));

              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isSubmenuOpen = openSubmenu === item.title;

              return (
                <div key={item.title}>
                  {/* Main menu item */}
                  {hasSubmenu ? (
                    <button
                      className={clsx(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[12px] font-medium transition-colors duration-200",
                        isActive
                          ? "bg-teal-600/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400"
                          : "text-mountain-500 dark:text-mountain-300 hover:bg-mountain-50 dark:hover:bg-mountain-800 hover:text-mountain-900 dark:hover:text-mountain-100",
                      )}
                      onClick={() => toggleSubmenu(item.title)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={clsx(
                            "flex-shrink-0 w-4 h-4 flex items-center justify-center",
                            isActive
                              ? "text-teal-600 dark:text-teal-400"
                              : "text-mountain-400 dark:text-mountain-500",
                          )}
                        >
                          {item.icon}
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <IoChevronDownOutline
                        className={clsx(
                          "w-4 h-4 transition-transform",
                          isSubmenuOpen ? "rotate-180" : "",
                        )}
                      />
                    </button>
                  ) : (
                    <Link
                      className={clsx(
                        "flex items-center justify-between px-2.5 py-2 rounded-md text-[12px] font-medium transition-colors duration-200",
                        isActive
                          ? "bg-teal-600/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400"
                          : "text-mountain-500 dark:text-mountain-300 hover:bg-mountain-50 dark:hover:bg-mountain-800 hover:text-mountain-900 dark:hover:text-mountain-100",
                      )}
                      to={item.href}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={clsx(
                            "flex-shrink-0 w-4 h-4 flex items-center justify-center",
                            isActive
                              ? "text-teal-600 dark:text-teal-400"
                              : "text-mountain-400 dark:text-mountain-500",
                          )}
                        >
                          {item.icon}
                        </span>
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Submenu items */}
                  {hasSubmenu && isSubmenuOpen && (
                    <div className="mt-0.5 pl-7 space-y-0.5">
                      {item.submenu.map((subItem) => {
                        const isSubItemActive =
                          location.pathname === subItem.href ||
                          (subItem.href !== "/admin" &&
                            location.pathname.startsWith(subItem.href + "/"));

                        return (
                          <Link
                            key={subItem.href}
                            className={clsx(
                              "block px-2.5 py-1.5 rounded-md text-[11px] transition-colors duration-200",
                              isSubItemActive
                                ? "bg-teal-600/10 dark:bg-teal-600/15 text-teal-600 dark:text-teal-400 font-bold"
                                : "text-mountain-400 dark:text-mountain-400 hover:bg-mountain-50 dark:hover:bg-mountain-800 hover:text-mountain-900 dark:hover:text-mountain-200",
                            )}
                            to={subItem.href}
                          >
                            {subItem.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="px-2 py-2 shrink-0 border-t border-mountain-100 dark:border-mountain-800">
            <Link className="block" to="/admin/system-status">
              <Button
                fullWidth
                className="text-[11px] h-[26px] text-saffron-600 dark:text-saffron-400 hover:bg-mountain-50 dark:hover:bg-mountain-800 hover:text-saffron-700 dark:hover:text-saffron-300 transition-colors"
                color="warning"
                size="sm"
                startContent={<IoAlertCircleOutline className="w-3.5 h-3.5" />}
                variant="flat"
              >
                System Status
              </Button>
            </Link>
          </div>
        </aside>

        {/* Main content area */}
        <main
          className={clsx(
            "flex-1 transition-all duration-200 ease-out overflow-hidden",
            isSidebarOpen ? "md:pl-[220px]" : "",
          )}
          style={{ height: "calc(100vh - 3rem)" }}
        >
          <div
            className="h-full overflow-auto bg-slate-50 cv-auto will-scroll"
            id="admin-scroll-container"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 pb-10 min-h-full">
              <div className="mb-3">
                <DeletionProgressIndicator />
              </div>
              {children}
            </div>
          </div>
        </main>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div
            aria-hidden
            className="fixed inset-0 z-10 bg-black/30 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Mobile sidebar toggle button */}
        <Button
          isIconOnly
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="fixed bottom-5 right-5 z-30 md:hidden w-9 h-9"
          color="primary"
          radius="full"
          size="sm"
          variant="flat"
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
