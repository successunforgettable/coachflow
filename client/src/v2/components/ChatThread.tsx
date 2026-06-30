/**
 * ChatThread — Trail Sprint 1, Commit 3
 *
 * The chat container for the Campaign Trail experience.
 * V2 inline-styles convention. Spec Section 3.1.
 *
 * 7 message types: zappy-bubble, user-bubble, chip-row, asset-reveal-card,
 * card-deck, milestone-badge, system-divider.
 *
 * Scroll: auto-scrolls to newest; pauses on user scroll-up; "↓ New" pill.
 * Chips: disappear after tap, echo as user-bubble.
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";

const StyleChooser = lazy(() => import("./StyleChooser"));
const TestimonialPicker = lazy(() => import("./TestimonialPicker"));
const QuickFillChatCard = lazy(() => import("./QuickFillChatCard"));

// ─── Design tokens ────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "#FF5B1D";
const ACCENT_PURPLE = "#8B5CF6";
const CROWN_GOLD = "#EAB308";
const TRAIL_STALE = "#F59E0B";
const BG_CREAM = "#F5F1EA";
const TEXT_COLOR = "#1A1624";
const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";
const FONT_HEADING = "'Fraunces', Georgia, serif";

// ─── Suspense fallback — visible loading state so lazy-load failures never
// silently hang the trail. Shows a "Loading…" message with a skip button that
// resolves the parent promise, preventing the infinite-stall scenario. ──────
function SuspenseFallback({ label, onSkip }: { label: string; onSkip: () => void }) {
  return (
    <div style={{ padding: "16px 0", fontFamily: FONT_BODY, fontSize: 14, color: "#888" }}>
      <span>Loading {label}…</span>
      <button
        onClick={onSkip}
        style={{
          marginLeft: 12,
          background: "none",
          border: "1px solid #d1d5db",
          borderRadius: 9999,
          padding: "4px 14px",
          fontSize: 13,
          fontFamily: FONT_BODY,
          color: "#666",
          cursor: "pointer",
        }}
      >
        Skip
      </button>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type ZappyChatMood = "idle" | "thinking" | "celebrating";

export type ChatMessageType =
  | "zappy-bubble"
  | "user-bubble"
  | "chip-row"
  | "asset-reveal-card"
  | "card-deck"
  | "milestone-badge"
  | "system-divider"
  | "style-chooser"
  | "testimonial-picker"
  | "quick-fill-card"
  | "file-upload";

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  /** Text content for bubbles, divider label, milestone name */
  text?: string;
  /** Zappy mood for zappy-bubble messages */
  mood?: ZappyChatMood;
  /** Chip options for chip-row */
  chips?: string[];
  /** Node key for scroll-to targeting from TrailBar */
  nodeKey?: string;
  /** Asset reveal card data (structural shell) */
  reveal?: { eyebrow: string; title: string; preview: string; score?: number; sections?: { label: string; content: string }[] };
  /** Card deck data (structural shell) */
  deck?: { cards: { id: number; title: string; preview: string; selected?: boolean; favouritable?: boolean; favourited?: boolean }[] };
  /** Milestone badge data */
  milestone?: { name: string; line: string };
  /** Currently selected chips in a multi-select chip-row */
  selectedChips?: string[];
  /** Style chooser: headline text for live preview */
  styleChooserHeadline?: string;
  /** Style chooser: testimonial data for testimonial card preview (null = no testimonials, card hidden) */
  styleChooserTestimonial?: { quote: string; name: string; title?: string } | null;
  /** Testimonial picker: serviceId + mode */
  testimonialPicker?: { serviceId: number; mode: "campaign" | "standalone" };
  /** Quick-fill card: serviceId + campaign type (drives the conversion-link label) */
  quickFill?: { serviceId: number; campaignType?: string };
}

export type StyleChooseCallback = (messageId: string, style: string) => void;

