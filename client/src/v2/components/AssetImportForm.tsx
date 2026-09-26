/**
 * SKIP, MADE HONEST (Arfeen decision 5): the in-chat form behind "I already have this — use mine" on Offer,
 * Unique Method and Lead Magnet. Stays inside the node (Duolingo principle). Inline styles, full font stack on
 * every text element (CLAUDE.md §5.7 / §6).
 */
import { useState } from "react";
import { IMPORT_FORMS } from "../importPolicy";

const BODY = "var(--v2-font-body, 'Instrument Sans', sans-serif)";
const HEADING = "var(--v2-font-heading, 'Fraunces', serif)";

export default function AssetImportForm({ step, error, onSubmit, onCancel }: {
  step: string;
  error?: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const form = IMPORT_FORMS[step];
  const [values, setValues] = useState<Record<string, string>>({});
  if (!form) return null;
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(26,22,36,0.18)",
    fontFamily: BODY,
    fontSize: 14,
    color: "var(--v2-text-color, #1A1624)",
    background: "#fff",
  };
  return (
    <div data-testid={`asset-import-${step}`} style={{
      background: "#fff",
      border: "1px solid rgba(26,22,36,0.1)",
      borderRadius: 16,
      padding: 16,
      maxWidth: 520,
      boxShadow: "0 2px 10px rgba(26,22,36,0.05)",
    }}>
      <p style={{ margin: "0 0 12px", fontFamily: HEADING, fontStyle: "italic", fontWeight: 900, fontSize: 18, color: "var(--v2-text-color, #1A1624)" }}>
        {form.title}
      </p>
      {form.fields.map((f) => (
        <label key={f.key} style={{ display: "block", marginBottom: 12, fontFamily: BODY }}>
          <span style={{ display: "block", marginBottom: 4, fontFamily: BODY, fontSize: 13, fontWeight: 600, color: "var(--v2-text-color, #1A1624)" }}>
            {f.label}{f.required ? "" : " (optional)"}
          </span>
          {f.multiline ? (
            <textarea
              data-testid={`asset-import-field-${f.key}`}
              rows={3}
              maxLength={f.max}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          ) : (
            <input
              data-testid={`asset-import-field-${f.key}`}
              maxLength={f.max}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              style={inputStyle}
            />
          )}
        </label>
      ))}
      {error && (
        <p data-testid="asset-import-error" style={{ margin: "0 0 12px", fontFamily: BODY, fontSize: 13, color: "#B3261E" }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          data-testid="asset-import-use"
          onClick={() => onSubmit(values)}
          style={{ padding: "12px 28px", borderRadius: 9999, border: "none", background: "var(--v2-primary-btn, #FF5B1D)", color: "#fff", fontFamily: BODY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Use mine
        </button>
        <button
          data-testid="asset-import-cancel"
          onClick={onCancel}
          style={{ padding: "12px 28px", borderRadius: 9999, border: "1px solid rgba(26,22,36,0.18)", background: "transparent", color: "var(--v2-text-color, #1A1624)", fontFamily: BODY, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          Show me options instead
        </button>
      </div>
    </div>
  );
}
