# Item 2.3 — Pre-Build Report: Generate All Missing

---

## Q1 — Current "Generate All Missing" Code

The button exists in `client/src/pages/CampaignDashboard.tsx`. The current implementation is a plain `async` function called `handleGenerateAll` wired to an `isGenerating` boolean state. It does nothing functional:

```ts
// CampaignDashboard.tsx — lines 53–65
const handleGenerateAll = async () => {
  if (!campaignId) return;
  setIsGenerating(true);
  toast.info("Generating all missing assets… This may take a few minutes.");
  try {
    // Item 2.3 will implement this
    toast.info("Generate All Missing — coming in Item 2.3");
  } catch (error: any) {
    toast.error(error.message || "Failed to generate assets");
  } finally {
    setIsGenerating(false);
  }
};
```

**What is broken:** There is no tRPC call inside this function. The `isGenerating` state is toggled but the try block immediately resolves with a toast — it never awaits any mutation. There is no `useMutation()` call anywhere in `CampaignDashboard.tsx` (confirmed by grep: only one `trpc.*` call exists in the file, which is `trpc.campaigns.getById.useQuery`).

On the server side, `server/routers/campaigns.ts` has a `generateAllMissing` procedure at line 259, but it is also a stub:

```ts
generateAllMissing: protectedProcedure
  .input(z.object({ campaignId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // TODO: Implement batch generation logic
    return {
      success: true,
      message: "Generate All Missing feature coming soon…"
    };
  }),
```

**Summary of what needs to be built:** The server procedure needs real batch logic. The client needs a `useMutation` hook, a progress state machine, and a progress UI component. Neither exists yet.

---

## Q2 — Generator Calls (All 10)

The campaign record always contains `serviceId` (the linked service). The service record contains all the fields needed to auto-fill every generator. The approach for every step is: **fetch the service record on the server, map its fields to the generator's required inputs, and call the generator's internal logic directly** — not via HTTP, but via the same internal functions the tRPC procedures already use.

The `generateAllMissing` procedure will import and call the same helper functions that the individual routers use, passing `serviceId`, `campaignId`, and values derived from the service record.

| Step | Label | tRPC Mutation | Required Inputs | Source of Inputs | Notes |
|------|-------|---------------|-----------------|------------------|-------|
| 1 | Your Sales Offer | `offers.generate` | `serviceId`, `offerType` | `campaign.serviceId`; `offerType` defaults to `"standard"` | All other data pulled from service inside the procedure |
| 2 | Your Unique Method | `heroMechanisms.generate` | `serviceId`, `targetMarket`, `pressingProblem`, `whyProblem`, `whatTried`, `whyExistingNotWork`, `desiredOutcome`, `credibility`, `socialProof` | `service.targetCustomer`, `service.painPoints`, `service.whyProblemExists`, `service.failedSolutions`, `service.hiddenReasons`, `service.mainBenefit`, `service.name`, `service.pressFeatures` | All fields map directly from the service record's AI-expanded onboarding fields |
| 3 | Your Free Opt-In | `hvco.generate` | `serviceId`, `targetMarket`, `hvcoTopic` | `service.targetCustomer`, `service.hvcoTopic` | `hvcoTopic` is stored on the service record; if null, fall back to `service.description` |
| 4 | Your Headlines | `headlines.generate` | `serviceId`, `targetMarket`, `pressingProblem`, `desiredOutcome`, `uniqueMechanism` | `service.targetCustomer`, `service.painPoints`, `service.mainBenefit`, `service.uniqueMechanismSuggestion` | The procedure already has server-side fallbacks: if `pressingProblem` is empty it falls back to `service.painPoints`; same for `desiredOutcome` → `service.mainBenefit` and `uniqueMechanism` → `service.uniqueMechanismSuggestion` |
| 5 | Your Ideal Customer | **SKIPPED** | — | — | Auto-generated step per spec |
| 6 | Your Ads | `adCopy.generate` | `serviceId`, `adStyle`, `adCallToAction`, `targetMarket`, `productCategory`, `specificProductName`, `pressingProblem`, `desiredOutcome` | `service.targetCustomer`, `service.category`, `service.name`, `service.painPoints`, `service.mainBenefit`; `adStyle` defaults to `"story"`; `adCallToAction` defaults to `"Learn More"` | Optional social proof fields (`credibleAuthority`, `featuredIn`, `testimonials`, etc.) are mapped from `service.pressFeatures`, `service.testimonial1*`, etc. |
| 7 | Your Ad Images | `adCreatives.generate` | `serviceId`, `niche`, `productName`, `targetAudience`, `mainBenefit`, `pressingProblem` | `service.category`, `service.name`, `service.targetCustomer`, `service.mainBenefit`, `service.painPoints` | `campaignId` is not in the schema for this mutation but the internal `generateAdCreativesBatch` helper (already exported from `adCreatives.ts`) accepts `campaignId` and will be called directly |
| 8 | Your Ad Videos | Two-step: `videoScripts.generate` then `videos.generate` | Script: `serviceId`, `videoType`, `duration`, `visualStyle`; Video: `scriptId`, `visualStyle` | `service.id`; `videoType` defaults to `"explainer"`; `duration` defaults to `"30"`; `visualStyle` defaults to `"motion_graphics"` | Requires video credits; if the user has zero credits the step will fail with a clear error rather than silently skip |
| 9 | Your Landing Page | `landingPages.generate` | `serviceId` | `service.id` | `avatarName` and `avatarDescription` are optional and map from `service.avatarName` and `service.avatarTitle` |
| 10 | Your Email Follow-Up | `emailSequences.generate` | `serviceId`, `sequenceType`, `name` | `service.id`; `sequenceType` defaults to `"welcome"`; `name` defaults to `"${service.name} Welcome Sequence"` | Event context fields are optional and omitted for the auto-run |
| 11 | Your WhatsApp Follow-Up | `whatsappSequences.generate` | `serviceId`, `sequenceType`, `name` | `service.id`; `sequenceType` defaults to `"engagement"`; `name` defaults to `"${service.name} WhatsApp Sequence"` | Event context fields are optional and omitted for the auto-run |

