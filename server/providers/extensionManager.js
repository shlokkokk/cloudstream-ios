import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/extensions_store.json');

// Master List of Curated CloudStream Repositories & Shortcodes from cloudstreamrepo.com
export const COMMUNITY_REPOSITORY_DIRECTORY = [
  {
    id: 'repo-phisher',
    name: '🎬 Phisher Mega Repo (Hindi, English & Global)',
    shortcode: 'phisherrepo864',
    url: 'https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/repo.json',
    category: 'Hindi & Global',
    language: 'Hindi / English / Multi',
    pluginsCount: 89,
    description: 'Huge collection: SuperStream, HiAnime, YTS, Yflix, Ultima, FourKHD, HDhub4u, Desicinemas, StreamPlay, Bollyflix, Toonstream.',
    featured: true
  },
  {
    id: 'repo-megix',
    name: '🇮🇳 Megix CSX (Bollywood, Hollywood & Netflix Mirrors)',
    shortcode: 'csx3670',
    url: 'https://raw.githubusercontent.com/SaurabhKaperwan/CSX/builds/CS.json',
    category: 'OTT Mirrors & Desi',
    language: 'Hindi / English',
    pluginsCount: 8,
    description: 'Bollyflix, CineStream, Moviesmod, NetflixMirror, VegaMovies, GDIndex.',
    featured: true
  },
  {
    id: 'repo-megarepo',
    name: '🔥 Mega Repository (All-in-One Global Index)',
    shortcode: 'megarepo3737',
    url: 'https://raw.githubusercontent.com/self-similarity/MegaRepo/builds/repo.json',
    category: 'All-in-One',
    language: 'Multi-language',
    pluginsCount: 150,
    description: 'Universal index aggregating maintained repositories across all categories and regions.',
    featured: true
  },
  {
    id: 'repo-netmirror',
    name: '🎥 NetMirror OTT Repo (Netflix, Disney+, Prime, Hotstar)',
    shortcode: 'Netmirror',
    url: 'https://raw.githubusercontent.com/Sushan64/NetMirror-Extension/refs/heads/builds/Netflix.json',
    category: 'OTT Mirrors',
    language: 'English / Multi',
    pluginsCount: 4,
    description: 'Direct streaming mirrors for Netflix, Disney+, Hotstar, and Prime Video content.',
    featured: true
  },
  {
    id: 'repo-cnc',
    name: '🎵 CNC Verse (Indian, Tamil, Global & Serials)',
    shortcode: 'cncv',
    url: 'https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/refs/heads/builds/CNC.json',
    category: 'Indian & Regional',
    language: 'Tamil / Hindi / English',
    pluginsCount: 26,
    description: 'CastleTv, CineTv, DesiSerials, Einthusan, Tamilian, SunGo, HDrezka, StreamFlix.',
    featured: true
  },
  {
    id: 'repo-karma',
    name: '🏟️ CS-Karma (Live Sports, F1, WWE, Replays & Anime)',
    shortcode: 'cskarma',
    url: 'https://raw.githubusercontent.com/Kraptor123/cs-Karma/refs/heads/master/repo.json',
    category: 'Sports & Replays',
    language: 'English / Multi',
    pluginsCount: 41,
    description: 'Live sports replays, F1, Basketball, CricHD, SoccerFullMatch, AnimeAV, TokyBook, TVGarden.',
    featured: true
  },
  {
    id: 'repo-official',
    name: '☁️ CloudStream Official Providers',
    shortcode: 'cspr0094',
    url: 'https://raw.githubusercontent.com/recloudstream/extensions/master/repo.json',
    category: 'Official',
    language: 'English / Multi',
    pluginsCount: 3,
    description: 'Official core team repository with Twitch, Invidious, and Dailymotion integrations.'
  },
  {
    id: 'repo-3rabi',
    name: '🌙 3rabi عربي (Arabic Movies, Series & Anime)',
    shortcode: 'arb343',
    url: 'https://raw.githubusercontent.com/Abodabodd/re-3arabi/refs/heads/main/repo',
    category: 'Arabic',
    language: 'Arabic',
    pluginsCount: 36,
    description: 'Anime4up, MyCima, FaselHD, Arabseed, WeCima, Akwam, Shahid4u, Asia2tv.'
  },
  {
    id: 'repo-indostream',
    name: '🌴 IndoStream & ExtCloud (Anime, Drama & Asian)',
    shortcode: 'indos2149',
    url: 'https://raw.githubusercontent.com/TeKuma25/IndoStream/builds/repo.json',
    category: 'Indonesian & Asian',
    language: 'Indonesian / English',
    pluginsCount: 30,
    description: 'Samehadaku, Otakudesu, Animasu, LayarKaca, Idlix, DramaSerial, Gomunime.'
  },
  {
    id: 'repo-dogior',
    name: '🎭 doGior / Italia (Italian & Global Streaming)',
    shortcode: 'gior1740',
    url: 'https://raw.githubusercontent.com/doGior/doGiorsHadEnough/refs/heads/builds/repo.json',
    category: 'Italian & European',
    language: 'Italian / English',
    pluginsCount: 16,
    description: 'AltaDefinizione, StreamingCommunity, CB01, DaddyLive, TorrentioTV, AnimeUnity.'
  },
  {
    id: 'repo-french',
    name: '🇫🇷 zzikozz / GramFlix French Repo',
    shortcode: 'zzikozz',
    url: 'https://raw.githubusercontent.com/zzikozz/frenchCS/refs/heads/main/repo.json',
    category: 'French',
    language: 'French',
    pluginsCount: 15,
    description: 'FrenchStream, Wiflix, HDSto, Sadisflix, Vostfree, WookaFR.'
  },
  {
    id: 'repo-turkish',
    name: '🇹🇷 Kraptor Turkish Providers',
    shortcode: 'kraptorcs',
    url: 'https://raw.githubusercontent.com/Kraptor123/cs-kraptor/refs/heads/master/repo.json',
    category: 'Turkish',
    language: 'Turkish',
    pluginsCount: 74,
    description: 'HDFilmCehennemi, Dizilla, DiziBox, Sinezy, FilmMakinesi, SelcukFlix, InatBox.'
  },
  {
    id: 'repo-cinephile',
    name: '📽️ Cinephile Repo (Hollywood, Hindi & International)',
    shortcode: 'cinephile',
    url: 'https://raw.githubusercontent.com/rocky4546/cinephile-repo/master/repo.json',
    category: 'Hindi & English Movies',
    language: 'Hindi / English',
    pluginsCount: 12,
    description: 'High-speed provider for cinema releases, dual audio, and full HD movies.',
    featured: true
  },
  {
    id: 'repo-cartoony',
    name: '🧸 Cartoony Repo (Cartoons, Anime & Kids in Hindi/Eng)',
    shortcode: 'cartoony',
    url: 'https://raw.githubusercontent.com/medard246/Cartoony-Repo/master/repo.json',
    category: 'Cartoons & Anime',
    language: 'Hindi / English',
    pluginsCount: 14,
    description: 'Toonstream, ToonHub, ToonTales, TopCartoons, AnimeDekho with Hindi and English dubs.',
    featured: true
  },
  {
    id: 'repo-reflex',
    name: '⚡ Reflex Repo (Ultra Fast Scrapers & Anime)',
    shortcode: 'reflex',
    url: 'https://raw.githubusercontent.com/Reflex-CloudStream/Reflex/master/repo.json',
    category: 'Fast Scrapers',
    language: 'English / Multi',
    pluginsCount: 18,
    description: 'High performance lightweight scrapers with direct streaming links.',
    featured: true
  },
  {
    id: 'repo-storm',
    name: '⚡ Storm-ext Fork (redblacker8)',
    shortcode: 'stormext',
    url: 'https://raw.githubusercontent.com/redblacker8/Storm-ext/master/repo.json',
    category: 'Fast Scrapers',
    language: 'Multi-language',
    pluginsCount: 10,
    description: 'Optimized Storm scrapers for movies, shows, and high-speed multi-host links.'
  },
  {
    id: 'repo-aniyomi',
    name: '⛩️ Aniyomi Compat (Anime & Manga Scrapers)',
    shortcode: 'aniyomi',
    url: 'https://raw.githubusercontent.com/Cranberry-Soup/aniyomi-extensions/master/repo.json',
    category: 'Anime',
    language: 'Multi-language',
    pluginsCount: 30,
    description: 'Aniyomi extension compatibility bridge for Japanese anime and Asian media.'
  },
  {
    id: 'repo-skillshare',
    name: '📚 SkillShare & Educational Repo',
    shortcode: 'skillshare',
    url: 'https://raw.githubusercontent.com/tech-shrestha/SkillShare-Repo/master/repo.json',
    category: 'Education & Courses',
    language: 'English',
    pluginsCount: 5,
    description: 'Skillshare, tutorials, documentaries, and educational streaming courses.'
  },
  {
    id: 'repo-fstream',
    name: '🔒 No name (FStream Disroot)',
    shortcode: 'fstream',
    url: 'https://git.disroot.org/ayza/FStream/raw/branch/main/repo.json',
    category: 'Alternative Hosts',
    language: 'Multi-language',
    pluginsCount: 8,
    description: 'Privacy-focused alternative scrapers and decentralised stream hosts.'
  },
  {
    id: 'repo-german',
    name: '🇩🇪 German Providers',
    shortcode: 'gpr',
    url: 'https://raw.githubusercontent.com/Bnyro/GermanProviders/refs/heads/master/repo.json',
    category: 'German',
    language: 'German',
    pluginsCount: 16,
    description: 'ARD, Arte, Serienstream, HDFilme, FilmPalast, SpiegelTV, Xcine.'
  },
  {
    id: 'repo-brazilian',
    name: '🇧🇷 Lawliet & Saimuel (Brazilian Portuguese)',
    shortcode: 'saim',
    url: 'https://raw.githubusercontent.com/lawlietbr/lietrepo/refs/heads/main/builds/repo.json',
    category: 'Portuguese / Brazilian',
    language: 'Portuguese',
    pluginsCount: 26,
    description: 'AnimeFire, NetCine, PobreFlix, CineAgora, OverFlix, VisionCine.'
  },
  {
    id: 'repo-diegon',
    name: '🇮🇹 DieGon Repository (Italia in Streaming)',
    shortcode: 'diegon7',
    url: 'https://pastebin.com/raw/qndZtL6D',
    category: 'Italian & Sports',
    language: 'Italian / English',
    pluginsCount: 17,
    description: 'AltaDefinizione, AnimeSaturn, CB01, CalcioStreaming, GuardaSerie, TorrentioTV.'
  },
  {
    id: 'repo-cuxplug',
    name: '🌍 CuxPlug International',
    shortcode: 'CuxPlug',
    url: 'https://raw.githubusercontent.com/ycngmn/CuxPlug/refs/heads/main/repo.json',
    category: 'International',
    language: 'French / German / English',
    pluginsCount: 8,
    description: 'AnimeLuxe, AnimeSama, FreeDriveMovie, FrenchStream, StreamCloud.'
  },
  {
    id: 'repo-redowan',
    name: '🇧🇩 Redowan BDIX Repository',
    shortcode: 'redowan',
    url: 'https://raw.githubusercontent.com/redowan99/Redowan-CloudStream/master/repo.json',
    category: 'Bangladeshi & Regional',
    language: 'Bengali / Hindi',
    pluginsCount: 17,
    description: '9kMovies, BdixBdipTV, DhakaFlix, MovieBazarTV, TheMoviesFlix, WatchMoviesPk.'
  },
  {
    id: 'repo-iptv',
    name: '📺 IPTV-Org Global Live TV (8,000+ Channels)',
    shortcode: 'iptvorg',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    category: 'Live TV & IPTV',
    language: 'Global',
    pluginsCount: 8000,
    description: 'Over 8,000+ public live broadcast channels from 100+ countries with zero subscription.'
  }
];

