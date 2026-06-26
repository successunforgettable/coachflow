import type { LandingPageContent } from "../../../drizzle/schema";
export type { LandingPageContent };

export type LpPageType =
  | "sales_page"
  | "webinar_registration"
  | "discovery_call_booking"
  | "lead_magnet_download"
  | "event_registration";

export type TemplateStyleId = "executive" | "energetic" | "clinical" | "warm" | "bold";
export type StyleMode = TemplateStyleId | "text" | "visual";

export type SectionKey =
  | "hero" | "asSeenIn" | "quiz" | "problemAgitation" | "solutionIntro"
  | "whyOldFail" | "uniqueMechanism" | "testimonials" | "insiderAdvantages"
  | "scarcityUrgency" | "shockingStat" | "timeSavingBenefit" | "consultationOutline"
  | "guarantee" | "faq" | "coachAuthority" | "socialProofGallery" | "gradientCta" | "finalCta";

export interface CoachAssetOptions {
  headshotUrl?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  socialProofUrls?: string[];
  pressLogoUrls?: string[];
  coachName?: string | null;
  coachBackground?: string | null;
}

export interface PageTypeLayout {
  order: SectionKey[];
  heroLayout: "split" | "centered" | "offset";
  typeSpecificSections?: {
    eventStrip?: boolean;
    downloadBadge?: boolean;
    bookingCue?: boolean;
  };
}

export interface TemplateConfig {
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
