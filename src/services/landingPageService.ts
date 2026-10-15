// src/services/landingPageService.ts
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

import { db } from "@/config/firebase";
import { mergeWithDefaults } from "@/utils/mergeWithDefaults";

/**
 * Every piece of content on the public home page lives in one document:
 * `landing_pages/{PUBLIC_HOMEPAGE_CLINIC_ID}`. The Homepage Management settings
 * page edits it; the home page reads it. Anything not saved yet falls back to
 * DEFAULT_CONTENT below, so a partly saved or older document still renders fully.
 */

export interface HomepageLink {
  text: string;
  link: string;
}

export interface LandingPageContent {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    secondaryCtaText: string;
    secondaryCtaLink: string;
    /** Legacy single image; the carousel uses `slides`. */
    imageUrl: string;
    slides: Array<{ imageUrl: string; kicker: string; caption: string }>;
    trustAvatars: string[];
    trustRating: string;
    trustText: string;
    ratingValue: string;
    ratingLabel: string;
    specialistName: string;
    specialistRole: string;
    specialistImageUrl: string;
    specialistLink: string;
  };
  stats: Array<{
    number: string;
    label: string;
    icon: string;
    /** Illustration shown instead of the icon when set. */
    imageUrl: string;
  }>;
  servicesSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    buttonText: string;
    buttonLink: string;
    learnMoreText: string;
    exploreTitle: string;
    exploreText: string;
    exploreButtonText: string;
    exploreButtonLink: string;
  };
  services: Array<{
    title: string;
    description: string;
    icon: string;
    color: string;
    imageUrl: string;
    linkUrl: string;
  }>;
  whyChoose: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    buttonText: string;
    buttonLink: string;
    imageUrl: string;
    note: string;
    features: Array<{ icon: string; title: string; desc: string }>;
  };
  promo: {
    badge: string;
    title: string;
    description: string;
    buttonText: string;
    buttonLink: string;
    imageUrl: string;
  };
  processSection: { eyebrow: string; title: string; subtitle: string };
  process: Array<{
    step: string;
    title: string;
    desc: string;
    imageUrl: string;
  }>;
  precisionSection: {
    eyebrow: string;
    title: string;
    description: string;
    imageUrl: string;
    points: Array<{ title: string; desc: string }>;
  };
  gallerySection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    cases: Array<{
      tag: string;
      label: string;
      sessions: string;
      result: string;
      imageUrl: string;
    }>;
    stats: Array<{ value: string; label: string }>;
  };
  testimonialsSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Array<{
      name: string;
      role: string;
      text: string;
      imageUrl: string;
      rating: number;
    }>;
  };
  teamSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    members: Array<{
      name: string;
      title: string;
      imageUrl: string;
      badge: string;
      bio: string;
      specializations: string[];
      credentials: string[];
    }>;
  };
  contact: {
    eyebrow: string;
    title: string;
    location: string;
    hours: string;
    phone: string;
    email: string;
    mapImageUrl: string;
    mapLabel: string;
    directionsLink: string;
  };
  cta: {
    eyebrow: string;
    title: string;
    description: string;
    primaryText: string;
    primaryLink: string;
    secondaryText: string;
    secondaryLink: string;
    imageUrl: string;
  };
  /** Turn a whole section off. The hero is always shown. */
  sections: {
    stats: boolean;
    services: boolean;
    whyChoose: boolean;
    promo: boolean;
    process: boolean;
    precision: boolean;
    gallery: boolean;
    testimonials: boolean;
    team: boolean;
    contact: boolean;
    cta: boolean;
  };
}

/**
 * The clinic whose homepage the public site shows. Visitors are not signed in, so
 * the page cannot look this up from a user — it is configured. The settings page
 * saves under the signed-in clinic's own id (a Firestore rule requires that), so
 * the two must match: set VITE_HOMEPAGE_CLINIC_ID if your clinic id is not "default".
 */
export const PUBLIC_HOMEPAGE_CLINIC_ID: string =
  (import.meta.env.VITE_HOMEPAGE_CLINIC_ID as string | undefined) || "default";

