/**
 * ============================================================================
 * CLOUDSTREAM FOR iOS — CORE CLIENT APPLICATION ENGINE
 * ============================================================================
 */

(function () {
  'use strict';

  // 🛡️ CloudStream Anti-Ad & Anti-Popup Iron Shield (Blocks 100% of on-click ad popups, redirects & new tabs)
  try {
    const neutralOpen = function (url) {
      console.warn('🛡️ CloudStream Shield: Blocked ad popup / new tab:', url);
      return null;
    };
    Object.defineProperty(window, 'open', {
      value: neutralOpen,
      writable: false,
      configurable: false
    });
    if (window.top && window.top !== window) {
      try { window.top.open = neutralOpen; } catch (e) {}
    }
  } catch (e) {}

  // Intercept any rogue ad links attempting to open in new tab
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a');
    if (target && target.target === '_blank' && !target.classList.contains('allow-open')) {
      e.preventDefault();
      e.stopPropagation();
      console.warn('🛡️ CloudStream Shield: Suppressed _blank link navigation:', target.href);
    }
  }, true);

  // Suppress auxiliary click (middle click ad triggers)
  window.addEventListener('auxclick', (e) => {
    if (e.button === 1) e.preventDefault();
  }, true);

  // 🔒 Focus Lock & Popup Re-closer: If player is open and window blurs (popup attempted), instantly refocus
  window.addEventListener('blur', () => {
    const playerModal = document.getElementById('player-modal');
    if (playerModal && playerModal.style.display === 'flex') {
      setTimeout(() => {
        window.focus();
      }, 50);
    }
  });

  // 🔒 Top-Navigation Guardian: Prevent untrusted iframes from hijacking or redirecting the parent app page
  window.addEventListener('beforeunload', (e) => {
    const playerModal = document.getElementById('player-modal');
    if (playerModal && playerModal.style.display === 'flex') {
      // If player is active, do not allow ad scripts to redirect parent window
      e.preventDefault();
      return (e.returnValue = '');
    }
  });

  // State
  const AppState = {
    currentTab: 'tab-home',
    heroItems: [],
    currentHeroIndex: 0,
    heroTimer: null,
    activeMedia: null,
    activeSeasonEpisodes: [],
    currentServer: 'server-vidsrc-pro',
    currentSourceList: [],
    currentEpisodeIndex: 0,
    watchlist: JSON.parse(localStorage.getItem('cs_watchlist') || '[]'),
    watchHistory: JSON.parse(localStorage.getItem('cs_history') || '[]'),
    settings: {
      preferredServer: localStorage.getItem('cs_pref_server') || 'server-vidsrc-pro',
      preferredSubtitle: localStorage.getItem('cs_pref_sub') || 'en',
      autoPlayNext: localStorage.getItem('cs_pref_autoplay') !== 'false'
    },
    systemInfo: null
  };

  // DOM Elements
  const DOM = {
    tabButtons: document.querySelectorAll('.tab-item'),
    tabPages: document.querySelectorAll('.tab-page'),
    headerSearchBtn: document.getElementById('header-search-btn'),
    headerQrBtn: document.getElementById('header-qr-btn'),
    brandLogoBtn: document.getElementById('brand-logo-btn'),

    // Hero
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

    // Shelves
    dynamicShelvesContainer: document.getElementById('dynamic-shelves-container'),
    continueWatchingShelf: document.getElementById('continue-watching-shelf'),
    continueWatchingRow: document.getElementById('continue-watching-row'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),

    // Search
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    searchFilterPills: document.querySelectorAll('.filter-pill'),
    searchResultsGrid: document.getElementById('search-results-grid'),

    // Library
    libraryTabs: document.querySelectorAll('.lib-tab-btn'),
    libraryGrid: document.getElementById('library-grid'),
    watchlistCount: document.getElementById('watchlist-count'),
    historyCount: document.getElementById('history-count'),

    // Settings & Extensions
    settingsOpenQrBtn: document.getElementById('settings-open-qr-btn'),
    prefServerSelect: document.getElementById('pref-server-select'),
    prefSubtitleSelect: document.getElementById('pref-subtitle-select'),
    prefAutoplayToggle: document.getElementById('pref-autoplay'),
    extensionList: document.getElementById('extension-list'),
    repositoriesList: document.getElementById('repositories-list'),
    addRepoBtn: document.getElementById('add-repo-btn'),
    addRepoModal: document.getElementById('add-repo-modal'),
    repoModalCloseBtn: document.getElementById('repo-modal-close-btn'),
    repoUrlInput: document.getElementById('repo-url-input'),
    confirmAddRepoBtn: document.getElementById('confirm-add-repo-btn'),

    // Details Modal
    detailsModal: document.getElementById('details-modal'),
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

    // Player Modal & Server Drawer
    playerModal: document.getElementById('player-modal'),
    playerBackBtn: document.getElementById('player-back-btn'),
    playerMainTitle: document.getElementById('player-main-title'),
    playerSubTitle: document.getElementById('player-sub-title'),
    serverSelectorBtn: document.getElementById('server-selector-btn'),
    currentServerLabel: document.getElementById('current-server-label'),
    serverDrawerBackdrop: document.getElementById('server-drawer-backdrop'),
    serverDrawerList: document.getElementById('server-drawer-list'),
    serverDrawerCloseBtn: document.getElementById('server-drawer-close-btn'),
    nativeVideoPlayer: document.getElementById('native-video-player'),
    streamEmbedFrame: document.getElementById('stream-embed-frame'),
    playerLoadingOverlay: document.getElementById('player-loading-overlay'),
    playerBackdropImg: document.getElementById('player-backdrop-img'),
    prevEpBtn: document.getElementById('prev-ep-btn'),
    nextEpBtn: document.getElementById('next-ep-btn'),
    pipBtn: document.getElementById('pip-btn'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),

    // QR Modal
    qrModal: document.getElementById('qr-modal'),
    qrCloseBtn: document.getElementById('qr-close-btn'),
    qrCodeImg: document.getElementById('qr-code-img'),
    qrNetworkUrl: document.getElementById('qr-network-url'),
    copyUrlBtn: document.getElementById('copy-url-btn'),

    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message')
  };

  // Toast Helper
  function showToast(msg, icon = 'fa-circle-check') {
    if (!DOM.toast) return;
    DOM.toastMessage.textContent = msg;
    const iconEl = DOM.toast.querySelector('.toast-icon');
    if (iconEl) iconEl.className = `toast-icon fa-solid ${icon}`;
    DOM.toast.style.display = 'flex';
    setTimeout(() => {
      DOM.toast.style.display = 'none';
    }, 3000);
  }

  // Init App
  async function init() {
    setupTabNavigation();
    setupEventListeners();
    loadSystemInfo();
    renderContinueWatching();
    updateLibraryCounts();
    loadExtensionsAndRepos();
    await loadHomeCatalog();
    registerServiceWorker();
  }

  // Service Worker for PWA
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW registration skipped:', err);
      });
    }
  }

  // Tab Navigation
  function setupTabNavigation() {
    DOM.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    DOM.brandLogoBtn.addEventListener('click', () => switchTab('tab-home'));
    DOM.headerSearchBtn.addEventListener('click', () => {
      switchTab('tab-search');
      setTimeout(() => DOM.searchInput.focus(), 100);
    });
  }

  function switchTab(tabId) {
    AppState.currentTab = tabId;
    DOM.tabButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    DOM.tabPages.forEach(page => {
      page.classList.toggle('active', page.id === tabId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'tab-library') {
      renderLibraryView('watchlist');
    }
  }

  // Load System & Network Info
  async function loadSystemInfo() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      AppState.systemInfo = data;
      if (DOM.qrNetworkUrl) {
        DOM.qrNetworkUrl.textContent = data.accessUrl;
      }
      if (DOM.qrCodeImg) {
        DOM.qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.accessUrl)}`;
      }
    } catch (e) {
      console.warn('System info load failed:', e);
    }
  }

  // Load Home Catalog
  async function loadHomeCatalog() {
    try {
      const res = await fetch('/api/home');
      const catalog = await res.json();

      // Render Hero
      if (catalog.hero && catalog.hero.length > 0) {
        AppState.heroItems = catalog.hero;
        renderHero(0);
        startHeroTimer();
      }

      // Render Sections
      renderShelves(catalog.sections || []);
    } catch (err) {
      console.error('Failed to load home catalog:', err);
      DOM.dynamicShelvesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation empty-icon"></i>
          <h3>Failed to load catalog</h3>
          <p>Please check your connection and reload.</p>
          <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">Reload</button>
        </div>
      `;
    }
  }

  // Hero Renderer
  function renderHero(index) {
    if (!AppState.heroItems.length) return;
    const item = AppState.heroItems[index];
    AppState.currentHeroIndex = index;

    DOM.heroBackdrop.style.backgroundImage = `url(${item.backdrop || item.poster})`;
    DOM.heroPillType.textContent = item.type === 'tv' ? 'SERIES' : 'MOVIE';
    DOM.heroRating.innerHTML = `<i class="fa-solid fa-star"></i> ${item.rating || '8.5'}`;
    DOM.heroYear.textContent = item.year || '2026';
    DOM.heroTitle.textContent = item.title;
    DOM.heroOverview.textContent = item.overview || 'Enjoy streaming in high definition.';

    // Bookmark status
    const isSaved = AppState.watchlist.some(w => w.id === item.id);
    DOM.heroBookmarkBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';

    // Dots
    DOM.heroDots.innerHTML = AppState.heroItems.map((_, i) => `
      <div class="hero-dot ${i === index ? 'active' : ''}" data-index="${i}"></div>
    `).join('');

    DOM.heroDots.querySelectorAll('.hero-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        clearInterval(AppState.heroTimer);
        renderHero(parseInt(dot.getAttribute('data-index')));
        startHeroTimer();
      });
    });

    // Hero Action Buttons
    DOM.heroPlayBtn.onclick = () => openPlayer(item);
    DOM.heroDetailsBtn.onclick = () => openDetailsModal(item.type, item.id);
    DOM.heroBookmarkBtn.onclick = () => toggleBookmark(item, DOM.heroBookmarkBtn);
  }

  function startHeroTimer() {
    clearInterval(AppState.heroTimer);
    AppState.heroTimer = setInterval(() => {
      const nextIndex = (AppState.currentHeroIndex + 1) % AppState.heroItems.length;
      renderHero(nextIndex);
    }, 6000);
  }

  // Shelves Renderer
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

    // Attach card click handlers
    DOM.dynamicShelvesContainer.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-type');
        const id = card.getAttribute('data-id');
        openDetailsModal(type, id);
      });
    });
  }

  function renderMediaCardHtml(item) {
    const poster = item.poster || '/icons/placeholder.png';
    const rating = item.rating ? `<span class="card-rating-badge"><i class="fa-solid fa-star"></i> ${item.rating}</span>` : '';
    const type = item.type ? `<span class="card-type-badge">${item.type}</span>` : '';

    return `
      <div class="media-card" data-id="${item.id}" data-type="${item.type || 'movie'}">
        <div class="poster-box">
          <img src="${poster}" alt="${item.title}" class="poster-img" loading="lazy">
          ${rating}
          ${type}
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

  // Continue Watching Renderer
  function renderContinueWatching() {
    if (!AppState.watchHistory.length) {
      DOM.continueWatchingShelf.style.display = 'none';
      return;
    }

    DOM.continueWatchingShelf.style.display = 'block';
    DOM.continueWatchingRow.innerHTML = AppState.watchHistory.map(item => {
      const thumb = item.backdrop || item.still || item.poster || '';
      const sub = item.type === 'tv' ? `S${item.season} E${item.episode} • ${item.episodeName || ''}` : `${item.year || ''}`;
      const progressPercent = Math.min(100, Math.max(10, item.progress || 35));

      return `
        <div class="media-card resume-card" data-id="${item.id}" data-type="${item.type}">
          <div class="resume-thumb-box">
            <img src="${thumb}" alt="${item.title}" loading="lazy">
            <div class="play-overlay-icon"><i class="fa-solid fa-play"></i></div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
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
        const historyItem = AppState.watchHistory[idx];
        openPlayer(historyItem, historyItem.season || 1, historyItem.episode || 1);
      });
    });
  }

  // Open Media Details Modal
  async function openDetailsModal(type, id) {
    try {
      DOM.detailsModal.style.display = 'flex';
      DOM.detailsTitle.textContent = 'Loading...';
      DOM.detailsSynopsis.textContent = 'Fetching details from CloudStream engine...';
      DOM.detailsBadges.innerHTML = '';
      DOM.detailsGenres.innerHTML = '';
      DOM.detailsCastRow.innerHTML = '';
      DOM.detailsSimilarRow.innerHTML = '';
      DOM.tvEpisodesSection.style.display = 'none';

      const res = await fetch(`/api/details?type=${type}&id=${id}`);
      const data = await res.json();
      AppState.activeMedia = data;

      DOM.detailsBackdrop.style.backgroundImage = `url(${data.backdrop || data.poster})`;
      DOM.detailsPoster.src = data.poster || '';
      DOM.detailsTitle.textContent = data.title;
      DOM.detailsSynopsis.textContent = data.overview || 'No synopsis available.';

      // Badges
      DOM.detailsBadges.innerHTML = `
        <span class="hero-pill-badge">${data.type === 'tv' ? 'TV SERIES' : 'MOVIE'}</span>
        ${data.rating ? `<span class="hero-rating"><i class="fa-solid fa-star"></i> ${data.rating}</span>` : ''}
        <span class="hero-year">${data.year || ''}</span>
        ${data.runtime ? `<span class="hero-quality">${data.runtime} min</span>` : ''}
        <span class="hero-quality">1080p</span>
      `;

      // Genres
      DOM.detailsGenres.innerHTML = (data.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('');

      // Bookmark Button Status
      const isSaved = AppState.watchlist.some(w => w.id === data.id);
      DOM.detailsFavBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
      DOM.detailsFavBtn.onclick = () => toggleBookmark(data, DOM.detailsFavBtn);

      // Play Button
      DOM.detailsPlayBtn.onclick = () => {
        DOM.detailsModal.style.display = 'none';
        openPlayer(data, 1, 1);
      };

      // If TV, setup seasons & episodes
      if (data.type === 'tv' && data.seasons && data.seasons.length > 0) {
        DOM.tvEpisodesSection.style.display = 'block';
        DOM.seasonSelector.innerHTML = data.seasons.map(s => `
          <option value="${s.seasonNumber}">${s.name} (${s.episodeCount} eps)</option>
        `).join('');

        DOM.seasonSelector.onchange = () => loadSeasonEpisodes(data.id, DOM.seasonSelector.value);
        await loadSeasonEpisodes(data.id, data.seasons[0].seasonNumber);
      }

      // Cast
      if (data.cast && data.cast.length > 0) {
        DOM.detailsCastRow.innerHTML = data.cast.map(c => `
          <div class="cast-card">
            <img src="${c.profile || '/icons/avatar.png'}" alt="${c.name}" class="cast-avatar" loading="lazy">
            <div class="cast-name">${c.name}</div>
          </div>
        `).join('');
      }

      // Similar
      if (data.similar && data.similar.length > 0) {
        DOM.detailsSimilarRow.innerHTML = data.similar.map(item => renderMediaCardHtml(item)).join('');
        DOM.detailsSimilarRow.querySelectorAll('.media-card').forEach(card => {
          card.addEventListener('click', () => {
            const t = card.getAttribute('data-type');
            const i = card.getAttribute('data-id');
            openDetailsModal(t, i);
          });
        });
      }

    } catch (err) {
      console.error('Failed to load media details:', err);
      showToast('Failed to load details', 'fa-triangle-exclamation');
    }
  }

  // Load Season Episodes
  async function loadSeasonEpisodes(tvId, seasonNumber) {
    try {
      DOM.episodesList.innerHTML = '<div style="padding: 10px; color: var(--text-muted);">Loading episodes...</div>';
      const res = await fetch(`/api/season?id=${tvId}&season=${seasonNumber}`);
      const data = await res.json();
      AppState.activeSeasonEpisodes = data.episodes || [];

      DOM.episodesList.innerHTML = AppState.activeSeasonEpisodes.map((ep, idx) => `
        <div class="episode-item" data-index="${idx}">
          <div class="episode-thumb-box">
            <img src="${ep.still || AppState.activeMedia.backdrop || AppState.activeMedia.poster || ''}" alt="${ep.name}" loading="lazy">
            <div class="play-overlay-icon"><i class="fa-solid fa-play"></i></div>
          </div>
          <div class="episode-info">
            <div class="episode-number-title">${ep.episodeNumber}. ${ep.name}</div>
            <div class="episode-desc">${ep.overview || 'Episode ' + ep.episodeNumber}</div>
          </div>
        </div>
      `).join('');

      DOM.episodesList.querySelectorAll('.episode-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.getAttribute('data-index'));
          const ep = AppState.activeSeasonEpisodes[idx];
          DOM.detailsModal.style.display = 'none';
          openPlayer(AppState.activeMedia, seasonNumber, ep.episodeNumber, idx);
        });
      });
    } catch (err) {
      console.error('Failed to load episodes:', err);
    }
  }

  // Open Fullscreen Video Player
  async function openPlayer(media, season = 1, episode = 1, epIndex = 0) {
    AppState.activeMedia = media;
    AppState.currentEpisodeIndex = epIndex;
    DOM.playerModal.style.display = 'flex';
    DOM.playerMainTitle.textContent = media.title;

    const isTv = media.type === 'tv';
    DOM.playerSubTitle.textContent = isTv ? `Season ${season} • Episode ${episode}` : (media.year || 'Movie');

    DOM.prevEpBtn.style.display = isTv && epIndex > 0 ? 'inline-flex' : 'none';
    DOM.nextEpBtn.style.display = isTv ? 'inline-flex' : 'none';

    // Set Media Session API for iOS Lock Screen & Dynamic Island
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: media.title,
        artist: isTv ? `Season ${season} Episode ${episode}` : 'CloudStream iOS',
        album: 'CloudStream',
        artwork: [
          { src: media.poster || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }

    // Save to Watch History
    saveToHistory(media, season, episode);

    // Show backdrop in player loading overlay (movie art instead of spinner)
    if (DOM.playerLoadingOverlay && DOM.playerBackdropImg) {
      DOM.playerBackdropImg.src = media.backdrop || media.poster || '';
      DOM.playerLoadingOverlay.classList.remove('hidden');
    }

    // Wire iframe onload to hide overlay (fires when embed site finishes loading)
    if (DOM.streamEmbedFrame) {
      DOM.streamEmbedFrame.onload = () => {
        if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      };
    }

    // Fetch Stream Sources
    await loadStreamSources(media, season, episode);
  }

  // ─── Load Stream Sources — Android RepoLinkGenerator Architecture ─────────────
  // Mirrors: generateLinks(callback = { link -> modifyState { add(link) } })
  // First source fires in <5ms → iframe loads IMMEDIATELY, no spinner
  // Subsequent sources populate server dropdown in background
  // 20-min cache: replays are INSTANT with zero network calls
  async function loadStreamSources(media, season, episode) {
    const params = new URLSearchParams({
      type: media.type || 'movie',
      id: media.id,
      tmdbId: media.tmdbId || media.id,
      season: season || 1,
      episode: episode || 1,
      sub: AppState.settings.preferredSubtitle || 'en'
    });

    DOM.currentServerLabel.textContent = 'Loading...';
    AppState.currentSourceList = [];
    if (DOM.serverDrawerList) DOM.serverDrawerList.innerHTML = '';

    let firstSourceLoaded = false;

    // Close any previous source stream
    if (window.activeSourceSSE) {
      window.activeSourceSSE.close();
      window.activeSourceSSE = null;
    }

    const sse = new EventSource(`/api/sources/stream?${params.toString()}`);
    window.activeSourceSSE = sse;

    sse.onmessage = (event) => {
      try {
        const source = JSON.parse(event.data);

        if (source.__done__) {
          sse.close();
          window.activeSourceSSE = null;
          return;
        }

        AppState.currentSourceList.push(source);

        // Add to iOS Server Drawer List
        if (DOM.serverDrawerList) {
          const item = document.createElement('div');
          const isActive = source.id === AppState.currentServer || (!firstSourceLoaded && AppState.currentSourceList.length === 1);
          item.className = `server-drawer-item ${isActive ? 'active' : ''}`;
          item.setAttribute('data-server-id', source.id);
          item.innerHTML = `
            <div class="server-item-left">
              <span class="server-item-name">${source.name}</span>
              <span class="server-item-desc">High-speed streaming mirror</span>
            </div>
            <div class="server-item-right">
              <span class="server-quality-pill">${source.quality || '1080p'}</span>
              <div class="server-active-check" style="${isActive ? '' : 'display:none;'}">
                <i class="fa-solid fa-check"></i>
              </div>
            </div>
          `;
          item.addEventListener('click', () => {
            switchServer(source.id);
            if (DOM.serverDrawerBackdrop) DOM.serverDrawerBackdrop.style.display = 'none';
          });
          DOM.serverDrawerList.appendChild(item);
        }

        // FIRST source → load player IMMEDIATELY, no waiting
        // Mirrors: callback fires → modifyState { add(link) } → player picks first link
        if (!firstSourceLoaded) {
          firstSourceLoaded = true;
          AppState.currentServer = source.id;
          DOM.currentServerLabel.textContent = source.name.split(' (')[0];
          switchServer(source.id);
        }

      } catch (e) {
        console.warn('Source SSE parse error:', e);
      }
    };

    sse.onerror = () => {
      sse.close();
      window.activeSourceSSE = null;
      if (!firstSourceLoaded && AppState.currentSourceList.length === 0) {
        DOM.currentServerLabel.textContent = 'Server 1';
        showToast('Could not load servers', 'fa-triangle-exclamation');
      }
    };
  }

  // Switch Stream Server
  function switchServer(serverId) {
    AppState.currentServer = serverId;
    const source = AppState.currentSourceList.find(s => s.id === serverId);
    if (!source) return;

    DOM.currentServerLabel.textContent = source.name.split(' (')[0];
    
    // Update active highlight & checkmark in iOS Server Drawer
    if (DOM.serverDrawerList) {
      DOM.serverDrawerList.querySelectorAll('.server-drawer-item').forEach(el => {
        const isCur = el.getAttribute('data-server-id') === serverId;
        el.classList.toggle('active', isCur);
        const check = el.querySelector('.server-active-check');
        if (check) check.style.display = isCur ? 'flex' : 'none';
      });
    }

    const isDirectHls = source.type === 'direct' && source.url && (source.url.includes('.m3u8') || source.url.includes('.mp4'));
    const isEmbed = source.type === 'embed';

    if (isDirectHls) {
      // ── DIRECT MODE (Android ExoPlayer equivalent) ──────────────────────────
      // Play raw .m3u8 in native <video> with HLS.js — INSTANT, zero spinner, hardware decoded
      // Hide overlay immediately — no external site loading, plays instantly
      if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      DOM.streamEmbedFrame.style.display = 'none';
      DOM.streamEmbedFrame.src = 'about:blank';
      DOM.nativeVideoPlayer.style.display = 'block';

      if (window.activeHlsInstance) {
        window.activeHlsInstance.destroy();
        window.activeHlsInstance = null;
      }

      if (window.Hls && Hls.isSupported() && source.url.includes('.m3u8')) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          xhrSetup: (xhr) => {
            // Attach referer headers if provided (mirrors Android OkHttp referer handling)
            if (source.headers?.Referer) {
              xhr.setRequestHeader('Referer', source.headers.Referer);
            }
          }
        });
        window.activeHlsInstance = hls;

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn(`[HLS] Fatal error on ${source.name}, trying next server...`);
            hls.destroy();
            window.activeHlsInstance = null;
            // Auto-failover: skip to next source (mirrors Android "hasNextMirror")
            const currentIdx = AppState.currentSourceList.findIndex(s => s.id === serverId);
            const nextSource = AppState.currentSourceList[currentIdx + 1];
            if (nextSource) switchServer(nextSource.id);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          DOM.nativeVideoPlayer.play().catch(() => {});
        });

        hls.loadSource(source.url);
        hls.attachMedia(DOM.nativeVideoPlayer);

      } else if (source.url.includes('.mp4') || DOM.nativeVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS (iOS) or MP4
        DOM.nativeVideoPlayer.src = source.url;
        DOM.nativeVideoPlayer.play().catch(() => {});
      }

    } else {
      // ── EMBED MODE (fallback) ────────────────────────────────────────────────
      // Used when direct extraction wasn't possible
      DOM.nativeVideoPlayer.style.display = 'none';
      DOM.nativeVideoPlayer.pause();
      if (window.activeHlsInstance) { window.activeHlsInstance.destroy(); window.activeHlsInstance = null; }
      
      // Show loading overlay briefly while iframe renders
      if (DOM.playerLoadingOverlay) {
        DOM.playerLoadingOverlay.classList.remove('hidden');
      }

      DOM.streamEmbedFrame.src = source.url;
      DOM.streamEmbedFrame.style.display = 'block';

      // Fallback timer: ensure overlay always clears within 1.5s max even if iframe load event is suppressed
      clearTimeout(window._overlayTimer);
      window._overlayTimer = setTimeout(() => {
        if (DOM.playerLoadingOverlay) DOM.playerLoadingOverlay.classList.add('hidden');
      }, 1500);
    }
  }

  // Save to Watch History
  function saveToHistory(media, season = 1, episode = 1) {
    const item = {
      id: media.id,
      tmdbId: media.tmdbId || media.id,
      type: media.type || 'movie',
      title: media.title,
      poster: media.poster,
      backdrop: media.backdrop,
      year: media.year,
      season,
      episode,
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

  // Bookmark / Watchlist Management
  function toggleBookmark(item, btnEl) {
    const exists = AppState.watchlist.some(w => w.id === item.id);
    if (exists) {
      AppState.watchlist = AppState.watchlist.filter(w => w.id !== item.id);
      if (btnEl) btnEl.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
      showToast('Removed from Watchlist');
    } else {
      AppState.watchlist.unshift({
        id: item.id,
        type: item.type || 'movie',
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        rating: item.rating,
        year: item.year
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
        <div class="empty-state">
          <i class="fa-regular fa-bookmark empty-icon"></i>
          <h3>No ${tabType === 'watchlist' ? 'Bookmarks' : 'Watch History'} Yet</h3>
          <p>Explore trending movies and series to add them here.</p>
        </div>
      `;
      return;
    }

    DOM.libraryGrid.innerHTML = items.map(item => renderMediaCardHtml(item)).join('');
    DOM.libraryGrid.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-type');
        const id = card.getAttribute('data-id');
        openDetailsModal(type, id);
      });
    });
  }

  // ─── Search Logic — Android SearchViewModel Architecture ──────────────────────
  // Mirrors: searchAndCancel() → cancel previous Job → amap parallel providers → 
  //          _currentSearch.postValue() per provider as each resolves
  let searchTimeout = null;
  let activeSearchSSE = null; // Like Android's onGoingSearch Job — cancelled on new search

  function handleSearchInput() {
    const query = DOM.searchInput.value.trim();
    DOM.clearSearchBtn.style.display = query.length ? 'block' : 'none';

    // Cancel previous search immediately — mirrors: onGoingSearch?.cancel()
    clearTimeout(searchTimeout);
    if (activeSearchSSE) {
      activeSearchSSE.close();
      activeSearchSSE = null;
    }

    if (!query) {
      DOM.searchResultsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-film empty-icon"></i>
          <h3>Discover Unlimited Content</h3>
          <p>Search for your favorite movies, series, or anime above.</p>
        </div>
      `;
      return;
    }

    // Instant skeleton — appears BEFORE any network call (matches Android's Loading() state)
    DOM.searchResultsGrid.innerHTML = `
      <div class="search-skeleton-group">
        <div class="search-skeleton-title"></div>
        <div class="search-skeleton-row">
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
        </div>
      </div>
      <div class="search-skeleton-group">
        <div class="search-skeleton-title"></div>
        <div class="search-skeleton-row">
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
        </div>
      </div>
      <div class="search-skeleton-group">
        <div class="search-skeleton-title"></div>
        <div class="search-skeleton-row">
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
          <div class="search-skeleton-card"></div>
        </div>
      </div>
    `;

    // 300ms debounce (matches Android SearchViewModel fetchSuggestions debounce)
    searchTimeout = setTimeout(() => {
      startStreamingSearch(query);
    }, 300);
  }

  // ─── SSE Streaming Search ─────────────────────────────────────────────────────
  // Mirrors Android: repos.amap { a -> val search = a.search(query); _currentSearch.postValue(expandableSearches) }
  // Each provider fires its data the instant it resolves — not waiting for all
  function startStreamingSearch(query) {
    // Cancel any existing stream
    if (activeSearchSSE) { activeSearchSSE.close(); activeSearchSSE = null; }

    let hasFirstResult = false;
    const receivedProviders = [];

    const sse = new EventSource(`/api/search/stream?q=${encodeURIComponent(query)}`);
    activeSearchSSE = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Done signal
        if (data.__done__) {
          sse.close();
          activeSearchSSE = null;
          if (receivedProviders.length === 0) {
            DOM.searchResultsGrid.innerHTML = `
              <div class="empty-state">
                <i class="fa-solid fa-face-meh empty-icon"></i>
                <h3>No Results Found</h3>
                <p>Try searching for a different keyword or title.</p>
              </div>
            `;
          }
          return;
        }

        receivedProviders.push(data);

        // Clear skeleton on FIRST result — mirrors Android instantly showing first provider
        if (!hasFirstResult) {
          hasFirstResult = true;
          DOM.searchResultsGrid.innerHTML = '';
        }

        // Append this provider's row — no full re-render, just add to bottom
        appendProviderRow(data);

      } catch (e) {
        console.warn('SSE parse error:', e);
      }
    };

    sse.onerror = () => {
      sse.close();
      activeSearchSSE = null;
    };
  }

  function appendProviderRow(grp) {
    const group = document.createElement('div');
    group.className = 'search-provider-group';
    group.setAttribute('data-provider', grp.providerId);
    group.innerHTML = `
      <div class="provider-header-row">
        <h3 class="provider-header-title">${grp.providerName}</h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="provider-badge">${grp.items.length} titles</span>
          <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 11px;"></i>
        </div>
      </div>
      <div class="provider-cards-row">
        ${grp.items.map(item => renderMediaCardHtml(item)).join('')}
      </div>
    `;

    // Slide-in animation — each provider row animates in as it arrives
    group.style.opacity = '0';
    group.style.transform = 'translateY(12px)';
    DOM.searchResultsGrid.appendChild(group);
    requestAnimationFrame(() => {
      group.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      group.style.opacity = '1';
      group.style.transform = 'translateY(0)';
    });

    // Wire click handlers on this group
    group.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-type');
        const id = card.getAttribute('data-id');
        openDetailsModal(type, id);
      });
    });
  }

  // Load Extensions, Installed Repositories, and Community Directory
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
    } catch (e) {
      console.warn('Failed to load extensions/community repos:', e);
    }
  }

  function renderCommunityDirectory(directory, filter = 'all', installedRepos = []) {
    const container = document.getElementById('community-repos-list');
    if (!container) return;

    const filtered = directory.filter(item => {
      if (filter === 'all') return true;
      if (filter === 'Hindi') return item.category.includes('Hindi') || item.category.includes('Desi') || item.language.includes('Hindi');
      if (filter === 'OTT') return item.category.includes('OTT') || item.name.includes('Netflix');
      if (filter === 'Anime') return item.category.includes('Anime') || item.category.includes('Asian');
      if (filter === 'Sports') return item.category.includes('Sports') || item.category.includes('Live TV') || item.category.includes('IPTV');
      if (filter === 'Arabic') return item.language.includes('Arabic');
      if (filter === 'European') return item.language.includes('Italian') || item.language.includes('French') || item.language.includes('German');
      return true;
    });

    container.innerHTML = filtered.map(repo => {
      const isInstalled = installedRepos.some(r => r.url === repo.url || r.id === repo.id);
      return `
        <div style="padding: 10px 12px; background: var(--bg-surface-elevated); border-radius: 12px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
              <strong style="font-size: 13px; color: var(--text-primary);">${repo.name}</strong>
              <span class="ios-badge" style="font-size: 9px;">${repo.category}</span>
              ${repo.shortcode ? `<code style="font-size: 10px; color: var(--accent-gold); background: rgba(255,177,66,0.15); padding: 1px 4px; border-radius: 4px;">${repo.shortcode}</code>` : ''}
            </div>
            <p style="font-size: 11px; color: var(--text-secondary); line-height: 1.35; margin-bottom: 2px;">${repo.description}</p>
            <span style="font-size: 10px; color: var(--accent-cyan);">${repo.pluginsCount ? repo.pluginsCount + '+ Plugins' : 'Verified Repository'}</span>
          </div>
          <div>
            ${isInstalled ? `
              <button class="btn btn-glass" style="padding: 6px 12px; font-size: 11px; opacity: 0.7; pointer-events: none;">
                <i class="fa-solid fa-check" style="color: var(--accent-success);"></i> Installed
              </button>
            ` : `
              <button class="btn btn-primary install-community-repo-btn" data-url="${repo.url}" data-name="${repo.name}" style="padding: 6px 14px; font-size: 11px;">
                <i class="fa-solid fa-download"></i> Install
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.install-community-repo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
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
          }
        } catch (err) {
          showToast('Failed to install repository', 'fa-triangle-exclamation');
        }
      });
    });
  }

  function renderExtensions(extensions) {
    if (!DOM.extensionList) return;
    DOM.extensionList.innerHTML = extensions.map(ext => `
      <div class="setting-item" style="padding: 10px 0;">
        <div class="setting-info" style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="setting-label">${ext.name}</span>
            <span class="ios-badge" style="font-size: 9px;">${ext.type}</span>
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
        const extId = t.getAttribute('data-id');
        try {
          await fetch(`/api/extensions/${extId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: t.checked })
          });
          showToast(t.checked ? 'Extension Enabled' : 'Extension Disabled');
        } catch (err) {
          showToast('Failed to toggle extension', 'fa-triangle-exclamation');
        }
      });
    });
  }

  function renderRepositories(repositories) {
    if (!DOM.repositoriesList) return;
    DOM.repositoriesList.innerHTML = repositories.map(r => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface-elevated); border-radius: 10px; margin-bottom: 6px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; flex-direction: column;">
          <strong style="font-size: 13px; color: var(--text-primary);">${r.name}</strong>
          <span style="font-size: 11px; color: var(--text-muted); word-break: break-all;">${r.url}</span>
        </div>
        <button class="remove-repo-btn" data-id="${r.id}" style="background: none; border: none; color: var(--accent-danger); cursor: pointer; padding: 6px;" title="Remove Repository">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');

    DOM.repositoriesList.querySelectorAll('.remove-repo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const repoId = btn.getAttribute('data-id');
        try {
          await fetch(`/api/repositories/${repoId}`, { method: 'DELETE' });
          showToast('Repository removed');
          loadExtensionsAndRepos();
        } catch (err) {
          showToast('Failed to remove repository');
        }
      });
    });
  }

  // Setup Event Listeners
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

    // Repo Filter Pills
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
      DOM.detailsModal.style.display = 'none';
    });

    // Auto-hide Player Controls during playback
    let controlsTimer = null;
    const wakeControls = () => {
      DOM.playerModal.classList.remove('controls-hidden');
      clearTimeout(controlsTimer);
      controlsTimer = setTimeout(() => {
        if (DOM.serverDropdownMenu.style.display !== 'block') {
          DOM.playerModal.classList.add('controls-hidden');
        }
      }, 3500);
    };

    DOM.playerModal.addEventListener('mousemove', wakeControls);
    DOM.playerModal.addEventListener('touchstart', wakeControls);
    DOM.playerModal.addEventListener('click', wakeControls);

    // Player Modal Close
    DOM.playerBackBtn.addEventListener('click', () => {
      clearTimeout(controlsTimer);
      DOM.playerModal.classList.remove('controls-hidden');
      DOM.playerModal.style.display = 'none';
      DOM.streamEmbedFrame.src = 'about:blank';
      if (DOM.nativeVideoPlayer) {
        DOM.nativeVideoPlayer.pause();
        DOM.nativeVideoPlayer.src = '';
      }
      if (window.activeHlsInstance) {
        window.activeHlsInstance.destroy();
        window.activeHlsInstance = null;
      }
    });

    // Next Episode Button
    DOM.nextEpBtn.addEventListener('click', () => {
      if (!AppState.activeMedia || AppState.activeMedia.type !== 'tv') return;
      const curSeason = AppState.activeMedia.season || 1;
      const curEp = AppState.activeMedia.episode || 1;
      const nextEp = curEp + 1;
      showToast(`Loading Episode ${nextEp}...`);
      openPlayer(AppState.activeMedia, curSeason, nextEp, AppState.currentEpisodeIndex + 1);
    });

    // Previous Episode Button
    DOM.prevEpBtn.addEventListener('click', () => {
      if (!AppState.activeMedia || AppState.activeMedia.type !== 'tv') return;
      const curSeason = AppState.activeMedia.season || 1;
      const curEp = AppState.activeMedia.episode || 1;
      if (curEp <= 1) return;
      const prevEp = curEp - 1;
      showToast(`Loading Episode ${prevEp}...`);
      openPlayer(AppState.activeMedia, curSeason, prevEp, Math.max(0, AppState.currentEpisodeIndex - 1));
    });

    // iOS Server Bottom Drawer Open & Close
    if (DOM.serverSelectorBtn) {
      DOM.serverSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
        if (e.target === DOM.serverDrawerBackdrop) {
          DOM.serverDrawerBackdrop.style.display = 'none';
        }
      });
    }

    // QR Modal Triggers & Close
    DOM.headerQrBtn.addEventListener('click', () => DOM.qrModal.style.display = 'flex');
    DOM.settingsOpenQrBtn.addEventListener('click', () => DOM.qrModal.style.display = 'flex');
    DOM.qrCloseBtn.addEventListener('click', () => DOM.qrModal.style.display = 'none');

    // Extension & Repository Modals
    if (DOM.addRepoBtn) {
      DOM.addRepoBtn.addEventListener('click', () => {
        DOM.addRepoModal.style.display = 'flex';
      });
    }
    if (DOM.repoModalCloseBtn) {
      DOM.repoModalCloseBtn.addEventListener('click', () => {
        DOM.addRepoModal.style.display = 'none';
      });
    }
    if (DOM.confirmAddRepoBtn) {
      DOM.confirmAddRepoBtn.addEventListener('click', async () => {
        const url = DOM.repoUrlInput.value.trim();
        if (!url) return showToast('Please enter repository URL', 'fa-triangle-exclamation');
        try {
          DOM.confirmAddRepoBtn.disabled = true;
          DOM.confirmAddRepoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Installing...';
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
        } catch (err) {
          DOM.confirmAddRepoBtn.disabled = false;
          DOM.confirmAddRepoBtn.innerHTML = '<i class="fa-solid fa-download"></i> Install Repository';
          showToast('Failed to add repository', 'fa-triangle-exclamation');
        }
      });
    }

    // Copy URL
    DOM.copyUrlBtn.addEventListener('click', () => {
      if (AppState.systemInfo?.accessUrl) {
        navigator.clipboard.writeText(AppState.systemInfo.accessUrl);
        showToast('Link copied to clipboard!');
      }
    });

    // Picture in Picture
    DOM.pipBtn.addEventListener('click', async () => {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (DOM.nativeVideoPlayer.requestPictureInPicture) {
        await DOM.nativeVideoPlayer.requestPictureInPicture();
      } else {
        showToast('PiP active in native player');
      }
    });

    // Fullscreen Toggle
    DOM.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        DOM.playerModal.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Settings Inputs
    DOM.prefServerSelect.value = AppState.settings.preferredServer;
    DOM.prefServerSelect.addEventListener('change', (e) => {
      AppState.settings.preferredServer = e.target.value;
      localStorage.setItem('cs_pref_server', e.target.value);
      showToast('Preferred server saved');
    });

    DOM.prefSubtitleSelect.value = AppState.settings.preferredSubtitle;
    DOM.prefSubtitleSelect.addEventListener('change', (e) => {
      AppState.settings.preferredSubtitle = e.target.value;
      localStorage.setItem('cs_pref_sub', e.target.value);
      showToast('Subtitle preference updated');
    });

    DOM.prefAutoplayToggle.checked = AppState.settings.autoPlayNext;
    DOM.prefAutoplayToggle.addEventListener('change', (e) => {
      AppState.settings.autoPlayNext = e.target.checked;
      localStorage.setItem('cs_pref_autoplay', e.target.checked);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
