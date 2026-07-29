/**
 * P9 live proof — publish a lead-magnet landing page under the EXACT conditions
 * that produced the six defects, so the screenshot at /p/{slug} tests the fix
 * against the real failure case:
 *
 *   no coachName        -> "yourbrand" / "YOUR BRAND'S" (P9-1)
 *   no trustCount       -> five stars + "Trusted by high achievers" (P9-2)
 *   137-char magnet     -> cover clipped by the FREE badge (P9-3), the
 *                          four-line orange run-on (P9-5)
 *   article-led magnet  -> "Get Your Free The 3-Night…" (P9-4)
 *   no solutionIntro?   -> the "Use it every day" filler (P9-6)
 *
 * WRITES: one landingPages row + one Cloudflare KV entry. Prints both so
 * teardown can remove exactly those.
 *
 *   railway run --environment production --service coachflow \
 *     npx tsx scripts/p9-publish-proof.mjs
 *   ... --teardown=<id> --slug=<slug>   to reverse it
 */
import { getDb } from "../server/db.ts";
import { landingPages } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { runLandingPagePublish } from "../server/landingPagePublisher.ts";

const arg = (n, d) => { const m = process.argv.find(a => a.startsWith(`--${n}=`)); return m ? m.slice(n.length + 3) : d; };
const USER = 117174;
const SERVICE = 277;

const MAGNET = "The 3-Night Settling Sequence Reset: How Exhausted First-Time Parents Get Their Baby Sleeping Through The Night Without Cry-It-Out";

const db = await getDb();
if (!db) throw new Error("no db");

const teardownId = arg("teardown", null);
if (teardownId) {
  const [row] = await db.select().from(landingPages).where(eq(landingPages.id, Number(teardownId))).limit(1);
  console.log(`TEARDOWN_ROW ${row ? `found id=${row.id} publicUrl=${row.publicUrl ?? "-"}` : "NOT FOUND"}`);
  const r = await db.delete(landingPages).where(eq(landingPages.id, Number(teardownId)));
  console.log(`TEARDOWN_DELETED ${r?.affectedRows ?? 0}`);
  process.exit(0);
}

const content = {
  eyebrowHeadline: "",
  mainHeadline: `The 3-night reset that ends the 2am wake-ups`,
  subheadline: "A short, specific sequence you can start tonight — no cry-it-out, no rigid schedule.",
  primaryCta: "",                     // forces the fallback CTA slot (P9-5)
  asSeenIn: [],
  problemAgitation: "You have tried the wake windows, the sleep sacks and the dream feed, and nothing holds past three nights.",
  solutionIntro: "Three nights, one repeatable sequence, and a way to tell which part is actually breaking.",
  whyOldFail: "",
  uniqueMechanism: "",
  testimonials: [],
  featureHighlights: [
    "What to do on night one, in order",
    "How to read the 2am wake and respond",
    "The one change most parents skip",
  ],
};

const [inserted] = await db.insert(landingPages).values({
  userId: USER,
  serviceId: SERVICE,
  pageType: "lead_magnet_download",
  productName: MAGNET,
  productDescription: "Lead magnet landing page — P9 live proof (delete after screenshot).",
  originalAngle: content,
  activeAngle: "original",
}).$returningId?.() ?? [{}];

const [row] = await db.select({ id: landingPages.id }).from(landingPages)
  .where(eq(landingPages.userId, USER)).orderBy(landingPages.id).limit(1000)
  .then(rs => [rs[rs.length - 1]]);
const lpId = inserted?.id ?? row?.id;
console.log(`LP_ROW_CREATED id=${lpId}`);

const { publicUrl, slug } = await runLandingPagePublish({
  landingPageId: Number(lpId),
  userId: USER,
});
console.log(`PUBLISHED slug=${slug}`);
console.log(`PUBLIC_URL ${publicUrl}`);
console.log(`TEARDOWN npx tsx scripts/p9-publish-proof.mjs --teardown=${lpId}  (then purge KV key for slug ${slug})`);
process.exit(0);
