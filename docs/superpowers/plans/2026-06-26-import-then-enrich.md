# Import-Then-Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the thin-imported-ICP problem (12/17 fields NULL on the has-assets path) by automatically enriching imported ICPs with the full 17-tab generator seeded by the user's material, plus wire ICP context into ad creatives, add PPTX/image file reading, and close the ICP PDF download stub.

**Architecture:** After `importIcp` saves the thin row, an enrichment function calls the proven 17-tab ICP generator with the user's imported content as seed context + anchor instruction. The LLM generates the missing 12 fields consistent with the user's material, then the enrichment function updates the ICP row — preserving user-provided fields verbatim, filling only NULL fields. Same pattern for offer enrichment (generate missing angles from imported godfather). File reading expanded with `officeparser` for PPTX and Anthropic vision API for images.

**Tech Stack:** TypeScript, Anthropic Claude Sonnet 4.6 (text + vision), officeparser (PPTX), existing pdf-parse/mammoth.

**Seed-steering guarantee:** The enrichment prompt includes the user's imported content as `USER-PROVIDED GROUND TRUTH` with an explicit anchor instruction: "The following fields were written by the user. Treat them as authoritative — your generated sections must be consistent with this voice, this audience, and this framing. Do NOT contradict, generalize, or drift from the user's specifics." After generation, the update query uses a field-by-field NULL check — only fields that are currently NULL get updated. User-provided fields are never overwritten, even if the LLM generates alternatives.

**Gates:** TS baseline 36, vitest 353/353. No migrations needed. No changes to the paused landing-page/template track (commits 324b092, 4ccf4a9).

---

## File Map

### New files
- `server/_core/icpEnrichment.ts` — enrichImportedIcp() function: takes ICP row + service, calls 17-tab generator with seed, updates NULL fields only

### Modified files
- `server/routers/autoMode.ts` — Call enrichImportedIcp() after importIcp saves the thin row
- `server/routers/autoMode.ts` — Call offer enrichment after importAssets saves the thin offer
- `server/_core/index.ts` — Expand `/api/extract-documents` to accept PPTX + images
- `server/_core/llm.ts` — Fix Anthropic message conversion to handle ImageContent natively (not JSON.stringify)
- `server/adCreativesGenerator.ts` — Add ICP fields to GenerateContextualAdHeadlinesInput and prompt
- `server/routers/adCreatives.ts` — Pass ICP fields when calling generateContextualAdHeadlines
- `client/src/v2/V2ICPResultPanel.tsx` — Wire downloadPdf into the stubbed button
- `client/src/v2/V2TrailIntake.tsx` — Update fork-chip copy + add plain-language gate
- `server/pipeline-fixes.test.ts` — Add enrichment + ad-creatives ICP tests

---

## Task 1: ICP Enrichment Function

**Files:**
- Create: `server/_core/icpEnrichment.ts`

This is the core of the fix. A function that takes an imported (thin) ICP row, calls the 17-tab generator seeded with whatever the user provided, and updates only the NULL fields.

- [ ] **Step 1: Create the enrichment function**

