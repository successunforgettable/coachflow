# Has-Assets Extract + Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken has-assets intake (naive string splits, no file upload, no compliance) with a real extraction pipeline: upload docs or paste text, extract structured assets via LLM, confirm found fields, ask only about gaps, compliance-gate before DB insert.

**Architecture:** Two entry points (file upload + paste) converge on one `extractFromAssets` LLM mutation. Extraction result feeds confirm cards, then gap-only questions, then compliance-gated `importIcp`/`importAssets` mutations (existing, unchanged). Compliance filter widened to catch INR/international currency claims product-wide.

**Tech Stack:** Express + multer (file upload), pdf-parse + mammoth (doc parsing), Anthropic Claude Sonnet via `invokeLLM` (extraction), existing complianceFilter (widened), React (intake UI).

**Branch:** `railway-build`
**Gates:** TS floor 36, vitest 330/330
**Commit style:** atomic single-commit sprints with conventional-commit messages

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/lib/complianceFilter.ts` | Modify | Widen currency patterns (INR/GBP/EUR), add scarcity phrasings |
| `server/lib/complianceFilter.test.ts` | Create | Unit tests for widened compliance patterns |
| `server/routers/autoMode.ts` | Modify | Add `extractFromAssets` mutation, add compliance gate to `importIcp` + `importAssets` |
| `server/_core/index.ts` | Modify | Add multer upload endpoint `/api/extract-documents` |
| `client/src/v2/V2TrailIntake.tsx` | Modify | Replace `runHasAssetsInChat()` with extract-then-confirm-then-gaps flow + upload UI |

---

### Task 1: Widen Compliance Filter — International Currency + Missing Scarcity Patterns

This is the core-engine fix that affects ALL coaches, not just imports. Treat carefully.

**Files:**
- Modify: `server/lib/complianceFilter.ts:26-190` (REJECTED_PATTERNS, PIVOT_RULES, SOFT_FLAG_PATTERNS)
- Create: `server/lib/complianceFilter.test.ts`

- [ ] **Step 1: Write failing tests for international currency patterns**

Create `server/lib/complianceFilter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { complianceFilter } from "./complianceFilter";

