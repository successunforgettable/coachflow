import { z } from "zod";
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
import { encryptToken, decryptToken } from "../_core/tokenCrypto";

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
const workflowStatusCache = new Map<number, {
  data: { installed: boolean; count: number; total: number; checkedAt: string };
  expiresAt: number;
}>();
const WORKFLOW_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── D1 Helper: Upsert Custom Value ───────────────────────────────────────────
async function upsertCustomValue(
  locationId: string,
  headers: Record<string, string>,
  name: string,
  value: string
): Promise<boolean> {
  // Phase C C3 follow-on 7: forensic outbound-URL log, mirrors the Meta
  // a71efc1 instrumentation pattern. GHL uses Bearer Authorization header
  // (not URL access_token query param like Meta), so no redaction needed —
  // URLs are safe to log as-is. Closes the GHL observability gap so any
  // future Custom Value push failure is byte-level diagnosable from the
  // first cycle.
  try {
    const listUrl = `${GHL_BASE}/locations/${locationId}/customValues`;
    console.log(`[GHL API] upsertCustomValue LIST GET ${listUrl} (name="${name}")`);
    const listRes = await fetch(listUrl, {
      method: "GET",
      headers,
    });
    if (listRes.ok) {
      const listData = await listRes.json() as { customValues?: Array<{ id: string; name: string }> };
      const existing = (listData.customValues || []).find((cv) => cv.name === name);
      if (existing) {
        const putUrl = `${GHL_BASE}/locations/${locationId}/customValues/${existing.id}`;
        console.log(`[GHL API] upsertCustomValue PUT ${putUrl}`);
        const putRes = await fetch(putUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name, value }),
        });
        if (!putRes.ok) console.warn(`[GHL] PUT customValue failed for "${name}":`, await putRes.text());
        return putRes.ok;
      }
    }
    const postUrl = `${GHL_BASE}/locations/${locationId}/customValues`;
    console.log(`[GHL API] upsertCustomValue POST ${postUrl}`);
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, value }),
    });
    if (!postRes.ok) console.warn(`[GHL] POST customValue failed for "${name}":`, await postRes.text());
    return postRes.ok;
  } catch (e) {
    console.warn(`[GHL] upsertCustomValue error for "${name}":`, e);
    return false;
  }
}

