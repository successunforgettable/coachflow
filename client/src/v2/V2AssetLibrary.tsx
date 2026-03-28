/**
 * V2AssetLibrary — Asset Library page.
 * Shows all generated images, videos, and copy assets across campaigns.
 * Includes Zappy AI retrieval (inline, top of page).
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

const T = {
  bg: "#F5F1EA", dark: "#1A1624", orange: "#FF5B1D", purple: "#8B5CF6", muted: "#999",
  fontH: "'Fraunces', serif", fontB: "'Instrument Sans', sans-serif",
};

// ─── CHANGE 1: Campaign colour system ───────────────────────────────────────
const CAMPAIGN_COLOURS = ["#FF5B1D", "#8B5CF6", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444"];
function getCampaignColour(id: number): string {
  return CAMPAIGN_COLOURS[Math.abs(id) % CAMPAIGN_COLOURS.length];
}

// ─── CHANGE 2: Video title parser ────────────────────────────────────────────
// Input: "incredible you — IDENTITY Ad (5 scenes, 110 words)"
// Output: { campaignName, angle, scenes, words }
function parseVideoTitle(title: string) {
  const raw = (title || "Untitled").trim();
  const sepIdx = raw.indexOf(" — ");
  if (sepIdx === -1) return { campaignName: raw, angle: "", scenes: null as string | null, words: null as string | null };
  const campaignName = raw.slice(0, sepIdx).trim();
  const rest = raw.slice(sepIdx + 3).trim();
  const angleMatch = rest.match(/^(\w+)\s+Ad\b/i);
  const angle = angleMatch ? angleMatch[1].toUpperCase() : "";
  const metaMatch = rest.match(/\((\d+)\s+scenes?,\s*(\d+)\s+words?\)/i);
  return {
    campaignName,
    angle,
    scenes: metaMatch ? metaMatch[1] : null as string | null,
    words: metaMatch ? metaMatch[2] : null as string | null,
  };
}

type AssetType = "all" | "images" | "videos" | "copy";

const SUGGESTION_CHIPS = [
  "my latest videos",
  "identity ads",
  "headlines I saved",
  "best performing images",
];

// ─── Favourite hook ──────────────────────────────────────────────────────────
function useFavs(nodeId: string) {
  const { data: favs, refetch } = trpc.favourites.getByNode.useQuery({ nodeId });
  const addFav = trpc.favourites.add.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e: any) => { console.error(`[Favs] Add failed:`, e.message); },
  });
  const removeFav = trpc.favourites.remove.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e: any) => { console.error(`[Favs] Remove failed:`, e.message); },
  });
  const favIndices = useMemo(() => (favs || []).map((f: any) => f.itemIndex), [favs]);
  const isFav = (idx: number) => favIndices.includes(idx);
  const toggle = (idx: number, text?: string) => {
    if (isFav(idx)) removeFav.mutate({ nodeId, itemIndex: idx });
    else addFav.mutate({ nodeId, itemIndex: idx, itemText: text || "" });
  };
  return { isFav, toggle };
}

// Flatten adCreatives.list batch response into individual creatives
function flattenCreatives(data: any): any[] {
  if (!data || !Array.isArray(data)) return [];
  const flat: any[] = [];
  for (const item of data) {
    if (item.creatives && Array.isArray(item.creatives)) flat.push(...item.creatives);
    else flat.push(item);
  }
  return flat;
}

export default function V2AssetLibrary() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  // CHANGE 3: Zappy state — inline panel, no FAB
  const [zappyOpen, setZappyOpen] = useState(false);
  const [zappyQuery, setZappyQuery] = useState("");
  const [zappyResults, setZappyResults] = useState<number[] | null>(null);
  const [zappyLoading, setZappyLoading] = useState(false);

  const imgFavs = useFavs("library_images");
  const vidFavs = useFavs("library_videos");
  const copyFavs = useFavs("library_copy");

  const { data: rawImages } = trpc.adCreatives.list.useQuery();
  const { data: videoData } = trpc.videos.list.useQuery({});
  const { data: services } = trpc.services.list.useQuery();

  const images = useMemo(() => flattenCreatives(rawImages), [rawImages]);

  const videos = useMemo(() => {
    const raw = (videoData as any)?.videos || videoData || [];
    return Array.isArray(raw) ? raw.filter((v: any) => v.creatomateStatus === "succeeded") : [];
  }, [videoData]);

  const campaignList = useMemo(() => {
    if (!services || !Array.isArray(services)) return [];
    return (services as any[]).map((s: any) => ({ id: s.id, name: s.name }));
  }, [services]);

  // CHANGE 1: service name lookup map for card footers
  const serviceNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const c of campaignList) map[c.id] = c.name;
    return map;
  }, [campaignList]);

  const matchSearch = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const matchCampaign = (serviceId: number | null) => campaignFilter === "all" || String(serviceId) === campaignFilter;

  const filteredImages = useMemo(() => images.filter((img: any) =>
    matchSearch(`${img.headline || ""} ${img.productName || ""} ${img.niche || ""}`) &&
    matchCampaign(img.serviceId)
  ), [images, search, campaignFilter]);

  const filteredVideos = useMemo(() => videos.filter((v: any) =>
    matchSearch(`${v.title || ""} ${v.angle || ""}`) &&
    matchCampaign(v.serviceId)
  ), [videos, search, campaignFilter]);

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
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a"); a.href = url; a.download = filename; a.target = "_blank"; a.click();
  };

  // CHANGE 1: card base style with left border derived from serviceId
  const cardBase = (serviceId: number | null): React.CSSProperties => ({
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    position: "relative",
    borderLeft: `4px solid ${getCampaignColour(serviceId ?? 0)}`,
  });

  // CHANGE 3: Zappy card overlay — grey out non-matches, orange border on matches
  const zappyOverlay = (id: number): React.CSSProperties => {
    if (zappyResults === null) return {};
    if (zappyResults.includes(id)) return { outline: "2px solid #FF5B1D", outlineOffset: "0px" };
    return { opacity: 0.3, pointerEvents: "none" };
  };

  const btnS = (primary?: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 9999, border: primary ? "none" : "1px solid #e5e0d8",
    background: primary ? T.orange : "#fff", color: primary ? "#fff" : T.dark,
    fontFamily: T.fontB, fontWeight: 600, fontSize: 12, cursor: "pointer",
  });

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

  // CHANGE 3: Zappy search — accepts optional query override for chip clicks
  const handleZappySearch = useCallback(async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : zappyQuery).trim();
    if (!q) return;
    if (queryOverride !== undefined) setZappyQuery(queryOverride);
    setZappyLoading(true);
    try {
      const assetList = [
        ...filteredImages.map((img: any) => ({ id: img.id, type: "image", text: img.headline || `Image ${img.id}` })),
        ...filteredVideos.map((v: any) => ({ id: v.id, type: "video", text: v.title || `Video ${v.id}` })),
        ...copyAssets.map(c => ({ id: c.id, type: "copy", text: c.text })),
      ];
      const res = await fetch("/api/asset-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, assets: assetList }),
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

  const clearZappy = () => { setZappyResults(null); setZappyQuery(""); };

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

      {/* ── CHANGE 3: Two-section search bar ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {/* Left 70%: keyword search */}
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: "0 0 68%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 14, outline: "none", background: "#fff", color: T.dark }}
          />
          {/* Right 30%: Ask Zappy toggle */}
          <button
            onClick={() => setZappyOpen(o => !o)}
            style={{
              flex: "0 0 30%", padding: "10px 16px", borderRadius: 12,
              border: zappyOpen ? "none" : "1.5px solid #FF5B1D",
              background: zappyOpen ? T.orange : "#fff",
              color: zappyOpen ? "#fff" : T.orange,
              fontFamily: T.fontB, fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            ✨ Ask Zappy
          </button>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {SUGGESTION_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => { setZappyOpen(true); handleZappySearch(chip); }}
              style={{
                padding: "5px 14px", borderRadius: 9999, border: "1px solid #e5e0d8",
                background: "#fff", color: T.dark, fontFamily: T.fontB, fontSize: 12,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Inline Zappy panel */}
        {zappyOpen && (
          <div style={{
            marginTop: 10, background: "#fff", borderRadius: 16,
            border: "1.5px solid #FF5B1D", padding: "16px 18px",
            boxShadow: "0 4px 20px rgba(255,91,29,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: T.fontB, fontWeight: 700, fontSize: 14, color: T.dark }}>🦊 Ask Zappy to find anything in your library</span>
              <button onClick={() => setZappyOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder='e.g. "my best fitness videos" or "identity headlines"'
                value={zappyQuery}
                onChange={e => setZappyQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleZappySearch()}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, outline: "none", color: T.dark, background: "#f9f8f5" }}
              />
              <button
                onClick={() => handleZappySearch()}
                disabled={zappyLoading}
                style={{ ...btnS(true), padding: "10px 20px", fontSize: 13, opacity: zappyLoading ? 0.7 : 1 }}
              >
                {zappyLoading ? "Searching…" : "Search"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Campaign filter + Type tabs row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: T.fontB, fontSize: 13, background: "#fff", color: T.dark, cursor: "pointer", minWidth: 160 }}>
          <option value="all">All Campaigns</option>
          {campaignList.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 3, border: "1px solid #e5e0d8" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "7px 15px", borderRadius: 10, border: "none",
              background: tab === t.key ? T.orange : "transparent",
              color: tab === t.key ? "#fff" : T.muted,
              fontFamily: T.fontB, fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {/* CHANGE 3: Zappy results banner */}
      {zappyResults !== null && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 12,
          background: zappyResults.length > 0 ? "rgba(255,91,29,0.08)" : "rgba(0,0,0,0.04)",
          border: `1px solid ${zappyResults.length > 0 ? "rgba(255,91,29,0.25)" : "#e5e0d8"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: T.fontB, fontSize: 13, color: T.dark }}>
            {zappyResults.length > 0
              ? `✨ Zappy found ${zappyResults.length} asset${zappyResults.length !== 1 ? "s" : ""} matching your search`
              : "🦊 No matching assets found — try a different search"}
          </span>
          <button onClick={clearZappy} style={{ ...btnS(), fontSize: 12, padding: "4px 12px" }}>Clear</button>
        </div>
      )}

      {/* Asset Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>

        {/* ── IMAGE CARDS ── */}
        {(tab === "all" || tab === "images") && filteredImages.map((img: any) => {
          const accentColour = getCampaignColour(img.serviceId ?? 0);
          const serviceName = serviceNameMap[img.serviceId] || null;
          return (
            <div key={`img-${img.id}`} style={{ ...cardBase(img.serviceId), ...zappyOverlay(img.id) }}>
              <Heart active={imgFavs.isFav(img.id)} onClick={() => imgFavs.toggle(img.id, img.headline)} />
              {/* Light cream background — image cards are always light */}
              <div style={{ aspectRatio: "1/1", overflow: "hidden", background: "#F5F1EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {img.imageUrl ? (
                  <img
                    src={`/api/image-proxy?url=${encodeURIComponent(img.imageUrl)}`}
                    alt={img.headline || "Ad image"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span style={{ fontSize: 32, color: T.muted }}>🖼</span>
                )}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontFamily: T.fontB, fontWeight: 600, fontSize: 14, color: T.dark, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {img.headline || img.productName || `Ad Image #${img.id}`}
                </p>
                <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 8px" }}>
                  {new Date(img.createdAt).toLocaleDateString()}
                </p>
                {/* CHANGE 1: campaign name in accent colour */}
                {serviceName && (
                  <p style={{ fontFamily: T.fontB, fontSize: 11, fontWeight: 700, color: accentColour, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {serviceName}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => downloadFile(img.imageUrl, `zap-image-${img.id}.png`)} style={btnS(true)}>Download</button>
                  <button onClick={() => copyToClipboard(img.imageUrl)} style={btnS()}>Copy URL</button>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── VIDEO CARDS — CHANGE 2: rich text, dark gradient, no thumbnail img ── */}
        {(tab === "all" || tab === "videos") && filteredVideos.map((v: any) => {
          const accentColour = getCampaignColour(v.serviceId ?? 0);
          const serviceName = serviceNameMap[v.serviceId] || null;
          const { campaignName, angle, scenes, words } = parseVideoTitle(v.title);
          return (
            <div key={`vid-${v.id}`} style={{ ...cardBase(v.serviceId), ...zappyOverlay(v.id) }}>
              <Heart active={vidFavs.isFav(v.id)} onClick={() => vidFavs.toggle(v.id, v.title)} />
              {/* Dark gradient — video cards are always dark */}
              <div style={{
                aspectRatio: "1/1", overflow: "hidden", position: "relative",
                background: "linear-gradient(135deg, #1A1624 0%, #2D1F3D 100%)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "20px 18px",
              }}>
                {/* Angle keyword — primary identifier */}
                {angle ? (
                  <span style={{
                    fontFamily: T.fontB, fontSize: 28, fontWeight: 900, color: "#FF5B1D",
                    letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center",
                    lineHeight: 1.1, marginBottom: 10,
                  }}>
                    {angle}
                  </span>
                ) : (
                  <span style={{ fontFamily: T.fontB, fontSize: 22, fontWeight: 900, color: "#FF5B1D", marginBottom: 10 }}>VIDEO</span>
                )}
                {/* Campaign name */}
                <p style={{
                  fontFamily: T.fontH, fontStyle: "italic", fontSize: 15, fontWeight: 700,
                  color: "#fff", textAlign: "center", margin: "0 0 14px",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                  lineHeight: 1.35,
                }}>
                  {campaignName || v.title}
                </p>
                {/* Metadata chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  {scenes && (
                    <span style={{ background: "rgba(255,255,255,0.1)", color: "#bbb", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontFamily: T.fontB }}>
                      {scenes} scenes
                    </span>
                  )}
                  {words && (
                    <span style={{ background: "rgba(255,255,255,0.1)", color: "#bbb", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontFamily: T.fontB }}>
                      {words} words
                    </span>
                  )}
                  <span style={{ background: "rgba(255,255,255,0.1)", color: "#bbb", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontFamily: T.fontB }}>
                    {v.duration || "30"}s
                  </span>
                </div>
                {/* Centred play button */}
                <div
                  onClick={() => v.videoUrl && window.open(v.videoUrl, "_blank")}
                  style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                    width: 44, height: 44, borderRadius: "50%",
                    background: "rgba(255,91,29,0.75)", display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", marginTop: -10,
                    boxShadow: "0 2px 12px rgba(255,91,29,0.4)",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 18, marginLeft: 3 }}>▶</span>
                </div>
                {/* Duration badge bottom-right */}
                <span style={{
                  position: "absolute", bottom: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: T.fontB, fontWeight: 600,
                }}>
                  {v.duration || "30"}s
                </span>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontFamily: T.fontB, fontWeight: 600, fontSize: 14, color: T.dark, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {angle ? `${angle} — ${campaignName}` : (v.title || `Video ${v.id}`)}
                </p>
                <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 8px" }}>
                  {new Date(v.createdAt).toLocaleDateString()}
                </p>
                {/* CHANGE 1: campaign name in accent colour */}
                {serviceName && (
                  <p style={{ fontFamily: T.fontB, fontSize: 11, fontWeight: 700, color: accentColour, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {serviceName}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {v.videoUrl && (
                    <button onClick={() => downloadFile(v.videoUrl, `zap-video-${v.id}.mp4`)} style={btnS(true)}>Download MP4</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── COPY CARDS ── */}
        {(tab === "all" || tab === "copy") && copyAssets.map((c, idx) => {
          const accentColour = getCampaignColour(c.serviceId ?? 0);
          const serviceName = serviceNameMap[c.serviceId ?? -1] || null;
          return (
            <div key={`copy-${c.id}-${idx}`} style={{ ...cardBase(c.serviceId), padding: "16px 18px", ...zappyOverlay(c.id) }}>
              <Heart active={copyFavs.isFav(c.id)} onClick={() => copyFavs.toggle(c.id, c.text)} />
              <span style={{ fontFamily: T.fontB, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.orange, display: "block", marginBottom: 8, marginTop: 4 }}>
                {c.type}
              </span>
              <p style={{ fontFamily: T.fontB, fontSize: 14, color: T.dark, margin: "0 0 10px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {c.text}
              </p>
              <p style={{ fontFamily: T.fontB, fontSize: 12, color: T.muted, margin: "0 0 8px" }}>
                {new Date(c.date).toLocaleDateString()}
              </p>
              {/* CHANGE 1: campaign name in accent colour */}
              {serviceName && (
                <p style={{ fontFamily: T.fontB, fontSize: 11, fontWeight: 700, color: accentColour, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {serviceName}
                </p>
              )}
              <button onClick={() => copyToClipboard(c.text)} style={btnS(true)}>Copy to Clipboard</button>
            </div>
          );
        })}
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

    </div>
    </div>
  );
}