describe("complianceFilter — international currency", () => {
  // ── INR patterns ──
  it("pivots income guarantee in INR lakhs with timeframe", () => {
    const r = complianceFilter("earn ₹4.5 lakhs/month within 42 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in INR crore with timeframe", () => {
    const r = complianceFilter("make ₹1 crore in 90 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in written-out lakhs", () => {
    const r = complianceFilter("earn 4.5 lakhs per month in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── GBP / EUR patterns ──
  it("pivots income guarantee in GBP", () => {
    const r = complianceFilter("make £10,000 in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in EUR", () => {
    const r = complianceFilter("earn €5,000 in 14 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── Missing scarcity phrasings ──
  it("pivots 'pricing dies tonight'", () => {
    const r = complianceFilter("Pricing dies tonight — gone forever");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'offer expires tonight'", () => {
    const r = complianceFilter("This offer expires tonight");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'gone forever'", () => {
    const r = complianceFilter("This price is gone forever after today");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'expires today' / 'offer ends today'", () => {
    const r = complianceFilter("Offer ends today at midnight");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── Existing USD patterns still work ──
  it("still pivots USD income guarantee", () => {
    const r = complianceFilter("make $10,000 in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── False positive guard: legitimate pricing is NOT pivoted ──
  it("does NOT pivot plain pricing mention without timeframe", () => {
    const r = complianceFilter("Price: ₹2.5 lakhs for the programme");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });

  it("does NOT pivot plain currency mention in testimonial context", () => {
    const r = complianceFilter("My investment was £5,000 for the course");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });

  it("does NOT pivot 'limited-time access' (already a pivot output)", () => {
    const r = complianceFilter("Limited-time access to this offer");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/complianceFilter.test.ts`
Expected: Multiple failures — the INR, GBP, EUR, and scarcity patterns are not matched yet.

- [ ] **Step 3: Widen REJECTED_PATTERNS for multi-currency guaranteed income**

In `server/lib/complianceFilter.ts`, replace the two existing USD-only Tier 1 income patterns (lines 47-54) with multi-currency versions:

```typescript
  // Guaranteed income with specific amounts AND timeframes (any currency)
  // Matches: earn ₹4.5L in 42 days guaranteed, make £10k in 30 days guaranteed
  {
    pattern: /earn\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+in\s+\d+\s+days?\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
  },
  {
    pattern: /make\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+(?:in\s+\d+\s+days?|this\s+weekend|overnight)\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
  },
  // Also catch "lakhs/crore" written out with guaranteed
  {
    pattern: /(earn|make)\s+[\d,.]+\s*(lakhs?|crore|cr)\s+.*?\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
  },
```

- [ ] **Step 4: Widen PIVOT_RULES for multi-currency income claims WITHOUT "guaranteed"**

Replace pivot rule #1 (lines 72-77) with multi-currency version:

```typescript
  // 1. Make/Earn [amount] in X days (any currency symbol or lakhs/crore)
  {
    id: "1",
    pattern: /(make|earn)\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s*(?:\/\w+\s+)?(?:in|within)\s+\d+\s+(?:days?|weeks?|months?)/gi,
    pivot: () => "Learn the framework professionals use to build sustainable revenue",
  },
  // 1b. Make/Earn X lakhs/crore in Y days (written-out Indian denominations)
  {
    id: "1b",
    pattern: /(make|earn)\s+[\d,.]+\s*(?:lakhs?|lacs?|crore|cr)\s*(?:\/\w+\s+)?(?:in|within)\s+\d+\s+(?:days?|weeks?|months?)/gi,
    pivot: () => "Learn the framework professionals use to build sustainable revenue",
  },
```

Replace pivot rule #10 (lines 127-131) with multi-currency version:

```typescript
  // 10. From $0/$₹0 to $XM/₹X lakhs in X days / overnight success
  {
    id: "10",
    pattern: /\b(from\s+(?:\$|₹|£|€)0\s+to\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+in\s+\d+\s+days?|overnight\s+success)\b/gi,
    pivot: () => "The 30-day shift that transformed my approach",
  },
```

Replace pivot rule #15 (lines 157-161) with multi-currency version:

```typescript
  // 15. Make $10k/₹X lakhs this weekend
  {
    id: "15",
    pattern: /(make|earn)\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+this\s+weekend/gi,
    pivot: () => "The framework coaches use to stabilise and grow monthly revenue",
  },
```

- [ ] **Step 5: Add missing scarcity pivot rules**

After existing rule #6 (line 107), add new scarcity rules:

```typescript
  // 6b. Gone forever / pricing dies / offer expires tonight — hard deadline scarcity
  {
    id: "6b",
    pattern: /\b(gone\s+forever|pricing\s+dies|offer\s+expires?\s*(tonight|today|now)|price\s+(?:goes\s+up|increases?|doubles?)\s+(tonight|today|at\s+midnight))\b/gi,
    pivot: () => "Limited-time access to this offer",
  },
  // 6c. Expires today / ends today / closes today / deadline tonight
  {
    id: "6c",
    pattern: /\b(expires?\s+today|ends?\s+today|closes?\s+today|deadline\s+tonight|offer\s+ends?\s+today)\b/gi,
    pivot: () => "Limited-time access to this offer",
  },
```

- [ ] **Step 6: Widen SOFT_FLAG_PATTERNS for multi-currency**

Replace the USD-only soft flag (lines 173-177) with multi-currency:

```typescript
  {
    pattern: /(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s*(?:per\s+(?:month|week|day|year)|\/mo|\/yr|\/wk)?/gi,
    label: "income claim with specific amount",
  },
  {
    pattern: /[\d,.]+\s*(?:lakhs?|lacs?|crore|cr)\s*(?:per\s+(?:month|week|day|year)|\/mo|\/yr|\/wk)?/gi,
    label: "income claim with specific amount (INR denomination)",
  },
```

- [ ] **Step 7: Run the compliance tests**

Run: `npx vitest run server/lib/complianceFilter.test.ts`
Expected: ALL tests pass.

- [ ] **Step 8: Run existing test suite to confirm no regressions**

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330 pass. No existing tests broken by the widened patterns.

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

- [ ] **Step 9: Commit**

```bash
git add server/lib/complianceFilter.ts server/lib/complianceFilter.test.ts
git commit -m "$(cat <<'EOF'
fix: widen compliance filter for INR/GBP/EUR currencies + missing scarcity patterns

The compliance engine only matched USD ($) income claims. Indian coaching
material using ₹/lakhs/crore bypassed all patterns — a blind spot affecting
every Indian coach's campaign, not just imports. Also adds missing scarcity
phrasings (pricing dies, gone forever, offer expires tonight).

Tested against real Incredible You materials: "₹4.5 lakhs/month within
42 days" now correctly pivots, "pricing dies tonight — gone forever" now
correctly pivots. False-positive guards confirm plain pricing mentions
and legitimate currency references are not affected.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add Compliance Gate to Import Mutations

Wire `complianceFilter` into `importIcp` and `importAssets` so imported content is checked before DB insert. Same pattern as `services.ts:303`.

**Files:**
- Modify: `server/routers/autoMode.ts:270-406` (importIcp + importAssets mutations)

- [ ] **Step 1: Add compliance import at top of autoMode.ts**

At the imports section of `server/routers/autoMode.ts`, add:

```typescript
import { complianceFilter, filterRecord } from "../lib/complianceFilter";
```

- [ ] **Step 2: Add compliance gate to importIcp**

In the `importIcp` mutation (line 278), after the tier check and db initialization, before the INSERT, add compliance filtering:

```typescript
      // Compliance gate — filter imported ICP fields before DB write
      const icpFields = { name: input.name, pains: input.pains || "", goals: input.goals || "", implementationBarriers: input.implementationBarriers || "" };
      const { cleaned: cleanedIcp, classification: icpClassification, allFlaggedTerms: icpFlaggedTerms } = filterRecord(
        icpFields,
        ["name", "pains", "goals", "implementationBarriers"]
      );
      if (icpClassification === "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your ICP description contains language that Meta's ad policies prohibit: ${icpFlaggedTerms.join("; ")}. Please rephrase and try again.`,
        });
      }
```

Then update the INSERT to use cleaned values:

```typescript
      const result: any = await db.insert(idealCustomerProfiles).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        name: cleanedIcp.name,
        pains: cleanedIcp.pains || null,
        goals: cleanedIcp.goals || null,
        implementationBarriers: cleanedIcp.implementationBarriers || null,
        source: "imported",
      });
```

Return compliance info to the client so the UI can show what was changed:

```typescript
      return {
        icpId: result[0].insertId as number,
        complianceApplied: icpClassification === "PIVOT_REQUIRED",
        flaggedTerms: icpFlaggedTerms,
      };
```

- [ ] **Step 3: Add compliance gate to importAssets — offer**

Inside the `if (input.offer)` block (line 348), before the INSERT, add:

```typescript
        // Compliance gate — filter offer fields
        const offerFields = {
          name: input.offer.name,
          valueProposition: input.offer.valueProposition,
          cta: input.offer.cta,
        };
        const { cleaned: cleanedOffer, classification: offerClass, allFlaggedTerms: offerFlags } = filterRecord(
          offerFields,
          ["name", "valueProposition", "cta"]
        );
        if (offerClass === "REJECTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Your offer contains language that Meta's ad policies prohibit: ${offerFlags.join("; ")}. Please rephrase the flagged phrases.`,
          });
        }
```

Then update the INSERT to use `cleanedOffer.name`, `cleanedOffer.valueProposition`, `cleanedOffer.cta` instead of the raw `input.offer.*` values. Specifically in the `godfatherAngle` JSON and `productName`:

```typescript
        const offerResult: any = await db.insert(offers).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          productName: cleanedOffer.name,
          activeAngle: "godfather",
          godfatherAngle: {
            offerName: cleanedOffer.name,
            valueProposition: cleanedOffer.valueProposition,
            cta: cleanedOffer.cta,
            pricing: "",
            bonuses: "",
            guarantee: "",
            urgency: "",
          },
          source: "imported",
        });
```

- [ ] **Step 4: Add compliance gate to importAssets — mechanism + hvco**

Same pattern for mechanism (line 369):

```typescript
        const mechFields = { name: input.mechanism.name, description: input.mechanism.description };
        const { cleaned: cleanedMech, classification: mechClass, allFlaggedTerms: mechFlags } = filterRecord(
          mechFields, ["name", "description"]
        );
        if (mechClass === "REJECTED") {
          throw new TRPCError({ code: "BAD_REQUEST",
            message: `Your method description contains prohibited language: ${mechFlags.join("; ")}. Please rephrase.`,
          });
        }
```

Update the INSERT to use `cleanedMech.name` and `cleanedMech.description`.

Same pattern for HVCO (line 391):

```typescript
        const hvcoFields = { title: input.hvco.title, topic: input.hvco.topic };
        const { cleaned: cleanedHvco, classification: hvcoClass, allFlaggedTerms: hvcoFlags } = filterRecord(
          hvcoFields, ["title", "topic"]
        );
        if (hvcoClass === "REJECTED") {
          throw new TRPCError({ code: "BAD_REQUEST",
            message: `Your lead magnet description contains prohibited language: ${hvcoFlags.join("; ")}. Please rephrase.`,
          });
        }
```

Update the INSERT to use `cleanedHvco.title` and `cleanedHvco.topic`.

- [ ] **Step 5: Collect and return compliance summary**

Update the return value of `importAssets` to report what was cleaned:

```typescript
      const allFlags = [
        ...(input.offer ? offerFlags : []),
        ...(input.mechanism ? mechFlags : []),
        ...(input.hvco ? hvcoFlags : []),
      ];
      return {
        success: true,
        complianceApplied: allFlags.length > 0,
        flaggedTerms: allFlags,
      };
```

Note: the variables `offerFlags`, `mechFlags`, `hvcoFlags` need to be declared at the top scope of the mutation (before the conditionals), initialized as empty arrays, and populated inside each `if` block.

- [ ] **Step 6: Verify gates**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

- [ ] **Step 7: Commit**

```bash
git add server/routers/autoMode.ts
git commit -m "$(cat <<'EOF'
fix: add compliance gate to importIcp + importAssets mutations

Imported user content previously bypassed complianceFilter entirely —
income guarantees, false scarcity, and prohibited claims in pasted
material went straight to DB and cascaded into generated campaigns.

Now applies filterRecord() before every INSERT, same pattern as
services.ts:303. Tier 1 rejects with user-facing error + flagged
phrase. Tier 2 auto-pivots and returns compliance summary to client.
Testimonials remain exempt (stored verbatim via separate path).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Build `extractFromAssets` Server Mutation

Single LLM call that takes raw text (from paste or document extraction) and returns structured JSON for all importable asset categories with per-field confidence.

**Files:**
- Modify: `server/routers/autoMode.ts` (add new mutation after `importAssets`)

- [ ] **Step 1: Add the extractFromAssets mutation**

After the `importAssets` mutation closing (line 406), before the router closing `});`, add the new mutation. The full implementation:

```typescript
  /**
   * extractFromAssets — LLM extraction of structured marketing assets from
   * raw text (pasted or extracted from uploaded documents).
   *
   * Single call: takes all the user's material as one blob, returns structured
   * JSON for ICP, offer, mechanism, HVCO, and testimonials — with per-field
   * confidence scoring. No DB writes. The user reviews on a confirm screen,
   * then confirmed fields feed into importIcp + importAssets.
   *
   * Adapts the proven extractFromText pattern (services.ts:458).
   */
  extractFromAssets: protectedProcedure
    .input(z.object({
      rawText: z.string().min(50, "Need at least 50 characters to extract useful assets.").max(30000),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You extract structured marketing assets from raw material provided by coaches, speakers, and consultants. The user has uploaded or pasted their existing business documents — sales pages, course outlines, offer descriptions, testimonials, or any combination.

Your job: identify and extract every recognisable marketing asset from the text. The user will review your extraction on a confirmation screen and correct anything wrong. Accuracy about what IS present matters more than completeness — an empty field the user fills in is always better than an invented field the user must delete.

ASSET CATEGORIES TO EXTRACT:

1. ICP (Ideal Customer Profile)
   - name: one-line descriptor of who they serve, in the user's own language (verbatim from source, ≤ 120 chars)
   - pains: what problems/frustrations/fears the ICP faces, as described in the source material
   - goals: what outcomes/desires the ICP wants
   - demographics: any age, profession, location, or life-stage details mentioned
   - implementationBarriers: what has stopped the ICP from solving this before

2. OFFER
   - name: the product/programme name exactly as it appears in the source (verbatim, ≤ 120 chars). If the source uses a pronoun ("my X programme"), expand to the actual name if it appears elsewhere in the text. If it only appears with a pronoun, keep the pronoun.
   - valueProposition: what the offer delivers, in the user's own framing (≤ 500 chars)
   - pricing: any pricing information mentioned (exact figures, payment plans, currency — verbatim from source)
   - bonuses: any bonuses, extras, or included items beyond the core offer
   - guarantee: any guarantee, risk-reversal, or support promise mentioned (verbatim from source)
   - urgency: any urgency/scarcity language present (verbatim from source)
   - duration: programme length or delivery timeline
   - cta: the primary call-to-action if one is stated; otherwise empty string

3. MECHANISM (Method / Framework / System)
   - name: the method name exactly as it appears in the source (verbatim, ≤ 120 chars). Use the name from the text without adding the creator's name unless the creator's name is part of the method name in the source text.
   - description: how the method works — steps, phases, modules, components (≤ 500 chars)
   - steps: array of step/phase names if the method has a defined sequence

4. HVCO (High-Value Content Offer / Lead Magnet / Free Opt-In)
   - title: the lead magnet name exactly as it appears (verbatim, ≤ 120 chars)
   - topic: what it covers and why it appeals to the ICP (≤ 300 chars)

5. TESTIMONIALS — array of objects, each with:
   - name: the person's real name as given (verbatim)
   - quote: their exact words (verbatim — character-for-character from the source. NEVER paraphrase, summarise, clean up, or improve testimonial text. If the quote contains specific income figures, timelines, or health claims, preserve them exactly as written.)
   - title: any role, location, or descriptor given (verbatim)

EXTRACTION RULES:

- VERBATIM INTEGRITY: Programme names, method names, testimonial quotes, pricing figures, and guarantee language are extracted character-for-character from the source. You identify and extract; you never rephrase, improve, or paraphrase.

- GROUNDING RULE: If a category is not present or clearly implied in the source text, return null for that entire category. Within a category, leave individual fields as empty string ("") when the information is not present.

- ONE EXTRACTION, NOT FOUR: The user may paste everything in one block. A single paragraph might contain offer details, ICP hints, and method references interleaved. Extract across the full text holistically.

- CONFIDENCE SCORING: For each top-level category, report perFieldConfidence with:
  - "high": clearly and explicitly stated in the source text
  - "medium": reasonably inferred from context
  - "low": weak inference, possibly wrong
  - "missing": not present in the source at all`;

      const userPrompt = `RAW MATERIAL (uploaded/pasted by user):

"""
${input.rawText}
"""

Extract all marketing assets you can identify. Return JSON matching the schema.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extract_from_assets",
            strict: true,
            schema: {
              type: "object",
              properties: {
                icp: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    pains: { type: "string" },
                    goals: { type: "string" },
                    demographics: { type: "string" },
                    implementationBarriers: { type: "string" },
                  },
                  required: ["name", "pains", "goals", "demographics", "implementationBarriers"],
                },
                offer: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    valueProposition: { type: "string" },
                    pricing: { type: "string" },
                    bonuses: { type: "string" },
                    guarantee: { type: "string" },
                    urgency: { type: "string" },
                    duration: { type: "string" },
                    cta: { type: "string" },
                  },
                  required: ["name", "valueProposition", "pricing", "bonuses", "guarantee", "urgency", "duration", "cta"],
                },
                mechanism: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["name", "description"],
                },
                hvco: {
                  type: ["object", "null"],
                  properties: {
                    title: { type: "string" },
                    topic: { type: "string" },
                  },
                  required: ["title", "topic"],
                },
                testimonials: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quote: { type: "string" },
                      title: { type: "string" },
                    },
                    required: ["name", "quote", "title"],
                  },
                },
                perFieldConfidence: {
                  type: "object",
                  properties: {
                    icp: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    offer: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    mechanism: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    hvco: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    testimonials: { type: "string", enum: ["high", "medium", "low", "missing"] },
                  },
                  required: ["icp", "offer", "mechanism", "hvco", "testimonials"],
                },
              },
              required: ["icp", "offer", "mechanism", "hvco", "testimonials", "perFieldConfidence"],
              additionalProperties: false,
            },
          },
        },
      });

      // Handle both string and pre-parsed response shapes (same as extractFromText)
      const rawContent = response.choices[0].message.content;
      type ExtractionResult = {
        icp: { name: string; pains: string; goals: string; demographics: string; implementationBarriers: string } | null;
        offer: { name: string; valueProposition: string; pricing: string; bonuses: string; guarantee: string; urgency: string; duration: string; cta: string } | null;
        mechanism: { name: string; description: string } | null;
        hvco: { title: string; topic: string } | null;
        testimonials: Array<{ name: string; quote: string; title: string }> | null;
        perFieldConfidence: Record<string, "high" | "medium" | "low" | "missing">;
      };

      let extracted: ExtractionResult;
      if (typeof rawContent !== "string") {
        extracted = rawContent as unknown as ExtractionResult;
      } else {
        try {
          extracted = JSON.parse(rawContent);
        } catch {
          throw new Error("Asset extraction returned invalid JSON. Please try again.");
        }
      }
      return extracted;
    }),
```

- [ ] **Step 2: Add invokeLLM import if not present**

Check that `invokeLLM` is imported at the top of `autoMode.ts`. If not present, add:

```typescript
import { invokeLLM } from "../_core/llm";
```

- [ ] **Step 3: Verify gates**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

- [ ] **Step 4: Commit**

```bash
git add server/routers/autoMode.ts
git commit -m "$(cat <<'EOF'
feat: add extractFromAssets mutation for LLM-based asset extraction

Single LLM call takes raw pasted/uploaded text and returns structured
JSON for ICP, offer, mechanism, HVCO, and testimonials with per-field
confidence scoring. No DB writes — user reviews on confirm screen
before import mutations fire.

Prompt uses verbatim integrity rule: programme names, testimonial
quotes, and pricing figures extracted character-for-character. Names
use source text exactly without embellishment.

Adapts proven extractFromText pattern (services.ts:458).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build Document Upload Endpoint

Express endpoint that accepts multi-file upload, extracts text via pdf-parse/mammoth, and returns raw text for the extraction mutation.

**Files:**
- Modify: `server/_core/index.ts` (add multer + upload route)

- [ ] **Step 1: Add multer import and configuration**

Near the top imports of `server/_core/index.ts`, add:

```typescript
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";
```

After the body parser config (around line 375), add:

```typescript
  // ── Document upload for has-assets extraction ─────────────────────────────
  const upload = multer({
    dest: path.join(process.cwd(), "tmp-uploads"),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB per file, max 5
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "application/msword", // .doc
        "text/plain",
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Upload PDF, DOCX, or TXT files.`));
      }
    },
  });
```

- [ ] **Step 2: Add the upload endpoint**

After the multer config, add the route:

```typescript
  app.post("/api/extract-documents", upload.array("files", 5), async (req, res) => {
    try {
      // Authenticate
      let user: { id: number | string } | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files uploaded." });
        return;
      }

      const textParts: string[] = [];
      const warnings: string[] = [];

      for (const file of files) {
        try {
          let text = "";

          if (file.mimetype === "application/pdf") {
            const buffer = fs.readFileSync(file.path);
            const parsed = await pdfParse(buffer);
            text = parsed.text?.trim() || "";
            // Image-PDF detection: if multi-page PDF yields almost no text
            if (text.length < 50 && parsed.numpages > 1) {
              warnings.push(`"${file.originalname}" appears to be a scanned/image PDF — I couldn't read the text. Try pasting the content instead.`);
              continue;
            }
          } else if (
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimetype === "application/msword"
          ) {
            const buffer = fs.readFileSync(file.path);
            const result = await mammoth.extractRawText({ buffer });
            text = result.value?.trim() || "";
          } else if (file.mimetype === "text/plain") {
            text = fs.readFileSync(file.path, "utf-8").trim();
          }

          if (text.length > 0) {
            textParts.push(`--- ${file.originalname} ---\n${text}`);
          } else {
            warnings.push(`"${file.originalname}" contained no readable text.`);
          }
        } finally {
          // Always clean up temp file
          try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        }
      }

      const combinedText = textParts.join("\n\n");

      if (combinedText.length === 0) {
        res.status(400).json({
          error: "No readable text found in any uploaded file.",
          warnings,
        });
        return;
      }

      res.json({
        text: combinedText,
        fileCount: textParts.length,
        warnings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload processing failed.";
      res.status(500).json({ error: msg });
    }
  });
```

- [ ] **Step 3: Ensure tmp-uploads dir is gitignored**

Check if `tmp-uploads` is in `.gitignore`. If not, add it:

```
tmp-uploads/
```

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36 (may increase if multer/mammoth/pdf-parse types need declaration — check and add `declare module` stubs if needed)

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

- [ ] **Step 5: Commit**

```bash
git add server/_core/index.ts .gitignore
git commit -m "$(cat <<'EOF'
feat: add /api/extract-documents endpoint for multi-file upload

Accepts up to 5 files (PDF, DOCX, TXT, max 10MB each) via multer.
Extracts text using pdf-parse and mammoth (both already in deps).
Returns concatenated text for the extractFromAssets mutation.

Image/scanned PDFs detected (< 50 chars from multi-page PDF) and
reported as warnings. Temp files deleted immediately after processing.
No permanent storage of uploaded documents.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rewrite Has-Assets Intake Flow — Extract + Confirm + Gap-Only Questions

Replace the current `runHasAssetsInChat()` (fixed per-asset questions, naive splits) with:
upload/paste → extract → confirm found fields → ask only about gaps.

**Files:**
- Modify: `client/src/v2/V2TrailIntake.tsx:397-616` (rewrite `runHasAssetsInChat`)

- [ ] **Step 1: Add tRPC hook for extractFromAssets**

Near the existing mutation hooks in V2TrailIntake.tsx (search for `importIcpMutation`), add:

```typescript
  const extractFromAssetsMutation = trpc.autoMode.extractFromAssets.useMutation();
```

- [ ] **Step 2: Add state + refs for the new flow**

Replace the old `selectedImports` and `importedData` refs (lines 405-406) with:

```typescript
  // Has-assets flow state
  const importTextResolve = useRef<((text: string) => void) | null>(null);
  const importConfirmResolve = useRef<((choice: string) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedTextResolve = useRef<((text: string | null) => void) | null>(null);
```

(Keep `gridDoneResolve` ref if it's used elsewhere for chip handling.)

- [ ] **Step 3: Rewrite runHasAssetsInChat — upload/paste entry**

Replace the entire `runHasAssetsInChat` function body (lines 413-616) with the new flow. The function is long, so here is the complete replacement:

```typescript
  const runHasAssetsInChat = async () => {
    const serviceId = createdServiceId.current;
    if (serviceId == null) return;
    setPhase("hasAssets");
    try {
      // Enrichment (non-fatal)
      try { await expandProfileMutation.mutateAsync({ serviceId }); } catch { /* non-fatal */ }

      // ── Step A: Collect material (upload or paste) ──
      addMsg({ type: "zappy-bubble", mood: "idle",
        text: "Upload your documents (PDF, Word, or text files) or paste your material below. I'll read everything and pull out what I need." });

      // Show upload zone + paste prompt
      // The chip-row serves as UI trigger; actual file handling is in ChatThread
      addMsg({ type: "chip-row", chips: ["Upload files", "I'll paste instead"] });
      const entryChoice = await new Promise<string>(r => { importConfirmResolve.current = r; });

      let rawText = "";

      if (entryChoice === "Upload files") {
        // Trigger file input
        addMsg({ type: "zappy-bubble", mood: "idle", text: "Pick your files — I can read PDFs, Word docs, and text files." });

        // Create a hidden file input and trigger it
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".pdf,.docx,.doc,.txt";

        const filePromise = new Promise<FileList | null>(resolve => {
          input.onchange = () => resolve(input.files);
          // Handle cancel
          setTimeout(() => {
            if (!input.files || input.files.length === 0) resolve(null);
          }, 120000);
        });
        input.click();

        const files = await filePromise;
        if (!files || files.length === 0) {
          addMsg({ type: "zappy-bubble", mood: "idle", text: "No files selected. You can paste your material instead." });
          setPhase("hasAssets");
          rawText = await new Promise<string>(r => { importTextResolve.current = r; });
          addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
        } else {
          // Upload files to server
          addMsg({ type: "zappy-bubble", mood: "thinking", text: `Reading ${files.length} file${files.length > 1 ? "s" : ""}...` });
          const formData = new FormData();
          for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
          }

          const resp = await fetch("/api/extract-documents", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const result = await resp.json();

          if (!resp.ok || !result.text) {
            const warnings = result.warnings?.join(" ") || "";
            addMsg({ type: "zappy-bubble", mood: "idle",
              text: `I couldn't read those files. ${warnings} Try pasting your material instead.` });
            setPhase("hasAssets");
            rawText = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
          } else {
            rawText = result.text;
            if (result.warnings?.length > 0) {
              addMsg({ type: "zappy-bubble", mood: "idle", text: result.warnings.join(" ") });
            }
            addMsg({ type: "system-divider", text: `${result.fileCount} file${result.fileCount > 1 ? "s" : ""} read` });
          }
        }
      } else {
        // Paste path
        addMsg({ type: "zappy-bubble", mood: "idle", text: "Paste everything you've got — your offer, method, ICP, testimonials, whatever you have. I'll sort through it." });
        setPhase("hasAssets");
        rawText = await new Promise<string>(r => { importTextResolve.current = r; });
        addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
      }

      if (rawText.length < 50) {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "That's a bit short for me to work with. Tell me more about your business, offer, and who you help." });
        setPhase("hasAssets");
        const more = await new Promise<string>(r => { importTextResolve.current = r; });
        addMsg({ type: "user-bubble", text: more.slice(0, 200) + (more.length > 200 ? "..." : "") });
        rawText = rawText + "\n\n" + more;
      }

      // ── Step B: LLM extraction ──
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Reading through your material and pulling out what I find..." });
      const extracted = await extractFromAssetsMutation.mutateAsync({ rawText });

      // ── Step C: Show what was found — confirm cards ──
      const confirmedAssets: Record<string, Record<string, string>> = {};
      const categories = [
        { key: "icp", label: "IDEAL CUSTOMER", stopKey: "icp", nameField: "name", previewField: "pains" },
        { key: "offer", label: "OFFER", stopKey: "offer", nameField: "name", previewField: "valueProposition" },
        { key: "mechanism", label: "METHOD", stopKey: "uniqueMethod", nameField: "name", previewField: "description" },
        { key: "hvco", label: "LEAD MAGNET", stopKey: "freeOptIn", nameField: "title", previewField: "topic" },
      ] as const;

      const foundCategories: string[] = [];
      const missingCategories: string[] = [];

      for (const cat of categories) {
        const data = extracted[cat.key as keyof typeof extracted] as Record<string, string> | null;
        const confidence = extracted.perFieldConfidence?.[cat.key as keyof typeof extracted.perFieldConfidence];

        if (data && data[cat.nameField]) {
          foundCategories.push(cat.key);
          const confidenceNote = confidence === "low" ? " (I wasn't fully sure about this one)" : "";

          addMsg({
            type: "asset-reveal-card",
            nodeKey: cat.stopKey,
            reveal: {
              eyebrow: `FOUND — YOUR ${cat.label}${confidenceNote}`,
              title: data[cat.nameField] || cat.label,
              preview: (data[cat.previewField] || "").slice(0, 220),
            },
          });
          addMsg({ type: "zappy-bubble", mood: "idle", text: "Look right?" });
          addMsg({ type: "chip-row", chips: ["Looks right", "Fix something"] });

          const choice = await new Promise<string>(r => { importConfirmResolve.current = r; });
          if (choice === "Looks right") {
            confirmedAssets[cat.key] = data;
          } else {
            // User wants to fix — let them type the correction
            addMsg({ type: "zappy-bubble", mood: "idle", text: `Tell me what's different about your ${cat.label.toLowerCase()}.` });
            setPhase("hasAssets");
            const correction = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: correction });
            // Use the correction as the field value
            confirmedAssets[cat.key] = { ...data, [cat.nameField]: correction.split(/[,—\-]/)[0]?.trim() || correction.slice(0, 120), [cat.previewField]: correction };
          }
        } else {
          missingCategories.push(cat.key);
        }
      }

      // Handle testimonials separately
      if (extracted.testimonials && extracted.testimonials.length > 0) {
        addMsg({ type: "zappy-bubble", mood: "celebrating",
          text: `Found ${extracted.testimonials.length} testimonial${extracted.testimonials.length > 1 ? "s" : ""} — I'll keep them exactly as your clients said them.` });
        for (const t of extracted.testimonials) {
          addMsg({
            type: "asset-reveal-card",
            nodeKey: "service",
            reveal: {
              eyebrow: `TESTIMONIAL — ${t.name}`,
              title: t.name + (t.title ? ` (${t.title})` : ""),
              preview: `"${t.quote.slice(0, 200)}"`,
            },
          });
        }
        // TODO: Wire testimonials to services.testimonial1-3 columns via existing activate flow
      }

      // ── Step D: Ask only about gaps ──
      if (missingCategories.length > 0) {
        const gapNames = missingCategories.map(k => {
          const cat = categories.find(c => c.key === k);
          return cat?.label.toLowerCase() || k;
        });
        addMsg({ type: "zappy-bubble", mood: "idle",
          text: `I found your ${foundCategories.map(k => categories.find(c => c.key === k)?.label.toLowerCase()).join(", ")}. I didn't find ${gapNames.length === 1 ? `a ${gapNames[0]}` : gapNames.join(" or ")} in your material.` });

        for (const gapKey of missingCategories) {
          const cat = categories.find(c => c.key === gapKey)!;
          addMsg({ type: "zappy-bubble", mood: "idle",
            text: `Do you have ${cat.label === "IDEAL CUSTOMER" ? "an ideal customer profile" : `a ${cat.label.toLowerCase()}`}? Tell me about it, or I can create one for you.` });
          addMsg({ type: "chip-row", chips: ["I'll describe it", "Create one for me"] });

          const gapChoice = await new Promise<string>(r => { importConfirmResolve.current = r; });
          if (gapChoice === "I'll describe it") {
            setPhase("hasAssets");
            const gapText = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: gapText });

            // Parse the gap text with simple field mapping
            if (gapKey === "icp") {
              confirmedAssets.icp = { name: gapText.split(",")[0]?.trim() || gapText.slice(0, 120), pains: gapText, goals: "", demographics: "", implementationBarriers: "" };
            } else if (gapKey === "offer") {
              confirmedAssets.offer = { name: gapText.split(",")[0]?.trim() || gapText.slice(0, 120), valueProposition: gapText, pricing: "", bonuses: "", guarantee: "", urgency: "", duration: "", cta: "Book a Free Call" };
            } else if (gapKey === "mechanism") {
              confirmedAssets.mechanism = { name: gapText.split(/[,—\-]/)[0]?.trim() || gapText.slice(0, 120), description: gapText };
            } else if (gapKey === "hvco") {
              confirmedAssets.hvco = { title: gapText.split(/[,—\-]/)[0]?.trim() || gapText.slice(0, 120), topic: gapText };
            }
          }
          // "Create one for me" — leave it out of confirmedAssets, the cascade generates it
        }
      } else {
        addMsg({ type: "zappy-bubble", mood: "celebrating", text: "Got it all from your material — no extra questions needed." });
      }

      // ── Step E: ICP import or generate ──
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Studying the people you help..." });
      let icpId: number;
      if (confirmedAssets.icp) {
        const result = await importIcpMutation.mutateAsync({
          serviceId,
          name: confirmedAssets.icp.name,
          pains: confirmedAssets.icp.pains || undefined,
          goals: confirmedAssets.icp.goals || undefined,
          implementationBarriers: confirmedAssets.icp.implementationBarriers || undefined,
        });
        icpId = result.icpId;
        addMsg({ type: "system-divider", text: "ICP imported" });
      } else {
        const icpName = extraction.current?.icpDescriptor?.trim()
          || `${pendingFields.current?.serviceName?.trim() || "My Service"} Profile`;
        const { jobId } = await generateIcpMutation.mutateAsync({ serviceId, name: icpName });
        const job = await patienceGuard(pollJob(jobId), addMsg);
        if (job.status === "failed" || typeof job.result?.icpId !== "number") {
          throw new Error(job.error || "ICP generation failed.");
        }
        icpId = job.result.icpId as number;
        addMsg({ type: "system-divider", text: "ICP generated" });
      }

      // ICP reveal
      const icp = await utils.icps.get.fetch({ id: icpId });
      addMsg({
        type: "asset-reveal-card",
        nodeKey: "icp",
        reveal: {
          eyebrow: "YOUR IDEAL CUSTOMER",
          title: (icp as { name?: string } | null)?.name || "Your Ideal Customer",
          preview: ((icp as { introduction?: string | null } | null)?.introduction || "").split("\n")[0].slice(0, 220) || "Profile ready.",
        },
      });

      // ── Step F: Kit creation ──
      const kit = await getOrCreateKitMutation.mutateAsync({
        icpId,
        path: "has_assets",
        campaignType: campaignType.current ?? undefined,
      });
      const kitId = (kit as { id: number }).id;

      // ── Step G: Import remaining confirmed assets ──
      const hasOffer = !!confirmedAssets.offer;
      const hasMechanism = !!confirmedAssets.mechanism;
      const hasHvco = !!confirmedAssets.hvco;
      if (hasOffer || hasMechanism || hasHvco) {
        await importAssetsMutation.mutateAsync({
          serviceId,
          icpId,
          offer: hasOffer ? {
            name: confirmedAssets.offer.name,
            valueProposition: confirmedAssets.offer.valueProposition,
            cta: confirmedAssets.offer.cta || "Book a Free Call",
          } : undefined,
          mechanism: hasMechanism ? {
            name: confirmedAssets.mechanism.name,
            description: confirmedAssets.mechanism.description,
          } : undefined,
          hvco: hasHvco ? {
            title: confirmedAssets.hvco.title,
            topic: confirmedAssets.hvco.topic,
          } : undefined,
        });
      }

      // ── Step H: Mark imported nodes ──
      const importedNodes: string[] = [];
      if (confirmedAssets.icp) importedNodes.push("icp");
      if (confirmedAssets.offer) importedNodes.push("offer");
      if (confirmedAssets.mechanism) importedNodes.push("uniqueMethod");
      if (confirmedAssets.hvco) importedNodes.push("freeOptIn");
      for (const nodeType of importedNodes) {
        try { await markImportedMutation.mutateAsync({ campaignKitId: kitId, nodeType }); } catch { /* non-fatal */ }
      }

      // ── Step I: Navigate to trail ──
      const importCount = importedNodes.length;
      addMsg({ type: "zappy-bubble", mood: "celebrating",
        text: importCount > 0
          ? `You're already ${importCount + 2} of 11 done. I'll build the missing pieces so they match what you have.`
          : "Foundation set. Building the rest now — watch the trail fill in.",
      });

      try {
        type FlushMessages = Parameters<typeof appendMessagesMutation.mutateAsync>[0]["messages"];
        const flush = messagesRef.current.filter(m => m.type !== "chip-row") as unknown as FlushMessages;
        if (flush.length > 0) {
          await appendMessagesMutation.mutateAsync({ campaignKitId: kitId, messages: flush });
        }
      } catch { /* nice-to-have */ }

      try { sessionStorage.setItem(`zapTrailFreshHandoff:${kitId}`, "1"); } catch { /* fine */ }
      navigate(`/v2-dashboard/trail/${kitId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not set up your campaign.";
      addMsg({ type: "zappy-bubble", mood: "idle", text: `Hm — that one fizzled (${msg}). One more go?` });
      addMsg({ type: "chip-row", chips: ["I have some — use mine"] });
      setPhase("fork");
    }
  };
```

- [ ] **Step 4: Remove the old IMPORTABLE_ASSETS constant and related refs that are no longer used**

The old `selectedImports` and `importedData` refs (line 405-406) and the old `IMPORTABLE_ASSETS` constant (lines 396-402) can be removed IF they're not used elsewhere. Check before removing — `IMPORTABLE_ASSETS` is only used inside the old `runHasAssetsInChat`. If the chip grid handler references `selectedImports`, keep it but note it's now dead code.

- [ ] **Step 5: Verify gates**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

- [ ] **Step 6: Commit**

```bash
git add client/src/v2/V2TrailIntake.tsx
git commit -m "$(cat <<'EOF'
feat: rewrite has-assets intake — extract-then-confirm-then-gaps

Replaces the broken has-assets flow (naive .split(',') parsing, fixed
per-asset questions, ignored paste content) with:

1. Upload files (PDF/DOCX/TXT) or paste text — both entry points
2. Single LLM extraction call returns all found assets + confidence
3. Confirm cards for each found asset (with fix-something loop)
4. Gap-only questions for missing assets ("I'll describe it" or
   "Create one for me" lets cascade generate the gap node)
5. Compliance-gated import via existing mutations

No more re-asking about things the user already provided.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Widen importIcp Zod Schema

Accept the additional fields that extraction can now provide.

**Files:**
- Modify: `server/routers/autoMode.ts:270-298` (importIcp input schema + INSERT)

- [ ] **Step 1: Widen the Zod schema**

Add `demographics` and `falseBeliefsVsRealReasons` to the input:

```typescript
  importIcp: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      name: z.string().min(1).max(255),
      pains: z.string().max(2000).optional(),
      goals: z.string().max(2000).optional(),
      implementationBarriers: z.string().max(2000).optional(),
      demographics: z.string().max(2000).optional(),
    }))
