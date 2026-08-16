import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import qrcode from 'qrcode-terminal';
import axios from 'axios';

import {
  getHomeCatalog,
  searchMedia,
  searchMediaParallel,
  getMediaDetails,
  getSeasonEpisodes
} from './providers/tmdbProvider.js';

import { resolveStreamSources, extractStreamsParallel } from './providers/streamProviders.js';
import { proxyStreamHandler, proxySubtitlesHandler } from './proxy/mediaProxy.js';
import {
  getRepositories,
  getCommunityDirectory,
  addRepository,
  removeRepository,
  getExtensions,
  toggleExtension
} from './providers/extensionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Force Safari and mobile browsers to never serve stale cached JS/CSS
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  maxAge: 0
}));

// Helper to get local network IP address
function getLocalIpAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface && iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return '127.0.0.1';
}

// REST API Endpoints

// 1. Home Catalog (Hero, Trending, Popular, Anime, K-Drama, Classics)
app.get('/api/home', async (req, res) => {
  try {
    const catalog = await getHomeCatalog();
    res.json(catalog);
  } catch (err) {
    console.error('Error fetching home catalog:', err.message);
    res.status(500).json({ error: 'Failed to fetch home catalog', details: err.message });
  }
});

// 2a. Search Media — REST (returns all at once)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  try {
    const results = await searchMedia(query.trim(), page);
    res.json(results);
  } catch (err) {
    console.error('Error searching media:', err.message);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// 2b. Search Media — SSE (Android-style: each provider emits results the instant it resolves)
// Mirrors SearchViewModel.amap { a -> _currentSearch.postValue(expandableSearches) }
app.get('/api/search/stream', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const emit = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Fire all providers in PARALLEL — each one emits the instant it resolves
    // Mirrors: repos.amap { a -> val search = a.search(query); _currentSearch.postValue() }
    await searchMediaParallel(query, (providerResult) => {
      emit(providerResult);
    });
  } catch (err) {
    console.error('SSE search error:', err.message);
  } finally {
    emit({ __done__: true });
    res.end();
  }
});

// 3. Media Details
app.get('/api/details', async (req, res) => {
  const { type, id } = req.query;
  if (!type || !id) {
    return res.status(400).json({ error: 'Parameters type and id are required' });
  }
  try {
    const details = await getMediaDetails(type, id);
    res.json(details);
  } catch (err) {
    console.error('Error fetching media details:', err.message);
    res.status(500).json({ error: 'Failed to fetch media details', details: err.message });
  }
});

// 4. TV Season Episodes
app.get('/api/season', async (req, res) => {
  const { id, season } = req.query;
  if (!id || season === undefined) {
    return res.status(400).json({ error: 'Parameters id and season are required' });
  }
  try {
    const episodes = await getSeasonEpisodes(id, parseInt(season) || 1);
    res.json(episodes);
  } catch (err) {
    console.error('Error fetching season episodes:', err.message);
    res.status(500).json({ error: 'Failed to fetch season episodes', details: err.message });
  }
});

// 5a. Stream Sources — REST (returns all at once)
app.get('/api/sources', async (req, res) => {
  const { type, id, tmdbId, imdbId, title, year, season, episode } = req.query;
  const resolvedTmdbId = tmdbId || id;
  if (!resolvedTmdbId) {
    return res.status(400).json({ error: 'Parameter tmdbId or id is required' });
  }
  try {
    const sources = await resolveStreamSources({
      type: type || 'movie',
      tmdbId: resolvedTmdbId,
      imdbId,
      title,
      year,
      season: parseInt(season) || 1,
      episode: parseInt(episode) || 1
    });
    res.json(sources);
  } catch (err) {
    console.error('Error resolving stream sources:', err.message);
    res.status(500).json({ error: 'Failed to resolve stream sources', details: err.message });
  }
});

