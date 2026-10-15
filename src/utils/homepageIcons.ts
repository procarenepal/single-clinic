import {
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons the homepage content can refer to by name. The names are what is stored
 * in the homepage content, so keep existing keys stable when adding new ones.
 */
export const HOMEPAGE_ICONS: Record<string, LucideIcon> = {
  Users,
  ClipboardList,
  Building2,
  Building,
  Stethoscope,
  Calendar,
  ShieldCheck,
  Zap,
  Heart,
  Sparkles,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  Mail,
};

export const HOMEPAGE_ICON_NAMES = Object.keys(HOMEPAGE_ICONS);

/** Unknown or empty names fall back to a pin, as the page always has. */
export const resolveHomepageIcon = (name?: string): LucideIcon =>
  (name && HOMEPAGE_ICONS[name]) || MapPin;