```

- [ ] **Step 2: Update the INSERT to include new fields**

In the `db.insert(idealCustomerProfiles).values({...})` call, add the new field after `implementationBarriers`:

```typescript
        demographics: cleanedIcp.demographics || null,
```

Note: verify that `idealCustomerProfiles` table has a `demographics` column via `INFORMATION_SCHEMA` query before adding. If it doesn't exist, skip this field (the extraction still captures it client-side for future use but doesn't persist).

- [ ] **Step 3: Update compliance gate fields array**

In the `filterRecord` call for ICP (added in Task 2), add `demographics` to the fields array:

```typescript
      const icpFields = { name: input.name, pains: input.pains || "", goals: input.goals || "", implementationBarriers: input.implementationBarriers || "", demographics: input.demographics || "" };
      const { cleaned: cleanedIcp, ... } = filterRecord(
        icpFields,
        ["name", "pains", "goals", "implementationBarriers", "demographics"]
      );
```

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

- [ ] **Step 5: Commit**

```bash
git add server/routers/autoMode.ts
git commit -m "$(cat <<'EOF'
feat: widen importIcp to accept demographics field from extraction

Extraction can now provide demographics (age, profession, location)
from the user's material. Widen the Zod schema + INSERT to persist
it. Compliance gate covers the new field.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: End-to-End Verification on Real Data

