/**
 * PushKitModal — Phase C C3
 *
 * Unified push surface for shipping a completed campaign kit to Meta Ads
 * Manager and/or GoHighLevel. Replaces the V2CampaignKit `handlePush` toast
 * placeholder ("Push coming soon").
 *
 * UX shape — single combined modal with two platform sections + three
 * action buttons (Meta-only, GHL-only, Both). Asymmetry between the two
 * endpoint contracts drives the UI:
 *   - Meta `publishToMeta` is single-creative + per-call config
 *     (campaign name, objective, daily budget, targeting, status).
 *     Operator picks one of the 5 ad creative variations, sets budget,
 *     fires.
 *   - GHL `pushCampaign` is whole-kit + zero config — one call publishes
 *     8 Custom Values + 1 Funnel + 1 WhatsApp Workflow + N Email
 *     Templates.
 *
 * OAuth-at-click-time: each platform pill shows connection state. If
 * disconnected, clicking the pill opens OAuth in a new tab; on window
 * refocus the connection status refetches automatically.
 *
 * Partial-failure handling: "Push to both" uses Promise.allSettled. The
 * post-push success modal renders per-platform outcomes (Meta success +
 * GHL slot-level breakdown via the boolean map returned by the router).
 *
 * Latent Meta pageId trap (closed in C3): the OAuth callback now captures
 * pageId on connect. If a user connected before C3 (pageId=NULL on row),
 * the Meta section surfaces a "Reconnect Meta" CTA — re-running OAuth
 * populates pageId so the createAdCreative call won't fail at
 * object_story_spec.page_id.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { openSnapshotApplyTab } from "./lib/ghlSnapshot";
import KitPlaceholderBanner from "./components/KitPlaceholderBanner";
import type { PlaceholderReport } from "./lib/placeholderDetector";

type Props = {
  kitId: number;
  kitName: string;
  onClose: () => void;
  /** Phase D Sprint 3 — kit-level placeholder report from V2CampaignKit.
   * Optional (defaults to empty report) so existing call sites don't break. */
  placeholderReport?: PlaceholderReport;
  /** Phase D Sprint 3 — invoked by the modal's "Review on kit page" CTA when
   * placeholders exist. Parent (V2CampaignKit) handles close + scroll-to-banner. */
  onReviewPlaceholdersFromModal?: () => void;
};

const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_AWARENESS", label: "Awareness" },
  { value: "OUTCOME_SALES", label: "Sales" },
] as const;

type Objective = (typeof OBJECTIVES)[number]["value"];

// ─── Pure helper (exported for tests) ────────────────────────────────────────
// Derives a sensible default body for the Meta creative. Priority:
//   1. Landing page subheadline (richest 1-line summary)
//   2. Landing page eyebrowHeadline (next-best 1-liner)
//   3. Empty — user must fill before push
export function deriveDefaultBody(lpData: any, angleKey: string): string {
  if (!lpData) return "";
  const angleRaw =
    angleKey === "godfather" ? lpData.godfatherAngle :
    angleKey === "free"      ? lpData.freeAngle :
    angleKey === "dollar"    ? lpData.dollarAngle :
                               lpData.originalAngle;
  if (!angleRaw) return "";
  let parsed: any = null;
  try {
    parsed = typeof angleRaw === "string" ? JSON.parse(angleRaw) : angleRaw;
  } catch {
    return "";
  }
  return parsed?.subheadline || parsed?.eyebrowHeadline || "";
}

// ─── Inline style atoms (match V2CampaignKit greeting modal aesthetic) ───────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
  fontSize: "12px",
  fontWeight: 700,
  color: "#555",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(26,22,36,0.18)",
  background: "#fff",
  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
  fontSize: "14px",
  color: "var(--v2-text-dark, #1A1624)",
  boxSizing: "border-box",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(26,22,36,0.12)",
  borderRadius: "16px",
  padding: "18px 18px 20px",
  marginBottom: "16px",
  background: "#fafaf8",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
  fontWeight: 800,
  fontSize: "18px",
  color: "var(--v2-text-dark, #1A1624)",
  margin: "0 0 12px",
};

