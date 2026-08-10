/**
 * publishLedger.ts — every Meta object id, on disk the instant it exists.
 *
 * 🔴 THE LESSON THIS ENCODES, borrowed from Cloudinary. `adCreativeTeardown`'s docblock records
 * 30 orphaned images that accumulated because rows were deleted before their URLs were read —
 * and once the row was gone the URL was unrecoverable from the database. Meta has the same
 * shape with worse consequences: an id you never wrote down is an object you cannot find later
 * except by NAME, and the name search is exactly what §1.5 of the 4c plan shows to be
 * unreliable (the campaign listing truncates, and five campaigns already share one name).
 *
 * So the ledger is written SYNCHRONOUSLY, one line per object, at the moment the id comes back
 * — not batched, not at the end, not in memory. If the process dies mid-run, the delete list is
 * already on disk and teardown is still possible.
 *
 * The writer is injected so the ordering can be proven without touching a filesystem.
 */

export type LedgerKind = "campaign" | "adset" | "creative" | "ad";

export type LedgerEntry = { kind: LedgerKind; id: string; at: string; note?: string };

export type PublishLedger = {
  /** Appends immediately and returns the id, so it can be used inline at the call site. */
  record: (kind: LedgerKind, id: string, note?: string) => string;
  entries: () => LedgerEntry[];
  campaignId: () => string | null;
  adSetId: () => string | null;
  adIds: () => string[];
  creativeIds: () => string[];
  path: string;
};

export type LedgerWriter = (line: string) => void;

/**
 * `now` is injected rather than read from the clock so a test can assert on entries exactly.
 */
export function createPublishLedger(opts: {
  path: string;
  write: LedgerWriter;
  now?: () => string;
}): PublishLedger {
  const entries: LedgerEntry[] = [];
  const now = opts.now ?? (() => new Date().toISOString());

  const record = (kind: LedgerKind, id: string, note?: string): string => {
    const clean = String(id ?? "").trim();
    if (!clean) {
      // A blank id is worse than a missing entry: it looks recorded and deletes nothing.
      throw new Error(`refusing to record an empty ${kind} id in the publish ledger`);
    }
    const entry: LedgerEntry = { kind, id: clean, at: now(), ...(note ? { note } : {}) };
    entries.push(entry);
    // Written BEFORE the caller does anything else with the id.
    opts.write(JSON.stringify(entry) + "\n");
    return clean;
  };

  const firstOf = (kind: LedgerKind) => entries.find((e) => e.kind === kind)?.id ?? null;
  const allOf = (kind: LedgerKind) => entries.filter((e) => e.kind === kind).map((e) => e.id);

  return {
    record,
    entries: () => [...entries],
    campaignId: () => firstOf("campaign"),
    adSetId: () => firstOf("adset"),
    adIds: () => allOf("ad"),
    creativeIds: () => allOf("creative"),
    path: opts.path,
  };
}

/** Rebuild a ledger from a file's lines — the recovery path after an interrupted run. */
export function readLedgerLines(lines: string[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.id === "string" && typeof parsed.kind === "string") out.push(parsed);
    } catch {
      // A corrupt line must not discard the good ones — a partial delete list still beats none.
    }
  }
  return out;
}
