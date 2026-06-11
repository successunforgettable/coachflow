/**
 * TrailBarDemo — mock data page for TrailBar visual verification.
 * Renders all 5 stop states in a single view for screenshot proof.
 * NOT user-facing — accessed only via direct URL for dev verification.
 */
import V2Layout from "./V2Layout";
import TrailBar, { type TrailStop } from "./components/TrailBar";

const MOCK_STOPS: TrailStop[] = [
  { key: "service",          label: "Service",    state: "done" },
  { key: "icp",              label: "ICP",        state: "done" },
  { key: "offer",            label: "Offer",      state: "imported" },
  { key: "uniqueMethod",     label: "Method",     state: "stale" },
  { key: "freeOptIn",        label: "Lead Magnet", state: "done" },
  { key: "headlines",        label: "Headlines",  state: "generating" },
  { key: "adCopy",           label: "Ad Copy",    state: "pending" },
  { key: "landingPage",      label: "Landing Page", state: "pending" },
  { key: "emailSequence",    label: "Email",      state: "pending" },
  { key: "whatsappSequence", label: "WhatsApp",   state: "pending" },
  { key: "adCreatives",      label: "Ad Images",  state: "pending" },
];

export default function TrailBarDemo() {
  return (
    <V2Layout>
      <div style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 24,
          fontWeight: 700,
          fontStyle: "italic",
          marginBottom: 24,
          color: "#1A1624",
        }}>
          TrailBar — All 5 States
        </h1>
        <p style={{ fontSize: 13, color: "#1A1624", opacity: 0.6, marginBottom: 20 }}>
          done (check) · imported (paperclip) · stale (amber refresh) · generating (pulsing ring) · pending (hollow)
        </p>
        <TrailBar
          stops={MOCK_STOPS}
          onStopClick={(key, state) => {
            console.log("TrailBar stop clicked:", key, state);
          }}
        />
      </div>
    </V2Layout>
  );
}
