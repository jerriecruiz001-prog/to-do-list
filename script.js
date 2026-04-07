/**
 * WAVR — Music Streaming App
 * Uses Deezer API via CORS proxy for real music data
 * ──────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONFIG & STATE
═══════════════════════════════════════════════ */
const DEEZER  = 'https://api.deezer.com';
// Two CORS proxies — we try the first, fall back to the second
const PROXY1  = 'https://corsproxy.io/?';
const PROXY2  = 'https://api.allorigins.win/get?url=';

const state = {
  currentTrack:   null,
  queue:          [],
  queueIndex:     0,
  isPlaying:      false,
  isShuffle:      false,
  repeatMode:     0,         // 0=off, 1=all, 2=one
  volume:         80,
  isMuted:        false,
  prevVolume:     80,
  favorites:      JSON.parse(localStorage.getItem('wavr_favorites') || '[]'),
  recentlyPlayed: JSON.parse(localStorage.getItem('wavr_recent')    || '[]'),
  playlists:      JSON.parse(localStorage.getItem('wavr_playlists') || '[]'),
  currentView:    'home',
  isDraggingProgress: false,
};

/* ═══════════════════════════════════════════════
   API MODULE
═══════════════════════════════════════════════ */
const API = {
  /** Fetch with primary proxy, fallback to secondary */
  async fetch(endpoint) {
    const url = DEEZER + endpoint;
    // Try proxy 1
    try {
      const res  = await fetch(PROXY1 + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('P1 fail');
      const data = await res.json();
      if (data.error) throw new Error('Deezer error');
      return data;
    } catch (_) {
      // Try proxy 2 (allorigins wraps JSON in {contents})
      try {
        const res  = await fetch(PROXY2 + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) });
        const wrap = await res.json();
        const data = JSON.parse(wrap.contents);
        if (data.error) throw new Error('Deezer error');
        return data;
      } catch (e) {
        console.error('API error:', e);
        throw e;
      }
    }
  },

  /** Deezer global charts */
  async charts() {
    return this.fetch('/chart/0/tracks?limit=20');
  },

  /** Search for tracks, artists, albums */
  async search(query, limit = 20) {
    return this.fetch(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  /** Get artist's top tracks */
  async artistTopTracks(artistId, limit = 10) {
    return this.fetch(`/artist/${artistId}/top?limit=${limit}`);
  },

  /** Genre / mood searches */
  async genre(q, limit = 12) {
    return this.fetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  /** Featured artists from chart */
  async featuredArtists() {
    return this.fetch('/chart/0/artists?limit=10');
  },
};

/* ═══════════════════════════════════════════════
   AUDIO ENGINE
═══════════════════════════════════════════════ */
const audio = document.getElementById('audioEl');

const Player = {
  load(track) {
    if (!track || !track.preview) {
      Toast.show('No preview available for this track', 'error');
      return;
    }
    state.currentTrack = track;
    audio.src = track.preview;
    audio.volume = state.volume / 100;
    audio.load();
    this.play();
    UI.updateNowPlaying(track);
    UI.updatePlayingCards(track.id);
    addToRecent(track);
    UI.updateQueuePanel();
  },

  play() {
    audio.play().then(() => {
      state.isPlaying = true;
      UI.setPlayState(true);
    }).catch(e => {
      console.error('Playback error:', e);
      Toast.show('Playback error — preview unavailable', 'error');
    });
  },

  pause() {
    audio.pause();
    state.isPlaying = false;
    UI.setPlayState(false);
  },

  toggle() {
    if (!state.currentTrack) {
      // Play first track in queue or first chart result
      if (state.queue.length > 0) {
        this.load(state.queue[0]);
        state.queueIndex = 0;
      }
      return;
    }
    state.isPlaying ? this.pause() : this.play();
  },

  next() {
    if (state.queue.length === 0) return;
    if (state.isShuffle) {
      const idx = Math.floor(Math.random() * state.queue.length);
      state.queueIndex = idx;
    } else {
      state.queueIndex = (state.queueIndex + 1) % state.queue.length;
    }
    this.load(state.queue[state.queueIndex]);
  },

  prev() {
    if (state.queue.length === 0) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    this.load(state.queue[state.queueIndex]);
  },

  seek(pct) {
    if (audio.duration) audio.currentTime = pct * audio.duration;
  },

  setVolume(val) {
    state.volume = val;
    audio.volume = val / 100;
    state.isMuted = val === 0;
    UI.updateVolIcon(val);
    updateVolumeTrack(val);
  },

  toggleMute() {
    if (state.isMuted) {
      state.isMuted = false;
      const v = state.prevVolume || 80;
      document.getElementById('volumeSlider').value = v;
      this.setVolume(v);
    } else {
      state.prevVolume = state.volume;
      state.isMuted = true;
      document.getElementById('volumeSlider').value = 0;
      this.setVolume(0);
    }
  },

  playQueue(tracks, startIndex = 0) {
    state.queue = tracks;
    state.queueIndex = startIndex;
    this.load(tracks[startIndex]);
    UI.updateQueuePanel();
  },
};

/* ═══════════════════════════════════════════════
   TOAST MODULE
═══════════════════════════════════════════════ */
const Toast = {
  show(msg, type = '', duration = 2400) {
    const c   = document.getElementById('toastContainer');
    const el  = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  },
};

/* ═══════════════════════════════════════════════
   UI MODULE
═══════════════════════════════════════════════ */
const UI = {
  setPlayState(playing) {
    const btn      = document.getElementById('playPauseBtn');
    const iconPlay = btn.querySelector('.icon-play');
    const iconPause= btn.querySelector('.icon-pause');
    const bars     = document.getElementById('audioBars');
    const wrap     = document.getElementById('nowArtWrap');
    const vinyl    = document.getElementById('heroVinyl');
    iconPlay.style.display  = playing ? 'none' : '';
    iconPause.style.display = playing ? '' : 'none';
    bars.classList.toggle('playing', playing);
    wrap.classList.toggle('spinning', playing);
    vinyl.classList.toggle('spinning', playing);
  },

  updateNowPlaying(track) {
    document.getElementById('nowTitle').textContent   = track.title_short || track.title;
    document.getElementById('nowArtist').textContent  = track.artist?.name || '—';
    const art = track.album?.cover_medium || track.album?.cover || '';
    document.getElementById('nowAlbumArt').src        = art;
    // Update vinyl label
    const label = document.getElementById('heroVinylLabel');
    if (art) {
      label.style.backgroundImage = `url(${art})`;
      label.style.backgroundSize  = 'cover';
    }
    // Heart state
    const liked = isFavorite(track.id);
    const hBtn  = document.getElementById('playerHeartBtn');
    hBtn.classList.toggle('liked', liked);
    // Document title
    document.title = `${track.title_short || track.title} — WAVR`;
  },

  updatePlayingCards(trackId) {
    document.querySelectorAll('.track-card').forEach(c => {
      c.classList.toggle('playing', c.dataset.id == trackId);
    });
    document.querySelectorAll('.result-item').forEach(r => {
      r.classList.toggle('playing', r.dataset.id == trackId);
      const num = r.querySelector('.result-num');
      if (num) {
        if (r.dataset.id == trackId) {
          num.innerHTML = `<div class="playing-bars"><span></span><span></span><span></span></div>`;
        } else {
          num.textContent = r.dataset.idx || '';
        }
      }
    });
    document.querySelectorAll('.queue-item').forEach(q => {
      q.classList.toggle('current', q.dataset.id == trackId);
    });
  },

  updateVolIcon(val) {
    const icon = document.getElementById('volIcon');
    if (val === 0) {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
    } else if (val < 40) {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/>`;
    } else {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>`;
    }
  },

  updateQueuePanel() {
    const list = document.getElementById('queueList');
    if (state.queue.length === 0) {
      list.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:.85rem;text-align:center">Queue is empty</div>';
      return;
    }
    list.innerHTML = state.queue.map((t, i) => `
      <div class="queue-item ${t.id === state.currentTrack?.id ? 'current' : ''}"
           data-id="${t.id}" data-qi="${i}">
        <img class="queue-art" src="${t.album?.cover_small || ''}" alt="" onerror="this.src=''"/>
        <div class="queue-info">
          <div class="queue-title">${esc(t.title_short || t.title)}</div>
          <div class="queue-artist">${esc(t.artist?.name || '')}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.queue-item').forEach(el => {
      el.addEventListener('click', () => {
        const qi = parseInt(el.dataset.qi);
        state.queueIndex = qi;
        Player.load(state.queue[qi]);
      });
    });
  },

  switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(view + 'View').classList.add('active');
    document.querySelectorAll('.nav-item, .mob-nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.view === view);
    });
    if (view === 'favorites') renderFavorites();
    if (view === 'library')   renderLibrary();
    if (view === 'search')    document.getElementById('searchInput').focus();
  },
};

/* ═══════════════════════════════════════════════
   RENDER HELPERS
═══════════════════════════════════════════════ */
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function skeletonCards(n = 6) {
  return `<div class="skeleton-row">${Array(n).fill(`
    <div class="skeleton-card">
      <div class="skel-img"></div>
      <div class="skel-line"></div>
      <div class="skel-line short"></div>
    </div>`).join('')}</div>`;
}

/** Build a track card for horizontal rows */
function trackCard(track) {
  const art   = track.album?.cover_medium || track.album?.cover || '';
  const title = esc(track.title_short || track.title);
  const artist= esc(track.artist?.name || '');
  const isPlaying = state.currentTrack?.id === track.id;
  return `
    <div class="track-card ${isPlaying ? 'playing' : ''} fade-in"
         data-id="${track.id}" title="${title}">
      <div class="card-playing-badge">▶ PLAYING</div>
      <div class="card-art-wrap">
        <img src="${art}" alt="${title}" loading="lazy" onerror="this.src=''"/>
        <div class="card-play-overlay">
          <div class="card-play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div class="card-title">${title}</div>
      <div class="card-artist">${artist}</div>
    </div>`;
}

/** Build a result-list item */
function resultItem(track, idx, opts = {}) {
  const art    = track.album?.cover_small || '';
  const title  = esc(track.title_short || track.title);
  const artist = esc(track.artist?.name || '');
  const dur    = track.duration ? fmtDuration(track.duration) : '0:30';
  const isPlaying = state.currentTrack?.id === track.id;
  const liked  = isFavorite(track.id);
  return `
    <div class="result-item ${isPlaying ? 'playing' : ''} fade-in"
         data-id="${track.id}" data-idx="${idx}">
      <div class="result-num">${isPlaying
        ? `<div class="playing-bars"><span></span><span></span><span></span></div>`
        : idx}</div>
      <img class="result-art" src="${art}" alt="" loading="lazy" onerror="this.src=''"/>
      <div class="result-info">
        <div class="result-title">${title}</div>
        <div class="result-artist">${artist}</div>
      </div>
      <div class="result-duration">${dur}</div>
      <div class="result-actions">
        <button class="result-heart ${liked ? 'liked' : ''}" data-id="${track.id}" title="Like">
          <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   HOME VIEW RENDERING
═══════════════════════════════════════════════ */
async function loadHomeSection(containerId, apiFn, applyFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = skeletonCards();
  try {
    const data = await apiFn();
    const tracks = applyFn(data);
    if (!tracks || tracks.length === 0) { el.innerHTML = '<p style="color:var(--text3);font-size:.85rem">Nothing to show right now.</p>'; return; }
    el.innerHTML = tracks.map(t => trackCard(t)).join('');
    // Attach click handlers
    el.querySelectorAll('.track-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        Player.playQueue(tracks, i);
      });
    });
  } catch (e) {
    el.innerHTML = `<p style="color:var(--text3);font-size:.85rem">Failed to load. Check your connection.</p>`;
  }
}

async function renderHome() {
  // Greeting
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('heroGreeting').textContent = greet;

  // Top Charts
  loadHomeSection('chartsRow',
    () => API.charts(),
    d  => d.data || []
  );

  // Featured Artists
  (async () => {
    const el = document.getElementById('artistRow');
    el.innerHTML = skeletonCards(6);
    try {
      const data = await API.featuredArtists();
      const artists = (data.data || []).slice(0, 8);
      el.innerHTML = artists.map(a => `
        <div class="artist-card fade-in" data-id="${a.id}" data-name="${esc(a.name)}">
          <div class="artist-art">
            <img src="${a.picture_medium || a.picture}" alt="${esc(a.name)}" loading="lazy" onerror="this.src=''"/>
          </div>
          <div class="artist-name">${esc(a.name)}</div>
          <div class="artist-label">Artist</div>
        </div>`).join('');
      el.querySelectorAll('.artist-card').forEach(card => {
        card.addEventListener('click', async () => {
          const id   = card.dataset.id;
          const name = card.dataset.name;
          Toast.show(`Loading ${name}…`);
          try {
            const d = await API.artistTopTracks(id);
            const tracks = d.data || [];
            if (tracks.length) {
              state.queue = tracks;
              state.queueIndex = 0;
              Player.load(tracks[0]);
              UI.updateQueuePanel();
            }
          } catch { Toast.show('Could not load artist tracks', 'error'); }
        });
      });
    } catch { el.innerHTML = ''; }
  })();

  // Genre rows
  loadHomeSection('afroRow',
    () => API.genre('afrobeats', 12),
    d  => d.data || []
  );
  loadHomeSection('hiphopRow',
    () => API.genre('hip hop rap', 12),
    d  => d.data || []
  );
  loadHomeSection('popRow',
    () => API.genre('pop hits 2024', 12),
    d  => d.data || []
  );

  // Recently played
  renderRecentSection();
}

function renderRecentSection() {
  const sec = document.getElementById('recentSection');
  const row = document.getElementById('recentRow');
  if (state.recentlyPlayed.length === 0) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  const tracks = state.recentlyPlayed.slice(0, 10);
  row.innerHTML = tracks.map(t => trackCard(t)).join('');
  row.querySelectorAll('.track-card').forEach((card, i) => {
    card.addEventListener('click', () => Player.playQueue(tracks, i));
  });
}

/* ═══════════════════════════════════════════════
   SEARCH VIEW RENDERING
═══════════════════════════════════════════════ */
const GENRES = [
  { label: 'Pop',        q: 'pop',          bg: 'linear-gradient(135deg,#7c3aed,#db2777)' },
  { label: 'Hip-Hop',    q: 'hip hop',      bg: 'linear-gradient(135deg,#d97706,#dc2626)' },
  { label: 'Afrobeats',  q: 'afrobeats',    bg: 'linear-gradient(135deg,#06d6a0,#0891b2)' },
  { label: 'R&B',        q: 'r&b soul',     bg: 'linear-gradient(135deg,#ec4899,#7c3aed)' },
  { label: 'Electronic', q: 'electronic',   bg: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { label: 'Rock',       q: 'rock',         bg: 'linear-gradient(135deg,#6b7280,#1f2937)' },
  { label: 'Latin',      q: 'latin',        bg: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { label: 'Jazz',       q: 'jazz',         bg: 'linear-gradient(135deg,#8b5cf6,#1e3a5f)' },
  { label: 'Classical',  q: 'classical',    bg: 'linear-gradient(135deg,#a78bfa,#c4b5fd)' },
  { label: 'Reggae',     q: 'reggae',       bg: 'linear-gradient(135deg,#16a34a,#ca8a04)' },
  { label: 'K-Pop',      q: 'kpop',         bg: 'linear-gradient(135deg,#f472b6,#818cf8)' },
  { label: 'Gospel',     q: 'gospel',       bg: 'linear-gradient(135deg,#fbbf24,#f97316)' },
];

function renderGenreGrid() {
  const grid = document.getElementById('genreGrid');
  grid.innerHTML = GENRES.map(g => `
    <div class="genre-card" style="background:${g.bg}" data-q="${esc(g.q)}">
      <span>${g.label}</span>
    </div>`).join('');
  grid.querySelectorAll('.genre-card').forEach(card => {
    card.addEventListener('click', () => {
      document.getElementById('searchInput').value = card.dataset.q;
      performSearch(card.dataset.q);
    });
  });
}

let searchDebounce = null;
async function performSearch(query) {
  const q = query.trim();
  if (!q) { showSearchDefault(); return; }

  const searchDefault = document.getElementById('searchDefault');
  const searchResults = document.getElementById('searchResults');
  const resultsList   = document.getElementById('resultsList');
  const resultsTitle  = document.getElementById('searchResultsTitle');
  const clearBtn      = document.getElementById('searchClear');

  searchDefault.style.display = 'none';
  searchResults.style.display = '';
  clearBtn.classList.add('visible');
  resultsTitle.textContent = `Results for "${q}"`;
  resultsList.innerHTML = `<div class="spinner"></div>`;

  try {
    const data   = await API.search(q, 25);
    const tracks = data.data || [];
    if (tracks.length === 0) {
      resultsList.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results for "${esc(q)}"</p></div>`;
      return;
    }
    resultsList.innerHTML = tracks.map((t, i) => resultItem(t, i + 1)).join('');
    attachResultHandlers(resultsList, tracks);
  } catch {
    resultsList.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Search failed. Try again.</p></div>`;
  }
}

function showSearchDefault() {
  document.getElementById('searchDefault').style.display = '';
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchClear').classList.remove('visible');
}

/** Attach click-to-play + heart handlers to a results list */
function attachResultHandlers(container, tracks) {
  container.querySelectorAll('.result-item').forEach((el, i) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.result-heart') || e.target.closest('.result-more')) return;
      Player.playQueue(tracks, i);
    });
  });
  container.querySelectorAll('.result-heart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id    = btn.dataset.id;
      const track = tracks.find(t => t.id == id);
      if (!track) return;
      toggleFavorite(track, btn);
    });
  });
}

