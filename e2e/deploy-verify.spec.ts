/**
 * Deploy verification against the LIVE deployed site (2026-07-22).
 *
 * Scripted login is dev-only, so full login-gated flows can't run on prod. This spec asserts on what IS
 * reachable without login — the REAL served JS bundle bytes — to catch exactly the "committed but not in the
 * served bundle" failure class (the whole reason Batch A was invisible on prod until this push).
 *
 * It fetches the prod entry HTML, walks every referenced /assets/*.js chunk (Vite splits the wizard into a
 * lazy chunk), and asserts the Batch-A CLIENT markers are present in the served bytes. Server-side pieces
 * (sentinel normalize, offer facts-wire) are NOT in the client bundle — they're listed as clean-room-verified.
 *
 *   PROD_URL   default https://zapcampaigns.com
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const PROD = (process.env.PROD_URL ?? "https://zapcampaigns.com").replace(/\/$/, "");

const results: { id: string; label: string; pass: boolean; detail: string }[] = [];
function record(id: string, label: string, pass: boolean, detail: string) {
  results.push({ id, label, pass, detail });
  expect.soft(pass, `${id} ${label} — ${detail}`).toBeTruthy();
}

// Fetch the entry HTML, then recursively fetch every /assets/*.js chunk it (transitively) references,
// concatenating the served bytes so we can grep for code that lives in a lazy chunk.
async function fetchAllServedJs(req: APIRequestContext): Promise<{ js: string; chunks: number }> {
  const html = await (await req.get(`${PROD}/`)).text();
  const seen = new Set<string>();
  const queue = Array.from(new Set([...html.matchAll(/\/assets\/[\w.\-]+\.js/g)].map((m) => m[0])));
  let js = "";
  while (queue.length && seen.size < 120) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await req.get(`${PROD}${path}`);
    if (!res.ok()) continue;
    const body = await res.text();
    js += body;
    for (const m of body.matchAll(/assets\/[\w.\-]+\.js/g)) {
      const p = m[0].startsWith("/") ? m[0] : `/${m[0]}`;
      if (!seen.has(p)) queue.push(p);
    }
  }
  return { js, chunks: seen.size };
}

test("deploy verification — Batch A in the served prod bundle", async ({ request }) => {
  const { js, chunks } = await fetchAllServedJs(request);
  record("D0", `prod reachable + JS chunks fetched (${chunks})`, chunks > 0 && js.length > 0, `${chunks} chunks, ${Math.round(js.length / 1024)}KB served JS`);

  // Batch-A CLIENT markers — unique string literals from ChatThread.tsx's StructuredInput (survive minification).
  const markers: Record<string, boolean> = {
    "structured-input message type": js.includes("structured-input"),
    "venue place-name field": js.includes("Venue name & city"),
  };
  for (const [name, present] of Object.entries(markers)) {
    record(`D:${name}`, `served bundle contains "${name}"`, present, present ? "present in served bytes" : "ABSENT — deploy not live / not in bundle");
  }

  // The native date/time pickers + price number field are structural (input types), harder to assert in
  // minified JS; the two string markers above uniquely identify the StructuredInput control that renders them.
  const batchAlive = markers["structured-input message type"] && markers["venue place-name field"];
  record("D:batch-a", "Batch A structured facts inputs are DEPLOYED", batchAlive, batchAlive ? "structured-input control shipped to prod" : "still the pre-Batch-A bundle (free-text)");
});

test("deploy verification — a public published page is still served (liveness)", async ({ request }) => {
  // Published pages are cached in Cloudflare KV and are NOT re-rendered by a client/server code deploy, so
  // this is a liveness/no-regression check only — it does NOT verify Batch A.
  const res = await request.get(`${PROD}/p/campaign-214`).catch(() => null);
  const ok = !!res && res.status() === 200;
  record("D:published", "a known published page still serves 200 (no regression)", ok, ok ? "campaign-214 → 200" : `campaign-214 → ${res?.status() ?? "unreachable"} (KV-cached; unrelated to this deploy)`);
});

test.afterAll(() => {
  const line = "─".repeat(80);
  const rows = results.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(28)} ${r.detail}`);
  const passed = results.filter((r) => r.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\n${line}\nDEPLOY VERIFICATION (${PROD}) — ${passed}/${results.length}\n${line}\n${rows.join("\n")}\n${line}\n`);
});
