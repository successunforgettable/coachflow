/**
 * ab-icp-phaseA — drives the REAL runIcpGeneration path once and prints the four
 * high-leverage fields in full, plus grounding hits by class, provenance labels
 * and the attempt count.
 *
 * NO DATABASE ACCESS. The service row is read from a JSON file captured
 * read-only beforehand. Nothing is written anywhere.
 *
 * Usage:  npx tsx server/scripts/ab-icp-phaseA.ts <service.json> <label>
 */
import { readFileSync } from "fs";
import { runIcpGeneration } from "../_core/icpGenerate";
import { validateIcpGrounding, type IcpValidationContext } from "../_core/icpGrounding";
import type { ICPServiceInput } from "../_core/icpPrompts";

const FIELDS = ["pains", "fears", "buyingTriggers", "objections"] as const;

async function main() {
  const [, , path, label] = process.argv;
  const row = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

  // Exactly what the live routers pass: the whole service row. Old code reads
  // five fields off it, new code reads twelve. Same input either way.
  const service = row as unknown as ICPServiceInput;
  const ctx: IcpValidationContext = { service };

  const started = Date.now();
  const { icp, provenance, attempts } = await runIcpGeneration({
    service,
    logLabel: `ab-${label}`,
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`### ${label} — service ${String(row.id)} — attempts ${attempts} — ${secs}s`);
  console.log("=".repeat(78));

  for (const f of FIELDS) {
    console.log(`\n--- ${f.toUpperCase()} ---`);
    console.log(String(icp[f] ?? "(absent)"));
  }

  const hits = validateIcpGrounding(icp as Record<string, unknown>, ctx);
  const byClass = new Map<string, number>();
  for (const h of hits) byClass.set(h.classId, (byClass.get(h.classId) ?? 0) + 1);
  console.log(`\n--- GROUNDING HITS BY CLASS (total ${hits.length}) ---`);
  if (byClass.size === 0) console.log("(none)");
  for (const [k, v] of Array.from(byClass.entries()).sort()) {
    const retryable = hits.find((h) => h.classId === k)?.retryable;
    console.log(`${k.padEnd(32)} ${String(v).padStart(3)}   retryable=${retryable}`);
  }

  console.log(`\n--- PROVENANCE (corpusWords ${provenance.corpusWords}) ---`);
  const counts: Record<string, number> = { stated: 0, partial: 0, inferred: 0 };
  const per = provenance.perSection as Record<string, string>;
  for (const [k, v] of Object.entries(per)) {
    counts[v] = (counts[v] ?? 0) + 1;
    console.log(`${k.padEnd(24)} ${v}`);
  }
  console.log(`totals: stated=${counts.stated} partial=${counts.partial} inferred=${counts.inferred}`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