```typescript
// server/_core/icpEnrichment.ts
import { ICP_SYSTEM_PROMPT, ICP_USER_PROMPT, type ICPServiceInput } from "./icpPrompts";
import { invokeLLM } from "./llm";
import { getDb } from "../db";
import { idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { filterRecord } from "../lib/complianceFilter";

// The 17 ICP content fields (excludes id, userId, serviceId, etc.)
const ICP_CONTENT_FIELDS = [
  "introduction", "fears", "hopesDreams", "psychographics",
  "pains", "frustrations", "goals", "values", "objections",
  "buyingTriggers", "mediaConsumption", "influencers",
  "communicationStyle", "decisionMaking", "successMetrics",
  "implementationBarriers",
] as const;

// Demographics is JSON, handled separately
const ICP_DEMOGRAPHICS_FIELD = "demographics" as const;

/**
 * Enrich an imported ICP by generating the missing fields.
 *
 * Calls the proven 17-tab ICP generator with the user's existing content
 * as seed context. Only updates fields that are currently NULL — user-provided
 * fields are NEVER overwritten. This preserves the user's authentic voice
 * while filling gaps the cascade needs (fears, objections, buyingTriggers, etc.).
 *
 * Non-fatal: if enrichment fails (LLM error, parse error), the ICP stays
 * as-is with its imported fields. The cascade runs with whatever is populated.
 * Failure is logged but does not throw.
 */
export async function enrichImportedIcp(icpId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 1. Load the ICP row
  const [icp] = await db.select().from(idealCustomerProfiles)
    .where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  if (!icp) return;

  // 2. Check if enrichment is needed — if all content fields are populated, skip
  const nullFields = ICP_CONTENT_FIELDS.filter(f => (icp as any)[f] == null);
  if (nullFields.length === 0) return; // Already fully populated

  // 3. Load the service for generator context
  let service: ICPServiceInput = {
    name: "Service", category: null, description: null,
    targetCustomer: null, mainBenefit: null,
  };
  if (icp.serviceId) {
    const [svc] = await db.select({
      name: services.name,
      category: services.category,
      description: services.description,
      targetCustomer: services.targetCustomer,
      mainBenefit: services.mainBenefit,
    }).from(services).where(eq(services.id, icp.serviceId)).limit(1);
    if (svc) service = svc;
  }

  // 4. Build seed context from user's existing content
  const existingContent: string[] = [];
  if (icp.name) existingContent.push(`ICP Name: ${icp.name}`);
  if (icp.pains) existingContent.push(`Pains (user-provided): ${icp.pains}`);
  if (icp.goals) existingContent.push(`Goals (user-provided): ${icp.goals}`);
  if (icp.implementationBarriers) existingContent.push(`Implementation Barriers (user-provided): ${icp.implementationBarriers}`);
  if (icp.introduction) existingContent.push(`Introduction (user-provided): ${icp.introduction}`);
  if (icp.fears) existingContent.push(`Fears (user-provided): ${icp.fears}`);
  if (icp.hopesDreams) existingContent.push(`Hopes & Dreams (user-provided): ${icp.hopesDreams}`);
  if (icp.psychographics) existingContent.push(`Psychographics (user-provided): ${icp.psychographics}`);
  if (icp.frustrations) existingContent.push(`Frustrations (user-provided): ${icp.frustrations}`);
  if (icp.values) existingContent.push(`Values (user-provided): ${icp.values}`);
  if (icp.objections) existingContent.push(`Objections (user-provided): ${icp.objections}`);
  if (icp.buyingTriggers) existingContent.push(`Buying Triggers (user-provided): ${icp.buyingTriggers}`);
  if (icp.demographics) existingContent.push(`Demographics (user-provided): ${JSON.stringify(icp.demographics)}`);

  const seedBlock = existingContent.length > 0
    ? `\n\nUSER-PROVIDED GROUND TRUTH — the user imported the following content about their ideal customer. Treat this as authoritative. Your generated sections MUST be consistent with this voice, this audience, and this framing. Do NOT contradict, generalize, or drift from the user's specifics. Match their level of niche detail.\n\n${existingContent.join("\n\n")}`
    : "";

  // 5. Call the 17-tab generator with seed context
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: ICP_SYSTEM_PROMPT() },
        { role: "user", content: ICP_USER_PROMPT(service) + seedBlock },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "icp_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              introduction: { type: "string" },
              fears: { type: "string" },
              hopesDreams: { type: "string" },
              demographics: {
                type: "object",
                properties: {
                  age_range: { type: "string" },
                  gender: { type: "string" },
                  income_level: { type: "string" },
                  education: { type: "string" },
                  occupation: { type: "string" },
                  location: { type: "string" },
                  family_status: { type: "string" },
                },
                required: ["age_range", "gender", "income_level", "education", "occupation", "location", "family_status"],
                additionalProperties: false,
              },
              psychographics: { type: "string" },
              pains: { type: "string" },
              frustrations: { type: "string" },
              goals: { type: "string" },
              values: { type: "string" },
              objections: { type: "string" },
              buyingTriggers: { type: "string" },
              mediaConsumption: { type: "string" },
              influencers: { type: "string" },
              communicationStyle: { type: "string" },
              decisionMaking: { type: "string" },
              successMetrics: { type: "string" },
              implementationBarriers: { type: "string" },
            },
            required: [
              "introduction", "fears", "hopesDreams", "demographics",
              "psychographics", "pains", "frustrations", "goals", "values",
              "objections", "buyingTriggers", "mediaConsumption", "influencers",
              "communicationStyle", "decisionMaking", "successMetrics",
              "implementationBarriers",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    if (!response?.choices?.[0]?.message?.content) return;
    const content = response.choices[0].message.content;
    const cleaned = (typeof content === "string" ? content : "")
      .replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
    const generated = JSON.parse(cleaned);

    // 6. Compliance filter on generated fields
    const textFields = ICP_CONTENT_FIELDS.filter(f => typeof generated[f] === "string");
    const { cleaned: compliant } = filterRecord(
      Object.fromEntries(textFields.map(f => [f, generated[f]])),
      textFields as unknown as string[],
    );

    // 7. Build update — ONLY set fields that are currently NULL
    const updates: Record<string, unknown> = {};
    for (const field of ICP_CONTENT_FIELDS) {
      if ((icp as any)[field] == null && compliant[field]) {
        updates[field] = compliant[field];
      }
    }
    // Demographics: only if currently NULL and generated has it
    if (icp.demographics == null && generated.demographics) {
      updates.demographics = generated.demographics;
    }
    // Legacy field mapping
    if (updates.pains && !icp.painPoints) updates.painPoints = updates.pains;
    if (updates.goals && !icp.desiredOutcomes) updates.desiredOutcomes = updates.goals;
    if (updates.values && !(icp as any).valuesMotivations) updates.valuesMotivations = updates.values;

    if (Object.keys(updates).length === 0) return;

    // 8. Update
    await db.update(idealCustomerProfiles)
      .set(updates)
      .where(eq(idealCustomerProfiles.id, icpId));

    console.log(`[icpEnrichment] Enriched ICP ${icpId}: filled ${Object.keys(updates).length} NULL fields`);
  } catch (err) {
    // Non-fatal — ICP stays as-is
    console.warn(`[icpEnrichment] Failed to enrich ICP ${icpId}:`, err instanceof Error ? err.message : String(err));
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36 (baseline holds)

- [ ] **Step 3: Commit**

```bash
git add server/_core/icpEnrichment.ts
git commit -m "feat: ICP enrichment function — fills NULL fields on imported ICPs via seeded 17-tab generator"
```

---

## Task 2: Wire Enrichment Into importIcp

**Files:**
- Modify: `server/routers/autoMode.ts` (importIcp mutation, ~line 324-339)

- [ ] **Step 1: Add enrichment call after importIcp DB insert**

In `server/routers/autoMode.ts`, after the `importIcp` mutation's `db.insert` and before the `return` statement (around line 335), add an async enrichment call:

After:
```typescript
      const result: any = await db.insert(idealCustomerProfiles).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        name: cleanedIcp.name,
        pains: cleanedIcp.pains || null,
        goals: cleanedIcp.goals || null,
        implementationBarriers: cleanedIcp.implementationBarriers || null,
        demographics: cleanedIcp.demographics ? { ageRange: cleanedIcp.demographics } : null,
        source: "imported",
      });
```

Add:
```typescript
      // Enrich the imported ICP with the full 17-tab generator (non-blocking).
      // Fires after the thin row is saved so the caller gets icpId immediately.
      // If enrichment fails, the ICP stays thin — cascade still runs end-to-end.
      const icpId = result[0].insertId as number;
      const { enrichImportedIcp } = await import("../_core/icpEnrichment");
      setImmediate(() => {
        enrichImportedIcp(icpId).catch(err => {
          console.warn("[importIcp] Background enrichment failed:", err instanceof Error ? err.message : String(err));
        });
      });
```

Then update the return to use the extracted `icpId`:
```typescript
      return {
        icpId,
        complianceApplied: icpClassification === "PIVOT_REQUIRED",
        flaggedTerms: icpFlaggedTerms,
      };
```

- [ ] **Step 2: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

- [ ] **Step 3: Verify tests**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5`
Expected: 353 passed

- [ ] **Step 4: Commit**

```bash
git add server/routers/autoMode.ts
git commit -m "feat: wire ICP enrichment into importIcp — background fill of NULL fields after import"
```

---

## Task 3: Offer Enrichment (Generate Missing Angles)

**Files:**
- Modify: `server/routers/autoMode.ts` (importAssets mutation, offer section ~line 412-428)

After the imported offer is saved (line 428 `autoSelectBest`), the offer has only `godfatherAngle` populated. The orchestrator's cascade will generate downstream nodes using this single angle. The enrichment here generates the missing `freeAngle` and `dollarAngle` from the imported godfather.

- [ ] **Step 1: Add offer enrichment after offer import**

After line 428 (`await autoSelectBest(...)`) in the offer import section, add:

```typescript
        // Enrich: generate missing offer angles from the imported godfather (non-blocking).
        const offerId = offerResult[0].insertId;
        setImmediate(async () => {
          try {
            const bgDb = await getDb();
            if (!bgDb) return;
            const [svc] = await bgDb.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
            if (!svc) return;
            const [importedOffer] = await bgDb.select().from(offers).where(eq(offers.id, offerId)).limit(1);
            if (!importedOffer || importedOffer.freeAngle) return; // Already has angles

            const { generateOfferAngle } = await import("../offersGenerator");
            const serviceData = { name: svc.name, description: svc.description, targetCustomer: svc.targetCustomer, mainBenefit: svc.mainBenefit };
            const godfather = importedOffer.godfatherAngle as any;
            const seedContext = godfather ? `\n\nEXISTING OFFER (user-provided, use as basis):\nName: ${godfather.offerName || ""}\nValue Proposition: ${godfather.valueProposition || ""}\nCTA: ${godfather.cta || ""}` : "";

            const [freeAngle, dollarAngle] = await Promise.all([
              generateOfferAngle(serviceData, "free", seedContext),
              generateOfferAngle(serviceData, "dollar", seedContext),
            ]);

            await bgDb.update(offers).set({ freeAngle, dollarAngle }).where(eq(offers.id, offerId));
            console.log(`[importAssets] Enriched offer ${offerId}: generated free + dollar angles`);
          } catch (err) {
            console.warn("[importAssets] Offer enrichment failed:", err instanceof Error ? err.message : String(err));
          }
        });
```

IMPORTANT: This depends on `generateOfferAngle` being exported from `offersGenerator.ts`. Check if it exists — if the offer generator only exports `runOfferGeneration` (which generates all 3 angles at once), then the enrichment should call `runOfferGeneration` with the imported content as seed context instead, and update the missing angles from its output. Read `server/offersGenerator.ts` to confirm the available exports before implementing.

- [ ] **Step 2: Verify TS + tests**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)
Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5` (expect 353)

- [ ] **Step 3: Commit**

```bash
git add server/routers/autoMode.ts
git commit -m "feat: offer enrichment — generate missing free + dollar angles from imported godfather"
```

---

## Task 4: PPTX File Parsing

**Files:**
- Modify: `server/_core/index.ts` (extract-documents endpoint, ~line 405-480)
- Modify: `package.json` (add officeparser dependency)

- [ ] **Step 1: Install officeparser**

```bash
npm install officeparser
```

`officeparser` handles PPTX, XLSX, and other Office formats. It extracts text content from slides.

- [ ] **Step 2: Add PPTX to the extract-documents file filter**

In `server/_core/index.ts`, find the `docUpload` multer config (around line 406-422). Add PPTX MIME type to the allowed list:

Change the `allowed` array from:
```typescript
      const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];
```
To:
```typescript
      const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ];
```

- [ ] **Step 3: Add PPTX parsing handler**

In the file processing loop (around line 448-478), after the DOCX/DOC handler and before the TXT handler, add:

```typescript
          } else if (
            file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          ) {
            const { parseOffice } = await import("officeparser");
            text = await parseOffice(file.path);
```

- [ ] **Step 4: Verify TS + tests**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)
Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5` (expect 353)

- [ ] **Step 5: Commit**

```bash
git add server/_core/index.ts package.json package-lock.json
git commit -m "feat: add PPTX file parsing to extract-documents endpoint via officeparser"
```

---

## Task 5: Image Reading via Anthropic Vision API

**Files:**
- Modify: `server/_core/index.ts` (extract-documents endpoint — add image acceptance)
- Modify: `server/_core/llm.ts` (fix Anthropic message conversion for ImageContent)
- Modify: `server/routers/autoMode.ts` (extractFromAssets — support image input)

This task has two parts: (A) fix the LLM wrapper to properly handle images, and (B) accept image uploads and send them through for text extraction.

- [ ] **Step 1: Fix Anthropic message conversion for ImageContent**

In `server/_core/llm.ts`, line 289-292, the message conversion currently JSON.stringifies non-string content, which breaks image payloads. Replace:

```typescript
  const anthropicMessages = conversationMessages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
