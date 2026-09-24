import { z } from "zod";
import { assertCanPush } from "../lib/tierAccess";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  ghlAccessTokens,
  campaignKits,
  emailSequences,
  whatsappSequences,
  landingPages,
  idealCustomerProfiles,
  headlines,
  adCopy,
  heroMechanisms,
  hvcoTitles,
  offers,
  adCreatives,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getGhlAccess, GhlConnectionCause, ghlConnectionMessage, type GhlConnectionKind } from "../_core/ghlToken";
import { buildResolvedMap, resolveTokensInText, type ResolvedEntry } from "../lib/placeholderResolver";

const GHL_BASE = "https://services.leadconnectorhq.com";

// ─── Canonical ZAP workflow names (freelancer-built, snapshot-deployed) ────────
// Used by getWorkflowStatus to detect whether the customer applied the master
// snapshot. Prefix match /^zap[\s-]/i catches renames like "Zap" vs "ZAP".
// Threshold: ≥ 75% present = "installed". Update this array if the freelancer
// adds/renames workflows in future snapshot versions.
const ZAP_WORKFLOW_NAMES = [
  // Email (10)
  "ZAP Welcome Sequence",
  "ZAP Launch Sequence",
  "ZAP Nurture Sequence",
  "ZAP Sales Sequence",
  "ZAP Discovery Call Reminder",
  "ZAP Discovery Call Confirmation",
  "ZAP Engagement Sequence",
  "ZAP Event Logistics",
  "ZAP Re-Engagement Sequence",
  "ZAP Replay For No-Shows",
  // WhatsApp (6)
  "ZAP WhatsApp Discovery Call Confirmation",
  "ZAP WhatsApp Discovery Call Reminder",
  "ZAP WhatsApp Engagement",
  "ZAP WhatsApp Event Logistics",
  "ZAP WhatsApp Nurture",
  "ZAP WhatsApp Sales",
] as const;

const ZAP_WORKFLOW_THRESHOLD = Math.ceil(ZAP_WORKFLOW_NAMES.length * 0.75);

// ─── In-memory workflow-status cache (1-hour TTL, keyed by userId) ────────────
export type GhlWorkflowState = "installed" | "partial" | "missing" | "unreachable" | "reconnect_required" | "not_connected";
type WorkflowStatus = { installed: boolean; count: number; total: number; checkedAt: string; state: GhlWorkflowState };
/** Called by the OAuth callback on (re)connect, so a fresh connection is never shown a stale status. */
export function clearWorkflowStatusCache(userId: number): void {
  workflowStatusCache.delete(userId);
}
const workflowStatusCache = new Map<number, {
  data: WorkflowStatus;
  expiresAt: number;
}>();
const WORKFLOW_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── D1: Custom Value push session — write, then READ BACK ─────────────────────
//
// GHL_DELIVERY_RELIABILITY_PROPOSAL §B. The standard (Arfeen): the coach is only told "success" when the values
// are confirmed present in GHL. Before this, each value was a LIST + PUT/POST with the HTTP status as its only
// evidence, a failed LIST fell through to a blind POST (duplicates), and the push window said "Pushed
// successfully" whatever the flags were.
//
// Now: ONE list at the start (if it fails the push does not start), every write recorded with GHL's own status
// and message, ONE list at the end, and every value marked confirmed / rejected / missing / changed. A slot with
// nothing to send is "nothing to send", never a failure.

export type GhlValueStatus = "confirmed" | "rejected" | "missing" | "changed";
export type GhlSlotKey =
  | "email" | "whatsapp" | "landingPage" | "headlines" | "adCopy" | "offer"
  | "leadMagnet" | "leadMagnetUrl" | "mechanism" | "adCreatives";
export type GhlSlotStatus = "confirmed" | "not_confirmed" | "nothing_to_send";
export type GhlPushReport = {
  confirmed: boolean;
  confirmedCount: number;
  expectedCount: number;
  slots: Array<{
    key: GhlSlotKey;
    label: string;
    status: GhlSlotStatus;
    reason?: string;
    values: Array<{ name: string; status: GhlValueStatus; reason?: string }>;
  }>;
};

export const GHL_SLOTS: Array<{ key: GhlSlotKey; label: string }> = [
  { key: "offer", label: "Offer" },
  { key: "mechanism", label: "Method" },
  { key: "leadMagnet", label: "Lead magnet" },
  { key: "leadMagnetUrl", label: "Lead magnet link" },
  { key: "headlines", label: "Headlines" },
  { key: "adCopy", label: "Ad copy" },
  { key: "landingPage", label: "Landing page" },
  { key: "email", label: "Email sequence" },
  { key: "whatsapp", label: "WhatsApp sequence" },
  { key: "adCreatives", label: "Ad images" },
];

/** Which slot a Custom Value belongs to, from its stable name. */
export function slotForName(name: string): GhlSlotKey {
  if (/^ZAP Email /.test(name)) return "email";
  if (/^ZAP WhatsApp /.test(name)) return "whatsapp";
  if (name === "ZAP Landing Page") return "landingPage";
  if (name === "ZAP Headlines") return "headlines";
  if (name === "ZAP Ad Copy") return "adCopy";
  if (name === "ZAP Offer Copy") return "offer";
  if (name === "ZAP Lead Magnet URL") return "leadMagnetUrl";
  if (name === "ZAP Lead Magnet") return "leadMagnet";
  if (name === "ZAP Hero Mechanism") return "mechanism";
  if (/^ZAP Ad Creative /.test(name)) return "adCreatives";
  throw new Error(`Unmapped GHL Custom Value name: ${name}`);
}

/** GHL may normalise line endings or trailing whitespace; nothing else counts as "the same". */
function sameValue(a: string, b: string): boolean {
  const norm = (v: string) => v.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();
  return norm(a) === norm(b);
}

type CustomValue = { id: string; name: string; value?: string };

/** The start-of-push list failed. The push does not start. */
export class GhlListError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`GoHighLevel list failed: ${status}`);
    this.name = "GhlListError";
  }
}