**Key finding on Step 6 (Ad Copy):** The `generateAdCopySchema` has 17 fields but most are optional. The only truly required non-defaultable fields are `adStyle`, `adCallToAction`, `targetMarket`, `productCategory`, `specificProductName`, `pressingProblem`, and `desiredOutcome`. All of these map cleanly from the service record.

**Key finding on Step 8 (Videos):** The video pipeline is two steps — generate a script first, then render it. The `generateAllMissing` procedure will call `videoScripts.generate` internally, get back a `scriptId`, then call `videos.generate` with that `scriptId`. Both are already tRPC mutations with clear inputs.

---

## Q3 — Progress UI

**Component:** A modal (`Dialog` from shadcn/ui) that opens when the user clicks "Generate All Missing" and stays open until the run completes, is cancelled, or all steps finish. It does not close on outside click during a run.

**What it shows:**

A vertical list of all 10 steps (Step 5 is omitted). Each row shows:

- Step number and label (e.g., "Step 1 — Your Sales Offer")
- Status icon: spinner (currently generating), green tick (done), red X (failed), grey dot (queued)
- For failed steps: an inline "Retry" button appears on the same row
- A progress counter at the top: "3 of 10 generating…" that updates in real time
- A "Cancel" button in the modal footer, disabled once all steps are complete

**State machine:** The frontend holds a `steps` array in `useState`, where each entry has `{ stepNumber, label, status: 'queued' | 'running' | 'done' | 'failed', error?: string }`. The `generateAllMissing` mutation runs on the server and returns results step by step. Because tRPC standard mutations return a single response, the progress updates will be driven by **sequential individual mutations on the client** — one per step — rather than a single server-side batch call. This avoids the need for WebSockets or SSE and keeps the implementation within the existing tRPC stack.

**Implementation approach:** The client calls each generator's existing tRPC mutation in sequence inside a `for` loop, updating the step state after each call. The `generateAllMissing` server procedure (which currently exists as a stub) will be repurposed as a **per-step dispatcher** — or alternatively, the client will call each generator's existing mutation directly (e.g., `trpc.offers.generate.mutateAsync(...)`) with the campaign's service data pre-fetched. The second approach (client-side sequential calls) is simpler and avoids rewriting the server stub into a complex orchestrator.

---

## Q4 — Cancellation

**How it works:**

The client holds a `cancelledRef = useRef(false)` flag. When the user clicks Cancel, `cancelledRef.current` is set to `true`. The `for` loop that iterates through steps checks this flag before starting each new step. If it is `true`, the loop breaks.

**The currently-running API call:** It is not aborted. The in-flight mutation is allowed to finish (or fail on its own). Aborting mid-request would leave the DB in an unknown state. Once the current step resolves (success or failure), the loop checks the cancel flag and stops before starting the next step.

**Completed steps:** All steps that finished before cancellation are kept in the database. Nothing is rolled back.

**Progress UI on cancel:** The modal does not close immediately. It transitions to a "Cancelled" summary state showing which steps completed, which failed, and which were skipped. A "Close" button replaces the "Cancel" button.

**Re-running after cancel:** Yes. The user can click "Generate All Missing" again. The system re-checks `assetCounts` from the campaign's `getById` query (which is already invalidated after each step) and only runs steps that still have zero assets. Steps completed before the cancellation will show as already done and will be skipped.

---

## Q5 — Retry

**Does the sequence stop on failure?** No. The sequence skips the failed step and continues to the next one. The failed step is marked with a red X and an inline "Retry" button. The loop does not halt.

**Is the failure shown in real time?** Yes. The step's status is updated to `'failed'` immediately when the mutation throws, before the loop moves to the next step. The user sees the red X appear in real time.

**Can the user retry a single failed step from the summary?** Yes. Each failed step row shows a "Retry" button. Clicking it re-runs only that step's mutation with the same inputs. On success the row updates to a green tick. On failure it remains red with the error message updated.

**Does retry use the same inputs?** Yes. The inputs are derived from the service record, which is fetched once at the start of the run and held in the component's state. Retry uses the same derived inputs object.

---

## Summary

| Category | Detail |
|----------|--------|
| **Files changed** | `client/src/pages/CampaignDashboard.tsx` — replace stub with `useMutation` hooks and progress state |
| **New components** | `client/src/components/GenerateAllProgressModal.tsx` — modal with step list, status icons, cancel button, retry buttons |
| **Server changes** | `server/routers/campaigns.ts` — `generateAllMissing` stub can remain as-is; the client will call individual generator mutations directly rather than routing through this procedure. The stub may be removed or left for future use. |
| **New tRPC procedures** | None required. All 10 generators already have `generate` mutations. |
| **State management** | Client-side only: `steps[]` array in `useState`, `cancelledRef` in `useRef`, sequential `mutateAsync` calls in a `for` loop |
| **No new DB schema** | Asset counts are already tracked via `campaign_assets` table (for Steps 1–4, 6, 9–11) and direct table counts (Steps 7–8 via `adCreatives` and `videos` tables) |
| **Platform name** | ZAP |
| **Test service** | Incredible You Coach Training |
