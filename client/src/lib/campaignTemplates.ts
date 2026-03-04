export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  campaignType: "webinar" | "challenge" | "course_launch" | "product_launch";
  assetSequence: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export const campaignTemplates: CampaignTemplate[] = [
  {
    id: "product-launch",
    name: "Product Launch Campaign",
    description: "Complete product launch sequence with pre-launch, launch, and post-launch phases",
    campaignType: "product_launch",
    assetSequence: [
      {
        type: "icp",
        title: "Ideal Customer Profile",
        description: "Define your target audience before creating any marketing materials",
      },
      {
        type: "headline",
        title: "Launch Headlines",
        description: "Attention-grabbing headlines for your launch campaign",
      },
      {
        type: "hero_mechanism",
        title: "Your Unique Method",
        description: "Unique mechanisms that make your product stand out",
      },
      {
        type: "email_sequence",
        title: "Pre-Launch Email Sequence",
        description: "Build anticipation with a 5-day pre-launch email sequence",
      },
      {
        type: "ad_copy",
        title: "Your Ads",
        description: "Paid ads to drive traffic to your launch",
      },
      {
        type: "landing_page",
        title: "Launch Landing Page",
        description: "High-converting landing page for your product launch",
      },
      {
        type: "offer",
        title: "Launch Offer",
        description: "Irresistible offer with bonuses and guarantees",
      },
      {
        type: "whatsapp_sequence",
        title: "WhatsApp Follow-Up",
        description: "Personal follow-up sequence for engaged leads",
      },
    ],
  },
  {
    id: "webinar-funnel",
    name: "Webinar Funnel",
    description: "Complete webinar funnel from registration to conversion",
    campaignType: "webinar",
    assetSequence: [
      {
        type: "icp",
        title: "Ideal Customer Profile",
        description: "Define who should attend your webinar",
      },
      {
        type: "headline",
        title: "Webinar Headlines",
        description: "Compelling headlines for your webinar registration page",
      },
      {
        type: "landing_page",
        title: "Webinar Registration Page",
        description: "Landing page to capture webinar registrations",
      },
      {
        type: "email_sequence",
        title: "Webinar Reminder Sequence",
        description: "Automated reminders to boost attendance",
      },
      {
        type: "ad_copy",
        title: "Webinar Promotion Ads",
        description: "Paid ads to drive registrations",
      },
      {
        type: "offer",
        title: "Webinar Offer",
        description: "Special offer presented during the webinar",
      },
      {
        type: "email_sequence",
        title: "Post-Webinar Follow-Up",
        description: "Follow-up sequence for attendees and no-shows",
      },
    ],
  },
  {
    id: "lead-magnet",
    name: "Lead Magnet Funnel",
    description: "Simple lead generation funnel with nurture sequence",
    campaignType: "course_launch",
    assetSequence: [
      {
        type: "icp",
        title: "Ideal Customer Profile",
        description: "Define your target lead profile",
      },
      {
        type: "headline",
        title: "Lead Magnet Headlines",
        description: "Headlines that make people want to download your lead magnet",
      },
      {
        type: "landing_page",
        title: "Lead Magnet Landing Page",
        description: "Simple opt-in page for your lead magnet",
      },
      {
        type: "ad_copy",
        title: "Lead Generation Ads",
        description: "Ads to drive traffic to your lead magnet",
      },
      {
        type: "email_sequence",
        title: "Welcome & Nurture Sequence",
        description: "7-day sequence to build trust and make an offer",
      },
      {
        type: "offer",
        title: "Tripwire Offer",
        description: "Low-ticket offer to convert leads into customers",
      },
    ],
  },
  {
    id: "challenge-funnel",
    name: "Challenge Funnel",
    description: "5-day challenge funnel with daily engagement and conversion",
    campaignType: "challenge",
    assetSequence: [
      {
        type: "icp",
        title: "Ideal Customer Profile",
        description: "Define who should join your challenge",
      },
      {
        type: "headline",
        title: "Challenge Headlines",
        description: "Exciting headlines for your challenge registration",
      },
      {
        type: "landing_page",
        title: "Challenge Registration Page",
        description: "Landing page to capture challenge sign-ups",
      },
      {
        type: "ad_copy",
        title: "Challenge Promotion Ads",
        description: "Ads to drive challenge registrations",
      },
      {
        type: "email_sequence",
        title: "Challenge Daily Emails",
        description: "Daily emails with lessons and action steps",
      },
      {
        type: "whatsapp_sequence",
        title: "Challenge WhatsApp Updates",
        description: "Daily WhatsApp messages for engagement",
      },
      {
        type: "offer",
        title: "Challenge Upgrade Offer",
        description: "Premium offer presented at the end of the challenge",
      },
    ],
  },
];

export function getTemplateById(id: string): CampaignTemplate | undefined {
  return campaignTemplates.find((t) => t.id === id);
}

export function getTemplatesByCampaignType(type: string): CampaignTemplate[] {
  return campaignTemplates.filter((t) => t.campaignType === type);
}
