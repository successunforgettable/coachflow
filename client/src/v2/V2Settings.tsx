/**
 * V2Settings — Settings page for V2 dashboard.
 * Route: /v2-dashboard/settings
 *
 * Sections:
 * 1. Account — editable name, read-only email, tier badge
 * 2. Usage Stats — campaigns created, assets generated, videos rendered
 * 3. Subscription — upgrade CTA (free) or billing info (pro)
 * 4. Danger Zone — reset onboarding + delete account modal
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { openSnapshotApplyTab } from "./lib/ghlSnapshot";
import V2Layout from "./V2Layout";
import { WorkflowStatusPill } from "./components/WorkflowStatusPill";

const T = {
  bg: "#F5F1EA",
  dark: "#1A1624",
  orange: "#FF5B1D",
  fontH: "'Fraunces', Georgia, serif",
  fontB: "'Instrument Sans', 'Inter', system-ui, sans-serif",
  card: { background: "#fff", borderRadius: 24, padding: "24px 28px" } as React.CSSProperties,
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: T.fontH,
      fontStyle: "italic",
      fontWeight: 900,
      fontSize: 22,
      color: T.dark,
      margin: "0 0 16px 0",
    }}>{children}</h2>
  );
}

function IntegrationsSection() {
  const ghlConn = trpc.ghl.getConnectionStatus.useQuery();
  const snapshotId = (ghlConn.data as { masterSnapshotId?: string | null } | undefined)?.masterSnapshotId ?? null;
  const workflowStatus = trpc.ghl.getWorkflowStatus.useQuery(undefined, {
    enabled: !!ghlConn.data?.connected,
  });
  const recheckWorkflows = trpc.ghl.getWorkflowStatus.useQuery(
    { force: true },
    { enabled: false },
  );

  // Render when GHL is connected (workflow status detection works
  // independent of snapshot config). Hide only when not connected at all.
  if (!ghlConn.data?.connected) return null;
  return (
    <div style={T.card}>
      <SectionHeading>Integrations</SectionHeading>

      {/* Workflow status pill + recheck */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {workflowStatus.isLoading ? (
          <span style={{ fontSize: 12, color: "#999", fontFamily: T.fontB }}>Checking workflows…</span>
        ) : workflowStatus.data ? (
          <WorkflowStatusPill count={workflowStatus.data.count} total={workflowStatus.data.total} />
        ) : null}
        <button
          onClick={() => { recheckWorkflows.refetch(); workflowStatus.refetch(); }}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: T.orange,
            fontFamily: T.fontB,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          }}
        >↻ Recheck</button>
      </div>

      <p style={{ fontSize: 14, color: "#555", lineHeight: 1.55, margin: "0 0 14px" }}>
        Apply ZAP's Master Snapshot to your GoHighLevel sub-account once — your funnels, email templates, and workflows then auto-render from the Custom Values ZAP pushes on every kit publish. Requires GHL agency-admin permission.
      </p>
      {snapshotId && (
        <button
          onClick={() => openSnapshotApplyTab(snapshotId)}
          style={{
            padding: "10px 20px",
            background: T.orange,
            color: "#fff",
            border: "none",
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: T.fontB,
            cursor: "pointer",
          }}
        >Apply ZAP Master Snapshot →</button>
      )}
    </div>
  );
}

