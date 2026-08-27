/**
 * WHICH BUILD IS RUNNING — the source for the `renderedBuild` stamp (migration 0106).
 *
 * A published page's HTML is baked into Cloudflare KV at publish and never re-rendered until
 * something republishes it, while the renderer keeps moving. Nothing recorded which build baked
 * which page, so the gap was invisible — and it is real: republishing magnet 5686 on 2026-08-28
 * grew the deliverable 17,152 → 21,310 bytes and turned its `<pre>` blocks into structured
 * markdown, all of it from `10582b9`, which had deployed long before. The page had simply been
 * frozen since before it.
 *
 * 🔴 THERE IS NO BUILD IDENTIFIER IN THIS ENVIRONMENT TODAY, AND THIS FUNCTION DOES NOT INVENT ONE.
 * Checked 2026-08-28: the Railway service exposes `RAILWAY_ENVIRONMENT`, `RAILWAY_PROJECT_ID`,
 * `RAILWAY_SERVICE_ID` and friends, and **no git variable at all** — no `RAILWAY_GIT_COMMIT_SHA`,
 * no deployment id. The repo has no Dockerfile, no `nixpacks.toml` and no existing version marker;
 * the build is `vite build && esbuild …` with nothing injected.
 *
 * So this returns NULL until one of the variables below is provided, and NULL is written to the
 * column. **NULL is the honest value — "unknown build" — and it is what every pre-stamp row will
 * carry anyway.** Guessing (a package version, a timestamp, a hostname) would produce a stamp that
 * looks authoritative and answers no question, which is worse than the gap it was meant to close.
 *
 * ✅ TO TURN THE STAMP ON, set ONE of these on the Railway service — no code change needed:
 *      BUILD_SHA=<commit>            (explicit, set per deploy or in the build command)
 *      RAILWAY_GIT_COMMIT_SHA=…      (Railway provides this for some GitHub-connected services)
 *      SOURCE_COMMIT=…               (common convention, accepted for portability)
 * From that moment every publish stamps, and `SELECT renderedBuild, COUNT(*) … GROUP BY 1` answers
 * "how stale is production" in one query.
 */
export function currentBuildSha(): string | null {
  const raw =
    process.env.BUILD_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.SOURCE_COMMIT ??
    "";
  const s = String(raw).trim();
  if (!s) return null;
  // varchar(40) — a full SHA-1 fits exactly; anything longer is truncated rather than rejected,
  // because a stamp is diagnostic and must never be the thing that fails a publish.
  return s.slice(0, 40);
}
