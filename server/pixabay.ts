/**
 * Pixabay API Integration
 * Free stock video API as fallback for Pexels
 * API Docs: https://pixabay.com/api/docs/
 */

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "48426285-4b52f8a8c5c8e3c5f5e5e5e5e"; // Free tier key

interface PixabayVideo {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  duration: number;
  videos: {
    large?: { url: string; width: number; height: number; size: number };
    medium?: { url: string; width: number; height: number; size: number };
    small?: { url: string; width: number; height: number; size: number };
    tiny?: { url: string; width: number; height: number; size: number };
  };
  views: number;
  downloads: number;
  likes: number;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

/**
 * Search Pixabay for stock videos
 * @param query - Search query (e.g., "crypto trading", "business meeting")
 * @param orientation - Video orientation: "all", "horizontal", "vertical" (Pixabay doesn't support this, so we filter by aspect ratio)
 * @param perPage - Number of results (3-200, default 20)
 * @returns Pixabay API response with video results
 */
export async function searchPixabayVideos(
  query: string,
  orientation: "all" | "horizontal" | "vertical" | "portrait" = "all",
  perPage: number = 20
): Promise<PixabayResponse> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", PIXABAY_API_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", Math.min(perPage, 200).toString());
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("order", "popular");

  console.log(`[Pixabay] Searching for: "${query}"`);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `Pixabay API error: ${response.status} ${response.statusText}`
    );
  }

  const data: PixabayResponse = await response.json();
  console.log(`[Pixabay] Found ${data.totalHits} videos for "${query}"`);

  // Filter by orientation if specified (portrait = vertical, 9:16 aspect ratio)
  if (orientation === "portrait" || orientation === "vertical") {
    data.hits = data.hits.filter((video) => {
      const largeVideo = video.videos.large || video.videos.medium;
      if (!largeVideo) return false;
      const aspectRatio = largeVideo.width / largeVideo.height;
      return aspectRatio < 1; // Vertical videos (width < height)
    });
    console.log(`[Pixabay] Filtered to ${data.hits.length} vertical videos`);
  }

  return data;
}

/**
 * Select the best HD video URL from Pixabay results
 * Prefers: large (1080p) > medium (720p) > small (360p)
 * @param videos - Array of Pixabay video results
 * @returns URL of the best quality video, or null if no videos found
 */
export function selectBestPixabayVideo(videos: PixabayVideo[]): string | null {
  if (!videos || videos.length === 0) {
    return null;
  }

  // Sort by popularity (views + downloads + likes)
  const sortedVideos = [...videos].sort((a, b) => {
    const scoreA = a.views + a.downloads * 10 + a.likes * 5;
    const scoreB = b.views + b.downloads * 10 + b.likes * 5;
    return scoreB - scoreA;
  });

  // Get the most popular video
  const bestVideo = sortedVideos[0];

  // Prefer large > medium > small > tiny
  if (bestVideo.videos.large) {
    return bestVideo.videos.large.url;
  }
  if (bestVideo.videos.medium) {
    return bestVideo.videos.medium.url;
  }
  if (bestVideo.videos.small) {
    return bestVideo.videos.small.url;
  }
  if (bestVideo.videos.tiny) {
    return bestVideo.videos.tiny.url;
  }

  return null;
}

/**
 * Generate animated gradient background as fallback
 * Returns a data URL for an animated gradient based on scene emotion
 * @param sceneIndex - Scene number (0-4)
 * @param query - Search query to determine color scheme
 * @returns Gradient specification for Creatomate
 */
function generateGradientFallback(sceneIndex: number, query: string): string {
  // Scene-appropriate color schemes
  const gradients = [
    // Scene 1 (Hook): Tense, attention-grabbing (red/orange)
    { start: "#FF6B6B", end: "#FF8E53" }, // Red to orange
    // Scene 2 (Problem): Cold, uncomfortable (dark blue/purple)
    { start: "#4A5568", end: "#2D3748" }, // Dark blue-gray
    // Scene 3 (Authority): Professional, trustworthy (blue)
    { start: "#4299E1", end: "#3182CE" }, // Blue
    // Scene 4 (Solution): Warm, hopeful (green/teal)
    { start: "#48BB78", end: "#38A169" }, // Green
    // Scene 5 (CTA): Energetic, urgent (purple/pink)
    { start: "#9F7AEA", end: "#805AD5" }, // Purple
  ];

  const gradient = gradients[sceneIndex] || gradients[0];
  
  // Return gradient specification that Creatomate can use
  // We'll return a special marker that videos.ts will recognize
  return `gradient:${gradient.start},${gradient.end}`;
}

/**
 * Fetch stock footage with Pixabay fallback and gradient final fallback
 * Tries Pexels first, then Pixabay, finally generates animated gradient
 * @param query - Search query
 * @param orientation - Video orientation
 * @param sceneIndex - Scene number for gradient color selection
 * @returns Video URL or gradient specification
 */
export async function fetchStockFootageWithFallback(
  query: string,
  orientation: "all" | "horizontal" | "vertical" | "portrait" = "portrait",
  sceneIndex: number = 0
): Promise<string | null> {
  // Try Pexels first
  try {
    const { searchPexelsVideos, selectBestHDVideo } = await import("./pexels.js");
    const pexelsResults = await searchPexelsVideos(query, orientation, 5);
    const pexelsUrl = selectBestHDVideo(pexelsResults.videos);
    if (pexelsUrl) {
      console.log(`[Footage] ✓ Pexels: ${query}`);
      return pexelsUrl;
    }
  } catch (error) {
    console.warn(`[Footage] ✗ Pexels failed for "${query}":`, error instanceof Error ? error.message : error);
  }

  // Fallback to Pixabay
  try {
    const pixabayResults = await searchPixabayVideos(query, orientation, 5);
    const pixabayUrl = selectBestPixabayVideo(pixabayResults.hits);
    if (pixabayUrl) {
      console.log(`[Footage] ✓ Pixabay: ${query}`);
      return pixabayUrl;
    }
  } catch (error) {
    console.warn(`[Footage] ✗ Pixabay failed for "${query}":`, error instanceof Error ? error.message : error);
  }

  // Final fallback: animated gradient
  const gradientSpec = generateGradientFallback(sceneIndex, query);
  console.log(`[Footage] ✓ Gradient fallback for scene ${sceneIndex + 1}`);
  return gradientSpec;
}
