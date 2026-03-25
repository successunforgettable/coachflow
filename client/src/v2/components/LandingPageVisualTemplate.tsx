/**
 * LandingPageVisualTemplate — full coaching landing page matching Arfeen's HTML reference.
 * Alternating dark/light sections. 2-column hero with coach photo. Orange gradient CTAs.
 * Interactive FAQ accordion. 1170px max content width. 7 CTA placements.
 * Every text element has full inline font stack — no CSS inheritance.
 */
import { useState } from "react";

interface AngleContent {
  eyebrowHeadline?: string; mainHeadline?: string; subheadline?: string; primaryCta?: string;
  asSeenIn?: string[]; quizSection?: any; problemAgitation?: any; solutionIntro?: any;
  whyOldFail?: any; uniqueMechanism?: any; testimonials?: any; insiderAdvantages?: any;
  scarcityUrgency?: any; shockingStat?: any; timeSavingBenefit?: any; consultationOutline?: any;
  faq?: any; [key: string]: any;
}

interface VisualTemplateProps {
  angleData: AngleContent;
  headshot: string | null;
  logo: string | null;
  socialProof: string[];
  coachName?: string;
  coachBackground?: string;
  serviceDescription?: string;
  primaryColor?: string;
  hvcoType?: string;
  campaignType?: string;
  offerAngle?: string;
}

// ─── Design tokens from reference page ─────────────────────────────────────
const DARK = "#000000";
const LIGHT = "#f6f6f6";
const WHITE = "#ffffff";
const TEXT_DARK = "#ffffff";
const TEXT_LIGHT = "#000000";
const BODY_DARK = "#cccccc";
const BODY_LIGHT = "#333333";
const MUTED = "#999999";
const MAX_W = "1170px";
const H_FONT = "Arial, Helvetica, sans-serif";
const B_FONT = "'Montserrat', Arial, sans-serif";
const BTN_RADIUS = "8px";

// ─── Helpers ────────────────────────────────────────────────────────────────
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
  const t = txt(v); const lines = t.split("\n").filter(l => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}
function jp<T>(v: unknown, fb: T): T {
  if (!v) return fb;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return fb; } }
  return v as T;
}

// ─── CTA text ───────────────────────────────────────────────────────────────
const CTA_PROGRESSION = [
  "Register Now", "I'm Ready — Let's Go", "Start Building Today",
  "Reserve Your Spot", "Yes — I Want This", "Begin Your Journey", "Get Started Now"
];
function ctaText(props: VisualTemplateProps, idx: number): string {
  if (ok(props.angleData.primaryCta) && idx === 0) return props.angleData.primaryCta!;
  const h = (props.hvcoType || "").toLowerCase();
  const c = (props.campaignType || "").toLowerCase();
  if (h.includes("webinar") || c.includes("webinar")) {
    return ["Register Now", "Save My Seat", "I'm Ready to Join", "Reserve Your Spot", "Yes — Count Me In", "Secure My Place", "Register Free"][idx] || "Register Now";
  }
  if (h.includes("pdf") || h.includes("guide") || h.includes("checklist")) {
    return ["Download Free", "Get My Copy", "Send It To Me", "Yes — I Want This", "Download Now", "Get Instant Access", "Claim Your Free Copy"][idx] || "Download Free";
  }
  if (h.includes("discovery") || h.includes("call")) {
    return ["Book Your Free Call", "Schedule Now", "Let's Talk", "Book My Session", "Yes — I'm Ready", "Claim Your Spot", "Book Now"][idx] || "Book Your Free Call";
  }
  return CTA_PROGRESSION[idx] || "Get Started Now";
}

