/**
 * V2AssetLibrary — Asset Library page.
 * Shows all generated images, videos, and copy assets across campaigns.
 * Includes Zappy AI retrieval panel.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const T = {
  bg: "#F5F1EA",
  dark: "#1A1624",
  orange: "#FF5B1D",
  purple: "#8B5CF6",
  muted: "#999",
  fontH: "'Fraunces', serif",
  fontB: "'Instrument Sans', sans-serif",
};

type AssetType = "all" | "images" | "videos" | "copy";

export default function V2AssetLibrary() {
  const [tab, setTab] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [zappyOpen, setZappyOpen] = useState(false);

  // Fetch data
  const { data: images } = trpc.adCreatives.list.useQuery();
  const { data: videoData } = trpc.videos.list.useQuery({});
  const { data: headlines } = trpc.headlines.list.useQuery(undefined as any);

  const videos = (videoData as any)?.videos || videoData || [];

  // Filter
  const filteredImages = useMemo(() => {
    if (!images) return [];
    return (images as any[]).filter((img: any) => {
      if (search) {
        const s = search.toLowerCase();
        const matches = (img.headline || "").toLowerCase().includes(s)
          || (img.productName || "").toLowerCase().includes(s)
          || (img.niche || "").toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });
  }, [images, search]);

  const filteredVideos = useMemo(() => {
    if (!videos || !Array.isArray(videos)) return [];
    return videos.filter((v: any) => {
      if (v.creatomateStatus !== "succeeded") return false;
      if (search) {
        const s = search.toLowerCase();
        return (v.title || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [videos, search]);

  const tabs: { key: AssetType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "videos", label: "Videos" },
    { key: "copy", label: "Copy" },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.click();
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    transition: "transform 150ms, box-shadow 150ms",
  };

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 9999,
    border: primary ? "none" : "1px solid #e5e0d8",
    background: primary ? T.orange : "#fff",
    color: primary ? "#fff" : T.dark,
    fontFamily: T.fontB,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: T.fontH, fontStyle: "italic", fontWeight: 900, fontSize: 28, color: T.dark, margin: 0 }}>
          Asset Library
        </h1>
        <p style={{ fontFamily: T.fontB, fontSize: 14, color: T.muted, margin: "4px 0 0" }}>
          Browse and reuse everything you've generated
        </p>
      </div>

      {/* Search + Tabs */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 12,
            border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 14, outline: "none", background: "#fff",
          }}
        />
        <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 3, border: "1px solid #e5e0d8" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: tab === t.key ? T.orange : "transparent",
                color: tab === t.key ? "#fff" : T.muted,
                fontFamily: T.fontB, fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {/* Images */}
        {(tab === "all" || tab === "images") && filteredImages.map((img: any) => (
          <div key={`img-${img.id}`} style={cardStyle}>
            <div style={{ aspectRatio: "1/1", overflow: "hidden" }}>
              <img src={img.imageUrl} alt={img.headline || "Ad image"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ fontFamily: T.fontB, fontWeight: 600, fontSize: 14, color: T.dark, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {img.headline || `Ad Image ${img.id}`}
              </p>
              <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 10px" }}>
                {img.productName || "Campaign"} · {new Date(img.createdAt).toLocaleDateString()}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => downloadFile(img.imageUrl, `zap-image-${img.id}.png`)} style={btnStyle(true)}>Download</button>
                <button onClick={() => copyToClipboard(img.imageUrl)} style={btnStyle()}>Copy URL</button>
              </div>
            </div>
          </div>
        ))}

        {/* Videos */}
        {(tab === "all" || tab === "videos") && filteredVideos.map((v: any) => (
          <div key={`vid-${v.id}`} style={cardStyle}>
            <div style={{ aspectRatio: "9/16", maxHeight: 300, overflow: "hidden", position: "relative", background: "#111" }}>
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title || "Video"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 48, color: "rgba(255,255,255,0.3)" }}>▶</span>
                </div>
              )}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,91,29,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                onClick={() => v.videoUrl && window.open(v.videoUrl, "_blank")}
              >
                <span style={{ color: "#fff", fontSize: 20, marginLeft: 3 }}>▶</span>
              </div>
              <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: T.fontB, fontWeight: 600 }}>
                {v.duration || v.actualDuration || "30"}s
              </span>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ fontFamily: T.fontB, fontWeight: 600, fontSize: 14, color: T.dark, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v.title || `Video ${v.id}`}
              </p>
              <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 10px" }}>
                {v.angle || "Ad"} · {new Date(v.createdAt).toLocaleDateString()}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                {v.videoUrl && <button onClick={() => downloadFile(v.videoUrl, `zap-video-${v.id}.mp4`)} style={btnStyle(true)}>Download MP4</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {tab === "images" && filteredImages.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <p style={{ fontFamily: T.fontB, fontSize: 16, color: T.muted }}>No images yet. Generate ad images in the campaign wizard.</p>
        </div>
      )}
      {tab === "videos" && filteredVideos.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <p style={{ fontFamily: T.fontB, fontSize: 16, color: T.muted }}>No videos yet. Create a video in the Ad Copy node.</p>
        </div>
      )}

      {/* Zappy FAB */}
      <button
        onClick={() => setZappyOpen(!zappyOpen)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
          background: T.orange, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(255,91,29,0.35)", zIndex: 100,
          fontSize: 24, color: "#fff",
        }}
      >
        🦊
      </button>

      {/* Zappy Panel */}
      {zappyOpen && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, width: 380, maxHeight: "60vh",
          background: "#fff", borderRadius: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          zIndex: 101, display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: T.fontB, fontWeight: 700, fontSize: 15, color: T.dark }}>🦊 Ask Zappy</span>
            <button onClick={() => setZappyOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <p style={{ fontFamily: T.fontB, fontSize: 13, color: T.muted, textAlign: "center", margin: "20px 0" }}>
              Ask me to find any asset. Try "my fitness videos" or "headlines about identity"
            </p>
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Find my webinar ads..."
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 12,
                border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, outline: "none",
              }}
            />
            <button style={{ ...btnStyle(true), padding: "10px 16px" }}>Search</button>
          </div>
        </div>
      )}
    </div>
  );
}