// Active installed repositories list (initialized with featured repositories)
let installedRepositories = COMMUNITY_REPOSITORY_DIRECTORY.filter(r => r.featured);

let activeExtensions = [
  {
    id: 'ext-superstream',
    name: '⭐ SuperStream Ultima (1080p / 4K)',
    version: '4.2.0',
    type: 'Movies & Series',
    author: 'Phisher / CloudStream',
    description: 'High-speed multi-quality scraper for latest movies, blockbusters & series with subtitles.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-vidsrc-pro',
    name: 'VidSrc Pro & CC Multi-Stream',
    version: '3.1.0',
    type: 'Multi-Source',
    author: 'CloudStream Team',
    description: 'Zero-buffering multi-CDN video source with auto-fallback servers.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-desicinemas',
    name: '🇮🇳 DesiCinemas & Bollyflix',
    version: '2.5.0',
    type: 'Bollywood / Hindi / Regional',
    author: 'Phisher / Megix',
    description: 'Hindi movies, South Indian Hindi-dubbed, web series, and Indian TV serials.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-netmirror',
    name: '🎥 OTT Mirror (Netflix / Prime / Disney+)',
    version: '2.0.1',
    type: 'OTT Originals',
    author: 'Sushan64',
    description: 'Fast streaming mirrors for popular streaming platform exclusive shows and movies.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-hianime',
    name: '⚡ HiAnime & AnimePahe (Sub & Dub)',
    version: '3.8.0',
    type: 'Anime',
    author: 'Phisher / Community',
    description: 'Extensive anime library with multi-resolution English Subbed and English Dubbed tracks.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-dramacool',
    name: '🌸 DramaCool & KissKH (K-Drama / Asian)',
    version: '2.2.0',
    type: 'Asian Drama',
    author: 'Community',
    description: 'Korean, Chinese, and Japanese dramas, shows, and variety programs.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-yts',
    name: '🍿 YTS & Yflix HD Master',
    version: '1.9.0',
    type: 'HD Movies',
    author: 'Phisher',
    description: 'High-bitrate cinema streams with crystal clear multi-channel audio.',
    enabled: true,
    isBuiltIn: true
  },
  {
    id: 'ext-sports-live',
    name: '🏟️ CS-Karma Sports & IPTV Live',
    version: '2.0.0',
    type: 'Live Sports & IPTV',
    author: 'Kraptor',
    description: 'Live match replays, football, basketball, cricket, F1, and world television channels.',
    enabled: true,
    isBuiltIn: true
  }
];

