/**
 * Export utilities for ZAP Campaigns — TXT, PDF, and ZIP downloads.
 */
import jsPDF from "jspdf";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
}

function dateStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── TXT Export ───────────────────────────────────────────────────────────────
export function downloadTxt(content: string, serviceName: string, nodeName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const filename = `ZAP_${sanitizeFilename(serviceName)}_${sanitizeFilename(nodeName)}_${dateStr()}.txt`;
  downloadBlob(blob, filename);
}

// ─── TXT formatters per node ──────────────────────────────────────────────────
export function formatIcpTxt(data: any): string {
  if (!data) return "";
  const sections = [
    ["Introduction", data.introduction],
    ["Demographics", typeof data.demographics === "object" ? Object.entries(data.demographics || {}).map(([k, v]) => `  ${k}: ${v}`).join("\n") : data.demographics],
    ["Fears", data.fears],
    ["Hopes & Dreams", data.hopesDreams],
    ["Psychographics", data.psychographics],
    ["Pains", data.pains],
    ["Frustrations", data.frustrations],
    ["Goals", data.goals],
    ["Values", data.values],
    ["Objections", data.objections],
    ["Buying Triggers", data.buyingTriggers],
    ["Media Consumption", data.mediaConsumption],
    ["Influencers", data.influencers],
    ["Communication Style", data.communicationStyle],
    ["Decision Making", data.decisionMaking],
    ["Success Metrics", data.successMetrics],
    ["Implementation Barriers", data.implementationBarriers],
  ];
  return sections.filter(([, v]) => v).map(([label, val]) => `== ${label} ==\n${val}`).join("\n\n");
}

export function formatOfferTxt(data: any): string {
  if (!data) return "";
  const angles = ["godfatherAngle", "freeAngle", "dollarAngle"];
  const labels = ["GODFATHER ANGLE", "FREE ANGLE", "DOLLAR ANGLE"];
  return angles.map((key, i) => {
    const angle = typeof data[key] === "string" ? JSON.parse(data[key]) : data[key];
    if (!angle) return "";
    return `== ${labels[i]} ==\nOffer Name: ${angle.offerName || ""}\nValue Proposition: ${angle.valueProposition || ""}\nPricing: ${angle.pricing || ""}\nBonuses: ${angle.bonuses || ""}\nGuarantee: ${angle.guarantee || ""}\nUrgency: ${angle.urgency || ""}\nCTA: ${angle.cta || ""}`;
  }).filter(Boolean).join("\n\n---\n\n");
}

export function formatMechanismsTxt(data: any[]): string {
  if (!Array.isArray(data)) return "";
  return data.map((m, i) => `== Mechanism ${i + 1} ==\nName: ${m.mechanismName || ""}\nDescription: ${m.mechanismDescription || ""}`).join("\n\n");
}

export function formatHvcoTxt(data: any[]): string {
  if (!Array.isArray(data)) return "";
  return data.map((t, i) => `== Title ${i + 1} ==\n${t.title || ""}`).join("\n\n");
}

export function formatHeadlinesTxt(data: any): string {
  if (!data) return "";
  const groups = typeof data === "object" && !Array.isArray(data) ? data : { all: data };
  return Object.entries(groups).map(([formula, headlines]: [string, any]) => {
    if (!Array.isArray(headlines)) return "";
    return `== ${formula.toUpperCase()} ==\n${headlines.map((h: any, i: number) => `${i + 1}. ${h.headline || h}`).join("\n")}`;
  }).filter(Boolean).join("\n\n");
}

export function formatAdCopyTxt(data: any[]): string {
  if (!Array.isArray(data)) return "";
  const headlines = data.filter((d: any) => d.contentType === "headline");
  const bodies = data.filter((d: any) => d.contentType === "body");
  const links = data.filter((d: any) => d.contentType === "link");
  let txt = "";
  if (headlines.length) txt += `== AD HEADLINES ==\n${headlines.map((h: any, i: number) => `${i + 1}. ${h.content}`).join("\n")}\n\n`;
  if (bodies.length) txt += `== AD BODY COPY ==\n${bodies.map((b: any, i: number) => `--- Body ${i + 1} ---\nHook: ${(b.content || "").split("\n")[0]}\nBody: ${b.content}\nCTA: ${(b.content || "").split("\n").pop()}`).join("\n\n")}\n\n`;
  if (links.length) txt += `== LINK DESCRIPTIONS ==\n${links.map((l: any, i: number) => `${i + 1}. ${l.content}`).join("\n")}`;
  return txt;
}

