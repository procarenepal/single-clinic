// Predefined appointment type colors that are theme-dynamic
export interface AppointmentColor {
  id: string;
  name: string;
  lightColor: string; // Color for light theme
  darkColor: string; // Color for dark theme
  lightBg: string; // Background color for light theme
  darkBg: string; // Background color for dark theme
  description?: string; // Optional description
}

export const APPOINTMENT_COLORS: AppointmentColor[] = [
  {
    id: "none",
    name: "No Color",
    lightColor: "transparent",
    darkColor: "transparent",
    lightBg: "transparent",
    darkBg: "transparent",
    description: "No blinking animation or special color",
  },
  {
    id: "default",
    name: "Indigo",
    lightColor: "rgb(99, 102, 241)", // indigo-500
    darkColor: "rgb(129, 140, 248)", // indigo-400
    lightBg: "rgb(238, 242, 255)", // indigo-50
    darkBg: "rgb(67, 56, 202)", // indigo-700
  },
  {
    id: "blue",
    name: "Blue",
    lightColor: "rgb(59, 130, 246)", // blue-500
    darkColor: "rgb(96, 165, 250)", // blue-400
    lightBg: "rgb(239, 246, 255)", // blue-50
    darkBg: "rgb(29, 78, 216)", // blue-700
  },
  {
    id: "emerald",
    name: "Emerald",
    lightColor: "rgb(16, 185, 129)", // emerald-500
    darkColor: "rgb(52, 211, 153)", // emerald-400
    lightBg: "rgb(236, 253, 245)", // emerald-50
    darkBg: "rgb(4, 120, 87)", // emerald-700
  },
  {
    id: "amber",
    name: "Amber",
    lightColor: "rgb(245, 158, 11)", // amber-500
    darkColor: "rgb(251, 191, 36)", // amber-400
    lightBg: "rgb(255, 251, 235)", // amber-50
    darkBg: "rgb(180, 83, 9)", // amber-700
  },
  {
    id: "red",
    name: "Red",
    lightColor: "rgb(239, 68, 68)", // red-500
    darkColor: "rgb(248, 113, 113)", // red-400
    lightBg: "rgb(254, 242, 242)", // red-50
    darkBg: "rgb(185, 28, 28)", // red-700
  },
  {
    id: "purple",
    name: "Purple",
    lightColor: "rgb(168, 85, 247)", // purple-500
    darkColor: "rgb(196, 181, 253)", // purple-400
    lightBg: "rgb(250, 245, 255)", // purple-50
    darkBg: "rgb(109, 40, 217)", // purple-700
  },
  {
    id: "pink",
    name: "Pink",
    lightColor: "rgb(236, 72, 153)", // pink-500
    darkColor: "rgb(244, 114, 182)", // pink-400
    lightBg: "rgb(253, 242, 248)", // pink-50
    darkBg: "rgb(190, 24, 93)", // pink-700
  },
  {
    id: "cyan",
    name: "Cyan",
    lightColor: "rgb(6, 182, 212)", // cyan-500
    darkColor: "rgb(34, 211, 238)", // cyan-400
    lightBg: "rgb(236, 254, 255)", // cyan-50
    darkBg: "rgb(14, 116, 144)", // cyan-700
  },
  {
    id: "orange",
    name: "Orange",
    lightColor: "rgb(249, 115, 22)", // orange-500
    darkColor: "rgb(251, 146, 60)", // orange-400
    lightBg: "rgb(255, 247, 237)", // orange-50
    darkBg: "rgb(194, 65, 12)", // orange-700
  },
  {
    id: "teal",
    name: "Teal", // (ProCare Blue)
    lightColor: "rgb(14, 132, 233)", // teal-500 re-mapped to ProCare Blue
    darkColor: "rgb(56, 169, 248)", // teal-400 re-mapped to ProCare Blue
    lightBg: "rgb(240, 247, 255)", // teal-50
    darkBg: "rgb(3, 86, 161)", // teal-700
  },
];

// Helper function to get appointment color by ID
export const getAppointmentColorById = (colorId?: string): AppointmentColor => {
  if (!colorId) {
    return APPOINTMENT_COLORS[0]; // No color (none)
  }

  const color = APPOINTMENT_COLORS.find((c) => c.id === colorId);

  return color || APPOINTMENT_COLORS[0]; // Fallback to no color
};

// Helper function to get CSS variables for a color theme
export const getAppointmentColorCssVars = (
  colorId?: string,
  theme: "light" | "dark" = "light",
) => {
  const color = getAppointmentColorById(colorId);

  return {
    "--appointment-color":
      theme === "light" ? color.lightColor : color.darkColor,
    "--appointment-bg": theme === "light" ? color.lightBg : color.darkBg,
  };
};

// CSS class generator for blinking animation
export const getBlinkingCssClass = (colorId?: string) => {
  if (!colorId || colorId === "none") {
    return ""; // No animation for "none" or undefined
  }
  if (colorId === "default") {
    return "appointment-blink-default";
  }

  return `appointment-blink-${colorId}`;
};
