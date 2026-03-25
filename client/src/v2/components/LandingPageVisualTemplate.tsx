/**
 * LandingPageVisualTemplate — dark-theme visual landing page renderer
 * 2-column hero with coach headshot, social proof photo row, all 16 sections.
 * Every text element has its full inline font stack — no CSS inheritance.
 */

// Types matching the parent panel
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
  [key: string]: any;
}

interface VisualTemplateProps {
  angleData: AngleContent;
  headshot: string | null;
  logo: string | null;
  socialProof: string[];
  coachName?: string;
}

// Theme constants
const BG = "#0F172A";
const SURFACE = "#1E293B";
const BORDER = "#334155";
const TEXT = "#F8FAFC";
const BODY = "#CBD5E1";
const MUTED = "#64748B";
const ACCENT = "#FF5B1D";
const BLUE = "#3B82F6";
const RED = "#EF4444";
const H_FONT = "'Playfair Display', Georgia, serif";
const B_FONT = "'Inter', system-ui, sans-serif";

function isValid(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0 && !val.includes("[Generation incomplete");
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val as Record<string, unknown>).length > 0;
  return true;
}

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.headline === "string" && typeof obj.content === "string") return `${obj.headline}\n${obj.content}`;
    if (typeof obj.content === "string") return obj.content;
  }
  return String(val ?? "");
}

function getHB(val: unknown): { heading: string; body: string[] } | null {
  if (!isValid(val)) return null;
  const text = extractText(val);
  const lines = text.split("\n").filter((l: string) => l.trim());
  if (!lines.length) return null;
  return { heading: lines[0], body: lines.slice(1) };
}

function safeParse<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return fallback; } }
  return val as T;
}

