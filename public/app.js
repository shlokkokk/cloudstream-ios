/**
 * ============================================================================
 * CLOUDSTREAM FOR iOS v5.0 — ANDROID-LEVEL CLIENT ENGINE
 * ============================================================================
 * Features:
 *  - Cinematic splash screen (Android SplashScreen API equivalent)
 *  - Zero-ad shield: window.open=null, _blank blocked, focus-lock, beforeunload
 *  - Full VTT/SRT subtitle parser + renderer (cue overlay over native video)
 *  - OpenSubtitles v3 integration via server proxy
 *  - Player gesture controls: double-tap seek ±10s, swipe brightness/volume
 *  - Progress bar with buffered indicator, seekable on drag
 *  - Android-style slide tab transitions + spring modals
 *  - Haptic feedback on iOS (navigator.vibrate)
 *  - SSE streaming search + sources (Android parallel provider architecture)
 * ============================================================================
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ ULTRA AD SHIELD — Blocks ALL popup ads, click hijacks, new-tab attacks
  // Mirrors Android CloudStream's InjectorJS + WebViewClient shouldOverrideUrl
  // ═══════════════════════════════════════════════════════════════════════════
  const neutralOpen = function (url) {
    console.warn('🛡️ Shield: Blocked popup:', url);
    return null;
  };
  try {
    Object.defineProperty(window, 'open', { value: neutralOpen, writable: false, configurable: false });
    if (window.top && window.top !== window) {
      try { window.top.open = neutralOpen; } catch (_) {}
    }
  } catch (_) {}

  // Trap programmatic .click() on dynamically injected ad anchor tags
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.target === '_blank' && !this.classList.contains('allow-open')) {
      console.warn('🛡️ Shield: Blocked programmatic popup click:', this.href);
      return;
    }
    return nativeAnchorClick.apply(this, arguments);
  };

  // Block ALL _blank anchor navigations from ad scripts
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.target === '_blank' && !a.classList.contains('allow-open')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Block middle-click popups
  window.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); }, true);

  // Focus-lock: if player open and window blurs, snap focus back (blocks new-tab popups)
  window.addEventListener('blur', () => {
    const pm = document.getElementById('player-modal');
    if (pm && pm.style.display === 'flex') setTimeout(() => window.focus(), 40);
  });

  // Prevent page navigation while player is open
  window.addEventListener('beforeunload', (e) => {
    const pm = document.getElementById('player-modal');
    if (pm && pm.style.display === 'flex') { e.preventDefault(); return (e.returnValue = ''); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APP STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const AppState = {
    currentTab: 'tab-home',
    heroItems: [],
    currentHeroIndex: 0,
    heroTimer: null,
    activeMedia: null,
    activeSeasonEpisodes: [],
    currentServer: null,
    currentSourceList: [],
    currentEpisodeIndex: 0,
    watchlist: JSON.parse(localStorage.getItem('cs_watchlist') || '[]'),
    watchHistory: JSON.parse(localStorage.getItem('cs_history') || '[]'),
    settings: {
      preferredServer: (localStorage.getItem('cs_pref_server') && localStorage.getItem('cs_pref_server') !== 'vidsrc-cc') ? localStorage.getItem('cs_pref_server') : 'vidlink-pro',
      preferredSubtitle: localStorage.getItem('cs_pref_sub') || 'en',
      autoPlayNext: localStorage.getItem('cs_pref_autoplay') !== 'false',
      autoSubtitles: localStorage.getItem('cs_pref_auto_subs') !== 'false',
    },
    systemInfo: null,
    subtitleTracks: [],
    activeSubTrack: null,
    subtitleCues: [],
    subtitleTimer: null,
    // ── Optimistic Architecture ────────────────────────────────────────────────
    // Pre-fetched source lists keyed by `tmdbId:type:season:episode`.
    // Sources are fetched the moment details modal opens — so by the time the
    // user taps Play, the server list is ALREADY loaded (zero extra wait).
    sourcePreCache: new Map(),
    // Pre-warm iframe element (loads first source URL silently in background)
    prewarmFrame: null,
    // Track which media was last pre-warmed to avoid duplicate fetches
    prewarmKey: null,
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const DOM = {
    splash: document.getElementById('app-splash'),
    tabButtons: document.querySelectorAll('.tab-item'),
    tabPages: document.querySelectorAll('.tab-page'),
    headerSearchBtn: document.getElementById('header-search-btn'),
    headerQrBtn: document.getElementById('header-qr-btn'),
    brandLogoBtn: document.getElementById('brand-logo-btn'),

    heroSkeleton: document.getElementById('hero-skeleton'),
    heroContent: document.getElementById('hero-content'),
    heroBackdrop: document.getElementById('hero-backdrop'),
    heroPillType: document.getElementById('hero-pill-type'),
    heroRating: document.getElementById('hero-rating'),
    heroYear: document.getElementById('hero-year'),
    heroTitle: document.getElementById('hero-title'),
    heroOverview: document.getElementById('hero-overview'),
    heroPlayBtn: document.getElementById('hero-play-btn'),
    heroDetailsBtn: document.getElementById('hero-details-btn'),
    heroBookmarkBtn: document.getElementById('hero-bookmark-btn'),
    heroDots: document.getElementById('hero-dots'),

    dynamicShelvesContainer: document.getElementById('dynamic-shelves-container'),
    continueWatchingShelf: document.getElementById('continue-watching-shelf'),
    continueWatchingRow: document.getElementById('continue-watching-row'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),

    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    searchFilterPills: document.querySelectorAll('#search-filter-pills .filter-pill'),
    searchResultsGrid: document.getElementById('search-results-grid'),

    libraryTabs: document.querySelectorAll('.lib-tab-btn'),
    libraryGrid: document.getElementById('library-grid'),
    watchlistCount: document.getElementById('watchlist-count'),
    historyCount: document.getElementById('history-count'),

    settingsOpenQrBtn: document.getElementById('settings-open-qr-btn'),
    prefServerSelect: document.getElementById('pref-server-select'),
    prefSubtitleSelect: document.getElementById('pref-subtitle-select'),
    prefAutoplayToggle: document.getElementById('pref-autoplay'),
    prefSubtitlesAutoToggle: document.getElementById('pref-subtitles-auto'),
    extensionList: document.getElementById('extension-list'),
    repositoriesList: document.getElementById('repositories-list'),
    addRepoBtn: document.getElementById('add-repo-btn'),
    addRepoModal: document.getElementById('add-repo-modal'),
    repoModalCloseBtn: document.getElementById('repo-modal-close-btn'),
    repoUrlInput: document.getElementById('repo-url-input'),
    confirmAddRepoBtn: document.getElementById('confirm-add-repo-btn'),

    detailsModal: document.getElementById('details-modal'),
    detailsSkeleton: document.getElementById('details-skeleton'),
    detailsCloseBtn: document.getElementById('details-close-btn'),
    detailsBackdrop: document.getElementById('details-backdrop'),
    detailsPoster: document.getElementById('details-poster'),
    detailsTitle: document.getElementById('details-title'),
    detailsBadges: document.getElementById('details-badges'),
    detailsSynopsis: document.getElementById('details-synopsis'),
    detailsGenres: document.getElementById('details-genres'),
    detailsPlayBtn: document.getElementById('details-play-btn'),
    detailsPlayText: document.getElementById('details-play-text'),
    detailsFavBtn: document.getElementById('details-fav-btn'),
    tvEpisodesSection: document.getElementById('tv-episodes-section'),
    seasonSelector: document.getElementById('season-selector'),
    episodesList: document.getElementById('episodes-list'),
    detailsCastRow: document.getElementById('details-cast-row'),
    detailsSimilarRow: document.getElementById('details-similar-row'),

    playerModal: document.getElementById('player-modal'),
    playerBackBtn: document.getElementById('player-back-btn'),
    playerMainTitle: document.getElementById('player-main-title'),
    playerSubTitle: document.getElementById('player-sub-title'),
    playerLoadingOverlay: document.getElementById('player-loading-overlay'),
    playerBackdropImg: document.getElementById('player-backdrop-img'),
    playerLoadingText: document.getElementById('player-loading-text'),
    playerLoadingSource: document.getElementById('player-loading-source'),

    // Subtitle
    subtitleSelectorBtn: document.getElementById('subtitle-selector-btn'),
    currentSubLabel: document.getElementById('current-sub-label'),
    subDrawerBackdrop: document.getElementById('sub-drawer-backdrop'),
    subDrawerList: document.getElementById('sub-drawer-list'),
    subDrawerCloseBtn: document.getElementById('sub-drawer-close-btn'),
    subtitleDisplay: document.getElementById('subtitle-display'),

    // Server
    serverSelectorBtn: document.getElementById('server-selector-btn'),
    currentServerLabel: document.getElementById('current-server-label'),
    serverDrawerBackdrop: document.getElementById('server-drawer-backdrop'),
    serverDrawerList: document.getElementById('server-drawer-list'),
    serverDrawerCloseBtn: document.getElementById('server-drawer-close-btn'),

    nativeVideoPlayer: document.getElementById('native-video-player'),
    streamEmbedFrame: document.getElementById('stream-embed-frame'),

    // Gesture zones
    gestureLeft: document.getElementById('gesture-left'),
    gestureRight: document.getElementById('gesture-right'),
    seekLeftIndicator: document.getElementById('seek-left-indicator'),
    seekRightIndicator: document.getElementById('seek-right-indicator'),

    // HUD
    playerHud: document.getElementById('player-hud'),
    playerProgressBar: document.getElementById('player-progress-bar'),
    playerProgressFill: document.getElementById('player-progress-fill'),
    playerBufferedFill: document.getElementById('player-buffered-fill'),
    playerProgressThumb: document.getElementById('player-progress-thumb'),
    playerTimeCurrent: document.getElementById('player-time-current'),
    playerTimeTotal: document.getElementById('player-time-total'),
    playerPipBtn: document.getElementById('player-pip-btn'),
    playerPlayPauseBtn: document.getElementById('player-play-pause-btn'),
    playerFullscreenBtn: document.getElementById('player-fullscreen-btn'),

    // Episode bar
    playerBottomBar: document.getElementById('player-bottom-bar'),
    playerEpInfo: document.getElementById('player-ep-info'),
    prevEpBtn: document.getElementById('prev-ep-btn'),
    nextEpBtn: document.getElementById('next-ep-btn'),

    qrModal: document.getElementById('qr-modal'),
    qrCloseBtn: document.getElementById('qr-close-btn'),
    qrCodeImg: document.getElementById('qr-code-img'),
    qrNetworkUrl: document.getElementById('qr-network-url'),
    copyUrlBtn: document.getElementById('copy-url-btn'),

    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  function haptic(duration = 10) {
    try { if (navigator.vibrate) navigator.vibrate(duration); } catch (_) {}
  }

  let toastTimer = null;
  function showToast(msg, icon = 'fa-circle-check') {
    if (!DOM.toast) return;
    DOM.toastMessage.textContent = msg;
    const iconEl = DOM.toast.querySelector('.toast-icon');
    if (iconEl) iconEl.className = `toast-icon fa-solid ${icon}`;
    DOM.toast.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { DOM.toast.style.display = 'none'; }, 3200);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLASH SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  function hideSplash() {
    if (!DOM.splash) return;
    DOM.splash.classList.add('hiding');
    setTimeout(() => { DOM.splash.classList.add('hidden'); }, 550);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    setupTabNavigation();
    setupEventListeners();
    loadSystemInfo();
    renderContinueWatching();
    updateLibraryCounts();
    loadExtensionsAndRepos();
    await loadHomeCatalog();
    registerServiceWorker();
    // Hide splash after home catalog loads (or after 2.5s max)
    hideSplash();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB NAVIGATION — Android slide transition
  // ═══════════════════════════════════════════════════════════════════════════
  let prevTab = 'tab-home';

  function setupTabNavigation() {
    DOM.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        haptic(8);
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    DOM.brandLogoBtn.addEventListener('click', () => switchTab('tab-home'));
    DOM.headerSearchBtn.addEventListener('click', () => {
      switchTab('tab-search');
      setTimeout(() => DOM.searchInput && DOM.searchInput.focus(), 120);
    });
  }

  function switchTab(tabId) {
    if (tabId === AppState.currentTab) return;
    prevTab = AppState.currentTab;
    AppState.currentTab = tabId;

    DOM.tabButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    // Animate: outgoing slides left, incoming slides from right
    DOM.tabPages.forEach(page => {
      if (page.id === tabId) {
        page.style.display = 'block';
        page.style.opacity = '0';
        page.style.transform = 'translateX(20px)';
        requestAnimationFrame(() => {
          page.classList.add('active');
          page.style.opacity = '1';
          page.style.transform = 'translateX(0)';
        });
      } else if (page.classList.contains('active')) {
        page.classList.remove('active');
        page.style.opacity = '0';
        page.style.transform = 'translateX(-20px)';
        setTimeout(() => {
          page.style.display = '';
          page.style.opacity = '';
          page.style.transform = '';
        }, 240);
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'tab-library') renderLibraryView('watchlist');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM INFO
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadSystemInfo() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      AppState.systemInfo = data;
      if (DOM.qrNetworkUrl) DOM.qrNetworkUrl.textContent = data.accessUrl;
      if (DOM.qrCodeImg) {
        DOM.qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.accessUrl)}`;
      }
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME CATALOG
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadHomeCatalog() {
    try {
      const res = await fetch('/api/home');
      const catalog = await res.json();

      if (catalog.hero && catalog.hero.length > 0) {
        AppState.heroItems = catalog.hero;
        renderHero(0);
        startHeroTimer();
      }

      renderShelves(catalog.sections || []);
    } catch (err) {
      console.error('Home catalog failed:', err);
      DOM.dynamicShelvesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrapper"><i class="fa-solid fa-triangle-exclamation empty-icon"></i></div>
          <h3>Failed to load catalog</h3>
          <p>Check your connection and reload.</p>
          <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 18px;">Reload</button>
        </div>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO RENDERER
  // ═══════════════════════════════════════════════════════════════════════════
  function renderHero(index) {
    if (!AppState.heroItems.length) return;
    const item = AppState.heroItems[index];
    AppState.currentHeroIndex = index;

    // Fade out hero content during swap
    if (DOM.heroContent) { DOM.heroContent.style.opacity = '0'; }

    DOM.heroBackdrop.style.backgroundImage = `url(${item.backdrop || item.poster})`;
    DOM.heroPillType.textContent = item.type === 'tv' ? 'SERIES' : 'MOVIE';
    DOM.heroRating.innerHTML = `<i class="fa-solid fa-star"></i> ${item.rating || '8.5'}`;
    DOM.heroYear.textContent = item.year || '2026';
    DOM.heroTitle.textContent = item.title;
    DOM.heroOverview.textContent = item.overview || 'Enjoy streaming in high definition.';

    const isSaved = AppState.watchlist.some(w => w.id === item.id);
    DOM.heroBookmarkBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';

    DOM.heroDots.innerHTML = AppState.heroItems.map((_, i) =>
      `<div class="hero-dot ${i === index ? 'active' : ''}" data-index="${i}"></div>`
    ).join('');

    DOM.heroDots.querySelectorAll('.hero-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        clearInterval(AppState.heroTimer);
        renderHero(parseInt(dot.getAttribute('data-index')));
        startHeroTimer();
      });
    });

    DOM.heroPlayBtn.onclick = () => { haptic(12); openPlayer(item); };
    DOM.heroDetailsBtn.onclick = () => { haptic(8); openDetailsModal(item.type, item.id); };
    DOM.heroBookmarkBtn.onclick = () => toggleBookmark(item, DOM.heroBookmarkBtn);

    // Hide skeleton, show content
    if (DOM.heroSkeleton) DOM.heroSkeleton.classList.add('hidden');
    if (DOM.heroContent) {
      setTimeout(() => { DOM.heroContent.style.opacity = '1'; }, 50);
    }
  }

  function startHeroTimer() {
    clearInterval(AppState.heroTimer);
    AppState.heroTimer = setInterval(() => {
      renderHero((AppState.currentHeroIndex + 1) % AppState.heroItems.length);
    }, 6500);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHELVES RENDERER
  // ═══════════════════════════════════════════════════════════════════════════
  function renderShelves(sections) {
    let html = '';
    sections.forEach(sec => {
      html += `
        <section class="media-shelf">
          <div class="shelf-header">
            <h2 class="shelf-title">${sec.title}</h2>
          </div>
          <div class="shelf-row horizontal-scroll">
            ${sec.items.map(item => renderMediaCardHtml(item)).join('')}
          </div>
        </section>
      `;
    });
    DOM.dynamicShelvesContainer.innerHTML = html;

    DOM.dynamicShelvesContainer.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        haptic(8);
        openDetailsModal(card.getAttribute('data-type'), card.getAttribute('data-id'));
      });
    });
  }

  function renderMediaCardHtml(item) {
    const poster = item.poster || '/icons/placeholder.png';
    const rating = item.rating ? `<span class="card-rating-badge"><i class="fa-solid fa-star"></i> ${item.rating}</span>` : '';
    const type = item.type ? `<span class="card-type-badge">${item.type === 'tv' ? 'TV' : 'FILM'}</span>` : '';
    return `
      <div class="media-card" data-id="${item.id}" data-type="${item.type || 'movie'}">
        <div class="poster-box">
          <img src="${poster}" alt="${item.title}" class="poster-img" loading="lazy">
          ${rating}${type}
        </div>
        <div class="card-info">
          <div class="card-title">${item.title}</div>
          <div class="card-meta">
            <span>${item.year || ''}</span>
            <span>HD</span>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTINUE WATCHING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderContinueWatching() {
    if (!AppState.watchHistory.length) {
      DOM.continueWatchingShelf.style.display = 'none';
      return;
    }
    DOM.continueWatchingShelf.style.display = 'block';
    DOM.continueWatchingRow.innerHTML = AppState.watchHistory.map(item => {
      const thumb = item.backdrop || item.still || item.poster || '';
      const sub = item.type === 'tv' ? `S${item.season} E${item.episode}` : (item.year || '');
      const pct = Math.min(100, Math.max(10, item.progress || 35));
      return `
        <div class="media-card resume-card" data-id="${item.id}" data-type="${item.type}">
          <div class="resume-thumb-box">
            <img src="${thumb}" alt="${item.title}" loading="lazy">
            <div class="play-overlay-icon"><i class="fa-solid fa-play"></i></div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="card-info">
            <div class="card-title">${item.title}</div>
            <div class="card-meta">${sub}</div>
          </div>
        </div>
      `;
    }).join('');

    DOM.continueWatchingRow.querySelectorAll('.resume-card').forEach((card, idx) => {
      card.addEventListener('click', () => {
        haptic(12);
        const h = AppState.watchHistory[idx];
        openPlayer(h, h.season || 1, h.episode || 1);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMISTIC ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════

  // Pre-fetch source list for a media item, store in cache.
  // Called immediately when the details modal opens — so sources are ready
  // BEFORE the user even taps Play.
  function prefetchSources(media, season = 1, episode = 1) {
    const key = `${media.tmdbId || media.id}:${media.type}:${season}:${episode}`;
    if (AppState.sourcePreCache.has(key)) return; // already cached

    const params = new URLSearchParams({
      type: media.type || 'movie',
      id: media.id,
      tmdbId: media.tmdbId || media.id,
      season: season || 1,
      episode: episode || 1,
      sub: AppState.settings.preferredSubtitle || 'en'
    });

    const sources = [];
    // Mark with empty array immediately so duplicate calls don't double-fetch
    AppState.sourcePreCache.set(key, sources);

    const sse = new EventSource(`/api/sources/stream?${params.toString()}`);
    sse.onmessage = (evt) => {
      try {
        const s = JSON.parse(evt.data);
        if (s.__done__) { sse.close(); return; }
        sources.push(s);
      } catch (_) {}
    };
    sse.onerror = () => sse.close();
  }

  // Silently pre-load the first embed URL in a hidden offscreen iframe.
  // When the user actually taps Play, the iframe is already connecting —
  // cutting perceived wait by 500-1500ms on most devices.
  function prewarmIframe(media, season = 1, episode = 1) {
    const key = `${media.tmdbId || media.id}:${media.type}:${season}:${episode}`;
    if (AppState.prewarmKey === key) return; // already pre-warming this
    AppState.prewarmKey = key;

    // Remove previous pre-warm frame
    if (AppState.prewarmFrame) {
      AppState.prewarmFrame.remove();
      AppState.prewarmFrame = null;
    }

    // Wait for source cache to have at least 1 entry
    const tryPrewarm = () => {
      const cached = AppState.sourcePreCache.get(key);
      if (!cached || !cached.length) {
        setTimeout(tryPrewarm, 200);
        return;
      }
      const first = cached[0];
      if (!first || !first.url) return;

      const frame = document.createElement('iframe');
      frame.className = 'prewarm-iframe';
      frame.src = first.url;
      frame.setAttribute('allow', 'autoplay; encrypted-media');
      frame.setAttribute('referrerpolicy', 'origin');
      document.body.appendChild(frame);
      AppState.prewarmFrame = frame;
    };
    setTimeout(tryPrewarm, 300);
  }

  // Preload an image into browser cache
  function preloadImage(src) {
    if (!src) return;
    const img = new Image();
    img.src = src;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA DETAILS MODAL — with skeleton loading + optimistic prefetch
  // ═══════════════════════════════════════════════════════════════════════════
  async function openDetailsModal(type, id) {
    haptic(10);
    DOM.detailsModal.style.display = 'flex';

    // Show skeleton immediately
    if (DOM.detailsSkeleton) DOM.detailsSkeleton.classList.remove('hidden');
    DOM.detailsTitle.textContent = '';
    DOM.detailsBadges.innerHTML = '';
    DOM.detailsGenres.innerHTML = '';
    DOM.detailsCastRow.innerHTML = '';
    DOM.detailsSimilarRow.innerHTML = '';
    DOM.tvEpisodesSection.style.display = 'none';

    try {
      const res = await fetch(`/api/details?type=${type}&id=${id}`);
      const data = await res.json();
      AppState.activeMedia = data;

      // ★ OPTIMISTIC: start pre-fetching sources and pre-warming iframe
      //   RIGHT NOW while the user reads the details UI. No spinner.
      prefetchSources(data, 1, 1);
      prewarmIframe(data, 1, 1);
      // Also preload backdrop so details hero is instant
      preloadImage(data.backdrop);
      preloadImage(data.poster);

      DOM.detailsBackdrop.style.backgroundImage = `url(${data.backdrop || data.poster})`;
      DOM.detailsPoster.src = data.poster || '';
      DOM.detailsTitle.textContent = data.title;
      DOM.detailsSynopsis.textContent = data.overview || 'No synopsis available.';

      DOM.detailsBadges.innerHTML = `
        <span class="hero-pill-badge">${data.type === 'tv' ? 'TV SERIES' : 'MOVIE'}</span>
        ${data.rating ? `<span class="hero-rating"><i class="fa-solid fa-star"></i> ${data.rating}</span>` : ''}
        <span class="hero-year">${data.year || ''}</span>
        ${data.runtime ? `<span class="hero-quality">${data.runtime} min</span>` : ''}
        <span class="hero-quality">1080p</span>
      `;

      DOM.detailsGenres.innerHTML = (data.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('');

      const isSaved = AppState.watchlist.some(w => w.id === data.id);
      DOM.detailsFavBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
      DOM.detailsFavBtn.onclick = () => toggleBookmark(data, DOM.detailsFavBtn);

      DOM.detailsPlayBtn.onclick = () => {
        DOM.detailsModal.style.display = 'none';
        openPlayer(data, 1, 1);
      };

      if (data.type === 'tv' && data.seasons && data.seasons.length > 0) {
        DOM.tvEpisodesSection.style.display = 'block';
        DOM.seasonSelector.innerHTML = data.seasons.map(s =>
          `<option value="${s.seasonNumber}">${s.name} (${s.episodeCount} eps)</option>`
        ).join('');
        DOM.seasonSelector.onchange = () => loadSeasonEpisodes(data.id, DOM.seasonSelector.value);
        await loadSeasonEpisodes(data.id, data.seasons[0].seasonNumber);
      }

      if (data.cast && data.cast.length > 0) {
        DOM.detailsCastRow.innerHTML = data.cast.map(c => `
          <div class="cast-card">
            <img src="${c.profile || '/icons/avatar.png'}" alt="${c.name}" class="cast-avatar" loading="lazy">
            <div class="cast-name">${c.name}</div>
          </div>
        `).join('');
      } else {
        document.getElementById('details-cast-section').style.display = 'none';
      }

      if (data.similar && data.similar.length > 0) {
        DOM.detailsSimilarRow.innerHTML = data.similar.map(item => renderMediaCardHtml(item)).join('');
        DOM.detailsSimilarRow.querySelectorAll('.media-card').forEach(card => {
          card.addEventListener('click', () => {
            openDetailsModal(card.getAttribute('data-type'), card.getAttribute('data-id'));
          });
        });
        // Optimistically prefetch sources for first similar item too (idle callback)
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            if (data.similar[0]) prefetchSources(data.similar[0], 1, 1);
          }, { timeout: 3000 });
        }
      } else {
        document.getElementById('details-similar-section').style.display = 'none';
      }

      // Hide skeleton after data loaded
      if (DOM.detailsSkeleton) DOM.detailsSkeleton.classList.add('hidden');

    } catch (err) {
      console.error('Details failed:', err);
      if (DOM.detailsSkeleton) DOM.detailsSkeleton.classList.add('hidden');
      showToast('Failed to load details', 'fa-triangle-exclamation');
    }
  }

  async function loadSeasonEpisodes(tvId, seasonNumber) {
    DOM.episodesList.innerHTML = `
      <div style="padding:12px;color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Loading episodes...
      </div>
    `;
    try {
      const res = await fetch(`/api/season?id=${tvId}&season=${seasonNumber}`);
      const data = await res.json();
      AppState.activeSeasonEpisodes = data.episodes || [];

      DOM.episodesList.innerHTML = AppState.activeSeasonEpisodes.map((ep, idx) => `
        <div class="episode-item" data-index="${idx}">
          <div class="episode-thumb-box">
            <img src="${ep.still || AppState.activeMedia.backdrop || AppState.activeMedia.poster || ''}" alt="${ep.name}" loading="lazy">
            <div class="play-overlay-icon" style="font-size:16px;background:rgba(0,0,0,0.35);">
              <i class="fa-solid fa-play"></i>
            </div>
          </div>
          <div class="episode-info">
            <div class="episode-number-title">${ep.episodeNumber}. ${ep.name}</div>
            <div class="episode-desc">${ep.overview || 'Episode ' + ep.episodeNumber}</div>
          </div>
        </div>
      `).join('');

      DOM.episodesList.querySelectorAll('.episode-item').forEach(item => {
        item.addEventListener('click', () => {
          haptic(12);
          const idx = parseInt(item.getAttribute('data-index'));
          const ep = AppState.activeSeasonEpisodes[idx];
          DOM.detailsModal.style.display = 'none';
          openPlayer(AppState.activeMedia, seasonNumber, ep.episodeNumber, idx);
        });
      });
    } catch (err) {
      console.error('Episodes failed:', err);
      DOM.episodesList.innerHTML = '<div style="padding:12px;color:var(--text-muted)">Failed to load episodes.</div>';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER — Open fullscreen video player (OPTIMISTIC: uses pre-warm cache)
  // ═══════════════════════════════════════════════════════════════════════════
  async function openPlayer(media, season = 1, episode = 1, epIndex = 0) {
    AppState.activeMedia = { ...media, season, episode };
    AppState.currentEpisodeIndex = epIndex;

    DOM.playerModal.style.display = 'flex';
    DOM.playerModal.classList.add('optimistic-loading');
    DOM.playerMainTitle.textContent = media.title;

    const isTv = media.type === 'tv';
    DOM.playerSubTitle.textContent = isTv ? `Season ${season} · Episode ${episode}` : (media.year || 'Movie');

    if (isTv) {
      DOM.playerBottomBar.style.display = 'flex';
      DOM.prevEpBtn.style.display = epIndex > 0 ? 'inline-flex' : 'none';
      DOM.nextEpBtn.style.display = 'inline-flex';
      if (DOM.playerEpInfo) DOM.playerEpInfo.textContent = `S${season} E${episode}`;
    } else {
      DOM.playerBottomBar.style.display = 'none';
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: media.title,
        artist: isTv ? `S${season}E${episode}` : 'CloudStream iOS',
        album: 'CloudStream',
        artwork: [{ src: media.poster || '', sizes: '512x512', type: 'image/jpeg' }]
      });
    }

    saveToHistory(media, season, episode);

    // Instant visual: show cinematic backdrop NOW (no wait)
    if (DOM.playerBackdropImg) DOM.playerBackdropImg.src = media.backdrop || media.poster || '';
    if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.remove('hidden');
    if (DOM.playerLoadingText) DOM.playerLoadingText.textContent = 'Preparing stream\u2026';
    if (DOM.playerLoadingSource) DOM.playerLoadingSource.textContent = '';

    // Add live queue dots to show source resolution progress
    const existingQueue = DOM.playerLoadingOverlay && DOM.playerLoadingOverlay.querySelector('.player-loading-queue');
    if (!existingQueue && DOM.playerLoadingOverlay) {
      const loadCenter = DOM.playerLoadingOverlay.querySelector('.player-loading-center');
      if (loadCenter) {
        const queueEl = document.createElement('div');
        queueEl.className = 'player-loading-queue';
        queueEl.innerHTML = Array(9).fill('<div class="player-loading-queue-dot"></div>').join('');
        loadCenter.appendChild(queueEl);
      }
    }

    clearSubtitles();

    // \u2605 OPTIMISTIC: Check pre-cache first
    const cacheKey = `${media.tmdbId || media.id}:${media.type}:${season}:${episode}`;
    const cached = AppState.sourcePreCache.get(cacheKey);

    if (cached && cached.length > 0) {
      // \u26a1 INSTANT PATH \u2014 sources already loaded, ZERO SSE wait
      console.log(`[Optimistic] Cache HIT for ${cacheKey} \u2014 ${cached.length} sources ready`);
      if (DOM.playerLoadingText) DOM.playerLoadingText.textContent = 'Stream ready!';
      AppState.currentSourceList = [...cached];

      const prefServerId = AppState.settings.preferredServer || 'vidlink-pro';
      const initialSource = cached.find(s => s.id.startsWith(prefServerId) || s.id.includes(prefServerId)) || cached[0];

      // Populate server drawer immediately
      if (DOM.serverDrawerList) {
        DOM.serverDrawerList.innerHTML = '';
        cached.forEach((source) => addSourceToDrawer(source, source.id === initialSource.id));
      }

      DOM.currentServerLabel.textContent = initialSource.name;
      AppState.currentServer = initialSource.id;

      // If we have a pre-warmed iframe for this source, promote it to the real player
      if (AppState.prewarmFrame && AppState.prewarmKey === cacheKey && initialSource === cached[0]) {
        const realFrame = DOM.streamEmbedFrame;
        realFrame.src = AppState.prewarmFrame.src;
        realFrame.style.display = 'block';
        realFrame.onload = () => {
          DOM.playerModal.classList.remove('optimistic-loading');
          if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
        };
        DOM.nativeVideoPlayer.style.display = 'none';
        AppState.prewarmFrame.remove();
        AppState.prewarmFrame = null;
        clearTimeout(window._overlayTimer);
        window._overlayTimer = setTimeout(() => {
          DOM.playerModal.classList.remove('optimistic-loading');
          if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
        }, 1800);
      } else {
        // Switch directly to initialSource
        switchServer(initialSource.id);
        DOM.playerModal.classList.remove('optimistic-loading');
      }

    } else {
      // \u23f3 COLD PATH \u2014 fetch via SSE (happens on direct play without details modal)
      console.log(`[Optimistic] Cache MISS for ${cacheKey} \u2014 fetching SSE`);
      await loadStreamSources(media, season, episode);
      DOM.playerModal.classList.remove('optimistic-loading');
    }

    if (AppState.settings.autoSubtitles && AppState.settings.preferredSubtitle !== 'off') {
      fetchSubtitles(media, season, episode);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STREAM SOURCES \u2014 SSE parallel architecture (Android RepoLinkGenerator)
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadStreamSources(media, season, episode) {
    const params = new URLSearchParams({
      type: media.type || 'movie',
      id: media.id,
      tmdbId: media.tmdbId || media.id,
      season: season || 1,
      episode: episode || 1,
      sub: AppState.settings.preferredSubtitle || 'en'
    });

    const cacheKey = `${media.tmdbId || media.id}:${media.type}:${season}:${episode}`;

    DOM.currentServerLabel.textContent = 'Finding servers\u2026';
    AppState.currentSourceList = [];
    if (DOM.serverDrawerList) DOM.serverDrawerList.innerHTML = '';

    let firstSourceLoaded = false;
    let sourceIdx = 0;

    if (window.activeSourceSSE) {
      window.activeSourceSSE.close();
      window.activeSourceSSE = null;
    }

    // Get queue dots (may have been injected by openPlayer)
    const queueDots = DOM.playerLoadingOverlay
      ? Array.from(DOM.playerLoadingOverlay.querySelectorAll('.player-loading-queue-dot'))
      : [];

    const sse = new EventSource(`/api/sources/stream?${params.toString()}`);
    window.activeSourceSSE = sse;

    sse.onmessage = (event) => {
      try {
        const source = JSON.parse(event.data);
        if (source.__done__) {
          sse.close(); window.activeSourceSSE = null;
          // Write to pre-cache so future plays of same content are instant
          AppState.sourcePreCache.set(cacheKey, [...AppState.currentSourceList]);
          // Mark all loaded dots green
          queueDots.forEach((d, i) => {
            if (i < AppState.currentSourceList.length) d.classList.add('done');
            d.classList.remove('active');
          });
          return;
        }

        AppState.currentSourceList.push(source);

        // Animate queue dot for this source
        if (queueDots[sourceIdx]) {
          if (sourceIdx > 0 && queueDots[sourceIdx - 1]) {
            queueDots[sourceIdx - 1].classList.remove('active');
            queueDots[sourceIdx - 1].classList.add('done');
          }
          queueDots[sourceIdx].classList.add('active');
        }
        sourceIdx++;

        // Add to server drawer
        addSourceToDrawer(source, !firstSourceLoaded && AppState.currentSourceList.length === 1);

        // First source fires immediately \u2014 no waiting (Android pattern)
        if (!firstSourceLoaded) {
          firstSourceLoaded = true;
          AppState.currentServer = source.id;
          DOM.currentServerLabel.textContent = source.name;
          if (DOM.playerLoadingSource) DOM.playerLoadingSource.textContent = source.name;
          switchServer(source.id);
        }

      } catch (e) { console.warn('SSE parse error:', e); }
    };

    sse.onerror = () => {
      sse.close();
      window.activeSourceSSE = null;
      if (!firstSourceLoaded) {
        DOM.currentServerLabel.textContent = 'Server 1';
        showToast('Could not connect to servers', 'fa-triangle-exclamation');
        if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      }
    };
  }

  // Helper: add a source to the server drawer DOM
  function addSourceToDrawer(source, isActive) {
    if (!DOM.serverDrawerList) return;
    const item = document.createElement('div');
    item.className = `server-drawer-item ${isActive ? 'active' : ''}`;
    item.setAttribute('data-server-id', source.id);
    item.innerHTML = `
      <div class="server-item-left">
        <span class="server-item-name">${source.name}</span>
        <span class="server-item-desc">${source.description || 'High-speed streaming mirror'}</span>
      </div>
      <div class="server-item-right">
        <span class="server-quality-pill">${source.quality || '1080p'}</span>
        <div class="server-active-check" style="${isActive ? '' : 'display:none;'}">
          <i class="fa-solid fa-check"></i>
        </div>
      </div>
    `;
    item.addEventListener('click', () => {
      haptic(10);
      switchServer(source.id);
      if (DOM.serverDrawerBackdrop) DOM.serverDrawerBackdrop.style.display = 'none';
    });
    DOM.serverDrawerList.appendChild(item);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SWITCH SERVER
  // ═══════════════════════════════════════════════════════════════════════════
  function switchServer(serverId) {
    AppState.currentServer = serverId;
    const source = AppState.currentSourceList.find(s => s.id === serverId);
    if (!source) return;

    DOM.currentServerLabel.textContent = source.name;

    // Update drawer highlights
    if (DOM.serverDrawerList) {
      DOM.serverDrawerList.querySelectorAll('.server-drawer-item').forEach(el => {
        const isCur = el.getAttribute('data-server-id') === serverId;
        el.classList.toggle('active', isCur);
        const check = el.querySelector('.server-active-check');
        if (check) check.style.display = isCur ? 'flex' : 'none';
      });
    }

    const isDirectHls = source.type === 'direct' && source.url &&
      (source.url.includes('.m3u8') || source.url.includes('.mp4'));

    if (isDirectHls) {
      // DIRECT mode: native <video> with HLS.js (zero spinner, hardware decoded)
      if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      DOM.streamEmbedFrame.style.display = 'none';
      DOM.streamEmbedFrame.src = 'about:blank';
      DOM.nativeVideoPlayer.style.display = 'block';
      if (DOM.playerHud) DOM.playerHud.style.display = 'block';

      if (window.activeHlsInstance) {
        window.activeHlsInstance.destroy();
        window.activeHlsInstance = null;
      }

      if (window.Hls && Hls.isSupported() && source.url.includes('.m3u8')) {
        const hls = new Hls({ enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60 });
        window.activeHlsInstance = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            hls.destroy(); window.activeHlsInstance = null;
            const idx = AppState.currentSourceList.findIndex(s => s.id === serverId);
            const next = AppState.currentSourceList[idx + 1];
            if (next) switchServer(next.id);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          DOM.nativeVideoPlayer.play().catch(() => {});
          setupNativePlayerHUD();
        });

        hls.loadSource(source.url);
        hls.attachMedia(DOM.nativeVideoPlayer);

      } else {
        // Safari native HLS / MP4
        DOM.nativeVideoPlayer.src = source.url;
        DOM.nativeVideoPlayer.play().catch(() => {});
        setupNativePlayerHUD();
      }

    } else {
      // EMBED mode: iframe
      DOM.nativeVideoPlayer.style.display = 'none';
      DOM.nativeVideoPlayer.pause();
      if (DOM.playerHud) DOM.playerHud.style.display = 'none';
      if (window.activeHlsInstance) { window.activeHlsInstance.destroy(); window.activeHlsInstance = null; }

      if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.remove('hidden');

      // Wire iframe onload to hide overlay
      DOM.streamEmbedFrame.onload = () => {
        setTimeout(() => {
          if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
        }, 600);
      };

      DOM.streamEmbedFrame.src = source.url;
      DOM.streamEmbedFrame.style.display = 'block';

      // Fallback: always hide overlay after 2.5s even if onload fires late
      clearTimeout(window._overlayTimer);
      window._overlayTimer = setTimeout(() => {
        if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      }, 2500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NATIVE PLAYER HUD (Progress Bar, Time, Play/Pause)
  // ═══════════════════════════════════════════════════════════════════════════
  function setupNativePlayerHUD() {
    const video = DOM.nativeVideoPlayer;
    if (!video || !DOM.playerHud) return;

    DOM.playerHud.style.display = 'block';

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('play', () => {
      if (DOM.playerPlayPauseBtn) DOM.playerPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    });
    video.addEventListener('pause', () => {
      if (DOM.playerPlayPauseBtn) DOM.playerPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    });
    video.addEventListener('loadedmetadata', () => {
      if (DOM.playerTimeTotal) DOM.playerTimeTotal.textContent = formatTime(video.duration);
      updateProgress();
    });
  }

  function updateProgress() {
    const video = DOM.nativeVideoPlayer;
    if (!video || !DOM.playerProgressFill) return;
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    DOM.playerProgressFill.style.width = pct + '%';
    if (DOM.playerProgressThumb) DOM.playerProgressThumb.style.left = pct + '%';
    if (DOM.playerTimeCurrent) DOM.playerTimeCurrent.textContent = formatTime(video.currentTime);
  }

  function updateBuffered() {
    const video = DOM.nativeVideoPlayer;
    if (!video || !DOM.playerBufferedFill || !video.buffered.length) return;
    const pct = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;
    DOM.playerBufferedFill.style.width = pct + '%';
  }

  // Progress bar seeking
  function setupProgressBarSeek() {
    if (!DOM.playerProgressBar) return;
    const seek = (e) => {
      const video = DOM.nativeVideoPlayer;
      if (!video || !video.duration) return;
      const rect = DOM.playerProgressBar.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      video.currentTime = pct * video.duration;
      updateProgress();
    };

    let seeking = false;
    DOM.playerProgressBar.addEventListener('mousedown', (e) => { seeking = true; seek(e); });
    DOM.playerProgressBar.addEventListener('touchstart', (e) => { seeking = true; seek(e); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (seeking) seek(e); });
    document.addEventListener('touchmove', (e) => { if (seeking) seek(e); });
    document.addEventListener('mouseup', () => { seeking = false; });
    document.addEventListener('touchend', () => { seeking = false; });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBTITLE ENGINE — VTT/SRT Parser + Renderer
  // ═══════════════════════════════════════════════════════════════════════════
  async function fetchSubtitles(media, season = 1, episode = 1) {
    const lang = AppState.settings.preferredSubtitle;
    if (!lang || lang === 'off') return;

    try {
      const params = new URLSearchParams({
        tmdbId: media.tmdbId || media.id,
        lang,
        type: media.type || 'movie',
        season, episode
      });
      const res = await fetch(`/api/subtitles?${params}`);
      const data = await res.json();
      AppState.subtitleTracks = data.tracks || [];

      if (AppState.subtitleTracks.length > 0) {
        // Auto-load the first track
        loadSubtitleTrack(AppState.subtitleTracks[0]);
        updateSubLabel(lang);
        renderSubtitleDrawer();
      } else {
        updateSubLabel('off');
      }
    } catch (err) {
      console.warn('Subtitle fetch failed:', err);
      updateSubLabel('off');
    }
  }

  async function loadSubtitleTrack(track) {
    if (!track || !track.downloadUrl) return;
    AppState.activeSubTrack = track;

    try {
      const res = await fetch(track.downloadUrl);
      const vttText = await res.text();
      AppState.subtitleCues = parseVTT(vttText);

      // For native video: start cue render loop
      if (DOM.nativeVideoPlayer && DOM.nativeVideoPlayer.style.display !== 'none') {
        startSubtitleRenderLoop();
      }

      showToast(`Subtitles: ${track.name || track.lang.toUpperCase()}`, 'fa-closed-captioning');
    } catch (err) {
      console.warn('Subtitle load failed:', err);
    }
  }

  function parseVTT(vttText) {
    const cues = [];
    const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let i = 0;
    while (i < lines.length) {
      const timeLine = lines[i];
      const match = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
      if (match) {
        const start = parseTime(match[1]);
        const end = parseTime(match[2]);
        const textLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }
        const text = textLines.join('\n').replace(/<[^>]+>/g, ''); // strip tags
        if (text.trim()) cues.push({ start, end, text: text.trim() });
      } else {
        i++;
      }
    }
    return cues;
  }

  function parseTime(str) {
    const s = str.replace(',', '.');
    const parts = s.split(':');
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return seconds;
  }

  function startSubtitleRenderLoop() {
    clearInterval(AppState.subtitleTimer);
    AppState.subtitleTimer = setInterval(() => {
      const video = DOM.nativeVideoPlayer;
      if (!video || !DOM.subtitleDisplay) return;
      const t = video.currentTime;
      const activeCues = AppState.subtitleCues.filter(c => t >= c.start && t <= c.end);
      if (activeCues.length > 0) {
        DOM.subtitleDisplay.innerHTML = activeCues.map(c =>
          `<div class="subtitle-cue">${c.text.replace(/\n/g, '<br>')}</div>`
        ).join('');
      } else {
        DOM.subtitleDisplay.innerHTML = '';
      }
    }, 150);
  }

  function clearSubtitles() {
    clearInterval(AppState.subtitleTimer);
    AppState.subtitleTracks = [];
    AppState.activeSubTrack = null;
    AppState.subtitleCues = [];
    if (DOM.subtitleDisplay) DOM.subtitleDisplay.innerHTML = '';
    if (DOM.currentSubLabel) DOM.currentSubLabel.textContent = 'CC';
  }

  function updateSubLabel(lang) {
    if (!DOM.currentSubLabel) return;
    DOM.currentSubLabel.textContent = lang === 'off' ? 'Off' : lang.toUpperCase();
  }

  // Subtitle languages for drawer
  const SUBTITLE_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧', badge: '[CC]', desc: 'Full English closed captions' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', badge: 'हिन्दी', desc: 'Hindi subtitle track' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', badge: 'Español', desc: 'Spanish subtitle track' },
    { code: 'fr', name: 'French', flag: '🇫🇷', badge: 'Français', desc: 'French subtitle track' },
    { code: 'de', name: 'German', flag: '🇩🇪', badge: 'Deutsch', desc: 'German subtitle track' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', badge: 'عربي', desc: 'Arabic subtitle track' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷', badge: 'Português', desc: 'Portuguese subtitle track' },
    { code: 'off', name: 'Captions Off', flag: '🚫', badge: 'Off', desc: 'Hide all on-screen subtitles' }
  ];

  function renderSubtitleDrawer() {
    if (!DOM.subDrawerList) return;
    DOM.subDrawerList.innerHTML = '';
    const currentCode = AppState.settings.preferredSubtitle || 'en';

    // Show fetched tracks if available
    if (AppState.subtitleTracks.length > 0) {
      const header = document.createElement('div');
      header.style.cssText = 'font-size:11px;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;';
      header.textContent = 'Available Tracks';
      DOM.subDrawerList.appendChild(header);

      AppState.subtitleTracks.forEach(track => {
        const isActive = AppState.activeSubTrack && AppState.activeSubTrack.id === track.id;
        const item = document.createElement('div');
        item.className = `server-drawer-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
          <div class="server-item-left">
            <span class="server-item-name">${track.name || track.lang.toUpperCase()}</span>
            <span class="server-item-desc">Synced · VTT</span>
          </div>
          <div class="server-item-right">
            <span class="server-quality-pill">AUTO</span>
            <div class="server-active-check" style="${isActive ? '' : 'display:none;'}">
              <i class="fa-solid fa-check"></i>
            </div>
          </div>
        `;
        item.addEventListener('click', () => {
          haptic(10);
          loadSubtitleTrack(track);
          updateSubLabel(track.lang);
          AppState.settings.preferredSubtitle = track.lang;
          renderSubtitleDrawer();
          if (DOM.subDrawerBackdrop) DOM.subDrawerBackdrop.style.display = 'none';
        });
        DOM.subDrawerList.appendChild(item);
      });

      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:10px 0;';
      DOM.subDrawerList.appendChild(sep);
    }

    // Language selector
    const langHeader = document.createElement('div');
    langHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;';
    langHeader.textContent = 'Fetch by Language';
    DOM.subDrawerList.appendChild(langHeader);

    SUBTITLE_LANGUAGES.forEach(lang => {
      const isCur = lang.code === currentCode;
      const item = document.createElement('div');
      item.className = `server-drawer-item ${isCur ? 'active' : ''}`;
      item.innerHTML = `
        <div class="server-item-left">
          <span class="server-item-name">${lang.flag} ${lang.name}</span>
          <span class="server-item-desc">${lang.desc}</span>
        </div>
        <div class="server-item-right">
          <span class="server-quality-pill">${lang.badge}</span>
          <div class="server-active-check" style="${isCur ? '' : 'display:none;'}">
            <i class="fa-solid fa-check"></i>
          </div>
        </div>
      `;
      item.addEventListener('click', () => {
        haptic(10);
        AppState.settings.preferredSubtitle = lang.code;
        localStorage.setItem('cs_pref_sub', lang.code);
        updateSubLabel(lang.code);

        if (lang.code === 'off') {
          clearSubtitles();
          AppState.settings.preferredSubtitle = 'off';
        } else if (AppState.activeMedia) {
          fetchSubtitles(AppState.activeMedia, AppState.activeMedia.season || 1, AppState.activeMedia.episode || 1);
        }

        renderSubtitleDrawer();
        if (DOM.subDrawerBackdrop) DOM.subDrawerBackdrop.style.display = 'none';
        showToast(`Subtitles: ${lang.name}`, 'fa-closed-captioning');
      });
      DOM.subDrawerList.appendChild(item);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER GESTURE CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupPlayerGestures() {
    const fc = DOM.playerModal;
    if (!fc) return;

    let tapCount = 0;
    let tapTimer = null;
    let tapSide = null;

    // Double-tap seek ±10s
    function handleDoubleTap(side) {
      const video = DOM.nativeVideoPlayer;
      const isNative = video && video.style.display !== 'none' && video.src;

      const indicator = side === 'left' ? DOM.seekLeftIndicator : DOM.seekRightIndicator;
      if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 700);
      }

      if (isNative) {
        video.currentTime = Math.max(0, video.currentTime + (side === 'right' ? 10 : -10));
      }

      haptic(20);
    }

    function onTap(e, side) {
      // Ignore if tapping on controls
      if (e.target.closest('.player-header, .player-episode-bar, .player-hud')) return;

      tapCount++;
      clearTimeout(tapTimer);

      if (tapCount === 2 && tapSide === side) {
        handleDoubleTap(side);
        tapCount = 0;
        tapSide = null;
      } else {
        tapSide = side;
        tapTimer = setTimeout(() => {
          tapCount = 0;
          tapSide = null;
          // Single tap = wake controls
          wakeControls();
        }, 280);
      }
    }

    if (DOM.gestureLeft) DOM.gestureLeft.addEventListener('click', (e) => onTap(e, 'left'));
    if (DOM.gestureRight) DOM.gestureRight.addEventListener('click', (e) => onTap(e, 'right'));
  }

  // Auto-hide controls logic
  let controlsTimer = null;
  function wakeControls() {
    DOM.playerModal.classList.remove('controls-hidden');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      DOM.playerModal.classList.add('controls-hidden');
    }, 3500);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCH HISTORY & BOOKMARKS
  // ═══════════════════════════════════════════════════════════════════════════
  function saveToHistory(media, season = 1, episode = 1) {
    const item = {
      id: media.id,
      tmdbId: media.tmdbId || media.id,
      type: media.type || 'movie',
      title: media.title,
      poster: media.poster,
      backdrop: media.backdrop,
      year: media.year,
      season, episode,
      episodeName: `Episode ${episode}`,
      timestamp: Date.now(),
      progress: 50
    };
    AppState.watchHistory = AppState.watchHistory.filter(h => h.id !== item.id);
    AppState.watchHistory.unshift(item);
    if (AppState.watchHistory.length > 30) AppState.watchHistory.pop();
    localStorage.setItem('cs_history', JSON.stringify(AppState.watchHistory));
    renderContinueWatching();
    updateLibraryCounts();
  }

  function toggleBookmark(item, btnEl) {
    haptic(20);
    const exists = AppState.watchlist.some(w => w.id === item.id);
    if (exists) {
      AppState.watchlist = AppState.watchlist.filter(w => w.id !== item.id);
      if (btnEl) btnEl.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
      showToast('Removed from Watchlist');
    } else {
      AppState.watchlist.unshift({
        id: item.id, type: item.type || 'movie', title: item.title,
        poster: item.poster, backdrop: item.backdrop, rating: item.rating, year: item.year
      });
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
      showToast('Added to Watchlist!');
    }
    localStorage.setItem('cs_watchlist', JSON.stringify(AppState.watchlist));
    updateLibraryCounts();
  }

  function updateLibraryCounts() {
    if (DOM.watchlistCount) DOM.watchlistCount.textContent = AppState.watchlist.length;
    if (DOM.historyCount) DOM.historyCount.textContent = AppState.watchHistory.length;
  }

  function renderLibraryView(tabType = 'watchlist') {
    const items = tabType === 'watchlist' ? AppState.watchlist : AppState.watchHistory;
    if (!items.length) {
      DOM.libraryGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon-wrapper">
            <i class="fa-regular fa-bookmark empty-icon"></i>
          </div>
          <h3>No ${tabType === 'watchlist' ? 'Bookmarks' : 'History'} Yet</h3>
          <p>Explore trending movies and series to add them here.</p>
        </div>
      `;
      return;
    }
    DOM.libraryGrid.innerHTML = items.map(item => renderMediaCardHtml(item)).join('');
    DOM.libraryGrid.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        haptic(8);
        openDetailsModal(card.getAttribute('data-type'), card.getAttribute('data-id'));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH — SSE streaming (Android SearchViewModel pattern)
  // ═══════════════════════════════════════════════════════════════════════════
  let searchTimeout = null;
  let activeSearchSSE = null;

  function handleSearchInput() {
    const query = DOM.searchInput.value.trim();
    DOM.clearSearchBtn.style.display = query.length ? 'block' : 'none';

    clearTimeout(searchTimeout);
    if (activeSearchSSE) { activeSearchSSE.close(); activeSearchSSE = null; }

    if (!query) {
      DOM.searchResultsGrid.innerHTML = `
        <div class="empty-state" id="search-empty-state">
          <div class="empty-icon-wrapper"><i class="fa-solid fa-film empty-icon"></i></div>
          <h3>Discover Unlimited Content</h3>
          <p>Search for your favorite movies, series, or anime above.</p>
        </div>
      `;
      return;
    }

    // Instant skeleton (matches Android Loading() state)
    DOM.searchResultsGrid.innerHTML = `
      ${[0,1,2].map(() => `
        <div class="search-skeleton-group">
          <div class="search-skeleton-title"></div>
          <div class="search-skeleton-row">
            ${[0,1,2,3].map(() => `<div class="search-skeleton-card"></div>`).join('')}
          </div>
        </div>
      `).join('')}
    `;

    searchTimeout = setTimeout(() => startStreamingSearch(query), 300);
  }

  function startStreamingSearch(query) {
    if (activeSearchSSE) { activeSearchSSE.close(); activeSearchSSE = null; }
    let hasFirstResult = false;
    const receivedProviders = [];
    const sse = new EventSource(`/api/search/stream?q=${encodeURIComponent(query)}`);
    activeSearchSSE = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.__done__) {
          sse.close(); activeSearchSSE = null;
          if (receivedProviders.length === 0) {
            DOM.searchResultsGrid.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon-wrapper"><i class="fa-solid fa-face-meh empty-icon"></i></div>
                <h3>No Results Found</h3>
                <p>Try a different keyword or title.</p>
              </div>
            `;
          }
          return;
        }
        receivedProviders.push(data);
        if (!hasFirstResult) { hasFirstResult = true; DOM.searchResultsGrid.innerHTML = ''; }
        appendProviderRow(data);
      } catch (e) { console.warn('SSE parse error:', e); }
    };

    sse.onerror = () => { sse.close(); activeSearchSSE = null; };
  }

  function appendProviderRow(grp) {
    const group = document.createElement('div');
    group.className = 'search-provider-group';
    group.setAttribute('data-provider', grp.providerId);
    group.style.opacity = '0';
    group.style.transform = 'translateY(14px)';
    group.innerHTML = `
      <div class="provider-header-row">
        <h3 class="provider-header-title">
          <i class="fa-solid fa-photo-film" style="color:var(--accent-cyan);font-size:14px;"></i>
          ${grp.providerName}
        </h3>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="provider-badge">${grp.items.length} titles</span>
          <i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:11px;"></i>
        </div>
      </div>
      <div class="provider-cards-row">
        ${grp.items.map(item => renderMediaCardHtml(item)).join('')}
      </div>
    `;

    DOM.searchResultsGrid.appendChild(group);
    requestAnimationFrame(() => {
      group.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      group.style.opacity = '1';
      group.style.transform = 'translateY(0)';
    });

    group.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        haptic(8);
        openDetailsModal(card.getAttribute('data-type'), card.getAttribute('data-id'));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENSIONS & REPOSITORIES
  // ═══════════════════════════════════════════════════════════════════════════
  let communityDirectoryData = [];
  let currentRepoFilter = 'all';

  async function loadExtensionsAndRepos() {
    try {
      const [extsRes, reposRes, commRes] = await Promise.all([
        fetch('/api/extensions'),
        fetch('/api/repositories'),
        fetch('/api/repositories/community')
      ]);
      const exts = await extsRes.json();
      const repos = await reposRes.json();
      communityDirectoryData = await commRes.json();
      renderExtensions(exts);
      renderRepositories(repos);
      renderCommunityDirectory(communityDirectoryData, currentRepoFilter, repos);
    } catch (e) { console.warn('Extensions load failed:', e); }
  }

  function renderCommunityDirectory(directory, filter = 'all', installedRepos = []) {
    const container = document.getElementById('community-repos-list');
    if (!container) return;
    const filtered = directory.filter(item => {
      if (filter === 'all') return true;
      if (filter === 'Hindi') return item.category.includes('Hindi') || item.language.includes('Hindi');
      if (filter === 'OTT') return item.category.includes('OTT');
      if (filter === 'Anime') return item.category.includes('Anime') || item.category.includes('Asian');
      if (filter === 'Sports') return item.category.includes('Sports') || item.category.includes('IPTV');
      if (filter === 'Arabic') return item.language.includes('Arabic');
      if (filter === 'European') return item.language.includes('Italian') || item.language.includes('French');
      return true;
    });
    container.innerHTML = filtered.map(repo => {
      const isInstalled = installedRepos.some(r => r.url === repo.url || r.id === repo.id);
      return `
        <div style="padding:11px 14px;background:var(--bg-surface-elevated);border-radius:14px;border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
              <strong style="font-size:13px;color:var(--text-primary);">${repo.name}</strong>
              <span class="ios-badge" style="font-size:9px;">${repo.category}</span>
              ${repo.shortcode ? `<code style="font-size:10px;color:var(--accent-gold);background:rgba(255,211,42,0.12);padding:1px 5px;border-radius:4px;">${repo.shortcode}</code>` : ''}
            </div>
            <p style="font-size:11px;color:var(--text-secondary);line-height:1.35;margin-bottom:2px;">${repo.description}</p>
            <span style="font-size:10px;color:var(--accent-cyan);">${repo.pluginsCount ? repo.pluginsCount + '+ Plugins' : 'Verified Repo'}</span>
          </div>
          <div>
            ${isInstalled ? `
              <button class="btn btn-glass" style="padding:6px 12px;font-size:11px;opacity:0.7;pointer-events:none;">
                <i class="fa-solid fa-check" style="color:var(--accent-success);"></i> Installed
              </button>
            ` : `
              <button class="btn btn-primary install-community-repo-btn" data-url="${repo.url}" data-name="${repo.name}" style="padding:6px 14px;font-size:11px;">
                <i class="fa-solid fa-download"></i> Install
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.install-community-repo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        haptic(15);
        const url = btn.getAttribute('data-url');
        const name = btn.getAttribute('data-name');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          const res = await fetch('/api/repositories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const data = await res.json();
          if (data.success) {
            showToast(`${name} Installed!`);
            loadExtensionsAndRepos();
          } else {
            showToast(data.error || 'Failed to install', 'fa-triangle-exclamation');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Install';
          }
        } catch (_) {
          showToast('Failed to install repository', 'fa-triangle-exclamation');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-download"></i> Install';
        }
      });
    });
  }

  function renderExtensions(extensions) {
    if (!DOM.extensionList) return;
    if (!extensions.length) {
      DOM.extensionList.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text-muted);">No extensions installed. Add a repository above.</div>';
      return;
    }
    DOM.extensionList.innerHTML = extensions.map(ext => `
      <div class="setting-item" style="padding:10px 0;">
        <div class="setting-info" style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="setting-label">${ext.name}</span>
            <span class="ios-badge" style="font-size:9px;">${ext.type}</span>
          </div>
          <span class="setting-subtext">${ext.description}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="ext-toggle" data-id="${ext.id}" ${ext.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');

    DOM.extensionList.querySelectorAll('.ext-toggle').forEach(t => {
      t.addEventListener('change', async () => {
        haptic(10);
        try {
          await fetch(`/api/extensions/${t.getAttribute('data-id')}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: t.checked })
          });
          showToast(t.checked ? 'Extension Enabled' : 'Extension Disabled');
        } catch (_) {
          showToast('Failed to toggle extension', 'fa-triangle-exclamation');
        }
      });
    });
  }

  function renderRepositories(repositories) {
    if (!DOM.repositoriesList) return;
    if (!repositories.length) {
      DOM.repositoriesList.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text-muted);">No repositories installed yet.</div>';
      return;
    }
    DOM.repositoriesList.innerHTML = repositories.map(r => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-surface-elevated);border-radius:12px;margin-bottom:6px;border:1px solid var(--border-subtle);">
        <div style="display:flex;flex-direction:column;min-width:0;">
          <strong style="font-size:13px;color:var(--text-primary);">${r.name}</strong>
          <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">${r.url}</span>
        </div>
        <button class="remove-repo-btn" data-id="${r.id}" style="background:none;border:none;color:var(--accent-danger);cursor:pointer;padding:6px;font-size:15px;" title="Remove">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');

    DOM.repositoriesList.querySelectorAll('.remove-repo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        haptic(20);
        try {
          await fetch(`/api/repositories/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
          showToast('Repository removed');
          loadExtensionsAndRepos();
        } catch (_) { showToast('Failed to remove repository'); }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupEventListeners() {
    // Search
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      handleSearchInput();
    });

    // Search Filter Pills
    DOM.searchFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        DOM.searchFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        handleSearchInput();
      });
    });

    // Repo filter pills
    document.querySelectorAll('#repo-filter-pills .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#repo-filter-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentRepoFilter = pill.getAttribute('data-repofilter') || 'all';
        fetch('/api/repositories').then(r => r.json()).then(repos => {
          renderCommunityDirectory(communityDirectoryData, currentRepoFilter, repos);
        });
      });
    });

    // Library Tabs
    DOM.libraryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.libraryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLibraryView(tab.getAttribute('data-lib-tab'));
      });
    });

    // Clear History
    DOM.clearHistoryBtn.addEventListener('click', () => {
      AppState.watchHistory = [];
      localStorage.removeItem('cs_history');
      renderContinueWatching();
      updateLibraryCounts();
      showToast('Watch history cleared');
    });

    // Details Modal Close
    DOM.detailsCloseBtn.addEventListener('click', () => {
      haptic(8);
      DOM.detailsModal.style.display = 'none';
    });

    // Backdrop click to close details
    DOM.detailsModal.addEventListener('click', (e) => {
      if (e.target === DOM.detailsModal) DOM.detailsModal.style.display = 'none';
    });

    // Auto-hide player controls
    DOM.playerModal.addEventListener('touchstart', wakeControls, { passive: true });
    DOM.playerModal.addEventListener('mousemove', wakeControls);
    DOM.playerModal.addEventListener('click', wakeControls);

    // Player close
    DOM.playerBackBtn.addEventListener('click', () => {
      haptic(15);
      clearTimeout(controlsTimer);
      DOM.playerModal.classList.remove('controls-hidden');
      DOM.playerModal.style.display = 'none';
      DOM.streamEmbedFrame.src = 'about:blank';
      if (DOM.nativeVideoPlayer) {
        DOM.nativeVideoPlayer.pause();
        DOM.nativeVideoPlayer.src = '';
      }
      if (window.activeHlsInstance) { window.activeHlsInstance.destroy(); window.activeHlsInstance = null; }
      clearSubtitles();
      if (DOM.playerHud) DOM.playerHud.style.display = 'none';
      if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.remove('hidden');
    });

    // Next / Prev Episode
    DOM.nextEpBtn.addEventListener('click', () => {
      if (!AppState.activeMedia || AppState.activeMedia.type !== 'tv') return;
      haptic(12);
      const s = AppState.activeMedia.season || 1;
      const nextEp = (AppState.activeMedia.episode || 1) + 1;
      showToast(`Loading Episode ${nextEp}…`);
      openPlayer(AppState.activeMedia, s, nextEp, AppState.currentEpisodeIndex + 1);
    });

    DOM.prevEpBtn.addEventListener('click', () => {
      if (!AppState.activeMedia || AppState.activeMedia.type !== 'tv') return;
      const curEp = AppState.activeMedia.episode || 1;
      if (curEp <= 1) return;
      haptic(12);
      const s = AppState.activeMedia.season || 1;
      const prevEp = curEp - 1;
      showToast(`Loading Episode ${prevEp}…`);
      openPlayer(AppState.activeMedia, s, prevEp, Math.max(0, AppState.currentEpisodeIndex - 1));
    });

    // Subtitle Drawer
    if (DOM.subtitleSelectorBtn) {
      DOM.subtitleSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        haptic(10);
        renderSubtitleDrawer();
        if (DOM.subDrawerBackdrop) DOM.subDrawerBackdrop.style.display = 'flex';
      });
    }

    if (DOM.subDrawerCloseBtn) {
      DOM.subDrawerCloseBtn.addEventListener('click', () => {
        if (DOM.subDrawerBackdrop) DOM.subDrawerBackdrop.style.display = 'none';
      });
    }

    if (DOM.subDrawerBackdrop) {
      DOM.subDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === DOM.subDrawerBackdrop) DOM.subDrawerBackdrop.style.display = 'none';
      });
    }

    // Server Drawer
    if (DOM.serverSelectorBtn) {
      DOM.serverSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        haptic(10);
        if (DOM.serverDrawerBackdrop) DOM.serverDrawerBackdrop.style.display = 'flex';
      });
    }

    if (DOM.serverDrawerCloseBtn) {
      DOM.serverDrawerCloseBtn.addEventListener('click', () => {
        if (DOM.serverDrawerBackdrop) DOM.serverDrawerBackdrop.style.display = 'none';
      });
    }

    if (DOM.serverDrawerBackdrop) {
      DOM.serverDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === DOM.serverDrawerBackdrop) DOM.serverDrawerBackdrop.style.display = 'none';
      });
    }

    // QR Modal
    DOM.headerQrBtn.addEventListener('click', () => DOM.qrModal.style.display = 'flex');
    DOM.settingsOpenQrBtn.addEventListener('click', () => DOM.qrModal.style.display = 'flex');
    DOM.qrCloseBtn.addEventListener('click', () => DOM.qrModal.style.display = 'none');
    DOM.qrModal.addEventListener('click', (e) => { if (e.target === DOM.qrModal) DOM.qrModal.style.display = 'none'; });

    // Add Repo Modal
    if (DOM.addRepoBtn) {
      DOM.addRepoBtn.addEventListener('click', () => { DOM.addRepoModal.style.display = 'flex'; });
    }
    if (DOM.repoModalCloseBtn) {
      DOM.repoModalCloseBtn.addEventListener('click', () => { DOM.addRepoModal.style.display = 'none'; });
    }
    if (DOM.addRepoModal) {
      DOM.addRepoModal.addEventListener('click', (e) => {
        if (e.target === DOM.addRepoModal) DOM.addRepoModal.style.display = 'none';
      });
    }

    if (DOM.confirmAddRepoBtn) {
      DOM.confirmAddRepoBtn.addEventListener('click', async () => {
        const url = DOM.repoUrlInput.value.trim();
        if (!url) return showToast('Please enter repository URL', 'fa-triangle-exclamation');
        haptic(15);
        DOM.confirmAddRepoBtn.disabled = true;
        DOM.confirmAddRepoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Installing...';
        try {
          const res = await fetch('/api/repositories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const result = await res.json();
          DOM.confirmAddRepoBtn.disabled = false;
          DOM.confirmAddRepoBtn.innerHTML = '<i class="fa-solid fa-download"></i> Install Repository';
          if (result.success) {
            showToast('Repository installed successfully!');
            DOM.addRepoModal.style.display = 'none';
            DOM.repoUrlInput.value = '';
            loadExtensionsAndRepos();
          } else {
            showToast(result.error || 'Failed to install', 'fa-triangle-exclamation');
          }
        } catch (_) {
          DOM.confirmAddRepoBtn.disabled = false;
          DOM.confirmAddRepoBtn.innerHTML = '<i class="fa-solid fa-download"></i> Install Repository';
          showToast('Failed to add repository', 'fa-triangle-exclamation');
        }
      });
    }

    // Copy URL
    DOM.copyUrlBtn.addEventListener('click', () => {
      if (AppState.systemInfo?.accessUrl) {
        navigator.clipboard.writeText(AppState.systemInfo.accessUrl).catch(() => {});
        showToast('Link copied to clipboard!');
      }
    });

    // Native Player HUD buttons
    if (DOM.playerPlayPauseBtn) {
      DOM.playerPlayPauseBtn.addEventListener('click', () => {
        haptic(10);
        const v = DOM.nativeVideoPlayer;
        if (!v) return;
        if (v.paused) v.play().catch(() => {}); else v.pause();
      });
    }

    if (DOM.playerPipBtn) {
      DOM.playerPipBtn.addEventListener('click', async () => {
        haptic(10);
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (DOM.nativeVideoPlayer?.requestPictureInPicture) {
            await DOM.nativeVideoPlayer.requestPictureInPicture();
          }
        } catch (_) { showToast('PiP not available'); }
      });
    }

    if (DOM.playerFullscreenBtn) {
      DOM.playerFullscreenBtn.addEventListener('click', () => {
        haptic(10);
        if (!document.fullscreenElement) {
          DOM.playerModal.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Settings
    if (DOM.prefServerSelect) {
      DOM.prefServerSelect.value = AppState.settings.preferredServer;
      DOM.prefServerSelect.addEventListener('change', (e) => {
        AppState.settings.preferredServer = e.target.value;
        localStorage.setItem('cs_pref_server', e.target.value);
        showToast('Preferred server saved');
      });
    }

    if (DOM.prefSubtitleSelect) {
      DOM.prefSubtitleSelect.value = AppState.settings.preferredSubtitle;
      DOM.prefSubtitleSelect.addEventListener('change', (e) => {
        AppState.settings.preferredSubtitle = e.target.value;
        localStorage.setItem('cs_pref_sub', e.target.value);
        showToast('Subtitle preference updated');
      });
    }

    if (DOM.prefAutoplayToggle) {
      DOM.prefAutoplayToggle.checked = AppState.settings.autoPlayNext;
      DOM.prefAutoplayToggle.addEventListener('change', (e) => {
        AppState.settings.autoPlayNext = e.target.checked;
        localStorage.setItem('cs_pref_autoplay', e.target.checked);
      });
    }

    if (DOM.prefSubtitlesAutoToggle) {
      DOM.prefSubtitlesAutoToggle.checked = AppState.settings.autoSubtitles;
      DOM.prefSubtitlesAutoToggle.addEventListener('change', (e) => {
        AppState.settings.autoSubtitles = e.target.checked;
        localStorage.setItem('cs_pref_auto_subs', e.target.checked);
      });
    }

    // Gesture setup
    setupPlayerGestures();
    setupProgressBarSeek();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