// ─── Orphan cleanup: DELETE stale per-message CVs from prior longer pushes ───
//
// Phase C C3 follow-on 8 (Phase 1) — when a user previously pushed a 7-email
// kit then re-pushes a 3-email kit, the granular email CVs at slots 4-7 from
// the prior push are now stale. The elastic workflow's count-based If/Else
// branches won't read them (correct behavior gated by `ZAP Email Count`),
// but defensive cleanup keeps the GHL location's CV list tidy AND prevents
// any future workflow-design edit by Arfeen from accidentally referencing a
// stale orphan.
//
// Pattern: LIST all customValues, regex-match orphan names where N > current
// push length, DELETE each by id. One LIST + variable DELETEs per cleanup
// call. Forensic logs on every outbound URL per the C3 observability pattern.
async function cleanupOrphanCustomValues(
  locationId: string,
  headers: Record<string, string>,
  orphanNameRegex: RegExp,
): Promise<number> {
  try {
    const listUrl = `${GHL_BASE}/locations/${locationId}/customValues`;
    console.log(`[GHL API] cleanupOrphans LIST GET ${listUrl} (pattern=${orphanNameRegex})`);
    const listRes = await fetch(listUrl, { method: "GET", headers });
    if (!listRes.ok) return 0;
    const listData = await listRes.json() as { customValues?: Array<{ id: string; name: string }> };
    const orphans = (listData.customValues || []).filter((cv) => orphanNameRegex.test(cv.name));
    let deleted = 0;
    for (const cv of orphans) {
      const deleteUrl = `${GHL_BASE}/locations/${locationId}/customValues/${cv.id}`;
      console.log(`[GHL API] cleanupOrphans DELETE ${deleteUrl} (orphan="${cv.name}")`);
      const delRes = await fetch(deleteUrl, { method: "DELETE", headers });
      if (delRes.ok) deleted++;
      else console.warn(`[GHL] DELETE orphan failed for "${cv.name}":`, await delRes.text());
    }
    return deleted;
  } catch (e) {
    console.warn(`[GHL] cleanupOrphanCustomValues error:`, e);
    return 0;
  }
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
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [connection] = await db
      .select()
      .from(ghlAccessTokens)
      .where(eq(ghlAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      return { connected: false };
    }

    const now = new Date();
    const isExpired = new Date(connection.tokenExpiresAt) < now;

    return {
      connected: !isExpired,
      locationId: connection.locationId,
      locationName: connection.locationName,
      connectedAt: connection.connectedAt,
      expiresAt: connection.tokenExpiresAt,
      isExpired,
      // Phase C C3 follow-on 8 (Phase 1): surface the master snapshot ID
      // to the client so the post-push banner + Settings link can build
      // the GHL deep link. null when not configured — banner/link hide
      // gracefully (graceful degradation pre-snapshot-build window).
      masterSnapshotId: process.env.GHL_MASTER_SNAPSHOT_ID ?? null,
    };
  }),

  /**
   * Detect whether the customer's GHL location has ZAP's master-snapshot
   * workflows installed. Uses workflows.readonly scope to list workflows,
   * then prefix-matches against the canonical ZAP_WORKFLOW_NAMES list.
   * In-memory 1-hour cache; pass force=true to bypass.
   */
  getWorkflowStatus: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const force = input?.force ?? false;
      const userId = ctx.user.id;

      // Check cache (unless force-refresh)
      if (!force) {
        const cached = workflowStatusCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data;
        }
      }

      const db = await getDb();
      if (!db) return { installed: false, count: 0, total: ZAP_WORKFLOW_NAMES.length, checkedAt: new Date().toISOString() };

      const [ghl] = await db.select().from(ghlAccessTokens).where(eq(ghlAccessTokens.userId, userId)).limit(1);
      if (!ghl || !ghl.locationId || new Date(ghl.tokenExpiresAt) < new Date()) {
        return { installed: false, count: 0, total: ZAP_WORKFLOW_NAMES.length, checkedAt: new Date().toISOString() };
      }

      try {
        const url = `${GHL_BASE}/workflows/?locationId=${ghl.locationId}`;
        console.log(`[GHL API] getWorkflowStatus GET ${url}`);
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${decryptToken(ghl.accessToken)}`,
            Version: "2021-07-28",
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[GHL] getWorkflowStatus failed: HTTP ${res.status} — ${errText.substring(0, 200)}`);
          return { installed: false, count: 0, total: ZAP_WORKFLOW_NAMES.length, checkedAt: new Date().toISOString() };
        }

        const data = await res.json() as { workflows?: Array<{ id: string; name: string; status?: string; published?: boolean }> };
        const workflows = data.workflows || [];

        // Count ZAP workflows via case-insensitive prefix match
        const zapWorkflows = workflows.filter(wf => /^zap[\s-]/i.test(wf.name));
        const count = zapWorkflows.length;
        const installed = count >= ZAP_WORKFLOW_THRESHOLD;

        const result = {
          installed,
          count,
          total: ZAP_WORKFLOW_NAMES.length as number,
          checkedAt: new Date().toISOString(),
        };

        // Cache the result
        workflowStatusCache.set(userId, {
          data: result,
          expiresAt: Date.now() + WORKFLOW_CACHE_TTL_MS,
        });

        return result;
      } catch (e) {
        console.warn("[GHL] getWorkflowStatus error:", e);
        return { installed: false, count: 0, total: ZAP_WORKFLOW_NAMES.length, checkedAt: new Date().toISOString() };
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
   * Exchange auth code for access token
   */
  exchangeCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const clientId = process.env.GHL_CLIENT_ID;
      const clientSecret = process.env.GHL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL credentials not configured" });
      }

      const redirectUri = `${process.env.APP_URL || "https://zapcampaigns.com"}/api/oauth/gohighlevel/callback`;

      const tokenRes = await fetch(`${GHL_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[GHL] Token exchange failed:", errText);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL token exchange failed" });
      }

      const tokenData = await tokenRes.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);

      await db.delete(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id));
      const rawRefresh = tokenData.refresh_token || null;
      await db.insert(ghlAccessTokens).values({
        userId: ctx.user.id,
        accessToken: encryptToken(tokenData.access_token),
        refreshToken: rawRefresh ? encryptToken(rawRefresh) : null,
        tokenExpiresAt: expiresAt,
        locationId: tokenData.locationId || null,
        locationName: null,
        companyId: tokenData.companyId || null,
      });

      return { success: true, locationId: tokenData.locationId };
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ghl] = await db.select().from(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id)).limit(1);
      if (!ghl) throw new TRPCError({ code: "FORBIDDEN", message: "GHL not connected" });

      if (new Date(ghl.tokenExpiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "GHL token expired — please reconnect" });
      }

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      const kitName = kit.name || "Campaign";
      const locationId = ghl.locationId!;

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

      const headers: Record<string, string> = {
        Authorization: `Bearer ${decryptToken(ghl.accessToken)}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      };

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
              const okSubj = await upsertCustomValue(locationId, headers, `ZAP Email ${i + 1} Subject`, em.subject || "");
              const okBody = await upsertCustomValue(locationId, headers, `ZAP Email ${i + 1} Body`, em.body || "");
              if (okSubj && okBody) emailSlotsOk++;
            }

            // Count + type indicator CVs (snapshot reads these for branching)
            const okCount = await upsertCustomValue(locationId, headers, "ZAP Email Count", String(emailCount));
            const okType = await upsertCustomValue(locationId, headers, "ZAP Email Sequence Type", sequenceType);

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
              locationId, headers,
              new RegExp(`^ZAP Email (?:${orphanEmailSlots.join("|")}) (Subject|Body)$`),
            );
          }
        } catch (e) { console.warn("[GHL] Email push error:", e); }
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
              const ok = await upsertCustomValue(locationId, headers, `ZAP WhatsApp ${i + 1}`, m.text || m.message || "");
              if (ok) waSlotsOk++;
            }

            // Count + type indicator CVs
            const okWaCount = await upsertCustomValue(locationId, headers, "ZAP WhatsApp Count", String(whatsappCount));
            const okWaType = await upsertCustomValue(locationId, headers, "ZAP WhatsApp Sequence Type", waSequenceType);

            results.whatsappPushed = waSlotsOk === whatsappCount && okWaCount && okWaType && whatsappCount > 0;

            // Orphan cleanup: DELETE stale `ZAP WhatsApp N` CVs where
            // N > whatsappCount. Pattern parallels email cleanup.
            const orphanWaSlots = Array.from(
              { length: 20 - whatsappCount },
              (_, k) => k + whatsappCount + 1,
            );
            await cleanupOrphanCustomValues(
              locationId, headers,
              new RegExp(`^ZAP WhatsApp (?:${orphanWaSlots.join("|")})$`),
            );
          }
        } catch (e) { console.warn("[GHL] WhatsApp push error:", e); }
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
              locationId, headers,
              `ZAP Landing Page`,
              lpText
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
        } catch (e) { console.warn("[GHL] Landing page push error:", e); }
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
              locationId, headers,
              `ZAP Headlines`,
              hlText
            );
          }
        } catch (e) { console.warn("[GHL] Headlines push error:", e); }
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
              locationId, headers,
              `ZAP Ad Copy`,
              sections.join("\n\n") || "No ad copy"
            );
          }
        } catch (e) { console.warn("[GHL] Ad copy push error:", e); }
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
              locationId, headers,
              `ZAP Offer Copy`,
              offerText
            );
          }
        } catch (e) { console.warn("[GHL] Offer push error:", e); }
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
              locationId, headers,
              `ZAP Lead Magnet`,
              hvcoText
            );
          }
        } catch (e) { console.warn("[GHL] HVCO push error:", e); }
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
              locationId, headers,
              `ZAP Hero Mechanism`,
              mechText
            );
          }
        } catch (e) { console.warn("[GHL] Hero mechanism push error:", e); }
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
                locationId, headers,
                `ZAP Ad Creative ${i + 1} Headline`,
                c.headline || "",
              );
              const okImage = await upsertCustomValue(
                locationId, headers,
                `ZAP Ad Creative ${i + 1} Image`,
                c.imageUrl || "",
              );
              if (okHeadline && okImage) creativeSlotsOk++;
            }

            const okCount = await upsertCustomValue(
              locationId, headers,
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
                locationId, headers,
                new RegExp(`^ZAP Ad Creative (?:${orphanSlots.join("|")}) (?:Headline|Image)$`),
              );
            }
          }
        } catch (e) { console.warn("[GHL] Ad creatives push error:", e); }
      }

      return results;
    }),
});
