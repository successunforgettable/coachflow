/**
 * V2ConceptScripts — the per-concept video scripts, read-only.
 *
 * Mounted inline, no route: the Ad Copy node's Video tab (V2AdCopyResultPanel) and the Tool Library's
 * Video Scripts panel (V2ToolLibrary). It replaces V2VideoCreator at both; that file is intact and unmounted.
 *
 * Reads conceptScripts.listForIcp; one button calls conceptScripts.generateForIcp. The server decides
 * (server/_core/scriptBatch.ts):
 *   no campaign kit  → nothing is generated — concepts are only ever made once a kit exists
 *   kit, no concepts → the concepts are prepared first; this screen starts the scripts once they land
 *   concepts         → one script per concept, written in the background one at a time, as one set
 *
 * V2 rules: inline styles only, and every text element carries its font stack inline.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

/** How long the screen waits for a concept set to land before offering a retry (see the effect below). */
const CONCEPTS_WAIT_MS = 12 * 60_000;

const BODY = "var(--v2-font-body, 'Instrument Sans', sans-serif)";
const HEADING = "var(--v2-font-heading, 'Fraunces', serif)";
const DARK = "var(--v2-text-color, #1A1624)";
const ORANGE = "var(--v2-primary-btn, #FF5B1D)";
const PILL = "var(--v2-border-radius-pill, 9999px)";
const MUTED = "#888";

const STAGE_LABEL: Record<string, string> = {
  unaware: "Cold audience",
  problem_aware: "Knows the problem",
  solution_aware: "Comparing solutions",
  product_aware: "Knows your offer",
  most_aware: "Ready to decide",
};

const HOOK_LABEL: Record<string, string> = {
  problem_first: "Problem first",
  founder_authenticity: "Founder story",
  social_proof: "Social proof",
  aspirational_transformation: "Aspiration",
  meme_humor: "Humour",
  data_chart: "Data point",
  direct_offer_urgency: "Direct offer",
};

type Scene = { sceneNumber?: number; sceneType?: string; spokenLine?: string; onScreenText?: string; deliveryNote?: string };

type ConceptRow = {
  id: number;
  awareness: string;
  hookPattern: string;
  desire: string;
  hook: string;
  personaLabel: string | null;
  targetLengthSeconds: number | null;
  script: { id: number; scriptSetId: string; targetLengthSeconds: number; scenes: unknown; teleprompter: string } | null;
  job: { status: string } | null;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "28px 24px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: HEADING, fontStyle: "italic", fontWeight: 900, fontSize: 24, color: DARK, margin: "0 0 8px 0" }}>
      {children}
    </h3>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: BODY, fontSize: 15, color: "#555", lineHeight: 1.55, margin: "0 0 16px 0", maxWidth: 560 }}>{children}</p>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: BODY,
        fontSize: 15,
        fontWeight: 700,
        color: "#FFFFFF",
        background: ORANGE,
        border: 0,
        borderRadius: PILL,
        padding: "12px 28px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  );
}

function SmallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: BODY,
        fontSize: 13,
        fontWeight: 700,
        color: DARK,
        background: "rgba(26,22,36,0.06)",
        border: 0,
        borderRadius: PILL,
        padding: "8px 16px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: BODY,
        fontSize: 12,
        fontWeight: 700,
        color: DARK,
        background: "rgba(26,22,36,0.06)",
        borderRadius: PILL,
        padding: "4px 10px",
      }}
    >
      {children}
    </span>
  );
}

