/**
 * TweakBox — Trail Sprint 2, Commit 1 (spec 3.5, intake variant).
 *
 * Minimal field-edit fallback shown after the "Not quite" re-extraction
 * loop maxes out: the five extraction fields, editable, one confirm button.
 * V2 inline-styles convention.
 */
import { useState } from "react";

const BRAND_PRIMARY = "#FF5B1D";
const TEXT_COLOR = "#1A1624";
const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";

export interface TweakBoxFields {
  serviceName: string;
  serviceCategory: "coaching" | "speaking" | "consulting";
  serviceDescription: string;
  targetCustomer: string;
  mainBenefit: string;
}

const FIELD_DEFS: { key: keyof Omit<TweakBoxFields, "serviceCategory">; label: string; placeholder: string }[] = [
  { key: "serviceName", label: "What it's called", placeholder: "Your programme or product name" },
  { key: "serviceDescription", label: "What you do", placeholder: "One sentence on what you do" },
  { key: "targetCustomer", label: "Who you help", placeholder: "Who your work is for" },
  { key: "mainBenefit", label: "The result you deliver", placeholder: "The main outcome they get" },
];

const labelStyle: React.CSSProperties = {
  fontFamily: FONT_BODY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: TEXT_COLOR,
  opacity: 0.55,
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #D1D5DB",
  borderRadius: 12,
  padding: "9px 14px",
  fontFamily: FONT_BODY,
  fontSize: 14,
  color: TEXT_COLOR,
  background: "white",
  outline: "none",
};

export default function TweakBox({ initial, onConfirm }: {
  initial: TweakBoxFields;
  onConfirm: (fields: TweakBoxFields) => void;
}) {
  const [fields, setFields] = useState<TweakBoxFields>(initial);

  return (
    <div style={{
      background: "white",
      borderRadius: 16,
      padding: "16px 18px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      borderLeft: `4px solid ${BRAND_PRIMARY}`,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 600,
        color: TEXT_COLOR,
      }}>
        Set me straight — fix any of these:
      </div>

      {FIELD_DEFS.map(def => (
        <div key={def.key}>
          <label style={labelStyle}>{def.label}</label>
          <input
            value={fields[def.key]}
            onChange={e => setFields(f => ({ ...f, [def.key]: e.target.value }))}
            placeholder={def.placeholder}
            style={inputStyle}
          />
        </div>
      ))}

      <div>
        <label style={labelStyle}>How you deliver it</label>
        <select
          value={fields.serviceCategory}
          onChange={e => setFields(f => ({ ...f, serviceCategory: e.target.value as TweakBoxFields["serviceCategory"] }))}
          style={{ ...inputStyle, appearance: "auto" as const, cursor: "pointer" }}
        >
          <option value="coaching">Coaching</option>
          <option value="speaking">Speaking</option>
          <option value="consulting">Consulting</option>
        </select>
      </div>

      <button
        onClick={() => onConfirm(fields)}
        style={{
          alignSelf: "flex-start",
          background: BRAND_PRIMARY,
          color: "white",
          border: "none",
          borderRadius: 9999,
          padding: "10px 26px",
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          marginTop: 2,
        }}
      >
        That's right — use this
      </button>
    </div>
  );
}