Re-run the extraction against Arfeen's Incredible You materials with the full pipeline (widened compliance + import compliance gate) and verify all requirements.

**Files:** None modified — verification only.

- [ ] **Step 1: Re-run extraction test against real material**

Create a temporary test script (same as the earlier `test-extraction-prompt.ts`) and run via `railway run`. Verify:

1. Extraction returns all 5 categories (icp, offer, mechanism, hvco, testimonials) — zero gaps
2. All 3 testimonials are verbatim matches (Rosemary, Reeta, Nichola)
3. Method name does NOT have "Arfeen Khan's" prepended
4. Offer name is "The Incredible You Coach Training Program" exactly

- [ ] **Step 2: Verify compliance gate catches real aggressive claims**

Run `complianceFilter("earn ₹4.5 lakhs/month within 42 days")` and verify:
- Returns `classification: "PIVOT_REQUIRED"`
- `wasModified: true`
- `cleanedText` contains the pivot replacement

Run `complianceFilter("Pricing dies tonight — gone forever")` and verify:
- Returns `classification: "PIVOT_REQUIRED"`
- `wasModified: true`

- [ ] **Step 3: Verify testimonials are exempt from compliance**

Run `complianceFilter("I quit my job within 6 months of joining. Now I earn ₹10-12 lakhs per month as a coach.")` — this is Reeta's testimonial.
- This should return `VALID` or if flagged, the testimonial exemption in `checkCompliance()` applies downstream.
- Note: `complianceFilter` doesn't have the `isPhraseQuoted` exemption (that's in `checkCompliance`). But testimonials bypass the import path entirely — they go to `services.testimonial1-3Quote` columns via the separate activate flow, not through `importAssets`. Confirm this separation is intact.