function ConceptCard({ c, index }: { c: ConceptRow; index: number }) {
  const [showPrompter, setShowPrompter] = useState(false);
  const [copied, setCopied] = useState(false);
  const scenes: Scene[] = Array.isArray(c.script?.scenes) ? (c.script!.scenes as Scene[]) : [];
  const seconds = c.script?.targetLengthSeconds ?? c.targetLengthSeconds;

  const copyScript = () => {
    if (!c.script) return;
    void navigator.clipboard?.writeText(c.script.teleprompter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <Chip>Concept {index + 1}</Chip>
        <Chip>{STAGE_LABEL[c.awareness] ?? c.awareness}</Chip>
        <Chip>{HOOK_LABEL[c.hookPattern] ?? c.hookPattern}</Chip>
        {seconds ? <Chip>~{seconds}s</Chip> : null}
      </div>
      <p style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: DARK, lineHeight: 1.45, margin: "0 0 6px 0" }}>{c.hook}</p>
      <p style={{ fontFamily: BODY, fontSize: 13, color: MUTED, lineHeight: 1.5, margin: "0 0 14px 0" }}>Leads with: {c.desire}</p>

      {c.script ? (
        <>
          {scenes.map((s, i) => (
            <div key={i} style={{ borderTop: "1px solid rgba(26,22,36,0.08)", padding: "12px 0" }}>
              <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, margin: "0 0 4px 0" }}>
                Scene {s.sceneNumber ?? i + 1}
                {s.sceneType ? ` · ${s.sceneType}` : ""}
              </p>
              <p style={{ fontFamily: BODY, fontSize: 15, color: DARK, lineHeight: 1.55, margin: "0 0 4px 0" }}>{s.spokenLine}</p>
              {s.onScreenText ? (
                <p style={{ fontFamily: BODY, fontSize: 13, color: "#555", lineHeight: 1.5, margin: "0 0 2px 0" }}>On screen: {s.onScreenText}</p>
              ) : null}
              {s.deliveryNote ? (
                <p style={{ fontFamily: BODY, fontSize: 13, fontStyle: "italic", color: MUTED, lineHeight: 1.5, margin: 0 }}>{s.deliveryNote}</p>
              ) : null}
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <SmallButton label={showPrompter ? "Hide teleprompter" : "Show teleprompter"} onClick={() => setShowPrompter((v) => !v)} />
            <SmallButton label={copied ? "Copied" : "Copy script"} onClick={copyScript} />
          </div>
          {showPrompter ? (
            <div
              style={{
                fontFamily: BODY,
                fontSize: 20,
                lineHeight: 1.7,
                color: "#FFFFFF",
                background: DARK,
                borderRadius: 16,
                padding: "24px",
                marginTop: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {c.script.teleprompter}
            </div>
          ) : null}
        </>
      ) : c.job?.status === "pending" ? (
        <p style={{ fontFamily: BODY, fontSize: 14, color: MUTED, margin: 0 }}>Writing this script…</p>
      ) : c.job?.status === "failed" ? (
        <p style={{ fontFamily: BODY, fontSize: 14, color: "#555", margin: 0 }}>
          This script didn't come through. Use “Generate the missing scripts” to try again.
        </p>
      ) : (
        <p style={{ fontFamily: BODY, fontSize: 14, color: MUTED, margin: 0 }}>Not written yet.</p>
      )}
    </div>
  );
}

export default function V2ConceptScripts({ icpId }: { icpId?: number | null }) {
  const hasIcp = typeof icpId === "number" && icpId > 0;
  const utils = trpc.useUtils();
  const [waitingForConcepts, setWaitingForConcepts] = useState(false);
  const [pollUntil, setPollUntil] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const list = trpc.conceptScripts.listForIcp.useQuery(
    { icpId: hasIcp ? (icpId as number) : 1 },
    {
      enabled: hasIcp,
      refetchInterval: (query: any) => {
        const d = query?.state?.data;
        const busy =
          !!d && (d.conceptsJob?.status === "pending" || d.concepts.some((c: ConceptRow) => c.job?.status === "pending"));
        return busy || waitingForConcepts || Date.now() < pollUntil ? 5000 : false;
      },
    },
  );

  const generate = trpc.conceptScripts.generateForIcp.useMutation({
    onSuccess: (r) => {
      setNotice(null);
      setWaitingForConcepts(r.status === "preparing_concepts");
      // The batch starts in the background, so its first job row can lag the response by a moment.
      if (r.status === "started" || r.status === "in_flight") setPollUntil(Date.now() + 30_000);
      if (hasIcp) void utils.conceptScripts.listForIcp.invalidate({ icpId: icpId as number });
    },
    onError: () => setNotice("Something went wrong starting your scripts. Please try again."),
  });

  const data = list.data;
  const conceptsLandedRef = useRef(false);
  conceptsLandedRef.current = !!data && data.concepts.length > 0;

  // Concepts were being prepared: once they land, start the scripts without asking for a second click.
  useEffect(() => {
    if (!waitingForConcepts || !data || !hasIcp) return;
    if (data.concepts.length > 0 && !generate.isPending) {
      setWaitingForConcepts(false);
      generate.mutate({ icpId: icpId as number });
    }
  }, [waitingForConcepts, data, hasIcp, icpId, generate]);

  // The concept job's status is NOT a stop signal: concept generation measured over 5 minutes on production
  // (2026-09-14), and the reaper marks any pending job failed at 5 minutes while the generation is still alive
  // and its rows still land. So wait on the ROWS, up to a cap, and only then say it didn't work.
  useEffect(() => {
    if (!waitingForConcepts) return;
    const t = setTimeout(() => {
      if (!conceptsLandedRef.current) {
        setWaitingForConcepts(false);
        setNotice("We couldn't prepare the ad concepts for this campaign. Please try again.");
      }
    }, CONCEPTS_WAIT_MS);
    return () => clearTimeout(t);
  }, [waitingForConcepts]);

  if (!hasIcp) {
    return (
      <Shell>
        <Title>Video scripts</Title>
        <Body>Choose a profile to see its video scripts.</Body>
      </Shell>
    );
  }
  if (list.isLoading) {
    return (
      <Shell>
        <Body>Loading your video scripts…</Body>
      </Shell>
    );
  }
  if (list.isError || !data) {
    return (
      <Shell>
        <Title>Video scripts</Title>
        <Body>We couldn't load your video scripts. Please refresh and try again.</Body>
      </Shell>
    );
  }

  const noticeLine = notice ? (
    <p style={{ fontFamily: BODY, fontSize: 14, color: "#B42318", margin: "12px 0 0 0" }}>{notice}</p>
  ) : null;

  if (!data.hasKit) {
    return (
      <Shell>
        <Title>Video scripts</Title>
        <Body>
          Video scripts are written from the ad concepts in a campaign. Build a campaign for this profile first, then
          come back here to generate its scripts.
        </Body>
      </Shell>
    );
  }

  const concepts = data.concepts as ConceptRow[];

  if (concepts.length === 0) {
    const preparing = waitingForConcepts || data.conceptsJob?.status === "pending";
    return (
      <Shell>
        <Title>Video scripts</Title>
        {preparing ? (
          <Body>Preparing the ad concepts for this campaign. Your scripts start as soon as they're ready.</Body>
        ) : (
          <>
            <Body>Each ad concept in your campaign gets its own talk-to-camera script, written scene by scene.</Body>
            <PrimaryButton label="Generate video scripts" onClick={() => generate.mutate({ icpId: icpId as number })} disabled={generate.isPending} />
          </>
        )}
        {noticeLine}
      </Shell>
    );
  }

  const written = concepts.filter((c) => c.script).length;
  const pending = concepts.filter((c) => !c.script && c.job?.status === "pending").length;
  const writing = pending > 0 || Date.now() < pollUntil;
  const missing = concepts.length - written;

  return (
    <div>
      <Shell>
        <Title>Video scripts</Title>
        <Body>
          {written} of {concepts.length} scripts written{pending > 0 ? " · writing the next one…" : ""}
        </Body>
        {missing > 0 && !writing ? (
          <PrimaryButton
            label={written === 0 ? "Generate video scripts" : "Generate the missing scripts"}
            onClick={() => generate.mutate({ icpId: icpId as number })}
            disabled={generate.isPending}
          />
        ) : null}
        {noticeLine}
      </Shell>
      <div style={{ marginTop: 16 }}>
        {concepts.map((c, i) => (
          <ConceptCard key={c.id} c={c} index={i} />
        ))}
      </div>
    </div>
  );
}