export const DEFAULT_CONTENT: LandingPageContent = {
  hero: {
    eyebrow: "Advanced Aesthetic Medicine",
    title: "Radiant Skin, Timeless Korean Beauty",
    subtitle:
      "Experience the pinnacle of Korean Aesthetic Excellence. Our specialist clinic brings Seoul's most advanced skincare treatments to you.",
    ctaText: "Book Skin Consultation",
    ctaLink: "/login",
    secondaryCtaText: "View Services",
    secondaryCtaLink: "/features",
    imageUrl: "/images/skincare_hero.png",
    slides: [
      {
        imageUrl: "/images/banner_1.png",
        kicker: "Natural Glow",
        caption: "The Signature Glass Skin",
      },
      {
        imageUrl: "/images/banner_2.png",
        kicker: "Medical Grade",
        caption: "Advanced K-Laser Therapy",
      },
      {
        imageUrl: "/images/banner_3.png",
        kicker: "Serene Wellness",
        caption: "Premium Aesthetic Sanctuary",
      },
    ],
    trustAvatars: [
      "https://i.pravatar.cc/100?u=skin-doc1",
      "https://i.pravatar.cc/100?u=skin-doc2",
      "https://i.pravatar.cc/100?u=skin-doc3",
      "https://i.pravatar.cc/100?u=skin-doc4",
    ],
    trustRating: "4.9",
    trustText: "Trusted by 5,000+ patients",
    ratingValue: "4.9/5",
    ratingLabel: "Patient Rating",
    specialistName: "Dr. Park",
    specialistRole: "Lead Aesthetic Specialist",
    specialistImageUrl: "/images/team_1.png",
    specialistLink: "#team",
  },
  stats: [
    {
      number: "5k+",
      label: "Happy Clients",
      icon: "Users",
      imageUrl: "/images/stat_clients.png",
    },
    {
      number: "15+",
      label: "Years Expertise",
      icon: "Calendar",
      imageUrl: "/images/stat_experience.png",
    },
    {
      number: "100%",
      label: "K-Certified Products",
      icon: "ShieldCheck",
      imageUrl: "/images/stat_certified.png",
    },
    {
      number: "4.9/5",
      label: "Patient Rating",
      icon: "Stethoscope",
      imageUrl: "/images/stat_rating.png",
    },
  ],
  servicesSection: {
    eyebrow: "Our Services",
    title: "Medical Aesthetic Services",
    subtitle:
      "Precision-engineered protocols fusing advanced dermatological science with Korean aesthetic innovation.",
    buttonText: "View All Services",
    buttonLink: "/features",
    learnMoreText: "Learn more",
    exploreTitle: "Explore All Treatments",
    exploreText:
      "Discover our complete range of advanced aesthetic treatments for your unique skin goals.",
    exploreButtonText: "View All Services",
    exploreButtonLink: "/features",
  },
  services: [
    {
      title: "Advanced Laser Therapy",
      description:
        "Non-invasive laser treatments for pigmentation, scarring, and skin rejuvenation using K-tech.",
      icon: "Stethoscope",
      color: "text-rose-500",
      imageUrl: "/images/service_1.png",
      linkUrl: "/features",
    },
    {
      title: "Hydrating Glass Skin Facials",
      description:
        "Signature Korean hydration treatments to achieve the ultimate glowing, dewy complexion.",
      icon: "Users",
      color: "text-blue-500",
      imageUrl: "/images/service_2.png",
      linkUrl: "/features",
    },
    {
      title: "Medical Grade Skincare",
      description:
        "Personalized skincare regimens using exclusive Korean pharmaceutical products.",
      icon: "Building",
      color: "text-amber-500",
      imageUrl: "/images/service_3.png",
      linkUrl: "/features",
    },
  ],
  whyChoose: {
    eyebrow: "Why Choose Us",
    title: "Science meets",
    accent: "artistry.",
    description:
      "We combine advanced Korean technology, expert care, and a personalized approach to help you achieve healthy, radiant, and confident skin.",
    buttonText: "Learn More",
    buttonLink: "/about",
    imageUrl: "/images/banner_1.png",
    note: "Healthy Skin,\nHappier You ♡",
    features: [
      {
        icon: "Zap",
        title: "Korean Technology",
        desc: "World-class equipment and protocols.",
      },
      {
        icon: "Users",
        title: "Expert Doctors",
        desc: "Certified & experienced dermatologists.",
      },
      {
        icon: "Heart",
        title: "Personalized Care",
        desc: "Treatments tailored to your skin needs.",
      },
      {
        icon: "ShieldCheck",
        title: "Safe & Trusted",
        desc: "FDA-approved & K-Certified products.",
      },
    ],
  },
  promo: {
    badge: "Limited Offer",
    title: "Signature Glass Skin Protocol",
    description:
      "First-time clients save 20% this month on our medical-grade facial series.",
    buttonText: "Claim Offer",
    buttonLink: "/contact",
    imageUrl: "/images/promo_banner.png",
  },
  processSection: {
    eyebrow: "Process",
    title: "Your Treatment Journey",
    subtitle:
      "A structured, evidence-based approach to skin health and aesthetic excellence.",
  },
  process: [
    {
      step: "01",
      title: "Skin Analysis",
      desc: "Detailed digital analysis of your skin's unique needs and concerns.",
      imageUrl: "/images/step_1.png",
    },
    {
      step: "02",
      title: "Expert Consultation",
      desc: "One-on-one session with our Korean-trained dermatologists.",
      imageUrl: "/images/step_2.png",
    },
    {
      step: "03",
      title: "Bespoke Treatment",
      desc: "Precise execution of your customized aesthetic procedure.",
      imageUrl: "/images/step_3.png",
    },
  ],
  precisionSection: {
    eyebrow: "Our Technology",
    title: "Aesthetic Excellence with Precision",
    description:
      "We utilize the latest Korean aesthetic technology to deliver safe and stunning results. Our clinic is committed to the philosophy of natural beauty enhancement through scientific innovation.",
    imageUrl: "/images/skincare_tech.png",
    points: [
      {
        title: "K-Beauty Innovation",
        desc: "Latest medical technologies from Seoul's top aesthetic laboratories.",
      },
      {
        title: "Certified Experts",
        desc: "Dermatologists trained in the latest Korean skincare protocols.",
      },
      {
        title: "Holistic Approach",
        desc: "Focused on long-term skin health and natural-looking results.",
      },
    ],
  },
  gallerySection: {
    eyebrow: "Real Results",
    title: "Before & After",
    subtitle:
      "Drag the slider to reveal the transformation. Real patients, real results.",
    ctaText: "Book Your Consultation",
    ctaLink: "/contact",
    cases: [
      {
        tag: "Glass Skin Facial",
        label: "Glass Skin",
        sessions: "3 Sessions",
        result: "Luminosity +68%",
        imageUrl: "/images/ba_1.png",
      },
      {
        tag: "Laser Therapy",
        label: "Laser Pigmentation",
        sessions: "4 Sessions",
        result: "Spots reduced -82%",
        imageUrl: "/images/ba_2.png",
      },
      {
        tag: "Hydration Boost",
        label: "Deep Hydration",
        sessions: "2 Sessions",
        result: "Hydration +91%",
        imageUrl: "/images/ba_3.png",
      },
    ],
    stats: [
      { value: "5,000+", label: "Treatments Completed" },
      { value: "98%", label: "Patient Satisfaction" },
      { value: "4.9★", label: "Average Rating" },
      { value: "3–5", label: "Sessions to Full Results" },
    ],
  },
  testimonialsSection: {
    eyebrow: "Testimonials",
    title: "Patient Experiences",
    subtitle: "Confidence restored, skin transformed through expert care.",
    items: [
      {
        name: "Ji-Su Park",
        role: "Patient",
        text: "The glass skin facial here is incredible. My skin has never looked this radiant. The clinicians are so professional and the products they use are clearly premium.",
        imageUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
        rating: 5,
      },
      {
        name: "Sarah Jenkins",
        role: "Patient",
        text: "I was struggling with pigmentation for years. After just three sessions of their laser therapy, I see a massive difference. Highly recommend this clinic!",
        imageUrl:
          "https://images.unsplash.com/photo-1554151228-14d9def656e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
        rating: 5,
      },
    ],
  },
  teamSection: {
    eyebrow: "Our Specialists",
    title: "Meet the Team",
    subtitle:
      "Korean-trained medical professionals dedicated to your skin health and confidence.",
    members: [
      {
        name: "Dr. Ji-Yeon Park",
        title: "Lead Dermatologist & Founder",
        imageUrl: "/images/team_1.png",
        badge: "Founder",
        bio: "Dr. Park trained at Seoul's top aesthetic institutes and brings the most advanced Korean skincare science to our patients. She founded the clinic with a vision to make medical-grade aesthetics accessible.",
        specializations: [
          "Glass Skin Protocols",
          "Laser Therapy",
          "Anti-Aging",
        ],
        credentials: [
          "MD, Seoul National University",
          "K-Beauty Certified Specialist",
          "15+ Years Experience",
        ],
      },
      {
        name: "Dr. Min-Jae Kim",
        title: "Aesthetic & Laser Specialist",
        imageUrl: "/images/team_2.png",
        badge: "Specialist",
        bio: "Dr. Kim specializes in precision laser treatments and has performed over 3,000 procedures. His evidence-based approach ensures safe, visible results tailored to each patient's unique skin profile.",
        specializations: [
          "Pigmentation Treatment",
          "K-Laser Therapy",
          "Skin Rejuvenation",
        ],
        credentials: [
          "MD, Yonsei University",
          "Laser Medicine Certified",
          "10+ Years Experience",
        ],
      },
      {
        name: "Ms. Soo-Yeon Lee",
        title: "Senior Aesthetic Nurse",
        imageUrl: "/images/team_3.png",
        badge: "Nurse",
        bio: "Soo-Yeon is our patients' favourite — her gentle touch and thorough consultations make every visit a comfortable and results-driven experience. She leads our signature hydration facial program.",
        specializations: [
          "Hydration Facials",
          "Skin Analysis",
          "Post-Treatment Care",
        ],
        credentials: [
          "BSN, Nursing & Aesthetics",
          "K-Skincare Protocol Certified",
          "7+ Years Experience",
        ],
      },
    ],
  },
  contact: {
    eyebrow: "Location & Contact",
    title: "Visit Our Clinic",
    location: "K-Beauty Plaza, Level 3, Pokhara, Nepal",
    hours: "Sun - Fri: 10:00 AM - 8:00 PM",
    phone: "+977-61-987654",
    email: "glow@koreanskincare.com",
    mapImageUrl:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    mapLabel: "Clinic Location",
    directionsLink: "",
  },
  cta: {
    eyebrow: "Get Started",
    title: "Begin Your Journey to Healthier Skin",
    description:
      "Join thousands of patients who have transformed their skin with our evidence-based Korean aesthetic protocols.",
    primaryText: "Book Consultation",
    primaryLink: "/login",
    secondaryText: "Contact Us",
    secondaryLink: "/contact",
    imageUrl: "/images/cta_bg.png",
  },
  sections: {
    stats: true,
    services: true,
    whyChoose: true,
    promo: true,
    process: true,
    precision: true,
    gallery: true,
    testimonials: true,
    team: true,
    contact: true,
    cta: true,
  },
};

// Firestore's getDoc() has no built-in timeout and can hang indefinitely on a poor
// or interrupted connection (a real risk for mobile clients on cellular networks),
// leaving the landing page stuck on its loading spinner forever. Bound it so a slow
// network degrades to the default content instead of hanging.
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms),
    ),
  ]);

export const landingPageService = {
  getHomepageContent: async (clinicId: string): Promise<LandingPageContent> => {
    try {
      const docRef = doc(db, "landing_pages", clinicId);
      const docSnap = await withTimeout(getDoc(docRef), 10000);

      if (docSnap.exists()) {
        const { updatedAt: _updatedAt, ...saved } = docSnap.data();

        return mergeWithDefaults(DEFAULT_CONTENT, saved);
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

      // Firestore rejects `undefined` anywhere in a document.
      const clean = JSON.parse(JSON.stringify(content));

      await setDoc(
        docRef,
        {
          ...clean,
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