- [ ] **Step 4: Verify false-positive safety**

Run `complianceFilter("Price: ₹2.5 lakhs for the programme")` — should return `VALID` (plain pricing, no timeframe claim).

Run `complianceFilter("My investment was £5,000 for the course")` — should return `VALID`.

- [ ] **Step 5: Verify TS floor + test suite**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

Run: `npx vitest run server/pipeline-fixes.test.ts`
Expected: 330/330

Run: `npx vitest run server/lib/complianceFilter.test.ts`
Expected: All pass

- [ ] **Step 6: Clean up test script**

Delete the temporary test script. Do NOT commit it.

---

## Verification Checklist (for Arfeen's spot-check)

After all tasks are complete and pushed:

1. Go to zapcampaigns.com, start a new campaign, pick "I have some — use mine"
2. Choose "I'll paste instead", paste the Incredible You materials
3. Verify: Zappy says "Reading through your material..." then shows confirm cards for ICP, Offer, Method, Lead Magnet — NOT fixed questions
4. Verify: all 3 testimonials shown verbatim (Rosemary, Reeta, Nichola)
5. Verify: method name is "The 10-Week Incredible You System" (no "Arfeen Khan's" prefix)
6. Verify: if the offer contains "₹4.5 lakhs/month within 42 days", the compliance gate pivots it (shown in the import result or visible in DB readback)
7. Verify: if no gaps, Zappy says "Got it all — no extra questions needed"
8. Verify: campaign continues to trail, imported nodes show paperclip badges
9. Verify: generated ad copy (downstream) is Meta-safe — doesn't repeat raw income guarantee
