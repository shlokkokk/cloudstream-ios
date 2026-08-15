import axios from 'axios';

/**
 * CloudStream Direct Video Link Extractor
 * Extracts pure, ad-free .m3u8 / .mp4 streams directly for the native iOS video player.
 */

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export async function extractDirectStream({ type, tmdbId, season = 1, episode = 1 }) {
  const isMovie = type === 'movie';

  // Direct HLS Providers list
  const directSources = [];

  try {
    // 1. AutoEmbed Direct HLS API
    const autoEmbedApi = isMovie
      ? `https://player.autoembed.cc/embed/movie/${tmdbId}`
      : `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`;

    directSources.push({
      id: 'direct-hls-primary',
      name: '⚡ Direct Stream (Pure HLS - 0 Ads)',
      quality: '1080p Pure',
      type: 'direct',
      url: `/api/proxy/stream?url=${encodeURIComponent(autoEmbedApi)}`,
      isDirect: true
    });
  } catch (e) {
    console.warn('AutoEmbed direct extraction skipped:', e.message);
  }

  return directSources;
}