async function listCustomValues(locationId: string, headers: Record<string, string>): Promise<CustomValue[]> {
  const listUrl = `${GHL_BASE}/locations/${locationId}/customValues`;
  console.log(`[GHL API] upsertCustomValue LIST GET ${listUrl}`);
  let res: Response;
  try {
    res = await fetch(listUrl, { method: "GET", headers });
  } catch (e) {
    throw new GhlListError(0, `network: ${String(e).slice(0, 200)}`);
  }
  if (!res.ok) throw new GhlListError(res.status, (await res.text().catch(() => "")).slice(0, 300));
  const data = await res.json() as { customValues?: CustomValue[] };
  return data.customValues || [];
}

export class GhlPushSession {
  private byName = new Map<string, CustomValue>();
  private writes = new Map<string, { value: string; accepted: boolean; reason?: string }>();
  private slotErrors = new Map<GhlSlotKey, string>();

  private constructor(readonly locationId: string, readonly headers: Record<string, string>) {}

  /** ONE list at the start. Throws GhlListError if GHL won't list — no blind writes follow. */
  static async open(locationId: string, headers: Record<string, string>): Promise<GhlPushSession> {
    const session = new GhlPushSession(locationId, headers);
    for (const cv of await listCustomValues(locationId, headers)) {
      if (!session.byName.has(cv.name)) session.byName.set(cv.name, cv); // first wins, consistently
    }
    return session;
  }

  /** The existing values, as listed at the start (orphan cleanup reads this — no second list). */
  existing(): CustomValue[] {
    return Array.from(this.byName.values());
  }

  async upsert(name: string, value: string): Promise<boolean> {
    slotForName(name); // an unmapped name is a programming error — fail loudly, never report it as sent
    const existing = this.byName.get(name);
    const url = existing
      ? `${GHL_BASE}/locations/${this.locationId}/customValues/${existing.id}`
      : `${GHL_BASE}/locations/${this.locationId}/customValues`;
    const method = existing ? "PUT" : "POST";
    console.log(`[GHL API] upsertCustomValue ${method} ${url}`);
    try {
      const res = await fetch(url, { method, headers: this.headers, body: JSON.stringify({ name, value }) });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 300);
        console.warn(`[GHL] ${method} customValue failed for "${name}": ${res.status} ${body}`);
        // GHL's own words, not its JSON envelope.
        let detail = body;
        try {
          const j = JSON.parse(body) as { message?: unknown; error?: unknown };
          const m = Array.isArray(j.message) ? j.message.join("; ") : j.message ?? j.error;
          if (m) detail = String(m);
        } catch { /* not JSON — keep the text */ }
        this.writes.set(name, { value, accepted: false, reason: `GoHighLevel said ${res.status}${detail ? `: ${detail}` : ""}` });
        return false;
      }
      if (!existing) {
        const created = await res.json().catch(() => null) as { customValue?: CustomValue } | null;
        if (created?.customValue?.id) this.byName.set(name, created.customValue);
      }
      this.writes.set(name, { value, accepted: true });
      return true;
    } catch (e) {
      this.writes.set(name, { value, accepted: false, reason: `no response from GoHighLevel (${String(e).slice(0, 120)})` });
      return false;
    }
  }

  async remove(cv: CustomValue): Promise<boolean> {
    const deleteUrl = `${GHL_BASE}/locations/${this.locationId}/customValues/${cv.id}`;
    console.log(`[GHL API] cleanupOrphans DELETE ${deleteUrl} (orphan="${cv.name}")`);
    try {
      const delRes = await fetch(deleteUrl, { method: "DELETE", headers: this.headers });
      if (!delRes.ok) console.warn(`[GHL] DELETE orphan failed for "${cv.name}":`, await delRes.text());
      return delRes.ok;
    } catch (e) {
      console.warn(`[GHL] DELETE orphan error for "${cv.name}":`, e);
      return false;
    }
  }

  /** A slot's values could not even be built (e.g. its asset failed to load). It counts as not confirmed. */
  slotError(slot: GhlSlotKey, e: unknown): void {
    this.slotErrors.set(slot, `ZAP couldn't prepare this (${String((e as Error)?.message ?? e).slice(0, 160)})`);
  }

  /** ONE list at the end, and the verdict for every value that was sent. */
  async verify(): Promise<GhlPushReport> {
    let after: Map<string, CustomValue> | null = new Map();
    let readBackError = "";
    try {
      for (const cv of await listCustomValues(this.locationId, this.headers)) if (!after.has(cv.name)) after.set(cv.name, cv);
    } catch (e) {
      after = null;
      readBackError = e instanceof GhlListError ? `GoHighLevel couldn't be read back to confirm (${e.status || "no response"})` : "GoHighLevel couldn't be read back to confirm";
    }

    const valuesBySlot = new Map<GhlSlotKey, Array<{ name: string; status: GhlValueStatus; reason?: string }>>();
    for (const [name, w] of Array.from(this.writes.entries())) {
      let status: GhlValueStatus;
      let reason: string | undefined;
      if (!w.accepted) { status = "rejected"; reason = w.reason; }
      else if (!after) { status = "missing"; reason = readBackError; }
      else {
        const found = after.get(name);
        if (!found) { status = "missing"; reason = "GoHighLevel accepted it, but it isn't there on read-back"; }
        else if (!sameValue(String(found.value ?? ""), w.value)) { status = "changed"; reason = "GoHighLevel holds a different value"; }
        else status = "confirmed";
      }
      const slot = slotForName(name);
      if (!valuesBySlot.has(slot)) valuesBySlot.set(slot, []);
      valuesBySlot.get(slot)!.push({ name, status, ...(reason ? { reason } : {}) });
    }

    const slots = GHL_SLOTS.map(({ key, label }) => {
      const values = valuesBySlot.get(key) ?? [];
      const err = this.slotErrors.get(key);
      let status: GhlSlotStatus;
      if (err) status = "not_confirmed";
      else if (values.length === 0) status = "nothing_to_send";
      else status = values.every((v) => v.status === "confirmed") ? "confirmed" : "not_confirmed";
      return { key, label, status, ...(err ? { reason: err } : {}), values };
    });
    const allValues = slots.flatMap((s) => s.values);
    const confirmedCount = allValues.filter((v) => v.status === "confirmed").length;
    const expectedCount = allValues.length;
    return {
      // Success only when something was sent and EVERY slot that had something to send is confirmed.
      confirmed: expectedCount > 0 && slots.every((s) => s.status !== "not_confirmed"),
      confirmedCount,
      expectedCount,
      slots,
    };
  }
}

