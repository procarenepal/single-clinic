/**
 * Admin Header — Platform admin topbar only.
 * Distinct from DashboardHeader (clinic users). No patient/doctor search.
 */
import { useNavigate, Link } from "react-router-dom";
import {
  IoMenuOutline,
  IoGridOutline,
  IoLogOutOutline,
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoChevronDownOutline,
  IoAppsOutline,
  IoKeyOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button, Avatar } from "@/components/ui";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@/components/ui/dropdown";
import { useDisclosure } from "@/components/ui/modal";
import { ChangePasswordModal } from "@/pages/dashboard/components/ChangePasswordModal";
import { addToast } from "@/components/ui/toast";

export interface AdminHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const AdminHeader = ({
  isSidebarOpen,
  toggleSidebar,
}: AdminHeaderProps) => {
  const { currentUser, logout } = useAuthContext();
  const navigate = useNavigate();
  const {
    isOpen: isPasswordModalOpen,
    onOpen: onPasswordModalOpen,
    onClose: onPasswordModalClose,
  } = useDisclosure();

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

  const displayName =
    currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin";

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-12 bg-white dark:bg-mountain-950 border-b border-mountain-200 dark:border-mountain-800 flex items-center px-4 gap-3 print:hidden transition-colors duration-200">
      {/* Left: toggle + logo + admin badge */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          isIconOnly
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="text-mountain-500 dark:text-mountain-300 bg-mountain-50 dark:bg-mountain-900/50 hover:bg-mountain-100 dark:hover:bg-mountain-800 transition-colors border-transparent"
          color="default"
          radius="sm"
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
          className="flex items-center gap-2 text-mountain-900 dark:text-mountain-100 no-underline hover:text-teal-600 dark:hover:text-white transition-colors"
          to="/admin"
        >
          <div className="w-6 h-6 rounded bg-teal-600 flex items-center justify-center shrink-0">
            <img
              alt="logo"
              className="w-4 h-4 object-contain"
              src="/logo.png"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
          <span className="font-bold text-[13px] hidden sm:block leading-none text-mountain-900 dark:text-mountain-100">
            HSC
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-teal-600/90 text-teal-100 border border-teal-500/30">
            Admin
          </span>
        </Link>
      </div>

      {/* Right: actions + user */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <ThemeSwitch />

        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <button
              aria-label="User menu"
              className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-transparent hover:bg-mountain-50 dark:hover:bg-mountain-800 transition-colors duration-100"
              type="button"
            >
              <Avatar color="primary" name={displayName} size="sm" />
              <span className="hidden sm:block text-[12px] font-medium text-mountain-900 dark:text-mountain-200 max-w-[80px] truncate">
                {displayName}
              </span>
              <IoChevronDownOutline className="w-3 h-3 text-mountain-400 dark:text-mountain-500" />
            </button>
          </DropdownTrigger>

          <DropdownMenu aria-label="Admin user actions">
            <DropdownSection showDivider>
              <div className="px-3 py-1.5">
                <p className="text-[11px] font-semibold text-mountain-900 truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-mountain-500 truncate">
                  {currentUser?.email}
                </p>
                <p className="text-[10px] text-teal-600 font-medium mt-0.5">
                  Platform Admin
                </p>
              </div>
            </DropdownSection>

            <DropdownSection showDivider>
              <DropdownItem
                startContent={<IoAppsOutline className="w-3.5 h-3.5" />}
                onClick={() => navigate("/dashboard")}
              >
                Back to App
              </DropdownItem>
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
                Settings
              </DropdownItem>
              <DropdownItem
                startContent={<IoKeyOutline className="w-3.5 h-3.5" />}
                onClick={onPasswordModalOpen}
              >
                Change Password
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

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={onPasswordModalClose}
      />
    </header>
  );
};
