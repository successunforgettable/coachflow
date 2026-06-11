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
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "#FF5B1D";
const ACCENT_PURPLE = "#8B5CF6";
const CROWN_GOLD = "#EAB308";
const TRAIL_STALE = "#F59E0B";
const BG_CREAM = "#F5F1EA";
const TEXT_COLOR = "#1A1624";
const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";
const FONT_HEADING = "'Fraunces', Georgia, serif";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ZappyChatMood = "idle" | "thinking" | "celebrating";

export type ChatMessageType =
  | "zappy-bubble"
  | "user-bubble"
  | "chip-row"
  | "asset-reveal-card"
  | "card-deck"
  | "milestone-badge"
  | "system-divider";

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
  reveal?: { eyebrow: string; title: string; preview: string; score?: number };
  /** Card deck data (structural shell) */
  deck?: { cards: { id: number; title: string; preview: string; selected?: boolean }[] };
  /** Milestone badge data */
  milestone?: { name: string; line: string };
}

export interface ChatThreadProps {
  messages: ChatMessage[];
  onChipTap?: (messageId: string, chip: string) => void;
  onDeckSelect?: (messageId: string, cardId: number) => void;
  /** Ref map for TrailBar scroll-to-node */
  nodeRefMap?: React.MutableRefObject<Map<string, HTMLDivElement>>;
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
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 44 }}>
      {msg.chips.map(chip => (
        <button
          key={chip}
          onClick={() => onTap(chip)}
          style={{
            background: "white",
            border: `1.5px solid ${BRAND_PRIMARY}`,
            borderRadius: 9999,
            padding: "8px 18px",
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 600,
            color: BRAND_PRIMARY,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = BRAND_PRIMARY;
            (e.target as HTMLButtonElement).style.color = "white";
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = "white";
            (e.target as HTMLButtonElement).style.color = BRAND_PRIMARY;
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function AssetRevealCard({ msg }: { msg: ChatMessage }) {
  if (!msg.reveal) return null;
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
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: TEXT_COLOR,
          opacity: 0.7,
          lineHeight: 1.5,
        }}>
          {msg.reveal.preview}
        </div>
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

function CardDeck({ msg, onSelect }: { msg: ChatMessage; onSelect?: (cardId: number) => void }) {
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
            {!card.selected && (
              <button
                onClick={() => onSelect?.(card.id)}
                style={{
                  width: "100%",
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
export default function ChatThread({ messages, onChipTap, onDeckSelect, nodeRefMap }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showNewPill, setShowNewPill] = useState(false);
  const lastMsgCount = useRef(messages.length);
  const userScrolledUp = useRef(false);

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
      userScrolledUp.current = false;
    } else {
      userScrolledUp.current = true;
      setAutoScroll(false);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMsgCount.current) {
      if (autoScroll) {
        bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
      } else {
        setShowNewPill(true);
      }
    }
    lastMsgCount.current = messages.length;
  }, [messages.length, autoScroll, reducedMotion]);

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
                {msg.type === "card-deck" && <CardDeck msg={msg} onSelect={(cardId) => onDeckSelect?.(msg.id, cardId)} />}
                {msg.type === "milestone-badge" && <MilestoneBadge msg={msg} />}
                {msg.type === "system-divider" && <SystemDivider msg={msg} />}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* "↓ New" pill */}
        {showNewPill && (
          <button
            onClick={scrollToBottom}
            style={{
              position: "absolute",
              bottom: 16,
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
