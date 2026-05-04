// src/services/navigationService.tsx
import {
  IoGridOutline,
} from "react-icons/io5";
import * as Icons from "react-icons/io5";
import React from "react";

import { cacheService } from "./cacheService";
import { pageService } from "./pageService";
import { rbacService } from "./rbacService";
import { clinicService } from "./clinicService";
import { appointmentBillingService } from "./appointmentBillingService";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  children: NavItem[];
  category?: "MAIN" | "CLINICAL" | "OPERATIONS" | "ADMIN";
}

export interface NavigationResult {
  navItems: NavItem[];
  etag: string;
  fromCache: boolean;
}

class NavigationService {
  /**
   * Helper to assign categories based on title
   */
  private assignCategory(title: string): NavItem["category"] {
    const CORE = [
      "Dashboard",
      "Patients",
      "Appointments",
      "Prescriptions",
      "Enquiry Management",
      "Enquiries",
    ];
    const CLINICAL = [
      "Doctors",
      "Experts",
      "Medicine",
      "Medicine Management",
      "Bed Management",
      "Pharmacy",
      "Pathology",
    ];
    const OPERATIONS = [
      "Communication",
      "Billing",
      "Appointment Billing",
      "Front Office",
    ];

    if (CORE.includes(title)) return "MAIN";
    if (CLINICAL.includes(title)) return "CLINICAL";
    if (OPERATIONS.includes(title)) return "OPERATIONS";

    return "ADMIN";
  }

  /**
   * Dynamic icon renderer
   */
  private renderIcon(iconName?: string): React.ReactNode {
    const className = "w-5 h-5";

    // Mapping for more premium icons
    const iconMapping: Record<string, string> = {
      IoGridOutline: "IoAppsOutline",
      IoPeopleOutline: "IoPeopleCircleOutline",
      IoCalendarOutline: "IoCalendarClearOutline",
      IoDocumentTextOutline: "IoDocumentAttachOutline",
      IoChatboxEllipsesOutline: "IoChatbubbleEllipsesOutline",
    };

    const resolvedIconName =
      iconName && iconMapping[iconName] ? iconMapping[iconName] : iconName;

    if (!resolvedIconName)
      return <Icons.IoAppsOutline className={className} />;

    // Resolve icon component dynamically from Ionicons by key
    const iconsRegistry = Icons as unknown as Record<
      string,
      React.ComponentType<{ className?: string }>
    >;
    const IconComponent = iconsRegistry[resolvedIconName];

    if (IconComponent) {
      return <IconComponent className={className} />;
    }

    return <Icons.IoAppsOutline className={className} />;
  }

  /**
   * Build navigation items for administrators (System Owner / Clinic Admin)
   */
  private async buildAdminNavigation(
    clinicId: string,
    role: string,
  ): Promise<NavItem[]> {
    const items: NavItem[] = [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: <Icons.IoAppsOutline className="w-5 h-5" />,
        children: [],
      },
    ];

    // Get pages assigned to the system
    let availablePages = [];

    if (role === "system-owner") {
      availablePages = await pageService.getAllPages();
    } else {
      availablePages = await rbacService.getAvailablePagesForClinic(clinicId);
    }

    if (availablePages.length > 0) {
      // Filter and add parent pages
      availablePages.forEach((page) => {
        if (
          page.path !== "/dashboard" &&
          !page.parentId
        ) {
          // Filter children
          const accessibleChildren = availablePages
            .filter(
              (child) =>
                child.parentId === page.id && child.showInSidebar !== false,
            )
            .map((child) => ({
              title: child.name,
              href: child.path,
              icon: this.renderIcon(child.icon),
              children: [],
            }));

          items.push({
            title: page.name,
            href: page.path,
            icon: this.renderIcon(page.icon),
            children: accessibleChildren,
          });
        }
      });
    }

    // Assign categories
    items.forEach((item) => {
      item.category = this.assignCategory(item.title);
    });

    // Sort items according to preferred feature layout
    const targetOrder = [
      "Dashboard",
      "Patients",
      "Appointments",
      "Prescriptions",
      "Doctors",
      "Experts",
      "Medicine",
      "Medicine Management",
      "Bed Management",
      "Pharmacy",
      "Pathology",
      "Communication",
      "Billing",
      "Appointment Billing",
      "Front Office",
      "Reports",
      "Inventory",
      "Text Editor",
      "Settings",
      "Enquiry Management",
      "Enquiries",
    ];

    items.sort((a, b) => {
      let idxA = targetOrder.indexOf(a.title);
      let idxB = targetOrder.indexOf(b.title);

      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;

      return a.title.localeCompare(b.title);
    });