```

With:

```typescript
  const anthropicMessages = conversationMessages.map(m => {
    const role = m.role === "assistant" ? "assistant" as const : "user" as const;
    if (typeof m.content === "string") {
      return { role, content: m.content };
    }
    // Convert content parts to Anthropic's native format
    const parts = ensureArray(m.content).map(normalizeContentPart);
    const anthropicParts = parts.map(part => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      if (part.type === "image_url") {
        const url = (part as ImageContent).image_url.url;
        // Data URL: extract base64 + media type
        if (url.startsWith("data:")) {
          const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            return {
              type: "image" as const,
              source: { type: "base64" as const, media_type: match[1], data: match[2] },
            };
          }
        }
        // HTTP URL: pass as URL source
        return {
          type: "image" as const,
          source: { type: "url" as const, url },
        };
      }
      // Fallback: stringify unknown types
      return { type: "text" as const, text: JSON.stringify(part) };
    });
    // If single text part, collapse for compatibility
    if (anthropicParts.length === 1 && anthropicParts[0].type === "text") {
      return { role, content: (anthropicParts[0] as any).text };
    }
    return { role, content: anthropicParts };
  });
```

- [ ] **Step 2: Add image MIME types to extract-documents**

In the `docUpload` multer config's `allowed` array, add image types:

```typescript
        "image/jpeg",
        "image/png",
        "image/webp",