export interface ChatThreadProps {
  messages: ChatMessage[];
  /** Persistent status line at top of chat — "Campaign: X of 11 complete" */
  campaignStatus?: string;
  onChipTap?: (messageId: string, chip: string) => void;
  onDeckSelect?: (messageId: string, cardId: number) => void;
  onDeckHeart?: (messageId: string, cardId: number) => void;
  onStyleChoose?: StyleChooseCallback;
  onTestimonialDone?: (messageId: string, action: "use" | "skip") => void;
  /** Quick-fill card handler — called when the user saves or skips the Tier-1 card */
  onQuickFillDone?: (messageId: string, action: "saved" | "skip") => void;
  /** File upload handler — called when user selects files from the file-upload message */
  onFileSelect?: (messageId: string, files: FileList) => void;
  /** Ref map for TrailBar scroll-to-node */
  nodeRefMap?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  /**
   * Free-text input bar (Trail Sprint 2). Rendered only when provided —
   * existing chip-only surfaces are unaffected.
   */
  onSendText?: (text: string) => void;
  inputPlaceholder?: string;
  inputDisabled?: boolean;
}

// ─── Zappy Chat Avatar (reuses existing SVGs, spec 2.3 motion states) ─────────
function ZappyChatAvatar({ mood, reducedMotion }: { mood: ZappyChatMood; reducedMotion: boolean }) {
  const src = mood === "celebrating" ? "/zappy-cheering.svg"
    : mood === "thinking" ? "/zappy-working.svg"
    : "/zappy-waiting.svg";

  const animation = reducedMotion ? "none"
    : mood === "idle" ? "chat-zappy-bob 3s ease-in-out infinite"
    : mood === "thinking" ? "chat-zappy-tilt 2s ease-in-out infinite"
    : mood === "celebrating" ? "chat-zappy-spin 600ms ease-out"
    : "none";

  return (
    <div style={{
      width: 36,
      height: 36,
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      background: "white",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    }}>
      <img
        src={src}
        alt={`Zappy — ${mood}`}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          animation,
        }}
      />
    </div>
  );
}

// ─── Message renderers ────────────────────────────────────────────────────────

function ZappyBubble({ msg, reducedMotion }: { msg: ChatMessage; reducedMotion: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "85%" }}>
      <ZappyChatAvatar mood={msg.mood ?? "idle"} reducedMotion={reducedMotion} />
      <div style={{
        background: "white",
        borderRadius: "18px 18px 18px 4px",
        padding: "10px 16px",
        fontFamily: FONT_BODY,
        fontSize: 14,
        lineHeight: 1.5,
        color: TEXT_COLOR,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        maxWidth: 420,
        wordBreak: "break-word",
      }}>
        {msg.text}
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        background: BRAND_PRIMARY,
        color: "white",
        borderRadius: "18px 18px 4px 18px",
        padding: "10px 16px",
        fontFamily: FONT_BODY,
        fontSize: 14,
        lineHeight: 1.5,
        maxWidth: "75%",
        wordBreak: "break-word",
      }}>
        {msg.text}
      </div>
    </div>
  );
}

function ChipRow({ msg, onTap }: { msg: ChatMessage; onTap: (chip: string) => void }) {
  if (!msg.chips?.length) return null;
  const selected = new Set(msg.selectedChips ?? []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 44 }}>
      {msg.chips.map(chip => {
        const isSelected = selected.has(chip);
        return (
          <button
            key={chip}
            onClick={() => onTap(chip)}
            style={{
              background: isSelected ? BRAND_PRIMARY : "white",
              border: `1.5px solid ${BRAND_PRIMARY}`,
              borderRadius: 9999,
              padding: "8px 18px",
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 600,
              color: isSelected ? "white" : BRAND_PRIMARY,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                (e.target as HTMLButtonElement).style.background = BRAND_PRIMARY;
                (e.target as HTMLButtonElement).style.color = "white";
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                (e.target as HTMLButtonElement).style.background = "white";
                (e.target as HTMLButtonElement).style.color = BRAND_PRIMARY;
              }
            }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

function FileUploadButton({ msg, onSelect }: { msg: ChatMessage; onSelect?: (msgId: string, files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ paddingLeft: 44, display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: BRAND_PRIMARY,
          color: "white",
          border: "none",
          borderRadius: 9999,
          padding: "12px 28px",
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          alignSelf: "flex-start",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.opacity = "0.9"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.opacity = "1"; }}
      >
        <span style={{ fontSize: 18 }}>+</span>
        Choose files (PDF, Word, or TXT)
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0 && onSelect) {
              onSelect(msg.id, files);
            }
          }}
        />
      </label>
      <span style={{
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: "#6B7280",
        paddingLeft: 4,
      }}>
        Up to 5 files, 10 MB each
      </span>
    </div>
  );
}