    return items;
  }

  /**
   * Build navigation items for regular users
   */
  private async buildRegularUserNavigation(
    userId: string,
    clinicId: string,
  ): Promise<NavItem[]> {
    const items: NavItem[] = [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: <Icons.IoAppsOutline className="w-5 h-5" />,
        children: [],
      },
    ];

    // Get accessible pages through RBAC
    const userAccessiblePages = await rbacService.getAccessiblePagesForUser(
      userId,
      clinicId,
    );

    // Also get all clinic type pages for comparison
    const allClinicTypePages =
      await rbacService.getAvailablePagesForClinic(clinicId);

    // Check billing settings to filter billing-related pages
    let isBillingEnabled = false;

    try {
      const billingSettings =
        await appointmentBillingService.getBillingSettings(clinicId);

      isBillingEnabled =
        billingSettings &&
        billingSettings.enabledByAdmin &&
        billingSettings.isActive;
    } catch (error) {
      console.error("Error checking billing settings:", error);
      isBillingEnabled = false;
    }

    if (userAccessiblePages.length > 0) {
      // Filter and add parent pages that the user has access to
      userAccessiblePages.forEach((page) => {
        if (
          page.path !== "/dashboard" &&
          !page.parentId
        ) {
          // Filter out billing-related pages if billing is disabled
          if (!isBillingEnabled && this.isBillingRelatedPage(page.path)) {
            return;
          }

          // Filter children
          const accessibleChildren = userAccessiblePages
            .filter((child) => {
              if (child.parentId !== page.id || child.showInSidebar === false) {
                return false;
              }
              if (!isBillingEnabled && this.isBillingRelatedPage(child.path)) {
                return false;
              }

              return true;
            })
            .map((child) => ({
              title: child.name,
              href: child.path,
              icon: this.renderIcon(child.icon),
              children: [],
            }));

          items.push({
            title: page.name,
            href: page.path,
            icon: this.renderIcon(page.icon),
            children: accessibleChildren,
          });
        }
      });
    }

    // Sort items according to preferred feature layout
    const targetOrder = [
      "Dashboard",
      "Patients",
      "Appointments",
      "Prescriptions",
      "Doctors",
      "Experts",
      "Medicine",
      "Medicine Management",
      "Bed Management",
      "Pharmacy",
      "Pathology",
      "Communication",
      "Billing",
      "Appointment Billing",
      "Front Office",
      "Reports",
      "Inventory",
      "Text Editor",
      "Settings",
      "Enquiry Management",
      "Enquiries",
    ];

    items.sort((a, b) => {
      let idxA = targetOrder.indexOf(a.title);
      let idxB = targetOrder.indexOf(b.title);

      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;

      return a.title.localeCompare(b.title);
    });

    // Assign categories
    items.forEach((item) => {
      item.category = this.assignCategory(item.title);
    });

    return items;
  }

  /**
   * Check if a page path is billing-related
   */
  private isBillingRelatedPage(path: string): boolean {
    const billingPaths = [
      "/dashboard/appointments-billing",
      "/dashboard/billing",
    ];

    return billingPaths.some(
      (billingPath) =>
        path === billingPath || path.startsWith(billingPath + "/"),
    );
  }

  /**
   * Get navigation items with ETag caching
   */
  async getNavigationItems(
    userId: string,
    clinicId: string,
    role: string,
    clientETag?: string,
  ): Promise<NavigationResult> {
    const cachedData = cacheService.getNavigationCache(userId, clinicId, role);

    if (cachedData && clientETag) {
      if (
        !cacheService.hasNavigationChanged(userId, clinicId, role, clientETag)
      ) {
        return {
          navItems: cachedData.navItems,
          etag: clientETag,
          fromCache: true,
        };
      }
    }

    let navItems: NavItem[] = [];
    let isMultiBranchEnabled = false;
    let isBillingEnabled = false;

    try {
      try {
        if (clinicId && clinicId !== "default") {
          const clinic = await clinicService.getClinicById(clinicId);
          isMultiBranchEnabled = clinic?.isMultiBranchEnabled || false;
        }
      } catch (error) {
        console.error("Error checking clinic multi-branch status:", error);
      }

      try {
        const billingSettings =
          await appointmentBillingService.getBillingSettings(clinicId);

        isBillingEnabled =
          billingSettings &&
          billingSettings.enabledByAdmin &&
          billingSettings.isActive;
      } catch (error) {
        console.error("Error checking billing settings for cache:", error);
      }

      switch (role) {
        case "system-owner":
        case "clinic-admin":
          navItems = await this.buildAdminNavigation(clinicId, role);
          break;

        default:
          navItems = await this.buildRegularUserNavigation(userId, clinicId);
          break;
      }
    } catch (error) {
      console.error("Error building navigation:", error);
      navItems = [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: <Icons.IoAppsOutline className="w-5 h-5" />,
          children: [],
          category: "MAIN",
        },
      ];
    }

    const cacheData = {
      navItems,
      userRole: role,
      clinicId,
      userId,
      isMultiBranchEnabled,
      isBillingEnabled,
    };

    const etag = cacheService.setNavigationCache(
      userId,
      clinicId,
      role,
      cacheData,
    );

    return {
      navItems,
      etag,
      fromCache: false,
    };
  }

  invalidateUserCache(userId: string, clinicId: string, role: string): void {
    cacheService.invalidateNavigationCache(userId, clinicId, role);
  }

  invalidateClinicCache(clinicId: string): void {
    cacheService.invalidateClinicNavigationCache(clinicId);
  }

  async refreshNavigation(
    userId: string,
    clinicId: string,
    role: string,
  ): Promise<NavigationResult> {
    this.invalidateUserCache(userId, clinicId, role);

    return this.getNavigationItems(userId, clinicId, role);
  }
}

export const navigationService = new NavigationService();
