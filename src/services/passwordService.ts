import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  confirmPasswordReset,
  verifyPasswordResetCode,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, actionCodeSettings } from "../config/firebase";

/**
 * Service for managing password updates
 */
export const passwordService = {
  /**
   * Update user password with proper validation
   * @param {string} currentPassword - Current password for re-authentication
   * @param {string} newPassword - New password to set
   * @returns {Promise<void>}
   */
  async updatePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const user = auth.currentUser;

      if (!user || !user.email) {
        throw new Error("No authenticated user found");
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );

      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  },

  /**
   * Update password using reset code (for password reset flow)
   * @param {string} oobCode - Password reset code from email
   * @param {string} newPassword - New password to set
   * @returns {Promise<void>}
   */
  async updatePasswordWithResetCode(
    oobCode: string,
    newPassword: string,
  ): Promise<void> {
    try {
      // Verify the reset code first to get the email
      const email = await verifyPasswordResetCode(auth, oobCode);

      console.log(`🔄 Password reset initiated for email: ${email}`);

      // Confirm password reset
      await confirmPasswordReset(auth, oobCode, newPassword);
      console.log(`✅ Password reset completed for: ${email}`);
    } catch (error) {
      console.error("Error updating password with reset code:", error);
      throw error;
    }
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result with isValid and message
   */
  validatePassword(password: string): { isValid: boolean; message: string } {
    if (password.length < 8) {
      return {
        isValid: false,
        message: "Password must be at least 8 characters long",
      };
    }

    if (!/(?=.*[a-z])/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one lowercase letter",
      };
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one uppercase letter",
      };
    }

    if (!/(?=.*\d)/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one number",
      };
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return {
        isValid: false,
        message:
          "Password must contain at least one special character (@$!%*?&)",
      };
    }

    return { isValid: true, message: "Password is strong" };
  },

  /**
   * Check if passwords match
   * @param {string} password - Password
   * @param {string} confirmPassword - Confirmation password
   * @returns {boolean} - Whether passwords match
   */
  passwordsMatch(password: string, confirmPassword: string): boolean {
    return password === confirmPassword;
  },

  /**
   * Send password reset email with custom action code settings
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  },
};