// ─── FAQ Accordion ──────────────────────────────────────────────────────────
function FaqAccordion({ items, accent }: { items: Array<{ q: string; a: string }>; accent: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: `1px solid #e0e0e0` }}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "20px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "18px", color: TEXT_LIGHT }}>{item.q}</span>
            <span style={{ fontFamily: H_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "28px", color: accent, flexShrink: 0, marginLeft: "20px", lineHeight: 1 }}>
              {openIdx === i ? "−" : "+"}
            </span>
          </button>
          {openIdx === i && (
            <div style={{ paddingBottom: "20px" }}>
              <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "16px", lineHeight: 1.6, color: BODY_LIGHT, margin: 0 }}>{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Template ──────────────────────────────────────────────────────────
export default function LandingPageVisualTemplate(props: VisualTemplateProps) {
  const { angleData: c, headshot, logo, socialProof, coachName, coachBackground, serviceDescription, primaryColor = "#FE4500" } = props;
  // Use serviceDescription as fallback if coachBackground is too short
  const bioText = coachBackground && coachBackground.length > 50 ? coachBackground : serviceDescription || coachBackground || "";
  const A = primaryColor;
  const gradient = `linear-gradient(90deg, ${A} 35%, #000 100%)`;
  let ctaIdx = 0;

  const testimonials = jp<Array<{ headline?: string; quote?: string; name?: string; location?: string }>>(c.testimonials, []);
  const outline = jp<Array<{ title?: string; description?: string }>>(c.consultationOutline, []);
  const faqRaw = jp<Array<{ question?: string; answer?: string; q?: string; a?: string }>>(c.faq, []);
  const faqItems = faqRaw.map(f => ({ q: f.question || f.q || "", a: f.answer || f.a || "" })).filter(f => f.q);

  // Conditional flags
  const ht = (props.hvcoType || "").toLowerCase();
  const ct = (props.campaignType || "").toLowerCase();
  const isWebinar = ht.includes("webinar") || ct.includes("webinar");
  const isChallenge = ht.includes("challenge") || ct.includes("challenge");

  // Styles
  const inner: React.CSSProperties = { maxWidth: MAX_W, margin: "0 auto", padding: "0 24px", width: "100%" };
  const sectionPad = "60px";

  function CtaButton({ dark = true }: { dark?: boolean }) {
    const idx = ctaIdx; ctaIdx++;
    const text = ctaText(props, idx);
    return (
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <button style={{
          fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "20px",
          background: gradient, color: "#fff", border: "none", borderRadius: BTN_RADIUS,
          padding: "18px 48px", cursor: "pointer", display: "inline-block", maxWidth: "100%",
          transition: "transform 150ms", lineHeight: 1.3,
        }}
          onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.04)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
        >{text}</button>
      </div>
    );
  }

  function BulletPoint({ text, dark = false }: { text: string; dark?: boolean }) {
    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }}>
        <span style={{ fontFamily: H_FONT, color: A, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.5 }}>✓</span>
        <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: dark ? BODY_DARK : BODY_LIGHT, margin: 0 }}>{text}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ background: WHITE, minHeight: "100vh", width: "100%" }}>

        {/* ═══ SECTION 1: HERO (DARK) ═══ */}
        {(() => { try { return (ok(c.eyebrowHeadline) || ok(c.mainHeadline)) ? (
          <section style={{ background: DARK, padding: `${sectionPad} 0 ${sectionPad}`, width: "100%" }}>
            <div style={{ ...inner, display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Left column — text */}
              <div style={{ flex: "1 1 55%", minWidth: "300px" }}>
                {logo && <img src={logo} alt="Logo" style={{ height: "50px", objectFit: "contain", marginBottom: "24px" }} />}
                {ok(c.eyebrowHeadline) && (
                  <p style={{ fontFamily: B_FONT, color: A, fontSize: "14px", fontWeight: 600, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>{c.eyebrowHeadline}</p>
                )}
                {ok(c.mainHeadline) && (
                  <h1 style={{ fontFamily: H_FONT, fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, fontStyle: "normal", lineHeight: 1.2, color: TEXT_DARK, margin: "0 0 20px" }}>{c.mainHeadline}</h1>
                )}
                {ok(c.subheadline) && (
                  <p style={{ fontFamily: B_FONT, fontSize: "18px", fontWeight: 400, fontStyle: "normal", color: BODY_DARK, margin: "0 0 28px", lineHeight: 1.6 }}>{c.subheadline}</p>
                )}

                {/* Event details strip — webinar/challenge only */}
                {(isWebinar || isChallenge) && (
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
                    {[
                      { icon: "📅", label: "DATE", value: "See registration" },
                      { icon: "⏰", label: "TIME", value: "Live session" },
                      { icon: "💻", label: "LIVE", value: isWebinar ? "On Zoom" : "Daily" },
                    ].map((d, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "12px 16px", textAlign: "center", minWidth: "100px" }}>
                        <div style={{ fontSize: "22px", marginBottom: "4px" }}>{d.icon}</div>
                        <p style={{ fontFamily: B_FONT, fontWeight: 600, fontStyle: "normal", fontSize: "11px", color: A, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>{d.label}</p>
                        <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: BODY_DARK, margin: 0 }}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <CtaButton />
              </div>
              {/* Right column — coach photo */}
              {headshot && (
                <div style={{ flex: "0 1 40%", minWidth: "260px", display: "flex", justifyContent: "center" }}>
                  <img src={headshot} alt="Coach" style={{
                    width: "100%", maxWidth: "420px", borderRadius: "12px", objectFit: "cover",
                    border: "6px solid #c9d1d9", maxHeight: "500px",
                  }} />
                </div>
              )}
            </div>
          </section>
        ) : null; } catch { return null; } })()}

        {/* ═══ SECTION 2: PROBLEM AGITATION (LIGHT) ═══ */}
        {(() => { try { const d = hb(c.problemAgitation); if (!d) return null; return (
          <section style={{ background: LIGHT, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 24px", textAlign: "left" }}>{d.heading}</h2>
              {d.body.map((p, i) => <BulletPoint key={i} text={p} />)}
              <CtaButton dark={false} />
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 3: COACH AUTHORITY (DARK) ═══ */}
        {(headshot || coachName) && (
          <section style={{ background: DARK, padding: `${sectionPad} 0` }}>
            <div style={{ ...inner, display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "center" }}>
              {headshot && (
                <div style={{ flex: "0 1 40%", minWidth: "260px" }}>
                  <img src={headshot} alt="Coach" style={{ width: "100%", maxWidth: "400px", borderRadius: "12px", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ flex: "1 1 50%", minWidth: "300px" }}>
                {coachName && <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "42px", color: TEXT_DARK, margin: "0 0 16px", textTransform: "uppercase" }}>{coachName}</h2>}
                {bioText && <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: BODY_DARK, margin: "0 0 24px" }}>{bioText}</p>}
                <CtaButton />
              </div>
            </div>
          </section>
        )}

        {/* ═══ SECTION 4: SOLUTION INTRO (LIGHT) ═══ */}
        {(() => { try { const d = hb(c.solutionIntro); if (!d) return null; return (
          <section style={{ background: LIGHT, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 24px" }}>{d.heading}</h2>
              {d.body.map((p, i) => <BulletPoint key={i} text={p} />)}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 5: UNIQUE MECHANISM (WHITE) ═══ */}
        {(() => { try { const d = hb(c.uniqueMechanism); if (!d) return null; return (
          <section style={{ background: WHITE, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 8px" }}>{d.heading}</h2>
              <div style={{ width: "80px", height: "3px", background: A, margin: "0 0 24px" }} />
              {d.body.map((p, i) => <p key={i} style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: BODY_LIGHT, margin: "0 0 14px" }}>{p}</p>)}
              <CtaButton dark={false} />
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 6: GALLERY / SOCIAL PROOF (DARK) ═══ */}
        {socialProof.length > 0 && (
          <section style={{ background: DARK, padding: "40px 0", overflowX: "auto" }}>
            <div style={{ ...inner, display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px" }}>
              {socialProof.map((url, i) => (
                <img key={i} src={url} alt="" style={{ height: "280px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ SECTION 7: WHY OLD METHODS FAIL + INSIDER ADVANTAGES (WHITE) ═══ */}
        {(() => { try {
          const whyFail = hb(c.whyOldFail);
          const advantages = hb(c.insiderAdvantages);
          if (!whyFail && !advantages) return null;
          return (
            <section style={{ background: WHITE, padding: `${sectionPad} 0` }}>
              <div style={inner}>
                {whyFail && (
                  <>
                    <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(24px, 3vw, 32px)", color: TEXT_LIGHT, margin: "0 0 24px" }}>{whyFail.heading}</h2>
                    {whyFail.body.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }}>
                        <span style={{ fontFamily: H_FONT, color: "#dc2626", fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.5 }}>✕</span>
                        <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "18px", lineHeight: 1.6, color: BODY_LIGHT, margin: 0 }}>{p}</p>
                      </div>
                    ))}
                    <div style={{ height: "40px" }} />
                  </>
                )}
                {advantages && (
                  <>
                    <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(24px, 3vw, 36px)", color: TEXT_LIGHT, margin: "0 0 24px" }}>{advantages.heading}</h2>
                    {advantages.body.map((p, i) => <BulletPoint key={i} text={p} />)}
                  </>
                )}
              </div>
            </section>
          );
        } catch { return null; } })()}

        {/* ═══ SECTION 8: TESTIMONIALS (LIGHT) ═══ */}
        {testimonials.length > 0 && (() => { try { return (
          <section style={{ background: LIGHT, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 32px", textAlign: "center" }}>
                What Our Clients Say
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                {testimonials.map((tm, i) => (
                  <div key={i} style={{ background: WHITE, borderRadius: "15px", padding: "30px 25px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    {tm.headline && <h3 style={{ fontFamily: H_FONT, color: A, fontSize: "20px", fontWeight: 700, fontStyle: "normal", margin: "0 0 12px" }}>{tm.headline}</h3>}
                    {tm.quote && <p style={{ fontFamily: B_FONT, color: BODY_LIGHT, fontStyle: "italic", fontSize: "16px", fontWeight: 400, lineHeight: 1.6, margin: "0 0 16px" }}>"{tm.quote}"</p>}
                    <div>
                      <p style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "15px", color: TEXT_LIGHT, margin: "0 0 2px" }}>{tm.name ?? ""}</p>
                      <p style={{ fontFamily: B_FONT, fontSize: "13px", fontWeight: 400, fontStyle: "normal", color: MUTED, margin: 0 }}>{tm.location ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 9: SHOCKING STAT (WHITE) ═══ */}
        {(() => { try { if (!ok(c.shockingStat)) return null;
          const statText = txt(c.shockingStat);
          const bigNum = statText.match(/[\d,]+[%x+]?/)?.[0] || "";
          return (
            <section style={{ background: WHITE, padding: `${sectionPad} 0`, textAlign: "center" }}>
              <div style={inner}>
                {bigNum && <div style={{ fontFamily: H_FONT, fontSize: "clamp(48px, 10vw, 80px)", fontWeight: 700, fontStyle: "normal", color: A, margin: "0 0 12px", lineHeight: 1 }}>{bigNum}</div>}
                <p style={{ fontFamily: B_FONT, fontSize: "20px", fontWeight: 400, fontStyle: "normal", color: BODY_LIGHT, maxWidth: "700px", margin: "0 auto", lineHeight: 1.6 }}>{statText}</p>
              </div>
            </section>
          );
        } catch { return null; } })()}

        {/* ═══ GRADIENT CTA BAR ═══ */}
        <section style={{ background: gradient, padding: "40px 0", textAlign: "center" }}>
          <div style={inner}>
            <CtaButton />
          </div>
        </section>

        {/* ═══ SECTION 10: CONSULTATION OUTLINE (WHITE) ═══ */}
        {outline.length > 0 && (() => { try { return (
          <section style={{ background: WHITE, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 32px", textAlign: "center" }}>What You'll Get</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                {outline.map((item, i) => (
                  <div key={i} style={{ background: LIGHT, borderRadius: "15px", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "40px", height: "40px", background: A, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "16px", color: "#fff" }}>{i + 1}</span>
                    </div>
                    <div>
                      <h3 style={{ fontFamily: H_FONT, fontSize: "18px", fontWeight: 700, fontStyle: "normal", color: TEXT_LIGHT, margin: "0 0 6px" }}>{item.title ?? ""}</h3>
                      <p style={{ fontFamily: B_FONT, color: BODY_LIGHT, margin: 0, lineHeight: 1.5, fontSize: "15px", fontWeight: 400, fontStyle: "normal" }}>{item.description ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 11: FAQ (WHITE) ═══ */}
        {faqItems.length > 0 && (
          <section style={{ background: WHITE, padding: `${sectionPad} 0` }}>
            <div style={{ ...inner, maxWidth: "900px" }}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(28px, 3.5vw, 42px)", color: TEXT_LIGHT, margin: "0 0 32px", textAlign: "center" }}>
                Frequently Asked Questions
              </h2>
              <FaqAccordion items={faqItems} accent={A} />
            </div>
          </section>
        )}

        {/* ═══ SECTION 12: SCARCITY / URGENCY (LIGHT) ═══ */}
        {(() => { try { const d = hb(c.scarcityUrgency); if (!d) return null; return (
          <section style={{ background: LIGHT, padding: `${sectionPad} 0` }}>
            <div style={inner}>
              <div style={{ border: `3px solid ${A}`, borderRadius: "12px", padding: "40px 32px", textAlign: "left" }}>
                <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(24px, 3vw, 32px)", color: A, margin: "0 0 16px", textAlign: "center" }}>{d.heading}</h2>
                {d.body.map((p, i) => <p key={i} style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "17px", lineHeight: 1.7, color: BODY_LIGHT, margin: "0 0 14px" }}>{p}</p>)}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* ═══ SECTION 13: FINAL CTA (DARK) ═══ */}
        <section style={{ background: DARK, padding: "80px 0" }}>
          <div style={{ ...inner, textAlign: "center" }}>
            <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "clamp(24px, 3.5vw, 36px)", color: TEXT_DARK, margin: "0 0 20px" }}>
              {ok(c.mainHeadline) ? c.mainHeadline : "Ready to Get Started?"}
            </h2>
            <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "17px", color: BODY_DARK, margin: "0 auto 32px", maxWidth: "650px", lineHeight: 1.7, textAlign: "left" }}>
              {ok(c.subheadline) ? c.subheadline : "Take the first step today."}
            </p>
            <CtaButton />
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{ background: DARK, borderTop: "1px solid #222", padding: "24px 48px", textAlign: "center" }}>
          <p style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: MUTED, margin: 0 }}>
            {coachName ? `© ${new Date().getFullYear()} ${coachName}. All rights reserved.` : `© ${new Date().getFullYear()} All rights reserved.`}
          </p>
        </footer>

      </div>
    </>
  );
}
