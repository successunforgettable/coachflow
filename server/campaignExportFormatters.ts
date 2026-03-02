/**
 * Item 2.4 — Campaign Export Formatters
 * One function per step, each returns a Markdown string.
 * All functions are pure (no DB calls) — they receive pre-fetched rows.
 */

import type {
  Offer,
  HeroMechanism,
  HvcoTitle,
  Headline,
  IdealCustomerProfile,
  AdCopy,
  LandingPage,
  EmailSequence,
  WhatsappSequence,
  VideoScript,
} from "../drizzle/schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hr(): string {
  return "\n\n---\n\n";
}

function section(title: string, content: string): string {
  return `## ${title}\n\n${content.trim()}`;
}

function subsection(title: string, content: string): string {
  return `### ${title}\n\n${content.trim()}`;
}

// ─── Step 1: Sales Offer ────────────────────────────────────────────────────

export function formatSalesOffer(offers: Offer[]): string {
  if (offers.length === 0) return "";

  const parts: string[] = ["# Sales Offer\n"];

  for (const offer of offers) {
    parts.push(`## ${offer.productName || "Offer"}\n`);

    const angles: Array<{ key: keyof Offer; label: string }> = [
      { key: "godfatherAngle", label: "Godfather Angle" },
      { key: "freeAngle", label: "Free Angle" },
      { key: "dollarAngle", label: "Dollar Angle" },
    ];

    for (const { key, label } of angles) {
      const angle = offer[key] as any;
      if (!angle) continue;

      parts.push(`### ${label}\n`);
      if (angle.offerName) parts.push(`**Offer Name:** ${angle.offerName}\n`);
      if (angle.valueProposition) parts.push(`**Value Proposition:** ${angle.valueProposition}\n`);
      if (angle.pricing) parts.push(`**Pricing:** ${angle.pricing}\n`);
      if (angle.bonuses) parts.push(`**Bonuses:** ${angle.bonuses}\n`);
      if (angle.guarantee) parts.push(`**Guarantee:** ${angle.guarantee}\n`);
      if (angle.urgency) parts.push(`**Urgency:** ${angle.urgency}\n`);
      if (angle.cta) parts.push(`**Call to Action:** ${angle.cta}\n`);
      parts.push("");
    }

    parts.push("---\n");
  }

  return parts.join("\n");
}

// ─── Step 2: Unique Method (Hero Mechanisms) ────────────────────────────────

export function formatUniqueMethod(mechanisms: HeroMechanism[]): string {
  if (mechanisms.length === 0) return "";

  // Group by mechanismSetId, take the most recent set
  const setIdArr = Array.from(new Set(mechanisms.map((m) => m.mechanismSetId)));
  const latestSetId = setIdArr[setIdArr.length - 1];
  const latestSet = mechanisms.filter((m) => m.mechanismSetId === latestSetId);

  const tabOrder: Array<{ type: HeroMechanism["tabType"]; label: string }> = [
    { type: "hero_mechanisms", label: "Hero Mechanisms" },
    { type: "headline_ideas", label: "Headline Ideas" },
    { type: "beast_mode", label: "Beast Mode" },
  ];

  const parts: string[] = ["# Unique Method\n"];

  for (const { type, label } of tabOrder) {
    const tab = latestSet.filter((m) => m.tabType === type);
    if (tab.length === 0) continue;

    parts.push(`## ${label}\n`);
    tab.forEach((m, i) => {
      parts.push(`### ${i + 1}. ${m.mechanismName}\n`);
      parts.push(`${m.mechanismDescription}\n`);
    });
  }

  return parts.join("\n");
}

// ─── Step 3: Free Opt-In (HVCO Titles) ─────────────────────────────────────

export function formatFreeOptIn(titles: HvcoTitle[]): string {
  if (titles.length === 0) return "";

  // Take the most recent hvcoSetId
  const setIdArr = Array.from(new Set(titles.map((t) => t.hvcoSetId)));
  const latestSetId = setIdArr[setIdArr.length - 1];
  const latestSet = titles.filter((t) => t.hvcoSetId === latestSetId);

  const tabOrder: Array<{ type: HvcoTitle["tabType"]; label: string }> = [
    { type: "long", label: "Long Titles" },
    { type: "short", label: "Short Titles" },
    { type: "beast_mode", label: "Beast Mode Titles" },
    { type: "subheadlines", label: "Subheadlines" },
  ];

  const parts: string[] = ["# Free Opt-In (HVCO Titles)\n"];

  for (const { type, label } of tabOrder) {
    const tab = latestSet.filter((t) => t.tabType === type);
    if (tab.length === 0) continue;

    parts.push(`## ${label}\n`);
    tab.forEach((t, i) => {
      parts.push(`${i + 1}. ${t.title}`);
    });
    parts.push("");
  }

  return parts.join("\n");
}