export default function LandingPageVisualTemplate({ angleData, headshot, logo, socialProof, coachName }: VisualTemplateProps) {
  const c = angleData;

  const quiz = safeParse<{ question?: string; options?: string[]; answer?: string } | null>(c.quizSection, null);
  const testimonials = safeParse<Array<{ headline?: string; quote?: string; name?: string; location?: string }>>(c.testimonials, []);
  const outline = safeParse<Array<{ title?: string; description?: string }>>(c.consultationOutline, []);

  const sectionStyle: React.CSSProperties = { padding: "64px 0", borderBottom: `1px solid ${BORDER}` };
  const h2Style: React.CSSProperties = { fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "32px", lineHeight: 1.2, color: TEXT, margin: "0 0 16px" };
  const bodyStyle: React.CSSProperties = { fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "17px", lineHeight: 1.75, color: BODY, margin: "0 0 12px" };
  const ctaBtn: React.CSSProperties = { fontFamily: B_FONT, background: ACCENT, color: "#fff", border: "none", borderRadius: "9999px", padding: "16px 40px", fontSize: "18px", fontWeight: 600, fontStyle: "normal", cursor: "pointer", display: "inline-block" };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ background: BG, minHeight: "100vh" }}>

        {/* TOP NAV */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {logo && <img src={logo} alt="Logo" style={{ height: "40px", objectFit: "contain" }} />}
            {coachName && <span style={{ fontFamily: B_FONT, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: TEXT }}>{coachName}</span>}
          </div>
          {isValid(c.primaryCta) && <button style={{ ...ctaBtn, padding: "10px 24px", fontSize: "14px" }}>{c.primaryCta}</button>}
        </nav>

        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 48px" }}>

          {/* HERO — 2 COLUMN */}
          {(() => { try { return (isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) ? (
            <section style={{ display: "flex", alignItems: "center", gap: "48px", padding: "80px 0 64px", borderBottom: `1px solid ${BORDER}` }}>
              {/* LEFT COL 55% */}
              <div style={{ flex: "0 0 55%", display: "flex", flexDirection: "column", gap: "16px" }}>
                {isValid(c.eyebrowHeadline) && (
                  <p style={{ fontFamily: B_FONT, color: ACCENT, fontSize: "13px", fontWeight: 700, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>{c.eyebrowHeadline}</p>
                )}
                {isValid(c.mainHeadline) && (
                  <h1 style={{ fontFamily: H_FONT, fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 900, fontStyle: "normal", lineHeight: 1.1, color: TEXT, margin: 0 }}>{c.mainHeadline}</h1>
                )}
                {isValid(c.subheadline) && (
                  <p style={{ fontFamily: B_FONT, fontSize: "18px", fontWeight: 400, fontStyle: "normal", color: BODY, margin: 0, lineHeight: 1.6 }}>{c.subheadline}</p>
                )}
                {isValid(c.primaryCta) && (
                  <div style={{ marginTop: "8px" }}><button style={ctaBtn}>{c.primaryCta}</button></div>
                )}
              </div>
              {/* RIGHT COL 45% — headshot */}
              {headshot && (
                <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "flex-end" }}>
                  <img src={headshot} alt="Coach" style={{ width: "100%", maxHeight: "480px", borderRadius: "16px", objectFit: "cover" }} />
                </div>
              )}
            </section>
          ) : null; } catch { return null; } })()}

          {/* SOCIAL PROOF PHOTOS */}
          {socialProof.length > 0 && (
            <section style={{ padding: "24px 0", overflowX: "auto", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", gap: "12px" }}>
                {socialProof.map((url, i) => <img key={i} src={url} alt="" style={{ height: "120px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />)}
              </div>
            </section>
          )}

          {/* AS SEEN IN */}
          {(() => { try { return isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) ? (
            <section style={{ ...sectionStyle, textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontFamily: B_FONT, color: MUTED, fontSize: "12px", fontWeight: 600, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 20px" }}>As Seen In</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px" }}>
                {c.asSeenIn.map((logo: string, i: number) => <span key={i} style={{ fontFamily: B_FONT, color: MUTED, fontWeight: 600, fontStyle: "normal", fontSize: "16px" }}>{String(logo)}</span>)}
              </div>
            </section>
          ) : null; } catch { return null; } })()}

          {/* PROBLEM AGITATION */}
          {(() => { try { const hb = getHB(c.problemAgitation); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* SOLUTION INTRO */}
          {(() => { try { const hb = getHB(c.solutionIntro); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: "rgba(59,130,246,0.06)", borderRadius: "12px", padding: "48px 32px", margin: "0 -16px" }}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* WHY OLD METHODS FAIL */}
          {(() => { try { const hb = getHB(c.whyOldFail); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, color: RED }}>{hb.heading}</h2>
              {hb.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontFamily: B_FONT, color: RED, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.75 }}>✕</span>
                  <p style={bodyStyle}>{p}</p>
                </div>
              ))}
            </section>
          ); } catch { return null; } })()}

          {/* UNIQUE MECHANISM */}
          {(() => { try { const hb = getHB(c.uniqueMechanism); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: SURFACE, borderRadius: "12px", padding: "48px 32px", margin: "0 -16px" }}>
              <h2 style={{ ...h2Style, color: ACCENT }}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* TESTIMONIALS */}
          {testimonials.length > 0 && (() => { try { return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, textAlign: "center" }}>What Our Clients Say</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "24px" }}>
                {testimonials.map((tm, i) => (
                  <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {tm.headline && <h3 style={{ fontFamily: H_FONT, color: ACCENT, fontSize: "18px", fontWeight: 700, fontStyle: "normal", margin: 0 }}>{tm.headline}</h3>}
                    {tm.quote && <p style={{ fontFamily: B_FONT, color: BODY, fontStyle: "italic", fontSize: "16px", fontWeight: 400, lineHeight: 1.65, margin: 0 }}>"{tm.quote}"</p>}
                    <div style={{ marginTop: "auto" }}>
                      <p style={{ fontFamily: B_FONT, fontWeight: 600, fontStyle: "normal", fontSize: "14px", margin: "0 0 2px", color: TEXT }}>{tm.name ?? ""}</p>
                      <p style={{ fontFamily: B_FONT, fontSize: "13px", fontWeight: 400, fontStyle: "normal", color: MUTED, margin: 0 }}>{tm.location ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ); } catch { return null; } })()}

          {/* INSIDER ADVANTAGES */}
          {(() => { try { const hb = getHB(c.insiderAdvantages); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{ fontFamily: B_FONT, color: ACCENT, fontSize: "17px", fontWeight: 700, fontStyle: "normal", flexShrink: 0 }}>{i + 1}.</span>
                  <p style={bodyStyle}>{p}</p>
                </div>
              ))}
            </section>
          ); } catch { return null; } })()}

          {/* SHOCKING STAT */}
          {(() => { try { if (!isValid(c.shockingStat)) return null;
            const statText = extractText(c.shockingStat);
            const bigNumber = statText.match(/\d+[%x]/)?.[0] || statText.match(/\d+/)?.[0] || "";
            return (
              <section style={{ ...sectionStyle, textAlign: "center", padding: "80px 0" }}>
                {bigNumber && <div style={{ fontFamily: H_FONT, fontSize: "clamp(3rem, 8vw, 6rem)", fontWeight: 900, fontStyle: "normal", color: BLUE, margin: "0 0 16px", lineHeight: 1 }}>{bigNumber}</div>}
                <p style={{ fontFamily: B_FONT, fontSize: "17px", fontWeight: 400, fontStyle: "normal", color: BODY, maxWidth: "560px", margin: "0 auto", lineHeight: 1.75 }}>{statText}</p>
              </section>
            );
          } catch { return null; } })()}

          {/* QUIZ */}
          {quiz && isValid(quiz.question) && (() => { try { return (
            <section style={{ ...sectionStyle, background: SURFACE, borderRadius: "12px", padding: "48px 32px", margin: "0 -16px" }}>
              <h2 style={h2Style}>{quiz.question}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
                {(quiz.options ?? []).map((opt: string, i: number) => (
                  <div key={i} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "14px 16px", cursor: "pointer" }}>
                    <span style={{ fontFamily: B_FONT, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: TEXT, marginRight: "12px" }}>{String.fromCharCode(65 + i)}.</span>
                    <span style={{ fontFamily: B_FONT, fontWeight: 400, fontStyle: "normal", fontSize: "16px", color: BODY }}>{opt}</span>
                  </div>
                ))}
              </div>
              {isValid(quiz.answer) && (
                <div style={{ background: "rgba(59,130,246,0.1)", border: `1px solid ${BLUE}`, borderRadius: "8px", padding: "14px 16px" }}>
                  <p style={{ fontFamily: B_FONT, color: BLUE, fontWeight: 600, fontStyle: "normal", fontSize: "15px", margin: 0 }}>Answer: {quiz.answer}</p>
                </div>
              )}
            </section>
          ); } catch { return null; } })()}

          {/* SCARCITY / URGENCY */}
          {(() => { try { const hb = getHB(c.scarcityUrgency); if (!hb) return null; return (
            <section style={{ border: `2px solid ${RED}`, borderRadius: "12px", padding: "32px", margin: "64px 0" }}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "24px", color: RED, margin: "0 0 12px" }}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* TIME-SAVING BENEFIT */}
          {(() => { try { const hb = getHB(c.timeSavingBenefit); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: SURFACE, borderRadius: "12px", padding: "48px 32px", margin: "0 -16px" }}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* CONSULTATION OUTLINE */}
          {outline.length > 0 && (() => { try { return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, textAlign: "center" }}>What You'll Get</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
                {outline.map((item, i) => (
                  <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "20px 24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "32px", height: "32px", background: ACCENT, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: B_FONT, fontWeight: 700, fontStyle: "normal", fontSize: "14px", color: "#fff" }}>{i + 1}</span>
                    </div>
                    <div>
                      <h3 style={{ fontFamily: H_FONT, fontSize: "18px", fontWeight: 700, fontStyle: "normal", color: TEXT, margin: "0 0 4px" }}>{item.title ?? ""}</h3>
                      <p style={{ fontFamily: B_FONT, color: BODY, margin: 0, lineHeight: 1.65, fontSize: "15px", fontWeight: 400, fontStyle: "normal" }}>{item.description ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ); } catch { return null; } })()}

          {/* FINAL CTA */}
          {isValid(c.primaryCta) && (
            <section style={{ textAlign: "center", padding: "80px 0 64px" }}>
              <h2 style={{ fontFamily: H_FONT, fontWeight: 900, fontStyle: "normal", fontSize: "36px", color: TEXT, margin: "0 0 24px" }}>Ready to Get Started?</h2>
              <button style={ctaBtn}>{c.primaryCta}</button>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
