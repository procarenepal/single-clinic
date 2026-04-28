import { signOut } from "firebase/auth";
import { addToast } from "@heroui/toast";

import { clinicService } from "./clinicService";

import { auth } from "@/config/firebase";

class SubscriptionMonitorService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private clinicId: string | null = null;
  private userRole: string | null = null;

  /**
   * Start monitoring subscription status for the current user
   * @param clinicId The clinic ID to monitor
   * @param userRole The user role
   */
  startMonitoring(clinicId: string, userRole: string) {
    // Don't monitor super admins or during impersonation
    const isImpersonating = localStorage.getItem("isImpersonating") === "true";

    if (userRole === "system-owner" || isImpersonating) {
      return;
    }

    // Stop any existing monitoring
    this.stopMonitoring();

    this.clinicId = clinicId;
    this.userRole = userRole;
    this.isMonitoring = true;

    // Check immediately
    this.performSubscriptionCheck();

    // Set up periodic checks every 30 seconds for more responsive monitoring
    this.checkInterval = setInterval(() => {
      this.performSubscriptionCheck();
    }, 30 * 1000); // Check every 30 seconds

    console.log("🔄 Started subscription monitoring for clinic:", clinicId);
  }

  /**
   * Stop monitoring subscription status
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    this.clinicId = null;
    this.userRole = null;
    console.log("⏹️ Stopped subscription monitoring");
  }

  /**
   * Perform the actual subscription check
   */
  private async performSubscriptionCheck() {
    // Skip checks during impersonation
    const isImpersonating = localStorage.getItem("isImpersonating") === "true";

    if (
      !this.isMonitoring ||
      !this.clinicId ||
      this.userRole === "system-owner" ||
      isImpersonating
    ) {
      return;
    }

    try {
      const clinic = await clinicService.getClinicById(this.clinicId);

      if (!clinic) {
        console.warn("❌ Clinic not found during subscription check");

        return;
      }

      // Check if subscription is suspended, cancelled or expired
      const isSubscriptionSuspended = clinic.subscriptionStatus === "suspended";
      const isSubscriptionCancelled = clinic.subscriptionStatus === "cancelled";
      const isSubscriptionExpired =
        clinic.subscriptionEndDate &&
        new Date(clinic.subscriptionEndDate) < new Date();

      if (
        isSubscriptionSuspended ||
        isSubscriptionCancelled ||
        isSubscriptionExpired
      ) {
        console.warn("🚫 Subscription issue detected:", {
          status: clinic.subscriptionStatus,
          endDate: clinic.subscriptionEndDate,
          suspended: isSubscriptionSuspended,
          cancelled: isSubscriptionCancelled,
          expired: isSubscriptionExpired,
        });

        // Stop monitoring first
        this.stopMonitoring();

        // Show appropriate message
        let message =
          "Your session has been terminated due to subscription changes.";

        if (isSubscriptionSuspended) {
          message =
            "Your clinic's subscription has been suspended. You have been logged out.";
        } else if (isSubscriptionCancelled) {
          message =
            "Your clinic's subscription has been cancelled. You have been logged out.";
        } else if (isSubscriptionExpired) {
          message =
            "Your clinic's subscription has expired. You have been logged out.";
        }

        // Show toast notification
        addToast({
          title: "Access Revoked",
          description: message,
          color: "danger",
        });

        // Wait a moment for the toast to show, then sign out
        setTimeout(async () => {
          try {
            await signOut(auth);
            // Redirect to login with error message
            window.location.href = "/login?reason=subscription";
          } catch (error) {
            console.error("Error signing out after subscription check:", error);
            // Force reload if signOut fails
            window.location.reload();
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error in subscription check:", error);
      // Don't logout on technical errors, just log them
    }
  }

  /**
   * Force an immediate subscription check
   */
  async forceCheck(): Promise<boolean> {
    if (!this.clinicId || this.userRole === "system-owner") {
      return true;
    }

    try {
      const clinic = await clinicService.getClinicById(this.clinicId);

      if (!clinic) {
        return false;
      }

      const isSubscriptionSuspended = clinic.subscriptionStatus === "suspended";
      const isSubscriptionCancelled = clinic.subscriptionStatus === "cancelled";
      const isSubscriptionExpired =
        clinic.subscriptionEndDate &&
        new Date(clinic.subscriptionEndDate) < new Date();

      return (
        !isSubscriptionSuspended &&
        !isSubscriptionCancelled &&
        !isSubscriptionExpired
      );
    } catch (error) {
      console.error("Error in force subscription check:", error);

      return true; // Default to allowing access on error
    }
  }

  /**
   * Check if monitoring is currently active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

// Export a singleton instance
export const subscriptionMonitorService = new SubscriptionMonitorService();