// ─── Step 4: Headlines ──────────────────────────────────────────────────────

export function formatHeadlines(headlines: Headline[]): string {
  if (headlines.length === 0) return "";

  // Take the most recent headlineSetId
  const setIdArr = Array.from(new Set(headlines.map((h) => h.headlineSetId)));
  const latestSetId = setIdArr[setIdArr.length - 1];
  const latestSet = headlines.filter((h) => h.headlineSetId === latestSetId);

  const formulaOrder: Array<{ type: Headline["formulaType"]; label: string }> = [
    { type: "story", label: "Story Headlines" },
    { type: "eyebrow", label: "Eyebrow Headlines" },
    { type: "question", label: "Question Headlines" },
    { type: "authority", label: "Authority Headlines" },
    { type: "urgency", label: "Urgency Headlines" },
  ];

  const parts: string[] = ["# Direct Response Headlines\n"];

  for (const { type, label } of formulaOrder) {
    const group = latestSet.filter((h) => h.formulaType === type);
    if (group.length === 0) continue;

    parts.push(`## ${label}\n`);
    group.forEach((h, i) => {
      parts.push(`${i + 1}. ${h.headline}`);
      if (h.eyebrow) parts.push(`   *Eyebrow: ${h.eyebrow}*`);
      if (h.subheadline) parts.push(`   *Subheadline: ${h.subheadline}*`);
    });
    parts.push("");
  }

  return parts.join("\n");
}

// ─── Step 5: Ideal Customer Profile ─────────────────────────────────────────

export function formatIdealCustomerProfile(icps: IdealCustomerProfile[]): string {
  if (icps.length === 0) return "";

  const parts: string[] = ["# Ideal Customer Profile\n"];

  icps.forEach((icp, idx) => {
    if (idx > 0) parts.push("---\n");

    parts.push(`## ${icp.name || `ICP ${idx + 1}`}\n`);

    const tabs: Array<{ field: keyof IdealCustomerProfile; label: string }> = [
      { field: "introduction", label: "Introduction" },
      { field: "fears", label: "Fears" },
      { field: "hopesDreams", label: "Hopes & Dreams" },
      { field: "psychographics", label: "Psychographics" },
      { field: "pains", label: "Pains" },
      { field: "frustrations", label: "Frustrations" },
      { field: "goals", label: "Goals" },
      { field: "values", label: "Values" },
      { field: "objections", label: "Objections" },
      { field: "buyingTriggers", label: "Buying Triggers" },
      { field: "mediaConsumption", label: "Media Consumption" },
      { field: "influencers", label: "Influencers" },
      { field: "communicationStyle", label: "Communication Style" },
      { field: "decisionMaking", label: "Decision Making" },
      { field: "successMetrics", label: "Success Metrics" },
      { field: "implementationBarriers", label: "Implementation Barriers" },
    ];

    for (const { field, label } of tabs) {
      const value = icp[field];
      if (!value) continue;
      parts.push(`### ${label}\n`);
      parts.push(`${value}\n`);
    }

    // Demographics as a table
    if (icp.demographics) {
      const d = icp.demographics as any;
      parts.push("### Demographics\n");
      parts.push("| Field | Value |");
      parts.push("|-------|-------|");
      if (d.ageRange) parts.push(`| Age Range | ${d.ageRange} |`);
      if (d.occupation) parts.push(`| Occupation | ${d.occupation} |`);
      if (d.incomeLevel) parts.push(`| Income Level | ${d.incomeLevel} |`);
      if (d.location) parts.push(`| Location | ${d.location} |`);
      if (d.education) parts.push(`| Education | ${d.education} |`);
      if (d.familyStatus) parts.push(`| Family Status | ${d.familyStatus} |`);
      parts.push("");
    }
  });

  return parts.join("\n");
}

// ─── Step 6: Ad Copy ────────────────────────────────────────────────────────