/** Write one Custom Value through the verified session (kept as the call-site name the push blocks use). */
async function upsertCustomValue(session: GhlPushSession, name: string, value: string): Promise<boolean> {
  return session.upsert(name, value);
}

/**
 * Delete stale over-N slot values (a previous, longer push). Reads the START-of-push list — no extra list call,
 * and no chance of deleting something this push just wrote (orphan patterns only match slots above the new N).
 */
async function cleanupOrphanCustomValues(session: GhlPushSession, orphanNameRegex: RegExp): Promise<number> {
  let deleted = 0;
  for (const cv of session.existing().filter((c) => orphanNameRegex.test(c.name))) {
    if (await session.remove(cv)) deleted++;
  }
  return deleted;
}

// ─── D2 Helpers: Email Template + Landing Page Funnel — REMOVED in C3 f-o 7 ──
//
// Two helpers (upsertEmailTemplate + createGhlFunnel) and one private support
// helper (buildLandingPageHtml) were removed together in Phase C C3 follow-on 7
// after Arfeen's frame (c) push surfaced byte-level forensic confirmation that
// both endpoints are structurally inaccessible to GHL v2 marketplace OAuth
// apps — the same pattern as the createWhatsAppWorkflow removal in C3 f-o 2.
//
// EMAIL TEMPLATES (upsertEmailTemplate):
//   Previous endpoint: POST/PUT/GET on /locations/{locationId}/templates
//   Forensic: HTTP 401 "The token is not authorized for this scope"
//   Root cause: this is the v1 legacy path. The v2 scope emails/builder.write
//   (renamed in C3 f-o 2) maps to POST /emails/builder — which the current
//   GHL docs flag as "deprecated and may be replaced or removed in future
//   versions of the API." GHL's stated direction for templates is "design
//   in the GHL template editor and reference by template ID in the API" —
//   not API-side template creation.
//
// LANDING PAGE FUNNEL (createGhlFunnel):
//   Previous endpoint: POST /locations/{locationId}/funnels (and nested
//   /funnels/{id}/pages for the page creation step).
//   Forensic: HTTP 404 "Cannot POST /locations/{id}/funnels" — endpoint
//   does not exist in v2.
//   Root cause: GHL v2 marketplace OAuth catalog has no funnels.write or
//   funnels/funnel.write — only funnels/funnel.readonly + funnels/page.readonly
//   (read) and funnels/redirect.write (URL-redirect rules only, NOT page or
//   funnel creation). Funnel creation is admin-UI-only via the GHL dashboard,
//   not exposed to marketplace OAuth apps.
//
// LANDING PAGE HTML BUILDER (buildLandingPageHtml):
//   Was only called by createGhlFunnel — orphaned after that removal.
//   Verified single call site at the pre-removal L623 grep; removing
//   alongside is structurally clean.
//
// OPERATOR-FILL SEAM:
//   Both email + landing page content STILL push to GHL via the surviving
//   D1 Custom Value slots (emailPushed at the email sequence path,
//   landingPagePushed at the landing page path) using
//   locations/customValues.write — fully valid in v2. Operator pastes
//   those Custom Values into manually-built email templates + funnel pages
//   on the GHL side. Same architectural precedent as:
//     - [INSERT_LEAD_MAGNET_NAME] in email nurture (May 9 handover §7.5)
//     - [INSERT_REPLAY_MOMENT_N] in replay (May 9 handover §7.5)
//     - createWhatsAppWorkflow removal (C3 f-o 2)
//   Minimum-viable defenses given the structural marketplace-OAuth gap, NOT
//   tactical fixes that failed.
//
// FUTURE RESTORE PATH (registered in post-launch backlog):
//   GHL operator-fill alternative — Arfeen creates email templates + funnels
//   in GHL UI, ZAP stores template_id / funnel_id references in campaignKits
//   (new FK columns), push chain references by ID via the existing GHL API
//   surface (which DOES support "send with template" + "redirect to funnel"
//   operations — just not creation). Scope: ~1 migration + ~30 LOC UI for
//   ID picker + ~20 LOC push reference logic ≈ 60 LOC. Post-launch, not
//   C3-blocking.
//
// Forensic capture of the removed bodies retained in git history at parent
// commit a71efc1 — recoverable via `git show a71efc1:server/routers/ghl.ts`
// if the post-launch backlog "GHL operator-fill alternative" sprint needs
// the prior payload shapes as a reference.


// ─── D2 Helper: WhatsApp Workflow — REMOVED in Phase C C3 follow-on 2 ──────────
// The createWhatsAppWorkflow helper previously POSTed to
//   POST {GHL_BASE}/locations/{locationId}/workflows
// to create a native GHL workflow with sequential whatsapp + wait actions.
//
// GHL's V1 API end-of-support landed on 2025-12-31. Their v2 OAuth scope
// catalog structurally does not expose workflow creation to marketplace
// apps — only `workflows.readonly` exists; there is no `workflows.write`
// or any nested-namespace equivalent (no `workflows/workflow.write`, no
// `automations.write`). Workflow creation is admin-level access only,
// reachable via Private Integration API keys (which we deliberately don't
// take from users for security reasons), not via marketplace OAuth.
//
// Operator-fill seam: WhatsApp content still pushes to GHL via the
// `whatsappPushed` Custom Value slot (upsertCustomValue at the D1 path)
// using the valid `locations/customValues.write` scope. The operator
// pastes that Custom Value into a manually-built GHL workflow on the GHL
// side. Same architectural precedent as [INSERT_LEAD_MAGNET_NAME] in the
// email nurture builder + [INSERT_REPLAY_MOMENT_N] in the replay builder
// (see May 9 handover §7.5 — "minimum-viable defenses given a structural
// data-layer / API-surface gap, not tactical fixes that didn't converge").
//
// If GHL adds a workflow-write scope in a future API version, this helper
// can be restored — keep the call shape in mind:
//   POST /locations/{locationId}/workflows
//   body: { name, status: "draft", actions: [{type:"whatsapp", body},
//                                            {type:"wait", delay:{unit,value}}, …] }

