// src/services/landingPageService.ts
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

import { db } from "@/config/firebase";

export interface LandingPageContent {
  hero: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
  };
  stats: Array<{
    number: string;
    label: string;
    icon: string;
  }>;
  services: Array<{
    title: string;
    description: string;
    icon: string;
    color: string;
  }>;
  process: Array<{
    step: string;
    title: string;
    desc: string;
  }>;
  precisionSection: {
    title: string;
    description: string;
    imageUrl: string;
  };
  contact: {
    location: string;
    hours: string;
    phone: string;
    email: string;
  };
}

const DEFAULT_CONTENT: LandingPageContent = {
  hero: {
    title: "Radiant Skin, Timeless Korean Beauty",
    subtitle:
      "Experience the pinnacle of Korean Aesthetic Excellence. Our specialist clinic brings Seoul's most advanced skincare treatments to you.",
    ctaText: "Book Skin Consultation",
    ctaLink: "/login",
    imageUrl: "/images/skincare_hero.png",
  },
  stats: [
    { number: "5k+", label: "Happy Clients", icon: "Users" },
    { number: "15+", label: "Years Expertise", icon: "Building2" },
    { number: "100%", label: "K-Certified Products", icon: "ClipboardList" },
    { number: "4.9/5", label: "Patient Rating", icon: "Stethoscope" },
  ],
  services: [
    {
      title: "Advanced Laser Therapy",
      description:
        "Non-invasive laser treatments for pigmentation, scarring, and skin rejuvenation using K-tech.",
      icon: "Stethoscope",
      color: "text-rose-500",
    },
    {
      title: "Hydrating Glass Skin Facials",
      description:
        "Signature Korean hydration treatments to achieve the ultimate glowing, dewy complexion.",
      icon: "Users",
      color: "text-blue-500",
    },
    {
      title: "Medical Grade Skincare",
      description:
        "Personalized skincare regimens using exclusive Korean pharmaceutical products.",
      icon: "Building",
      color: "text-amber-500",
    },
  ],
  process: [
    {
      step: "01",
      title: "Skin Analysis",
      desc: "Detailed digital analysis of your skin's unique needs and concerns.",
    },
    {
      step: "02",
      title: "Expert Consultation",
      desc: "One-on-one session with our Korean-trained dermatologists.",
    },
    {
      step: "03",
      title: "Bespoke Treatment",
      desc: "Precise execution of your customized aesthetic procedure.",
    },
  ],
  precisionSection: {
    title: "Aesthetic Excellence with Precision",
    description:
      "We utilize the latest Korean aesthetic technology to deliver safe and stunning results. Our clinic is committed to the philosophy of natural beauty enhancement through scientific innovation.",
    imageUrl: "/images/skincare_tech.png",
  },
  contact: {
    location: "K-Beauty Plaza, Level 3, Pokhara, Nepal",
    hours: "Sun - Fri: 10:00 AM - 8:00 PM",
    phone: "+977-61-987654",
    email: "glow@koreanskincare.com",
  },
};

export const landingPageService = {
  getHomepageContent: async (clinicId: string): Promise<LandingPageContent> => {
    try {
      const docRef = doc(db, "landing_pages", clinicId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as LandingPageContent;
      }

      // Return default if not set
      return DEFAULT_CONTENT;
    } catch (error) {
      console.error("Error getting landing page content:", error);

      return DEFAULT_CONTENT;
    }
  },

  updateHomepageContent: async (
    clinicId: string,
    content: Partial<LandingPageContent>,
  ): Promise<void> => {
    try {
      const docRef = doc(db, "landing_pages", clinicId);

      await setDoc(
        docRef,
        {
          ...content,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error updating landing page content:", error);
      throw error;
    }
  },
};