```

- [ ] **Step 3: Add image handling to the file processing loop**

In the extract-documents handler's file processing loop, add an image branch that reads the file as base64 and stores it for later LLM processing:

```typescript
          } else if (file.mimetype.startsWith("image/")) {
            // Images are processed via Claude vision — store base64 for LLM call
            const buffer = fs.readFileSync(file.path);
            const base64 = buffer.toString("base64");
            const dataUrl = `data:${file.mimetype};base64,${base64}`;
            // Store image data URLs in a separate array for the response
            if (!(req as any)._imageDataUrls) (req as any)._imageDataUrls = [];
            (req as any)._imageDataUrls.push({ filename: file.originalname, dataUrl });
            // Also add a text marker so the caller knows images were included
            textParts.push(`[IMAGE: ${file.originalname} — sent for visual analysis]`);
          }
```

Then in the response, include the image data URLs:

After the existing response line `res.json({ text: combined, fileCount: files.length, warnings });`, change to:

```typescript
      res.json({
        text: combined,
        fileCount: files.length,
        warnings,
        images: (req as any)._imageDataUrls || [],
      });
```

- [ ] **Step 4: Handle images in extractFromAssets**

In `server/routers/autoMode.ts`, update the `extractFromAssets` input to accept optional image data URLs:

Add to the Zod input:
```typescript
      images: z.array(z.object({
        filename: z.string(),
        dataUrl: z.string(),
      })).optional(),