/* ═══════════════════════════════════════════════
   FAVORITES
═══════════════════════════════════════════════ */
function isFavorite(id) {
  return state.favorites.some(f => f.id === id);
}

function toggleFavorite(track, heartEl) {
  const idx = state.favorites.findIndex(f => f.id === track.id);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    Toast.show('Removed from Liked Songs');
    if (heartEl) {
      heartEl.classList.remove('liked');
      heartEl.querySelector('svg').setAttribute('fill', 'none');
    }
    // Update player heart
    if (state.currentTrack?.id === track.id) {
      document.getElementById('playerHeartBtn').classList.remove('liked');
    }
  } else {
    state.favorites.unshift(track);
    Toast.show('Added to Liked Songs ❤️', 'success');
    if (heartEl) {
      heartEl.classList.add('liked');
      heartEl.querySelector('svg').setAttribute('fill', 'currentColor');
    }
    if (state.currentTrack?.id === track.id) {
      document.getElementById('playerHeartBtn').classList.add('liked');
    }
  }
  localStorage.setItem('wavr_favorites', JSON.stringify(state.favorites));
  document.getElementById('favCount').textContent = `${state.favorites.length} song${state.favorites.length !== 1 ? 's' : ''}`;
  // Re-render favorites if on that view
  if (state.currentView === 'favorites') renderFavorites();
}

