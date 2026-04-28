// src/services/navigationService.tsx
import {
  IoGridOutline,
  IoStorefrontOutline,
  IoAddOutline,
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
}

export interface NavigationResult {
  navItems: NavItem[];
  etag: string;
  fromCache: boolean;
}

class NavigationService {
  /**
   * Dynamic icon renderer
   */
  private renderIcon(iconName?: string): React.ReactNode {
    const className = "w-5 h-5";

    if (!iconName) return <IoGridOutline className={className} />;

    // Resolve icon component dynamically from Ionicons by key
    const iconsRegistry = Icons as unknown as Record<
      string,
      React.ComponentType<{ className?: string }>
    >;
    const IconComponent = iconsRegistry[iconName];

    if (IconComponent) {
      return <IconComponent className={className} />;
    }

    return <IoGridOutline className={className} />;
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
        icon: <IoGridOutline className="w-5 h-5" />,
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
          page.showInSidebar !== false &&
          !page.parentId
        ) {
          // Filter children
          const accessibleChildren = availablePages
            .filter((child) => child.parentId === page.id && child.showInSidebar !== false)
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
        icon: <IoGridOutline className="w-5 h-5" />,
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
    const accessiblePageIds = new Set(userAccessiblePages.map((p) => p.id));
    const missingPages = allClinicTypePages.filter(
      (p) => !accessiblePageIds.has(p.id),
    );

    console.log(
      "[Navigation] Regular User - Total accessible pages:",
      userAccessiblePages.length,
    );
    console.log(
      "[Navigation] Regular User - Accessible page URLs:",
      userAccessiblePages.map((p) => p.path),
    );
    console.log(
      "[Navigation] Regular User - Total clinic type pages:",
      allClinicTypePages.length,
    );
    console.log(
      "[Navigation] Regular User - Clinic type page URLs:",
      allClinicTypePages.map((p) => p.path),
    );
    console.log(
      "[Navigation] Regular User - Missing pages (not in accessible list):",
      missingPages.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        showInSidebar: p.showInSidebar,
      })),
    );
    console.log(
      "[Navigation] Regular User - Pages:",
      userAccessiblePages.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        showInSidebar: p.showInSidebar,
        parentId: p.parentId,
      })),
    );

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
      // Default to false if there's an error
      isBillingEnabled = false;
    }

    if (userAccessiblePages.length > 0) {
      // Create a map for quick lookup
      const accessiblePagesMap = new Map(
        userAccessiblePages.map((page) => [page.id, page]),
      );

      let addedCount = 0;
      let skippedCount = 0;

      // Filter and add parent pages that the user has access to
      userAccessiblePages.forEach((page) => {
        // Skip dashboard as it's already added
        if (
          page.path !== "/dashboard" &&
          page.showInSidebar !== false &&
          !page.parentId
        ) {
          // Filter out billing-related pages if billing is disabled
          if (!isBillingEnabled && this.isBillingRelatedPage(page.path)) {
            skippedCount++;
            console.log(
              "[Navigation] Skipping billing page:",
              page.name,
              page.path,
            );

            return; // Skip this page
          }

          // Filter children to only include accessible ones and non-billing pages if billing is disabled
          const accessibleChildren = userAccessiblePages
            .filter((child) => {
              if (child.parentId !== page.id || child.showInSidebar === false) {
                return false;
              }
              // Filter out billing-related child pages if billing is disabled
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
          addedCount++;
          console.log(
            "[Navigation] Added page to sidebar:",
            page.name,
            page.path,
          );
        } else {
          skippedCount++;
          const reason =
            page.path === "/dashboard"
              ? "dashboard"
              : page.showInSidebar === false
                ? "showInSidebar=false"
                : page.parentId
                  ? `parentId=${page.parentId}`
                  : "unknown";

          console.log(
            "[Navigation] Skipped page:",
            page.name,
            page.path,
            `reason: ${reason}`,
          );
        }
      });

      console.log(
        "[Navigation] Regular User - Added pages:",
        addedCount,
        "Skipped:",
        skippedCount,
      );

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

    return items;
  }

  /**
   * Check if a page path is billing-related
   */
  private isBillingRelatedPage(path: string): boolean {
    const billingPaths = [
      "/dashboard/appointments-billing",
      "/dashboard/billing", // in case there are other billing pages
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
    // Check cache first
    const cachedData = cacheService.getNavigationCache(userId, clinicId, role);

    if (cachedData && clientETag) {
      // Check if client has the latest version
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

    // Cache miss or data changed, build fresh navigation
    let navItems: NavItem[] = [];
    let isMultiBranchEnabled = false;
    let isBillingEnabled = false;

    try {
      // Check clinic settings for caching
      try {
        if (clinicId && clinicId !== "default") {
          const clinic = await clinicService.getClinicById(clinicId);
          isMultiBranchEnabled = clinic?.isMultiBranchEnabled || false;
        }
      } catch (error) {
        console.error("Error checking clinic multi-branch status:", error);
      }

      // Check billing settings for caching
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
      // Fallback to default dashboard
      navItems = [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: <IoGridOutline className="w-5 h-5" />,
          children: [],
        },
      ];
    }

    // Cache the result
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

  /**
   * Invalidate navigation cache for a user
   */
  invalidateUserCache(userId: string, clinicId: string, role: string): void {
    cacheService.invalidateNavigationCache(userId, clinicId, role);
  }

  /**
   * Invalidate navigation cache for all users in a clinic
   */
  invalidateClinicCache(clinicId: string): void {
    cacheService.invalidateClinicNavigationCache(clinicId);
  }

  /**
   * Force refresh navigation (bypass cache)
   */
  async refreshNavigation(
    userId: string,
    clinicId: string,
    role: string,
  ): Promise<NavigationResult> {
    // Clear existing cache
    this.invalidateUserCache(userId, clinicId, role);

    // Build fresh navigation
    return this.getNavigationItems(userId, clinicId, role);
  }
}

// Export singleton instance
export const navigationService = new NavigationService();