export function formatAdCopy(adCopies: AdCopy[]): string {
  if (adCopies.length === 0) return "";

  // Group by adSetId
  const setMap = new Map<string, AdCopy[]>();
  for (const ad of adCopies) {
    const existing = setMap.get(ad.adSetId) || [];
    existing.push(ad);
    setMap.set(ad.adSetId, existing);
  }

  const parts: string[] = ["# Ad Copy\n"];

  for (const [setId, ads] of Array.from(setMap.entries())) {
    const first = ads[0];
    const setLabel = [first.adStyle, first.adCallToAction].filter(Boolean).join(" — ") || setId;
    parts.push(`## ${setLabel}\n`);

    const headlines = ads.filter((a: AdCopy) => a.contentType === "headline");
    const bodies = ads.filter((a: AdCopy) => a.contentType === "body");
    const links = ads.filter((a: AdCopy) => a.contentType === "link");

    if (headlines.length > 0) {
      parts.push("### Headlines\n");
      headlines.forEach((a: AdCopy, i: number) => parts.push(`${i + 1}. ${a.content}`));
      parts.push("");
    }
    if (bodies.length > 0) {
      parts.push("### Body Copy\n");
      bodies.forEach((a: AdCopy, i: number) => {
        parts.push(`**Variation ${i + 1}**`);
        parts.push(`${a.content}\n`);
      });
    }
    if (links.length > 0) {
      parts.push("### Link Text\n");
      links.forEach((a: AdCopy, i: number) => parts.push(`${i + 1}. ${a.content}`));
      parts.push("");
    }

    parts.push("---\n");
  }

  return parts.join("\n");
}

// ─── Step 8: Video Scripts (text companion for video files) ─────────────────

export function formatVideoScripts(scripts: VideoScript[]): string {
  if (scripts.length === 0) return "";

  const parts: string[] = ["# Video Scripts\n"];

  scripts.forEach((script, idx) => {
    parts.push(`## Script ${idx + 1}: ${script.videoType} — ${script.duration}s (${script.visualStyle})\n`);

    const scenes = script.scenes as Array<{
      sceneNumber: number;
      duration: number;
      voiceoverText: string;
      visualDirection: string;
      onScreenText: string;
    }>;

    if (Array.isArray(scenes)) {
      parts.push("### Scenes\n");
      scenes.forEach((scene) => {
        parts.push(`**Scene ${scene.sceneNumber}** (${scene.duration}s)`);
        if (scene.onScreenText) parts.push(`- On Screen: ${scene.onScreenText}`);
        if (scene.visualDirection) parts.push(`- Visual: ${scene.visualDirection}`);
        if (scene.voiceoverText) parts.push(`- Voiceover: ${scene.voiceoverText}`);
        parts.push("");
      });
    }

    parts.push("### Full Voiceover\n");
    parts.push(`${script.voiceoverText}\n`);
    parts.push("---\n");
  });

  return parts.join("\n");
}

// ─── Step 9: Landing Page ───────────────────────────────────────────────────

export function formatLandingPage(pages: LandingPage[]): string {
  if (pages.length === 0) return "";

  const page = pages[0]; // Use most recent
  const parts: string[] = ["# Landing Page\n"];

  if (page.activeAngle) {
    parts.push(`*Active angle: **${page.activeAngle}***\n`);
  }

  const angles: Array<{ key: keyof LandingPage; label: string }> = [
    { key: "originalAngle", label: "Original Angle" },
    { key: "godfatherAngle", label: "Godfather Angle" },
    { key: "freeAngle", label: "Free Angle" },
    { key: "dollarAngle", label: "Dollar Angle" },
  ];

  for (const { key, label } of angles) {
    const angle = page[key] as any;
    if (!angle) continue;

    parts.push(`## ${label}\n`);

    const fields: Array<{ field: string; label: string }> = [
      { field: "eyebrowHeadline", label: "Eyebrow Headline" },
      { field: "mainHeadline", label: "Main Headline" },
      { field: "subheadline", label: "Subheadline" },
      { field: "primaryCta", label: "Primary CTA" },
      { field: "problemAgitation", label: "Problem Agitation" },
      { field: "solutionIntro", label: "Solution Introduction" },
      { field: "whyOldFail", label: "Why Old Solutions Fail" },
      { field: "uniqueMechanism", label: "Unique Mechanism" },
      { field: "insiderAdvantages", label: "Insider Advantages" },
      { field: "scarcityUrgency", label: "Scarcity & Urgency" },
      { field: "shockingStat", label: "Shocking Statistic" },
      { field: "timeSavingBenefit", label: "Time-Saving Benefit" },
    ];

    for (const { field, label: fieldLabel } of fields) {
      if (angle[field]) {
        parts.push(`### ${fieldLabel}\n`);
        parts.push(`${angle[field]}\n`);
      }
    }

    // asSeenIn
    if (Array.isArray(angle.asSeenIn) && angle.asSeenIn.length > 0) {
      parts.push("### As Seen In\n");
      parts.push(angle.asSeenIn.join(", ") + "\n");
    }

    // quizSection
    if (angle.quizSection) {
      parts.push("### Quiz Section\n");
      parts.push(`**Question:** ${angle.quizSection.question}`);
      if (Array.isArray(angle.quizSection.options)) {
        (angle.quizSection.options as string[]).forEach((opt: string, i: number) => {
          parts.push(`${i + 1}. ${opt}`);
        });
      }
      if (angle.quizSection.answer) parts.push(`**Answer:** ${angle.quizSection.answer}`);
      parts.push("");
    }

    // testimonials
    if (Array.isArray(angle.testimonials) && angle.testimonials.length > 0) {
      parts.push("### Testimonials\n");
      (angle.testimonials as any[]).forEach((t: any) => {
        parts.push(`**${t.headline}**`);
        parts.push(`> ${t.quote}`);
        parts.push(`— ${t.name}, ${t.location}\n`);
      });
    }

    // consultationOutline
    if (Array.isArray(angle.consultationOutline) && angle.consultationOutline.length > 0) {
      parts.push("### Consultation Outline\n");
      (angle.consultationOutline as any[]).forEach((item: any, i: number) => {
        parts.push(`${i + 1}. **${item.title}**: ${item.description}`);
      });
      parts.push("");
    }

    parts.push("---\n");
  }

  return parts.join("\n");
}

