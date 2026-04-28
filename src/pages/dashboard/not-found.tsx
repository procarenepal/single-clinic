import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Link } from "react-router-dom";

import { useTheme } from "@/context/ThemeContext";
import { title } from "@/components/primitives";

export default function DashboardNotFoundPage() {
  const { themeConfig } = useTheme();

  // Theme-aware classes
  const getThemeClasses = () => {
    const themeVariant = themeConfig.id;

    // Define theme-specific color mappings
    const themeColorMaps = {
      light: {
        mainCard: "bg-white border border-default-200",
        errorContainer: "bg-red-50 border border-red-100",
        numberText: "text-red-500",
        iconColor: "text-red-400",
      },
      dark: {
        mainCard: "bg-default-100 border border-default-200",
        errorContainer: "bg-red-900/20 border border-red-800/30",
        numberText: "text-red-400",
        iconColor: "text-red-300",
      },
      medical: {
        mainCard: "bg-white border border-blue-200",
        errorContainer: "bg-blue-50 border border-blue-100",
        numberText: "text-blue-500",
        iconColor: "text-blue-400",
      },
      nature: {
        mainCard: "bg-white border border-green-200",
        errorContainer: "bg-green-50 border border-green-100",
        numberText: "text-green-500",
        iconColor: "text-green-400",
      },
      ocean: {
        mainCard: "bg-white border border-cyan-200",
        errorContainer: "bg-cyan-50 border border-cyan-100",
        numberText: "text-cyan-500",
        iconColor: "text-cyan-400",
      },
      sunset: {
        mainCard: "bg-white border border-orange-200",
        errorContainer: "bg-orange-50 border border-orange-100",
        numberText: "text-orange-500",
        iconColor: "text-orange-400",
      },
    };

    return themeColorMaps[themeVariant] || themeColorMaps.light;
  };

  const themeClasses = getThemeClasses();

  return (
    <div className="flex items-center justify-center min-h-[50vh] px-4">
      <Card className={`w-full max-w-md ${themeClasses.mainCard}`}>
        <CardBody className="text-center p-6">
          <div className="mb-4">
            {/* Error Icon */}
            <div
              className={`mx-auto mb-3 w-16 h-16 ${themeClasses.errorContainer} rounded-full flex items-center justify-center`}
            >
              <svg
                className={themeClasses.iconColor}
                fill="none"
                height="32"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>

            <h1
              className={`text-stat font-bold ${themeClasses.numberText} mb-2`}
            >
              404
            </h1>
            <h2 className={`${title({ size: "sm" })} mb-3`}>Page Not Found</h2>
            <p className="text-default-500 mb-4 text-sm">
              The dashboard page you're looking for doesn't exist or has been
              moved.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              as={Link}
              className="w-full"
              color="primary"
              size="md"
              startContent={
                <svg
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
              }
              to="/dashboard"
              variant="solid"
            >
              Dashboard Home
            </Button>
          </div>

          <div className="mt-4 pt-3 border-t border-default-200">
            <p className="text-xs text-default-400">
              Need help? Contact your system administrator.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
