/**
 * ExportButtons — shared Download TXT / Download PDF buttons for result panels.
 */
import { downloadTxt, downloadPdf } from "../lib/exportUtils";

interface ExportButtonsProps {
  content: string;
  serviceName: string;
  nodeName: string;
  showPdf?: boolean;
  isFreeTier?: boolean;
}

export default function ExportButtons({ content, serviceName, nodeName, showPdf = false, isFreeTier = false }: ExportButtonsProps) {
  if (!content) return null;

  const F = "'Instrument Sans', system-ui, sans-serif";

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
      <button
        onClick={() => downloadTxt(content, serviceName, nodeName)}
        style={{
          padding: "8px 16px",
          borderRadius: 9999,
          border: "1px solid #e5e0d8",
          background: "#fff",
          fontFamily: F,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          color: "#1A1624",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        📄 Download TXT
      </button>
      {showPdf && (
        isFreeTier ? (
          <button
            title="Upgrade to Pro for PDF export"
            style={{
              padding: "8px 16px",
              borderRadius: 9999,
              border: "1px solid #e5e0d8",
              background: "#f5f5f5",
              fontFamily: F,
              fontWeight: 600,
              fontSize: 12,
              cursor: "not-allowed",
              color: "#bbb",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🔒 Download PDF (Pro)
          </button>
        ) : (
          <button
            onClick={() => downloadPdf(content, serviceName, nodeName)}
            style={{
              padding: "8px 16px",
              borderRadius: 9999,
              border: "none",
              background: "#FF5B1D",
              fontFamily: F,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📑 Download PDF
          </button>
        )
      )}
    </div>
  );
}