```

In the LLM call within extractFromAssets, if images are provided, construct a multimodal message:

```typescript
      // Build message content — text + optional images
      const messageContent: Array<{ type: string; [key: string]: any }> = [
        { type: "text", text: userPrompt },
      ];
      if (input.images && input.images.length > 0) {
        for (const img of input.images) {
          messageContent.push({
            type: "image_url",
            image_url: { url: img.dataUrl, detail: "high" },
          });
        }
      }
```

Then use `messageContent` instead of the plain string in the LLM messages array.

- [ ] **Step 5: Update client to pass images through**

In `client/src/v2/V2TrailIntake.tsx`, when calling extractFromAssets after file upload, pass the images array from the extract-documents response through.

Find where the client calls `extractFromAssets` after getting the text from `/api/extract-documents`, and add the images field:

```typescript
const extractResult = await extractFromAssets.mutateAsync({
  rawText: docResult.text,
  images: docResult.images || [],
});
```

- [ ] **Step 6: Verify TS + tests**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)
Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5` (expect 353)

**SCOPE NOTE:** If fixing the Anthropic message conversion (Step 1) proves more complex than expected — e.g., the tool-use path also needs image handling, or the Anthropic API returns errors on the image format — flag this before expanding the scope. The critical path is Step 1 (LLM fix) + Steps 2-3 (accept images). Steps 4-5 (pass through to extraction) can be a follow-up if Step 1 balloons.

