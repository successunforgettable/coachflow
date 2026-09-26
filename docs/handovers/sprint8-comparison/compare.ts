// Sprint 8 before/after comparison — READ ONLY against production.
// Runs production's complianceAxis.ts (87596d7, copied to ./oldAxis.ts) and the held branch's over every
// stored copy item, and reports every verdict flip. No model calls. No writes: the session is READ ONLY and
// every statement runs inside START TRANSACTION READ ONLY, and the script refuses unless the target reports
// production's @@version_comment.
import mysql from "/Users/arfeenkhan/zap-deploy/node_modules/mysql2/promise.js";
import { writeFileSync } from "node:fs";
import * as OLD from "./oldAxis";
import * as NEW from "/Users/arfeenkhan/zap-deploy/server/_core/complianceAxis";
import { copyFieldsOf, copyFieldsOfJson } from "/Users/arfeenkhan/zap-deploy/server/_core/persistenceGate";
import { pageTextForAdMatch } from "/Users/arfeenkhan/zap-deploy/server/_core/landingPageActiveAngle";

type Role = "short" | "body" | "cta";
type Field = { location: string; text: string; role: Role };
type Item = { surface: string; id: string; fields: Field[]; meta?: boolean; control?: "to_allowed" | "to_blocked" };

const OUT = process.argv[2];
const LP_ROLES: Record<string, Role> = {
  eyebrowHeadline: "short", mainHeadline: "short", subheadline: "short", primaryCta: "cta",
};
const adRole = (t: unknown): Role => (t === "headline" || t === "image_hook" ? "short" : t === "link" ? "cta" : "body");
const body = (fs: Array<{ location: string; text: string }>, prefix = ""): Field[] =>
  fs.map((f) => ({ location: prefix + f.location, text: f.text, role: "body" as Role }));
const json = (v: unknown, p: string) => body(copyFieldsOfJson(v, p));

