/**
 * V2AssetLibrary — Asset Library page.
 * Shows all generated images, videos, and copy assets across campaigns.
 * Includes Zappy AI retrieval panel.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Campaign Kit download helper ────────────────────────────────────────────
function triggerZipDownload(base64: string, filename: string) {
  const blob = new Blob(
    [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
    { type: "application/zip" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const T = {
  bg: "#F5F1EA", dark: "#1A1624", orange: "#FF5B1D", purple: "#8B5CF6", muted: "#999",
  fontH: "'Fraunces', serif", fontB: "'Instrument Sans', sans-serif",
};

type AssetType = "all" | "images" | "videos" | "copy";

// ─── Favourite hook (inline — matches server procedure names) ────────────────
function useFavs(nodeId: string) {
  const { data: favs, refetch } = trpc.favourites.getByNode.useQuery({ nodeId });
  const addFav = trpc.favourites.add.useMutation({
    onSuccess: () => { console.log(`[Favs] Added to ${nodeId}, refetching...`); refetch(); },
    onError: (e: any) => { console.error(`[Favs] Add failed:`, e.message); },
  });
  const removeFav = trpc.favourites.remove.useMutation({
    onSuccess: () => { console.log(`[Favs] Removed from ${nodeId}, refetching...`); refetch(); },
    onError: (e: any) => { console.error(`[Favs] Remove failed:`, e.message); },
  });
  const favIndices = useMemo(() => (favs || []).map((f: any) => f.itemIndex), [favs]);
  const isFav = (idx: number) => favIndices.includes(idx);
  const toggle = (idx: number, text?: string) => {
    console.log(`[Favs] Toggle ${nodeId} item ${idx}, currently fav: ${isFav(idx)}`);
    if (isFav(idx)) removeFav.mutate({ nodeId, itemIndex: idx });
    else addFav.mutate({ nodeId, itemIndex: idx, itemText: text || "" });
  };
  return { isFav, toggle };
}

// Flatten adCreatives.list response — it returns batches ({ batchId, creatives: [...] })
// so we extract the individual creative objects from each batch
function flattenCreatives(data: any): any[] {
  if (!data || !Array.isArray(data)) return [];
  const flat: any[] = [];
  for (const item of data) {
    if (item.creatives && Array.isArray(item.creatives)) {
      flat.push(...item.creatives);
    } else {
      flat.push(item);
    }
  }
  return flat;
}

export default function V2AssetLibrary() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zappyOpen, setZappyOpen] = useState(false);
  const [zappyQuery, setZappyQuery] = useState("");
  const [zappyResults, setZappyResults] = useState<number[] | null>(null);
  const [zappyLoading, setZappyLoading] = useState(false);

  // Clear Zappy results when user empties the query field
  useEffect(() => {
    if (zappyQuery === "") setZappyResults(null);
  }, [zappyQuery]);

  // Favourites
  const imgFavs = useFavs("library_images");
  const vidFavs = useFavs("library_videos");
  const copyFavs = useFavs("library_copy");

  // tRPC utils for imperative calls
  const utils = trpc.useUtils();

  // Campaign Kit download handler
  const handleDownloadCampaignKit = useCallback(async (serviceId: number, serviceName: string) => {
    setZipLoading(true);
    setZipError(null);
    try {
      const result = await utils.campaignExport.generateCampaignZip.fetch({ serviceId });
      triggerZipDownload(result.base64, result.filename);
      toast.success(`Downloaded ${result.filename}`);
    } catch (err: any) {
      const msg = err?.message || "Download failed";
      setZipError(msg);
      toast.error(`Download failed: ${msg}`);
    } finally {
      setZipLoading(false);
    }
  }, [utils]);

  // Fetch data
  const { data: rawImages } = trpc.adCreatives.list.useQuery();
  const { data: videoData } = trpc.videos.list.useQuery({});
  const { data: services } = trpc.services.list.useQuery();

  // Flatten batched response into individual creatives
  const images = useMemo(() => flattenCreatives(rawImages), [rawImages]);

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
    return images.filter((img: any) =>
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
    const seen = new Set<string>();
    images.forEach((img: any) => {
      const text = img.headline || img.productName;
      if (text && !seen.has(text)) {
        seen.add(text);
        items.push({ id: img.id, text, type: "Ad Headline", serviceId: img.serviceId, date: img.createdAt });
      }
    });
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
      // Build enriched asset list — title, campaign name, nodeType, favourite status, and date
      // are all included so Zappy can match queries like "my latest videos", "saved headlines",
      // "incredible you campaign images", or "identity ads"
      const getCampaignName = (serviceId: number | null) =>
        campaignList.find(c => c.id === serviceId)?.name || "Unknown Campaign";
      // Cap at 150 assets and 80-char titles to prevent oversized LLM context payloads.
      const rawAssetList = [
        ...filteredImages.map((img: any) => ({
          id: img.id,
          type: "image",
          title: (img.headline || img.productName || `Image ${img.id}`).slice(0, 80),
          campaignName: getCampaignName(img.serviceId),
          nodeType: "adCreatives",
          isFavourite: imgFavs.isFav(img.id),
          createdAt: img.createdAt || null,
        })),
        ...filteredVideos.map((v: any) => ({
          id: v.id,
          type: "video",
          title: (v.title || v.angle || `Video ${v.id}`).slice(0, 80),
          campaignName: getCampaignName(v.serviceId),
          nodeType: "videos",
          isFavourite: vidFavs.isFav(v.id),
          createdAt: v.createdAt || null,
        })),
        ...copyAssets.map(c => ({
          id: c.id,
          type: "copy",
          title: c.text.slice(0, 80),
          campaignName: getCampaignName(c.serviceId),
          nodeType: c.type === "Ad Headline" ? "headlines" : "adCopy",
          isFavourite: copyFavs.isFav(c.id),
          createdAt: c.date || null,
        })),
      ];
      const assetList = rawAssetList.length > 150
        ? [...rawAssetList]
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
            .slice(0, 150)
        : rawAssetList;
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
    <div style={{ position: "fixed", inset: 0, background: T.bg, overflowY: "auto", zIndex: 1 }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
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
        <select value={campaignFilter} onChange={e => { setCampaignFilter(e.target.value); setZipError(null); }}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, background: "#fff", color: T.dark, cursor: "pointer", minWidth: 160 }}>
          <option value="all">All Campaigns</option>
          {campaignList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        {campaignFilter !== "all" && (() => {
          const selectedService = campaignList.find(c => String(c.id) === campaignFilter);
          return selectedService ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <button
                onClick={() => handleDownloadCampaignKit(selectedService.id, selectedService.name)}
                disabled={zipLoading}
                style={{
                  background: "transparent",
                  border: "1px solid #1A1624",
                  color: "#1A1624",
                  borderRadius: "9999px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontFamily: "Instrument Sans, sans-serif",
                  cursor: zipLoading ? "not-allowed" : "pointer",
                  marginLeft: "12px",
                  opacity: zipLoading ? 0.6 : 1,
                  whiteSpace: "nowrap" as const,
                }}
              >
                {zipLoading ? "Generating..." : "Download Campaign Kit"}
              </button>
              {zipError && (
                <span style={{ marginLeft: "12px", marginTop: "4px", fontSize: "12px", color: "red", fontFamily: "Instrument Sans, sans-serif" }}>
                  {zipError}
                </span>
              )}
            </div>
          ) : null;
        })()}
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
            <div style={{ aspectRatio: "1/1", overflow: "hidden", background: "#f0ede6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {img.imageUrl ? (
                <img src={`/api/image-proxy?url=${encodeURIComponent(img.imageUrl)}`} alt={img.headline || "Ad image"} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span style={{ fontSize: 32, color: T.muted }}>🖼</span>
              )}
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
        {(tab === "all" || tab === "videos") && filteredVideos.map((v: any) => {
          // Derive thumbnail: use stored thumbnailUrl, or convert Cloudinary video URL to poster
          const posterUrl = v.thumbnailUrl || (v.videoUrl ? v.videoUrl.replace(/\.mp4$/i, ".jpg").replace(/\/video\/upload\//, "/video/upload/so_0/") : null);
          return (
          <div key={`vid-${v.id}`} style={cardStyle}>
            <Heart active={vidFavs.isFav(v.id)} onClick={() => vidFavs.toggle(v.id, v.title)} />
            <div style={{ aspectRatio: "9/16", maxHeight: 300, overflow: "hidden", position: "relative", background: "#111" }}>
              {posterUrl ? (
                <img src={posterUrl} alt={v.title || "Video"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
        ); })}

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
                  const copy = copyAssets.find(c => c.id === id);
                  if (img) return (
                    <div key={`z-${id}`} style={{ background: "#f9f8f5", borderRadius: 10, overflow: "hidden" }}>
                      <img src={`/api/image-proxy?url=${encodeURIComponent((img as any).imageUrl)}`} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                      <p style={{ fontFamily: T.fontB, fontSize: 11, padding: "6px 8px", margin: 0, color: T.dark }}>{(img as any).headline || `Image ${id}`}</p>
                    </div>
                  );
                  if (vid) return (
                    <div key={`z-${id}`} style={{ background: "#f9f8f5", borderRadius: 10, padding: "8px" }}>
                      <p style={{ fontFamily: T.fontB, fontSize: 11, margin: 0, color: T.dark }}>🎬 {(vid as any).title || `Video ${id}`}</p>
                    </div>
                  );
                  if (copy) return (
                    <div key={`z-${id}`} style={{ background: "#f9f8f5", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontFamily: T.fontB, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.orange }}>{copy.type}</span>
                      <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.dark, margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{copy.text}</p>
                      <button onClick={() => copyToClipboard(copy.text)} style={{ ...btnS(true), fontSize: 11, padding: "4px 10px", alignSelf: "flex-start" }}>Copy</button>
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
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
              <input type="text" placeholder="Find my webinar ads..." value={zappyQuery}
                onChange={e => setZappyQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleZappySearch()}
                style={{ width: "100%", padding: "10px 32px 10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, outline: "none", color: T.dark, background: "#fff", boxSizing: "border-box" as const }} />
              {zappyQuery && (
                <button
                  onClick={() => { setZappyQuery(""); setZappyResults(null); }}
                  style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16, lineHeight: 1, padding: 2 }}
                >✕</button>
              )}
            </div>
            <button onClick={handleZappySearch} disabled={zappyLoading} style={{ ...btnS(true), padding: "10px 16px" }}>Search</button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
