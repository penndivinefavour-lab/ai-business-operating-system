'use strict';

// ─── State & API ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  token: localStorage.getItem('aibos_token') ?? null,
  role: localStorage.getItem('aibos_role') ?? null,
  email: localStorage.getItem('aibos_email') ?? null,
  hotels: [],
  hotelId: Number(localStorage.getItem('aibos_hotel') ?? 0) || null,
  view: 'overview',
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...opts, headers });
  let body;
  try { body = await res.json(); } catch { throw new Error(`HTTP ${res.status}`); }
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

function esc(s) {
  return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

function money(n, cur = 'XAF') {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' FCFA';
}

function toDate(s) { return s ? String(s).slice(0,10) : '—'; }
function toDateTime(s) { return s ? String(s).slice(0,16).replace('T',' ') : '—'; }

function timeAgo(s) {
  if (!s) return '';
  const then = new Date(s);
  const now = new Date();
  const ms = now - then;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

function showToast(msg, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function badge(v) {
  const map = {
    confirmed: 'badge-ok', checked_in: 'badge-ok', checked_out: 'badge-ok',
    requested: 'badge-warn', pending: 'badge-warn', open: 'badge-warn',
    cancelled: 'badge-danger', declined: 'badge-danger', lost: 'badge-danger',
    escalated: 'badge-danger', maintenance: 'badge-danger',
    done: 'badge-info', handled: 'badge-info', contacted: 'badge-info',
    qualified: 'badge-info', resolved: 'badge-info', converted: 'badge-info',
    clean: 'badge-ok', new: 'badge-accent',
  };
  const cls = map[String(v).toLowerCase()] ?? 'badge-muted';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}

// ─── Icons ─────────────────────────────────────────────────────────────────

const ICONS = {
  message: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  lead: '<svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>',
  booking: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  feedback: '<svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  escalation: '<svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendar: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  settings: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  bell: '<svg class="icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  arrowUp: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  arrowDown: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
};

// ─── Views ─────────────────────────────────────────────────────────────────

const views = {

  async overview() {
    const d = await api(`/api/hotels/${state.hotelId}/overview`);
    const o = d.occupancy, r = d.revenue, k = d.kpis;
    const greeting = getGreeting();
    $('#page-title').textContent = 'Accueil';
    $('#main').innerHTML = `
      <!-- AI Employee Card -->
      <div class="ai-employee-card anim-slide">
        <div class="ai-employee-header">
          <div class="ai-avatar">S</div>
          <div class="ai-employee-info">
            <h3>Sarah <span class="status-dot online" title="En ligne"></span></h3>
            <div class="role">Réceptionniste IA · ${esc(d.hotel.name)}</div>
          </div>
          <div style="margin-left:auto">
            <span class="badge badge-ok">En ligne</span>
          </div>
        </div>
        <div class="ai-employee-stats">
          <div class="ai-employee-stat">
            <div class="val">${k.conversations}</div>
            <div class="lbl">Conversations</div>
          </div>
          <div class="ai-employee-stat">
            <div class="val">${k.leadsNew}</div>
            <div class="lbl">Nouveaux prospects</div>
          </div>
          <div class="ai-employee-stat">
            <div class="val">${k.feedbackNew}</div>
            <div class="lbl">Avis à traiter</div>
          </div>
        </div>
      </div>

      <!-- Today Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${o.inHouse}</div>
          <div class="stat-label">En maison</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${o.arrivals}</div>
          <div class="stat-label">Arrivées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${o.departures}</div>
          <div class="stat-label">Départs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${o.occupancyPct}%</div>
          <div class="stat-label">Occupation</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${money(r.next7d)}</div>
          <div class="stat-label">CA 7 jours</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${k.rating == null ? '—' : k.rating.toFixed(1)}/5</div>
          <div class="stat-label">Note</div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card anim-fade">
        <div class="card-header">
          <div>
            <div class="card-title">Activité récente</div>
            <div class="card-subtitle">Dernières actions de Sarah</div>
          </div>
          <button class="btn-ghost btn-sm" onclick="refresh()">↻</button>
        </div>
        <div class="activity-feed">
          ${await renderActivity(d.hotel.id)}
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card anim-fade" style="animation-delay:100ms">
        <div class="card-header">
          <div class="card-title">Actions rapides</div>
        </div>
        <div class="toolbar">
          <button class="btn-primary" onclick="window.scrollTo({top:0});">📨 Ouvrir le chat client</button>
          <button class="btn-secondary" onclick="document.querySelector('[data-view=conversations]').click()">Voir les conversations</button>
          <button class="btn-secondary" onclick="document.querySelector('[data-view=bookings]').click()">Réservations</button>
        </div>
      </div>
    `;
  },

  async conversations() {
    $('#page-title').textContent = 'Conversations';
    const d = await api(`/api/hotels/${state.hotelId}/conversations`);
    if (!d.conversations.length) {
      $('#main').innerHTML = renderEmptyState('Aucune conversation', 'Quand un client parle avec Sarah, les conversations apparaîtront ici.', 'message');
      return;
    }
    $('#main').innerHTML = `
      <div class="page-header">
        <h2>Conversations</h2>
        <div class="toolbar">
          <div class="search-box">
            <span>🔍</span>
            <input type="text" placeholder="Rechercher..." id="conv-search" />
          </div>
        </div>
      </div>
      <div class="conv-list">
        ${d.conversations.slice(0,20).map((c) => `
          <div class="conv-item anim-fade" onclick="openConversation(${c.id})">
            <div class="conv-avatar">${esc(c.channel === 'whatsapp' ? '📱' : '💬')}</div>
            <div class="conv-body">
              <div class="conv-name">Conversation #${c.id} · ${esc(c.channel)}</div>
              <div class="conv-preview">${esc(c.intent_last || 'Aucun intent détecté')}</div>
            </div>
            <div class="conv-meta">
              <div class="conv-time">${timeAgo(c.last_message_at)}</div>
              <span class="badge ${c.status === 'open' ? 'badge-accent' : c.status === 'escalated' ? 'badge-danger' : 'badge-muted'}">${esc(c.status)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async leads() {
    $('#page-title').textContent = 'Prospects';
    const d = await api(`/api/hotels/${state.hotelId}/leads`);
    $('#main').innerHTML = `
      <div class="page-header">
        <h2>Prospects</h2>
        <span class="badge badge-accent">${d.leads.filter(l => l.status === 'new').length} nouveaux</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Contact</th><th>Intention</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${d.leads.length ? d.leads.map(l => `
                <tr>
                  <td><strong>${esc(l.name || '—')}</strong></td>
                  <td>${esc(l.phone || l.email || '—')}</td>
                  <td><span class="text-2">${esc(l.intent || '—')}</span></td>
                  <td>${badge(l.status)}</td>
                  <td class="muted">${toDate(l.created_at)}</td>
                  <td>
                    <select onchange="api('/api/hotels/${state.hotelId}/leads/${l.id}',{method:'PATCH',body:JSON.stringify({status:this.value})}).then(()=>{showToast('Statut mis à jour','success');refresh()})" style="padding:4px 8px;font-size:12px">
                      ${['new','contacted','qualified','converted','lost'].map(s => `<option value="${s}" ${s===l.status?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6"><div class="empty-state"><p>Aucun prospect</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async bookings() {
    $('#page-title').textContent = 'Réservations';
    const d = await api(`/api/hotels/${state.hotelId}/reservations`);
    $('#main').innerHTML = `
      <div class="page-header">
        <h2>Réservations</h2>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='confirmed').length}</div><div class="stat-label">Confirmées</div></div>
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='requested').length}</div><div class="stat-label">En attente</div></div>
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='cancelled').length}</div><div class="stat-label">Annulées</div></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Client</th><th>Arrivée</th><th>Départ</th><th>Personnes</th><th>Total</th><th>Statut</th></tr></thead>
            <tbody>
              ${d.reservations.length ? d.reservations.map(r => `
                <tr>
                  <td class="muted">#${r.id}</td>
                  <td>${esc(r.customer_id || '—')}</td>
                  <td>${toDate(r.check_in)}</td>
                  <td>${toDate(r.check_out)}</td>
                  <td>${r.guests}</td>
                  <td><strong>${money(r.total_amount)}</strong></td>
                  <td>${badge(r.status)}</td>
                </tr>
              `).join('') : '<tr><td colspan="7"><div class="empty-state"><p>Aucune réservation</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async customers() {
    $('#page-title').textContent = 'Clients';
    const d = await api(`/api/hotels/${state.hotelId}/customers`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Clients</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Langue</th><th>Source</th></tr></thead>
            <tbody>
              ${d.customers.length ? d.customers.map(c => `
                <tr>
                  <td><strong>${esc(c.name || 'Anonyme')}</strong></td>
                  <td>${esc(c.phone || '—')}</td>
                  <td class="muted">${esc(c.email || '—')}</td>
                  <td><span class="badge badge-muted">${esc(c.language || 'fr')}</span></td>
                  <td>${esc(c.source || '—')}</td>
                </tr>
              `).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Aucun client</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async knowledge() {
    $('#page-title').textContent = 'Connaissances';
    const d = await api(`/api/hotels/${state.hotelId}/knowledge`);
    const byCat = {};
    for (const it of d.items) (byCat[it.category] ??= []).push(it);
    $('#main').innerHTML = `
      <div class="page-header">
        <h2>Connaissances</h2>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Ajouter une entrée</div></div>
        <div class="form-grid">
          <div class="field"><label>Catégorie</label><input id="kb-cat" value="general" /></div>
          <div class="field"><label>Question</label><input id="kb-q" placeholder="Ex: Early check-in possible ?" /></div>
          <div class="field"><label>Réponse</label><input id="kb-a" placeholder="Réponse déterministe" /></div>
          <div class="field"><label>Mots-clés</label><input id="kb-kw" placeholder="check-in early heure" /></div>
        </div>
        <div style="margin-top:12px"><button class="btn-primary" onclick="addKnowledge()">Ajouter</button></div>
      </div>
      ${Object.entries(byCat).map(([cat, items]) => `
        <div class="card">
          <div class="card-header"><div class="card-title">${esc(cat)}</div><div class="card-subtitle">${items.length} entrée(s)</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Question</th><th>Réponse</th><th>Mots-clés</th><th></th></tr></thead>
              <tbody>
                ${items.map(i => `
                  <tr>
                    <td>${esc(i.question || '—')}</td>
                    <td>${esc(i.answer)}</td>
                    <td class="muted">${esc(i.keywords || '')}</td>
                    <td><button class="btn-ghost btn-sm" onclick="delKnowledge(${i.id})">✕</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    `;
  },

  async feedback() {
    $('#page-title').textContent = 'Avis';
    const d = await api(`/api/hotels/${state.hotelId}/feedback`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Avis clients</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Note</th><th>Commentaire</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              ${d.feedback.length ? d.feedback.map(f => `
                <tr>
                  <td>#${f.customer_id || '—'}</td>
                  <td>${f.rating != null ? '<span style="color:var(--warn)">★</span>'.repeat(f.rating) + '<span class="muted">★</span>'.repeat(5-f.rating) : '—'}</td>
                  <td>${esc(f.comment || '—')}</td>
                  <td>${badge(f.status)}</td>
                  <td class="muted">${toDate(f.created_at)}</td>
                </tr>
              `).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Aucun avis</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async settings() {
    $('#page-title').textContent = 'Paramètres';
    const d = await api(`/api/hotels/${state.hotelId}/config`);
    const h = d.hotel;
    $('#main').innerHTML = `
      <div class="page-header"><h2>Paramètres</h2></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Informations de l'hôtel</div></div>
        <div class="form-grid">
          <div class="field"><label>Nom</label><input id="s-name" value="${esc(h.name)}" /></div>
          <div class="field"><label>Email</label><input id="s-email" value="${esc(h.email)}" /></div>
          <div class="field"><label>Téléphone</label><input id="s-phone" value="${esc(h.phone)}" /></div>
          <div class="field"><label>WhatsApp</label><input id="s-wa" value="${esc(h.whatsapp_phone)}" placeholder="+2376xxxxxxxx" /></div>
          <div class="field"><label>Adresse</label><input id="s-address" value="${esc(h.address)}" /></div>
          <div class="field"><label>Ville</label><input id="s-city" value="${esc(h.city)}" /></div>
          <div class="field"><label>Devise</label><input id="s-currency" value="${esc(h.currency)}" /></div>
          <div class="field"><label>Check-in</label><input id="s-ci" value="${esc(h.check_in_time)}" /></div>
          <div class="field"><label>Check-out</label><input id="s-co" value="${esc(h.check_out_time)}" /></div>
        </div>
        <div style="margin-top:16px"><button class="btn-primary" onclick="saveSettings()">Enregistrer</button> <span id="s-saved" class="muted"></span></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Employé IA</div></div>
        <div class="form-grid">
          <div class="field"><label>Nom de l'employé IA</label><input id="ai-name" value="Sarah" /></div>
          <div class="field"><label>Rôle</label><input value="Réceptionniste" disabled /></div>
          <div class="field"><label>Langue principale</label>
            <select id="ai-lang"><option ${h.default_lang === 'fr' ? 'selected' : ''}>Français</option><option ${h.default_lang === 'en' ? 'selected' : ''}>English</option></select>
          </div>
          <div class="field"><label>Statut</label><div style="display:flex;align-items:center;gap:8px;height:44px"><span class="status-dot online"></span> En ligne</div></div>
        </div>
        <div style="margin-top:16px"><button class="btn-secondary">Mettre en pause</button> <button class="btn-primary">Prendre la main</button></div>
      </div>
    `;
  },

  async rooms() {
    $('#page-title').textContent = 'Chambres';
    const d = await api(`/api/hotels/${state.hotelId}/rooms`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Chambres</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom</th><th>Type</th><th>Prix/nuit</th><th>Cap.</th><th>Statut</th></tr></thead>
            <tbody>
              ${d.rooms.length ? d.rooms.map(r => `
                <tr>
                  <td><strong>${esc(r.number)}</strong></td>
                  <td>${esc(r.name || r.room_type)}</td>
                  <td>${esc(r.room_type)}</td>
                  <td>${money(r.base_price)}</td>
                  <td>${r.capacity}</td>
                  <td>${badge(r.status)}</td>
                </tr>
              `).join('') : '<tr><td colspan="6"><div class="empty-state"><p>Aucune chambre</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async followups() {
    $('#page-title').textContent = 'Suivis';
    const d = await api(`/api/hotels/${state.hotelId}/followups`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Suivis automatisés</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tâche</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              ${d.followups.length ? d.followups.map(f => `
                <tr>
                  <td>${esc(f.task)}</td>
                  <td class="muted">${toDateTime(f.due_at)}</td>
                  <td>${badge(f.status)}</td>
                  <td>${f.status === 'pending' ? `<button class="btn-ghost btn-sm" onclick="doneFollowup(${f.id})">Terminer</button>` : ''}</td>
                </tr>
              `).join('') : '<tr><td colspan="4"><div class="empty-state"><p>Aucun suivi</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async escalations() {
    $('#page-title').textContent = 'Escalades';
    const d = await api(`/api/hotels/${state.hotelId}/escalations`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Escalades humaines</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Raison</th><th>Conversation</th><th>Demandée par client</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              ${d.escalations.length ? d.escalations.map(e => `
                <tr>
                  <td class="muted">#${e.id}</td>
                  <td>${esc(e.reason)}</td>
                  <td>#${e.conversation_id || '—'}</td>
                  <td>${e.requested_by_guest ? badge('Oui') : '—'}</td>
                  <td>${badge(e.status)}</td>
                  <td>${e.status === 'open' ? `<button class="btn-ghost btn-sm" onclick="handleEscalation(${e.id})">Traiter</button>` : ''}</td>
                </tr>
              `).join('') : '<tr><td colspan="6"><div class="empty-state"><p>Aucune escalade</p></div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async reports() {
    $('#page-title').textContent = 'Rapports';
    const d = await api(`/api/hotels/${state.hotelId}/reports`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Rapports <span class="muted">— ${toDate(d.period.from)} → ${toDate(d.period.to)}</span></h2></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${d.reservations}</div><div class="stat-label">Réservations</div></div>
        <div class="stat-card"><div class="stat-value">${money(d.revenue)}</div><div class="stat-label">Revenu</div></div>
        <div class="stat-card"><div class="stat-value">${money(d.avgRate)}</div><div class="stat-label">Panier moyen</div></div>
        <div class="stat-card"><div class="stat-value">${d.rating == null ? '—' : d.rating.toFixed(1)}/5</div><div class="stat-label">Note</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Par source</div></div>
        <div class="table-wrap"><table><thead><tr><th>Source</th><th>Nombre</th></tr></thead><tbody>
          ${d.bySource.map(s => `<tr><td>${esc(s.source)}</td><td>${s.count}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    `;
  },

  async audit() {
    $('#page-title').textContent = 'Journal';
    const d = await api(`/api/hotels/${state.hotelId}/audit`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Journal d'audit</h2></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Acteur</th><th>Action</th><th>Entité</th><th>Détails</th><th>Quand</th></tr></thead>
            <tbody>
              ${d.entries.map(e => `
                <tr>
                  <td>${badge(e.actor_type)}</td>
                  <td><code>${esc(e.action)}</code></td>
                  <td>${esc(e.entity || '—')}</td>
                  <td class="muted">${esc((e.details || '').slice(0,90))}</td>
                  <td class="muted">${toDateTime(e.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async demo() {
    $('#page-title').textContent = 'Démo';
    const d = await api('/api/demo/scenarios');
    $('#main').innerHTML = `
      <div class="page-header"><h2>Simulateur démo</h2></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Scénarios</div></div>
        <div class="toolbar">
          <button class="btn-primary" onclick="runDemo('all')">▶ Tout rejouer</button>
          ${d.scenarios.map(s => `<button class="btn-secondary" onclick="runDemo('${s}')">${esc(s)}</button>`).join('')}
        </div>
      </div>
      <div id="demo-out"></div>
    `;
  },

  async agents() {
    $('#page-title').textContent = 'Gouvernance IA';
    const d = await api(`/api/hotels/${state.hotelId}/agents`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Agents & outils</h2></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Outils gouvernés</div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Outil</th><th>Permission</th><th>Description</th></tr></thead>
            <tbody>
              ${d.tools.map(t => `
                <tr>
                  <td><code style="color:var(--accent)">${esc(t.name)}</code></td>
                  <td>${badge(t.permission)}</td>
                  <td>${esc(t.summary)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Dernières exécutions</div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Intent</th><th>Actions</th><th>Latence</th><th>Quand</th></tr></thead>
            <tbody>
              ${d.runs.map(r => `
                <tr>
                  <td class="muted">#${r.id}</td>
                  <td><code>${esc(r.intent)}</code></td>
                  <td><code class="mono">${esc(r.actions.slice(0,80))}</code></td>
                  <td class="muted">${r.latency_ms}ms</td>
                  <td class="muted">${toDateTime(r.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // "More" tab shows the sidebar links not in bottom nav
  async more() {
    $('#page-title').textContent = 'Plus';
    $('#main').innerHTML = `
      <div class="page-header"><h2>Plus</h2></div>
      <div class="card">
        <div style="display:flex;flex-direction:column;gap:4px">
          ${['customers','knowledge','feedback','followups','escalations','reports','audit','settings','agents','demo'].map(v => `
            <button onclick="document.querySelector('[data-view=${v}]').click()" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:8px;background:none;border:none;color:var(--text);font-size:14px;text-align:left">
              <span style="opacity:0.6">${ICONS[viewIcon(v)] || '•'}</span> ${viewLabel(v)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }
};

function viewIcon(v) {
  const map = { customers:'users', knowledge:'settings', feedback:'star', followups:'calendar', escalation:'escalation', reports:'chart', audit:'bell', settings:'settings', agents:'settings', demo:'message' };
  return map[v] || 'message';
}

function viewLabel(v) {
  const map = {
    customers:'Clients', knowledge:'Connaissances', feedback:'Avis', followups:'Suivis',
    escalations:'Escalades', reports:'Rapports', audit:'Journal', settings:'Paramètres',
    agents:'Gouvernance IA', demo:'Démo'
  };
  return map[v] || v;
}

// ─── Activity Feed ─────────────────────────────────────────────────────────

async function renderActivity(hotelId) {
  try {
    const convs = await api(`/api/hotels/${hotelId}/conversations`);
    const recent = convs.conversations.slice(0, 8);
    if (!recent.length) {
      return `<div class="empty-state"><p>Aucune activité récente</p><p class="muted">Sarah attend des messages</p></div>`;
    }
    return recent.map((c) => {
      const icon = c.channel === 'whatsapp' ? 'message' : 'message';
      return `
        <div class="activity-item anim-fade">
          <div class="activity-icon ${icon}">${icon === 'message' ? '💬' : '📨'}</div>
          <div class="activity-body">
            <div class="activity-title">Nouveau message ${c.channel === 'whatsapp' ? 'WhatsApp' : 'web'}</div>
            <div class="activity-meta">Conversation #${c.id} · ${esc(c.intent_last || 'greeting')} · ${timeAgo(c.last_message_at)}</div>
          </div>
          <span class="badge ${c.status === 'open' ? 'badge-accent' : c.status === 'escalated' ? 'badge-danger' : 'badge-muted'}">${esc(c.status)}</span>
        </div>
      `;
    }).join('');
  } catch {
    return '<p class="muted">Impossible de charger l\'activité</p>';
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderEmptyState(title, desc, icon) {
  return `<div class="empty-state anim-fade"><div class="icon">${icon === 'message' ? '💬' : '📭'}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

async function refresh() {
  try { await views[state.view](); }
  catch (err) { showToast(err.message, 'error'); }
}

// ─── Boot ──────────────────────────────────────────────────────────────────

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }),
    });
    state.token = d.token;
    state.role = d.role;
    state.email = d.email;
    localStorage.setItem('aibos_token', d.token);
    localStorage.setItem('aibos_role', d.role);
    localStorage.setItem('aibos_email', d.email);
    if (d.hotelId) {
      state.hotelId = d.hotelId;
      localStorage.setItem('aibos_hotel', String(d.hotelId));
    }
    await loadHotels();
    showApp();
  } catch (err) {
    showToast('Connexion refusée: ' + err.message, 'error');
  }
});

$('#logout').addEventListener('click', () => {
  localStorage.removeItem('aibos_token');
  localStorage.removeItem('aibos_role');
  localStorage.removeItem('aibos_email');
  state.token = null;
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
});

// Mobile menu toggle
$('#menu-btn').addEventListener('click', () => {
  $('#sidebar').classList.toggle('mobile-open');
  $('#sidebar-overlay').classList.toggle('active');
});

$('#sidebar-overlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('mobile-open');
  $('#sidebar-overlay').classList.remove('active');
});

// Navigation (sidebar + bottom nav)
function attachNav() {
  $$$('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'more' && window.innerWidth < 1024) {
        state.view = 'more';
        $('#page-title').textContent = 'Plus';
      } else {
        state.view = view;
      }
      $$$('[data-view]').forEach(b => b.classList.remove('active'));
      $$$('[data-view="' + view + '"]').forEach(b => b.classList.add('active'));
      // Close mobile sidebar
      $('#sidebar').classList.remove('mobile-open');
      $('#sidebar-overlay').classList.remove('active');
      views[state.view]();
    });
  });
}

async function loadHotels() {
  const d = await api('/api/hotels');
  state.hotels = d.hotels;
  const sel = $('#hotel-select');
  sel.innerHTML = state.hotels.map(h => `<option value="${h.id}" ${h.id === state.hotelId ? 'selected' : ''}>${esc(h.name)}${h.demo ? ' (demo)' : ''}</option>`).join('');
  if (!state.hotels.some(h => h.id === state.hotelId)) {
    state.hotelId = state.hotels[0]?.id ?? null;
  }
  sel.onchange = () => {
    state.hotelId = Number(sel.value);
    localStorage.setItem('aibos_hotel', String(state.hotelId));
    refresh();
  };
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  if (state.role === 'staff') $('#hotel-select').setAttribute('disabled', 'disabled');
  attachNav();
  views[state.view]();
}

async function loginFlow() {
  if (state.token) {
    try {
      await loadHotels();
      showApp();
      return;
    } catch {
      localStorage.removeItem('aibos_token');
      state.token = null;
    }
  }
  $('#login-view').classList.remove('hidden');
}

loginFlow();
