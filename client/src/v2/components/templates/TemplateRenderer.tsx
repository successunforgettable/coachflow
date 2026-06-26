/**
 * TemplateRenderer — config-driven React preview of a landing page.
 * Mirrors server-side renderTemplate() but as JSX with React state (FAQ accordion).
 * Every text element carries full inline font-family — no CSS inheritance.
 */
import React, { useState, useEffect, useRef } from "react";
import type { ClientTemplateConfig, LpPageType, SectionKey } from "./templateConfigs";
import { CTA_BY_PAGE_TYPE } from "./templateConfigs";

// ─── Props ──────────────────────────────────────────────────────────────────

interface TemplateRendererProps {
  config: ClientTemplateConfig;
  angleData: Record<string, any>;
  pageType: LpPageType;
  headshot: string | null;
  logo: string | null;
  socialProof: string[];
  coachName?: string;
  coachBackground?: string;
  realTestimonials?: Array<{ name: string; title?: string; quote: string }>;
}

// ─── Helpers (same logic as LandingPageVisualTemplate) ──────────────────────

function ok(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && !v.includes("[Generation incomplete");
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

function txt(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as any;
    if (typeof o.headline === "string" && typeof o.content === "string") return `${o.headline}\n${o.content}`;
    if (typeof o.content === "string") return o.content;
  }
  return String(v ?? "");
}

function hb(v: unknown): { heading: string; body: string[] } | null {
  if (!ok(v)) return null;
  const t = txt(v);
  const lines = t.split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}

function jp<T>(v: unknown, fb: T): T {
  if (!v) return fb;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fb; }
  }
  return v as T;
}

// ─── FAQ Accordion (stateful) ───────────────────────────────────────────────