function PillBadge({ tone, children }: { tone: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const palette =
    tone === "ok"   ? { bg: "rgba(88,204,2,0.14)",  fg: "#2E7D00" } :
    tone === "warn" ? { bg: "rgba(255,180,0,0.18)", fg: "#A06200" } :
                      { bg: "rgba(220,38,38,0.14)", fg: "#B12121" };
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "9999px",
      background: palette.bg,
      color: palette.fg,
      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
      fontSize: "12px",
      fontWeight: 700,
    }}>{children}</span>
  );
}

export default function PushKitModal({ kitId, kitName, onClose, placeholderReport, onReviewPlaceholdersFromModal }: Props) {
  // ─── Connection status (both platforms) ────────────────────────────────────
  const metaConn = trpc.meta.getConnectionStatus.useQuery();
  const ghlConn  = trpc.ghl.getConnectionStatus.useQuery();
  const metaOAuthUrl = trpc.meta.getOAuthUrl.useQuery(undefined, { enabled: false });
  const ghlOAuthUrl  = trpc.ghl.getOAuthUrl.useQuery(undefined,  { enabled: false });

  // Refetch connection state on window refocus — this is the OAuth-at-
  // click-time bridge. User clicks "Connect" → popup opens OAuth → user
  // completes → returns to the kit page tab → focus event → refetch.
  useEffect(() => {
    const onFocus = () => { metaConn.refetch(); ghlConn.refetch(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [metaConn, ghlConn]);

  // ─── Kit + dependent data ──────────────────────────────────────────────────
  const kit = trpc.campaignKits.getById.useQuery({ kitId });
  const batchId = (kit.data as any)?.selectedAdCreativeBatchId as string | null | undefined;
  const lpId    = (kit.data as any)?.selectedLandingPageId    as number | null | undefined;
  const lpAngle = ((kit.data as any)?.selectedLandingPageAngle as string | null | undefined) || "original";

  const batch = trpc.adCreatives.getBatch.useQuery(
    { batchId: batchId || "" },
    { enabled: !!batchId },
  );
  const lp = trpc.landingPages.get.useQuery(
    { id: lpId || 0 },
    { enabled: !!lpId },
  );

  // ─── Meta form state ───────────────────────────────────────────────────────
  const [selectedVariation, setSelectedVariation] = useState<number>(1);
  const [campaignName, setCampaignName] = useState<string>("");
  const [objective, setObjective] = useState<Objective>("OUTCOME_LEADS");
  const [dailyBudget, setDailyBudget] = useState<number>(20);
  const [countries, setCountries] = useState<string>("US");
  const [status, setStatus] = useState<"PAUSED" | "ACTIVE">("PAUSED");
  const [body, setBody] = useState<string>("");
  const [bodyDirty, setBodyDirty] = useState<boolean>(false);

  // Default campaign name from kit name (one-shot)
  useEffect(() => {
    if (kit.data && !campaignName) setCampaignName(kitName || "Campaign");
  }, [kit.data, kitName, campaignName]);

  // Default body from LP subheadline (one-shot, unless user typed something)
  useEffect(() => {
    if (lp.data && !bodyDirty && !body) {
      setBody(deriveDefaultBody(lp.data, lpAngle));
    }
  }, [lp.data, lpAngle, body, bodyDirty]);

  const selectedCreative = useMemo(
    () => batch.data?.find((c: any) => c.variationNumber === selectedVariation) ?? null,
    [batch.data, selectedVariation],
  );

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const publishToMeta = trpc.meta.publishToMeta.useMutation();
  const pushGhl       = trpc.ghl.pushCampaign.useMutation();

  // ─── Workflow status (snapshot detection) ─────────────────────────────────
  const workflowStatus = trpc.ghl.getWorkflowStatus.useQuery(undefined, {
    enabled: !!ghlConn.data?.connected,
  });
  const snapshotInstalled = !!workflowStatus.data?.installed;
  const snapshotId = (ghlConn.data as { masterSnapshotId?: string | null } | undefined)?.masterSnapshotId ?? null;

  // ─── Derived UI states ─────────────────────────────────────────────────────
  const metaConnected = !!metaConn.data?.connected;
  const ghlConnected  = !!ghlConn.data?.connected;
  // Latent pageId trap: if Meta is "connected" but the connection row has
  // no Page captured, createAdCreative will fail. We surface this as a
  // warn-tone reconnect prompt.
  const metaNeedsReconnect = metaConnected && !(metaConn.data as any)?.adAccountId;

  // LP must have publicUrl (Cloudflare KV publish ran) for Meta — the link
  // destination is the live LP. Without it, Meta push is blocked.
  const lpPublicUrl = (lp.data as { publicUrl?: string | null } | undefined)?.publicUrl || null;
  const metaPushable = metaConnected && !metaNeedsReconnect && !!selectedCreative && !!lpPublicUrl && !!body.trim() && !!campaignName.trim();
  const ghlPushable  = ghlConnected && snapshotInstalled;

  // ─── Action handlers ───────────────────────────────────────────────────────
  async function handleConnectMeta() {
    try {
      const res = await metaOAuthUrl.refetch();
      const url = (res.data as { url?: string } | undefined)?.url;
      if (!url) { toast.error("Couldn't get Meta OAuth URL"); return; }
      window.open(url, "_blank", "width=600,height=700,left=200,top=100");
    } catch {
      toast.error("Couldn't open Meta connect flow");
    }
  }

  async function handleConnectGhl() {
    try {
      const res = await ghlOAuthUrl.refetch();
      const url = (res.data as { url?: string } | undefined)?.url;
      if (!url) { toast.error("Couldn't get GHL OAuth URL"); return; }
      window.open(url, "_blank", "width=600,height=700,left=200,top=100");
    } catch {
      toast.error("Couldn't open GHL connect flow");
    }
  }

  function buildMetaInput() {
    if (!selectedCreative || !lpPublicUrl) {
      throw new Error("Meta push prerequisites missing");
    }
    const countryList = countries
      .split(",")
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);
    return {
      headline: selectedCreative.headline as string,
      body: body.trim(),
      linkUrl: lpPublicUrl,
      imageUrl: (selectedCreative.imageUrl as string) || undefined,
      callToAction: "LEARN_MORE",
      campaignName: campaignName.trim(),
      objective,
      dailyBudget,
      targeting: { countries: countryList.length ? countryList : ["US"] },
      status,
    };
  }

  type PushResult =
    | { platform: "meta"; ok: true; campaignId: string }
    | { platform: "meta"; ok: false; error: string }
    | { platform: "ghl";  ok: true; flags: Record<string, boolean>; pushedCount: number; totalCount: number }
    | { platform: "ghl";  ok: false; error: string };

  const [results, setResults] = useState<PushResult[] | null>(null);
  const [pushing, setPushing] = useState<boolean>(false);

  async function fireMeta(): Promise<PushResult> {
    try {
      const res = await publishToMeta.mutateAsync(buildMetaInput());
      return { platform: "meta", ok: true, campaignId: res.campaignId };
    } catch (err) {
      return { platform: "meta", ok: false, error: err instanceof Error ? err.message : "Unknown Meta error" };
    }
  }

  async function fireGhl(): Promise<PushResult> {
    try {
      const flags = await pushGhl.mutateAsync({ kitId });
      const entries = Object.entries(flags);
      const pushedCount = entries.filter(([, v]) => v).length;
      return { platform: "ghl", ok: true, flags, pushedCount, totalCount: entries.length };
    } catch (err) {
      return { platform: "ghl", ok: false, error: err instanceof Error ? err.message : "Unknown GHL error" };
    }
  }

  async function handlePush(target: "meta" | "ghl" | "both") {
    setPushing(true);
    setResults(null);
    try {
      if (target === "meta") {
        const r = await fireMeta();
        setResults([r]);
      } else if (target === "ghl") {
        const r = await fireGhl();
        setResults([r]);
      } else {
        const settled = await Promise.allSettled([fireMeta(), fireGhl()]);
        const out: PushResult[] = settled.map((s, i) =>
          s.status === "fulfilled"
            ? s.value
            : ({ platform: i === 0 ? "meta" : "ghl", ok: false, error: "Unexpected rejection" } as PushResult)
        );
        setResults(out);
      }
    } finally {
      setPushing(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-kit-modal-heading"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,22,36,0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        zIndex: 300,
        overflowY: "auto",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          padding: "28px 28px 24px",
          maxWidth: "560px",
          width: "100%",
        }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "14px",
            background: "transparent",
            border: "none",
            fontSize: "22px",
            lineHeight: 1,
            color: "#999",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >×</button>

        <h2
          id="push-kit-modal-heading"
          style={{
            fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "24px",
            color: "var(--v2-text-dark, #1A1624)",
            margin: "0 0 6px",
          }}
        >
          Push live to Meta + GHL
        </h2>
        <p style={{
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontSize: "13px",
          color: "#777",
          margin: "0 0 20px",
        }}>
          Pick one or both. Meta needs per-ad config; GHL pushes the whole kit in one shot.
        </p>

        {/* Phase D Sprint 3: compact placeholder warning. Renders only when
            parent passed a report containing placeholders. Suppressed in the
            ResultsView (post-push state) — the warning is for pre-push
            decision-making. The "Review on kit page" button invokes the
            parent's onReviewPlaceholdersFromModal which closes the modal +
            scrolls to the full banner. */}
        {!results && placeholderReport && placeholderReport.total > 0 && (
          <div>
            <KitPlaceholderBanner report={placeholderReport} compact />
            {onReviewPlaceholdersFromModal && (
              <button
                onClick={onReviewPlaceholdersFromModal}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255, 91, 29, 0.35)",
                  background: "transparent",
                  color: "var(--v2-primary-btn, #FF5B1D)",
                  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >← Review on kit page first</button>
            )}
          </div>
        )}

        {results ? (
          <ResultsView
            results={results}
            onClose={onClose}
            onRetry={() => setResults(null)}
            masterSnapshotId={(ghlConn.data as { masterSnapshotId?: string | null } | undefined)?.masterSnapshotId ?? null}
          />
        ) : (
          <>
            {/* ─── Meta section ─────────────────────────────────────────── */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
                <h3 style={sectionHeadingStyle}>Meta Ads</h3>
                {metaConn.isLoading ? (
                  <PillBadge tone="warn">Checking…</PillBadge>
                ) : metaNeedsReconnect ? (
                  <button onClick={handleConnectMeta} style={{ ...inputStyle, width: "auto", padding: "6px 12px", cursor: "pointer", background: "transparent", border: "1px solid #A06200", color: "#A06200", fontWeight: 700 }}>⚠ Reconnect Meta</button>
                ) : metaConnected ? (
                  <PillBadge tone="ok">✓ {(metaConn.data as any)?.adAccountName || "Connected"}</PillBadge>
                ) : (
                  <button onClick={handleConnectMeta} style={{ ...inputStyle, width: "auto", padding: "6px 12px", cursor: "pointer", background: "var(--v2-primary-btn, #FF5B1D)", border: "none", color: "#fff", fontWeight: 700 }}>Connect Meta</button>
                )}
              </div>

              {metaConnected && !metaNeedsReconnect && (
                <>
                  {!lpPublicUrl && (
                    <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#A06200", margin: "0 0 12px" }}>
                      Landing page not yet published. Meta push needs the live LP URL — publish the landing page first.
                    </p>
                  )}

                  <label style={labelStyle}>Ad variation</label>
                  {batch.isLoading ? (
                    <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#999", margin: "0 0 12px" }}>Loading variations…</p>
                  ) : batch.data && batch.data.length > 0 ? (
                    <select
                      value={selectedVariation}
                      onChange={e => setSelectedVariation(Number(e.target.value))}
                      style={{ ...inputStyle, marginBottom: "12px" }}
                    >
                      {batch.data.map((c: any) => (
                        <option key={c.id} value={c.variationNumber}>
                          #{c.variationNumber} — {c.designStyle} · {c.headlineFormula} · "{(c.headline || "").substring(0, 50)}"
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#A06200", margin: "0 0 12px" }}>No ad creatives on this kit.</p>
                  )}

                  <label style={labelStyle}>Campaign name</label>
                  <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} style={{ ...inputStyle, marginBottom: "12px" }} />

                  <label style={labelStyle}>Body copy</label>
                  <textarea
                    value={body}
                    onChange={e => { setBody(e.target.value); setBodyDirty(true); }}
                    rows={3}
                    style={{ ...inputStyle, marginBottom: "12px", fontFamily: "inherit", resize: "vertical" }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>Objective</label>
                      <select value={objective} onChange={e => setObjective(e.target.value as Objective)} style={inputStyle}>
                        {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Daily budget (USD)</label>
                      <input type="number" min={1} value={dailyBudget} onChange={e => setDailyBudget(Number(e.target.value) || 1)} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Countries (ISO codes, comma-separated)</label>
                      <input type="text" value={countries} onChange={e => setCountries(e.target.value)} placeholder="US, CA, GB" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Initial status</label>
                      <select value={status} onChange={e => setStatus(e.target.value as "PAUSED" | "ACTIVE")} style={inputStyle}>
                        <option value="PAUSED">Paused (review first)</option>
                        <option value="ACTIVE">Active (spend immediately)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ─── GHL section ──────────────────────────────────────────── */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "12px", flexWrap: "wrap" }}>
                <h3 style={sectionHeadingStyle}>Go High Level</h3>
                {ghlConn.isLoading ? (
                  <PillBadge tone="warn">Checking…</PillBadge>
                ) : ghlConnected ? (
                  <PillBadge tone="ok">✓ {(ghlConn.data as any)?.locationName || (ghlConn.data as any)?.locationId || "Connected"}</PillBadge>
                ) : (
                  <button onClick={handleConnectGhl} style={{ ...inputStyle, width: "auto", padding: "6px 12px", cursor: "pointer", background: "var(--v2-primary-btn, #FF5B1D)", border: "none", color: "#fff", fontWeight: 700 }}>Connect GHL</button>
                )}
              </div>
              <p style={{ fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)", fontSize: "13px", color: "#555", margin: 0, lineHeight: 1.5 }}>
                Pushes the kit's content into your GHL location as Custom Values — offer, lead magnet, mechanism, headlines, ad copy, landing page, plus the email + WhatsApp sequences split per message. Apply ZAP's Master Snapshot once to your sub-account and every push auto-renders functional templates, funnels, and workflows from these values.
              </p>
              {ghlConnected && !snapshotInstalled && !workflowStatus.isLoading && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.18)",
                }}>
                  <p style={{
                    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                    fontSize: "13px",
                    color: "#B12121",
                    margin: "0 0 8px",
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}>
                    Your GHL location doesn't have ZAP's workflows yet ({workflowStatus.data?.count ?? 0}/{workflowStatus.data?.total ?? 16} detected). Apply the Master Snapshot first — it takes 30 seconds.
                  </p>
                  {snapshotId && (
                    <button
                      onClick={() => openSnapshotApplyTab(snapshotId)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 9999,
                        border: "none",
                        background: "var(--v2-primary-btn, #FF5B1D)",
                        color: "#fff",
                        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >Apply ZAP Master Snapshot →</button>
                  )}
                </div>
              )}
            </div>

            {/* ─── Action buttons ───────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "20px" }}>
              <button
                disabled={!ghlPushable || pushing}
                onClick={() => handlePush("ghl")}
                style={actionButtonStyle("secondary", ghlPushable && !pushing)}
              >Push to GHL</button>
              <button
                disabled={!metaPushable || pushing}
                onClick={() => handlePush("meta")}
                style={actionButtonStyle("secondary", metaPushable && !pushing)}
              >Push to Meta</button>
              <button
                disabled={(!metaPushable && !ghlPushable) || pushing}
                onClick={() => handlePush("both")}
                style={{ ...actionButtonStyle("primary", (metaPushable || ghlPushable) && !pushing), marginLeft: "auto" }}
              >{pushing ? "Pushing…" : "Push to both →"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function actionButtonStyle(weight: "primary" | "secondary", enabled: boolean): React.CSSProperties {
  if (weight === "primary") {
    return {
      padding: "12px 22px",
      borderRadius: "9999px",
      border: "none",
      background: enabled ? "var(--v2-primary-btn, #FF5B1D)" : "#e5e0d8",
      color: enabled ? "#fff" : "#999",
      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
      fontWeight: 700,
      fontSize: "14px",
      cursor: enabled ? "pointer" : "default",
    };
  }
  return {
    padding: "10px 18px",
    borderRadius: "9999px",
    border: enabled ? "2px solid var(--v2-primary-btn, #FF5B1D)" : "2px solid #e5e0d8",
    background: "transparent",
    color: enabled ? "var(--v2-primary-btn, #FF5B1D)" : "#999",
    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
    fontWeight: 700,
    fontSize: "14px",
    cursor: enabled ? "pointer" : "default",
  };
}

// ─── Post-push results view ──────────────────────────────────────────────────
function ResultsView({ results, onClose, onRetry, masterSnapshotId }: {
  results: { platform: "meta" | "ghl"; ok: boolean; [k: string]: any }[];
  onClose: () => void;
  onRetry: () => void;
  masterSnapshotId: string | null;
}) {
  const allOk = results.every(r => r.ok);
  // Phase C C3 follow-on 8 (Phase 1): Apply Snapshot banner renders after
  // any GHL push (success or partial) when masterSnapshotId is configured
  // server-side. Hides gracefully pre-snapshot-build window when the env
  // var isn't yet set. Deep link opens GHL's snapshot apply UI in a new
  // tab; user applies once per sub-account, then every future kit push
  // auto-renders functional templates/workflows/funnels from the Custom
  // Values via the elastic per-sequence-type workflow architecture.
  const ghlSuccessfulPush = results.some(r => r.platform === "ghl" && r.ok);
  const showSnapshotBanner = ghlSuccessfulPush && !!masterSnapshotId;
  return (
    <div>
      <div style={{
        padding: "16px",
        borderRadius: "12px",
        background: allOk ? "rgba(88,204,2,0.08)" : "rgba(220,38,38,0.06)",
        marginBottom: "16px",
      }}>
        <p style={{
          fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
          fontWeight: 800,
          fontSize: "18px",
          color: allOk ? "#2E7D00" : "#A06200",
          margin: "0 0 12px",
        }}>
          {allOk ? "Pushed successfully" : "Partial push"}
        </p>
        {results.map((r, i) => (
          <div key={i} style={{ marginBottom: i === results.length - 1 ? 0 : "12px" }}>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", margin: "0 0 4px" }}>
              <strong>{r.platform === "meta" ? "Meta Ads" : "Go High Level"}: </strong>
              {r.ok ? "✓" : "✗"} {r.ok
                ? (r.platform === "meta"
                    ? `Campaign ${r.campaignId} created`
                    : `${r.pushedCount} of ${r.totalCount} slots pushed`)
                : (r.error || "Failed")}
            </p>
            {r.ok && r.platform === "ghl" && r.flags && (
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#555" }}>
                {Object.entries(r.flags as Record<string, boolean>).map(([k, v]) => (
                  <li key={k} style={{ color: v ? "#2E7D00" : "#A06200" }}>{v ? "✓" : "✗"} {k}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {showSnapshotBanner && (
        <div style={{
          padding: "16px 18px",
          borderRadius: "16px",
          background: "rgba(255,91,29,0.08)",
          border: "1px solid rgba(255,91,29,0.25)",
          marginBottom: "16px",
        }}>
          <p style={{
            fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
            fontStyle: "italic",
            fontWeight: 800,
            fontSize: "16px",
            color: "#1A1624",
            margin: "0 0 6px",
          }}>Render your kit in GHL</p>
          <p style={{
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "13px",
            color: "#555",
            margin: "0 0 12px",
            lineHeight: 1.55,
          }}>
            Your Custom Values are live in GHL. Apply ZAP's Master Snapshot once to your sub-account — your funnels, email templates, and workflows then auto-render from these values on every push. Requires GHL agency-admin permission.
          </p>
          <button
            onClick={() => masterSnapshotId && openSnapshotApplyTab(masterSnapshotId)}
            style={{
              padding: "10px 18px",
              borderRadius: "9999px",
              border: "none",
              background: "var(--v2-primary-btn, #FF5B1D)",
              color: "#fff",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >Apply ZAP Master Snapshot →</button>
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button onClick={onRetry} style={actionButtonStyle("secondary", true)}>Push again</button>
        <button onClick={onClose} style={actionButtonStyle("primary", true)}>Done</button>
      </div>
    </div>
  );
}
