# REGENERATION RUNBOOK — 2026-09-11

**Companion to the 2026-09-11 RESTART BLOCK in `CHECKPOINT.md`.** The scripts that ran the 5686 and 7173
regenerations lived in a session scratchpad under `/private/tmp`, which does not survive the session. They
are recorded here so the outstanding items can be run from a fresh terminal without rebuilding them.

🔴 **Nothing here is approval.** Every production write still needs Arfeen's "go ahead" in the message
immediately before it (CHECKPOINT §0.7 gate 1). Show the statement, hold, then run.

---

## 1. HOW TO RUN A STEP ON THE CONTAINER — the pattern that worked

Long steps (offer, body, publish) run the **deployed** code on the production container. Two ways they
failed on 2026-09-10/11, both recorded so nobody repeats them:

- **Detached with `nohup … &` → the process dies when the SSH session closes.** The first title dry run
  printed one log line and vanished (no process in `/proc`, nothing written).
- **Foreground with no output for ~50 s → this machine's network drops the idle connection.** 7173's body
  step died at 49 s: no write, no surviving process, temp file left behind.

**What works: foreground, with a 20-second heartbeat so the session is never idle.** Scripts must sit at
`/app` (Node resolves bare imports from the script's own directory). Transfer by base64, remove after,
and confirm the removal:

```bash
S=<local folder holding the script>; F=_step.ts
B64=$(base64 < $S/step.ts | tr -d '\n')
railway ssh --environment production --service coachflow "echo $B64 | base64 -d > /app/$F && cd /app && { npx tsx $F & pid=\$!; while kill -0 \$pid 2>/dev/null; do echo HEARTBEAT; sleep 20; done; wait \$pid; rc=\$?; }; rm -f /app/$F; ls /app/$F 2>/dev/null || echo TEMP_REMOVED; printf 'container sha=%s\n' \"\${RAILWAY_GIT_COMMIT_SHA:-unset}\"; exit \$rc" > $S/step.out 2>&1
```

If a step's connection drops anyway: scan `/proc` for the script name (`ps` is not installed), read the
target row's `updatedAt` to prove nothing was written, remove the temp file, rerun under a new filename.

## 2. THE WHOLE-DATABASE COMPARISON — run before and after EVERY step

Row count, max id, max `updatedAt` **and `CHECKSUM TABLE`** for all 58 tables. The checksum is what
catches an in-place UPDATE on a table with no `updatedAt` (a `jobs` status change was invisible to the
count/updatedAt version). Take the "before" immediately before the step (§15f), then `diff before after`.
Run locally: `railway run --environment production --service coachflow python3 dbsnap2.py out.tsv`.

```python
"""Read-only, database-wide snapshot. usage: dbsnap2.py <out.tsv>"""
import os, sys, subprocess, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
if (u.hostname or "").endswith(".internal"):
    for k in ("DATABASE_PUBLIC_URL", "MYSQL_PUBLIC_URL"):
        if os.environ.get(k): u = urllib.parse.urlparse(os.environ[k]); break
env = dict(os.environ, MYSQL_PWD=urllib.parse.unquote(u.password or ""))
base = ["mysql", "-h", u.hostname, "-P", str(u.port or 3306), "-u", urllib.parse.unquote(u.username or ""), "-N", "-B", u.path.lstrip("/").split("?")[0]]
def q(sql):
    r = subprocess.run(base, input=sql, env=env, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr.replace(env["MYSQL_PWD"], "***"))
    return [l.split("\t") for l in r.stdout.strip().splitlines() if l]
cols = q("SELECT TABLE_NAME, MAX(COLUMN_NAME='id'), MAX(COLUMN_NAME='updatedAt') FROM INFORMATION_SCHEMA.COLUMNS "
         "WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_NAME ORDER BY TABLE_NAME;")
parts = [f"SELECT '{t}', COUNT(*), {'MAX(`id`)' if i == '1' else 'NULL'}, {'MAX(`updatedAt`)' if up == '1' else 'NULL'} FROM `{t}`"
         for t, i, up in cols]
rows = {r[0]: r[1:] for r in q(" UNION ALL ".join(parts) + ";")}
sums = {r[0].split(".")[-1]: r[1] for r in q("CHECKSUM TABLE " + ", ".join(f"`{t}`" for t, _, _ in cols) + ";")}
with open(sys.argv[1], "w") as f:
    for t in sorted(rows): f.write("\t".join([t, *rows[t], sums.get(t, "?")]) + "\n")
print(f"snapshotted {len(rows)} tables with checksums")
```

Ad-hoc SQL runner (same connection handling; used for reads, and for approved writes only):

```python
import os, sys, subprocess, urllib.parse
u = urllib.parse.urlparse(os.environ.get("DATABASE_URL", ""))
if (u.hostname or "").endswith(".internal"):
    for k in ("DATABASE_PUBLIC_URL", "MYSQL_PUBLIC_URL"):
        if os.environ.get(k): u = urllib.parse.urlparse(os.environ[k]); break
pw = urllib.parse.unquote(u.password or ""); env = dict(os.environ, MYSQL_PWD=pw)
args = ["mysql", "-h", u.hostname, "-P", str(u.port or 3306), "-u", urllib.parse.unquote(u.username or ""), "--force", "-t", u.path.lstrip("/").split("?")[0]]
with open(sys.argv[1]) as f: r = subprocess.run(args, stdin=f, env=env, capture_output=True, text=True)
print((r.stdout + r.stderr).replace(pw, "***") if pw else r.stdout + r.stderr); sys.exit(r.returncode)
```

⚠️ Column names that bit on 2026-09-11 (§9): `nodeStatuses.nodeType` (not nodeKey) · `hvcoTitles.magnetPdfUrl`
/ `magnetHtmlUrl` · offers keep text in `godfatherAngle`/`freeAngle`/`dollarAngle` JSON (name at
`$.offerName`) · `heroMechanisms.mechanismName` · `jobs.created_at`.

## 3. THE REGENERATION STEPS — the product's own path, one magnet

Values shown for **7233** (kit 223 · service 316 · profile 289 · user 1). Swap the three ids for another magnet.

**Step 1 — offer** (inserts the offer; `autoSelectBest` updates the kit and upserts stale rows;
`ensureCampaignKit` may insert a `concepts-icp-<id>` job — see the restart block):

```ts
import { runOfferGeneration } from "./server/offersGenerator";
(async () => {
  const r = await runOfferGeneration({ userId: 1, serviceId: 316, offerType: "premium" });
  console.log("OFFER_ID " + r.offerId); process.exit(0);
})().catch((e) => { console.log("ERROR " + (e?.message ?? String(e))); process.exit(1); });
```

**Step 2 — body** (screened exactly as orchestration screens it — advisory, persists regardless — then
`assetBody` only):

```ts
import { generateLeadMagnetContent } from "./server/leadMagnetContentGenerator";
import { screenLeadMagnetBody } from "./server/_core/persistenceGate";
import { getDb } from "./server/db";
import { hvcoTitles } from "./drizzle/schema";
import { eq, and } from "drizzle-orm";
(async () => {
  const db: any = await getDb();
  const [row] = await db.select().from(hvcoTitles).where(and(eq(hvcoTitles.id, 7233), eq(hvcoTitles.userId, 1))).limit(1);
  if (!row) { console.log("ERROR not found"); process.exit(1); }
  const body: any = await generateLeadMagnetContent({ userId: 1, serviceId: 316, icpId: 289, title: row.title });
  if (!body) { console.log("ERROR no body — nothing written"); process.exit(1); }
  const hits = await screenLeadMagnetBody("leadMagnetContent", 316, body);
  console.log("SCREEN_HITS " + JSON.stringify((hits || []).map((h: any) => h.classId)));
  await db.update(hvcoTitles).set({ assetBody: body }).where(and(eq(hvcoTitles.id, 7233), eq(hvcoTitles.userId, 1)));
  console.log("BODY_WRITTEN format=" + body.format);
  console.log("NEXT_STEP " + JSON.stringify(body.nextStep));
  console.log("NEXT_STEP_LINKED " + JSON.stringify(body.nextStepLinked ?? null));
  process.exit(0);
})().catch((e) => { console.log("ERROR " + (e?.message ?? String(e))); process.exit(1); });
```

To see WHAT a screen hit matched, re-screen the stored body read-only (`screenOnPersist` selects service +
profile, runs `checkOutput`, logs, returns — no write): print `h.classId`, `h.matched`, `h.location`.

**Step 3 — republish** (token gate first; writes KV pages, a new PDF version, the row's URL columns):

```ts
import { publishLeadMagnet } from "./server/leadMagnetPublisher";
(async () => {
  const r = await publishLeadMagnet({ hvcoId: 7233 });
  console.log("PUBLISH_RESULT " + JSON.stringify(r)); process.exit(0);
})().catch((e) => { console.log("ERROR " + (e?.message ?? String(e))); process.exit(1); });
```

**Step 4 — the magnet's own stale row** (`freeOptIn`), guarded:
`DELETE FROM nodeStatuses WHERE id=<id> AND campaignKitId=<kit> AND nodeType='freeOptIn' AND status='stale';`
then `SELECT ROW_COUNT();` in the same session.

**A concept job, if one appears:**
`DELETE FROM jobs WHERE id='concepts-icp-<id>' AND userId=1 AND status IN ('pending','failed');` — `IN`,
because the 60-second reaper flips a pending row older than 5 minutes to `failed`.

## 4. THE 5686 IN-PLACE TITLE WRITE — approved 2026-09-11, NOT the product path

Re-measure before writing that the body mentions the claim only in `$.title` (2026-09-10: `6,000` ×1,
`11 day` ×1, `booked a` ×1, all inside the title):

```sql
UPDATE hvcoTitles
   SET title = 'The Cold Inbox Toolkit for Designers',
       assetBody = JSON_SET(assetBody, '$.title', 'The Cold Inbox Toolkit for Designers')
 WHERE id = 5686 AND userId = 1;
SELECT ROW_COUNT();
```

Then step 3 with `hvcoId: 5686`, then the invalidation in §5 on `lead-magnets_1_5686.pdf`. The row keeps
`tabType='long'` although the title came from the `short` tab — cosmetic, leave it.

## 5. CLOUDINARY — 🛑 PURGING RETIRED 2026-09-11. DO NOT RUN THE INVALIDATION BELOW.

**Settled (CHECKPOINT restart block §0.6c):** a purge does not retire an old address — 7233's, purged once, read
current three times spaced and then served the old file again. Make no purge calls; never record an address as
cleared. The script is kept as a record of what was run. The `probe` function is still the way to READ an
address: at least three fetches spaced minutes apart, every result reported.

`explicit` with `invalidate: true` changes no content or version; it asks the CDN to drop cached copies of
the public id. One call per public id covers every versioned address of it.

```ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
(async () => {
  for (const pid of ["lead-magnets_1_5686.pdf"]) {
    const before: any = await cloudinary.api.resource(pid, { resource_type: "image" });
    await cloudinary.uploader.explicit(pid, { type: "upload", resource_type: "image", invalidate: true });
    const after: any = await cloudinary.api.resource(pid, { resource_type: "image" });
    console.log(`INVALIDATE ${pid}: version ${before.version} -> ${after.version} bytes=${after.bytes}`);
  }
  process.exit(0);
})();
```

Probe each address, then again ≥3 minutes later. Report bytes, hash and the hit/miss header per fetch:

```bash
probe() { f=$(mktemp); h=$(curl -s -o $f -D - -m 60 "$1" | tr -d '\r'); echo "$(echo "$h" | grep -m1 '^HTTP') bytes=$(wc -c < $f | tr -d ' ') sha=$(shasum -a 256 $f | cut -c1-12) cdn=$(echo "$h" | grep -io 'desc=hit\|desc=miss' | head -1) ${1##*/upload/}"; rm -f $f; }
```

Known addresses (2026-09-11): 5686 old `v1787860054` (415,099 B, sha `3eb37b0fc011`, the funnel) · 5686
current `v1789071852` (615,289 B) · 7173 old `v1787948313` (282,521 B, sha `b656b92de609`) · 7173 current
`v1789074179` · 7233 current `v1789055696`. Form:
`https://res.cloudinary.com/dunshei0y/image/upload/<version>/lead-magnets_1_<id>.pdf.pdf`.

## 6. THE LIVE-PAGE CHECK — fetch, never read a pointer

```python
"""usage: pagecheck.py <url> ... — tokens, event words, and whether the close is a LINK or a TEXT CARD.
A page with no close block reports NOT_FOUND, never a clean pass (§15k)."""
import sys, re, subprocess, html as H
EVENT = re.compile(r"\b(workshop|webinar|live event|masterclass|register(?:ed|ing)?|seat|cohort|session|attend|join us live)\b", re.I)
def strip(s): return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
for url in sys.argv[1:]:
    r = subprocess.run(["curl", "-s", "-m", "60", "-w", "\n%{http_code}", url], capture_output=True, text=True)
    body, code = r.stdout.rsplit("\n", 1)
    tokens = sorted(set(re.findall(r"\[INSERT_[A-Z_0-9]+\]", body)))
    visible = strip(re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", body))
    ev = {}
    for m in EVENT.finditer(visible): ev[m.group(0).lower()] = ev.get(m.group(0).lower(), 0) + 1
    link = re.search(r"<a\b[^>]*data-next-step[^>]*>", body); card = re.search(r'<p\b[^>]*class="cta-text"[^>]*>', body)
    close = ("LINK " + (re.search(r'href="([^"]*)"', link.group(0)) or [None, "?"])[1]) if link else ("TEXT_CARD" if card else "NOT_FOUND")
    print(f"{url}\n  http={code} bytes={len(body)} tokens={tokens or 'none'} event_words={ev or 'none'} close={close}")
    for m in list(EVENT.finditer(visible))[:4]: print("  ctx: …" + visible[max(m.start()-90, 0):m.end()+60] + "…")
```

Read every event-word hit in context — "registered a signal" and "registered as threat" are prose, not
event wording. Pages: `https://zapcampaigns.com/p/magnet-magnet-<id>` (deliverable) and
`/p/magnet-get-<id>` (opt-in). Confirm the close text itself is on the page (grep its heading).
