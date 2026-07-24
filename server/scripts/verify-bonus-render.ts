import "dotenv/config";
import { writeFileSync } from "fs";

// Clean-room verification of the bonus CORRECTNESS fixes (register/framing · <pre>→markdown · howToUse · what-it-is).
// Regenerates each bonus body with mode:"bonus" and renders through the NEW renderer to a standalone HTML file, so
// the result can be eyeballed. Read-only DB (SELECT only); no publish (renders to local files).
async function main() {
  const { getDb } = await import("../db");
  const { bonuses } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { generateLeadMagnetContent } = await import("../leadMagnetContentGenerator");
  const { bonusFormatToLeadMagnet } = await import("../bonusPdfGenerator");
  const { renderDeliverableHtml } = await import("../leadMagnetRenderer");

  const db = await getDb();
  if (!db) throw new Error("no db");
  const KIT = Number(process.argv[2] || 15);
  const rows = await db.select().from(bonuses).where(eq(bonuses.campaignKitId, KIT));
  console.log(`kit ${KIT}: ${rows.length} bonuses`);

  for (const b of rows) {
    if (!b.serviceId) { console.log(`bonus ${b.id}: no serviceId, skip`); continue; }
    const { leadMagnetFormat } = bonusFormatToLeadMagnet(b.format);
    const contentBrief = `${b.description}\n\nThis asset solves this specific buyer obstacle: ${b.derivedFromObstacle}`;
    console.log(`\nbonus ${b.id} (${b.bonusType}, ${b.format}→${leadMagnetFormat}) "${b.title}" — generating (mode=bonus)…`);
    const body = await generateLeadMagnetContent({
      userId: b.userId, serviceId: b.serviceId, icpId: null, campaignId: b.campaignId ?? null,
      title: b.title, formatOverride: leadMagnetFormat, contentBrief, mode: "bonus",
    });
    if (!body) { console.log(`  ✗ no body`); continue; }
    writeFileSync(`/tmp/bonus-body-${b.id}.json`, JSON.stringify(body, null, 2)); // persist so re-render needs no LLM
    const html = renderDeliverableHtml(body);
    if (!html) { console.log(`  ✗ no html`); continue; }
    const path = `/tmp/bonus-new-${b.id}.html`;
    writeFileSync(path, html);
    // Quick correctness signals in the rendered HTML.
    const hasHowTo = /how to use/i.test(html);
    const noRawPre = !html.includes("<pre>");
    const noRawMd = !/(\|\s*-{3,}\s*\|)|(^|>)#{2,}\s/m.test(html);
    const hasFillin = html.includes('class="fillin"');
    const next = (body as any).nextStep?.ctaLabel || "";
    console.log(`  ✓ ${path}  [howToUse:${hasHowTo} noPre:${noRawPre} noRawMd:${noRawMd} fillin:${hasFillin}]`);
    console.log(`    nextStep.ctaLabel: "${next}"`);
    console.log(`    howToUse: ${((body as any).howToUse || "(none)").slice(0, 160)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
