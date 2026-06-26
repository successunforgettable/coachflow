// server/lib/templates/energetic.ts
// Kong-caliber direct-response template: tight tracking, black + electric orange,
// gradient CTAs, alternating dark/light, shadow-heavy testimonial cards.
import type { TemplateConfig } from "./types";

export const ENERGETIC: TemplateConfig = {
  id: "energetic",
  label: "Energetic",

  // Typography — Sora (geometric, modern heading) + Space Grotesk (clean body)
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
