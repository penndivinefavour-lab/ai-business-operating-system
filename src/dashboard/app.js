'use strict';

const $ = (sel) => document.querySelector(sel);
const $$$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  token: localStorage.getItem('fd_token') ?? null,
  role: localStorage.getItem('fd_role') ?? null,
  email: localStorage.getItem('fd_email') ?? null,
  hotels: [],
  hotelId: Number(localStorage.getItem('fd_hotel') ?? 0) || null,
  view: 'overview',
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...opts, headers });
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

function badge(v) {
  const map = {
    confirmed: 'ok', checked_in: 'ok', checked_out: 'ok',
    requested: 'warn', pending: 'warn', open: 'warn',
    cancelled: 'danger', declined: 'danger', lost: 'danger', out_of_service: 'danger',
    escalated: 'danger', maintenance: 'danger',
    done: 'info', handled: 'info', contacted: 'info', qualified: 'info', resolved: 'info', converted: 'info',
    clean: 'ok',
  };
  const cls = map[String(v).toLowerCase()] ?? 'muted';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function money(n, cur = 'XAF') {
  const v = Math.round(Number(n) || 0);
  const s = v.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
  return `${s} FCFA`;
}

function table(rows, cols) {
  if (!rows.length) return '<p class="muted">Aucune donnée.</p>';
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const bodyRows = rows.map((r) =>
    '<tr>' + cols.map((c) => {
      const v = c.render ? c.render(r) : r[c.k];
      return `<td>${v ?? ''}</td>`;
    }).join('') + '</tr>',
  ).join('');
  return `<div class="panel" style="overflow:auto"><table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

function kpi(v, l) {
  return `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
}

function card(title, body) {
  return `<div class="panel"><h3>${esc(title)}</h3>${body}</div>`;
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

const views = {
  async overview() {
    const d = await api(`/api/hotels/${state.hotelId}/overview`);
    const o = d.occupancy, r = d.revenue;
    $('#main').innerHTML = `
      <div class="page-head"><h2>${esc(d.hotel.name)} — ${esc(d.hotel.city)}</h2>
        <a class="ghost small" href="/chat-demo.html" target="_blank">Ouvrir le widget chat</a></div>
      <div class="kpis">
        ${kpi(o.occupancyPct + '%', 'Occupation')}
        ${kpi(o.inHouse, 'En maison')}
        ${kpi(o.arrivals, 'Arrivées aujourd\'hui')}
        ${kpi(o.departures, 'Départs aujourd\'hui')}
        ${kpi(money(r.next7d), 'CA 7j')}
        ${kpi(toDate(d.timeframe), 'Aujourd\'hui')}
      </div>
      <div class="kpis">
        ${kpi(d.kpis.conversations, 'Conversations')}
        ${kpi(d.kpis.customers, 'Clients')}
        ${kpi(d.kpis.leadsNew, 'Leads à traiter')}
        ${kpi(d.kpis.feedbackNew, 'Avis à traiter')}
        ${kpi(d.kpis.rating == null ? '—' : d.kpis.rating.toFixed(1) + ' / 5', 'Note moyenne')}
        ${kpi(d.kpis.followupsDue, 'Suivis en retard')}
      </div>
      ${card('Prochaines arrivées (7 jours)', table(d.upcoming, [
        { k: 'id', label: '#' },
        { k: 'checkIn', label: 'Arrivée' },
        { k: 'checkOut', label: 'Départ' },
        { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
        { k: 'totalAmount', label: 'Montant', render: (x) => money(x.total) },
        { k: 'roomIds', label: 'Chambres', render: (x) => x.roomIds.join(', ') },
      ]))}
      ${card('Hôtel', `<p>${esc(d.hotel.address)} — ${esc(d.hotel.city)} · ${esc(d.hotel.email)} · ${esc(d.hotel.phone)}</p>
        <p class="muted">Check-in ${esc(d.hotel.check_in_time)} · Check-out ${esc(d.hotel.check_out_time)} · TVA ${d.hotel.tax_rate}% · Devise ${esc(d.hotel.currency)}</p>`)}
    `;
  },

  async conversations() {
    const d = await api(`/api/hotels/${state.hotelId}/conversations`);
    $('#main').innerHTML = `
      <div class="page-head"><h2>Conversations</h2></div>
      ${table(d.conversations.map((c) => ({
        id: c.id, channel: c.channel, status: c.status, intent: c.intent_last,
        msgs: c.messages, at: c.last_message_at,
      })), [
        { k: 'id', label: '#' },
        { k: 'channel', label: 'Canal' },
        { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
        { k: 'intent', label: 'Dernier intent', render: (x) => esc(x.intent || '—') },
        { k: 'msgs', label: 'Messages' },
        { k: 'at', label: 'Dernier message', render: (x) => toDate(x.at) },
        { k: 'id', label: '', render: (x) => `<button class="small" onclick="openConversation(${x.id})">Ouvrir</button>` },
      ])}`;
  },

  async reservations() {
    const d = await api(`/api/hotels/${state.hotelId}/reservations`);
    $('#main').innerHTML = `
      <div class="page-head"><h2>Réservations</h2></div>
      ${table(d.reservations, [
        { k: 'id', label: '#' },
        { k: 'customer_id', label: 'Client' },
        { k: 'check_in', label: 'Arrivée' },
        { k: 'check_out', label: 'Départ' },
        { k: 'guests', label: 'Pers.' },
        { k: 'roomIds', label: 'Chambres', render: (x) => x.roomIds.join(', ') },
        { k: 'total_amount', label: 'Montant', render: (x) => money(x.total_amount) },
        { k: 'source', label: 'Source' },
        { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
        {
          k: 'status', label: 'Changer',
          render: (x) => `<select class="small" onchange="setResvStatus(${x.id}, this.value)">
            ${['requested','confirmed','checked_in','checked_out','cancelled','declined'].map((s) =>
              `<option value="${s}" ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>`,
        },
      ])}`;
  },

  async customers() {
    const d = await api(`/api/hotels/${state.hotelId}/customers`);
    $('#main').innerHTML = `<div class="page-head"><h2>Clients</h2></div>${table(d.customers, [
      { k: 'id', label: '#' },
      { k: 'name', label: 'Nom' },
      { k: 'phone', label: 'Téléphone' },
      { k: 'email', label: 'Email' },
      { k: 'language', label: 'Langue' },
      { k: 'source', label: 'Source' },
      { k: 'notes', label: 'Notes', render: (x) => esc(x.notes || '—') },
      { k: 'created_at', label: 'Créé', render: (x) => toDate(x.created_at) },
    ])}`;
  },

  async leads() {
    const d = await api(`/api/hotels/${state.hotelId}/leads`);
    $('#main').innerHTML = `<div class="page-head"><h2>Leads</h2></div>${table(d.leads, [
      { k: 'id', label: '#' },
      { k: 'name', label: 'Nom' },
      { k: 'phone', label: 'Téléphone' },
      { k: 'intent', label: 'Intention' },
      { k: 'notes', label: 'Notes', render: (x) => esc(x.notes || '—') },
      { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
      { k: 'status', label: 'Changer', render: (x) => `<select class="small" onchange="setLeadStatus(${x.id}, this.value)">${['new','contacted','qualified','converted','lost'].map((s) => `<option value="${s}" ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` },
    ])}`;
  },

  async rooms() {
    const d = await api(`/api/hotels/${state.hotelId}/rooms`);
    $('#main').innerHTML = `<div class="page-head"><h2>Chambres</h2></div>${table(d.rooms, [
      { k: 'number', label: 'N°' },
      { k: 'name', label: 'Nom', render: (x) => esc(x.name || x.room_type) },
      { k: 'room_type', label: 'Type' },
      { k: 'floor', label: 'Étage' },
      { k: 'capacity', label: 'Cap.' },
      { k: 'base_price', label: 'Prix/nuit', render: (x) => money(x.base_price) },
      { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
      { k: 'maintenance', label: 'Maintenance', render: (x) => x.maintenance ? badge('maintenance') : '—' },
      {
        k: 'id', label: 'Actions',
        render: (x) => `<select class="small" onchange="setRoomStatus(${x.id}, this.value)">${['clean','dirty','maintenance','out_of_service'].map((s) => `<option value="${s}">${s}</option>`).join('')}</select> ${x.maintenance
          ? `<button class="small" onclick="toggleRoomMaint(${x.id},0)">Libérer</button>`
          : `<button class="small" onclick="toggleRoomMaint(${x.id},1)">Maintenance</button>`}`,
      },
    ])}`;
  },

  async knowledge() {
    const d = await api(`/api/hotels/${state.hotelId}/knowledge`);
    const byCat = {};
    for (const it of d.items) {
      (byCat[it.category] ??= []).push(it);
    }
    $('#main').innerHTML = `<div class="page-head"><h2>Base de connaissances</h2></div>
      ${card('Ajouter une entrée', `
        <div class="form-grid">
          <div class="field"><label>Catégorie</label><input id="kb-cat" value="general" /></div>
          <div class="field"><label>Question (courte)</label><input id="kb-q" /></div>
          <div class="field"><label>Réponse déterministe</label><input id="kb-a" /></div>
          <div class="field"><label>Mots-clés (espacés)</label><input id="kb-kw" /></div>
        </div>
        <div class="toolbox" style="margin-top:12px"><button class="primary" onclick="addKnowledge()">Ajouter</button></div>`)}
      ${Object.entries(byCat).map(([cat, items]) => card(cat, table(items, [
        { k: 'question', label: 'Question', render: (x) => esc(x.question || '—') },
        { k: 'answer', label: 'Réponse', render: (x) => esc(x.answer) },
        { k: 'keywords', label: 'Mots-clés', render: (x) => esc(x.keywords || '') },
        { k: 'id', label: '', render: (x) => `<button class="small" onclick="delKnowledge(${x.id})">Suppr.</button>` },
      ]))).join('')}`;
  },

  async feedback() {
    const d = await api(`/api/hotels/${state.hotelId}/feedback`);
    $('#main').innerHTML = `<div class="page-head"><h2>Avis & plaintes</h2></div>${table(d.feedback, [
      { k: 'id', label: '#' },
      { k: 'customer_id', label: 'Client' },
      { k: 'rating', label: 'Note', render: (x) => x.rating == null ? '—' : '★'.repeat(x.rating) + '☆'.repeat(5 - x.rating) },
      { k: 'comment', label: 'Commentaire', render: (x) => esc(x.comment || '—') },
      { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
      { k: 'created_at', label: 'Date', render: (x) => toDate(x.created_at) },
    ])}`;
  },

  async followups() {
    const d = await api(`/api/hotels/${state.hotelId}/followups`);
    $('#main').innerHTML = `<div class="page-head"><h2>Suivis automatisés</h2></div>${table(d.followups, [
      { k: 'id', label: '#' },
      { k: 'task', label: 'Tâche', render: (x) => esc(x.task) },
      { k: 'due_at', label: 'Échéance', render: (x) => toDateTime(x.due_at) },
      { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
      { k: 'id', label: '', render: (x) => x.status === 'pending' ? `<button class="small" onclick="doneFollowup(${x.id})">Terminer</button>` : '' },
    ])}`;
  },

  async escalations() {
    const d = await api(`/api/hotels/${state.hotelId}/escalations`);
    $('#main').innerHTML = `<div class="page-head"><h2>Escalades humaines</h2></div>${table(d.escalations, [
      { k: 'id', label: '#' },
      { k: 'reason', label: 'Raison', render: (x) => esc(x.reason) },
      { k: 'conversation_id', label: 'Conversation' },
      { k: 'requested_by_guest', label: 'Demande client', render: (x) => x.requested_by_guest ? badge('done') : '—' },
      { k: 'status', label: 'Statut', render: (x) => badge(x.status) },
      { k: 'id', label: '', render: (x) => x.status === 'open' ? `<button class="small" onclick="handleEscalation(${x.id})">Traiter</button>` : '' },
    ])}`;
  },

  async reports() {
    const d = await api(`/api/hotels/${state.hotelId}/reports`);
    $('#main').innerHTML = `
      <div class="page-head"><h2>Rapports — ${toDate(d.period.from)} → ${toDate(d.period.to)}</h2></div>
      <div class="kpis">
        ${kpi(d.reservations, 'Réservations')}
        ${kpi(money(d.revenue), 'Revenu')}
        ${kpi(money(d.avgRate), 'Panier moyen')}
        ${kpi(d.rating == null ? '—' : d.rating.toFixed(1) + ' / 5', 'Note moyenne')}
        ${kpi(d.feedbackCount, 'Avis reçus')}
      </div>
      ${card('Réservations par source', table(d.bySource, [
        { k: 'source', label: 'Source' }, { k: 'count', label: 'Nombre' },
      ]))}
      ${card('Revenu par jour', table(d.revenueByDay.slice(-30), [
        { k: 'date', label: 'Jour' }, { k: 'amount', label: 'Montant', render: (x) => money(x.amount) },
      ]))}
    `;
  },

  async agents() {
    const d = await api(`/api/hotels/${state.hotelId}/agents`);
    $('#main').innerHTML = `
      <div class="page-head"><h2>Agents & outils (gouvernés)</h2></div>
      <div class="kpis">${d.agents.map((a) => `<div class="kpi"><div class="v" style="font-size:14px">${esc(a.id)}</div><div class="l">${esc(a.description.split('.')[0])}</div></div>`).join('')}</div>
      ${card('Outils (12)', table(d.tools, [
        { k: 'name', label: 'Nom', render: (x) => `<code style="color:var(--accent)">${esc(x.name)}</code>` },
        { k: 'permission', label: 'Permission', render: (x) => badge(x.permission) },
        { k: 'summary', label: 'Description', render: (x) => esc(x.summary) },
      ]))}
      ${card('Dernières exécutions', table(d.runs, [
        { k: 'id', label: '#' },
        { k: 'intent', label: 'Intent' },
        { k: 'confidence', label: 'Confiance', render: (x) => Math.round(x.confidence * 100) + '%' },
        { k: 'actions', label: 'Actions', render: (x) => `<code class="mono">${esc(x.actions.slice(0, 120))}</code>` },
        { k: 'latency_ms', label: 'Latence', render: (x) => x.latency_ms + 'ms' },
        { k: 'created_at', label: 'Quand', render: (x) => toDateTime(x.created_at) },
      ]))}
    `;
  },

  async audit() {
    const d = await api(`/api/hotels/${state.hotelId}/audit`);
    $('#main').innerHTML = `<div class="page-head"><h2>Journal d'audit (tenants scope)</h2></div>${table(d.entries, [
      { k: 'id', label: '#' },
      { k: 'actor_type', label: 'Acteur', render: (x) => badge(x.actor_type) },
      { k: 'actor_id', label: 'Identifiant' },
      { k: 'action', label: 'Action', render: (x) => `<code>${esc(x.action)}</code>` },
      { k: 'entity', label: 'Entité', render: (x) => esc(x.entity || '—') },
      { k: 'details', label: 'Détails', render: (x) => esc((x.details || '').slice(0, 90)) },
      { k: 'created_at', label: 'Quand', render: (x) => toDateTime(x.created_at) },
    ])}`;
  },

  async demo() {
    const d = await api('/api/demo/scenarios');
    $('#main').innerHTML = `
      <div class="page-head"><h2>Simulateur démo (offline)</h2></div>
      <div class="toolbox">
        <button class="primary" onclick="runDemo('all')">▶ Tout rejouer</button>
        ${d.scenarios.map((s) => `<button class="ghost" onclick="runDemo('${s}')">${s}</button>`).join('')}
      </div>
      <div id="demo-out"></div>`;
  },

  async settings() {
    const d = await api(`/api/hotels/${state.hotelId}/config`);
    const h = d.hotel;
    $('#main').innerHTML = `
      <div class="page-head"><h2>Paramètres de l'hôtel</h2></div>
      ${card('Informations', `<div class="form-grid">
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
      <div class="toolbox" style="margin-top:14px"><button class="primary" onclick="saveSettings()">Enregistrer</button> <span id="s-saved" class="muted"></span></div>`)}
    `;
  },
};

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

async function send(method, path, body) {
  const d = await api(path, { method, body: body ? JSON.stringify(body) : undefined });
  refresh();
  return d;
}

async function refresh() { await views[state.view](); }
window.refresh = refresh;

window.setResvStatus = (id, status) => send('PATCH', `/api/hotels/${state.hotelId}/reservations/${id}`, { status });
window.setLeadStatus = (id, status) => send('PATCH', `/api/hotels/${state.hotelId}/leads/${id}`, { status });
window.setRoomStatus = (id, status) => send('PATCH', `/api/hotels/${state.hotelId}/rooms/${id}`, { status });
window.toggleRoomMaint = (id, maintenance) => send('PATCH', `/api/hotels/${state.hotelId}/rooms/${id}`, { maintenance });
window.doneFollowup = (id) => send('PATCH', `/api/hotels/${state.hotelId}/followups/${id}`);
window.handleEscalation = (id) => send('PATCH', `/api/hotels/${state.hotelId}/escalations/${id}`);
window.delKnowledge = async (id) => { await send('DELETE', `/api/hotels/${state.hotelId}/knowledge/${id}`); };

window.addKnowledge = async () => {
  await api(`/api/hotels/${state.hotelId}/knowledge`, {
    method: 'POST',
    body: JSON.stringify({
      category: $('#kb-cat').value,
      question: $('#kb-q').value,
      answer: $('#kb-a').value,
      keywords: $('#kb-kw').value,
    }),
  });
  await refresh();
};

window.saveSettings = async () => {
  await api(`/api/hotels/${state.hotelId}/config`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: $('#s-name').value,
      email: $('#s-email').value,
      phone: $('#s-phone').value,
      whatsappPhone: $('#s-wa').value,
      address: $('#s-address').value,
      city: $('#s-city').value,
      currency: $('#s-currency').value,
      checkInTime: $('#s-ci').value,
      checkOutTime: $('#s-co').value,
    }),
  });
  $('#s-saved').textContent = '✓ enregistré';
};

window.openConversation = async (id) => {
  const d = await api(`/api/hotels/${state.hotelId}/conversations/${id}`);
  const msgs = d.messages.map((m) => `
    <div class="msg ${m.sender}"><div class="who">${esc(m.sender)}</div><div class="bubble">${esc(m.body)}</div></div>`).join('');
  const sel = document.createElement('div');
  sel.className = 'panel';
  sel.innerHTML = `<h3>Conversation #${id} — <span class="muted">${toDateTime(d.conversation.last_message_at)}</span></h3>
    <div style="max-height:420px;overflow:auto;margin-bottom:12px">${msgs}</div>
    <div class="flex"><button class="small" onclick="setConvStatus(${id},'resolved')">Marquer résolue</button>
    <button class="small" onclick="setConvStatus(${id},'open')">Rouvrir</button>
    <button class="small" onclick="this.closest('.panel').remove()">Fermer</button></div>`;
  $('#main').prepend(sel);
};
window.setConvStatus = (id, status) => send('PATCH', `/api/hotels/${state.hotelId}/conversations/${id}`, { status });

window.runDemo = async (scenario) => {
  $('#demo-out').innerHTML = '<p class="muted">Exécution…</p>';
  const d = await api('/api/demo/run', { method: 'POST', body: JSON.stringify({ scenario }) });
  $('#demo-out').innerHTML = d.transcript.map((t) => `
    ${card(t.name + ' (' + t.id + ')', t.steps.map((s) => `
      <div class="msg guest"><div class="who">guest</div><div class="bubble">${esc(s.guest)}</div></div>
      <div class="msg ai"><div class="who">ai</div><div class="bubble"><span class="muted">[${esc(s.intent)}·${esc(s.tools.join(',')) || 'none'}]</span>\n${esc(s.reply)}</div></div>`).join(''))}`).join('');
};

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

function toDate(s) { return s ? String(s).slice(0, 10) : '—'; }
function toDateTime(s) { return s ? String(s).slice(0, 16).replace('T', ' ') : '—'; }

async function loadHotels() {
  const d = await api('/api/hotels');
  state.hotels = d.hotels;
  const sel = $('#hotel-select');
  sel.innerHTML = state.hotels.map((h) => `<option value="${h.id}" ${h.id === state.hotelId ? 'selected' : ''}>${esc(h.name)}${h.demo ? ' (demo)' : ''}</option>`).join('');
  if (!state.hotels.some((h) => h.id === state.hotelId)) {
    state.hotelId = state.hotels[0]?.id ?? null;
  }
  sel.onchange = () => {
    state.hotelId = Number(sel.value);
    localStorage.setItem('fd_hotel', String(state.hotelId));
    refresh();
  };
}

async function loginFlow() {
  if (state.token) {
    try {
      await loadHotels();
      showApp();
      return;
    } catch {
      localStorage.removeItem('fd_token');
      state.token = null;
    }
  }
  $('#login-view').classList.remove('hidden');
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  if (state.role === 'staff') $('#hotel-select').setAttribute('disabled', 'disabled');
  const first = $$$('#nav button')[0];
  if (first) first.click();
}

async function logout() {
  localStorage.removeItem('fd_token');
  localStorage.removeItem('fd_role');
  localStorage.removeItem('fd_email');
  state.token = null;
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
}

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
    localStorage.setItem('fd_token', d.token);
    localStorage.setItem('fd_role', d.role);
    localStorage.setItem('fd_email', d.email);
    if (d.hotelId) {
      state.hotelId = d.hotelId;
      localStorage.setItem('fd_hotel', String(d.hotelId));
    }
    await loadHotels();
    showApp();
  } catch (err) {
    alert('Connexion refusée: ' + err.message);
  }
});

$('#logout').addEventListener('click', logout);

$$$('#nav button').forEach((b) => {
  b.addEventListener('click', async () => {
    $$$('#nav button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    state.view = b.dataset.view;
    $('#main').innerHTML = '<p class="muted">Chargement…</p>';
    try {
      await views[state.view]();
    } catch (err) {
      $('#main').innerHTML = `<div class="panel"><h3>Erreur</h3><pre class="dump">${esc(err.message)}</pre></div>`;
    }
  });
});

loginFlow();