/* ============================================================
   RAW RECKONING — WWE Universe Control
   Main Application Logic
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────
const DB = {
  superstars: [],
  factions: [],
  episodes: [],
  feuds: [],
  championships: [],
  ppvEvents: [],
  settings: {
    showName: 'RAW',
    season: 1,
    currentWeek: 1,
  },
};

function loadDB() {
  try {
    const saved = localStorage.getItem('rawReckoning_v2');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(DB, data);
    }
  } catch (e) { console.warn('DB load error', e); }
}

function saveDB() {
  try {
    localStorage.setItem('rawReckoning_v2', JSON.stringify(DB));
  } catch (e) { console.warn('DB save error', e); }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ──────────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────────
const pageTitles = {
  dashboard: 'DASHBOARD',
  roster: 'ROSTER MANAGEMENT',
  factions: 'FACTIONS & TAG TEAMS',
  episodes: 'EPISODE BUILDER',
  storylines: 'STORYLINE TRACKER',
  history: 'MATCH HISTORY',
  rankings: 'POWER RANKINGS',
  settings: 'UNIVERSE SETTINGS',
};

let currentSection = 'dashboard';

function navigateTo(section) {
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.querySelector(`.nav-item[data-section="${section}"]`).classList.add('active');

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[section] || section.toUpperCase();
  currentSection = section;
  renderSection(section);
}

function renderSection(section) {
  switch (section) {
    case 'dashboard': renderDashboard(); break;
    case 'roster': renderRoster(); break;
    case 'factions': renderFactions(); break;
    case 'episodes': renderEpisodes(); break;
    case 'storylines': renderStorylines(); break;
    case 'history': renderHistory(); break;
    case 'rankings': renderRankings(); break;
    case 'settings': renderSettings(); break;
  }
}

// ──────────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 2800);
}

// ──────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ──────────────────────────────────────────────────────────────
let confirmCallback = null;
function showConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = msg;
  confirmCallback = cb;
  openModal('modal-confirm');
}

// ──────────────────────────────────────────────────────────────
// MODAL HELPERS
// ──────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────
function renderDashboard() {
  // Stat counters
  document.getElementById('dash-roster-count').textContent = DB.superstars.filter(s => s.injuryStatus !== 'Injured').length;
  document.getElementById('dash-storyline-count').textContent = DB.feuds.filter(f => f.status !== 'Finished').length;
  document.getElementById('dash-faction-count').textContent = DB.factions.length;

  // Match count from all episodes
  let total = 0;
  DB.episodes.forEach(ep => { total += (ep.matches || []).length; });
  document.getElementById('dash-match-count').textContent = total;

  // Championships
  const champEl = document.getElementById('championship-overview');
  if (DB.championships.length === 0) {
    champEl.innerHTML = '<p class="empty-state">No championships configured. Go to Universe Settings.</p>';
  } else {
    champEl.innerHTML = DB.championships.map(c => `
      <div class="champion-item">
        <div>
          <div class="champ-title-name">${esc(c.name)}</div>
          <div class="champ-holder">${esc(c.holder || 'VACANT')}</div>
        </div>
        <div class="champ-reign">${c.reign || 0}w reign</div>
      </div>`).join('');
  }

  // Power Rankings top 5
  const ranked = [...DB.superstars].sort((a, b) => (b.momentum || 0) - (a.momentum || 0)).slice(0, 5);
  const rankEl = document.getElementById('dash-power-rankings');
  if (ranked.length === 0) {
    rankEl.innerHTML = '<p class="empty-state">No ranked superstars yet.</p>';
  } else {
    rankEl.innerHTML = ranked.map((s, i) => `
      <div class="ranking-item">
        <div class="rank-number">${i + 1}</div>
        <div class="rank-name">${esc(s.name)}</div>
        <div>
          <div class="momentum-bar-wrap">
            <div class="momentum-bar" style="width:${s.momentum || 0}%"></div>
          </div>
          <div class="rank-momentum">${s.momentum || 0} MOM</div>
        </div>
      </div>`).join('');
  }

  // Upcoming Main Event — last episode's main event match
  const meEl = document.getElementById('dash-main-event');
  const lastEp = DB.episodes[DB.episodes.length - 1];
  if (!lastEp) {
    meEl.innerHTML = '<p class="empty-state">No episode scheduled. Build an episode first.</p>';
  } else {
    const me = (lastEp.matches || []).find(m => m.slot === 'Main Event') || (lastEp.matches || [])[lastEp.matches.length - 1];
    if (!me) {
      meEl.innerHTML = `<p class="empty-state">${esc(lastEp.title)} — No matches booked</p>`;
    } else {
      meEl.innerHTML = `
        <div class="main-event-label">${esc(lastEp.title)} — MAIN EVENT</div>
        <div class="main-event-vs">${esc(me.participants)}</div>
        <div class="main-event-type">${esc(me.matchType)}</div>`;
    }
  }

  // Momentum tracker — top 6
  const momEl = document.getElementById('dash-momentum');
  const topMom = [...DB.superstars].sort((a, b) => (b.momentum || 0) - (a.momentum || 0)).slice(0, 6);
  if (topMom.length === 0) {
    momEl.innerHTML = '<p class="empty-state">No momentum data yet.</p>';
  } else {
    momEl.innerHTML = topMom.map(s => `
      <div class="ranking-item">
        <div class="rank-name" style="font-size:12px">${esc(s.name)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="momentum-bar-wrap"><div class="momentum-bar" style="width:${s.momentum || 0}%"></div></div>
          <span style="font-size:10px;color:var(--white-faint);min-width:28px">${s.momentum || 0}</span>
        </div>
      </div>`).join('');
  }
}

// ──────────────────────────────────────────────────────────────
// ROSTER
// ──────────────────────────────────────────────────────────────
function renderRoster() {
  const search = document.getElementById('roster-search').value.toLowerCase();
  const alignFilter = document.getElementById('roster-filter-align').value;
  const tierFilter = document.getElementById('roster-filter-tier').value;

  let list = DB.superstars.filter(s => {
    if (search && !s.name.toLowerCase().includes(search)) return false;
    if (alignFilter && s.alignment !== alignFilter) return false;
    if (tierFilter && s.tier !== tierFilter) return false;
    return true;
  });

  const grid = document.getElementById('roster-grid');
  if (list.length === 0) {
    grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1">No superstars found. Add one to get started.</p>';
    return;
  }

  grid.innerHTML = list.map(s => {
    const alignClass = (s.alignment || 'face').toLowerCase();
    const tierBadge = tierBadgeClass(s.tier);
    return `
    <div class="superstar-card ${alignClass} animate-in" data-id="${s.id}" title="Click for profile">
      <div class="sc-name">${esc(s.name)}</div>
      <div class="sc-archetype">${esc(s.archetype || '—')}</div>
      <div class="sc-badges">
        <span class="badge badge-${alignClass}">${esc(s.alignment)}</span>
        <span class="badge ${tierBadge}">${esc(s.tier)}</span>
        ${s.championship ? `<span class="badge badge-champion">👑 CHAMP</span>` : ''}
        ${s.injuryStatus === 'Injured' ? `<span class="badge badge-injured">INJURED</span>` : ''}
      </div>
      <div class="sc-momentum-row">
        <span class="sc-momentum-label">MOMENTUM</span>
        <div class="momentum-bar-wrap" style="flex:1">
          <div class="momentum-bar" style="width:${s.momentum || 0}%"></div>
        </div>
        <span class="sc-momentum-val">${s.momentum || 0}</span>
      </div>
      ${s.faction ? `<div style="margin-top:6px;font-size:11px;color:var(--white-faint)">◆ ${esc(s.faction)}</div>` : ''}
    </div>`;
  }).join('');

  grid.querySelectorAll('.superstar-card').forEach(card => {
    card.addEventListener('click', () => openSuperstardDetail(card.dataset.id));
  });
}

function tierBadgeClass(tier) {
  if (!tier) return 'badge-midcard';
  if (tier === 'World') return 'badge-world';
  if (tier === 'Upper Midcard') return 'badge-upper';
  return 'badge-midcard';
}

function openSuperstardDetail(id) {
  const s = DB.superstars.find(x => x.id === id);
  if (!s) return;

  document.getElementById('detail-name').textContent = s.name.toUpperCase();

  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-field-label">Alignment</span>
        <span class="detail-field-value">${esc(s.alignment)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Tier</span>
        <span class="detail-field-value">${esc(s.tier)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Archetype / Gimmick</span>
        <span class="detail-field-value">${esc(s.archetype || '—')}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Finisher</span>
        <span class="detail-field-value red">${esc(s.finisher || '—')}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Push Status</span>
        <span class="detail-field-value">${esc(s.push || '—')}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Injury Status</span>
        <span class="detail-field-value ${s.injuryStatus === 'Injured' ? 'red' : ''}">${esc(s.injuryStatus || 'Active')}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Championship</span>
        <span class="detail-field-value gold">${esc(s.championship || 'None')}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Faction</span>
        <span class="detail-field-value">${esc(s.faction || 'Solo')}</span>
      </div>
    </div>

    <div class="detail-section-title">MOMENTUM</div>
    <div class="momentum-display" style="margin-bottom:16px">
      <span class="momentum-num">${s.momentum || 0}</span>
      <div class="momentum-track"><div class="momentum-fill" style="width:${s.momentum || 0}%"></div></div>
    </div>

    ${s.bio ? `<div class="detail-section-title">BIO</div><div class="detail-text">${esc(s.bio)}</div>` : ''}
    ${s.entrance ? `<div class="detail-section-title">ENTRANCE</div><div class="detail-text">${esc(s.entrance)}</div>` : ''}
    ${s.crowd ? `<div class="detail-section-title">CROWD REACTION</div><div class="detail-text">${esc(s.crowd)}</div>` : ''}

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${winLossRecord(s.id)}
    </div>
  `;

  document.getElementById('detail-edit-btn').onclick = () => {
    closeModal('modal-superstar-detail');
    openSuperstardModal(s.id);
  };
  document.getElementById('detail-delete-btn').onclick = () => {
    showConfirm('DELETE SUPERSTAR', `Delete ${s.name} permanently?`, () => {
      DB.superstars = DB.superstars.filter(x => x.id !== id);
      saveDB();
      closeModal('modal-superstar-detail');
      renderRoster();
      showToast(`${s.name} removed from roster`);
    });
  };

  openModal('modal-superstar-detail');
}

function winLossRecord(id) {
  let wins = 0, losses = 0;
  DB.episodes.forEach(ep => {
    (ep.matches || []).forEach(m => {
      const parts = (m.participants || '').toLowerCase();
      const name = (DB.superstars.find(s => s.id === id)?.name || '').toLowerCase();
      if (!parts.includes(name)) return;
      if ((m.winner || '').toLowerCase().includes(name)) wins++;
      else losses++;
    });
  });
  return `
    <div style="background:var(--bg-hover);border:1px solid var(--border);padding:8px 14px;border-radius:2px;text-align:center">
      <div style="font-family:var(--font-title);font-size:24px;color:var(--green)">${wins}</div>
      <div style="font-family:var(--font-ui);font-size:8px;letter-spacing:2px;color:var(--white-faint)">WINS</div>
    </div>
    <div style="background:var(--bg-hover);border:1px solid var(--border);padding:8px 14px;border-radius:2px;text-align:center">
      <div style="font-family:var(--font-title);font-size:24px;color:var(--red)">${losses}</div>
      <div style="font-family:var(--font-ui);font-size:8px;letter-spacing:2px;color:var(--white-faint)">LOSSES</div>
    </div>`;
}

function openSuperstardModal(editId = null) {
  const modal = document.getElementById('modal-superstar');
  const ids = ['ss-name','ss-alignment','ss-tier','ss-archetype','ss-finisher','ss-push','ss-injury','ss-momentum','ss-championship','ss-faction','ss-bio','ss-entrance','ss-crowd'];

  if (editId) {
    const s = DB.superstars.find(x => x.id === editId);
    if (!s) return;
    document.getElementById('superstar-modal-title').textContent = 'EDIT SUPERSTAR';
    document.getElementById('ss-name').value = s.name || '';
    document.getElementById('ss-alignment').value = s.alignment || 'Face';
    document.getElementById('ss-tier').value = s.tier || 'Midcard';
    document.getElementById('ss-archetype').value = s.archetype || '';
    document.getElementById('ss-finisher').value = s.finisher || '';
    document.getElementById('ss-push').value = s.push || 'Midcard Push';
    document.getElementById('ss-injury').value = s.injuryStatus || 'Active';
    document.getElementById('ss-momentum').value = s.momentum ?? 50;
    document.getElementById('ss-championship').value = s.championship || '';
    document.getElementById('ss-faction').value = s.faction || '';
    document.getElementById('ss-bio').value = s.bio || '';
    document.getElementById('ss-entrance').value = s.entrance || '';
    document.getElementById('ss-crowd').value = s.crowd || '';
    document.getElementById('ss-edit-id').value = editId;
  } else {
    document.getElementById('superstar-modal-title').textContent = 'ADD SUPERSTAR';
    ids.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('ss-alignment').value = 'Face';
    document.getElementById('ss-tier').value = 'Midcard';
    document.getElementById('ss-push').value = 'Midcard Push';
    document.getElementById('ss-injury').value = 'Active';
    document.getElementById('ss-momentum').value = 50;
    document.getElementById('ss-edit-id').value = '';
  }

  openModal('modal-superstar');
}

function saveSuperstar() {
  const name = document.getElementById('ss-name').value.trim();
  if (!name) { showToast('Superstar name is required', 'error'); return; }

  const editId = document.getElementById('ss-edit-id').value;
  const data = {
    name,
    alignment: document.getElementById('ss-alignment').value,
    tier: document.getElementById('ss-tier').value,
    archetype: document.getElementById('ss-archetype').value.trim(),
    finisher: document.getElementById('ss-finisher').value.trim(),
    push: document.getElementById('ss-push').value,
    injuryStatus: document.getElementById('ss-injury').value,
    momentum: parseInt(document.getElementById('ss-momentum').value) || 50,
    championship: document.getElementById('ss-championship').value.trim(),
    faction: document.getElementById('ss-faction').value.trim(),
    bio: document.getElementById('ss-bio').value.trim(),
    entrance: document.getElementById('ss-entrance').value.trim(),
    crowd: document.getElementById('ss-crowd').value.trim(),
  };

  if (editId) {
    const idx = DB.superstars.findIndex(x => x.id === editId);
    if (idx !== -1) DB.superstars[idx] = { ...DB.superstars[idx], ...data };
    showToast(`${name} updated`);
  } else {
    DB.superstars.push({ id: uid(), ...data });
    showToast(`${name} added to roster`);
  }

  saveDB();
  closeModal('modal-superstar');
  renderRoster();
  updateCurrentShowDisplay();
}

// ──────────────────────────────────────────────────────────────
// FACTIONS
// ──────────────────────────────────────────────────────────────
function renderFactions() {
  const grid = document.getElementById('factions-grid');
  if (DB.factions.length === 0) {
    grid.innerHTML = '<p class="empty-state">No factions created yet. Create one to get started.</p>';
    return;
  }

  grid.innerHTML = DB.factions.map(f => `
    <div class="faction-card animate-in">
      <div class="fc-header">
        <div>
          <div class="fc-name">${esc(f.name)}</div>
          <div class="fc-type">${esc(f.type)} — ${esc(f.alignment)}</div>
        </div>
        <div class="fc-actions">
          <button class="btn-icon" onclick="openFactionModal('${f.id}')" title="Edit">✎</button>
          <button class="btn-icon red" onclick="deleteFaction('${f.id}')" title="Delete">✕</button>
        </div>
      </div>
      ${f.philosophy ? `<div class="fc-philosophy">${esc(f.philosophy)}</div>` : ''}
      <div class="fc-members">
        ${(f.members || []).map(m => `<span class="fc-member-tag">${esc(m)}</span>`).join('')}
      </div>
    </div>`).join('');
}

function openFactionModal(editId = null) {
  if (editId) {
    const f = DB.factions.find(x => x.id === editId);
    if (!f) return;
    document.getElementById('faction-modal-title').textContent = 'EDIT FACTION';
    document.getElementById('faction-name').value = f.name || '';
    document.getElementById('faction-type').value = f.type || 'Faction';
    document.getElementById('faction-alignment').value = f.alignment || 'Heel';
    document.getElementById('faction-philosophy').value = f.philosophy || '';
    document.getElementById('faction-members').value = (f.members || []).join(', ');
    document.getElementById('faction-edit-id').value = editId;
  } else {
    document.getElementById('faction-modal-title').textContent = 'CREATE FACTION';
    document.getElementById('faction-name').value = '';
    document.getElementById('faction-type').value = 'Faction';
    document.getElementById('faction-alignment').value = 'Heel';
    document.getElementById('faction-philosophy').value = '';
    document.getElementById('faction-members').value = '';
    document.getElementById('faction-edit-id').value = '';
  }
  openModal('modal-faction');
}

function saveFaction() {
  const name = document.getElementById('faction-name').value.trim();
  if (!name) { showToast('Faction name is required', 'error'); return; }

  const editId = document.getElementById('faction-edit-id').value;
  const members = document.getElementById('faction-members').value
    .split(',').map(m => m.trim()).filter(Boolean);

  const data = {
    name,
    type: document.getElementById('faction-type').value,
    alignment: document.getElementById('faction-alignment').value,
    philosophy: document.getElementById('faction-philosophy').value.trim(),
    members,
  };

  if (editId) {
    const idx = DB.factions.findIndex(x => x.id === editId);
    if (idx !== -1) DB.factions[idx] = { ...DB.factions[idx], ...data };
    showToast(`${name} updated`);
  } else {
    DB.factions.push({ id: uid(), ...data });
    showToast(`${name} created`);
  }

  saveDB();
  closeModal('modal-faction');
  renderFactions();
}

function deleteFaction(id) {
  const f = DB.factions.find(x => x.id === id);
  if (!f) return;
  showConfirm('DELETE FACTION', `Delete ${f.name}?`, () => {
    DB.factions = DB.factions.filter(x => x.id !== id);
    saveDB();
    renderFactions();
    showToast(`${f.name} disbanded`);
  });
}

// ──────────────────────────────────────────────────────────────
// EPISODES
// ──────────────────────────────────────────────────────────────
const MATCH_SLOTS = ['Opener', 'Midcard', 'Semi Main Event', 'Main Event'];
const MATCH_TYPES = [
  'Singles Match', '2-out-of-3 Falls', 'No DQ Match', 'Last Man Standing',
  'Street Fight', 'Steel Cage Match', 'Hell in a Cell', 'Ladder Match',
  'TLC Match', 'Tables Match', 'Elimination Chamber', 'Battle Royal',
  'Royal Rumble', 'Iron Man Match', 'Submission Match', 'Falls Count Anywhere',
  'Hardcore Match', 'Buried Alive', 'Inferno Match', 'War Games'
];
const RIVALRY_ACTIONS = [
  'Attack', 'Ambush', 'Promo Interruption', 'Betrayal', 'Distraction',
  'Respect Stare Down', 'Weapon Assault', 'Post-Match Beatdown',
  'Mind Games', 'Contract Signing Chaos'
];
const SEGMENT_TYPES = [
  'Promo', 'Backstage Attack', 'Interview', 'Contract Signing',
  'Championship Presentation', 'Confrontation', 'Rivalry Action', 'Announcement'
];

let episodeMatches = [];
let episodeSegments = [];

function renderEpisodes() {
  const list = document.getElementById('episodes-list');
  if (DB.episodes.length === 0) {
    list.innerHTML = '<p class="empty-state">No episodes created yet. Build your first episode.</p>';
    return;
  }

  list.innerHTML = [...DB.episodes].reverse().map(ep => `
    <div class="episode-card animate-in">
      <div class="ep-header" onclick="toggleEpBody(this)">
        <div class="ep-title-wrap">
          <span class="ep-week-badge">WK ${ep.week}</span>
          <span class="ep-title-text">${esc(ep.title)}</span>
          <span class="ep-type-badge">${esc(ep.type)}</span>
        </div>
        <div class="ep-header-right">
          <span style="font-size:11px;color:var(--white-faint)">${(ep.matches || []).length} matches · ${(ep.segments || []).length} segments</span>
          <button class="btn-icon" onclick="event.stopPropagation();openEpisodeModal('${ep.id}')" title="Edit">✎</button>
          <button class="btn-icon red" onclick="event.stopPropagation();deleteEpisode('${ep.id}')" title="Delete">✕</button>
          <span style="color:var(--white-faint);font-size:12px">▾</span>
        </div>
      </div>
      <div class="ep-body" id="ep-body-${ep.id}">
        ${ep.theme ? `<p style="font-style:italic;color:var(--white-faint);font-size:12px;margin-bottom:12px">"${esc(ep.theme)}"</p>` : ''}

        ${(ep.matches || []).length > 0 ? `
          <div class="ep-matches-header">MATCH CARD</div>
          ${(ep.matches || []).map(m => `
            <div class="ep-match-row">
              <span class="ep-slot-label">${esc(m.slot)}</span>
              <span class="ep-match-type">${esc(m.matchType)}</span>
              <span class="ep-participants">${esc(m.participants)}</span>
              <span class="ep-winner">▶ ${esc(m.winner || '?')}</span>
            </div>
            ${m.interference ? `<div style="margin-left:96px;margin-bottom:4px"><span class="interference-tag">⚡ INTERFERENCE: ${esc(m.interference)}</span></div>` : ''}
            ${m.postMatch ? `<div style="margin-left:96px;margin-bottom:4px;font-size:11px;color:var(--white-faint)">${esc(m.postMatch)}</div>` : ''}
          `).join('')}` : ''}

        ${(ep.segments || []).length > 0 ? `
          <div class="ep-matches-header" style="margin-top:12px">SEGMENTS</div>
          ${(ep.segments || []).map(seg => `
            <div class="ep-segment-row">
              <span class="ep-segment-type">${esc(seg.type)}</span>
              <div class="ep-segment-detail">
                ${seg.actor ? `<span style="font-weight:700;color:var(--white)">${esc(seg.actor)}</span> — ` : ''}
                ${seg.rivalryAction ? `<span class="story-tag">${esc(seg.rivalryAction)}</span> ` : ''}
                ${esc(seg.description || '')}
              </div>
            </div>`).join('')}` : ''}

        ${ep.notes ? `<div style="margin-top:12px;padding:10px;background:var(--bg-hover);border:1px solid var(--border);border-radius:2px;font-size:12px;color:var(--white-dim)">${esc(ep.notes)}</div>` : ''}
      </div>
    </div>`).join('');
}

function toggleEpBody(header) {
  const epId = header.closest('.episode-card').querySelector('.ep-body').id.replace('ep-body-', '');
  const body = document.getElementById(`ep-body-${epId}`);
  body.classList.toggle('open');
}

function openEpisodeModal(editId = null) {
  episodeMatches = [];
  episodeSegments = [];

  if (editId) {
    const ep = DB.episodes.find(x => x.id === editId);
    if (!ep) return;
    document.getElementById('episode-modal-title').textContent = 'EDIT EPISODE';
    document.getElementById('ep-title').value = ep.title || '';
    document.getElementById('ep-week').value = ep.week || 1;
    document.getElementById('ep-type').value = ep.type || 'Weekly';
    document.getElementById('ep-theme').value = ep.theme || '';
    document.getElementById('ep-notes').value = ep.notes || '';
    document.getElementById('ep-edit-id').value = editId;
    episodeMatches = JSON.parse(JSON.stringify(ep.matches || []));
    episodeSegments = JSON.parse(JSON.stringify(ep.segments || []));
  } else {
    document.getElementById('episode-modal-title').textContent = 'BUILD EPISODE';
    document.getElementById('ep-title').value = `${DB.settings.showName} Week ${DB.settings.currentWeek}`;
    document.getElementById('ep-week').value = DB.settings.currentWeek;
    document.getElementById('ep-type').value = 'Weekly';
    document.getElementById('ep-theme').value = '';
    document.getElementById('ep-notes').value = '';
    document.getElementById('ep-edit-id').value = '';
  }

  renderMatchSlots();
  renderSegmentSlots();
  openModal('modal-episode');
}

function renderMatchSlots() {
  const container = document.getElementById('match-slots');
  container.innerHTML = '';
  episodeMatches.forEach((m, i) => {
    container.appendChild(createMatchSlotEl(m, i));
  });
}

function createMatchSlotEl(m, i) {
  const div = document.createElement('div');
  div.className = 'match-slot';
  div.innerHTML = `
    <div class="match-slot-header">
      <span class="match-slot-title">MATCH ${i + 1}</span>
      <button class="btn-icon red" onclick="removeMatchSlot(${i})">✕</button>
    </div>
    <div class="match-slot-grid">
      <div class="form-group">
        <label>Slot</label>
        <select class="form-input ms-slot" data-idx="${i}">
          ${MATCH_SLOTS.map(s => `<option value="${s}" ${m.slot === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Match Type</label>
        <select class="form-input ms-type" data-idx="${i}">
          ${MATCH_TYPES.map(t => `<option value="${t}" ${m.matchType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Winner</label>
        <input type="text" class="form-input ms-winner" data-idx="${i}" value="${esc(m.winner || '')}" placeholder="Winner name">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label>Participants</label>
      <input type="text" class="form-input ms-participants" data-idx="${i}" value="${esc(m.participants || '')}" placeholder="e.g. John Cena vs. Randy Orton">
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label>Run-In / Interference</label>
      <input type="text" class="form-input ms-interference" data-idx="${i}" value="${esc(m.interference || '')}" placeholder="Who interferes?">
    </div>
    <div class="form-group">
      <label>Post-Match Segment Notes</label>
      <input type="text" class="form-input ms-postmatch" data-idx="${i}" value="${esc(m.postMatch || '')}" placeholder="What happens after the match?">
    </div>
  `;

  div.querySelector('.ms-slot').addEventListener('change', e => {
    episodeMatches[i].slot = e.target.value;
  });
  div.querySelector('.ms-type').addEventListener('change', e => {
    episodeMatches[i].matchType = e.target.value;
  });
  div.querySelector('.ms-winner').addEventListener('input', e => {
    episodeMatches[i].winner = e.target.value;
  });
  div.querySelector('.ms-participants').addEventListener('input', e => {
    episodeMatches[i].participants = e.target.value;
  });
  div.querySelector('.ms-interference').addEventListener('input', e => {
    episodeMatches[i].interference = e.target.value;
  });
  div.querySelector('.ms-postmatch').addEventListener('input', e => {
    episodeMatches[i].postMatch = e.target.value;
  });

  return div;
}

function removeMatchSlot(i) {
  episodeMatches.splice(i, 1);
  renderMatchSlots();
}

function renderSegmentSlots() {
  const container = document.getElementById('segment-slots');
  container.innerHTML = '';
  episodeSegments.forEach((s, i) => {
    container.appendChild(createSegmentSlotEl(s, i));
  });
}

function createSegmentSlotEl(seg, i) {
  const div = document.createElement('div');
  div.className = 'segment-slot';
  div.innerHTML = `
    <div class="segment-slot-header">
      <span class="segment-slot-title">SEGMENT ${i + 1}</span>
      <button class="btn-icon red" onclick="removeSegmentSlot(${i})">✕</button>
    </div>
    <div class="segment-slot-grid">
      <div class="form-group">
        <label>Segment Type</label>
        <select class="form-input seg-type" data-idx="${i}">
          ${SEGMENT_TYPES.map(t => `<option value="${t}" ${seg.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>WHO DOES THE ACTION</label>
        <input type="text" class="form-input seg-actor" data-idx="${i}" value="${esc(seg.actor || '')}" placeholder="Name of performer/group">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label>Rivalry Action (if applicable)</label>
      <select class="form-input seg-rivalry" data-idx="${i}">
        <option value="">— None —</option>
        ${RIVALRY_ACTIONS.map(a => `<option value="${a}" ${seg.rivalryAction === a ? 'selected' : ''}>${a}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Segment Description</label>
      <textarea class="form-textarea seg-desc" data-idx="${i}" rows="2" placeholder="Describe what happens...">${esc(seg.description || '')}</textarea>
    </div>
  `;

  div.querySelector('.seg-type').addEventListener('change', e => {
    episodeSegments[i].type = e.target.value;
  });
  div.querySelector('.seg-actor').addEventListener('input', e => {
    episodeSegments[i].actor = e.target.value;
  });
  div.querySelector('.seg-rivalry').addEventListener('change', e => {
    episodeSegments[i].rivalryAction = e.target.value;
  });
  div.querySelector('.seg-desc').addEventListener('input', e => {
    episodeSegments[i].description = e.target.value;
  });

  return div;
}

function removeSegmentSlot(i) {
  episodeSegments.splice(i, 1);
  renderSegmentSlots();
}

function saveEpisode() {
  const title = document.getElementById('ep-title').value.trim();
  if (!title) { showToast('Episode title is required', 'error'); return; }

  // Sync current input values
  syncMatchSlotData();
  syncSegmentSlotData();

  const editId = document.getElementById('ep-edit-id').value;
  const data = {
    title,
    week: parseInt(document.getElementById('ep-week').value) || 1,
    type: document.getElementById('ep-type').value,
    theme: document.getElementById('ep-theme').value.trim(),
    notes: document.getElementById('ep-notes').value.trim(),
    matches: JSON.parse(JSON.stringify(episodeMatches)),
    segments: JSON.parse(JSON.stringify(episodeSegments)),
  };

  if (editId) {
    const idx = DB.episodes.findIndex(x => x.id === editId);
    if (idx !== -1) DB.episodes[idx] = { ...DB.episodes[idx], ...data };
    showToast(`Episode updated`);
  } else {
    DB.episodes.push({ id: uid(), ...data });
    showToast(`Episode "${title}" created`);
  }

  saveDB();
  closeModal('modal-episode');
  renderEpisodes();
  if (currentSection === 'dashboard') renderDashboard();
}

function syncMatchSlotData() {
  document.querySelectorAll('#match-slots .match-slot').forEach((el, i) => {
    if (!episodeMatches[i]) return;
    const s = el.querySelector('.ms-slot');
    const t = el.querySelector('.ms-type');
    const w = el.querySelector('.ms-winner');
    const p = el.querySelector('.ms-participants');
    const inf = el.querySelector('.ms-interference');
    const pm = el.querySelector('.ms-postmatch');
    if (s) episodeMatches[i].slot = s.value;
    if (t) episodeMatches[i].matchType = t.value;
    if (w) episodeMatches[i].winner = w.value;
    if (p) episodeMatches[i].participants = p.value;
    if (inf) episodeMatches[i].interference = inf.value;
    if (pm) episodeMatches[i].postMatch = pm.value;
  });
}

function syncSegmentSlotData() {
  document.querySelectorAll('#segment-slots .segment-slot').forEach((el, i) => {
    if (!episodeSegments[i]) return;
    const t = el.querySelector('.seg-type');
    const a = el.querySelector('.seg-actor');
    const r = el.querySelector('.seg-rivalry');
    const d = el.querySelector('.seg-desc');
    if (t) episodeSegments[i].type = t.value;
    if (a) episodeSegments[i].actor = a.value;
    if (r) episodeSegments[i].rivalryAction = r.value;
    if (d) episodeSegments[i].description = d.value;
  });
}

function deleteEpisode(id) {
  const ep = DB.episodes.find(x => x.id === id);
  if (!ep) return;
  showConfirm('DELETE EPISODE', `Delete "${ep.title}"?`, () => {
    DB.episodes = DB.episodes.filter(x => x.id !== id);
    saveDB();
    renderEpisodes();
    showToast(`Episode deleted`);
  });
}

// ──────────────────────────────────────────────────────────────
// STORYLINES
// ──────────────────────────────────────────────────────────────
function renderStorylines() {
  const grid = document.getElementById('storylines-grid');
  if (DB.feuds.length === 0) {
    grid.innerHTML = '<p class="empty-state">No feuds created yet. Start a rivalry.</p>';
    return;
  }

  grid.innerHTML = DB.feuds.map(f => {
    const statusKey = (f.status || 'rising').toLowerCase().replace(' ', '');
    const statusClass = {
      rising: 'status-rising', peak: 'status-peak',
      coolingdown: 'status-cooling', finished: 'status-finished'
    }[statusKey] || 'status-rising';
    const cardClass = { rising: 'rising', peak: 'peak', coolingdown: 'cooling', finished: 'finished' }[statusKey] || 'rising';

    return `
    <div class="feud-card ${cardClass} animate-in">
      <div class="fc-feud-header">
        <div class="feud-title">${esc(f.title)}</div>
        <span class="feud-status-badge ${statusClass}">${esc(f.status)}</span>
      </div>
      <div class="feud-vs-row">
        <span class="feud-side">${esc(f.sideA)}</span>
        <span class="feud-vs-sep">VS</span>
        <span class="feud-side" style="text-align:right">${esc(f.sideB)}</span>
      </div>
      <div class="heat-bar-wrap">
        <div class="heat-label">
          <span>HEAT LEVEL</span>
          <span>${f.heat || 5}/10</span>
        </div>
        <div class="heat-bar"><div class="heat-fill" style="width:${(f.heat || 5) * 10}%"></div></div>
      </div>
      ${f.ppvTarget ? `<div class="feud-ppv">⚡ TARGET: ${esc(f.ppvTarget)}</div>` : ''}
      ${f.notes ? `<div class="feud-notes">${esc(f.notes)}</div>` : ''}
      <div class="feud-actions">
        <button class="btn-secondary small" onclick="openFeudModal('${f.id}')">EDIT</button>
        <button class="btn-danger" style="padding:4px 10px;font-size:9px" onclick="deleteFeud('${f.id}')">DELETE</button>
      </div>
    </div>`;
  }).join('');
}

function openFeudModal(editId = null) {
  if (editId) {
    const f = DB.feuds.find(x => x.id === editId);
    if (!f) return;
    document.getElementById('feud-modal-title').textContent = 'EDIT FEUD';
    document.getElementById('feud-title').value = f.title || '';
    document.getElementById('feud-side-a').value = f.sideA || '';
    document.getElementById('feud-side-b').value = f.sideB || '';
    document.getElementById('feud-heat').value = f.heat ?? 5;
    document.getElementById('feud-status').value = f.status || 'Rising';
    document.getElementById('feud-ppv').value = f.ppvTarget || '';
    document.getElementById('feud-notes').value = f.notes || '';
    document.getElementById('feud-edit-id').value = editId;
  } else {
    document.getElementById('feud-modal-title').textContent = 'CREATE FEUD';
    ['feud-title','feud-side-a','feud-side-b','feud-ppv','feud-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('feud-heat').value = 5;
    document.getElementById('feud-status').value = 'Rising';
    document.getElementById('feud-edit-id').value = '';
  }
  openModal('modal-feud');
}

function saveFeud() {
  const title = document.getElementById('feud-title').value.trim();
  if (!title) { showToast('Feud title is required', 'error'); return; }

  const editId = document.getElementById('feud-edit-id').value;
  const data = {
    title,
    sideA: document.getElementById('feud-side-a').value.trim(),
    sideB: document.getElementById('feud-side-b').value.trim(),
    heat: parseInt(document.getElementById('feud-heat').value) || 5,
    status: document.getElementById('feud-status').value,
    ppvTarget: document.getElementById('feud-ppv').value.trim(),
    notes: document.getElementById('feud-notes').value.trim(),
  };

  if (editId) {
    const idx = DB.feuds.findIndex(x => x.id === editId);
    if (idx !== -1) DB.feuds[idx] = { ...DB.feuds[idx], ...data };
    showToast(`Feud updated`);
  } else {
    DB.feuds.push({ id: uid(), ...data });
    showToast(`Feud "${title}" created`);
  }

  saveDB();
  closeModal('modal-feud');
  renderStorylines();
}

function deleteFeud(id) {
  const f = DB.feuds.find(x => x.id === id);
  if (!f) return;
  showConfirm('END FEUD', `Delete feud "${f.title}"?`, () => {
    DB.feuds = DB.feuds.filter(x => x.id !== id);
    saveDB();
    renderStorylines();
    showToast('Feud ended');
  });
}

// ──────────────────────────────────────────────────────────────
// HISTORY
// ──────────────────────────────────────────────────────────────
function renderHistory() {
  const search = document.getElementById('history-search').value.toLowerCase();
  const epFilter = document.getElementById('history-filter-episode').value;

  // Populate episode filter
  const epSelect = document.getElementById('history-filter-episode');
  const currentVal = epSelect.value;
  epSelect.innerHTML = '<option value="">ALL EPISODES</option>' +
    DB.episodes.map(ep => `<option value="${ep.id}" ${currentVal === ep.id ? 'selected' : ''}>${esc(ep.title)}</option>`).join('');

  const tbody = document.getElementById('history-tbody');
  let rows = [];

  DB.episodes.forEach(ep => {
    if (epFilter && ep.id !== epFilter) return;
    (ep.matches || []).forEach(m => {
      if (search) {
        const combined = `${m.participants || ''} ${m.winner || ''}`.toLowerCase();
        if (!combined.includes(search)) return;
      }
      rows.push({ ep, m });
    });
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--white-faint);padding:24px">No match history found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.reverse().map(({ ep, m }) => `
    <tr>
      <td data-label="Episode">${esc(ep.title)}</td>
      <td data-label="Type">${esc(m.matchType)}</td>
      <td data-label="Participants">${esc(m.participants)}</td>
      <td data-label="Winner" class="td-winner">${esc(m.winner || '?')}</td>
      <td data-label="Slot" class="td-slot">${esc(m.slot)}</td>
      <td data-label="Interference" class="td-interference">${m.interference ? `<span class="interference-tag">⚡ ${esc(m.interference)}</span>` : '—'}</td>
      <td data-label="Notes" style="font-size:11px;color:var(--white-faint)">${esc(m.postMatch || '—')}</td>
    </tr>`).join('');
}

// ──────────────────────────────────────────────────────────────
// RANKINGS
// ──────────────────────────────────────────────────────────────
function renderRankings() {
  const container = document.getElementById('rankings-container');
  const tiers = ['World', 'Upper Midcard', 'Midcard', 'Lower Midcard', 'Enhancement'];

  container.innerHTML = tiers.map(tier => {
    let superstars = DB.superstars
      .filter(s => s.tier === tier)
      .sort((a, b) => (b.momentum || 0) - (a.momentum || 0));

    if (superstars.length === 0) return '';

    return `
      <div class="ranking-tier">
        <div class="ranking-tier-header">
          <span style="color:var(--red)">◈</span>
          ${tier.toUpperCase()}
        </div>
        <div class="ranking-tier-list">
          ${superstars.map((s, i) => {
            // Win/loss calc
            let wins = 0, losses = 0;
            DB.episodes.forEach(ep => {
              (ep.matches || []).forEach(m => {
                const parts = (m.participants || '').toLowerCase();
                const name = s.name.toLowerCase();
                if (!parts.includes(name)) return;
                if ((m.winner || '').toLowerCase().includes(name)) wins++;
                else losses++;
              });
            });
            return `
            <div class="ranking-row">
              <div class="rank-pos ${i === 0 ? 'gold-rank' : ''}">${i + 1}</div>
              <div class="rank-info">
                <div class="rank-name-big">${esc(s.name)}</div>
                <div class="rank-details">
                  ${esc(s.alignment)} · ${wins}W-${losses}L
                  ${s.championship ? ` · <span style="color:var(--gold)">👑 ${esc(s.championship)}</span>` : ''}
                </div>
              </div>
              <div class="rank-momentum-display">
                <div class="rank-momentum-num">${s.momentum || 0}</div>
                <div style="font-family:var(--font-ui);font-size:8px;letter-spacing:1px;color:var(--white-faint)">MOM</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  if (!container.innerHTML.trim()) {
    container.innerHTML = '<p class="empty-state">No superstars to rank yet.</p>';
  }
}

// ──────────────────────────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────────────────────────
function renderSettings() {
  document.getElementById('setting-show-name').value = DB.settings.showName || 'RAW';
  document.getElementById('setting-season').value = DB.settings.season || 1;
  document.getElementById('setting-week').value = DB.settings.currentWeek || 1;

  renderChampionshipsList();
  renderPPVList();
}

function renderChampionshipsList() {
  const list = document.getElementById('championships-list');
  if (DB.championships.length === 0) {
    list.innerHTML = '<p class="empty-state">No championships configured.</p>';
    return;
  }
  list.innerHTML = DB.championships.map(c => `
    <div class="champ-setting-item">
      <div>
        <div class="champ-setting-name">${esc(c.name)}</div>
        <div class="champ-setting-holder">${esc(c.holder || 'VACANT')}</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-size:11px;color:var(--white-faint)">${c.reign || 0}w</span>
        <button class="btn-icon" onclick="openChampModal('${c.id}')">✎</button>
        <button class="btn-icon red" onclick="deleteChamp('${c.id}')">✕</button>
      </div>
    </div>`).join('');
}

function renderPPVList() {
  const list = document.getElementById('ppv-list');
  if (DB.ppvEvents.length === 0) {
    list.innerHTML = '<p class="empty-state">No PPV events scheduled.</p>';
    return;
  }
  list.innerHTML = [...DB.ppvEvents].sort((a, b) => a.week - b.week).map(p => `
    <div class="ppv-item">
      <div>
        <div class="ppv-name-text">${esc(p.name)}</div>
        ${p.theme ? `<div class="ppv-week-text">${esc(p.theme)}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="ppv-week-text">Wk ${p.week}</span>
        <button class="btn-icon red" onclick="deletePPV('${p.id}')">✕</button>
      </div>
    </div>`).join('');
}

function saveBrand() {
  DB.settings.showName = document.getElementById('setting-show-name').value.trim() || 'RAW';
  DB.settings.season = parseInt(document.getElementById('setting-season').value) || 1;
  DB.settings.currentWeek = parseInt(document.getElementById('setting-week').value) || 1;
  saveDB();
  updateCurrentShowDisplay();
  showToast('Brand settings saved');
}

function updateCurrentShowDisplay() {
  document.getElementById('current-show-name').textContent =
    `${DB.settings.showName} — Season ${DB.settings.season}`;
  document.getElementById('current-week').textContent = `WEEK ${DB.settings.currentWeek}`;
}

function openChampModal(editId = null) {
  if (editId) {
    const c = DB.championships.find(x => x.id === editId);
    if (!c) return;
    document.getElementById('champ-name').value = c.name || '';
    document.getElementById('champ-holder').value = c.holder || '';
    document.getElementById('champ-reign').value = c.reign || 1;
    document.getElementById('champ-edit-id').value = editId;
  } else {
    document.getElementById('champ-name').value = '';
    document.getElementById('champ-holder').value = '';
    document.getElementById('champ-reign').value = 1;
    document.getElementById('champ-edit-id').value = '';
  }
  openModal('modal-championship');
}

function saveChampionship() {
  const name = document.getElementById('champ-name').value.trim();
  if (!name) { showToast('Championship name required', 'error'); return; }

  const editId = document.getElementById('champ-edit-id').value;
  const data = {
    name,
    holder: document.getElementById('champ-holder').value.trim(),
    reign: parseInt(document.getElementById('champ-reign').value) || 0,
  };

  if (editId) {
    const idx = DB.championships.findIndex(x => x.id === editId);
    if (idx !== -1) DB.championships[idx] = { ...DB.championships[idx], ...data };
    showToast('Championship updated');
  } else {
    DB.championships.push({ id: uid(), ...data });
    showToast(`${name} created`);
  }

  saveDB();
  closeModal('modal-championship');
  renderChampionshipsList();
}

function deleteChamp(id) {
  const c = DB.championships.find(x => x.id === id);
  if (!c) return;
  showConfirm('REMOVE CHAMPIONSHIP', `Delete ${c.name}?`, () => {
    DB.championships = DB.championships.filter(x => x.id !== id);
    saveDB();
    renderChampionshipsList();
    showToast('Championship removed');
  });
}

function openPPVModal() {
  document.getElementById('ppv-name').value = '';
  document.getElementById('ppv-week').value = DB.settings.currentWeek + 4;
  document.getElementById('ppv-theme').value = '';
  document.getElementById('ppv-edit-id').value = '';
  openModal('modal-ppv');
}

function savePPV() {
  const name = document.getElementById('ppv-name').value.trim();
  if (!name) { showToast('PPV name required', 'error'); return; }

  const editId = document.getElementById('ppv-edit-id').value;
  const data = {
    name,
    week: parseInt(document.getElementById('ppv-week').value) || 1,
    theme: document.getElementById('ppv-theme').value.trim(),
  };

  if (editId) {
    const idx = DB.ppvEvents.findIndex(x => x.id === editId);
    if (idx !== -1) DB.ppvEvents[idx] = { ...DB.ppvEvents[idx], ...data };
  } else {
    DB.ppvEvents.push({ id: uid(), ...data });
  }

  saveDB();
  closeModal('modal-ppv');
  renderPPVList();
  showToast(`${name} added to roadmap`);
}

function deletePPV(id) {
  DB.ppvEvents = DB.ppvEvents.filter(x => x.id !== id);
  saveDB();
  renderPPVList();
  showToast('PPV removed');
}

// ──────────────────────────────────────────────────────────────
// ADVANCE WEEK
// ──────────────────────────────────────────────────────────────
function advanceWeek() {
  DB.settings.currentWeek++;
  // Increment championship reigns
  DB.championships.forEach(c => { if (c.holder) c.reign = (c.reign || 0) + 1; });
  saveDB();
  updateCurrentShowDisplay();
  renderSection(currentSection);
  showToast(`Advanced to Week ${DB.settings.currentWeek}`);
}

// ──────────────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────────────────────
function bindEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
    });
  });

  // Sidebar drawer toggle (mobile)
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('show');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  });
  // Close drawer when nav item clicked on mobile
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 820) {
        sidebar.classList.remove('open');
        backdrop.classList.remove('show');
      }
    });
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.modal;
      if (id) closeModal(id);
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  // Confirm dialog
  document.getElementById('confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCallback = null;
  });

  // Roster
  document.getElementById('add-superstar-btn').addEventListener('click', () => openSuperstardModal());
  document.getElementById('save-superstar-btn').addEventListener('click', saveSuperstar);
  document.getElementById('roster-search').addEventListener('input', renderRoster);
  document.getElementById('roster-filter-align').addEventListener('change', renderRoster);
  document.getElementById('roster-filter-tier').addEventListener('change', renderRoster);

  // Factions
  document.getElementById('add-faction-btn').addEventListener('click', () => openFactionModal());
  document.getElementById('add-tagteam-btn').addEventListener('click', () => {
    openFactionModal();
    document.getElementById('faction-type').value = 'Tag Team';
  });
  document.getElementById('save-faction-btn').addEventListener('click', saveFaction);

  // Episodes
  document.getElementById('create-episode-btn').addEventListener('click', () => openEpisodeModal());
  document.getElementById('add-match-btn').addEventListener('click', () => {
    episodeMatches.push({
      slot: MATCH_SLOTS[episodeMatches.length % MATCH_SLOTS.length],
      matchType: 'Singles Match',
      participants: '',
      winner: '',
      interference: '',
      postMatch: '',
    });
    renderMatchSlots();
  });
  document.getElementById('add-segment-btn').addEventListener('click', () => {
    episodeSegments.push({
      type: 'Promo',
      actor: '',
      rivalryAction: '',
      description: '',
    });
    renderSegmentSlots();
  });
  document.getElementById('save-episode-btn').addEventListener('click', saveEpisode);

  // Storylines
  document.getElementById('create-feud-btn').addEventListener('click', () => openFeudModal());
  document.getElementById('save-feud-btn').addEventListener('click', saveFeud);

  // History filters
  document.getElementById('history-search').addEventListener('input', renderHistory);
  document.getElementById('history-filter-episode').addEventListener('change', renderHistory);

  // Settings
  document.getElementById('save-brand-btn').addEventListener('click', saveBrand);
  document.getElementById('add-championship-btn').addEventListener('click', () => openChampModal());
  document.getElementById('save-championship-btn').addEventListener('click', saveChampionship);
  document.getElementById('add-ppv-btn').addEventListener('click', openPPVModal);
  document.getElementById('save-ppv-btn').addEventListener('click', savePPV);

  // Advance week
  document.getElementById('advance-week-btn').addEventListener('click', advanceWeek);
}

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
function init() {
  loadDB();
  bindEvents();
  updateCurrentShowDisplay();
  navigateTo('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
