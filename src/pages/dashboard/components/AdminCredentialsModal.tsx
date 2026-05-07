import React, { useState } from "react";
import {
  IoKeyOutline,
  IoMailOutline,
  IoLockClosedOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { passwordService } from "@/services/passwordService";

interface AdminCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminCredentialsModal: React.FC<AdminCredentialsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, updateEmailInfo } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "password">("email");

  // Email form state
  const [newEmail, setNewEmail] = useState(currentUser?.email || "");
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (newEmail === currentUser.email) {
      setError("New email is the same as the current one.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateEmailInfo(newEmail, emailConfirmPassword);
      
      if (result.pendingVerification) {
        addToast({
          title: "Verification Email Sent",
          description: `A verification link has been sent to ${newEmail}. Please click it to finalize the change.`,
          color: "primary",
        });
      } else {
        addToast({
          title: "Email Updated",
          description: "Your login email has been updated successfully. Use it for your next login.",
          color: "success",
        });
      }
      setEmailConfirmPassword("");
      onClose();
    } catch (err: any) {
      console.error("Email update failed:", err);
      setError(err.message || "Failed to update email. Please check your password.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      await passwordService.updatePassword(currentPassword, newPassword);
      addToast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
        color: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      console.error("Password update failed:", err);
      setError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setError(null);
    setEmailConfirmPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Modal isOpen={isOpen} size="md" onClose={() => { resetForm(); onClose(); }}>
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <IoShieldCheckmarkOutline className="w-5 h-5 text-primary" />
            <span>Admin Credentials</span>
          </div>
        </ModalHeader>
        <ModalBody className="py-6">
          {/* Tabs */}
          <div className="flex border-b border-border-base mb-6">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "email"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-main"
              }`}
              onClick={() => { setActiveTab("email"); setError(null); }}
            >
              Change Username (Email)
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "password"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-main"
              }`}
              onClick={() => { setActiveTab("password"); setError(null); }}
            >
              Change Password
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {activeTab === "email" ? (
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="p-4 bg-mountain-50 dark:bg-zinc-900/50 rounded-lg mb-2">
                <p className="text-xs text-mountain-600 dark:text-zinc-400">
                  Changing your email address will update your login username. You will need to verify the new email address before the change is finalized.
                </p>
              </div>
              <Input
                fullWidth
                isRequired
                label="New Email Address"
                placeholder="new.email@example.com"
                startContent={<IoMailOutline className="text-mountain-400" />}
                type="email"
                value={newEmail}
                onValueChange={setNewEmail}
              />
              <Input
                fullWidth
                isRequired
                endContent={
                  <button
                    className="hover:text-mountain-600 transition-colors"
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <IoEyeOffOutline /> : <IoEyeOutline />}
                  </button>
                }
                label="Confirm with Password"
                placeholder="Enter your current password"
                startContent={<IoLockClosedOutline className="text-mountain-400" />}
                type={showPasswords ? "text" : "password"}
                value={emailConfirmPassword}
                onValueChange={setEmailConfirmPassword}
              />
              <div className="pt-2">
                <Button
                  className="w-full"
                  color="primary"
                  isLoading={loading}
                  type="submit"
                >
                  Update Username
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <Input
                fullWidth
                isRequired
                label="Current Password"
                placeholder="Enter current password"
                startContent={<IoLockClosedOutline className="text-mountain-400" />}
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onValueChange={setCurrentPassword}
              />
              <Divider />
              <Input
                fullWidth
                isRequired
                endContent={
                  <button
                    className="hover:text-mountain-600 transition-colors"
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <IoEyeOffOutline /> : <IoEyeOutline />}
                  </button>
                }
                label="New Password"
                placeholder="Minimum 8 characters"
                startContent={<IoKeyOutline className="text-mountain-400" />}
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onValueChange={setNewPassword}
              />
              <Input
                fullWidth
                isRequired
                label="Confirm New Password"
                placeholder="Re-enter new password"
                startContent={<IoKeyOutline className="text-mountain-400" />}
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onValueChange={setConfirmPassword}
              />
              <div className="pt-2">
                <Button
                  className="w-full"
                  color="primary"
                  isLoading={loading}
                  type="submit"
                >
                  Update Password
                </Button>
              </div>
            </form>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const Divider = () => <div className="h-px bg-border-base my-2" />;