// 5b. Stream Sources — SSE (Android extractor architecture: each provider scrapes in parallel,
//     callback fires per stream found, client plays DIRECT .m3u8 via HLS.js — zero spinner)
app.get('/api/sources/stream', async (req, res) => {
  const { type, id, tmdbId, season, episode, sub } = req.query;
  const resolvedTmdbId = tmdbId || id;
  if (!resolvedTmdbId) {
    return res.status(400).json({ error: 'Parameter tmdbId or id is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let streamCount = 0;
  try {
    await extractStreamsParallel({
      tmdbId: resolvedTmdbId,
      type: type || 'movie',
      season: parseInt(season) || 1,
      episode: parseInt(episode) || 1,
      sub: sub || 'en',
      callback: (source) => {
        if (!res.writableEnded) {
          // Assign stable IDs
          const enriched = { ...source, id: source.id || `stream-${++streamCount}` };
          res.write(`data: ${JSON.stringify(enriched)}\n\n`);
        }
      }
    });
  } catch (err) {
    console.error('SSE sources error:', err.message);
  } finally {
    if (!res.writableEnded) {
      res.write('data: {"__done__":true}\n\n');
      res.end();
    }
  }
});

// 6. Media and Subtitle Proxies
app.get('/api/proxy/stream', proxyStreamHandler);
app.get('/api/proxy/subtitles', proxySubtitlesHandler);

// ─── 6c. Subtitle Search Endpoint (OpenSubtitles v3 + Fallback) ───────────────
// GET /api/subtitles?tmdbId=&lang=en&type=movie&season=1&episode=1
// Returns array of subtitle tracks with proxied VTT URLs
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY || 'Ls5IbHbG3wHPfpf7FfFr5Dk0NqJBQGwB';
const SUBTITLE_CACHE = new Map();

// Convert SRT text to WebVTT format
function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

app.get('/api/subtitles', async (req, res) => {
  const { tmdbId, lang = 'en', type = 'movie', season = 1, episode = 1 } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId required' });

  const cacheKey = `${tmdbId}:${lang}:${type}:${season}:${episode}`;
  if (SUBTITLE_CACHE.has(cacheKey)) {
    return res.json(SUBTITLE_CACHE.get(cacheKey));
  }

  try {
    const params = { tmdb_id: tmdbId, languages: lang };
    if (type === 'tv') {
      params.season_number = parseInt(season) || 1;
      params.episode_number = parseInt(episode) || 1;
    }

    const searchRes = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'User-Agent': 'CloudStreamIOS v4.8',
        'Content-Type': 'application/json'
      },
      params,
      timeout: 8000
    });

    const tracks = (searchRes.data?.data || []).slice(0, 5).map(item => ({
      id: item.id,
      lang: item.attributes?.language || lang,
      name: (item.attributes?.language || lang).toUpperCase() + ' [CC]',
      format: 'vtt',
      fileId: item.attributes?.files?.[0]?.file_id,
      downloadUrl: item.attributes?.files?.[0]?.file_id
        ? `/api/subtitles/download?fileId=${item.attributes.files[0].file_id}`
        : null
    })).filter(t => t.downloadUrl);

    const result = { tracks };
    SUBTITLE_CACHE.set(cacheKey, result);
    setTimeout(() => SUBTITLE_CACHE.delete(cacheKey), 30 * 60 * 1000); // 30-min TTL
    res.json(result);

  } catch (err) {
    console.warn('[Subtitles] OpenSubtitles fetch failed:', err.message);
    // Fallback: return empty tracks gracefully
    res.json({ tracks: [] });
  }
});

