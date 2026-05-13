/**
 * GHL Master Snapshot deep-link helper — Phase C C3 follow-on 8 (Phase 1).
 *
 * Builds the URL that opens GoHighLevel's snapshot apply UI for the user's
 * agency-admin context. The snapshot ID is the canonical master snapshot
 * Arfeen pre-builds in his agency UI — stored on the server as the
 * `GHL_MASTER_SNAPSHOT_ID` env var and surfaced to the client via
 * `trpc.ghl.getConnectionStatus.masterSnapshotId`.
 *
 * Why a manual-apply deep link rather than programmatic apply: GHL
 * marketplace OAuth Location Access Tokens are not authorized for
 * snapshot apply (probed in Phase 1 pre-flight: authClass=Location
 * tokens get HTTP 401 on every /snapshots/* endpoint; the apply surface
 * is Agency-token gated only). Manual-apply preserves the wider user
 * base (sub-account-only users can still authorize ZAP for the Custom
 * Value push; their agency admin completes the apply step).
 *
 * Note on URL format: the exact path GHL uses for snapshot preview /
 * apply may differ slightly between GHL versions / regions. Arfeen
 * verifies the actual format after building his master snapshot —
 * easy 1-LOC update here if needed.
 */

const GHL_AGENCY_BASE = "https://app.gohighlevel.com";

export function buildSnapshotApplyUrl(snapshotId: string): string {
  return `${GHL_AGENCY_BASE}/v2/preview/${encodeURIComponent(snapshotId)}`;
}

export function openSnapshotApplyTab(snapshotId: string): void {
  const url = buildSnapshotApplyUrl(snapshotId);
  window.open(url, "_blank", "noopener,noreferrer");
}
