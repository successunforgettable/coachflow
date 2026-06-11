/**
 * ChatThreadDemo — mock conversation for ChatThread visual verification.
 * Exercises all 7 message types + scroll + chip tap behaviour.
 * NOT user-facing — dev verification only.
 */
import { useState, useRef } from "react";
import V2Layout from "./V2Layout";
import TrailBar, { type TrailStop } from "./components/TrailBar";
import ChatThread, { type ChatMessage } from "./components/ChatThread";

const TRAIL_STOPS: TrailStop[] = [
  { key: "service",      label: "Service",      state: "done" },
  { key: "icp",          label: "ICP",          state: "done" },
  { key: "offer",        label: "Offer",        state: "done" },
  { key: "uniqueMethod", label: "Method",       state: "done" },
  { key: "freeOptIn",    label: "Lead Magnet",  state: "generating" },
  { key: "headlines",    label: "Headlines",    state: "pending" },
  { key: "adCopy",       label: "Ad Copy",      state: "pending" },
  { key: "landingPage",  label: "Landing Page", state: "pending" },
  { key: "emailSequence",label: "Email",        state: "pending" },
  { key: "whatsappSequence", label: "WhatsApp",  state: "pending" },
  { key: "adCreatives",  label: "Ad Images",    state: "pending" },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: "1", type: "zappy-bubble", text: "Hey! Let's build you a campaign. 🦊", mood: "idle" },
  { id: "2", type: "zappy-bubble", text: "Tell me about your business — who do you help, and what do you do for them?", mood: "idle" },
  { id: "3", type: "user-bubble", text: "I help solopreneurs scale past $5K/month with a structured pipeline system." },
  { id: "4", type: "zappy-bubble", text: "Got it. Reading that like a strategist…", mood: "thinking" },
  { id: "5", type: "system-divider", text: "Service profile created" },
  { id: "6", type: "zappy-bubble", text: "So: you're a business scaling consultant helping solopreneurs stuck at $3–5K/month. Right?", mood: "idle", nodeKey: "service" },
  { id: "7", type: "chip-row", chips: ["That's me", "Not quite"] },
  // After confirmation:
  { id: "8", type: "zappy-bubble", text: "How do you want to do this?", mood: "idle" },
  { id: "9", type: "chip-row", chips: ["Build it for me ⚡", "I'll pick as we go", "I already have some pieces"] },
  { id: "10", type: "system-divider", text: "ICP generated" },
  { id: "11", type: "asset-reveal-card", nodeKey: "icp", reveal: {
    eyebrow: "YOUR IDEAL CUSTOMER",
    title: "The Plateaued Solopreneur",
    preview: "Service-based solopreneur earning $3–5K/month, stuck in feast-or-famine because they stop marketing every time a project lands.",
  }},
  { id: "12", type: "system-divider", text: "Offer generated" },
  { id: "13", type: "asset-reveal-card", nodeKey: "offer", reveal: {
    eyebrow: "YOUR OFFER",
    title: "The Pipeline Drought Protocol",
    preview: "12-week implementation: structured lead system that runs while you deliver. $2,497 with a 90-day revenue guarantee.",
    score: 100,
  }},
  { id: "14", type: "milestone-badge", milestone: {
    name: "FOUNDATION LOCKED",
    line: "The hard thinking is done. Everything from here builds on this.",
  }},
  { id: "15", type: "zappy-bubble", text: "Your method needs a name people remember.", mood: "idle", nodeKey: "uniqueMethod" },
  { id: "16", type: "card-deck", nodeKey: "uniqueMethod", deck: { cards: [
    { id: 1, title: "The Pipeline Drought Protocol", preview: "A sequenced system that ends the delivery-marketing seesaw.", selected: true },
    { id: 2, title: "The Revenue Rhythm Method", preview: "Predictable income through structured pipeline cadence." },
    { id: 3, title: "The Seesaw Eliminator", preview: "Stop the feast-famine cycle with parallel execution." },
  ]}},
  { id: "17", type: "zappy-bubble", text: "Now the free thing that pulls people in.", mood: "thinking", nodeKey: "freeOptIn" },
  { id: "18", type: "zappy-bubble", text: "It has to be worth paying for — that's the bar.", mood: "thinking" },
  // Extra messages to ensure scrolling
  { id: "19", type: "zappy-bubble", text: "Title's landing… almost there.", mood: "thinking" },
  { id: "20", type: "zappy-bubble", text: "Still cooking — good things, slow oven.", mood: "thinking" },
];

export default function ChatThreadDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const nodeRefMap = useRef(new Map<string, HTMLDivElement>());

  const handleChipTap = (messageId: string, chip: string) => {
    // Remove the chip-row, add user echo
    setMessages(prev => {
      const next = prev.filter(m => m.id !== messageId);
      next.push({
        id: `echo-${messageId}`,
        type: "user-bubble",
        text: chip,
      });
      return next;
    });
  };

  const handleStopClick = (key: string) => {
    const el = nodeRefMap.current.get(key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <V2Layout>
      <div style={{
        maxWidth: 640,
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px 0",
      }}>
        {/* TrailBar pinned at top */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <TrailBar stops={TRAIL_STOPS} onStopClick={handleStopClick} />
        </div>

        {/* ChatThread fills remaining space */}
        <div style={{
          flex: 1,
          minHeight: 0,
          background: "rgba(255,255,255,0.3)",
          borderRadius: "20px 20px 0 0",
          overflow: "hidden",
        }}>
          <ChatThread
            messages={messages}
            onChipTap={handleChipTap}
            nodeRefMap={nodeRefMap}
          />
        </div>
      </div>
    </V2Layout>
  );
}
