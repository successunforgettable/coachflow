import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — the machine-tests-the-machine harness (2026-07-22).
 *
 * Drives a full MANUAL-WIZARD campaign (free in-person event) start→finish against a running ZAP server and
 * asserts on real rendered DOM + real served page bytes. Built so fixes are iterated against a GREEN BAR in
 * the terminal, not hand-verified by Arfeen.
 *
 * TARGET (E2E_BASE_URL) — scripted auth only works against a server booted with NODE_ENV=development, because
 * the `/api/test-login/:openId` cookie-mint endpoint is dev-only (server/_core/index.ts). So the harness runs
 * against a LOCAL server, never the deployed site (deployed prod has no scripted-login path). See e2e/README.md
 * for the run-target decision (isolated DB vs prod infra) — that boot needs Arfeen's approval because a dev
 * server pointed at the prod DB runs the boot-time stuck-job reaper against prod.
 *
 *   E2E_BASE_URL   — default http://localhost:3000 (the dev server's preferred port)
 *   TEST_OPENID    — the openId to mint a session for (a real users.openId; supplied at run time, never committed)
 */
export default defineConfig({
  testDir: "./e2e",
  // A full manual campaign is 11 LLM-generated nodes — minutes, not seconds. Generous, serial, no retries
  // (a flaky retry would hide a real intermittent bug the harness exists to catch).
  timeout: 78 * 60 * 1000,
  expect: { timeout: 90 * 1000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/.report/results.json" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Disk guard (2026-07-23): trace.zip + video retention wrote ~629MB per FAILED run and filled the data
    // volume mid-ship (ENOSPC blocked all tooling). Trace + video OFF; the failure screenshot (~100KB) stays —
    // it carried the ad-copy 0-card diagnosis. Re-enable a trace ad-hoc with `--trace on` when actively debugging.
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 60 * 1000,
    navigationTimeout: 90 * 1000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