function FaqAccordion({
  items,
  config,
}: {
  items: Array<{ q: string; a: string }>;
  config: ClientTemplateConfig;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const c = config.colors;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 0",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontFamily: config.headingFont,
                fontWeight: 700,
                fontStyle: "normal",
                fontSize: "18px",
                color: c.textOnLight,
              }}
            >
              {item.q}
            </span>
            <span
              style={{
                fontFamily: config.headingFont,
                fontWeight: 400,
                fontStyle: "normal",
                fontSize: "28px",
                color: c.accent,
                flexShrink: 0,
                marginLeft: "20px",
                lineHeight: 1,
              }}
            >
              {openIdx === i ? "\u2212" : "+"}
            </span>
          </button>
          {openIdx === i && (
            <div style={{ paddingBottom: "20px" }}>
              <p
                style={{
                  fontFamily: config.bodyFont,
                  fontWeight: 400,
                  fontStyle: "normal",
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: c.bodyOnLight,
                  margin: 0,
                }}
              >
                {item.a}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TemplateRenderer(props: TemplateRendererProps) {
  const { config, angleData: content, pageType, headshot, logo, socialProof, coachName, coachBackground } = props;
  const c = config.colors;
  const layout = config.sectionMap[pageType];
  const gradient = config.ctaGradient ?? `linear-gradient(90deg, ${c.accent} 35%, ${c.dark} 100%)`;

  // ─── Font loading via <link> injection ──────────────────────────────────
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    [config.headingFontUrl, config.bodyFontUrl].filter(Boolean).forEach((url) => {
      // Skip if already loaded
      if (document.querySelector(`link[href="${url}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => {
      links.forEach((link) => {
        try { document.head.removeChild(link); } catch { /* already removed */ }
      });
    };
  }, [config.headingFontUrl, config.bodyFontUrl]);

  // ─── Content parsing (done once) ────────────────────────────────────────

  const testimonials: Array<{ headline?: string; quote?: string; name?: string; location?: string }> =
    props.realTestimonials && props.realTestimonials.length > 0
      ? props.realTestimonials.map((t) => ({ quote: t.quote, name: t.name, location: t.title || "" }))
      : jp<Array<{ headline?: string; quote?: string; name?: string; location?: string }>>(content.testimonials, []);

  const outline = jp<Array<{ title?: string; description?: string }>>(content.consultationOutline, []);
  const faqRaw = jp<Array<{ question?: string; answer?: string; q?: string; a?: string }>>(content.faq, []);
  const faqItems = faqRaw.map((f) => ({ q: f.question || f.q || "", a: f.answer || f.a || "" })).filter((f) => f.q);
  const asSeenIn = Array.isArray(content.asSeenIn) ? content.asSeenIn : [];
  const guarantee = content.guarantee;

  // ─── CTA index tracking ──────────────────────────────────────────────────
  const ctaIdxRef = useRef(0);
  // Reset on each render
  ctaIdxRef.current = 0;

  function ctaLabel(): string {
    const idx = ctaIdxRef.current;
    ctaIdxRef.current++;
    if (ok(content.primaryCta) && idx === 0) return content.primaryCta;
    const pool = CTA_BY_PAGE_TYPE[pageType];
    return pool[idx % pool.length] || pool[0];
  }

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const inner: React.CSSProperties = { maxWidth: config.maxWidth, margin: "0 auto", padding: "0 24px", width: "100%" };

  // ─── Reusable sub-components ────────────────────────────────────────────

  function CtaButton({ dark = true }: { dark?: boolean }) {
    const text = ctaLabel();
    return (
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <button
          style={{
            fontFamily: config.headingFont,
            fontWeight: 700,
            fontStyle: "normal",
            fontSize: "20px",
            background: gradient,
            color: "#fff",
            border: "none",
            borderRadius: config.buttonRadius,
            padding: "18px 48px",
            cursor: "pointer",
            display: "inline-block",
            maxWidth: "100%",
            transition: "transform 150ms",
            lineHeight: 1.3,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.04)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
        >
          {text}
        </button>
      </div>
    );
  }

  function BulletCheck({ text, bodyColor }: { text: string; bodyColor: string }) {
    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }}>
        <span style={{ fontFamily: config.headingFont, color: c.accent, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.5 }}>
          {"\u2713"}
        </span>
        <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: bodyColor, margin: 0 }}>
          {text}
        </p>
      </div>
    );
  }

  function BulletX({ text, bodyColor }: { text: string; bodyColor: string }) {
    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }}>
        <span style={{ fontFamily: config.headingFont, color: c.danger, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.5 }}>
          {"\u2715"}
        </span>
        <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: bodyColor, margin: 0 }}>
          {text}
        </p>
      </div>
    );
  }

  function Heading2({ text, color, align = "left" }: { text: string; color: string; align?: "left" | "center" }) {
    return (
      <h2
        style={{
          fontFamily: config.headingFont,
          fontWeight: 700,
          fontStyle: "normal",
          fontSize: "clamp(28px, 3.5vw, 42px)",
          letterSpacing: config.headingLetterSpacing,
          lineHeight: config.headingLineHeight,
          color,
          margin: "0 0 24px",
          textAlign: align,
        }}
      >
        {text}
      </h2>
    );
  }

  function BodyPara({ text, color }: { text: string; color: string }) {
    return (
      <p
        style={{
          fontFamily: config.bodyFont,
          fontWeight: 400,
          fontStyle: "normal",
          fontSize: "18px",
          lineHeight: config.bodyLineHeight,
          color,
          margin: "0 0 14px",
        }}
      >
        {text}
      </p>
    );
  }

  // ─── Type-specific strips ──────────────────────────────────────────────

  function EventStrip() {
    return (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        {[
          { icon: "\uD83D\uDCC5", label: "DATE", value: "See registration" },
          { icon: "\u23F0", label: "TIME", value: "Live session" },
          { icon: "\uD83D\uDCBB", label: "LIVE", value: "On Zoom" },
        ].map((d, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: config.buttonRadius, padding: "12px 16px", textAlign: "center", minWidth: "100px" }}>
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>{d.icon}</div>
            <p style={{ fontFamily: config.bodyFont, fontWeight: 600, fontStyle: "normal", fontSize: "11px", color: c.accent, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>{d.label}</p>
            <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: c.bodyOnDark, margin: 0 }}>{d.value}</p>
          </div>
        ))}
      </div>
    );
  }

  function DownloadBadge() {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: config.buttonRadius, padding: "12px 20px", marginBottom: "24px" }}>
        <span style={{ fontSize: "24px" }}>{"\uD83D\uDCE5"}</span>
        <span style={{ fontFamily: config.bodyFont, fontWeight: 600, fontStyle: "normal", fontSize: "14px", color: c.textOnDark }}>Instant Download</span>
      </div>
    );
  }

  function BookingCue() {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: config.buttonRadius, padding: "12px 20px", marginBottom: "24px" }}>
        <span style={{ fontSize: "24px" }}>{"\uD83D\uDCC6"}</span>
        <span style={{ fontFamily: config.bodyFont, fontWeight: 600, fontStyle: "normal", fontSize: "14px", color: c.textOnDark }}>Book Your Free Call</span>
      </div>
    );
  }

  // ─── Section renderers ──────────────────────────────────────────────────

  const renderers: Record<SectionKey, () => React.ReactNode> = {
    hero() {
      if (!ok(content.eyebrowHeadline) && !ok(content.mainHeadline)) return null;
      const ts = layout.typeSpecificSections ?? {};
      const useSplit = layout.heroLayout === "split" && headshot;

      return (
        <section style={{ background: c.dark, padding: config.sectionPadding }}>
          <div style={{ ...inner, display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: useSplit ? "1 1 55%" : "1 1 100%", minWidth: "300px", textAlign: useSplit ? undefined : "center" }}>
              {logo && <img src={logo} alt="Logo" style={{ height: "50px", objectFit: "contain", marginBottom: "24px" }} />}
              {ok(content.eyebrowHeadline) && (
                <p style={{ fontFamily: config.bodyFont, color: c.accent, fontSize: "14px", fontWeight: 600, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
                  {content.eyebrowHeadline}
                </p>
              )}
              {ok(content.mainHeadline) && (
                <h1 style={{ fontFamily: config.headingFont, fontSize: "clamp(24px, 3.5vw, 42px)", fontWeight: 700, fontStyle: "normal", lineHeight: config.headingLineHeight, letterSpacing: config.headingLetterSpacing, color: c.textOnDark, margin: "0 0 20px" }}>
                  {content.mainHeadline}
                </h1>
              )}
              {ok(content.subheadline) && (
                <p style={{ fontFamily: config.bodyFont, fontSize: "18px", fontWeight: 400, fontStyle: "normal", color: c.bodyOnDark, margin: "0 0 28px", lineHeight: config.bodyLineHeight }}>
                  {content.subheadline}
                </p>
              )}
              {ts.eventStrip && <EventStrip />}
              {ts.downloadBadge && <DownloadBadge />}
              {ts.bookingCue && <BookingCue />}
              <CtaButton />
            </div>
            {useSplit && headshot && (
              <div style={{ flex: "0 1 40%", minWidth: "260px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <img src={headshot} alt={coachName || "Coach"} style={{ width: "100%", maxWidth: "420px", maxHeight: "500px", borderRadius: config.cardRadius, objectFit: "cover", border: `6px solid ${c.accent}` }} />
              </div>
            )}
          </div>
        </section>
      );
    },

    asSeenIn() {
      if (asSeenIn.length === 0) return null;
      return (
        <section style={{ background: c.white, padding: "40px 0", borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
          <div style={{ ...inner, textAlign: "center" }}>
            <p style={{ fontFamily: config.bodyFont, fontSize: "12px", fontWeight: 700, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.1em", color: c.muted, marginBottom: "20px" }}>
              As Seen In
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
              {asSeenIn.map((s, i) => (
                <span key={i} style={{ fontFamily: config.bodyFont, color: c.muted, fontWeight: 600, fontSize: "16px", fontStyle: "normal" }}>{s}</span>
              ))}
            </div>
          </div>
        </section>
      );
    },

    quiz() {
      const q = jp<any>(content.quizSection, null);
      if (!q || !ok(q.question) || !Array.isArray(q.options) || q.options.length === 0) return null;
      return (
        <section style={{ background: c.light, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={q.question} color={c.textOnLight} align="center" />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "700px", margin: "0 auto" }}>
              {q.options.map((opt: string, i: number) => (
                <div key={i} style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontFamily: config.headingFont, fontWeight: 700, fontStyle: "normal", fontSize: "18px", color: c.accent, flexShrink: 0 }}>{String.fromCharCode(65 + i)}.</span>
                  <span style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "16px", color: c.bodyOnLight }}>{opt}</span>
                </div>
              ))}
            </div>
            {ok(q.answer) && (
              <div style={{ marginTop: "24px", maxWidth: "700px", marginLeft: "auto", marginRight: "auto", background: `${c.accent}11`, border: `1px solid ${c.accent}`, borderRadius: "10px", padding: "20px" }}>
                <p style={{ fontFamily: config.bodyFont, fontWeight: 600, fontStyle: "normal", fontSize: "15px", color: c.accent, margin: "0 0 8px" }}>The Answer:</p>
                <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "15px", lineHeight: 1.7, color: c.textOnLight, margin: 0 }}>{q.answer}</p>
              </div>
            )}
          </div>
        </section>
      );
    },

    problemAgitation() {
      const prob = hb(content.problemAgitation);
      if (!prob) return null;
      return (
        <section style={{ background: c.light, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={prob.heading} color={c.textOnLight} />
            {prob.body.map((p, i) => <BulletCheck key={i} text={p} bodyColor={c.bodyOnLight} />)}
          </div>
        </section>
      );
    },

    solutionIntro() {
      const sol = hb(content.solutionIntro);
      if (!sol) return null;
      return (
        <section style={{ background: c.light, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={sol.heading} color={c.textOnLight} />
            {sol.body.map((p, i) => <BulletCheck key={i} text={p} bodyColor={c.bodyOnLight} />)}
          </div>
        </section>
      );
    },

    whyOldFail() {
      const why = hb(content.whyOldFail);
      if (!why) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={why.heading} color={c.textOnLight} />
            {why.body.map((p, i) => <BulletX key={i} text={p} bodyColor={c.bodyOnLight} />)}
          </div>
        </section>
      );
    },

    uniqueMechanism() {
      const uniq = hb(content.uniqueMechanism);
      if (!uniq) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={uniq.heading} color={c.textOnLight} />
            <div style={{ width: "80px", height: "3px", background: c.accent, margin: "0 0 24px" }} />
            {uniq.body.map((p, i) => <BodyPara key={i} text={p} color={c.bodyOnLight} />)}
            <CtaButton dark={false} />
          </div>
        </section>
      );
    },

    testimonials() {
      if (testimonials.length === 0) return null;
      const cardStyle = config.decorative.testimonialCardStyle;
      const cardExtra: React.CSSProperties =
        cardStyle === "bordered" ? { border: `1px solid ${c.border}` } :
        cardStyle === "shadow" ? { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } :
        cardStyle === "glass" ? { background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)" } :
        {};
      const cardBg = cardStyle === "glass" ? undefined : c.white;

      return (
        <section style={{ background: c.light, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text="What Our Clients Say" color={c.textOnLight} align="center" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              {testimonials.map((tm, i) => (
                <div key={i} style={{ background: cardBg, borderRadius: config.cardRadius, padding: "30px 25px", ...cardExtra }}>
                  {tm.headline && <h3 style={{ fontFamily: config.headingFont, color: c.accent, fontSize: "20px", fontWeight: 700, fontStyle: "normal", margin: "0 0 12px" }}>{tm.headline}</h3>}
                  {tm.quote && <p style={{ fontFamily: config.bodyFont, color: c.bodyOnLight, fontStyle: "italic", fontSize: "16px", fontWeight: 400, lineHeight: 1.6, margin: "0 0 16px" }}>"{tm.quote}"</p>}
                  <p style={{ fontFamily: config.headingFont, fontWeight: 700, fontStyle: "normal", fontSize: "15px", color: c.textOnLight, margin: "0 0 2px" }}>{tm.name ?? ""}</p>
                  <p style={{ fontFamily: config.bodyFont, fontSize: "13px", fontWeight: 400, fontStyle: "normal", color: c.muted, margin: 0 }}>{tm.location ?? ""}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    },

    insiderAdvantages() {
      const adv = hb(content.insiderAdvantages);
      if (!adv) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={adv.heading} color={c.textOnLight} />
            {adv.body.map((p, i) => <BulletCheck key={i} text={p} bodyColor={c.bodyOnLight} />)}
          </div>
        </section>
      );
    },

    scarcityUrgency() {
      const scar = hb(content.scarcityUrgency);
      if (!scar) return null;
      return (
        <section style={{ background: c.light, padding: config.sectionPadding }}>
          <div style={inner}>
            <div style={{ border: `3px solid ${c.accent}`, borderRadius: config.cardRadius, padding: "40px 32px" }}>
              <Heading2 text={scar.heading} color={c.accent} align="center" />
              {scar.body.map((p, i) => <BodyPara key={i} text={p} color={c.bodyOnLight} />)}
            </div>
          </div>
        </section>
      );
    },

    shockingStat() {
      if (!ok(content.shockingStat)) return null;
      const statText = txt(content.shockingStat);
      const bigNum = statText.match(/[\d,]+[%x+]?/)?.[0] ?? "";
      return (
        <section style={{ background: c.white, padding: config.sectionPadding, textAlign: "center" }}>
          <div style={inner}>
            {bigNum && (
              <div style={{ fontFamily: config.headingFont, fontSize: "clamp(48px, 10vw, 80px)", fontWeight: 700, fontStyle: "normal", color: c.accent, margin: "0 0 12px", lineHeight: 1 }}>
                {bigNum}
              </div>
            )}
            <p style={{ fontFamily: config.bodyFont, fontSize: "20px", fontWeight: 400, fontStyle: "normal", color: c.bodyOnLight, maxWidth: "700px", margin: "0 auto", lineHeight: 1.6 }}>
              {statText}
            </p>
          </div>
        </section>
      );
    },

    timeSavingBenefit() {
      const tsb = hb(content.timeSavingBenefit);
      if (!tsb) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={tsb.heading} color={c.textOnLight} />
            {tsb.body.map((p, i) => <BodyPara key={i} text={p} color={c.bodyOnLight} />)}
          </div>
        </section>
      );
    },

    consultationOutline() {
      if (outline.length === 0) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text="What You'll Get" color={c.textOnLight} align="center" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              {outline.map((item, i) => (
                <div key={i} style={{ background: c.light, borderRadius: config.cardRadius, padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: "40px", height: "40px", background: c.accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: config.headingFont, fontWeight: 700, fontStyle: "normal", fontSize: "16px", color: "#fff" }}>{i + 1}</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: config.headingFont, fontSize: "18px", fontWeight: 700, fontStyle: "normal", color: c.textOnLight, margin: "0 0 6px" }}>{item.title ?? ""}</h3>
                    <p style={{ fontFamily: config.bodyFont, color: c.bodyOnLight, margin: 0, lineHeight: 1.5, fontSize: "15px", fontWeight: 400, fontStyle: "normal" }}>{item.description ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    },

    guarantee() {
      if (!ok(guarantee)) return null;
      const g = hb(guarantee);
      if (!g) return null;
      return (
        <section style={{ background: c.dark, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text={g.heading} color={c.textOnDark} align="center" />
            {g.body.map((p, i) => <BodyPara key={i} text={p} color={c.bodyOnDark} />)}
          </div>
        </section>
      );
    },

    faq() {
      if (faqItems.length === 0) return null;
      return (
        <section style={{ background: c.white, padding: config.sectionPadding }}>
          <div style={{ ...inner, maxWidth: "900px" }}>
            <Heading2 text="Frequently Asked Questions" color={c.textOnLight} align="center" />
            <FaqAccordion items={faqItems} config={config} />
          </div>
        </section>
      );
    },

    coachAuthority() {
      if (!headshot && !coachName) return null;
      const bioText = coachBackground && coachBackground.trim().length > 10 ? coachBackground.trim() : "";
      return (
        <section style={{ background: c.dark, padding: config.sectionPadding }}>
          <div style={{ ...inner, display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "center" }}>
            {headshot && (
              <div style={{ flex: "0 1 40%", minWidth: "260px" }}>
                <img src={headshot} alt={coachName || "Coach"} style={{ width: "100%", maxWidth: "400px", borderRadius: config.cardRadius, objectFit: "cover", border: `4px solid ${c.accent}` }} />
              </div>
            )}
            <div style={{ flex: "1 1 50%", minWidth: "280px" }}>
              {coachName && (
                <h2 style={{ fontFamily: config.headingFont, fontWeight: 700, fontStyle: "normal", fontSize: "42px", letterSpacing: config.headingLetterSpacing, lineHeight: config.headingLineHeight, color: c.textOnDark, margin: "0 0 16px", textTransform: "uppercase" }}>
                  {coachName}
                </h2>
              )}
              {bioText && <BodyPara text={bioText} color={c.bodyOnDark} />}
              <CtaButton />
            </div>
          </div>
        </section>
      );
    },

    socialProofGallery() {
      if (socialProof.length === 0) return null;
      return (
        <section style={{ background: c.dark, padding: config.sectionPadding }}>
          <div style={inner}>
            <Heading2 text="Results Our Clients Get" color={c.textOnDark} align="center" />
            <div style={{ display: "flex", flexWrap: "nowrap", gap: "16px", overflowX: "auto", paddingBottom: "16px", WebkitOverflowScrolling: "touch" }}>
              {socialProof.map((url, i) => (
                <img key={i} src={url} alt="" style={{ height: "300px", width: "auto", minWidth: "200px", flexShrink: 0, objectFit: "cover", borderRadius: "8px" }} />
              ))}
            </div>
          </div>
        </section>
      );
    },

    gradientCta() {
      return (
        <section style={{ background: gradient, padding: "40px 0", textAlign: "center" }}>
          <div style={inner}>
            <CtaButton />
          </div>
        </section>
      );
    },

    finalCta() {
      const headline = ok(content.mainHeadline) ? String(content.mainHeadline) : "Ready to Get Started?";
      const sub = ok(content.subheadline) ? String(content.subheadline) : "Take the first step today.";
      return (
        <section style={{ background: c.dark, padding: "80px 0" }}>
          <div style={{ ...inner, textAlign: "center" }}>
            <h2 style={{ fontFamily: config.headingFont, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(24px, 3.5vw, 36px)", letterSpacing: config.headingLetterSpacing, lineHeight: config.headingLineHeight, color: c.textOnDark, margin: "0 0 20px" }}>
              {headline}
            </h2>
            <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "17px", color: c.bodyOnDark, margin: "0 auto 32px", maxWidth: "650px", lineHeight: config.bodyLineHeight }}>
              {sub}
            </p>
            <CtaButton />
          </div>
        </section>
      );
    },
  };

  // ─── Assemble sections in layout order ─────────────────────────────────

  const sections: React.ReactNode[] = [];
  for (const key of layout.order) {
    try {
      const renderer = renderers[key];
      if (!renderer) continue;
      const node = renderer();
      if (node) sections.push(<React.Fragment key={key}>{node}</React.Fragment>);
    } catch {
      // skip broken section silently
    }
  }

  // ─── Nav ──────────────────────────────────────────────────────────────

  const navBg = config.navStyle === "light"
    ? { background: c.white, borderBottom: `1px solid ${c.border}` }
    : config.navStyle === "transparent"
    ? { background: "transparent" }
    : { background: c.dark, borderBottom: `1px solid ${c.border}` };
  const navTextColor = config.navStyle === "light" ? c.textOnLight : c.textOnDark;

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", width: "100%" }}>
      {/* Nav */}
      <nav style={{ ...navBg, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        {logo
          ? <img src={logo} alt="" style={{ height: "40px", objectFit: "contain", verticalAlign: "middle" }} />
          : <span />}
        {ok(content.primaryCta) && (
          <a href="#" style={{ fontFamily: config.headingFont, fontSize: "13px", fontWeight: 700, fontStyle: "normal", color: "#fff", background: c.accent, padding: "10px 22px", borderRadius: config.buttonRadius, textDecoration: "none" }}>
            {content.primaryCta}
          </a>
        )}
      </nav>

      {/* Sections */}
      {sections}

      {/* Footer */}
      <footer style={{ background: c.dark, borderTop: `1px solid ${c.border}`, padding: "24px 48px", textAlign: "center" }}>
        <p style={{ fontFamily: config.bodyFont, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: c.muted, margin: 0 }}>
          {coachName ? `\u00A9 ${new Date().getFullYear()} ${coachName}. All rights reserved.` : `\u00A9 ${new Date().getFullYear()} All rights reserved.`}
        </p>
      </footer>
    </div>
  );
}
