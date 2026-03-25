/**
 * LandingPageVisualTemplate — full-width dark coaching landing page.
 * Conditional sections based on HVCO type. FAQ accordion. Mobile responsive.
 * Every text element has full inline font stack — no CSS inheritance.
 */
import { useState } from "react";

interface AngleContent {
  eyebrowHeadline?: string;
  mainHeadline?: string;
  subheadline?: string;
  primaryCta?: string;
  asSeenIn?: string[];
  quizSection?: any;
  problemAgitation?: any;
  solutionIntro?: any;
  whyOldFail?: any;
  uniqueMechanism?: any;
  testimonials?: any;
  insiderAdvantages?: any;
  scarcityUrgency?: any;
  shockingStat?: any;
  timeSavingBenefit?: any;
  consultationOutline?: any;
  faq?: any;
  [key: string]: any;
}

interface VisualTemplateProps {
  angleData: AngleContent;
  headshot: string | null;
  logo: string | null;
  socialProof: string[];
  coachName?: string;
  primaryColor?: string;
  hvcoType?: string; // webinar, pdf, guide, discovery_call, challenge, training
  campaignType?: string; // webinar, challenge, course_launch, product_launch
  offerAngle?: string; // godfather, free, dollar
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const H = "'Playfair Display', Georgia, serif";
const B = "'Inter', system-ui, sans-serif";
const BG1 = "#0F172A";
const BG2 = "#0A0F1E";
const BORDER = "#1E293B";
const TEXT = "#F8FAFC";
const BODY_C = "#CBD5E1";
const MUTED = "#64748B";

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
  const lines = t.split("\n").filter(l => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}
function jp<T>(v: unknown, fb: T): T {
  if (!v) return fb;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return fb; } }
  return v as T;
}

// ─── CTA text inference ──────────────────────────────────────────────────────
function ctaText(props: VisualTemplateProps): string {
  if (ok(props.angleData.primaryCta)) return props.angleData.primaryCta!;
  const h = props.hvcoType?.toLowerCase() || "";
  const c = props.campaignType?.toLowerCase() || "";
  const o = props.offerAngle?.toLowerCase() || "";
  if (h.includes("webinar") || c.includes("webinar")) return "Register Free";
  if (h.includes("discovery") || h.includes("call")) return "Book Your Free Call";
  if (h.includes("pdf") || h.includes("guide") || h.includes("checklist")) return "Download Free";
  if (h.includes("challenge")) return "Join the Challenge";
  if (o === "godfather" || o === "dollar") return "Get Started";
  return "Get Started Now";
}

