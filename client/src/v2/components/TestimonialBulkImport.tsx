/**
 * TestimonialBulkImport — paste or CSV → the testimonial library (trpc `testimonials.addMany`).
 *
 * The median coach has 5–10 real testimonials sitting in a doc or spreadsheet and, until now, no way
 * to get them in beyond typing one at a time. This is the surface that makes the 3-cap fix real: once
 * the library is populated, the landing-page proof allocator shows all of a coach's real proof.
 *
 * A real user surface, not an admin tool: paste one-per-line (`Name | Title | Quote`, title optional)
 * or upload a CSV (columns name, title, quote). Rows are validated PER ROW with visible feedback
 * before import; the server dedupes by quote so re-pasting is safe. Real testimonials only — nothing
 * generated, nothing fabricated.
 */
import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const BRAND = "#FF5B1D";
const INK = "#1A1624";
const OK = "#2E7D32";
const WARN = "#B45309";
const MUTE = "#6B7280";
const LINE = "#E5E1DA";
const FONT = "'Instrument Sans', system-ui, sans-serif";

interface Props {
  /** Attach imported testimonials to a specific service (else global to the coach). */
  serviceId?: number;
  onDone?: () => void;
}

type Row = { name: string; title: string; quote: string };
type ParsedRow = Row & { valid: boolean; reason?: string };

/** Minimal CSV parser — handles quoted fields with embedded commas/quotes. Header row (name/title/quote)
 * detected and skipped; otherwise assumes column order name, title, quote. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const out = rows.filter((r) => r.some((c) => c.trim()));
  if (out.length && /name/i.test(out[0][0] || "") && /quote/i.test(out[0].join(","))) out.shift(); // drop header
  return out.map((r) => ({ name: (r[0] ?? "").trim(), title: (r[1] ?? "").trim(), quote: (r[2] ?? "").trim() }));
}

/** Paste parser — one testimonial per line, pipe-delimited `Name | Title | Quote` (title optional →
 * `Name | Quote`). Blank lines ignored. */
function parsePaste(text: string): Row[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 3) return { name: parts[0], title: parts[1], quote: parts.slice(2).join(" | ") };
    if (parts.length === 2) return { name: parts[0], title: "", quote: parts[1] };
    return { name: "", title: "", quote: parts[0] };
  });
}

function validate(rows: Row[]): ParsedRow[] {
  return rows.map((r) => {
    if (!r.name) return { ...r, valid: false, reason: "Missing name" };
    if (!r.quote) return { ...r, valid: false, reason: "Missing quote" };
    return { ...r, valid: true };
  });
}

export default function TestimonialBulkImport({ serviceId, onDone }: Props) {
  const utils = trpc.useUtils();
  const addMany = trpc.testimonials.addMany.useMutation({
    onSuccess: () => utils.testimonials.list.invalidate(),
  });
  const [raw, setRaw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo<ParsedRow[]>(() => (raw.trim() ? validate(parsePaste(raw)) : []), [raw]);
  const validCount = parsed.filter((r) => r.valid).length;
  const result = addMany.data;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const rows = parseCsv(text);
    // Render CSV back into the paste box so the coach can eyeball/edit before importing.
    setRaw(rows.map((r) => [r.name, r.title, r.quote].filter(Boolean).join(" | ")).join("\n"));
  };

  const doImport = () => {
    const items = parsed.filter((r) => r.valid).map((r) => ({ name: r.name, title: r.title || undefined, quote: r.quote }));
    if (items.length) addMany.mutate({ serviceId, items });
  };

  return (
    <div style={{ fontFamily: FONT, color: INK, maxWidth: 640 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Import your testimonials</div>
      <div style={{ fontSize: 13, color: MUTE, marginBottom: 12, lineHeight: 1.5 }}>
        Paste one per line as <code>Name | Title | Quote</code> (title optional), or upload a CSV
        (columns: name, title, quote). We&rsquo;ll skip exact duplicates automatically.
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"Ravi Menon | Founder, Acme | Doubled revenue in six months.\nSarah Whitfield | | The clarity alone was worth it."}
        rows={7}
        style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", fontFamily: FONT, fontSize: 14, color: INK, resize: "vertical" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 4px" }}>
        <button onClick={() => fileRef.current?.click()} style={{ background: "white", border: `1.5px solid ${LINE}`, borderRadius: 9999, padding: "8px 16px", fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK, cursor: "pointer" }}>
          Upload CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
        {parsed.length > 0 && (
          <span style={{ fontSize: 13, color: MUTE }}>
            {validCount} ready{parsed.length - validCount > 0 ? ` · ${parsed.length - validCount} need a fix` : ""}
          </span>
        )}
      </div>

      {/* Per-row validation preview (before import) */}
      {parsed.length > 0 && !result && (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, marginTop: 10, maxHeight: 240, overflowY: "auto" }}>
          {parsed.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderBottom: i < parsed.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.valid ? OK : WARN, flexShrink: 0, marginTop: 1 }}>{r.valid ? "✓" : "!"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name || <span style={{ color: WARN }}>(no name)</span>}{r.title ? <span style={{ color: MUTE, fontWeight: 400 }}> — {r.title}</span> : null}</div>
                <div style={{ fontSize: 12, color: MUTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.quote || <span style={{ color: WARN }}>(no quote)</span>}</div>
              </div>
              {!r.valid && <span style={{ fontSize: 11, color: WARN, flexShrink: 0 }}>{r.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Result summary (after import) */}
      {result && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#F0FAF1", border: `1px solid #CDE9D0`, fontSize: 13, color: INK }}>
          <strong>{result.added}</strong> testimonial{result.added === 1 ? "" : "s"} added.
          {result.duplicates > 0 ? ` ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped.` : ""}
          {result.invalid > 0 ? ` ${result.invalid} skipped (missing name or quote).` : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {!result ? (
          <button
            onClick={doImport}
            disabled={validCount === 0 || addMany.isPending}
            style={{ background: BRAND, color: "white", border: "none", borderRadius: 9999, padding: "11px 24px", fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: validCount === 0 || addMany.isPending ? "not-allowed" : "pointer", opacity: validCount === 0 || addMany.isPending ? 0.5 : 1 }}
          >
            {addMany.isPending ? "Importing…" : `Import ${validCount || ""} testimonial${validCount === 1 ? "" : "s"}`.trim()}
          </button>
        ) : (
          <button onClick={() => { setRaw(""); addMany.reset(); }} style={{ background: "white", border: `1.5px solid ${LINE}`, borderRadius: 9999, padding: "11px 24px", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, cursor: "pointer" }}>
            Import more
          </button>
        )}
        {onDone && (
          <button onClick={onDone} style={{ background: "none", border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: MUTE, cursor: "pointer" }}>
            {result ? "Done" : "Cancel"}
          </button>
        )}
      </div>

      {addMany.isError && <div style={{ marginTop: 10, fontSize: 13, color: WARN }}>Something went wrong — please try again.</div>}
    </div>
  );
}
