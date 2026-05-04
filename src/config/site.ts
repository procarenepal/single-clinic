export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "HSC Laser Hospital",
  description:
    "Kathmandu's premier destination for advanced laser therapies, authentic Korean aesthetic excellence, and specialized dermatological care.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Features",
      href: "/features",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Features",
      href: "/features",
    },
    {
      label: "About",
      href: "/about",
    },
    {
      label: "Demo",
      href: "/demo",
    },
    {
      label: "Login",
      href: "/login",
    },
  ],
  links: {
    demo: "/demo",
    login: "/login",
    support: "/support",
    contact: "/contact",
    phone: "+977 986-0577865",
    email: "procarenepal@gmail.com",
  },
};