/**
 * GoHighLevel Integration Router
 */
export const ghlRouter = router({
  /**
   * Get current user's GHL connection status
   */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    // One shared helper renews a lapsed token on read (§A). The state tells the client exactly what to show:
    // connected · not_connected · reconnect_required ("Your GoHighLevel connection has ended") · unreachable.
    // Phase C C3 follow-on 8 (Phase 1): masterSnapshotId surfaces to the client so the post-push banner and the
    // Settings link can build the GHL deep link; null when not configured.
    const masterSnapshotId = process.env.GHL_MASTER_SNAPSHOT_ID ?? null;
    try {
      const access = await getGhlAccess(ctx.user.id);
      return {
        connected: true,
        state: "connected" as const,
        locationId: access.locationId,
        locationName: access.locationName,
        connectedAt: access.connectedAt,
        expiresAt: access.tokenExpiresAt,
        masterSnapshotId: process.env.GHL_MASTER_SNAPSHOT_ID ?? null,
      };
    } catch (e) {
      if (!(e instanceof GhlConnectionCause)) throw e;
      const state = e.kind === "unavailable" ? ("unreachable" as const) : e.kind;
      return { connected: false, state, message: ghlConnectionMessage(e.kind), masterSnapshotId };
    }
  }),

  /**
   * Detect whether the customer's GHL location has ZAP's master-snapshot
   * workflows installed. Uses workflows.readonly scope to list workflows,
   * then prefix-matches against the canonical ZAP_WORKFLOW_NAMES list.
   * In-memory 1-hour cache; pass force=true to bypass.
   */
  getWorkflowStatus: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }): Promise<WorkflowStatus> => {
      const force = input?.force ?? false;
      const userId = ctx.user.id;
      const total = ZAP_WORKFLOW_NAMES.length as number;
      const blank = (state: GhlWorkflowState): WorkflowStatus => ({ installed: false, count: 0, total, checkedAt: new Date().toISOString(), state });

      // Check cache (unless force-refresh). Only real answers are cached — never "can't check".
      if (!force) {
        const cached = workflowStatusCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data;
        }
      }

      // A connection problem is NOT "Snapshot not applied": it gets its own state (§A4.4).
      const connectionState = (e: unknown): WorkflowStatus => {
        if (e instanceof GhlConnectionCause) {
          return blank(e.kind === "unavailable" ? "unreachable" : e.kind);
        }
        console.warn("[GHL] getWorkflowStatus error:", e);
        return blank("unreachable");
      };

      let access;
      try {
        access = await getGhlAccess(userId);
      } catch (e) {
        return connectionState(e);
      }
      if (!access.locationId) return blank("not_connected");

      const fetchWorkflows = async (token: string) => {
        const url = `${GHL_BASE}/workflows/?locationId=${access!.locationId}`;
        console.log(`[GHL API] getWorkflowStatus GET ${url}`);
        return fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" } });
      };

      try {
        let res = await fetchWorkflows(access.accessToken);
        if (res.status === 401) {
          // A token we believed valid was refused: renew once, retry once.
          try {
            access = await getGhlAccess(userId, { forceRenew: true });
          } catch (e) {
            return connectionState(e);
          }
          res = await fetchWorkflows(access.accessToken);
        }
        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[GHL] getWorkflowStatus failed: HTTP ${res.status} — ${errText.substring(0, 200)}`);
          return blank("unreachable");
        }

        const data = await res.json() as { workflows?: Array<{ id: string; name: string; status?: string; published?: boolean }> };
        const workflows = data.workflows || [];

        // Count ZAP workflows via case-insensitive prefix match
        const zapWorkflows = workflows.filter(wf => /^zap[\s-]/i.test(wf.name));
        const count = zapWorkflows.length;
        const installed = count >= ZAP_WORKFLOW_THRESHOLD;

        const result: WorkflowStatus = {
          installed,
          count,
          total,
          checkedAt: new Date().toISOString(),
          state: installed ? "installed" : count > 0 ? "partial" : "missing",
        };

        // Cache the result
        workflowStatusCache.set(userId, {
          data: result,
          expiresAt: Date.now() + WORKFLOW_CACHE_TTL_MS,
        });

        return result;
      } catch (e) {
        return connectionState(e);
      }
    }),

  /**
   * Get GHL OAuth URL (includes scopes for D1 + D2 features)
   */
  getOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GHL_CLIENT_ID;
    if (!clientId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL_CLIENT_ID not configured" });
    }

    const redirectUri = `${process.env.APP_URL || "https://zapcampaigns.com"}/api/oauth/gohighlevel/callback`;
    // Phase C C3 follow-on 2: scope catalog migrated to GHL v2 nested-namespace
    // pattern. GHL's V1 API reached end-of-support on 2025-12-31; the
    // flat-namespace v1 names (templates.*, funnels.*, workflows.write) were
    // rejected by the marketplace OAuth chooser at /oauth/chooselocation as
    // "Invalid scope(s)". Renames per the canonical v2 scope catalog at
    // marketplace.gohighlevel.com/docs/Authorization/Scopes:
    //   templates.{write,readonly}  → emails/builder.{write,readonly}
    //   funnels.readonly            → funnels/funnel.readonly + funnels/page.readonly
    //   funnels.write               → funnels/redirect.write
    //   workflows.readonly          → workflows.readonly (unchanged; v2-valid)
    //   workflows.write             → DROPPED (no v2 equivalent — GHL's v2 OAuth
    //                                 catalog structurally does not expose workflow
    //                                 creation to marketplace apps; admin-level
    //                                 access only via Private Integration API keys).
    //                                 The createWhatsAppWorkflow code path that
    //                                 depended on this scope has also been removed
    //                                 (see "D2 Helper: WhatsApp Workflow" block
    //                                 above — operator-fill seam pattern, same
    //                                 architectural precedent as the replay
    //                                 slot-template lock in the May 9 handover §7.5).
    //                                 WhatsApp content still pushes to GHL via the
    //                                 whatsappPushed Custom Value slot using the
    //                                 valid locations/customValues.write scope.
    const scopes = [
      "contacts.write",
      "contacts.readonly",
      "campaigns.readonly",
      "opportunities.write",
      "businesses.readonly",
      "businesses.write",
      "locations.readonly",
      "locations/customValues.write",
      "locations/customValues.readonly",
      "emails/builder.write",
      "emails/builder.readonly",
      "funnels/funnel.readonly",
      "funnels/page.readonly",
      "funnels/redirect.write",
      "workflows.readonly",
    ].join(" ");
    // HMAC-signed state token — prevents OAuth CSRF / token-binding attacks.
    const { signOAuthState } = await import("../_core/oauthState");
    const state = signOAuthState(ctx.user.id);

    const versionId = process.env.GHL_APP_VERSION_ID || "69af3395095745d484bc1b18";
    const url = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}&version_id=${versionId}`;

    return { url };
  }),

  /**
   * Disconnect GHL account
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.delete(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id));
    return { success: true };
  }),

  /**
   * Push campaign kit to GHL.
   * D1: All 7 asset types as Custom Values (upsert).
   * D2: Email Templates per email, GHL Funnel for landing page, WhatsApp Workflow.
   */
  pushCampaign: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // D6: pushing to Meta / GoHighLevel is Pro-only; a trial user can generate and preview (lib/tierAccess.ts).
      assertCanPush(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // The shared helper renews a lapsed token (§A). A connection problem stops the push BEFORE anything is
      // written, with the coach-facing sentence and a machine-readable cause (data.ghlConnection).
      const connectionError = (kind: GhlConnectionKind) =>
        new TRPCError({
          code: kind === "unavailable" ? "SERVICE_UNAVAILABLE" : "FORBIDDEN",
          message: ghlConnectionMessage(kind),
          cause: new GhlConnectionCause(kind),
        });
      let access;
      try {
        access = await getGhlAccess(ctx.user.id);
      } catch (e) {
        if (e instanceof GhlConnectionCause) throw connectionError(e.kind);
        throw e;
      }
      if (!access.locationId) throw connectionError("reconnect_required");

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      const kitName = kit.name || "Campaign";
      const locationId = access.locationId;

      // Resolve [INSERT_*] tokens to their filled registry values before each
      // Custom Value is written to GHL. The registry is keyed (userId, serviceId);
      // campaignKits has no serviceId column, so derive it from the kit's ICP.
      // serviceId is nullable on the ICP — when absent (or no rows), buildResolvedMap
      // returns campaign-scoped + account-default rows it can, and resolveTokensInText
      // is a no-op for any unmatched token, so the push degrades gracefully (tokens
      // left raw) rather than failing.
      const [kitIcp] = kit.icpId
        ? await db
            .select({ serviceId: idealCustomerProfiles.serviceId })
            .from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, kit.icpId))
            .limit(1)
        : [];
      const resolvedMap: Map<string, ResolvedEntry> =
        kitIcp?.serviceId != null
          ? await buildResolvedMap(ctx.user.id, kitIcp.serviceId)
          : new Map();
      const rt = (v: string): string => resolveTokensInText(v, resolvedMap);

      const results: Record<string, boolean> = {
        // D1 (Custom Values — all 8 kit asset slots, all valid in v2 OAuth
        // via locations/customValues.write). C3 f-o 7 removed the D2 native-
        // object slots (emailTemplatesPushed + funnelCreated) after forensic
        // confirmation they were unreachable for marketplace OAuth; C3 f-o 2
        // had already removed the third D2 slot (whatsappWorkflowCreated).
        // GHL push chain is now 8/8 Custom Values. Operator-fill seam in
        // place for templates + funnel + workflow — see the tombstone
        // comment blocks earlier in this file.
        emailPushed: false,
        whatsappPushed: false,
        landingPagePushed: false,
        headlinesPushed: false,
        adCopyPushed: false,
        offerPushed: false,
        hvcoTitlePushed: false,
        heroMechanismPushed: false,
        adCreativesPushed: false,
      };

      const headersFor = (token: string): Record<string, string> => ({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      });

      // ONE list at the start. If GHL won't list, the push does not start — no blind writes, no duplicates.
      // A 401 on a token we believed valid: renew once, retry once.
      let session: GhlPushSession;
      try {
        try {
          session = await GhlPushSession.open(locationId, headersFor(access.accessToken));
        } catch (e) {
          if (!(e instanceof GhlListError) || e.status !== 401) throw e;
          access = await getGhlAccess(ctx.user.id, { forceRenew: true });
          session = await GhlPushSession.open(locationId, headersFor(access.accessToken));
        }
      } catch (e) {
        if (e instanceof GhlConnectionCause) throw connectionError(e.kind);
        if (e instanceof GhlListError) {
          console.warn(`[GHL] push aborted — start-of-push list failed: ${e.status} ${e.body}`);
          if (e.status === 401) throw connectionError("reconnect_required");
          if (e.status === 0 || e.status >= 500 || e.status === 429) throw connectionError("unavailable");
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `GoHighLevel wouldn't list your Custom Values (${e.status}), so nothing was sent. Try again, or reconnect GoHighLevel if it keeps happening.`,
          });
        }
        throw e;
      }

      // ─── 1. Email Sequence ─────────────────────────────────────────────────────
      if (kit.selectedEmailSequenceId) {
        try {
          const [emailSeq] = await db
            .select()
            .from(emailSequences)
            .where(eq(emailSequences.id, kit.selectedEmailSequenceId))
            .limit(1);
          if (emailSeq) {
            const emails: any[] = Array.isArray(emailSeq.emails)
              ? emailSeq.emails
              : typeof emailSeq.emails === "string"
              ? JSON.parse(emailSeq.emails)
              : [];

            // Phase C C3 follow-on 8 (Phase 1): granular per-message CVs that
            // feed the elastic per-sequence-type workflows in Arfeen's master
            // snapshot. Push EXACTLY N=emails.length CVs (no padding) plus
            // ZAP Email Count + ZAP Email Sequence Type as routing/branching
            // signals. Snapshot's If/Else nodes branch on the count CV
            // (bridged to a Contact custom field) to determine how many
            // emails to send; orphan cleanup removes stale slot CVs from
            // any prior longer push so the location stays clean.
            const emailCount = emails.length;
            const sequenceType = (emailSeq as any).sequenceType ?? "";

            // Per-email subject + body CVs (exactly N, no padding)
            let emailSlotsOk = 0;
            for (let i = 0; i < emailCount; i++) {
              const em = emails[i] as { subject?: string; body?: string };
              const okSubj = await upsertCustomValue(session, `ZAP Email ${i + 1} Subject`, rt(em.subject || ""));
              const okBody = await upsertCustomValue(session, `ZAP Email ${i + 1} Body`, rt(em.body || ""));
              if (okSubj && okBody) emailSlotsOk++;
            }

            // Count + type indicator CVs (snapshot reads these for branching)
            const okCount = await upsertCustomValue(session, "ZAP Email Count", String(emailCount));
            const okType = await upsertCustomValue(session, "ZAP Email Sequence Type", sequenceType);

            // emailPushed = true only when every per-message slot AND the
            // two indicator CVs landed. Partial-success surfaces as ✗ to
            // match the existing slot-flag semantic (binary all-or-nothing
            // per slot per ResultsView rendering).
            results.emailPushed = emailSlotsOk === emailCount && okCount && okType && emailCount > 0;

            // Orphan cleanup: DELETE stale `ZAP Email N (Subject|Body)` CVs
            // where N > emailCount (left over from a prior longer push).
            // emailCount ≤ 7 by Zod schema today; cleanup matches up to
            // N=20 defensively against future schema relaxation.
            const orphanEmailSlots = Array.from(
              { length: 20 - emailCount },
              (_, k) => k + emailCount + 1,
            );
            await cleanupOrphanCustomValues(
              session,
              new RegExp(`^ZAP Email (?:${orphanEmailSlots.join("|")}) (Subject|Body)$`),
            );
          }
        } catch (e) { console.warn("[GHL] Email push error:", e); session.slotError("email", e); }
      }

      // ─── 2. WhatsApp Sequence ──────────────────────────────────────────────────
      if (kit.selectedWhatsAppSequenceId) {
        try {
          const [waSeq] = await db
            .select()
            .from(whatsappSequences)
            .where(eq(whatsappSequences.id, kit.selectedWhatsAppSequenceId))
            .limit(1);
          if (waSeq) {
            const messages: any[] = Array.isArray(waSeq.messages)
              ? waSeq.messages
              : typeof waSeq.messages === "string"
              ? JSON.parse(waSeq.messages)
              : [];

            // Phase C C3 follow-on 8 (Phase 1): granular per-message CVs +
            // count + type indicator. Same architecture as the email block
            // above (see comment block there for the snapshot-side rationale).
            // WhatsApp has no subject/body split — just body per message.
            const whatsappCount = messages.length;
            const waSequenceType = (waSeq as any).sequenceType ?? "";

            // Per-message body CVs
            let waSlotsOk = 0;
            for (let i = 0; i < whatsappCount; i++) {
              const m = messages[i] as { text?: string; message?: string };
              const ok = await upsertCustomValue(session, `ZAP WhatsApp ${i + 1}`, rt(m.text || m.message || ""));
              if (ok) waSlotsOk++;
            }

            // Count + type indicator CVs
            const okWaCount = await upsertCustomValue(session, "ZAP WhatsApp Count", String(whatsappCount));
            const okWaType = await upsertCustomValue(session, "ZAP WhatsApp Sequence Type", waSequenceType);

            results.whatsappPushed = waSlotsOk === whatsappCount && okWaCount && okWaType && whatsappCount > 0;

            // Orphan cleanup: DELETE stale `ZAP WhatsApp N` CVs where
            // N > whatsappCount. Pattern parallels email cleanup.
            const orphanWaSlots = Array.from(
              { length: 20 - whatsappCount },
              (_, k) => k + whatsappCount + 1,
            );
            await cleanupOrphanCustomValues(
              session,
              new RegExp(`^ZAP WhatsApp (?:${orphanWaSlots.join("|")})$`),
            );
          }
        } catch (e) { console.warn("[GHL] WhatsApp push error:", e); session.slotError("whatsapp", e); }
      }

      // ─── 3. Landing Page ───────────────────────────────────────────────────────
      if (kit.selectedLandingPageId) {
        try {
          const [lp] = await db
            .select()
            .from(landingPages)
            .where(eq(landingPages.id, kit.selectedLandingPageId))
            .limit(1);
          if (lp) {
            const angle = (kit as any).selectedLandingPageAngle || "original";
            const angleKey = `${angle}Angle` as keyof typeof lp;
            const raw = lp[angleKey];
            const angleData: any = raw
              ? (typeof raw === "string" ? JSON.parse(raw as string) : raw)
              : null;

            // D1 — Custom Value (text dump)
            let lpText = "No landing page data";
            if (angleData) {
              const sections: string[] = [];
              if (angleData.eyebrowHeadline)   sections.push(`EYEBROW\n${angleData.eyebrowHeadline}`);
              if (angleData.mainHeadline)       sections.push(`MAIN HEADLINE\n${angleData.mainHeadline}`);
              if (angleData.subheadline)        sections.push(`SUBHEADLINE\n${angleData.subheadline}`);
              if (angleData.primaryCta)         sections.push(`PRIMARY CTA\n${angleData.primaryCta}`);
              if (Array.isArray(angleData.asSeenIn) && angleData.asSeenIn.length)
                sections.push(`AS SEEN IN\n${angleData.asSeenIn.join(", ")}`);
              if (angleData.quizSection) {
                const q = angleData.quizSection;
                sections.push(`QUIZ SECTION\nQuestion: ${q.question || ""}\nOptions: ${(q.options || []).join(" | ")}\nAnswer: ${q.answer || ""}`);
              }
              if (angleData.problemAgitation)   sections.push(`PROBLEM AGITATION\n${angleData.problemAgitation}`);
              if (angleData.solutionIntro)      sections.push(`SOLUTION INTRO\n${angleData.solutionIntro}`);
              if (angleData.whyOldFail)         sections.push(`WHY OLD SOLUTIONS FAIL\n${angleData.whyOldFail}`);
              if (angleData.uniqueMechanism)    sections.push(`UNIQUE MECHANISM\n${angleData.uniqueMechanism}`);
              if (Array.isArray(angleData.testimonials) && angleData.testimonials.length) {
                const tText = angleData.testimonials.map((t: any, i: number) =>
                  `Testimonial ${i + 1}: "${t.quote || ""}" — ${t.name || ""}, ${t.location || ""}`
                ).join("\n");
                sections.push(`TESTIMONIALS\n${tText}`);
              }
              if (angleData.insiderAdvantages)  sections.push(`INSIDER ADVANTAGES\n${angleData.insiderAdvantages}`);
              if (angleData.scarcityUrgency)    sections.push(`SCARCITY & URGENCY\n${angleData.scarcityUrgency}`);
              if (angleData.shockingStat)       sections.push(`SHOCKING STAT\n${angleData.shockingStat}`);
              if (angleData.timeSavingBenefit)  sections.push(`TIME-SAVING BENEFIT\n${angleData.timeSavingBenefit}`);
              if (Array.isArray(angleData.consultationOutline) && angleData.consultationOutline.length) {
                const outText = angleData.consultationOutline.map((o: any, i: number) =>
                  `Step ${i + 1}: ${o.title || ""} — ${o.description || ""}`
                ).join("\n");
                sections.push(`CONSULTATION OUTLINE\n${outText}`);
              }
              if (Array.isArray(angleData.faq) && angleData.faq.length) {
                const faqText = angleData.faq.map((f: any, i: number) =>
                  `Q${i + 1}: ${f.question || ""}\nA: ${f.answer || ""}`
                ).join("\n");
                sections.push(`FAQ\n${faqText}`);
              }
              lpText = sections.join("\n\n");
            }
            results.landingPagePushed = await upsertCustomValue(
              session,
              `ZAP Landing Page`,
              rt(lpText)
            );

            // D2 — GHL Funnel creation: REMOVED in C3 f-o 7.
            // HTTP 404 on POST /locations/{id}/funnels — endpoint does not
            // exist in v2 marketplace OAuth; funnel creation is admin-UI-
            // only. LP content is still in GHL via landingPagePushed
            // Custom Value above + the C2 LP is live at zapcampaigns.com/p/{slug}.
            // Operator can build a funnel page manually in GHL using the
            // Custom Value as content reference. See tombstone block above
            // for full rationale.
          }
        } catch (e) { console.warn("[GHL] Landing page push error:", e); session.slotError("landingPage", e); }
      }

      // ─── 4. Headlines ──────────────────────────────────────────────────────────
      if (kit.selectedHeadlineId) {
        try {
          const [selectedHL] = await db
            .select()
            .from(headlines)
            .where(eq(headlines.id, kit.selectedHeadlineId))
            .limit(1);
          if (selectedHL) {
            const allHL = await db
              .select()
              .from(headlines)
              .where(eq(headlines.headlineSetId, selectedHL.headlineSetId));
            const hlText = allHL.length
              ? allHL.map((h, i) => {
                  let line = `${i + 1}. [${(h.formulaType || "").toUpperCase()}] ${h.headline}`;
                  if (h.eyebrow) line += `\n   Eyebrow: ${h.eyebrow}`;
                  if (h.subheadline) line += `\n   Subheadline: ${h.subheadline}`;
                  return line;
                }).join("\n\n")
              : `1. ${selectedHL.headline}`;
            results.headlinesPushed = await upsertCustomValue(
              session,
              `ZAP Headlines`,
              rt(hlText)
            );
          }
        } catch (e) { console.warn("[GHL] Headlines push error:", e); session.slotError("headlines", e); }
      }

      // ─── 5. Ad Copy ────────────────────────────────────────────────────────────
      if (kit.selectedAdCopyId) {
        try {
          const [selectedAd] = await db
            .select()
            .from(adCopy)
            .where(eq(adCopy.id, kit.selectedAdCopyId))
            .limit(1);
          if (selectedAd) {
            const allAds = await db
              .select()
              .from(adCopy)
              .where(eq(adCopy.adSetId, selectedAd.adSetId));
            const adHeadlines = allAds.filter(a => a.contentType === "headline");
            const adBodies    = allAds.filter(a => a.contentType === "body");
            const adLinks     = allAds.filter(a => a.contentType === "link");

            const sections: string[] = [];
            if (adHeadlines.length)
              sections.push("AD HEADLINES\n" + adHeadlines.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));
            if (adBodies.length)
              sections.push("AD BODY COPY\n" + adBodies.map((a, i) => `--- Body ${i + 1} ---\n${a.content}`).join("\n\n"));
            if (adLinks.length)
              sections.push("LINK DESCRIPTIONS\n" + adLinks.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));

            results.adCopyPushed = await upsertCustomValue(
              session,
              `ZAP Ad Copy`,
              rt(sections.join("\n\n") || "No ad copy")
            );
          }
        } catch (e) { console.warn("[GHL] Ad copy push error:", e); session.slotError("adCopy", e); }
      }

      // ─── 6. Offer Copy ─────────────────────────────────────────────────────────
      if (kit.selectedOfferId) {
        try {
          const [offer] = await db
            .select()
            .from(offers)
            .where(eq(offers.id, kit.selectedOfferId))
            .limit(1);
          if (offer) {
            const formatAngle = (label: string, data: any): string => {
              if (!data) return `${label}\n(not generated)`;
              return [
                label,
                `Offer Name: ${data.offerName || ""}`,
                `Value Proposition: ${data.valueProposition || ""}`,
                `Pricing: ${data.pricing || ""}`,
                `Bonuses: ${data.bonuses || ""}`,
                `Guarantee: ${data.guarantee || ""}`,
                `Urgency: ${data.urgency || ""}`,
                `CTA: ${data.cta || ""}`,
              ].join("\n");
            };
            const parse = (raw: any) =>
              raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;

            const offerText = [
              formatAngle("=== GODFATHER OFFER (Premium) ===", parse(offer.godfatherAngle)),
              formatAngle("=== FREE OFFER (Lead Magnet) ===",  parse(offer.freeAngle)),
              formatAngle("=== DOLLAR OFFER (Entry Point) ===", parse(offer.dollarAngle)),
            ].join("\n\n");

            results.offerPushed = await upsertCustomValue(
              session,
              `ZAP Offer Copy`,
              rt(offerText)
            );
          }
        } catch (e) { console.warn("[GHL] Offer push error:", e); session.slotError("offer", e); }
      }

      // ─── 7. HVCO / Lead Magnet Title ───────────────────────────────────────────
      if (kit.selectedHvcoId) {
        try {
          const [hvco] = await db
            .select()
            .from(hvcoTitles)
            .where(eq(hvcoTitles.id, kit.selectedHvcoId))
            .limit(1);
          if (hvco) {
            const hvcoText = [
              `Title: ${hvco.title}`,
              `Type: ${hvco.tabType || ""}`,
              `Topic: ${hvco.hvcoTopic || ""}`,
            ].join("\n");
            results.hvcoTitlePushed = await upsertCustomValue(
              session,
              `ZAP Lead Magnet`,
              rt(hvcoText)
            );
            // Delivery layer: the hosted magnet URL as a Custom Value. This is the
            // customer's follow-up layer — their GHL workflow injects
            // {{custom_values.zap_lead_magnet_url}} into their own nurture. Locked
            // line held: CV only, no contact-write, no tags. Populated only once
            // the magnet has been published (lead_magnet_download campaigns).
            if (hvco.magnetHtmlUrl) {
              results.leadMagnetUrlPushed = await upsertCustomValue(
                session,
                `ZAP Lead Magnet URL`,
                hvco.magnetHtmlUrl
              );
            }
          }
        } catch (e) { console.warn("[GHL] HVCO push error:", e); session.slotError("leadMagnet", e); }
      }

      // ─── 8. Hero Mechanism ─────────────────────────────────────────────────────
      if (kit.selectedMechanismId) {
        try {
          const [mech] = await db
            .select()
            .from(heroMechanisms)
            .where(eq(heroMechanisms.id, kit.selectedMechanismId))
            .limit(1);
          if (mech) {
            const mechText = [
              `Mechanism Name: ${mech.mechanismName}`,
              `Description: ${mech.mechanismDescription}`,
              mech.descriptor ? `Type: ${mech.descriptor}` : null,
              mech.application ? `Application: ${mech.application}` : null,
            ].filter(Boolean).join("\n");
            results.heroMechanismPushed = await upsertCustomValue(
              session,
              `ZAP Hero Mechanism`,
              rt(mechText)
            );
          }
        } catch (e) { console.warn("[GHL] Hero mechanism push error:", e); session.slotError("mechanism", e); }
      }

      // ─── 9. Ad Creatives ─────────────────────────────────────────────────────
      // Granular per-variation CVs (follows Email/WhatsApp pattern): push
      // headline + Cloudinary image URL per variation, plus a count CV.
      // GHL workflow templates reference {{custom_values.zap_ad_creative_1_image}}
      // to render the composited ad image inline.
      if (kit.selectedAdCreativeBatchId) {
        try {
          const creatives = await db
            .select()
            .from(adCreatives)
            .where(and(
              eq(adCreatives.batchId, kit.selectedAdCreativeBatchId),
              eq(adCreatives.userId, ctx.user.id),
            ))
            .orderBy(adCreatives.variationNumber);

          if (creatives.length > 0) {
            let creativeSlotsOk = 0;
            for (let i = 0; i < creatives.length; i++) {
              const c = creatives[i];
              const okHeadline = await upsertCustomValue(
                session,
                `ZAP Ad Creative ${i + 1} Headline`,
                rt(c.headline || ""),
              );
              const okImage = await upsertCustomValue(
                session,
                `ZAP Ad Creative ${i + 1} Image`,
                c.imageUrl || "",
              );
              if (okHeadline && okImage) creativeSlotsOk++;
            }

            const okCount = await upsertCustomValue(
              session,
              "ZAP Ad Creative Count",
              String(creatives.length),
            );

            results.adCreativesPushed =
              creativeSlotsOk === creatives.length && okCount && creatives.length > 0;

            // Orphan cleanup: DELETE stale `ZAP Ad Creative N (Headline|Image)`
            // CVs where N > current count (from a prior push with more variations).
            // Batch is 5 today; match up to 10 defensively.
            const orphanSlots = Array.from(
              { length: 10 - creatives.length },
              (_, k) => k + creatives.length + 1,
            );
            if (orphanSlots.length > 0) {
              await cleanupOrphanCustomValues(
                session,
                new RegExp(`^ZAP Ad Creative (?:${orphanSlots.join("|")}) (?:Headline|Image)$`),
              );
            }
          }
        } catch (e) { console.warn("[GHL] Ad creatives push error:", e); session.slotError("adCreatives", e); }
      }

      // The write-level flags stay in the log for diagnosis; the coach is told what the READ-BACK confirms.
      console.log(`[GHL] push write flags: ${JSON.stringify(results)}`);
      return session.verify();
    }),
});