// ─── 6d. Subtitle File Download + SRT→VTT Proxy ──────────────────────────────
app.get('/api/subtitles/download', async (req, res) => {
  const { fileId, url } = req.query;

  // Direct URL proxy (for when we already have a .srt/.vtt URL)
  if (url) {
    try {
      const r = await axios.get(decodeURIComponent(url), {
        responseType: 'text', timeout: 10000,
        headers: { 'User-Agent': 'CloudStreamIOS v4.8' }
      });
      const body = r.data;
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      // Convert SRT → VTT if needed
      if (!body.startsWith('WEBVTT')) {
        res.send(srtToVtt(body));
      } else {
        res.send(body);
      }
    } catch (err) {
      res.status(502).send('WEBVTT\n\n');
    }
    return;
  }

  // OpenSubtitles fileId → fetch download link, then proxy file
  if (!fileId) return res.status(400).send('WEBVTT\n\n');

  try {
    const dlRes = await axios.post('https://api.opensubtitles.com/api/v1/download',
      { file_id: parseInt(fileId), sub_format: 'webvtt' },
      {
        headers: {
          'Api-Key': OPENSUBTITLES_API_KEY,
          'User-Agent': 'CloudStreamIOS v4.8',
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const downloadLink = dlRes.data?.link;
    if (!downloadLink) throw new Error('No download link returned');

    const fileRes = await axios.get(downloadLink, {
      responseType: 'text', timeout: 15000,
      headers: { 'User-Agent': 'CloudStreamIOS v4.8' }
    });

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const content = fileRes.data;
    if (!content.startsWith('WEBVTT')) {
      res.send(srtToVtt(content));
    } else {
      res.send(content);
    }

  } catch (err) {
    console.warn('[Subtitles] Download failed:', err.message);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send('WEBVTT\n\n');
  }
});

// 6b. HLS/M3U8 CORS Proxy — mirrors Android OkHttp bypassing CORS
// Relays m3u8 and ts segments with correct headers so HLS.js can play them
app.get('/api/proxy/hls', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const decodedUrl = decodeURIComponent(url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
    };
    if (referer) headers['Referer'] = decodeURIComponent(referer);

    const upstream = await axios.get(decodedUrl, {
      headers,
      responseType: 'stream',
      timeout: 10000,
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');

    // Rewrite .ts segment URLs in m3u8 playlists to go through this proxy
    if (decodedUrl.includes('.m3u8')) {
      const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
      let body = '';
      upstream.data.on('data', chunk => { body += chunk.toString(); });
      upstream.data.on('end', () => {
        const rewritten = body.replace(/^(?!#)(https?:\/\/[^\n]+)/gm, (match) => {
          return `/api/proxy/hls?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(referer || decodedUrl)}`;
        }).replace(/^(?!#)(?!https?)([^\n]+)/gm, (match) => {
          return `/api/proxy/hls?url=${encodeURIComponent(baseUrl + match.trim())}&referer=${encodeURIComponent(referer || decodedUrl)}`;
        });
        res.send(rewritten);
      });
    } else {
      upstream.data.pipe(res);
    }
  } catch (err) {
    console.error('HLS proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

// 7. Extensions & Repositories Endpoints
app.get('/api/repositories', async (req, res) => {
  const repos = await getRepositories();
  res.json(repos);
});

app.get('/api/repositories/community', async (req, res) => {
  const directory = await getCommunityDirectory();
  res.json(directory);
});

app.post('/api/repositories', async (req, res) => {
  const { url, shortcode } = req.body;
  const target = url || shortcode;
  if (!target) return res.status(400).json({ error: 'Repository url or shortcode is required' });
  try {
    const result = await addRepository(target);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/repositories/:id', async (req, res) => {
  const result = await removeRepository(req.params.id);
  res.json(result);
});

app.get('/api/extensions', async (req, res) => {
  const exts = await getExtensions();
  res.json(exts);
});

app.post('/api/extensions/:id/toggle', async (req, res) => {
  const { enabled } = req.body;
  try {
    const result = await toggleExtension(req.params.id, enabled);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 8. System Info Endpoint
app.get('/api/info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    name: 'CloudStream iOS Engine',
    version: '4.8.0-iOS',
    localIp,
    port: PORT,
    accessUrl: `http://${localIp}:${PORT}`,
    status: 'online'
  });
});

// Fallback to SPA index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = `http://${localIp}:${PORT}`;

  console.log('\n=============================================================');
  console.log('🚀  CLOUDSTREAM FOR iOS — SERVER STARTED SUCCESSFULLY');
  console.log('=============================================================');
  console.log(`📱  Local Machine:  ${localUrl}`);
  console.log(`📡  iPhone Network: ${networkUrl}`);
  console.log('-------------------------------------------------------------');
  console.log('📸  Scan this QR code with iPhone camera to open instantly:');
  console.log('-------------------------------------------------------------');
  try {
    qrcode.generate(networkUrl, { small: true });
  } catch (e) {
    // Ignore if terminal doesn't support QR
  }
  console.log('=============================================================\n');
});