// ─── Step 10: Email Follow-Up ───────────────────────────────────────────────

export function formatEmailSequence(sequences: EmailSequence[]): string {
  if (sequences.length === 0) return "";

  const parts: string[] = ["# Email Follow-Up Sequence\n"];

  for (const seq of sequences) {
    parts.push(`## ${seq.name}${seq.sequenceType ? ` (${seq.sequenceType})` : ""}\n`);

    const emails = (seq.emails as Array<{ day: number; subject: string; body: string; timing: string }>) || [];
    const sorted = [...emails].sort((a, b) => a.day - b.day);

    for (const email of sorted) {
      parts.push(`### Day ${email.day} — ${email.subject}\n`);
      if (email.timing) parts.push(`*Timing: ${email.timing}*\n`);
      parts.push(`${email.body}\n`);
    }

    parts.push("---\n");
  }

  return parts.join("\n");
}

// ─── Step 11: WhatsApp Follow-Up ────────────────────────────────────────────

export function formatWhatsappSequence(sequences: WhatsappSequence[]): string {
  if (sequences.length === 0) return "";

  const parts: string[] = ["# WhatsApp Follow-Up Sequence\n"];

  for (const seq of sequences) {
    parts.push(`## ${seq.name}${seq.sequenceType ? ` (${seq.sequenceType})` : ""}\n`);

    const messages = (seq.messages as Array<{ day: number; message: string; timing: string; emojis: string[] }>) || [];
    const sorted = [...messages].sort((a, b) => a.day - b.day);

    for (const msg of sorted) {
      const emojiStr = Array.isArray(msg.emojis) && msg.emojis.length > 0 ? ` ${msg.emojis.join(" ")}` : "";
      parts.push(`### Day ${msg.day}${emojiStr}\n`);
      if (msg.timing) parts.push(`*Timing: ${msg.timing}*\n`);
      parts.push(`${msg.message}\n`);
    }

    parts.push("---\n");
  }

  return parts.join("\n");
}

// ─── README.txt Generator ───────────────────────────────────────────────────

export interface StepSummary {
  number: number;
  name: string;
  included: boolean;
  reason?: string; // e.g. "No assets generated"
  warnings?: string[]; // e.g. "image-42.png — HTTP 404"
}

export function generateReadme(
  campaignName: string,
  exportDate: Date,
  steps: StepSummary[]
): string {
  const included = steps.filter((s) => s.included);
  const skipped = steps.filter((s) => !s.included);
  const allWarnings = steps.flatMap((s) => s.warnings || []);

  const lines: string[] = [
    "ZAP Campaign Export",
    "===================",
    "",
    `Campaign: ${campaignName}`,
    `Exported: ${exportDate.toUTCString()}`,
    `Steps included: ${included.length} of ${steps.length}`,
    "",
    "INCLUDED STEPS",
    "--------------",
  ];

  for (const s of included) {
    lines.push(`  Step ${s.number.toString().padStart(2, "0")} — ${s.name}`);
  }

  if (skipped.length > 0) {
    lines.push("");
    lines.push("SKIPPED STEPS");
    lines.push("-------------");
    for (const s of skipped) {
      lines.push(`  Step ${s.number.toString().padStart(2, "0")} — ${s.name}: ${s.reason || "No assets generated"}`);
    }
  }

  if (allWarnings.length > 0) {
    lines.push("");
    lines.push("WARNINGS");
    lines.push("--------");
    for (const w of allWarnings) {
      lines.push(`  SKIPPED: ${w}`);
    }
  }

  lines.push("");
  lines.push("Generated by ZAP — https://zap.manus.space");

  return lines.join("\n");
}
