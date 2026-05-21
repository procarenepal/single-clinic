import { Card, CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import clsx from "clsx";

import { title } from "@/components/primitives";
import { useTheme, ThemeVariant } from "@/context/ThemeContext";

// Helper functions to get theme-specific colors
const getThemeSecondaryColor = (themeId: string) => {
  switch (themeId) {
    case "light":
      return "bg-health-500";
    case "dark":
      return "bg-health-400";
    case "medical":
      return "bg-teal-500";
    case "nature":
      return "bg-emerald-500";
    case "ocean":
      return "bg-blue-500";
    case "sunset":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
};

const getThemeWarningColor = (themeId: string) => {
  switch (themeId) {
    case "light":
      return "bg-saffron-500";
    case "dark":
      return "bg-saffron-400";
    case "medical":
      return "bg-amber-500";
    case "nature":
      return "bg-lime-500";
    case "ocean":
      return "bg-indigo-500";
    case "sunset":
      return "bg-yellow-500";
    default:
      return "bg-yellow-400";
  }
};

const getThemeTextColor = (themeId: string) => {
  switch (themeId) {
    case "light":
      return "bg-mountain-400";
    case "dark":
      return "bg-mountain-300";
    case "medical":
      return "bg-slate-400";
    case "nature":
      return "bg-green-400";
    case "ocean":
      return "bg-cyan-400";
    case "sunset":
      return "bg-orange-400";
    default:
      return "bg-gray-400";
  }
};

const getThemeBorderColor = (themeId: string) => {
  switch (themeId) {
    case "light":
      return "border-mountain-300";
    case "dark":
      return "border-mountain-600";
    case "medical":
      return "border-slate-300";
    case "nature":
      return "border-green-300";
    case "ocean":
      return "border-cyan-300";
    case "sunset":
      return "border-orange-300";
    default:
      return "border-gray-300";
  }
};

const getThemeSuccessColor = (themeId: string) => {
  switch (themeId) {
    case "light":
      return "bg-health-600";
    case "dark":
      return "bg-health-500";
    case "medical":
      return "bg-green-600";
    case "nature":
      return "bg-green-600";
    case "ocean":
      return "bg-emerald-600";
    case "sunset":
      return "bg-green-600";
    default:
      return "bg-green-500";
  }
};

export default function ThemeSettingsPage() {
  const { currentTheme, themeConfig, themes, setTheme, isDark } = useTheme();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`${title({ size: "lg" })} text-primary`}>
          Theme Settings
        </h1>
        <p className="text-[13.5px] text-text-muted mt-1">
          Customize your clinic dashboard appearance and visual preferences
        </p>
      </div>

      {/* Current Theme Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-lg font-semibold">Current Theme</h2>
              <p className="text-sm text-foreground-500">
                Active theme settings for your dashboard
              </p>
            </div>
            <Chip className="ml-4" color="primary" variant="flat">
              {themeConfig.name}
            </Chip>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Theme Name
              </div>
              <div className="text-sm text-foreground-500">
                {themeConfig.name}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Description
              </div>
              <div className="text-sm text-foreground-500">
                {themeConfig.description}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Mode</div>
              <div className="text-sm text-foreground-500">
                {isDark ? "Dark Mode" : "Light Mode"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Primary Color
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full bg-${themeConfig.colors.primary}`}
                />
                <span className="text-sm text-foreground-500 capitalize">
                  {themeConfig.colors.primary}
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold">Choose Theme</h2>
            <p className="text-sm text-foreground-500">
              Select a theme that matches your clinic's brand and your personal
              preference
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(themes).map((theme) => (
              <Card
                key={theme.id}
                isHoverable
                isPressable
                className={clsx(
                  "cursor-pointer transition-all duration-300 border-2",
                  currentTheme === theme.id
                    ? "border-primary shadow-lg scale-105"
                    : "border-transparent hover:border-primary/50 hover:scale-102",
                )}
                onPress={() => setTheme(theme.id as ThemeVariant)}
              >
                <CardBody className="p-0">
                  {/* Theme Preview Header */}
                  <div className={clsx("p-4", theme.preview.background)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={clsx(
                            "w-3 h-3 rounded-full",
                            theme.preview.primary,
                          )}
                        />
                        <div
                          className={clsx(
                            "w-2 h-2 rounded-full",
                            getThemeSecondaryColor(theme.id),
                          )}
                        />
                        <div
                          className={clsx(
                            "w-2 h-2 rounded-full",
                            getThemeWarningColor(theme.id),
                          )}
                        />
                      </div>
                    </div>

                    {/* Mini Dashboard Preview */}
                    <div className="space-y-2">
                      <div
                        className={clsx(
                          "h-2 w-full rounded",
                          theme.preview.card,
                        )}
                      />
                      <div className="flex gap-2">
                        <div
                          className={clsx(
                            "h-6 w-6 rounded",
                            theme.preview.card,
                          )}
                        />
                        <div className="flex-1 space-y-1">
                          <div
                            className={clsx(
                              "h-1.5 w-3/4 rounded",
                              theme.preview.card,
                            )}
                          />
                          <div
                            className={clsx(
                              "h-1 w-1/2 rounded",
                              getThemeTextColor(theme.id),
                            )}
                          />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <div
                          className={clsx(
                            "h-4 w-12 rounded-full",
                            theme.preview.primary,
                          )}
                        />
                        <div
                          className={clsx(
                            "h-4 w-10 rounded-full border-2",
                            getThemeBorderColor(theme.id),
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="p-4 bg-content1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">
                        {theme.name}
                      </h3>
                      {currentTheme === theme.id && (
                        <Chip color="primary" size="sm" variant="flat">
                          Active
                        </Chip>
                      )}
                    </div>
                    <p className="text-sm text-foreground-500 mb-3">
                      {theme.description}
                    </p>

                    {/* Color Palette */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-foreground-500 mr-2">
                        Colors:
                      </span>
                      <div
                        className={clsx(
                          "w-4 h-4 rounded-full",
                          theme.preview.primary,
                        )}
                      />
                      <div
                        className={clsx(
                          "w-4 h-4 rounded-full",
                          getThemeSecondaryColor(theme.id),
                        )}
                      />
                      <div
                        className={clsx(
                          "w-4 h-4 rounded-full",
                          getThemeSuccessColor(theme.id),
                        )}
                      />
                      <div
                        className={clsx(
                          "w-4 h-4 rounded-full",
                          getThemeWarningColor(theme.id),
                        )}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Theme Features */}
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold">Theme Features</h2>
            <p className="text-sm text-foreground-500">
              Information about theme capabilities and accessibility features
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-medium text-foreground">Visual Features</h3>
              <ul className="space-y-2 text-sm text-foreground-500">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-success rounded-full" />
                  Automatic dark/light mode support
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-success rounded-full" />
                  High contrast for accessibility
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-success rounded-full" />
                  Color-blind friendly palettes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-success rounded-full" />
                  Professional medical colors
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-foreground">Customization</h3>
              <ul className="space-y-2 text-sm text-foreground-500">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Persistent theme selection
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Instant theme switching
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Theme previews
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Clinic branding support
                </li>
              </ul>
            </div>
          </div>

          <Divider className="my-4" />

          <div className="bg-content2 p-4 rounded-lg">
            <h4 className="font-medium text-foreground mb-2">💡 Theme Tips</h4>
            <ul className="space-y-1 text-sm text-foreground-500">
              <li>
                • <strong>Light themes</strong> work best in bright environments
              </li>
              <li>
                • <strong>Dark themes</strong> reduce eye strain during long
                sessions
              </li>
              <li>
                • <strong>Medical themes</strong> provide professional, clinical
                aesthetics
              </li>
              <li>
                • <strong>Nature themes</strong> create calming, therapeutic
                environments
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <div className="text-sm text-foreground-500">
          Theme changes are applied immediately and saved automatically
        </div>
        <Button
          color="primary"
          variant="flat"
          onPress={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    </div>
  );
}