// ─── FAQ Accordion ───────────────────────────────────────────────────────────
function FaqAccordion({ items, accent }: { items: Array<{ question: string; answer: string }>; accent: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {items.map((item, i) => (
        <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden" }}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "18px 24px", background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <span style={{ fontFamily: B, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: TEXT, textAlign: "left" }}>{item.question}</span>
            <span style={{ fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "24px", color: accent, flexShrink: 0, marginLeft: "16px" }}>
              {openIdx === i ? "−" : "+"}
            </span>
          </button>
          {openIdx === i && (
            <div style={{ padding: "0 24px 18px" }}>
              <p style={{ fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "15px", lineHeight: 1.7, color: BODY_C, margin: 0 }}>{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Template ───────────────────────────────────────────────────────────
export default function LandingPageVisualTemplate(props: VisualTemplateProps) {
  const { angleData: c, headshot, logo, socialProof, coachName, primaryColor = "#FF5B1D", hvcoType, campaignType, offerAngle } = props;
  const A = primaryColor;
  const cta = ctaText(props);

  const testimonials = jp<Array<{ headline?: string; quote?: string; name?: string; location?: string }>>(c.testimonials, []);
  const outline = jp<Array<{ title?: string; description?: string }>>(c.consultationOutline, []);
  const quiz = jp<{ question?: string; options?: string[]; answer?: string } | null>(c.quizSection, null);

  // FAQ — try multiple possible locations
  const faqItems = jp<Array<{ question: string; answer: string }>>(c.faq, []);

  // Conditional flags
  const ht = (hvcoType || "").toLowerCase();
  const ct = (campaignType || "").toLowerCase();
  const oa = (offerAngle || "").toLowerCase();
  const isWebinar = ht.includes("webinar") || ct.includes("webinar");
  const isCall = ht.includes("discovery") || ht.includes("call");
  const isDownload = ht.includes("pdf") || ht.includes("guide") || ht.includes("checklist") || ht.includes("training");
  const isChallenge = ht.includes("challenge") || ct.includes("challenge");
  const isPaid = oa === "godfather" || oa === "dollar";

  // Inline style builders
  const h1s: React.CSSProperties = { fontFamily: H, fontWeight: 900, fontStyle: "normal", color: TEXT, margin: 0, lineHeight: 1.1 };
  const h2s: React.CSSProperties = { fontFamily: H, fontWeight: 700, fontStyle: "normal", fontSize: "32px", color: TEXT, margin: "0 0 20px", lineHeight: 1.2 };
  const ps: React.CSSProperties = { fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "17px", lineHeight: 1.75, color: BODY_C, margin: "0 0 12px" };
  const ctaS: React.CSSProperties = { fontFamily: B, background: A, color: "#fff", border: "none", borderRadius: "9999px", padding: "18px 48px", fontSize: "18px", fontWeight: 600, fontStyle: "normal", cursor: "pointer", display: "inline-block", transition: "transform 150ms, box-shadow 150ms" };
  const inner: React.CSSProperties = { maxWidth: "900px", margin: "0 auto", padding: "0 24px" };
  const secP = "80px";

  function CtaButton() {
    return (
      <div style={{ textAlign: "center", marginTop: "32px" }}>
        <button
          style={ctaS}
          onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.03)"; (e.target as HTMLElement).style.boxShadow = `0 8px 32px ${A}44`; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; (e.target as HTMLElement).style.boxShadow = "none"; }}
        >{cta}</button>
      </div>
    );
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ background: BG1, minHeight: "100vh", width: "100%" }}>

        {/* NAV */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", borderBottom: `1px solid ${BORDER}`, background: BG2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {logo && <img src={logo} alt="Logo" style={{ height: "40px", objectFit: "contain" }} />}
            {coachName && <span style={{ fontFamily: B, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: TEXT }}>{coachName}</span>}
          </div>
          <button style={{ ...ctaS, padding: "10px 24px", fontSize: "14px" }}>{cta}</button>
        </nav>

        {/* HERO */}
        {(() => { try { return (ok(c.eyebrowHeadline) || ok(c.mainHeadline)) ? (
          <section style={{ background: BG1, padding: `${secP} 48px`, width: "100%" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: headshot ? "center" : "center", gap: "48px", flexWrap: "wrap", justifyContent: headshot ? "space-between" : "center" }}>
              <div style={{ flex: headshot ? "0 1 55%" : "0 1 700px", minWidth: "300px", textAlign: headshot ? "left" : "center" }}>
                {ok(c.eyebrowHeadline) && <p style={{ fontFamily: B, color: A, fontSize: "13px", fontWeight: 700, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>{c.eyebrowHeadline}</p>}
                {ok(c.mainHeadline) && <h1 style={{ ...h1s, fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "20px" }}>{c.mainHeadline}</h1>}
                {ok(c.subheadline) && <p style={{ fontFamily: B, fontSize: "18px", fontWeight: 400, fontStyle: "normal", color: BODY_C, margin: "0 0 28px", lineHeight: 1.6, maxWidth: "560px" }}>{c.subheadline}</p>}
                <button
                  style={ctaS}
                  onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.03)"; (e.target as HTMLElement).style.boxShadow = `0 8px 32px ${A}44`; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; (e.target as HTMLElement).style.boxShadow = "none"; }}
                >{cta}</button>
              </div>
              {headshot && (
                <div style={{ flex: "0 1 45%", minWidth: "280px" }}>
                  <img src={headshot} alt="Coach" style={{ width: "100%", maxHeight: "520px", borderRadius: "16px", objectFit: "cover", display: "block" }} />
                </div>
              )}
            </div>
          </section>
        ) : null; } catch { return null; } })()}

        {/* GALLERY ROW */}
        {socialProof.length > 0 && (
          <section style={{ background: BG2, padding: "32px 48px", overflowX: "auto", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: "16px", maxWidth: "1200px", margin: "0 auto" }}>
              {socialProof.map((url, i) => <img key={i} src={url} alt="" style={{ height: "280px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />)}
            </div>
          </section>
        )}

        {/* EVENT DETAILS — webinar or challenge only */}
        {(isWebinar || isChallenge) && (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={h2s}>{isWebinar ? "Webinar Details" : "Challenge Details"}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {[
                  { icon: "📅", label: "Date", value: "See registration for dates" },
                  { icon: "⏰", label: "Time", value: "Live session times TBC" },
                  { icon: isWebinar ? "💻" : "👥", label: isWebinar ? "Platform" : "Format", value: isWebinar ? "Zoom (link sent on registration)" : "Daily challenges via email" },
                ].map((d, i) => (
                  <div key={i} style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{d.icon}</div>
                    <p style={{ fontFamily: B, fontWeight: 600, fontStyle: "normal", fontSize: "14px", color: TEXT, margin: "0 0 4px" }}>{d.label}</p>
                    <p style={{ fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: MUTED, margin: 0 }}>{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* AS SEEN IN */}
        {(() => { try { return ok(c.asSeenIn) && Array.isArray(c.asSeenIn) ? (
          <section style={{ background: BG2, padding: "40px 0", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ ...inner, textAlign: "center" }}>
              <p style={{ fontFamily: B, color: MUTED, fontSize: "12px", fontWeight: 600, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 20px" }}>As Seen In</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
                {c.asSeenIn.map((name: string, i: number) => <span key={i} style={{ fontFamily: B, color: MUTED, fontWeight: 600, fontStyle: "normal", fontSize: "18px" }}>{String(name)}</span>)}
              </div>
            </div>
          </section>
        ) : null; } catch { return null; } })()}

        {/* PROBLEM AGITATION */}
        {(() => { try { const d = hb(c.problemAgitation); if (!d) return null; return (
          <section style={{ background: BG1, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={h2s}>{d.heading}</h2>
              {d.body.map((p, i) => <p key={i} style={ps}>{p}</p>)}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* SOLUTION INTRO */}
        {(() => { try { const d = hb(c.solutionIntro); if (!d) return null; return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, color: A }}>{d.heading}</h2>
              {d.body.map((p, i) => <p key={i} style={ps}>{p}</p>)}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* WHY OLD METHODS FAIL */}
        {(() => { try { const d = hb(c.whyOldFail); if (!d) return null; return (
          <section style={{ background: BG1, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, color: "#EF4444" }}>{d.heading}</h2>
              {d.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "14px" }}>
                  <span style={{ fontFamily: B, color: "#EF4444", fontSize: "20px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.75 }}>✕</span>
                  <p style={ps}>{p}</p>
                </div>
              ))}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* UNIQUE MECHANISM */}
        {(() => { try { const d = hb(c.uniqueMechanism); if (!d) return null; return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, color: A }}>{d.heading}</h2>
              {d.body.map((p, i) => <p key={i} style={ps}>{p}</p>)}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* CTA AFTER MECHANISM */}
        <section style={{ background: BG1, padding: "48px 0" }}><div style={inner}><CtaButton /></div></section>

        {/* TESTIMONIALS */}
        {testimonials.length > 0 && (() => { try { return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, textAlign: "center" }}>What Our Clients Say</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginTop: "32px" }}>
                {testimonials.map((tm, i) => (
                  <div key={i} style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {tm.headline && <h3 style={{ fontFamily: H, color: A, fontSize: "18px", fontWeight: 700, fontStyle: "normal", margin: 0 }}>{tm.headline}</h3>}
                    {tm.quote && <p style={{ fontFamily: B, color: BODY_C, fontStyle: "italic", fontSize: "16px", fontWeight: 400, lineHeight: 1.65, margin: 0 }}>"{tm.quote}"</p>}
                    <div style={{ marginTop: "auto" }}>
                      <p style={{ fontFamily: B, fontWeight: 600, fontStyle: "normal", fontSize: "14px", color: TEXT, margin: "0 0 2px" }}>{tm.name ?? ""}</p>
                      <p style={{ fontFamily: B, fontSize: "13px", fontWeight: 400, fontStyle: "normal", color: MUTED, margin: 0 }}>{tm.location ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* CTA AFTER TESTIMONIALS */}
        <section style={{ background: BG1, padding: "48px 0" }}><div style={inner}><CtaButton /></div></section>

        {/* INSIDER ADVANTAGES */}
        {(() => { try { const d = hb(c.insiderAdvantages); if (!d) return null; return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={h2s}>{d.heading}</h2>
              {d.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontFamily: B, color: A, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.75 }}>✓</span>
                  <p style={ps}>{p}</p>
                </div>
              ))}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* SHOCKING STAT */}
        {(() => { try { if (!ok(c.shockingStat)) return null;
          const statText = txt(c.shockingStat);
          const bigNum = statText.match(/\d+[%x]/)?.[0] || statText.match(/\d+/)?.[0] || "";
          return (
            <section style={{ background: BG1, padding: `${secP} 0`, textAlign: "center" }}>
              <div style={inner}>
                {bigNum && <div style={{ fontFamily: H, fontSize: "clamp(3rem, 10vw, 7rem)", fontWeight: 900, fontStyle: "normal", color: A, margin: "0 0 16px", lineHeight: 1 }}>{bigNum}</div>}
                <p style={{ ...ps, fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}>{statText}</p>
              </div>
            </section>
          );
        } catch { return null; } })()}

        {/* QUIZ */}
        {quiz && ok(quiz.question) && (() => { try { return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={h2s}>{quiz.question}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "24px 0" }}>
                {(quiz.options ?? []).map((opt: string, i: number) => (
                  <div key={i} style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 20px", cursor: "pointer" }}>
                    <span style={{ fontFamily: B, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: A, marginRight: "12px" }}>{String.fromCharCode(65 + i)}.</span>
                    <span style={{ fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "16px", color: BODY_C }}>{opt}</span>
                  </div>
                ))}
              </div>
              {ok(quiz.answer) && (
                <div style={{ background: `${A}15`, border: `1px solid ${A}`, borderRadius: "10px", padding: "16px 20px" }}>
                  <p style={{ fontFamily: B, color: A, fontWeight: 600, fontStyle: "normal", fontSize: "15px", margin: 0 }}>Answer: {quiz.answer}</p>
                </div>
              )}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* FAQ ACCORDION */}
        {faqItems.length > 0 && (
          <section style={{ background: BG1, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, textAlign: "center" }}>Frequently Asked Questions</h2>
              <FaqAccordion items={faqItems} accent={A} />
            </div>
          </section>
        )}

        {/* SCARCITY / URGENCY */}
        {(() => { try { const d = hb(c.scarcityUrgency); if (!d) return null; return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <div style={{ border: `2px solid #EF4444`, borderRadius: "16px", padding: "40px 32px" }}>
                <h2 style={{ fontFamily: H, fontWeight: 700, fontStyle: "normal", fontSize: "26px", color: "#EF4444", margin: "0 0 16px" }}>{d.heading}</h2>
                {d.body.map((p, i) => <p key={i} style={ps}>{p}</p>)}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* PRICE SECTION — paid offers only */}
        {isPaid && ok(c.primaryCta) && (
          <section style={{ background: BG1, padding: `${secP} 0` }}>
            <div style={{ ...inner, textAlign: "center" }}>
              <h2 style={{ ...h2s, fontSize: "36px" }}>Investment</h2>
              <p style={{ ...ps, fontSize: "18px", maxWidth: "500px", margin: "0 auto 32px" }}>
                {oa === "godfather" ? "Premium programme with full risk reversal." : `Start for just the price shown below.`}
              </p>
              <CtaButton />
            </div>
          </section>
        )}

        {/* CONSULTATION OUTLINE */}
        {outline.length > 0 && (() => { try { return (
          <section style={{ background: BG2, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={{ ...h2s, textAlign: "center" }}>What You'll Get</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "28px" }}>
                {outline.map((item, i) => (
                  <div key={i} style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "22px 28px", display: "flex", gap: "18px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "36px", height: "36px", background: A, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: B, fontWeight: 700, fontStyle: "normal", fontSize: "15px", color: "#fff" }}>{i + 1}</span>
                    </div>
                    <div>
                      <h3 style={{ fontFamily: H, fontSize: "18px", fontWeight: 700, fontStyle: "normal", color: TEXT, margin: "0 0 6px" }}>{item.title ?? ""}</h3>
                      <p style={{ fontFamily: B, color: BODY_C, margin: 0, lineHeight: 1.65, fontSize: "15px", fontWeight: 400, fontStyle: "normal" }}>{item.description ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* TIME-SAVING BENEFIT */}
        {(() => { try { const d = hb(c.timeSavingBenefit); if (!d) return null; return (
          <section style={{ background: BG1, padding: `${secP} 0` }}>
            <div style={inner}>
              <h2 style={h2s}>{d.heading}</h2>
              {d.body.map((p, i) => <p key={i} style={ps}>{p}</p>)}
            </div>
          </section>
        ); } catch { return null; } })()}

        {/* FINAL CTA */}
        <section style={{ background: BG2, padding: "100px 0", textAlign: "center" }}>
          <div style={inner}>
            <h2 style={{ fontFamily: H, fontWeight: 900, fontStyle: "normal", fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT, margin: "0 0 28px" }}>Ready to Get Started?</h2>
            <p style={{ ...ps, fontSize: "18px", maxWidth: "500px", margin: "0 auto 36px" }}>
              {isWebinar ? "Secure your seat now — spaces are limited." :
               isCall ? "Book your free discovery call today." :
               isDownload ? "Download your free resource now." :
               isChallenge ? "Join the challenge before it starts." :
               "Take the first step today."}
            </p>
            <CtaButton />
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: BG2, borderTop: `1px solid ${BORDER}`, padding: "32px 48px", textAlign: "center" }}>
          <p style={{ fontFamily: B, fontWeight: 400, fontStyle: "normal", fontSize: "13px", color: MUTED, margin: 0 }}>
            {coachName ? `© ${new Date().getFullYear()} ${coachName}. All rights reserved.` : `© ${new Date().getFullYear()} All rights reserved.`}
          </p>
        </footer>

      </div>
    </>
  );
}
