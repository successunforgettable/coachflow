/**
 * Scene-specific footage fetcher for Pexels
 * Maps scene types to curated search queries
 */

import { searchPexelsVideos, selectBestHDVideo } from "./pexels";

// Curated queries per scene type for coach/business ads
const SCENE_QUERIES: Record<string, string[]> = {
  hook: [
    'business person frustrated laptop',
    'entrepreneur stress office',
    'person scrolling phone disappointed',
    'coach looking at empty calendar',
  ],
  problem: [
    'business struggle overwhelmed',
    'person confused paperwork',
    'entrepreneur late night working',
    'money falling coins loss',
  ],
  authority: [
    'large crowd audience conference',
    'business success celebration',
    'team celebrating achievement',
    'professional coach speaking stage',
  ],
  solution: [
    'business growth chart rising',
    'phone notification success',
    'entrepreneur happy laptop results',
    'digital marketing campaign launch',
  ],
  cta: [
    'person confident smiling success',
    'business breakthrough moment',
    'entrepreneur taking action phone',
    'coach client success handshake',
  ],
};

/**
 * Fetch scene footage by scene type
 * Uses curated queries instead of extracting keywords from visual direction
 */
export async function fetchSceneFootageByType(
  sceneType: 'hook' | 'problem' | 'authority' | 'solution' | 'cta',
  targetDuration: number
): Promise<string | null> {
  const queries = SCENE_QUERIES[sceneType];
  if (!queries || queries.length === 0) {
    console.error(`No queries defined for scene type: ${sceneType}`);
    return null;
  }

  // Pick a random query for variety
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  console.log(`[Pexels] Scene type "${sceneType}" → Query: "${query}"`);

  try {
    const results = await searchPexelsVideos(query, 'portrait', 15);
    
    if (!results.videos || results.videos.length === 0) {
      console.warn(`[Pexels] No videos found for query: "${query}"`);
      return null;
    }

    // Filter videos by duration (prefer videos longer than scene duration)
    const validVideos = results.videos.filter(v => v.duration >= targetDuration);
    const pool = validVideos.length > 0 ? validVideos : results.videos;

    // Pick random video from pool
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const videoUrl = selectBestHDVideo([chosen]);

    if (videoUrl) {
      console.log(`[Pexels] Found footage: ${videoUrl.substring(0, 60)}... (duration: ${chosen.duration}s)`);
      return videoUrl;
    }

    return null;
  } catch (error) {
    console.error(`[Pexels] Error fetching footage for "${sceneType}":`, error);
    return null;
  }
}

/**
 * Fetch multiple distinct clips for a scene (for b-roll variety)
 * Returns up to `count` different video URLs for the same scene type
 */
export async function fetchMultipleClipsForScene(
  sceneType: 'hook' | 'problem' | 'authority' | 'solution' | 'cta',
  count: number = 3
): Promise<string[]> {
  const queries = SCENE_QUERIES[sceneType];
  if (!queries || queries.length === 0) return [];

  // Shuffle queries so we get variety
  const shuffled = [...queries].sort(() => Math.random() - 0.5);
  const results: string[] = [];
  const usedUrls = new Set<string>();

  for (const query of shuffled) {
    if (results.length >= count) break;
    try {
      // Fetch a page of results and pick a random one (not always the first)
      const pexelsResults = await searchPexelsVideos(query, 'portrait', 15);
      const pool = pexelsResults.videos || [];
      // Shuffle pool for variety
      const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
      for (const video of shuffledPool) {
        const url = selectBestHDVideo([video]);
        if (url && !usedUrls.has(url)) {
          usedUrls.add(url);
          results.push(url);
          break;
        }
      }
    } catch (err) {
      console.warn(`[MultiClip] Failed for query "${query}":`, err);
    }
  }

  // Fallback to pixabay if we don't have enough clips
  if (results.length < count) {
    try {
      const { fetchStockFootageWithFallback } = await import('./pixabay.js');
      const fallbackUrl = await fetchStockFootageWithFallback(queries[0], 'portrait', 0);
      if (fallbackUrl && !usedUrls.has(fallbackUrl) && !fallbackUrl.startsWith('gradient:')) {
        usedUrls.add(fallbackUrl);
        results.push(fallbackUrl);
      }
    } catch (err) {
      console.warn('[MultiClip] Pixabay fallback failed:', err);
    }
  }

  return results;
}

/**
 * Fetch footage with fallback to simpler queries
 */
export async function fetchSceneFootageWithFallback(
  sceneType: 'hook' | 'problem' | 'authority' | 'solution' | 'cta',
  targetDuration: number
): Promise<string | null> {
  // Try primary fetch
  const primaryResult = await fetchSceneFootageByType(sceneType, targetDuration);
  if (primaryResult) return primaryResult;

  // Fallback to generic queries
  const fallbackQueries: Record<string, string> = {
    hook: 'business person office',
    problem: 'person working stressed',
    authority: 'conference crowd people',
    solution: 'success business growth',
    cta: 'happy entrepreneur success',
  };

  const fallbackQuery = fallbackQueries[sceneType];
  console.log(`[Pexels] Trying fallback query: "${fallbackQuery}"`);

  try {
    const results = await searchPexelsVideos(fallbackQuery, 'portrait', 5);
    if (results.videos && results.videos.length > 0) {
      const videoUrl = selectBestHDVideo(results.videos);
      if (videoUrl) {
        console.log(`[Pexels] Fallback succeeded: ${videoUrl.substring(0, 60)}...`);
        return videoUrl;
      }
    }
  } catch (error) {
    console.error(`[Pexels] Fallback also failed for "${sceneType}":`, error);
  }

  return null;
}
