import React, { createContext, useContext } from "react";
import { User as FirebaseUser } from "firebase/auth";

import { useAuth } from "../hooks/useAuth";
import { User } from "../types/models";

// Extended user type that includes Firebase user and our custom user data
interface ExtendedUser extends FirebaseUser {
  clinicId?: string;
  role?: string;
  isActive?: boolean;
  userData?: User;
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  userData: User | null;
  clinicId: string | null;
  branchId: string | null;
  isLoading: boolean;
  subscriptionValid: boolean | null;
  subscriptionLastChecked: number | null;
  permissionsReady: boolean;
  register: (email: string, password: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  isClinicAdmin: () => boolean;
  isSystemOwner: () => boolean;
  hasPermission: (permission: string) => boolean;
  hasPagePermission: (pageId: string) => Promise<boolean>;
  hasPagePermissionSync: (pageId: string) => boolean | null;
  hasPagePermissionByPath: (pagePath: string) => Promise<boolean>;
  preloadPermissions: () => Promise<void>;
  getAccessiblePages: () => Promise<any[]>;
  checkClinicSubscription: () => Promise<boolean>;
  updateProfileInfo: (data: {
    displayName?: string;
    phone?: string;
    photoURL?: string;
  }) => Promise<{ success: boolean }>;
  updateEmailInfo: (
    newEmail: string,
    currentPassword: string,
  ) => Promise<{ success: boolean; pendingVerification?: boolean }>;
}

// Create context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps your app and makes auth object available to any child component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  // Map the useAuth return values to match the AuthContextType interface
  const contextValue: AuthContextType = {
    currentUser: auth.currentUser,
    userData: auth.userData,
    clinicId: auth.clinicId,
    branchId: auth.userData?.branchId || null,
    isLoading: auth.isLoading,
    subscriptionValid: (auth as any).subscriptionValid ?? null,
    subscriptionLastChecked: (auth as any).subscriptionLastChecked ?? null,
    permissionsReady: (auth as any).permissionsReady ?? false,
    register: auth.register,
    login: auth.login,
    logout: auth.logout,
    isClinicAdmin: auth.isClinicAdmin,
    isSystemOwner: auth.isSystemOwner,
    hasPagePermission: auth.hasPagePermission,
    hasPagePermissionSync: (auth as any).hasPagePermissionSync,
    hasPagePermissionByPath: auth.hasPagePermissionByPath,
    preloadPermissions: auth.preloadPermissions,
    getAccessiblePages: auth.getAccessiblePages,
    checkClinicSubscription: auth.checkClinicSubscription,
    updateProfileInfo: auth.updateProfileInfo,
    updateEmailInfo: (auth as any).updateEmailInfo,
    // Add a hasPermission method that uses hasPagePermission for backward compatibility
    hasPermission: (permission: string) => {
      // For now, treat permission as a pageId and use hasPagePermission
      // This is a synchronous wrapper around the async hasPagePermission
      // Note: This might not work perfectly for all cases since hasPagePermission is async
      console.warn(
        "hasPermission is deprecated, use hasPagePermission instead",
      );

      return auth.userData?.role === "system-owner" || false; // Return true for super admin, false otherwise
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}
