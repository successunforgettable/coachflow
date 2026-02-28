/**
 * Pexels API integration for stock footage search
 * Documentation: https://www.pexels.com/api/documentation/
 */

import { ENV } from "./_core/env";

export interface PexelsVideoFile {
  id: number;
  quality: string; // 'hd', 'sd', 'uhd'
  file_type: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string; // Preview thumbnail
  user: {
    id: number;
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
}

export interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  url: string;
  videos: PexelsVideo[];
}

/**
 * Search Pexels for stock footage videos
 * 
 * @param query - Search term (e.g., "business meeting", "technology")
 * @param orientation - Video orientation (landscape, portrait, square)
 * @param per_page - Number of results per page (max 80)
 * @returns Search results with video metadata and download links
 */
export async function searchPexelsVideos(
  query: string,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
  per_page: number = 15
): Promise<PexelsSearchResponse> {
  if (!ENV.pexelsApiKey) {
    throw new Error('PEXELS_API_KEY is not configured');
  }

  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('per_page', per_page.toString());

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': ENV.pexelsApiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Pexels API error: ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = lastError.message.includes('fetch failed') || 
                          lastError.message.includes('ECONNRESET') ||
                          lastError.message.includes('ETIMEDOUT') ||
                          lastError.message.includes('socket');
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = attempt * 1500; // 1.5s, 3s
        console.warn(`[Pexels] Attempt ${attempt} failed (${lastError.message}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError!;
}

/**
 * Select the best HD video from search results
 * Prefers 1920x1080 or higher resolution
 * 
 * @param videos - Array of Pexels videos
 * @returns Best HD video file link, or null if no suitable video found
 */
export function selectBestHDVideo(videos: PexelsVideo[]): string | null {
  if (videos.length === 0) return null;

  // Get first video
  const video = videos[0];

  // Find HD quality video file (1920x1080 or higher)
  const hdFile = video.video_files.find(
    file => file.quality === 'hd' && file.width >= 1920 && file.height >= 1080
  );

  if (hdFile) return hdFile.link;

  // Fallback to any HD file
  const anyHdFile = video.video_files.find(file => file.quality === 'hd');
  if (anyHdFile) return anyHdFile.link;

  // Fallback to highest resolution available
  const sortedFiles = [...video.video_files].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return sortedFiles[0]?.link || null;
}

/**
 * Extract keywords from visual direction text
 * Removes filler words and focuses on nouns/adjectives
 * 
 * @param visualDirection - Scene visual direction text
 * @returns Cleaned search query
 */
export function extractKeywords(visualDirection: string): string {
  // Remove common filler words
  const fillerWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ];

  const words = visualDirection
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !fillerWords.includes(word));

  // Take first 3-4 most relevant words
  return words.slice(0, 4).join(' ');
}

/**
 * Broaden search query by removing specific terms
 * Used as fallback when initial search returns no results
 * 
 * @param query - Original search query
 * @returns Broader search query
 */
export function broadenQuery(query: string): string {
  const words = query.split(' ');
  
  // If query has multiple words, remove the last word
  if (words.length > 1) {
    return words.slice(0, -1).join(' ');
  }
  
  // If single word, try generic alternatives
  const genericTerms: Record<string, string> = {
    'office': 'business',
    'computer': 'technology',
    'meeting': 'business people',
    'success': 'achievement',
    'growth': 'progress',
  };
  
  return genericTerms[query.toLowerCase()] || 'business';
}