function AssetRevealCard({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  if (!msg.reveal) return null;
  const preview = msg.reveal.preview || "";

  // Detect image URLs (ad creatives use __IMAGES__ prefix)
  const isImagePreview = preview.startsWith("__IMAGES__");
  const imageUrls = isImagePreview ? preview.replace("__IMAGES__", "").split("|").filter(Boolean) : [];

  const isLong = !isImagePreview && preview.length > 220;
  const displayText = isLong && !expanded ? preview.slice(0, 220) + "…" : preview;
  return (
    <div style={{ paddingLeft: 44 }}>
      <div style={{
        background: "white",
        borderRadius: 16,
        padding: "16px 20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        borderLeft: `4px solid ${BRAND_PRIMARY}`,
        maxWidth: 480,
      }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: BRAND_PRIMARY,
          marginBottom: 6,
        }}>
          {msg.reveal.eyebrow}
        </div>
        <div style={{
          fontFamily: FONT_HEADING,
          fontSize: 18,
          fontWeight: 700,
          fontStyle: "italic",
          color: TEXT_COLOR,
          marginBottom: 8,
        }}>
          {msg.reveal.title}
        </div>
        {isImagePreview ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: 8,
            marginTop: 4,
          }}>
            {imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Ad creative ${i + 1}`}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  background: "#F3F4F6",
                }}
                loading="lazy"
              />
            ))}
          </div>
        ) : msg.reveal.sections && msg.reveal.sections.length > 0 ? (
          <div style={{ marginTop: 4 }}>
            {msg.reveal.sections.map((sec, i) => (
              <div key={i} style={{ marginBottom: i < msg.reveal!.sections!.length - 1 ? 10 : 0 }}>
                <div style={{
                  fontFamily: FONT_BODY,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: TEXT_COLOR,
                  opacity: 0.45,
                  marginBottom: 3,
                }}>
                  {sec.label}
                </div>
                <div style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: TEXT_COLOR,
                  opacity: 0.7,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}>
                  {sec.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: TEXT_COLOR,
            opacity: 0.7,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            maxHeight: expanded ? "none" : undefined,
          }}>
            {displayText}
          </div>
        )}
        {isLong && !msg.reveal.sections && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 0",
              fontFamily: FONT_BODY,
              fontSize: 12,
              fontWeight: 600,
              color: BRAND_PRIMARY,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
        {msg.reveal.score != null && (
          <div style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: msg.reveal.score === 100 ? "#E8F5E9" : "#FFF8E1",
            color: msg.reveal.score === 100 ? "#2E7D32" : TRAIL_STALE,
            borderRadius: 9999,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: FONT_BODY,
          }}>
            Meta {msg.reveal.score === 100 ? "✓" : "⚠"} {msg.reveal.score}
          </div>
        )}
      </div>
    </div>
  );
}

function CardDeck({ msg, onSelect, onHeart }: { msg: ChatMessage; onSelect?: (cardId: number) => void; onHeart?: (cardId: number) => void }) {
  if (!msg.deck?.cards?.length) return null;
  return (
    <div style={{ paddingLeft: 44 }}>
      <div style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 8,
        scrollSnapType: "x mandatory",
      }}>
        {msg.deck.cards.map(card => (
          <div key={card.id} style={{
            background: "white",
            borderRadius: 16,
            padding: "14px 16px",
            minWidth: 240,
            maxWidth: 280,
            flexShrink: 0,
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            border: card.selected ? `2px solid ${CROWN_GOLD}` : "2px solid transparent",
            scrollSnapAlign: "start",
            position: "relative",
          }}>
            {card.selected && (
              <div style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: CROWN_GOLD,
                color: "white",
                borderRadius: 9999,
                padding: "2px 10px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: FONT_BODY,
              }}>
                ✓ Selected
              </div>
            )}
            <div style={{
              fontFamily: FONT_HEADING,
              fontSize: 15,
              fontWeight: 700,
              fontStyle: "italic",
              color: TEXT_COLOR,
              marginTop: card.selected ? 28 : 0,
              marginBottom: 6,
            }}>
              {card.title}
            </div>
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: TEXT_COLOR,
              opacity: 0.65,
              lineHeight: 1.4,
              marginBottom: 10,
            }}>
              {card.preview}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!card.selected && (
                <button
                  onClick={() => onSelect?.(card.id)}
                  style={{
                    flex: 1,
                    background: BRAND_PRIMARY,
                    color: "white",
                    border: "none",
                    borderRadius: 9999,
                    padding: "8px 0",
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Use this one
                </button>
              )}
              {card.favouritable && (
                <button
                  onClick={() => onHeart?.(card.id)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: "4px 6px",
                    opacity: card.favourited ? 1 : 0.4,
                  }}
                  title={card.favourited ? "Remove favourite" : "Save as favourite"}
                >
                  {card.favourited ? "❤️" : "🤍"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneBadge({ msg }: { msg: ChatMessage }) {
  if (!msg.milestone) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <div style={{
        background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${ACCENT_PURPLE})`,
        borderRadius: 16,
        padding: "14px 24px",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(139,92,246,0.2)",
        maxWidth: 320,
      }}>
        <div style={{
          fontFamily: FONT_HEADING,
          fontSize: 16,
          fontWeight: 900,
          fontStyle: "italic",
          color: "white",
          marginBottom: 4,
        }}>
          {msg.milestone.name}
        </div>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          color: "rgba(255,255,255,0.85)",
        }}>
          {msg.milestone.line}
        </div>
      </div>
    </div>
  );
}