async function ensureDataLoaded() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.repositories && parsed.repositories.length > 0) installedRepositories = parsed.repositories;
    if (parsed.extensions && parsed.extensions.length > 0) activeExtensions = parsed.extensions;
  } catch (e) {
    await saveData();
  }
}

async function saveData() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ repositories: installedRepositories, extensions: activeExtensions }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Failed to persist extension data:', err.message);
  }
}

ensureDataLoaded();

export async function getRepositories() {
  await ensureDataLoaded();
  return installedRepositories;
}

export async function getCommunityDirectory() {
  return COMMUNITY_REPOSITORY_DIRECTORY;
}

export async function addRepository(inputQuery) {
  await ensureDataLoaded();
  const cleanInput = inputQuery.trim();

  // Check if query matches a known shortcode
  const matchedShortcode = COMMUNITY_REPOSITORY_DIRECTORY.find(
    r => r.shortcode.toLowerCase() === cleanInput.toLowerCase() ||
      r.id.toLowerCase() === cleanInput.toLowerCase()
  );

  const targetUrl = matchedShortcode ? matchedShortcode.url : cleanInput;
  const repoName = matchedShortcode ? matchedShortcode.name : `Custom Repo (${new URL(targetUrl).hostname})`;

  try {
    let repoData = null;
    if (targetUrl.endsWith('.json') || targetUrl.includes('raw.githubusercontent.com')) {
      try {
        const res = await axios.get(targetUrl, { timeout: 5000 });
        repoData = res.data;
      } catch (e) {
        console.warn('Direct fetch failed, creating wrapper for:', targetUrl);
      }
    }

    const newRepo = {
      id: matchedShortcode?.id || `repo-${Date.now()}`,
      name: repoData?.name || repoName,
      url: targetUrl,
      shortcode: matchedShortcode?.shortcode || '',
      description: repoData?.description || matchedShortcode?.description || 'Custom repository for CloudStream iOS.',
      category: matchedShortcode?.category || 'Custom',
      language: matchedShortcode?.language || 'Multi',
      iconUrl: repoData?.iconUrl || matchedShortcode?.iconUrl || null,
      manifestVersion: 1
    };

    // Replace if already exists, else push
    installedRepositories = installedRepositories.filter(r => r.url !== targetUrl && r.id !== newRepo.id);
    installedRepositories.push(newRepo);

    // If repo provided plugins, register them dynamically
    if (repoData?.plugins && Array.isArray(repoData.plugins)) {
      repoData.plugins.forEach(p => {
        activeExtensions.push({
          id: `ext-${p.internalName || p.name}-${Date.now()}`,
          name: p.name,
          version: `${p.version || 1}.0.0`,
          type: p.tvTypes ? p.tvTypes.join(', ') : 'Multi-Source',
          author: (p.authors || ['Community']).join(', '),
          description: p.description || 'Community extension from repository.',
          enabled: true,
          isBuiltIn: false
        });
      });
    }

    await saveData();
    return { success: true, repository: newRepo };
  } catch (err) {
    console.error('Error adding repository:', err.message);
    throw new Error(`Failed to add repository: ${err.message}`);
  }
}

export async function removeRepository(repoId) {
  await ensureDataLoaded();
  installedRepositories = installedRepositories.filter(r => r.id !== repoId);
  await saveData();
  return { success: true };
}

export async function getExtensions() {
  await ensureDataLoaded();
  return activeExtensions;
}

export async function toggleExtension(extensionId, enabled) {
  await ensureDataLoaded();
  const ext = activeExtensions.find(e => e.id === extensionId);
  if (ext) {
    ext.enabled = enabled;
    await saveData();
    return { success: true, extension: ext };
  }
  throw new Error('Extension not found');
}