export default function V2Settings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // ── Section 1: Account ───────────────────────────────────────────────────
  const [nameValue, setNameValue] = useState(user?.name ?? "");
  const [nameSaved, setNameSaved] = useState(false);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    },
  });

  function handleSaveName() {
    if (!user?.email) return;
    updateProfile.mutate({ name: nameValue, email: user.email });
  }

  // ── Section 2: Usage Stats ───────────────────────────────────────────────
  const { data: servicesData } = trpc.services.list.useQuery();
  const { data: videosData } = trpc.videos.list.useQuery({});

  const campaignCount = servicesData?.length ?? 0;
  const assetsEstimate = campaignCount * 11;
  const videoCount = (videosData as any)?.length ?? 0;

  // ── Section 3: Subscription ──────────────────────────────────────────────
  const tier = (user as any)?.subscriptionTier ?? null;
  const isPro = tier === "pro" || tier === "agency";
  const renewalDate: Date | null = (user as any)?.subscriptionEndsAt
    ? new Date((user as any).subscriptionEndsAt)
    : null;

  function formatDate(d: Date) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  // ── Section 4: Danger Zone ───────────────────────────────────────────────
  const resetOnboarding = trpc.onboarding.reset.useMutation({
    onSuccess: () => navigate("/onboarding"),
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  function handleDeleteConfirm() {
    if (deleteInput !== "DELETE") return;
    setDeleteConfirmed(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <V2Layout>
      {/* Top bar — back link provided by V2Layout */}
      <div style={{ padding: "24px 32px 0", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{
          fontFamily: T.fontH,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: 36,
          color: T.dark,
          margin: "0 0 32px 0",
        }}>
          Settings
        </h1>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px 64px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── SECTION 1: ACCOUNT ── */}
        <div style={T.card}>
          <SectionHeading>Account</SectionHeading>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Full Name
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                placeholder="Your name"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "1.5px solid #E5E0D8",
                  borderRadius: 12,
                  fontSize: 15,
                  fontFamily: T.fontB,
                  color: T.dark,
                  background: "#FAFAF8",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={updateProfile.isPending || !nameValue.trim()}
                style={{
                  padding: "10px 20px",
                  background: nameSaved ? "#10B981" : T.orange,
                  color: "#fff",
                  border: "none",
                  borderRadius: 9999,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.fontB,
                  cursor: updateProfile.isPending || !nameValue.trim() ? "not-allowed" : "pointer",
                  opacity: updateProfile.isPending || !nameValue.trim() ? 0.6 : 1,
                  transition: "background 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {nameSaved ? "Saved!" : updateProfile.isPending ? "Saving…" : "Save Name"}
              </button>
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1.5px solid #E5E0D8",
                borderRadius: 12,
                fontSize: 15,
                fontFamily: T.fontB,
                color: "#888",
                background: "#F0EDE8",
                outline: "none",
                cursor: "not-allowed",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Tier badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#666" }}>Subscription:</span>
            <span style={{
              padding: "4px 14px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              background: isPro ? "#D1FAE5" : "#FFE8DF",
              color: isPro ? "#065F46" : T.orange,
            }}>
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
        </div>

        {/* ── SECTION 1.5: INTEGRATIONS — Phase C C3 follow-on 8 (Phase 1) ── */}
        {/* Apply ZAP Master Snapshot — forever-available reference for users to */}
        {/* re-apply or share the snapshot deep link. Hides when env var not set. */}
        <IntegrationsSection />

        {/* ── SECTION 2: USAGE STATS ── */}
        <div style={T.card}>
          <SectionHeading>Usage Stats</SectionHeading>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Campaigns Created", value: campaignCount },
              { label: "Assets Generated", value: assetsEstimate },
              { label: "Videos Rendered", value: videoCount },
            ].map(({ label, value }) => (
              <div key={label} style={{
                flex: 1,
                background: "#fff",
                border: "1.5px solid #F0EDE8",
                borderRadius: 24,
                padding: 20,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.orange, lineHeight: 1, marginBottom: 8 }}>
                  {value}
                </div>
                <div style={{ fontSize: 12, color: "#999", fontFamily: T.fontB }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 3: SUBSCRIPTION ── */}
        <div style={T.card}>
          <SectionHeading>Subscription</SectionHeading>

          {isPro ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{
                  padding: "6px 16px",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#D1FAE5",
                  color: "#065F46",
                }}>
                  Pro Plan — Active
                </span>
              </div>
              {renewalDate && (
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px 0" }}>
                  Renews on <strong>{formatDate(renewalDate)}</strong>
                </p>
              )}
              <a
                href="/pricing"
                style={{
                  display: "inline-block",
                  padding: "10px 22px",
                  background: '#FF5B1D',
                  color: '#fff',
                  borderRadius: 9999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.fontB,
                  textDecoration: "none",
                }}
              >
                Manage Billing
              </a>
            </div>
          ) : (
            <div style={{
              background: "#F8F7F5",
              borderRadius: 16,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.dark, marginBottom: 4 }}>Free Plan</div>
                <div style={{ fontSize: 13, color: "#999" }}>Upgrade to unlock unlimited campaigns and assets.</div>
              </div>
              <a
                href="/pricing"
                style={{
                  display: "inline-block",
                  padding: "10px 22px",
                  background: T.orange,
                  color: "#fff",
                  borderRadius: 9999,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.fontB,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Upgrade to Pro →
              </a>
            </div>
          )}
        </div>

        {/* ── SECTION 4: DANGER ZONE ── */}
        <div style={{ ...T.card, border: "1.5px solid #EF4444" }}>
          <SectionHeading>Danger Zone</SectionHeading>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px 0" }}>
            These actions are irreversible. Please proceed with caution.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Reset Onboarding */}
            <button
              onClick={() => resetOnboarding.mutate()}
              disabled={resetOnboarding.isPending}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: T.dark,
                border: "1.5px solid #CCC",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.fontB,
                cursor: resetOnboarding.isPending ? "not-allowed" : "pointer",
                opacity: resetOnboarding.isPending ? 0.6 : 1,
              }}
            >
              {resetOnboarding.isPending ? "Resetting…" : "Reset Onboarding"}
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#EF4444",
                border: "1.5px solid #EF4444",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.fontB,
                cursor: "pointer",
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* ── DELETE ACCOUNT MODAL ── */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={e => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeleteInput(""); setDeleteConfirmed(false); } }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 24,
            padding: 32,
            width: 400,
            maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          }}>
            <h2 style={{ fontFamily: T.fontH, fontStyle: "italic", fontWeight: 900, fontSize: 24, color: T.dark, margin: "0 0 12px 0" }}>
              Delete Account
            </h2>

            {deleteConfirmed ? (
              <div>
                <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 16px 0" }}>
                  To delete your account, please contact support:
                </p>
                <a
                  href="mailto:arfeen@arfeenkhan.com"
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    background: T.orange,
                    color: "#fff",
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.fontB,
                    textDecoration: "none",
                  }}
                >
                  Email arfeen@arfeenkhan.com
                </a>
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteInput(""); setDeleteConfirmed(false); }}
                  style={{
                    display: "block",
                    marginTop: 12,
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    color: "#999",
                    fontFamily: T.fontB,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 20px 0" }}>
                  This action is permanent and cannot be undone. All your campaigns, assets, and data will be lost forever.
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder='Type DELETE to confirm'
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1.5px solid #E5E0D8",
                    borderRadius: 12,
                    fontSize: 14,
                    fontFamily: T.fontB,
                    color: T.dark,
                    background: "#FAFAF8",
                    outline: "none",
                    marginBottom: 16,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: "#F5F5F5",
                      color: "#666",
                      border: "none",
                      borderRadius: 9999,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: T.fontB,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteInput !== "DELETE"}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: deleteInput === "DELETE" ? "#EF4444" : "#F0EDE8",
                      color: deleteInput === "DELETE" ? "#fff" : "#BBB",
                      border: "none",
                      borderRadius: 9999,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: T.fontB,
                      cursor: deleteInput === "DELETE" ? "pointer" : "not-allowed",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </V2Layout>
  );
}