export function formatLandingPageTxt(data: any, angle: string): string {
  if (!data) return "";
  const angleKey = `${angle}Angle`;
  const content = typeof data[angleKey] === "string" ? JSON.parse(data[angleKey]) : data[angleKey];
  if (!content) return "";
  const sections = [
    ["Eyebrow Headline", content.eyebrowHeadline],
    ["Main Headline", content.mainHeadline],
    ["Subheadline", content.subheadline],
    ["Primary CTA", content.primaryCta],
    ["Problem Agitation", typeof content.problemAgitation === "object" ? `${content.problemAgitation.headline}\n${content.problemAgitation.content}` : content.problemAgitation],
    ["Solution Intro", typeof content.solutionIntro === "object" ? `${content.solutionIntro.headline}\n${content.solutionIntro.content}` : content.solutionIntro],
    ["Why Old Methods Fail", typeof content.whyOldFail === "object" ? `${content.whyOldFail.headline}\n${content.whyOldFail.content}` : content.whyOldFail],
    ["Unique Mechanism", typeof content.uniqueMechanism === "object" ? `${content.uniqueMechanism.headline}\n${content.uniqueMechanism.content}` : content.uniqueMechanism],
    ["Testimonials", Array.isArray(content.testimonials) ? content.testimonials.map((t: any) => `"${t.quote}" — ${t.name}, ${t.location}`).join("\n\n") : ""],
    ["Scarcity/Urgency", typeof content.scarcityUrgency === "object" ? `${content.scarcityUrgency.headline}\n${content.scarcityUrgency.content}` : content.scarcityUrgency],
    ["Shocking Stat", typeof content.shockingStat === "object" ? `${content.shockingStat.headline}\n${content.shockingStat.content}` : content.shockingStat],
  ];
  return `Landing Page — ${angle.toUpperCase()} Angle\n\n` + sections.filter(([, v]) => v).map(([label, val]) => `== ${label} ==\n${val}`).join("\n\n");
}

export function formatEmailsTxt(data: any): string {
  if (!data) return "";
  const emails = typeof data.emails === "string" ? JSON.parse(data.emails) : data.emails;
  if (!Array.isArray(emails)) return "";
  return emails.map((e: any, i: number) => `== Email ${i + 1} ==\nSubject: ${e.subject || ""}\n\n${e.body || ""}`).join("\n\n---\n\n");
}

export function formatWhatsAppTxt(data: any): string {
  if (!data) return "";
  const messages = typeof data.messages === "string" ? JSON.parse(data.messages) : data.messages;
  if (!Array.isArray(messages)) return "";
  return messages.map((m: any, i: number) => `== Message ${i + 1} ==\n${m.text || m.message || ""}`).join("\n\n---\n\n");
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
export function downloadPdf(content: string, serviceName: string, nodeName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  // Background
  doc.setFillColor(245, 241, 234); // #F5F1EA
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 91, 29); // #FF5B1D
  doc.text(`ZAP Campaigns — ${nodeName}`, margin, 25);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`${serviceName} · Generated ${new Date().toLocaleDateString()}`, margin, 33);

  // Content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(26, 22, 36); // #1A1624

  const lines = doc.splitTextToSize(content, maxWidth);
  let y = 45;
  const lineHeight = 5.5;

  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      doc.setFillColor(245, 241, 234);
      doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");
      y = 20;
    }

    // Section headers (lines starting with ==)
    if (line.startsWith("==") && line.endsWith("==")) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 91, 29);
      doc.text(line.replace(/==/g, "").trim(), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(26, 22, 36);
      y += 3;
    } else {
      doc.text(line, margin, y);
    }
    y += lineHeight;
  }

  const filename = `ZAP_${sanitizeFilename(serviceName)}_${sanitizeFilename(nodeName)}_${dateStr()}.pdf`;
  doc.save(filename);
}

// ─── Campaign Brief PDF ──────────────────────────────────────────────────────
export function downloadCampaignBrief(briefData: {
  serviceName: string;
  icpSummary: string;
  offerName: string;
  mechanismName: string;
  hvcoTitle: string;
  headline: string;
  adHook: string;
  landingPageHeadline: string;
  email1Subject: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Background
  doc.setFillColor(245, 241, 234);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 91, 29);
  doc.text("Campaign Brief", margin, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(150, 150, 150);
  doc.text(`${briefData.serviceName} · ${new Date().toLocaleDateString()}`, margin, 40);

  // Divider
  doc.setDrawColor(255, 91, 29);
  doc.setLineWidth(0.5);
  doc.line(margin, 45, pageWidth - margin, 45);

  let y = 58;
  const items = [
    ["ICP Summary", briefData.icpSummary],
    ["Offer", briefData.offerName],
    ["Unique Method", briefData.mechanismName],
    ["Lead Magnet", briefData.hvcoTitle],
    ["Headline", briefData.headline],
    ["Ad Hook", briefData.adHook],
    ["Landing Page Headline", briefData.landingPageHeadline],
    ["Email 1 Subject", briefData.email1Subject],
  ];

  for (const [label, value] of items) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 91, 29);
    doc.text(label.toUpperCase(), margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(26, 22, 36);
    const lines = doc.splitTextToSize(value, pageWidth - margin * 2);
    for (const line of lines) {
      doc.text(line, margin, y);
      y += 6;
    }
    y += 6;
  }

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text("Generated by ZAP Campaigns — zapcampaigns.com", margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`ZAP_${sanitizeFilename(briefData.serviceName)}_Campaign_Brief_${dateStr()}.pdf`);
}
