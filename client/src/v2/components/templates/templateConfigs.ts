// templateConfigs.ts — client-side mirror of server template types + Energetic config.
// Keeps React preview in sync with server-rendered HTML without importing server code.

export type TemplateStyleId = "executive" | "energetic" | "clinical" | "warm" | "bold";

export type LpPageType =
  | "sales_page"
  | "webinar_registration"
  | "discovery_call_booking"
  | "lead_magnet_download"
  | "event_registration";

export type SectionKey =
  | "hero" | "asSeenIn" | "quiz" | "problemAgitation" | "solutionIntro"
  | "whyOldFail" | "uniqueMechanism" | "testimonials" | "insiderAdvantages"
  | "scarcityUrgency" | "shockingStat" | "timeSavingBenefit" | "consultationOutline"
  | "guarantee" | "faq" | "coachAuthority" | "socialProofGallery" | "gradientCta" | "finalCta";

export interface PageTypeLayout {
  order: SectionKey[];
  heroLayout: "split" | "centered" | "offset";
  typeSpecificSections?: {
    eventStrip?: boolean;
    downloadBadge?: boolean;
    bookingCue?: boolean;
  };
}

export interface ClientTemplateConfig {
  id: TemplateStyleId;
  label: string;
  headingFont: string;
  headingFontUrl: string;
  bodyFont: string;
  bodyFontUrl: string;
  headingLetterSpacing: string;
  headingLineHeight: string;
  bodyLineHeight: string;
  colors: {
    pageBg: string;
    dark: string;
    light: string;
    white: string;
    accent: string;
    accentHover: string;
    textOnDark: string;
    textOnLight: string;
    bodyOnDark: string;
    bodyOnLight: string;
    muted: string;
    border: string;
    danger: string;
  };
  maxWidth: string;
  sectionPadding: string;
  navStyle: "dark" | "light" | "transparent";
  buttonRadius: string;
  cardRadius: string;
  ctaGradient: string | null;
  decorative: {
    shadowLevel: 0 | 1 | 2 | 3 | 4 | 5;
    glassBorder: boolean;
    highlightedHeadingWords: boolean;
    sectionDivider: "none" | "line" | "gradient-fade";
    testimonialCardStyle: "bordered" | "shadow" | "glass";
  };
  sectionMap: Record<LpPageType, PageTypeLayout>;
}

// ─── CTA labels by page type ────────────────────────────────────────────────

export const CTA_BY_PAGE_TYPE: Record<LpPageType, string[]> = {
  sales_page: [
    "Get Started Now", "Yes — I Want This", "Claim Your Spot",
    "Start Building Today", "Reserve Your Spot", "I'm Ready", "Get Started",
  ],
  webinar_registration: [
    "Register Now", "Save My Seat", "I'm Ready to Join",
    "Reserve Your Spot", "Yes — Count Me In", "Secure My Place", "Register Free",
  ],
  discovery_call_booking: [
    "Book Your Free Call", "Schedule Now", "Let's Talk",
    "Book My Session", "Yes — I'm Ready", "Claim Your Spot", "Book Now",
  ],
  lead_magnet_download: [
    "Download Free", "Get My Copy", "Send It To Me",
    "Yes — I Want This", "Download Now", "Get Instant Access", "Claim Your Free Copy",
  ],
  event_registration: [
    "Reserve Your Seat", "Register Now", "Save Your Spot",
    "I'll Be There", "Secure My Place", "Register for the Event", "Count Me In",
  ],
};

// ─── Energetic template (Kong-caliber) ──────────────────────────────────────

export const ENERGETIC_CLIENT: ClientTemplateConfig = {
  id: "energetic",
  label: "Energetic",

  headingFont: "'Sora', sans-serif",
  headingFontUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap",
  bodyFont: "'Space Grotesk', sans-serif",
  bodyFontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
  headingLetterSpacing: "-0.03em",
  headingLineHeight: "1.1",
  bodyLineHeight: "1.7",

  colors: {
    pageBg: "#000000",
    dark: "#000000",
    light: "#111111",
    white: "#FAFAFA",
    accent: "#FF5C00",
    accentHover: "#FF7A33",
    textOnDark: "#FFFFFF",
    textOnLight: "#000000",
    bodyOnDark: "#B0B0B0",
    bodyOnLight: "#444444",
    muted: "#888888",
    border: "#222222",
    danger: "#FF3333",
  },

  maxWidth: "1140px",
  sectionPadding: "96px 0",
  navStyle: "dark",
  buttonRadius: "8px",
  cardRadius: "16px",
  ctaGradient: "linear-gradient(90deg, #FF5C00 35%, #000 100%)",

  decorative: {
    shadowLevel: 4,
    glassBorder: false,
    highlightedHeadingWords: false,
    sectionDivider: "none",
    testimonialCardStyle: "shadow",
  },

  sectionMap: {
    sales_page: {
      order: [
        "hero", "asSeenIn", "problemAgitation", "solutionIntro",
        "coachAuthority", "socialProofGallery", "uniqueMechanism",
        "whyOldFail", "insiderAdvantages", "testimonials", "quiz",
        "shockingStat", "gradientCta", "consultationOutline",
        "guarantee", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "split",
    },
    webinar_registration: {
      order: [
        "hero", "consultationOutline", "timeSavingBenefit",
        "coachAuthority", "testimonials", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },
    discovery_call_booking: {
      order: [
        "hero", "insiderAdvantages", "coachAuthority",
        "testimonials", "faq", "finalCta",
      ],
      heroLayout: "split",
      typeSpecificSections: { bookingCue: true },
    },
    lead_magnet_download: {
      order: [
        "hero", "problemAgitation", "coachAuthority",
        "testimonials", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { downloadBadge: true },
    },
    event_registration: {
      order: [
        "hero", "consultationOutline", "insiderAdvantages",
        "coachAuthority", "scarcityUrgency", "faq", "finalCta",
      ],
      heroLayout: "centered",
      typeSpecificSections: { eventStrip: true },
    },
  },
};

// ─── Template lookup ────────────────────────────────────────────────────────

export function getClientTemplate(id: TemplateStyleId): ClientTemplateConfig {
  // Sprint 1: only Energetic exists
  if (id === "energetic") return ENERGETIC_CLIENT;
  return ENERGETIC_CLIENT; // fallback
}
