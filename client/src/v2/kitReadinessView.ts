/**
 * HONEST COMPLETION — the words the coach sees, from the one readiness answer (server/_core/kitReadiness.ts via
 * campaignKits.getReadiness). Shared by the Campaign Kit page and the Trail's end beat, so the two can never
 * disagree. Plain data in, plain text out.
 */

export type ReadinessBlocker = {
  node: string;
  kind?: "not_built" | "skipped" | "not_published" | "no_images" | "no_service";
  label: string;
  reason: string;
  action: string;
};
export type Readiness = {
  state: "ready" | "built_with_blockers" | "in_progress";
  builtCount: number;
  total: number;
  metaReady: boolean;
  blockers: ReadinessBlocker[];
};

/** The Campaign Kit page's status pill. Only a push-ready kit is green. */
export function readinessPill(r: Readiness): { text: string; tone: "good" | "warn" | "progress" } {
  if (r.state === "ready") return { text: "Ready to push", tone: "good" };
  if (r.state === "built_with_blockers") {
    const n = r.blockers.length;
    return { text: `Built — ${n} ${n === 1 ? "thing" : "things"} to fix`, tone: "warn" };
  }
  return { text: "In progress", tone: "progress" };
}

/** The Trail's closing beat. Celebrates only when there is nothing left to fix. */
export function completionBeat(r: Readiness): { celebrate: boolean; lines: string[] } {
  if (r.state === "ready") {
    return {
      celebrate: true,
      lines: [
        "Done. Every piece is built, and your campaign is ready to push.",
        "Every piece matches your offer, your method, your voice.",
      ],
    };
  }
  const n = r.blockers.length;
  const head = r.state === "built_with_blockers"
    ? `Your campaign is built, but ${n === 1 ? "one thing stops" : `${n} things stop`} it being pushed:`
    : `${r.builtCount} of ${r.total} pieces are built. ${n === 1 ? "One thing is" : `${n} things are`} still open:`;
  return {
    celebrate: false,
    lines: [head, ...r.blockers.map((b) => `${b.reason} ${b.action}`)],
  };
}

/**
 * The Trail's welcome-back line on a resumed visit. It used to say "<next stop> is up next" for a landing page that
 * was built but not published, and "This campaign is complete" whenever every stop was ticked — even when a push was
 * still blocked. Now it reads the same readiness answer as the kit page and the end beat, and before readiness has
 * loaded it makes no completion claim at all.
 */
export function welcomeBackLine(
  stops: Array<{ key: string; label: string; state: string }>,
  readiness: Readiness | null | undefined,
): string {
  const doneCount = stops.filter(s => s.state === "done" || s.state === "imported" || s.state === "stale").length;
  const next = stops.find(s => s.state === "pending" || s.state === "generating");
  const builtButBlocked = (b: ReadinessBlocker) => b.kind === "not_published" || b.kind === "no_images";
  if (next) {
    const b = readiness?.blockers.find(x => x.node === next.key && builtButBlocked(x));
    if (b && b.kind === "not_published") {
      return `Welcome back. We're ${doneCount} of ${stops.length} — your landing page is built but hasn't been published yet. ${b.action}`;
    }
    if (b) return `Welcome back. We're ${doneCount} of ${stops.length} — ${b.reason} ${b.action}`;
    return `Welcome back. We're ${doneCount} of ${stops.length} — ${next.label} is up next.`;
  }
  if (!readiness) return `Welcome back — all ${stops.length} pieces are built.`;
  if (readiness.state === "ready") return `Welcome back — all ${stops.length} pieces are built, and your campaign is ready to push.`;
  const n = readiness.blockers.length;
  const first = readiness.blockers[0];
  return `Welcome back — every piece is built, but ${n === 1 ? "one thing stops" : `${n} things stop`} it being pushed. ${first.reason} ${first.action}`;
}
