/**
 * V2QuizReviewModal — the coach's review surface for a generated readiness
 * scorecard. Read-only structured read-out from assetBody (no iframe): title +
 * promise, the questions (options collapsible), and the bands with their score
 * range + what each tells a prospect — the calibration the coach is approving.
 *
 * A first quiz is held UNPUBLISHED until Approve & publish (the orchestration
 * defers publish); publishing resolves the coach's logo (shared getCoachLogoUrl),
 * so an approved quiz comes out branded. The branding block reuses the existing
 * capture plumbing exactly (/api/upload-asset → user.saveCoachAsset) — no new
 * backend. If the logo changes on an already-live quiz, the primary action becomes
 * "Publish update" — never silent.
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const INK = "#1A1624";
const ACC = "#8a8175";
const ORANGE = "var(--v2-primary-btn, #FF5B1D)";
const FB = "var(--v2-font-body, 'Instrument Sans', sans-serif)";
const FH = "var(--v2-font-heading, 'Fraunces', serif)";

type QuizOption = { label: string; weight: number };
type QuizQuestion = { question: string; options: QuizOption[] };
type QuizBand = { name: string; minPercent: number; maxPercent: number; teaser: string; meaning: string; cta: { heading: string; body: string; ctaLabel: string } };
type QuizBody = { format: "quiz"; title: string; promise: string; questions: QuizQuestion[]; scoring: { bands: QuizBand[] } };

export default function V2QuizReviewModal({ hvcoId, onClose }: { hvcoId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const hvcoQuery = trpc.hvco.get.useQuery({ id: hvcoId });
  const assetsQuery = trpc.user.getCoachAssets.useQuery();
  const approve = trpc.hvco.approveQuiz.useMutation();
  const regenerate = trpc.hvco.regenerateQuiz.useMutation();
  const saveAsset = trpc.user.saveCoachAsset.useMutation();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const row = hvcoQuery.data as { assetBody?: QuizBody | null; magnetHtmlUrl?: string | null; title?: string } | undefined;
  const body = row?.assetBody ?? null;
  const published = !!row?.magnetHtmlUrl;
  const storedLogo = (assetsQuery.data ?? []).find((a: { assetType: string; url: string }) => a.assetType === "logo")?.url ?? null;
  const effectiveLogo = logoUrl ?? storedLogo;

  const busy = approve.isPending || regenerate.isPending || uploading;

  async function handleLogoFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload-asset", { method: "POST", body: fd, credentials: "include" });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || "Upload failed");
      const { url } = await resp.json();
      await saveAsset.mutateAsync({ assetType: "logo", url });
      setLogoUrl(url);
      if (published) setLogoChanged(true);
      utils.user.getCoachAssets.invalidate();
      toast.success("Logo added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleApprove() {
    approve.mutate({ id: hvcoId }, {
      onSuccess: () => {
        utils.hvco.get.invalidate({ id: hvcoId });
        toast.success(published ? "Update published" : "Your scorecard is live");
        onClose();
      },
      onError: (e) => toast.error(e.message || "Publish failed"),
    });
  }
  function handleRegenerate() {
    if (!window.confirm("Regenerate this scorecard? It replaces the current questions and bands, and returns to review before it goes live.")) return;
    regenerate.mutate({ id: hvcoId }, {
      onSuccess: () => {
        utils.hvco.get.invalidate({ id: hvcoId });
        setExpanded(new Set()); setLogoChanged(false);
        toast.success("A fresh scorecard is ready — take a look");
      },
      onError: (e) => toast.error(e.message || "Regeneration failed"),
    });
  }

  // Primary action reflects state: first quiz → publish; live + logo changed →
  // publish update (never silent); live + unchanged → done.
  const primaryLabel = !published ? "Approve & publish" : logoChanged ? "Publish update" : "Done";
  const primaryAction = published && !logoChanged ? onClose : handleApprove;

  const toggle = (i: number) => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,22,36,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fbfaf7", borderRadius: 20, maxWidth: 640, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        {/* header — confident, not homework */}
        <div style={{ padding: "26px 30px 20px", borderBottom: `1px solid #e7e2d8`, position: "relative" }}>
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 20, right: 22, background: "none", border: "none", fontSize: 22, color: ACC, cursor: "pointer", lineHeight: 1 }}>×</button>
          <h2 style={{ fontFamily: FH, fontWeight: 600, fontSize: 26, color: INK, margin: "0 0 6px" }}>Your scorecard is ready</h2>
          <p style={{ fontFamily: FB, fontSize: 15, color: "#6d675e", margin: 0, maxWidth: 500 }}>
            Take a look, add your logo, and publish it — then it starts capturing leads for you.
          </p>
        </div>

        <div style={{ padding: "22px 30px 8px" }}>
          {hvcoQuery.isLoading && <p style={{ fontFamily: FB, color: ACC }}>Loading…</p>}
          {body && (
            <>
              {/* what they'll see */}
              <Section label="What they'll see">
                <p style={{ fontFamily: FH, fontWeight: 600, fontSize: 19, color: INK, margin: "0 0 6px" }}>{body.title || row?.title}</p>
                <p style={{ fontFamily: FB, fontSize: 15, color: "#6d675e", margin: 0 }}>{body.promise}</p>
              </Section>

              {/* questions — collapsible */}
              <Section label={`The ${body.questions?.length ?? 0} questions`}>
                {(body.questions ?? []).map((q, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #efeae0", padding: "10px 0" }}>
                    <button onClick={() => toggle(i)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, alignItems: "flex-start" }}>
                      <span style={{ color: ACC, fontFamily: FB, fontWeight: 700, fontSize: 14 }}>{expanded.has(i) ? "▾" : "▸"}</span>
                      <span style={{ fontFamily: FB, fontWeight: 600, fontSize: 15, color: INK }}>{i + 1}. {q.question}</span>
                    </button>
                    {expanded.has(i) && (
                      <div style={{ margin: "10px 0 4px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {(q.options ?? []).map((o, oi) => (
                          <div key={oi} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: FB, fontSize: 14, color: "#4a463f" }}>
                            <span>{o.label}</span>
                            <span style={{ color: ACC, flexShrink: 0 }}>{o.weight}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Section>

              {/* bands — the calibration */}
              <Section label="The results they can get">
                {(body.scoring?.bands ?? []).map((b, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e7e2d8", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                      <span style={{ fontFamily: FH, fontWeight: 600, fontSize: 17, color: INK }}>{b.name}</span>
                      <span style={{ fontFamily: FB, fontWeight: 600, fontSize: 12, color: ACC, flexShrink: 0 }}>{b.minPercent}–{b.maxPercent}%</span>
                    </div>
                    <p style={{ fontFamily: FB, fontSize: 14, color: "#6d675e", margin: "6px 0 0" }}>{b.meaning}</p>
                    <p style={{ fontFamily: FB, fontSize: 13, color: "#4a463f", margin: "8px 0 0" }}>
                      <span style={{ color: ACC, fontWeight: 600 }}>Their next step: </span>{b.cta?.heading} — “{b.cta?.ctaLabel}”
                    </p>
                  </div>
                ))}
              </Section>

              {/* branding */}
              <Section label="Your branding">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div onClick={() => !busy && fileRef.current?.click()} style={{ width: 84, height: 84, borderRadius: 12, border: "2px dashed rgba(26,22,36,0.2)", background: effectiveLogo ? "#fff" : "rgba(26,22,36,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "wait" : "pointer", overflow: "hidden", flexShrink: 0 }}>
                    {uploading ? <span style={{ color: ACC, fontSize: 12 }}>…</span> : effectiveLogo ? <img src={effectiveLogo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 22, color: "rgba(26,22,36,0.3)" }}>＋</span>}
                  </div>
                  <div>
                    <button onClick={() => !busy && fileRef.current?.click()} style={{ background: "none", border: "none", color: ORANGE, fontFamily: FB, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: 0 }}>
                      {effectiveLogo ? "Replace your logo" : "Add your logo"}
                    </button>
                    <p style={{ fontFamily: FB, fontSize: 13, color: "#6d675e", margin: "4px 0 0" }}>Your quiz carries your logo, never ours.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleLogoFile(e.target.files[0]); e.target.value = ""; }} />
                </div>
                {published && logoChanged && (
                  <p style={{ fontFamily: FB, fontSize: 13, color: "#a05a00", margin: "10px 0 0" }}>Your logo changed — Publish update to apply it to the live quiz.</p>
                )}
              </Section>
            </>
          )}
        </div>

        {/* actions */}
        <div style={{ padding: "16px 30px 26px", borderTop: "1px solid #e7e2d8", display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={handleRegenerate} disabled={busy} style={{ background: "none", border: "none", color: ACC, fontFamily: FB, fontWeight: 600, fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>
            {regenerate.isPending ? "Regenerating…" : "Regenerate"}
          </button>
          <button onClick={onClose} disabled={busy} style={{ background: "transparent", border: "1px solid #ddd", borderRadius: 9999, padding: "11px 22px", fontFamily: FB, fontWeight: 600, fontSize: 15, color: INK, cursor: "pointer" }}>Close</button>
          <button onClick={primaryAction} disabled={busy || !body} style={{ background: INK, color: "#fbfaf7", border: "none", borderRadius: 9999, padding: "12px 26px", fontFamily: FB, fontWeight: 700, fontSize: 15, cursor: busy || !body ? "default" : "pointer", opacity: busy || !body ? 0.6 : 1 }}>
            {approve.isPending ? "Publishing…" : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "0 0 22px" }}>
      <p style={{ fontFamily: FB, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 11, color: ACC, margin: "0 0 10px" }}>{label}</p>
      {children}
    </div>
  );
}