- [ ] **Step 7: Commit**

```bash
git add server/_core/llm.ts server/_core/index.ts server/routers/autoMode.ts client/src/v2/V2TrailIntake.tsx
git commit -m "feat: image reading via Anthropic vision API + PPTX parsing in extract-documents"
```

---

## Task 6: Ad-Creatives ICP Wiring

**Files:**
- Modify: `server/adCreativesGenerator.ts` (~line 115-121, GenerateContextualAdHeadlinesInput type)
- Modify: `server/adCreativesGenerator.ts` (~line 156, buildAdHeadlinesUserPrompt function)
- Modify: `server/routers/adCreatives.ts` (where generateContextualAdHeadlines is called — pass ICP fields)

- [ ] **Step 1: Expand the input type**

In `server/adCreativesGenerator.ts`, add ICP fields to `GenerateContextualAdHeadlinesInput` (around line 115):

```typescript
export type GenerateContextualAdHeadlinesInput = {
  productName: string;
  mainBenefit: string;
  targetAudience: string;
  uniqueMechanism: string;
  pressingProblem: string;
  // ICP context for audience-specific headlines
  icpPains?: string;
  icpFears?: string;
  icpObjections?: string;
  icpBuyingTriggers?: string;
};
```

- [ ] **Step 2: Add ICP context to the headline prompt**

In `buildAdHeadlinesUserPrompt` (line 156), after the existing fields (pressing problem), add ICP context if present:

After line 174 (`Pressing problem: ${gist(input.pressingProblem, 120)}`), add:

```typescript
${input.icpPains ? `\nAudience daily pains: ${gist(input.icpPains, 200)}` : ""}
${input.icpFears ? `\nAudience deep fears: ${gist(input.icpFears, 200)}` : ""}
${input.icpObjections ? `\nAudience objections to buying: ${gist(input.icpObjections, 150)}` : ""}
${input.icpBuyingTriggers ? `\nWhat triggers them to buy: ${gist(input.icpBuyingTriggers, 150)}` : ""}
```

- [ ] **Step 3: Pass ICP fields from the router**

In `server/routers/adCreatives.ts`, find where `generateContextualAdHeadlines` is called (search for the function invocation). When it's called, it receives `productName`, `mainBenefit`, `targetAudience`, `uniqueMechanism`, `pressingProblem` from the service/ICP. Add the ICP text fields by loading the ICP row:

Before the call, load the ICP:
```typescript
// Load ICP for audience-specific context
const [icp] = kitId
  ? await db.select().from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.id, kit.icpId)).limit(1)
  : [];
```

Then add to the input object:
```typescript
  icpPains: icp?.pains || undefined,
  icpFears: icp?.fears || undefined,
  icpObjections: icp?.objections || undefined,
  icpBuyingTriggers: icp?.buyingTriggers || undefined,
```

IMPORTANT: Read `server/routers/adCreatives.ts` to find the exact callsite and available variables before implementing. The ICP may already be loaded for another purpose, or the kit reference may need to be traced.

