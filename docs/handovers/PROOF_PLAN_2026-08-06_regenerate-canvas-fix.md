# PROOF PLAN — the two-site canvas + routing fix (held at 2026-08-06)

**Status: code written, gates green, NOT committed, NOT pushed.** This file is the exact sequence
that turns it from "type-checks" into "shipped".

---

## ⚠️ READ THIS FIRST — the ordering problem

**`regenerateSingle` is a tRPC procedure behind login. It only runs on the deployed server.** So a
click-by-click browser proof is **impossible until the fix is pushed**, and the standing rule says
nothing ships unproven. That is a genuine loop, and it has exactly two honest exits.

**Route A — harness first, then push (RECOMMENDED).** CC runs the real `regenerateSingle` code path
locally against the prod DB, exactly as `scripts/prove-creatives-live.mjs` did for step 9 on
2026-07-29. This is the established pattern on this codebase. It is a **production write**, so it
needs Arfeen's explicit "execute" — and it produces the composited PNG for Arfeen to look at
**before** anything is committed. Push only after he approves the pixels.

**Route B — push, then click, then revert if bad.** Faster to set up, but it puts unproven pixels on
prod for the duration. Only the coach-facing regenerate button is affected, and all current campaigns
are dummy data, so blast radius is genuinely small — but it inverts the rule.

**Recommendation: Route A.** Same evidence, no unproven prod window.

---

## What the proof must show

Three things, all visible on one card. Green tests show **none** of them.

1. **Shape.** The regenerated card is **4:5** (portrait), not a square. This is the visible one.
2. **Model.** A `screenshot` (still-life) row regenerates on **gpt-image-1**, not Flux. Confirmed
   from the server log line `[imageGeneration] gpt-image-1 rendered style=screenshot`.
3. **Nothing broke.** Headline, body and CTA are legible, and the subject/product is not buried
   under the text.

⚠️ **`imageFormat` on the row should now read the TRUE emitted dimensions** — `1024x1280` for
gpt-image-1, `896x1088` for Flux. If it still reads `1080x1080`, the fix did not take.

---

## Route A — the steps

### A1. CC prepares (no writes)
Pick ONE labelled throwaway `adCreatives` row on a service that is **not** protected, note its `id`,
its `designStyle` and its current `imageFormat` and `imageUrl`. Record the pre-state.
**Baseline to return to: `adCreatives` = 405.**

Do this twice — once on a `screenshot` row (proves the model switch) and once on a person row
(proves the person slots did NOT move off Flux).

### A2. Arfeen says "execute"
Required before any write. Regenerate **overwrites the row's `imageUrl` in place** — it does not
insert, so the 405 count does not move. That makes reconciliation about **restoring the row**, not
deleting one.

### A3. CC runs the harness
Invokes the real code path, saves the composited PNG **and** the raw plate to
`docs/screenshots/run-2026-08-06-regen-canvas/` **before** any teardown, and captures the
`[imageGeneration]` and `[adCreatives.regenerateSingle] emitted …` log lines.

### A4. Arfeen looks at the card
**This is the actual gate.** Every automated check in this repo is blind to whether the picture is
good. Judge: is it portrait, is the text legible, is the subject clear of the headline?

### A5. Reconcile — id-scoped, never user-scoped
Restore the row's original `imageUrl` / `rawImageUrl` / `imageFormat` from the values captured in A1:

```
UPDATE adCreatives SET imageUrl=<orig>, rawImageUrl=<orig>, imageFormat=<orig> WHERE id=<id>;
```

⚠️ **`WHERE id = …` plus a `userId` guard. NEVER `WHERE userId = …` alone** — smoke user 117174 owns
the 25 protected creatives, and a user-scoped statement would take them out.

Then re-verify: `adCreatives` = **405**, running jobs = **0**.

### A6. Commit + push
Only after A4 passes, and only with a fresh explicit "push".

---

## Route B — click-by-click (only if Arfeen chooses B)

Requires the push to have happened first.

1. Go to **zapcampaigns.com** and log in.
2. Open the campaign you want from the dashboard.
3. In the campaign trail, click into the **Ad Copy** node.
4. At the top of that panel, click the **Images** tab.
   *(The ad-image creator is reachable ONLY here. `V2ToolLibrary` is dead code — there is no Tool
   Library entry point, whatever older notes say.)*
5. You will see the deck of generated ad cards. Pick **one** card and note whether it looks like a
   desk/laptop still life or a person — say which one you picked.
6. On that card, click the **Regenerate** (circular arrow) control.
7. Wait. It runs as a background job; the card shows a spinner and swaps when done. Give it up to
   ~60 seconds — the still-life slot renders on the slower model (~18s generation plus upload and
   compositing).
8. **Look at the new card and answer three questions:**
   - Is it **taller than it is wide** (portrait), rather than square?
   - Is the headline **readable**, and clear of the person's face or the main object?
   - Does it look like the same campaign as the four cards beside it?
9. **Screenshot it** and send it over. Say which card you picked in step 5.

**If the card comes back square** — the fix did not reach that path; stop and report, do not retry.

---

## Not in this fix, deliberately

- **`makeVertical`** has the same omission (no aspectRatio into the prompt builder) while rendering
  9:16, the canvas furthest from the others (reserve **0.5515**). Inert today for the PATH A reason,
  but it is the same shape of bug. Arfeen scoped this pass to two sites; this is the third.
- **`recompositeText`** passes no zone at all — re-compositing an editorial row silently drops its
  `left` zone (STATE.md P6b).
- **The stage wiring** on these two sites. Passing the stage is what makes the ratio argument live;
  it is the open fan-out gap and it forces the 4-vs-8 cardinality decision.
