/**
 * RecommendedAssetPanel — shared "single recommendation" UI for all content nodes.
 * Shows one auto-selected best asset with "Use This & Continue",
 * optionally reveals 2 alternatives, and a "See All" drawer for power users.
 */
import { useState } from "react";
import ZappyMascot from "./ZappyMascot";
import { useFavourites } from "./hooks/useFavourites";

interface AssetItem {
  id: number;
  content: string;
  score: number | null;
  formulaLabel?: string;
  characterCount?: number;
}

interface RecommendedAssetPanelProps {
  primaryAsset: AssetItem;
  alternativeAssets: AssetItem[];
  allAssets: AssetItem[];
  nodeLabel: string;
  nodeId: string;
  isFirstCampaign: boolean;
  onSelect: (assetId: number) => void;
  onRegenerate: () => void;
}

// Formula label friendly names map
const FORMULA_LABELS: Record<string, string> = {
  story: "Tell Your Story",
  eyebrow: "Make a Bold Claim",
  question: "Ask Their Question",
  authority: "Lead with Credentials",
  urgency: "Create Urgency",
};

export default function RecommendedAssetPanel({
  primaryAsset,
  alternativeAssets,
  allAssets,
  nodeLabel,
  nodeId,
  isFirstCampaign,
  onSelect,
  onRegenerate,
}: RecommendedAssetPanelProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const { isFavourited, toggle: toggleFav } = useFavourites(nodeId);
  const [showAll, setShowAll] = useState(false);

  const formatLabel = (label?: string) => {
    if (!label) return null;
    return FORMULA_LABELS[label] || label;
  };

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      {/* Zappy + heading */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <ZappyMascot state="cheering" size={90} />
        <h2 style={{
          fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "22px",
          color: "var(--v2-text-dark, #1A1624)",
          margin: "12px 0 0",
        }}>
          Your {nodeLabel} is ready
        </h2>
      </div>

      {/* Primary asset card */}
      <div style={{
        background: "#fff",
        border: "2px solid rgba(34, 197, 94, 0.3)",
        borderRadius: "24px",
        padding: "32px",
        marginBottom: "16px",
      }}>
        <p style={{
          fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "20px",
          color: "var(--v2-text-dark, #1A1624)",
          margin: "0 0 12px",
          lineHeight: 1.4,
        }}>
          "{primaryAsset.content}"
        </p>
        {primaryAsset.formulaLabel && (
          <p style={{
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--v2-primary-btn, #FF5B1D)",
            margin: "0 0 8px",
          }}>
            {formatLabel(primaryAsset.formulaLabel)}
          </p>
        )}
        <p style={{
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontSize: "12px",
          color: "#999",
          margin: 0,
        }}>
          {primaryAsset.score != null ? `${primaryAsset.score}/100` : ""}
          {primaryAsset.characterCount != null ? ` · ${primaryAsset.characterCount} characters` : ""}
          {primaryAsset.score != null && primaryAsset.score >= 80 ? " · Meta Ready" : ""}
        </p>
        <button
          onClick={() => toggleFav(primaryAsset.id, primaryAsset.content)}
          style={{
            marginTop: "12px",
            padding: "6px 16px",
            borderRadius: "9999px",
            border: isFavourited(primaryAsset.id) ? "2px solid #FF5B1D" : "1px solid rgba(0,0,0,0.12)",
            background: isFavourited(primaryAsset.id) ? "rgba(255,91,29,0.08)" : "transparent",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          👍 {isFavourited(primaryAsset.id) ? "Favourited" : "Favourite"}
        </button>
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => onSelect(primaryAsset.id)}
        style={{
          width: "100%",
          padding: "14px 24px",
          borderRadius: "var(--v2-border-radius-pill, 9999px)",
          border: "none",
          background: "var(--v2-primary-btn, #FF5B1D)",
          color: "#fff",
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontWeight: 700,
          fontSize: "15px",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        Use This & Continue
      </button>

      {/* Show alternatives toggle */}
      {!showAlternatives && alternativeAssets.length > 0 && (
        <p
          onClick={() => setShowAlternatives(true)}
          style={{
            textAlign: "center",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "13px",
            color: "#999",
            cursor: "pointer",
            margin: "0 0 8px",
          }}
        >
          Show Me 2 More Styles
        </p>
      )}

      {/* Alternative cards */}
      {showAlternatives && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
          {alternativeAssets.map(alt => (
            <div key={alt.id} style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid rgba(0,0,0,0.08)",
              width: "90%",
              margin: "0 auto",
            }}>
              <p style={{
                fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "16px",
                color: "var(--v2-text-dark, #1A1624)",
                margin: "0 0 8px",
                lineHeight: 1.4,
              }}>
                "{alt.content}"
              </p>
              <p style={{
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                fontSize: "11px",
                color: "#999",
                margin: "0 0 10px",
              }}>
                {formatLabel(alt.formulaLabel)} · {alt.score != null ? `${alt.score}/100` : ""}
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={() => toggleFav(alt.id, alt.content)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: isFavourited(alt.id) ? "2px solid #FF5B1D" : "1px solid rgba(0,0,0,0.12)",
                    background: isFavourited(alt.id) ? "rgba(255,91,29,0.08)" : "transparent",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  👍
                </button>
                <button
                  onClick={() => onSelect(alt.id)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "var(--v2-border-radius-pill, 9999px)",
                    border: "1px solid #ddd",
                    background: "transparent",
                    color: "#666",
                    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Use This Instead
                </button>
              </div>
            </div>
          ))}
          <p style={{
            textAlign: "center",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "12px",
            color: "#999",
            margin: "8px 0 0",
          }}>
            Don't like any of these?{" "}
            <span onClick={onRegenerate} style={{ color: "var(--v2-primary-btn, #FF5B1D)", cursor: "pointer", fontWeight: 600 }}>
              Regenerate all
            </span>
          </p>
        </div>
      )}

      {/* See All drawer toggle — only for returning users */}
      {!isFirstCampaign && allAssets.length > 3 && (
        <>
          <p
            onClick={() => setShowAll(!showAll)}
            style={{
              textAlign: "center",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
              fontSize: "12px",
              color: "#bbb",
              cursor: "pointer",
              marginTop: "20px",
            }}
          >
            {showAll ? "Hide all" : `View all ${allAssets.length} ${nodeLabel}s`}
          </p>
          {showAll && (
            <div style={{
              marginTop: "12px",
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid rgba(0,0,0,0.06)",
              padding: "16px",
              maxHeight: "400px",
              overflowY: "auto",
            }}>
              {allAssets.map(a => (
                <div key={a.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                      fontSize: "13px",
                      color: "var(--v2-text-dark, #1A1624)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {a.content}
                    </p>
                    <p style={{
                      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                      fontSize: "11px",
                      color: "#999",
                      margin: "2px 0 0",
                    }}>
                      {formatLabel(a.formulaLabel)} · {a.score != null ? `${a.score}/100` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onSelect(a.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "var(--v2-border-radius-pill, 9999px)",
                      border: "1px solid #ddd",
                      background: "transparent",
                      color: "#666",
                      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                      fontWeight: 600,
                      fontSize: "11px",
                      cursor: "pointer",
                      flexShrink: 0,
                      marginLeft: "8px",
                    }}
                  >
                    Use This
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