- [ ] **Step 4: Verify TS + tests**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)
Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5` (expect 353)

- [ ] **Step 5: Commit**

```bash
git add server/adCreativesGenerator.ts server/routers/adCreatives.ts
git commit -m "feat: wire ICP fields (pains, fears, objections, triggers) into ad-creative headline generation"
```

---

## Task 7: ICP PDF Download (Trivial)

**Files:**
- Modify: `client/src/v2/V2ICPResultPanel.tsx` (~line 490)

- [ ] **Step 1: Wire downloadPdf into the button**

In `client/src/v2/V2ICPResultPanel.tsx`, line 490, change:

```typescript
            onClick={() => toast.info("PDF export coming in Phase L")}
```

To:

```typescript
            onClick={() => {
              const { downloadPdf } = require("./lib/exportUtils");
              const { formatIcpTxt } = require("./lib/exportUtils");
              downloadPdf(formatIcpTxt(data), serviceName || "ICP", "ICP");
            }}
```

Or using the existing import pattern (check if `downloadPdf` and `formatIcpTxt` are already imported at the top of the file — `formatIcpTxt` IS imported at line ~509 for `ExportButtons`):

```typescript
            onClick={() => downloadPdf(formatIcpTxt(data), serviceName || "ICP", "ICP")}
```

Add `downloadPdf` to the existing import from `./lib/exportUtils` if not already imported.

- [ ] **Step 2: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)

- [ ] **Step 3: Commit**

```bash
git add client/src/v2/V2ICPResultPanel.tsx
git commit -m "feat: wire ICP PDF download — replace Phase L toast with actual downloadPdf call"
```

---

## Task 8: Plain-Language Gate on Has-Assets Fork

**Files:**
- Modify: `client/src/v2/V2TrailIntake.tsx` (fork chip area + has-assets entry)

- [ ] **Step 1: Update fork chip copy and add gate screen**

In `V2TrailIntake.tsx`, find the fork chip for "I have some — use mine" and the `runHasAssetsInChat` function.

Before the upload/paste choice, add a plain-language explanation beat:

```typescript
// Plain-language gate — explain what helps, no jargon
addMessage({
  role: "assistant",
  content: "Great! Here's what helps me build the best campaign for you:\n\n" +
    "• Something that describes your offer or program — what you sell, who it's for, what they get\n" +
    "• Information about your ideal client — who they are, what they struggle with, what they want\n" +
    "• Your unique approach or method — what makes the way you do it different\n\n" +
    "This could be a document, a sales page, a slide deck, notes — anything you have. I'll read through it and pull out what I need.",
});

// Self-selection chips
const hasStuff = await showChipsAndWait([
  { label: "I have stuff like that", value: "continue" },
  { label: "Actually, build it for me", value: "auto" },
]);

if (hasStuff === "auto") {
  // Redirect to auto mode — the user doesn't have material
  // Set path to auto and proceed with full generation
  return redirectToAutoMode();
}
```

The exact implementation depends on how `runHasAssetsInChat` is structured — the implementer should read the function to find the right insertion point (before the upload/paste choice) and the mechanism for showing chips and awaiting responses (the existing `importConfirmResolve` pattern).

- [ ] **Step 2: Verify TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (expect 36)

- [ ] **Step 3: Commit**

```bash
git add client/src/v2/V2TrailIntake.tsx
git commit -m "feat: plain-language gate on has-assets flow — explain what helps, offer auto-redirect"
```

---

## Task 9: Structural Tests

**Files:**
- Modify: `server/pipeline-fixes.test.ts`

- [ ] **Step 1: Add enrichment and ad-creative ICP tests**

Append to `server/pipeline-fixes.test.ts`:

```typescript
// ─── Import-Then-Enrich — structural assertions ───────────────────────────
import { enrichImportedIcp } from "./_core/icpEnrichment";

describe("Import-Then-Enrich", () => {
  it("enrichImportedIcp is exported as a function", () => {
    expect(typeof enrichImportedIcp).toBe("function");
    expect(enrichImportedIcp.length).toBe(1); // takes icpId
  });
});

// ─── Ad-Creatives ICP Wiring — structural assertions ──────────────────────
import { buildAdHeadlinesUserPrompt } from "./adCreativesGenerator";

