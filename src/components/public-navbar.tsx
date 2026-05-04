import clsx from "clsx";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
  Navbar as UINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@/components/ui/navbar";
import { siteConfig } from "@/config/site";

export const PublicNavbar = () => {
  return (
    <UINavbar
      className="border-b border-mountain-200 bg-white/95 backdrop-blur-md"
      height="72px"
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <Link
            className="flex justify-start items-center gap-2 hover:opacity-80 transition-opacity"
            color="default"
            href="/"
          >
            <div className="p-1 bg-white rounded-lg">
              <img
                alt="HSC Laser Hospital Logo"
                className="w-7 h-7 object-contain"
                src="/logo.png"
              />
            </div>
            <div className="flex flex-col max-w-xs">
              <p className="font-bold text-lg text-mountain-900 truncate">
                HSC Laser Hospital
              </p>
              <p className="text-xs text-red-600 font-medium truncate">Nepal</p>
            </div>
          </Link>
        </NavbarBrand>
        <div className="hidden lg:flex gap-6 justify-start ml-8">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Link
                className={clsx(
                  "font-medium text-mountain-700 hover:text-nepal-600 transition-colors",
                  "data-[active=true]:text-nepal-600 data-[active=true]:font-semibold",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </NavbarItem>
          ))}
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <div className="flex items-center gap-3">
          <NavbarItem className="hidden md:flex">
            <Link href={siteConfig.links.login}>
              <Button
                className="font-medium border-nepal-500 text-nepal-600 hover:bg-nepal-50"
                size="sm"
                variant="bordered"
              >
                Login
              </Button>
            </Link>
          </NavbarItem>
          <NavbarItem className="hidden md:flex">
            <Link href={siteConfig.links.demo}>
              <Button
                className="font-medium bg-nepal-500 text-white hover:bg-nepal-600"
                size="sm"
                variant="solid"
              >
                Request Demo
              </Button>
            </Link>
          </NavbarItem>
        </div>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link href={siteConfig.links.login}>
          <Button
            className="bg-nepal-500 text-white font-medium"
            size="sm"
            variant="solid"
          >
            Login
          </Button>
        </Link>
        <NavbarMenuToggle className="text-mountain-700" />
      </NavbarContent>

      <NavbarMenu className="bg-white/95 backdrop-blur-md border-t border-mountain-200">
        <div className="mx-4 mt-6 flex flex-col gap-4">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item.label}-${index}`}>
              <Link
                className={clsx(
                  "font-medium text-mountain-700 hover:text-nepal-600 transition-colors py-2",
                  index === siteConfig.navMenuItems.length - 1 &&
                    "text-nepal-600",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </UINavbar>
  );
};

export default PublicNavbar;
