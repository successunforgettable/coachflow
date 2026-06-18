/**
 * TestimonialPicker — library view + add form + select-for-campaign.
 *
 * Two modes:
 *   standalone: add/delete only (reachable from dashboard/kit page)
 *   campaign:   add/delete + select up to 3 + "Use these" / "Skip" (trail intake)
 *
 * Real testimonials only — nothing auto-generated. Quotes flow verbatim
 * through the services.testimonial1-3 columns to all 5 generators.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface TestimonialPickerProps {
  serviceId?: number;
  /** campaign mode: shows select + Use/Skip. standalone: add/delete only */
  mode: "campaign" | "standalone";
  /** Fires when user taps "Use these" or "Skip" in campaign mode */
  onDone?: (action: "use" | "skip") => void;
}

export default function TestimonialPicker({ serviceId, mode, onDone }: TestimonialPickerProps) {
  const utils = trpc.useUtils();
  const library = trpc.testimonials.list.useQuery();
  const addMutation = trpc.testimonials.add.useMutation({
    onSuccess: () => utils.testimonials.list.invalidate(),
  });
  const deleteMutation = trpc.testimonials.delete.useMutation({
    onSuccess: () => utils.testimonials.list.invalidate(),
  });
  const activateMutation = trpc.testimonials.activateForService.useMutation();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formQuote, setFormQuote] = useState("");
  const [saving, setSaving] = useState(false);

  const items = library.data ?? [];

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 3) { next.add(id); }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formQuote.trim()) return;
    setSaving(true);
    try {
      const added = await addMutation.mutateAsync({
        name: formName.trim(),
        title: formTitle.trim() || undefined,
        quote: formQuote.trim(),
        serviceId: serviceId ?? undefined,
      });
      if (mode === "campaign" && selected.size < 3 && added) {
        setSelected(prev => { const n = new Set(Array.from(prev)); n.add(added.id); return n; });
      }
      setFormName(""); setFormTitle(""); setFormQuote("");
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    await deleteMutation.mutateAsync({ id });
  };

  const handleUse = async () => {
    if (!serviceId) return;
    setSaving(true);
    try {
      await activateMutation.mutateAsync({
        serviceId,
        testimonialIds: Array.from(selected),
      });
      onDone?.("use");
    } finally { setSaving(false); }
  };

  const handleSkip = async () => {
    if (serviceId) {
      await activateMutation.mutateAsync({ serviceId, testimonialIds: [] });
    }
    onDone?.("skip");
  };

  const S: Record<string, React.CSSProperties> = {
    wrap: { display: "flex", flexDirection: "column", gap: 12, padding: "4px 0", maxWidth: 520 },
    card: {
      display: "flex", gap: 12, padding: "14px 16px", borderRadius: 12,
      background: "#fff", border: "1.5px solid #e5e7eb", cursor: "pointer",
      transition: "border-color 0.15s",
    },
    cardSelected: { borderColor: "#FF5B1D", background: "#FFF7F5" },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, border: "2px solid #d1d5db",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      marginTop: 2,
    },
    checkboxOn: { background: "#FF5B1D", borderColor: "#FF5B1D", color: "#fff" },
    quote: { fontFamily: "Instrument Sans, sans-serif", fontSize: 14, fontStyle: "italic", color: "#374151", lineHeight: 1.5, margin: 0 },
    name: { fontFamily: "Instrument Sans, sans-serif", fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 },
    title: { fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#6b7280", margin: 0 },
    btn: {
      background: "#FF5B1D", color: "#fff", border: "none", borderRadius: 9999,
      padding: "10px 28px", cursor: "pointer", fontFamily: "Instrument Sans, sans-serif",
      fontWeight: 600, fontSize: 14,
    },
    btnOutline: {
      background: "transparent", color: "#6b7280", border: "1.5px solid #d1d5db",
      borderRadius: 9999, padding: "10px 28px", cursor: "pointer",
      fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 14,
    },
    input: {
      fontFamily: "Instrument Sans, sans-serif", fontSize: 14, padding: "10px 14px",
      borderRadius: 10, border: "1.5px solid #d1d5db", width: "100%", boxSizing: "border-box" as const,
    },
    textarea: {
      fontFamily: "Instrument Sans, sans-serif", fontSize: 14, padding: "10px 14px",
      borderRadius: 10, border: "1.5px solid #d1d5db", width: "100%", boxSizing: "border-box" as const,
      minHeight: 80, resize: "vertical" as const,
    },
    deleteBtn: {
      background: "none", border: "none", color: "#9ca3af", cursor: "pointer",
      fontSize: 16, padding: "2px 6px", lineHeight: 1,
    },
  };

  return (
    <div style={S.wrap}>
      {/* Library cards */}
      {items.map(t => {
        const isOn = selected.has(t.id);
        return (
          <div
            key={t.id}
            style={{ ...S.card, ...(isOn ? S.cardSelected : {}) }}
            onClick={mode === "campaign" ? () => toggleSelect(t.id) : undefined}
          >
            {mode === "campaign" && (
              <div style={{ ...S.checkbox, ...(isOn ? S.checkboxOn : {}) }}>
                {isOn && <span style={{ fontSize: 14 }}>&#10003;</span>}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <p style={S.quote}>"{t.quote}"</p>
              <p style={{ ...S.name, marginTop: 6 }}>{t.name}</p>
              {t.title && <p style={S.title}>{t.title}</p>}
            </div>
            <button
              style={S.deleteBtn}
              title="Remove"
              onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
            >
              &times;
            </button>
          </div>
        );
      })}

      {items.length === 0 && !showForm && (
        <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 14, color: "#6b7280", margin: 0 }}>
          No testimonials yet. Add your first one below.
        </p>
      )}

      {/* Add form */}
      {showForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", background: "#f9fafb", borderRadius: 12 }}>
          <input
            style={S.input}
            placeholder="Client name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
          />
          <input
            style={S.input}
            placeholder="Title / background (optional)"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
          />
          <div style={{ position: "relative" }}>
            <textarea
              style={S.textarea}
              placeholder="Their testimonial — paste their real words"
              value={formQuote}
              onChange={e => setFormQuote(e.target.value.slice(0, 1000))}
              maxLength={1000}
            />
            <span style={{
              position: "absolute", bottom: 8, right: 12,
              fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#9ca3af",
            }}>
              {formQuote.length}/1000
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn} onClick={handleAdd} disabled={saving || !formName.trim() || !formQuote.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button style={S.btnOutline} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          style={{ ...S.btnOutline, alignSelf: "flex-start" }}
          onClick={() => setShowForm(true)}
        >
          + Add testimonial
        </button>
      )}

      {/* Campaign mode: Use / Skip actions */}
      {mode === "campaign" && (
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            style={{ ...S.btn, opacity: selected.size === 0 && items.length > 0 ? 0.5 : 1 }}
            onClick={handleUse}
            disabled={saving || (selected.size === 0 && items.length > 0)}
          >
            {saving ? "Saving..." : `Use ${selected.size > 0 ? `these ${selected.size}` : "selected"}`}
          </button>
          <button style={S.btnOutline} onClick={handleSkip}>
            Skip — I don't have testimonials
          </button>
        </div>
      )}

      {mode === "campaign" && selected.size > 0 && (
        <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#6b7280", margin: 0 }}>
          {selected.size} of 3 slots used. These will appear in your landing page, emails, and ads.
        </p>
      )}
    </div>
  );
}