describe("Ad-Creatives ICP Wiring", () => {
  it("buildAdHeadlinesUserPrompt includes ICP context when provided", () => {
    const prompt = buildAdHeadlinesUserPrompt({
      productName: "Test Product",
      mainBenefit: "Test benefit",
      targetAudience: "Test audience",
      uniqueMechanism: "Test mechanism",
      pressingProblem: "Test problem",
      icpPains: "They struggle with getting clients consistently",
      icpFears: "They fear running out of money",
      icpObjections: "They think it's too expensive",
      icpBuyingTriggers: "They see a competitor succeed",
    });
    expect(prompt).toContain("Audience daily pains:");
    expect(prompt).toContain("getting clients consistently");
    expect(prompt).toContain("Audience deep fears:");
    expect(prompt).toContain("running out of money");
    expect(prompt).toContain("Audience objections to buying:");
    expect(prompt).toContain("too expensive");
    expect(prompt).toContain("What triggers them to buy:");
    expect(prompt).toContain("competitor succeed");
  });

  it("buildAdHeadlinesUserPrompt works without ICP context (backward compat)", () => {
    const prompt = buildAdHeadlinesUserPrompt({
      productName: "Test Product",
      mainBenefit: "Test benefit",
      targetAudience: "Test audience",
      uniqueMechanism: "Test mechanism",
      pressingProblem: "Test problem",
    });
    expect(prompt).toContain("Test Product");
    expect(prompt).not.toContain("Audience daily pains:");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -10`
Expected: All pass (353 + ~3 new = ~356)

- [ ] **Step 3: Commit**

```bash
git add server/pipeline-fixes.test.ts
git commit -m "test: structural tests for ICP enrichment + ad-creatives ICP wiring"
```

---

## Task 10: Final Gates + Squash

- [ ] **Step 1: TS baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 36

- [ ] **Step 2: Full test suite**

Run: `npx vitest run server/pipeline-fixes.test.ts 2>&1 | tail -5`
Expected: All pass (~356)

- [ ] **Step 3: Secondary suites**

Run: `npx vitest run server/lib/complianceFilter.test.ts 2>&1 | tail -3` (14/14)
Run: `npx vitest run server/_core/tokenCrypto.test.ts 2>&1 | tail -3` (10/10)

- [ ] **Step 4: Squash to single atomic commit**

```bash
git log --oneline 4ccf4a9..HEAD
# Count commits, then:
git reset --soft 4ccf4a9
git add server/_core/icpEnrichment.ts server/routers/autoMode.ts server/_core/index.ts server/_core/llm.ts server/adCreativesGenerator.ts server/routers/adCreatives.ts server/pipeline-fixes.test.ts client/src/v2/V2ICPResultPanel.tsx client/src/v2/V2TrailIntake.tsx package.json package-lock.json
git commit -m "feat: import-then-enrich — auto-fill imported ICP to 17 tabs, offer angle enrichment, PPTX+image reading, ad-creatives ICP wiring, ICP PDF download, plain-language gate"
```

- [ ] **Step 5: Hold for review — do NOT push**

---

## Verification Checklist (Post-Build)

1. **ICP enrichment:** Create a test imported ICP via `importIcp` with only name + pains. After enrichment runs (check server logs for `[icpEnrichment]` message), verify the ICP row now has all 17 fields populated. The `pains` field should be the user's original text, not the LLM's version.

2. **Ad creatives:** Generate ad creative headlines for a campaign. The prompt should now include ICP pains/fears/objections/triggers. Verify the headlines reference the audience's specific situation, not generic niche language.

3. **PPTX upload:** Upload a .pptx file via the has-assets flow. Verify text is extracted and appears in the extraction results.

4. **Image upload:** Upload a screenshot (PNG/JPG) of a sales page. Verify the image is sent to Claude for analysis and content is extracted.

5. **ICP PDF:** Click "Download PDF" on an ICP result panel. Verify a PDF downloads with all 17 sections formatted.

6. **Plain-language gate:** Start a new campaign, pick "I have some — use mine." Verify the explanation screen appears before the upload/paste choice.
