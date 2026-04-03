import { useState } from "react";
import { trpc } from "../../lib/trpc";
import ZappyMascot from "../ZappyMascot";

type Gender = "Male" | "Female" | "Other";

export default function CoachIdentityModal({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [background, setBackground] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateCoachProfile = trpc.user.updateCoachProfile.useMutation();

  const isValid = name.trim().length > 0 && gender !== null && background.trim().length > 0;

  async function handleSubmit() {
    if (!isValid || !gender) return;
    setSaving(true);
    setError("");
    try {
      await updateCoachProfile.mutateAsync({
        coachName: name.trim(),
        coachGender: gender,
        coachBackground: background.trim(),
      });
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const genderOptions: Gender[] = ["Male", "Female", "Other"];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(26,22,36,0.60)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "#F5F1EA",
        borderRadius: "24px",
        padding: "36px 28px 28px",
        maxWidth: "440px",
        width: "100%",
        textAlign: "center",
      }}>
        <ZappyMascot state="waiting" size={90} />

        <h2 style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "24px",
          color: "#1A1624",
          margin: "20px 0 8px",
          lineHeight: 1.2,
        }}>
          Before we build your campaign...
        </h2>
        <p style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: "15px",
          color: "rgba(26,22,36,0.55)",
          margin: "0 0 28px",
          lineHeight: 1.5,
        }}>
          Tell me about you — just once, I promise.
        </p>

        {/* Field 1: First name */}
        <div style={{ marginBottom: "18px", textAlign: "left" }}>
          <label style={{
            display: "block",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "#1A1624",
            marginBottom: "8px",
          }}>
            First name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sarah"
            style={{
              width: "100%",
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: "15px",
              color: "#1A1624",
              background: "#fff",
              border: "1px solid rgba(26,22,36,0.15)",
              borderRadius: "12px",
              padding: "14px 16px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Field 2: Gender pills */}
        <div style={{ marginBottom: "18px", textAlign: "left" }}>
          <label style={{
            display: "block",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "#1A1624",
            marginBottom: "8px",
          }}>
            Gender
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {genderOptions.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: "9999px",
                  border: gender === g ? "2px solid #FF5B1D" : "1px solid rgba(26,22,36,0.15)",
                  background: gender === g ? "rgba(255,91,29,0.10)" : "#fff",
                  color: gender === g ? "#FF5B1D" : "#1A1624",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Field 3: Background */}
        <div style={{ marginBottom: "24px", textAlign: "left" }}>
          <label style={{
            display: "block",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "#1A1624",
            marginBottom: "8px",
          }}>
            One-line background
          </label>
          <input
            type="text"
            value={background}
            onChange={e => setBackground(e.target.value)}
            placeholder="e.g. Former corporate lawyer turned business coach"
            style={{
              width: "100%",
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: "15px",
              color: "#1A1624",
              background: "#fff",
              border: "1px solid rgba(26,22,36,0.15)",
              borderRadius: "12px",
              padding: "14px 16px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {background.length > 0 && background.length < 80 && (
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: "12px", color: "#FF5B1D", marginTop: "4px", margin: "4px 0 0" }}>
              Tip: Add your results and credentials for a stronger bio (aim for 80+ characters)
            </p>
          )}
        </div>

        {error && (
          <div style={{
            background: "rgba(255,91,29,0.08)",
            border: "1px solid rgba(255,91,29,0.25)",
            borderRadius: "12px",
            padding: "10px 14px",
            marginBottom: "16px",
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: "13px",
            color: "#C0390A",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          style={{
            width: "100%",
            padding: "14px 28px",
            borderRadius: "9999px",
            border: "none",
            background: isValid && !saving ? "#FF5B1D" : "rgba(26,22,36,0.15)",
            color: isValid && !saving ? "#fff" : "rgba(26,22,36,0.35)",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            cursor: isValid && !saving ? "pointer" : "not-allowed",
            transition: "all 0.15s ease",
          }}
        >
          {saving ? "Saving..." : "Let's build \u2192"}
        </button>
      </div>
    </div>
  );
}