function renderFavorites() {
  const list  = document.getElementById('favoritesList');
  const empty = document.getElementById('favEmpty');
  const count = document.getElementById('favCount');
  count.textContent = `${state.favorites.length} song${state.favorites.length !== 1 ? 's' : ''}`;

  if (state.favorites.length === 0) {
    list.innerHTML  = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = state.favorites.map((t, i) => resultItem(t, i + 1)).join('');
  attachResultHandlers(list, state.favorites);
}

/* ═══════════════════════════════════════════════
   RECENTLY PLAYED
═══════════════════════════════════════════════ */
function addToRecent(track) {
  state.recentlyPlayed = state.recentlyPlayed.filter(t => t.id !== track.id);
  state.recentlyPlayed.unshift(track);
  if (state.recentlyPlayed.length > 20) state.recentlyPlayed.pop();
  localStorage.setItem('wavr_recent', JSON.stringify(state.recentlyPlayed));
  renderRecentSection();
}

/* ═══════════════════════════════════════════════
   LIBRARY
═══════════════════════════════════════════════ */
function renderLibrary() {
  renderPlaylistsGrid();
  // Recent tab
  const recentList = document.getElementById('libRecentList');
  if (state.recentlyPlayed.length === 0) {
    recentList.innerHTML = `<div class="empty-state"><div class="empty-icon">🎵</div><p>Nothing played yet</p></div>`;
  } else {
    recentList.innerHTML = state.recentlyPlayed.map((t, i) => resultItem(t, i + 1)).join('');
    attachResultHandlers(recentList, state.recentlyPlayed);
  }
}

function renderPlaylistsGrid() {
  const grid = document.getElementById('playlistsGrid');
  const sideList = document.getElementById('playlistList');
  if (state.playlists.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎵</div>
      <p>Your playlists appear here</p>
      <button class="pill-btn" id="createPlaylistBtn2">Create Playlist</button>
    </div>`;
    document.getElementById('createPlaylistBtn2')?.addEventListener('click', openPlaylistModal);
    sideList.innerHTML = '<div class="playlist-empty">No playlists yet</div>';
    return;
  }
  grid.innerHTML = state.playlists.map((pl, i) => `
    <div class="playlist-grid-card" data-pli="${i}">
      <div class="playlist-cover">
        <div class="playlist-cover-icon">🎵</div>
      </div>
      <div class="card-title">${esc(pl.name)}</div>
      <div class="card-artist">${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}</div>
    </div>`).join('');
  sideList.innerHTML = state.playlists.map((pl, i) => `
    <div class="playlist-item" data-pli="${i}">
      <div class="playlist-item-icon">🎵</div>
      <span>${esc(pl.name)}</span>
    </div>`).join('');
}

function openPlaylistModal() {
  const modal = document.getElementById('playlistModal');
  modal.classList.add('open');
  document.getElementById('playlistNameInput').value = '';
  document.getElementById('playlistNameInput').focus();
}

function createPlaylist(name) {
  if (!name.trim()) return;
  state.playlists.push({ name: name.trim(), tracks: [], created: Date.now() });
  localStorage.setItem('wavr_playlists', JSON.stringify(state.playlists));
  renderPlaylistsGrid();
  Toast.show(`Playlist "${name}" created`, 'success');
}

/* ═══════════════════════════════════════════════
   PROGRESS BAR
═══════════════════════════════════════════════ */
function updateVolumeTrack(val) {
  const slider = document.getElementById('volumeSlider');
  slider.style.backgroundSize = `${val}% 100%`;
}

function updateProgress() {
  if (state.isDraggingProgress) return;
  const fill  = document.getElementById('progressFill');
  const thumb = document.getElementById('progressThumb');
  const curr  = document.getElementById('currentTime');
  const total = document.getElementById('totalTime');
  const ct    = audio.currentTime || 0;
  const dur   = audio.duration   || 30;
  const pct   = (ct / dur) * 100;
  fill.style.width  = `${pct}%`;
  thumb.style.left  = `${pct}%`;
  curr.textContent  = fmtDuration(ct);
  total.textContent = fmtDuration(dur);
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════ */
function attachEventListeners() {

  // ── Play/Pause
  document.getElementById('playPauseBtn').addEventListener('click', () => Player.toggle());

  // ── Next / Prev
  document.getElementById('nextBtn').addEventListener('click', () => Player.next());
  document.getElementById('prevBtn').addEventListener('click', () => Player.prev());

  // ── Shuffle
  document.getElementById('shuffleBtn').addEventListener('click', () => {
    state.isShuffle = !state.isShuffle;
    document.getElementById('shuffleBtn').classList.toggle('active', state.isShuffle);
    Toast.show(state.isShuffle ? 'Shuffle on' : 'Shuffle off');
  });

  // ── Repeat
  document.getElementById('repeatBtn').addEventListener('click', () => {
    state.repeatMode = (state.repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', state.repeatMode > 0);
    const msgs = ['Repeat off', 'Repeat all', 'Repeat one'];
    Toast.show(msgs[state.repeatMode]);
  });

  // ── Progress bar
  const track = document.getElementById('progressTrack');
  function seekFromEvent(e) {
    const rect = track.getBoundingClientRect();
    const pct  = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    Player.seek(pct);
    document.getElementById('progressFill').style.width = `${pct * 100}%`;
  }
  track.addEventListener('mousedown', e => {
    state.isDraggingProgress = true;
    seekFromEvent(e);
  });
  document.addEventListener('mousemove', e => {
    if (state.isDraggingProgress) seekFromEvent(e);
  });
  document.addEventListener('mouseup', () => { state.isDraggingProgress = false; });
  // Touch support
  track.addEventListener('touchstart', e => {
    state.isDraggingProgress = true;
    seekFromEvent(e.touches[0]);
  }, { passive: true });
  track.addEventListener('touchmove', e => {
    if (state.isDraggingProgress) seekFromEvent(e.touches[0]);
  }, { passive: true });
  track.addEventListener('touchend', () => { state.isDraggingProgress = false; });

  // ── Audio timeupdate
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', () => {
    if (state.repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else {
      Player.next();
    }
  });
  audio.addEventListener('loadedmetadata', updateProgress);

  // ── Volume
  const volSlider = document.getElementById('volumeSlider');
  volSlider.addEventListener('input', () => {
    Player.setVolume(parseInt(volSlider.value));
  });
  document.getElementById('volIconBtn').addEventListener('click', () => Player.toggleMute());

  // ── Player heart
  document.getElementById('playerHeartBtn').addEventListener('click', () => {
    if (!state.currentTrack) return;
    toggleFavorite(state.currentTrack, document.getElementById('playerHeartBtn'));
  });

  // ── Queue panel
  document.getElementById('queueBtn').addEventListener('click', () => {
    document.getElementById('queuePanel').classList.toggle('open');
    document.getElementById('queueBtn').classList.toggle('active');
  });
  document.getElementById('closeQueueBtn').addEventListener('click', () => {
    document.getElementById('queuePanel').classList.remove('open');
    document.getElementById('queueBtn').classList.remove('active');
  });

  // ── Nav items
  document.querySelectorAll('.nav-item, .mob-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      UI.switchView(item.dataset.view);
      closeSidebar();
    });
  });

  // ── Hamburger / mobile sidebar
  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    const overlay = document.getElementById('mobileOverlay');
    overlay.classList.toggle('visible', document.getElementById('sidebar').classList.contains('open'));
  });
  document.getElementById('mobileOverlay').addEventListener('click', closeSidebar);

  // ── Header search input (redirects to search view)
  const headerInput = document.getElementById('headerSearchInput');
  headerInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      UI.switchView('search');
      document.getElementById('searchInput').value = headerInput.value;
      performSearch(headerInput.value);
    }
  });
  headerInput.addEventListener('focus', () => UI.switchView('search'));

  // ── Search view input
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) { showSearchDefault(); return; }
    searchDebounce = setTimeout(() => performSearch(q), 450);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(searchDebounce); performSearch(searchInput.value); }
    if (e.key === 'Escape') { searchInput.value = ''; showSearchDefault(); }
  });
  document.getElementById('searchClear').addEventListener('click', () => {
    searchInput.value = '';
    showSearchDefault();
    searchInput.focus();
  });

  // ── Library tabs
  document.querySelectorAll('.lib-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      document.getElementById('libPlaylistsTab').style.display = t === 'playlists' ? '' : 'none';
      document.getElementById('libRecentTab').style.display    = t === 'recent'    ? '' : 'none';
    });
  });

  // ── Play all favorites
  document.getElementById('playAllFavBtn').addEventListener('click', () => {
    if (state.favorites.length === 0) { Toast.show('No liked songs yet'); return; }
    Player.playQueue([...state.favorites], 0);
  });

  // ── Playlist modal
  document.getElementById('createPlaylistBtn').addEventListener('click', openPlaylistModal);
  document.getElementById('modalCancel').addEventListener('click', () => {
    document.getElementById('playlistModal').classList.remove('open');
  });
  document.getElementById('modalConfirm').addEventListener('click', () => {
    const name = document.getElementById('playlistNameInput').value;
    createPlaylist(name);
    document.getElementById('playlistModal').classList.remove('open');
  });
  document.getElementById('playlistNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('modalConfirm').click();
  });

  // ── Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space')      { e.preventDefault(); Player.toggle(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); Player.next(); }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); Player.prev(); }
    if (e.code === 'KeyM')       Player.toggleMute();
    if (e.code === 'KeyS')       document.getElementById('shuffleBtn').click();
    if (e.code === 'KeyR')       document.getElementById('repeatBtn').click();
  });

  // ── Nav back/forward (simple)
  document.getElementById('backBtn').addEventListener('click', () => history.back());
  document.getElementById('fwdBtn').addEventListener('click', () => history.forward());
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('visible');
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
async function init() {
  attachEventListeners();
  updateVolumeTrack(state.volume);
  renderGenreGrid();
  await renderHome();
}

document.addEventListener('DOMContentLoaded', init);