function SystemDivider({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "4px 0",
    }}>
      <div style={{ flex: 1, height: 1, background: "#D1D5DB" }} />
      <div style={{
        fontFamily: FONT_BODY,
        fontSize: 11,
        fontWeight: 600,
        color: TEXT_COLOR,
        opacity: 0.35,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}>
        {msg.text}
      </div>
      <div style={{ flex: 1, height: 1, background: "#D1D5DB" }} />
    </div>
  );
}

// ─── Main ChatThread ──────────────────────────────────────────────────────────
export default function ChatThread({ messages, campaignStatus, onChipTap, onDeckSelect, onDeckHeart, onStyleChoose, onTestimonialDone, onQuickFillDone, onFileSelect, nodeRefMap, onSendText, inputPlaceholder, inputDisabled }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showNewPill, setShowNewPill] = useState(false);
  const [draft, setDraft] = useState("");
  const lastMsgIds = useRef(new Set(messages.map(m => m.id)));

  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;

  // Detect user scroll direction
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) {
      setAutoScroll(true);
      setShowNewPill(false);
    } else {
      setAutoScroll(false);
    }
  }, []);

  // Open pinned to the bottom — standard chat behaviour: the newest message
  // (e.g. the welcome-back bubble on a restored transcript) is what matters.
  // Fires once, on the first render that has messages.
  const didInitialPin = useRef(false);
  useEffect(() => {
    if (didInitialPin.current || messages.length === 0) return;
    didInitialPin.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-scroll on new messages (tracks by ID set, not length)
  useEffect(() => {
    const hasNew = messages.some(m => !lastMsgIds.current.has(m.id));
    if (hasNew) {
      if (autoScroll) {
        bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
      } else {
        setShowNewPill(true);
      }
    }
    lastMsgIds.current = new Set(messages.map(m => m.id));
  }, [messages, autoScroll, reducedMotion]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
    setAutoScroll(true);
    setShowNewPill(false);
  };

  // Expose scroll-to-node for TrailBar
  const scrollToNode = useCallback((nodeKey: string) => {
    const el = nodeRefMap?.current?.get(nodeKey);
    if (el) el.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "center" });
  }, [nodeRefMap, reducedMotion]);

  return (
    <>
      <style>{`
        @keyframes chat-zappy-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes chat-zappy-tilt {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-8deg); }
        }
        @keyframes chat-zappy-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.15); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}>
        {/* Persistent campaign status line */}
        {campaignStatus && (
          <div style={{
            padding: "6px 16px",
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(26,22,36,0.40)",
            textAlign: "center",
            borderBottom: "1px solid rgba(26,22,36,0.06)",
            flexShrink: 0,
          }}>
            {campaignStatus}
          </div>
        )}
        {/* Scrollable message area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.map(msg => {
            const nodeRef = msg.nodeKey ? (el: HTMLDivElement | null) => {
              if (el && nodeRefMap?.current) nodeRefMap.current.set(msg.nodeKey!, el);
            } : undefined;

            return (
              <div key={msg.id} ref={nodeRef}>
                {msg.type === "zappy-bubble" && <ZappyBubble msg={msg} reducedMotion={reducedMotion} />}
                {msg.type === "user-bubble" && <UserBubble msg={msg} />}
                {msg.type === "chip-row" && <ChipRow msg={msg} onTap={(chip) => onChipTap?.(msg.id, chip)} />}
                {msg.type === "asset-reveal-card" && <AssetRevealCard msg={msg} />}
                {msg.type === "card-deck" && <CardDeck msg={msg} onSelect={(cardId) => onDeckSelect?.(msg.id, cardId)} onHeart={(cardId) => onDeckHeart?.(msg.id, cardId)} />}
                {msg.type === "milestone-badge" && <MilestoneBadge msg={msg} />}
                {msg.type === "system-divider" && <SystemDivider msg={msg} />}
                {msg.type === "file-upload" && <FileUploadButton msg={msg} onSelect={onFileSelect} />}
                {msg.type === "style-chooser" && (
                  <Suspense fallback={<SuspenseFallback label="style picker" onSkip={() => onStyleChoose?.(msg.id, "photo_ad")} />}>
                    <StyleChooser
                      headline={msg.styleChooserHeadline || "Your headline here"}
                      testimonialQuote={msg.styleChooserTestimonial}
                      onChoose={({ style }) => onStyleChoose?.(msg.id, style)}
                    />
                  </Suspense>
                )}
                {msg.type === "testimonial-picker" && msg.testimonialPicker && (
                  <Suspense fallback={<SuspenseFallback label="testimonials" onSkip={() => onTestimonialDone?.(msg.id, "skip")} />}>
                    <TestimonialPicker
                      serviceId={msg.testimonialPicker.serviceId}
                      mode={msg.testimonialPicker.mode}
                      onDone={(action) => onTestimonialDone?.(msg.id, action)}
                    />
                  </Suspense>
                )}
                {msg.type === "quick-fill-card" && msg.quickFill && (
                  <Suspense fallback={<SuspenseFallback label="quick details" onSkip={() => onQuickFillDone?.(msg.id, "skip")} />}>
                    <QuickFillChatCard
                      serviceId={msg.quickFill.serviceId}
                      campaignType={msg.quickFill.campaignType}
                      onDone={(action) => onQuickFillDone?.(msg.id, action)}
                    />
                  </Suspense>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Free-text input bar (rendered only when onSendText provided) */}
        {onSendText && (
          <div style={{
            flexShrink: 0,
            display: "flex",
            gap: 8,
            padding: "10px 12px 14px",
          }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && draft.trim() && !inputDisabled) {
                  onSendText(draft.trim());
                  setDraft("");
                }
              }}
              placeholder={inputPlaceholder ?? "Type here…"}
              disabled={inputDisabled}
              autoFocus
              style={{
                flex: 1,
                border: "1.5px solid #D1D5DB",
                borderRadius: 9999,
                padding: "11px 18px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: TEXT_COLOR,
                background: "white",
                outline: "none",
                opacity: inputDisabled ? 0.5 : 1,
              }}
            />
            <button
              onClick={() => {
                if (draft.trim() && !inputDisabled) {
                  onSendText(draft.trim());
                  setDraft("");
                }
              }}
              disabled={inputDisabled}
              style={{
                background: BRAND_PRIMARY,
                color: "white",
                border: "none",
                borderRadius: 9999,
                padding: "11px 22px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                fontWeight: 600,
                cursor: inputDisabled ? "not-allowed" : "pointer",
                opacity: inputDisabled ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        )}

        {/* "↓ New" pill */}
        {showNewPill && (
          <button
            onClick={scrollToBottom}
            style={{
              position: "absolute",
              bottom: onSendText ? 76 : 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: BRAND_PRIMARY,
              color: "white",
              border: "none",
              borderRadius: 9999,
              padding: "6px 18px",
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255,91,29,0.3)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ↓ New
          </button>
        )}
      </div>
    </>
  );
}
