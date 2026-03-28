/**
 * V2AssetLibrary — Asset Library page.
 * Shows all generated images, videos, and copy assets across campaigns.
 * Includes Zappy AI retrieval panel.
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

const T = {
  bg: "#F5F1EA", dark: "#1A1624", orange: "#FF5B1D", purple: "#8B5CF6", muted: "#999",
  fontH: "'Fraunces', serif", fontB: "'Instrument Sans', sans-serif",
};

type AssetType = "all" | "images" | "videos" | "copy";

// ─── Favourite hook (inline — matches server procedure names) ────────────────
function useFavs(nodeId: string) {
  const { data: favs, refetch } = trpc.favourites.getByNode.useQuery({ nodeId });
  const addFav = trpc.favourites.add.useMutation({ onSuccess: () => refetch() });
  const removeFav = trpc.favourites.remove.useMutation({ onSuccess: () => refetch() });
  const favIndices = (favs || []).map((f: any) => f.itemIndex);
  const isFav = (idx: number) => favIndices.includes(idx);
  const toggle = (idx: number, text?: string) => {
    if (isFav(idx)) removeFav.mutate({ nodeId, itemIndex: idx });
    else addFav.mutate({ nodeId, itemIndex: idx, itemText: text || "" });
  };
  return { isFav, toggle };
}

export default function V2AssetLibrary() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [zappyOpen, setZappyOpen] = useState(false);
  const [zappyQuery, setZappyQuery] = useState("");
  const [zappyResults, setZappyResults] = useState<number[] | null>(null);
  const [zappyLoading, setZappyLoading] = useState(false);

  // Favourites
  const imgFavs = useFavs("library_images");
  const vidFavs = useFavs("library_videos");
  const copyFavs = useFavs("library_copy");

  // Fetch data
  const { data: images } = trpc.adCreatives.list.useQuery();
  const { data: videoData } = trpc.videos.list.useQuery({});
  const { data: services } = trpc.services.list.useQuery();

  const videos = useMemo(() => {
    const raw = (videoData as any)?.videos || videoData || [];
    return Array.isArray(raw) ? raw.filter((v: any) => v.creatomateStatus === "succeeded") : [];
  }, [videoData]);

  // Build campaign list from services (each service = a campaign context)
  const campaignList = useMemo(() => {
    if (!services || !Array.isArray(services)) return [];
    return (services as any[]).map((s: any) => ({ id: s.id, name: s.name }));
  }, [services]);

  // Filter helpers
  const matchSearch = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const matchCampaign = (serviceId: number | null) => campaignFilter === "all" || String(serviceId) === campaignFilter;

  const filteredImages = useMemo(() => {
    if (!images) return [];
    return (images as any[]).filter((img: any) =>
      matchSearch(`${img.headline || ""} ${img.productName || ""} ${img.niche || ""}`) &&
      matchCampaign(img.serviceId)
    );
  }, [images, search, campaignFilter]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v: any) =>
      matchSearch(`${v.title || ""} ${v.angle || ""}`) &&
      matchCampaign(v.serviceId)
    );
  }, [videos, search, campaignFilter]);

  // Copy assets — extract unique headlines from ad creatives
  const copyAssets = useMemo(() => {
    const items: { id: number; text: string; type: string; serviceId: number | null; date: string }[] = [];
    if (images && Array.isArray(images)) {
      const seen = new Set<string>();
      (images as any[]).forEach((img: any) => {
        const text = img.headline || img.productName;
        if (text && !seen.has(text)) {
          seen.add(text);
          items.push({ id: img.id, text, type: "Ad Headline", serviceId: img.serviceId, date: img.createdAt });
        }
      });
    }
    // Apply filters inline (not via closure)
    return items.filter(i => {
      if (search && !i.text.toLowerCase().includes(search.toLowerCase())) return false;
      if (campaignFilter !== "all" && String(i.serviceId) !== campaignFilter) return false;
      return true;
    });
  }, [images, search, campaignFilter]);

  const tabs: { key: AssetType; label: string; count: number }[] = [
    { key: "all", label: "All", count: filteredImages.length + filteredVideos.length + copyAssets.length },
    { key: "images", label: "Images", count: filteredImages.length },
    { key: "videos", label: "Videos", count: filteredVideos.length },
    { key: "copy", label: "Copy", count: copyAssets.length },
  ];

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };
  const downloadFile = (url: string, filename: string) => { const a = document.createElement("a"); a.href = url; a.download = filename; a.target = "_blank"; a.click(); };

  const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", position: "relative" };
  const btnS = (primary?: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 9999, border: primary ? "none" : "1px solid #e5e0d8",
    background: primary ? T.orange : "#fff", color: primary ? "#fff" : T.dark,
    fontFamily: T.fontB, fontWeight: 600, fontSize: 12, cursor: "pointer",
  });

  // Heart overlay component
  const Heart = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: "50%",
      background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex",
      alignItems: "center", justifyContent: "center", fontSize: 16, zIndex: 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    }}>
      {active ? "🧡" : "🤍"}
    </button>
  );

  // Zappy search
  const handleZappySearch = useCallback(async () => {
    if (!zappyQuery.trim()) return;
    setZappyLoading(true);
    try {
      // Build asset list for context
      const assetList = [
        ...filteredImages.map((img: any) => ({ id: img.id, type: "image", text: img.headline || `Image ${img.id}` })),
        ...filteredVideos.map((v: any) => ({ id: v.id, type: "video", text: v.title || `Video ${v.id}` })),
        ...copyAssets.map(c => ({ id: c.id, type: "copy", text: c.text })),
      ];
      const res = await fetch("/api/asset-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: zappyQuery, assets: assetList }),
      });
      if (res.ok) {
        const data = await res.json();
        setZappyResults(data.matchingIds || []);
      } else {
        toast.error("Zappy couldn't search right now");
      }
    } catch { toast.error("Search failed"); }
    setZappyLoading(false);
  }, [zappyQuery, filteredImages, filteredVideos, copyAssets]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px", background: T.bg, minHeight: "100vh" }}>
      {/* Back link */}
      <a href="/v2-dashboard" onClick={e => { e.preventDefault(); navigate("/v2-dashboard"); }}
        style={{ fontFamily: T.fontB, fontSize: 13, color: T.muted, textDecoration: "none", display: "block", marginBottom: 12 }}>
        ← Back to Dashboard
      </a>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: T.fontH, fontStyle: "italic", fontWeight: 900, fontSize: 28, color: T.dark, margin: 0 }}>Asset Library</h1>
        <p style={{ fontFamily: T.fontB, fontSize: 14, color: T.muted, margin: "4px 0 0" }}>Browse and reuse everything you've generated</p>
      </div>

      {/* Search + Campaign filter + Tabs */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 14, outline: "none", background: "#fff", color: T.dark }} />
        <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, background: "#fff", color: T.dark, cursor: "pointer", minWidth: 160 }}>
          <option value="all">All Campaigns</option>
          {campaignList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      {/* Type tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 3, border: "1px solid #e5e0d8", marginBottom: 20, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: tab === t.key ? T.orange : "transparent",
            color: tab === t.key ? "#fff" : T.muted,
            fontFamily: T.fontB, fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>

        {/* ── IMAGE CARDS ── */}
        {(tab === "all" || tab === "images") && filteredImages.map((img: any, idx: number) => (
          <div key={`img-${img.id}`} style={cardStyle}>
            <Heart active={imgFavs.isFav(img.id)} onClick={() => imgFavs.toggle(img.id, img.headline)} />
            <div style={{ aspectRatio: "1/1", overflow: "hidden" }}>
              <img src={img.imageUrl} alt={img.headline || "Ad image"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ fontFamily: T.fontB, fontWeight: 600, fontSize: 14, color: T.dark, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {img.headline || img.productName || `Ad Image #${img.id}`}
              </p>
              <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 10px" }}>
                {img.productName || "Campaign"} · {new Date(img.createdAt).toLocaleDateString()}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => downloadFile(img.imageUrl, `zap-image-${img.id}.png`)} style={btnS(true)}>Download</button>
                <button onClick={() => copyToClipboard(img.imageUrl)} style={btnS()}>Copy URL</button>
              </div>
            </div>
          </div>
        ))}

        {/* ── VIDEO CARDS ── */}
        {(tab === "all" || tab === "videos") && filteredVideos.map((v: any) => (
          <div key={`vid-${v.id}`} style={cardStyle}>
            <Heart active={vidFavs.isFav(v.id)} onClick={() => vidFavs.toggle(v.id, v.title)} />
            <div style={{ aspectRatio: "9/16", maxHeight: 300, overflow: "hidden", position: "relative", background: "#111" }}>
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title || "Video"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 48, color: "rgba(255,255,255,0.3)" }}>▶</span>
                </div>
              )}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,91,29,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                onClick={() => v.videoUrl && window.open(v.videoUrl, "_blank")}>
                <span style={{ color: "#fff", fontSize: 20, marginLeft: 3 }}>▶</span>
              </div>
              <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: T.fontB, fontWeight: 600 }}>
                {v.duration || "30"}s
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
                {v.videoUrl && <button onClick={() => downloadFile(v.videoUrl, `zap-video-${v.id}.mp4`)} style={btnS(true)}>Download MP4</button>}
              </div>
            </div>
          </div>
        ))}

        {/* ── COPY CARDS ── */}
        {(tab === "all" || tab === "copy") && copyAssets.map((c, idx) => (
          <div key={`copy-${c.id}-${idx}`} style={{ ...cardStyle, padding: "16px 18px" }}>
            <Heart active={copyFavs.isFav(c.id)} onClick={() => copyFavs.toggle(c.id, c.text)} />
            <span style={{ fontFamily: T.fontB, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.orange, display: "block", marginBottom: 8, marginTop: 4 }}>
              {c.type}
            </span>
            <p style={{ fontFamily: T.fontB, fontSize: 14, color: T.dark, margin: "0 0 10px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
              {c.text}
            </p>
            <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 10px" }}>
              {new Date(c.date).toLocaleDateString()}
            </p>
            <button onClick={() => copyToClipboard(c.text)} style={btnS(true)}>Copy to Clipboard</button>
          </div>
        ))}
      </div>

      {/* Empty states */}
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
      {tab === "copy" && copyAssets.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <p style={{ fontFamily: T.fontB, fontSize: 16, color: T.muted }}>No copy assets yet. Generate headlines or ad copy to see them here.</p>
        </div>
      )}

      {/* ── ZAPPY FAB ── */}
      <button onClick={() => setZappyOpen(!zappyOpen)} style={{
        position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
        background: T.orange, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 16px rgba(255,91,29,0.35)", zIndex: 100, fontSize: 24, color: "#fff",
      }}>
        🦊
      </button>

      {/* ── ZAPPY PANEL ── */}
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
            {zappyLoading && <p style={{ fontFamily: T.fontB, fontSize: 13, color: T.orange, textAlign: "center" }}>Searching...</p>}
            {zappyResults && zappyResults.length === 0 && (
              <p style={{ fontFamily: T.fontB, fontSize: 13, color: T.muted, textAlign: "center" }}>No matching assets found. Try a different search.</p>
            )}
            {zappyResults && zappyResults.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {zappyResults.map(id => {
                  const img = filteredImages.find((i: any) => i.id === id);
                  const vid = filteredVideos.find((v: any) => v.id === id);
                  if (img) return (
                    <div key={`z-${id}`} style={{ background: "#f9f8f5", borderRadius: 10, overflow: "hidden" }}>
                      <img src={(img as any).imageUrl} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                      <p style={{ fontFamily: T.fontB, fontSize: 11, padding: "6px 8px", margin: 0, color: T.dark }}>{(img as any).headline || `Image ${id}`}</p>
                    </div>
                  );
                  if (vid) return (
                    <div key={`z-${id}`} style={{ background: "#f9f8f5", borderRadius: 10, padding: "8px" }}>
                      <p style={{ fontFamily: T.fontB, fontSize: 11, margin: 0, color: T.dark }}>🎬 {(vid as any).title || `Video ${id}`}</p>
                    </div>
                  );
                  return null;
                })}
              </div>
            )}
            {!zappyResults && !zappyLoading && (
              <p style={{ fontFamily: T.fontB, fontSize: 13, color: T.muted, textAlign: "center", margin: "20px 0" }}>
                Ask me to find any asset. Try "my fitness videos" or "headlines about identity"
              </p>
            )}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
            <input type="text" placeholder="Find my webinar ads..." value={zappyQuery}
              onChange={e => setZappyQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleZappySearch()}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, outline: "none", color: T.dark, background: "#fff" }} />
            <button onClick={handleZappySearch} disabled={zappyLoading} style={{ ...btnS(true), padding: "10px 16px" }}>Search</button>
          </div>
        </div>
      )}
    </div>
  );
}