async function main() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL!, multipleStatements: false });
  await conn.query("SET SESSION TRANSACTION READ ONLY");
  await conn.query("START TRANSACTION READ ONLY");
  const [[v]] = (await conn.query("SELECT @@version_comment vc, @@transaction_read_only ro, DATABASE() db")) as any;
  if (v.vc !== "MySQL Community Server - GPL" || Number(v.ro) !== 1) throw new Error(`refusing: ${JSON.stringify(v)}`);
  const q = async (sql: string) => ((await conn.query(sql)) as any)[0] as any[];

  const items: Item[] = [];
  const adCopy = await q("SELECT * FROM adCopy");
  for (const r of adCopy) items.push({ surface: "adCopy", id: `adCopy#${r.id}(${r.contentType})`,
    fields: [{ location: String(r.contentType), text: String(r.content ?? ""), role: adRole(r.contentType) }] });
  for (const r of await q("SELECT * FROM headlines")) items.push({ surface: "headlines", id: `headlines#${r.id}`,
    fields: [["headline", r.headline], ["subheadline", r.subheadline], ["eyebrow", r.eyebrow]]
      .map(([k, t]) => ({ location: k as string, text: String(t ?? ""), role: "short" as Role })) });
  const lps = await q("SELECT * FROM landingPages");
  for (const r of lps) for (const a of ["originalAngle", "godfatherAngle", "freeAngle", "dollarAngle"]) {
    let c: any = r[a]; if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
    if (!c || typeof c !== "object") continue;
    const fields: Field[] = [];
    for (const [k, val] of Object.entries(c)) {
      if (typeof val === "string") fields.push({ location: `${a}.${k}`, text: val, role: LP_ROLES[k] ?? "body" });
      else fields.push(...json(val, `${a}.${k}`));
    }
    items.push({ surface: "landingPages", id: `landingPages#${r.id}.${a}`, fields });
  }
  for (const r of await q("SELECT * FROM emailSequences")) items.push({ surface: "emailSequences", id: `emailSequences#${r.id}`, fields: json(r.emails, "emails") });
  for (const r of await q("SELECT * FROM whatsappSequences")) items.push({ surface: "whatsappSequences", id: `whatsappSequences#${r.id}`, fields: json(r.messages, "messages") });
  for (const r of await q("SELECT * FROM offers")) items.push({ surface: "offers", id: `offers#${r.id}`,
    fields: [...json(r.godfatherAngle, "godfatherAngle"), ...json(r.freeAngle, "freeAngle"), ...json(r.dollarAngle, "dollarAngle")] });
  // Other gated generator outputs — role "body", as the persistence gate screens them.
  for (const r of await q("SELECT * FROM hvcoTitles")) items.push({ surface: "hvcoTitles", id: `hvcoTitles#${r.id}`,
    fields: [{ location: "title", text: String(r.title ?? ""), role: "short" }, ...json(r.assetBody, "assetBody")] });
  for (const r of await q("SELECT * FROM bonuses")) items.push({ surface: "bonuses", id: `bonuses#${r.id}`,
    fields: [...body(copyFieldsOf({ title: r.title, description: r.description, shortLine: r.shortLine })), ...json(r.assetBody, "assetBody")] });
  for (const r of await q("SELECT * FROM heroMechanisms")) items.push({ surface: "heroMechanisms", id: `heroMechanisms#${r.id}`,
    fields: body(copyFieldsOf({ mechanismName: r.mechanismName, mechanismDescription: r.mechanismDescription, descriptor: r.descriptor })) });
  for (const r of await q("SELECT * FROM campaignConcepts")) items.push({ surface: "campaignConcepts", id: `campaignConcepts#${r.id}`,
    fields: [{ location: "headline", text: String(r.headline ?? ""), role: "short" as Role },
      ...body(copyFieldsOf({ hook: r.hook, shortText: r.shortText, longText: r.longText }))] });
  for (const r of await q("SELECT * FROM conceptScripts")) items.push({ surface: "conceptScripts", id: `conceptScripts#${r.id}`,
    fields: [...json(r.scenes, "scenes"), ...body(copyFieldsOf({ teleprompter: r.teleprompter }))] });
  for (const r of await q("SELECT * FROM adCreatives")) items.push({ surface: "adCreatives", id: `adCreatives#${r.id}`,
    fields: [{ location: "headline", text: String(r.headline ?? ""), role: "short" as Role }, ...json(r.sceneBrief, "sceneBrief"), ...json(r.comparisonPairs, "comparisonPairs")] });

  // ── META-PUBLISH PATH ── exactly the publish gate's shape: headline short, body body, CTA cta, + ad-to-page.
  const pub = await q("SELECT id, userId, headlineAdCopyId, bodyAdCopyId, campaignName, status FROM meta_published_ads");
  const byId = new Map(adCopy.map((r) => [Number(r.id), r]));
  const lpByUser = new Map<number, any[]>();
  for (const r of lps) lpByUser.set(Number(r.userId), [...(lpByUser.get(Number(r.userId)) ?? []), r]);
  const metaPairs: Array<{ id: string; headline: string; body: string; pages: Array<{ id: number; text: string }> }> = [];
  for (const p of pub) {
    const h = byId.get(Number(p.headlineAdCopyId)), b = byId.get(Number(p.bodyAdCopyId));
    items.push({ surface: "META published ad", meta: true, id: `meta_published_ads#${p.id}(${p.status}) h=${p.headlineAdCopyId} b=${p.bodyAdCopyId}`,
      fields: [{ location: "headline", text: String(h?.content ?? ""), role: "short" }, { location: "body", text: String(b?.content ?? ""), role: "body" }] });
  }
  // Every headline × body pair in one ad set is a combination the Meta gate can be handed.
  const sets = new Map<string, any[]>();
  for (const r of adCopy) sets.set(String(r.adSetId), [...(sets.get(String(r.adSetId)) ?? []), r]);
  let pairCount = 0;
  const pageFlips: any[] = [];
  const pagesOf = (userId: number) => (lpByUser.get(userId) ?? []).map((lp) => ({ id: Number(lp.id), text: pageTextForAdMatch(lp) })).filter((x) => x.text);
  for (const [setId, rows] of Array.from(sets.entries())) {
    const hs = rows.filter((r) => r.contentType === "headline"), bs = rows.filter((r) => r.contentType === "body");
    const pages = pagesOf(Number(rows[0].userId));
    for (const h of hs) for (const b of bs) for (const pg of pages) {
      pairCount++;
      const ad = `${h.content} ${b.content}`;
      const o = OLD.checkAdToPageMatch(ad, pg.text).ok, n = NEW.checkAdToPageMatch(ad, pg.text).ok;
      if (o !== n) pageFlips.push({ setId, headline: h.id, body: b.id, page: pg.id, old: o, new: n });
    }
  }
  // Meta per-field replay of every ad-copy row under the publish gate's roles (headline short, body body, link cta).
  for (const r of adCopy.filter((r) => ["headline", "body", "link"].includes(r.contentType)))
    items.push({ surface: "META per-row (publish-gate roles)", meta: true, id: `adCopy#${r.id}(${r.contentType})`,
      fields: [{ location: String(r.contentType), text: String(r.content ?? ""), role: adRole(r.contentType) }] });

  // ── §15c NEGATIVE CONTROLS — sprint 8's own fixtures, one per direction. The run FAILS if either is not reported.
  items.push({ surface: "CONTROL", control: "to_allowed", id: "CONTROL afford-idiom", fields: [{ location: "body", text: "You can't afford to get this wrong.", role: "body" }] });
  items.push({ surface: "CONTROL", control: "to_blocked", id: "CONTROL digital-assets", fields: [{ location: "body", text: "start buying digital assets now", role: "body" }] });

  await conn.query("ROLLBACK");
  await conn.end();

  // ── Replay
  const sig = (hs: any[]) => hs.map((h) => `${h.classId}@${h.location}:${h.matched}`).sort().join(" | ");
  const perSurface: Record<string, { items: number; fields: number; blockedOld: number; blockedNew: number; toBlocked: number; toAllowed: number; sameVerdictHitsChanged: number }> = {};
  const flips: any[] = [];
  for (const it of items) {
    const fs = it.fields.filter((f) => f.text && f.text.trim());
    const o = OLD.checkComplianceAxis(fs), n = NEW.checkComplianceAxis(fs);
    const s = (perSurface[it.surface] ??= { items: 0, fields: 0, blockedOld: 0, blockedNew: 0, toBlocked: 0, toAllowed: 0, sameVerdictHitsChanged: 0 });
    s.items++; s.fields += fs.length; if (!o.ok) s.blockedOld++; if (!n.ok) s.blockedNew++;
    if (o.ok !== n.ok) {
      const dir = o.ok ? "ALLOWED→BLOCKED" : "BLOCKED→ALLOWED";
      if (o.ok) s.toBlocked++; else s.toAllowed++;
      const hits = o.ok ? n.blocking : o.blocking;
      flips.push({ surface: it.surface, id: it.id, dir, control: it.control,
        hits: hits.map((h) => ({ classId: h.classId, location: h.location, matched: h.matched,
          text: fs.find((f) => f.location === h.location)?.text ?? "" })) });
    } else if (sig(o.blocking) !== sig(n.blocking)) {
      s.sameVerdictHitsChanged++;
      flips.push({ surface: it.surface, id: it.id, dir: "SAME VERDICT, BLOCKING HITS CHANGED", old: o.blocking.map((h) => `${h.classId}:${h.matched}`), new: n.blocking.map((h) => `${h.classId}:${h.matched}`) });
    }
  }
  const ctl = (id: string, dir: string) => flips.some((f) => f.id === id && f.dir === dir);
  const controls = { afford_to_allowed: ctl("CONTROL afford-idiom", "BLOCKED→ALLOWED"), digital_to_blocked: ctl("CONTROL digital-assets", "ALLOWED→BLOCKED") };
  const report = { target: v, ranAt: new Date().toISOString(), oldAxis: "87596d7:server/_core/complianceAxis.ts", newAxis: "HEAD", perSurface, publishedMetaAds: pub.length, adToPagePairsChecked: pairCount, adToPageFlips: pageFlips, controls, flips };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ controls, perSurface, publishedMetaAds: pub.length, adToPagePairsChecked: pairCount, adToPageFlips: pageFlips.length, flipCount: flips.filter((f) => !f.control).length }, null, 1));
  if (!controls.afford_to_allowed || !controls.digital_to_blocked) { console.error("NEGATIVE CONTROL FAILED — the comparison cannot detect a flip"); process.exit(2); }
}
main().catch((e) => { console.error(e); process.exit(1); });
