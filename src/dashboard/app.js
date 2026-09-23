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
  onboardingStep: 0,
  onboardingData: {},
  testConversationId: null,
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
    confirmed: 'badge-ok', checked_in: 'badge-ok', checked_out: 'badge-ok', active: 'badge-ok',
    requested: 'badge-warn', pending: 'badge-warn', open: 'badge-warn', draft: 'badge-warn',
    cancelled: 'badge-danger', declined: 'badge-danger', lost: 'badge-danger', paused: 'badge-danger',
    escalated: 'badge-danger', maintenance: 'badge-danger',
    done: 'badge-info', handled: 'badge-info', contacted: 'badge-info',
    qualified: 'badge-info', resolved: 'badge-info', converted: 'badge-info',
    clean: 'badge-ok', new: 'badge-accent',
  };
  const cls = map[String(v).toLowerCase()] ?? 'badge-muted';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}

// ─── Onboarding Flow ───────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { key: 'welcome', title: 'Bienvenue', icon: '👋' },
  { key: 'business_info', title: 'Informations entreprise', icon: '🏨' },
  { key: 'employee_identity', title: 'Votre Employé IA', icon: '👩‍💼' },
  { key: 'services', title: 'Services & Tarifs', icon: '🛎️' },
  { key: 'policies', title: 'Règles & Politiques', icon: '📋' },
  { key: 'knowledge', title: 'FAQ & Connaissances', icon: '💡' },
  { key: 'escalation', title: 'Escalade humain', icon: '🤝' },
  { key: 'test', title: 'Tester votre Employé', icon: '🧪' },
  { key: 'activate', title: 'Activer', icon: '🚀' },
];

function openOnboarding() {
  state.onboardingStep = 0;
  state.onboardingData = {};
  $('#onboarding-modal').classList.remove('hidden');
  renderOnboardingStep();
}

function closeOnboarding() {
  $('#onboarding-modal').classList.add('hidden');
}

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[state.onboardingStep];
  const progress = ((state.onboardingStep + 1) / ONBOARDING_STEPS.length) * 100;
  $('#ob-progress').style.width = `${progress}%`;
  $('#ob-prev').style.visibility = state.onboardingStep === 0 ? 'hidden' : 'visible';
  $('#ob-next').textContent = state.onboardingStep === ONBOARDING_STEPS.length - 1 ? 'Activer' : 'Continuer';

  const c = $('#ob-content');
  switch (step.key) {
    case 'welcome':
      c.innerHTML = `
        <div class="ob-hero">
          <div class="ob-hero-icon">👩‍💼</div>
          <h3>Créez votre Employé IA</h3>
          <p>En quelques minutes, configurez un employé numérique qui répond aux clients 24h/24, gère les réservations, et capture des prospects.</p>
          <div class="ob-features">
            <div class="ob-feature"><span>💬</span>Répond aux clients en français et anglais</div>
            <div class="ob-feature"><span>📅</span>Gère les réservations automatiquement</div>
            <div class="ob-feature"><span>🎯</span>Capture et qualifie les prospects</div>
            <div class="ob-feature"><span>🤝</span>Escalade quand il faut</div>
          </div>
        </div>`;
      break;
    case 'business_info':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Parlez-nous de votre entreprise</h3>
          <div class="field"><label>Nom de l'établissement *</label><input id="ob-hotel-name" value="${esc(state.onboardingData.hotelName || '')}" placeholder="Hôtel La Paix" /></div>
          <div class="field"><label>Ville *</label><input id="ob-hotel-city" value="${esc(state.onboardingData.city || '')}" placeholder="Yaoundé" /></div>
          <div class="field"><label>Téléphone</label><input id="ob-hotel-phone" value="${esc(state.onboardingData.phone || '')}" placeholder="+237 671 000 111" /></div>
          <div class="field"><label>Email</label><input id="ob-hotel-email" value="${esc(state.onboardingData.email || '')}" placeholder="contact@hotel.com" /></div>
          <div class="field"><label>Adresse</label><input id="ob-hotel-address" value="${esc(state.onboardingData.address || '')}" placeholder="Avenue de la République" /></div>
          <div class="form-grid">
            <div class="field"><label>Heure check-in</label><input id="ob-hotel-ci" type="time" value="${esc(state.onboardingData.checkIn || '14:00')}" /></div>
            <div class="field"><label>Heure check-out</label><input id="ob-hotel-co" type="time" value="${esc(state.onboardingData.checkOut || '12:00')}" /></div>
          </div>
        </div>`;
      break;
    case 'employee_identity':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Identité de votre Employé IA</h3>
          <div class="field"><label>Nom de l'employé *</label><input id="ob-emp-name" value="${esc(state.onboardingData.empName || 'Sarah')}" placeholder="Sarah" /></div>
          <div class="field"><label>Rôle</label>
            <select id="ob-emp-role">
              <option ${state.onboardingData.empRole === 'Réceptionniste' ? 'selected' : ''}>Réceptionniste</option>
              <option ${state.onboardingData.empRole === 'Assistant de direction' ? 'selected' : ''}>Assistant de direction</option>
              <option ${state.onboardingData.empRole === 'Concierge' ? 'selected' : ''}>Concierge</option>
              <option ${state.onboardingData.empRole === 'Service client' ? 'selected' : ''}>Service client</option>
            </select>
          </div>
          <div class="field"><label>Personnalité</label>
            <select id="ob-emp-personality">
              <option ${state.onboardingData.personality === 'professional_friendly' ? 'selected' : ''}>Professionnel et chaleureux</option>
              <option ${state.onboardingData.personality === 'formal_elegant' ? 'selected' : ''}>Formel et élégant</option>
              <option ${state.onboardingData.personality === 'casual_helpful' ? 'selected' : ''}>Décontracté et serviable</option>
            </select>
          </div>
          <div class="field"><label>Langues</label>
            <div class="checkbox-group">
              <label class="checkbox-label"><input type="checkbox" id="ob-lang-fr" checked /> Français</label>
              <label class="checkbox-label"><input type="checkbox" id="ob-lang-en" checked /> English</label>
            </div>
          </div>
          <div class="field"><label>Emoji représentant</label>
            <div class="emoji-picker">
              ${['👩‍💼','👨‍💼','🤖','💁‍♀️','💁‍♂️','🧑‍💼'].map(e => `<button class="emoji-btn ${state.onboardingData.emoji === e ? 'selected' : ''}" onclick="document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('ob-emp-emoji').value='${e}'">${e}</button>`).join('')}
            </div>
            <input type="hidden" id="ob-emp-emoji" value="${state.onboardingData.emoji || '👩‍💼'}" />
          </div>
        </div>`;
      break;
    case 'services':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Vos services et tarifs</h3>
          <p class="muted" style="margin-bottom:12px">Ajoutez les services que votre employé IA doit connaître</p>
          <div id="ob-services-list">
            ${(state.onboardingData.services || []).map((s, i) => `
              <div class="service-row">
                <input type="text" value="${esc(s.name)}" placeholder="Nom du service" />
                <input type="number" value="${esc(s.price || '')}" placeholder="Prix" style="width:120px" />
                <button class="btn-ghost btn-sm" onclick="state.onboardingData.services.splice(${i},1);renderOnboardingStep()">✕</button>
              </div>
            `).join('') || '<p class="muted">Aucun service ajouté</p>'}
          </div>
          <button class="btn-secondary btn-sm" onclick="if(!state.onboardingData.services) state.onboardingData.services=[]; state.onboardingData.services.push({name:'',price:''}); renderOnboardingStep()">+ Ajouter un service</button>
        </div>`;
      break;
    case 'policies':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Règles et politiques</h3>
          <p class="muted" style="margin-bottom:12px">Définissez les règles que votre employé IA doit respecter</p>
          <div id="ob-policies-list">
            ${(state.onboardingData.policies || []).map((p, i) => `
              <div class="policy-row">
                <input type="text" value="${esc(p.title)}" placeholder="Titre (ex: Annulation)" />
                <textarea placeholder="Contenu de la politique..." rows="2">${esc(p.content)}</textarea>
                <button class="btn-ghost btn-sm" onclick="state.onboardingData.policies.splice(${i},1);renderOnboardingStep()">✕</button>
              </div>
            `).join('') || '<p class="muted">Aucune politique ajoutée</p>'}
          </div>
          <button class="btn-secondary btn-sm" onclick="if(!state.onboardingData.policies) state.onboardingData.policies=[]; state.onboardingData.policies.push({title:'',content:''}); renderOnboardingStep()">+ Ajouter une politique</button>
        </div>`;
      break;
    case 'knowledge':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Questions fréquentes (FAQ)</h3>
          <p class="muted" style="margin-bottom:12px">Ajoutez les questions que les clients posent souvent</p>
          <div id="ob-kb-list">
            ${(state.onboardingData.kb || []).map((k, i) => `
              <div class="kb-row">
                <input type="text" value="${esc(k.question)}" placeholder="Question (ex: Le WiFi est-il gratuit ?)" />
                <textarea placeholder="Réponse..." rows="2">${esc(k.answer)}</textarea>
                <button class="btn-ghost btn-sm" onclick="state.onboardingData.kb.splice(${i},1);renderOnboardingStep()">✕</button>
              </div>
            `).join('') || '<p class="muted">Aucune question ajoutée</p>'}
          </div>
          <button class="btn-secondary btn-sm" onclick="if(!state.onboardingData.kb) state.onboardingData.kb=[]; state.onboardingData.kb.push({question:'',answer:''}); renderOnboardingStep()">+ Ajouter une FAQ</button>
        </div>`;
      break;
    case 'escalation':
      c.innerHTML = `
        <div class="ob-form">
          <h3>Quand passer la main ?</h3>
          <p class="muted" style="margin-bottom:12px">Configurez quand votre employé IA doit demander l'aide d'un humain</p>
          <div class="field"><label>Conditions d'escalade</label>
            <div class="checkbox-group">
              <label class="checkbox-label"><input type="checkbox" checked /> Client demande un humain</label>
              <label class="checkbox-label"><input type="checkbox" checked /> Réclamation ou problème</label>
              <label class="checkbox-label"><input type="checkbox" checked /> Demande hors compétences</label>
              <label class="checkbox-label"><input type="checkbox" /> Après 3 erreurs</label>
            </div>
          </div>
          <div class="field"><label>Message d'escalade</label>
            <textarea id="ob-esc-msg" rows="3" placeholder="Message quand l'IA passe la main...">Je vais vous transférer à un collègue qui pourra mieux vous aider.</textarea>
          </div>
        </div>`;
      break;
    case 'test':
      c.innerHTML = `
        <div class="ob-test">
          <h3>Testez avant d'activer</h3>
          <p class="muted">Votre employé IA est prêt ! Testez-le avec quelques questions types.</p>
          <div class="test-suggestions">
            <button class="btn-secondary btn-sm" onclick="runTestQuestion('Avez-vous une chambre pour ce soir ?')">Chambre disponible</button>
            <button class="btn-secondary btn-sm" onclick="runTestQuestion('Quel est le prix d\\'une chambre ?')">Prix chambre</button>
            <button class="btn-secondary btn-sm" onclick="runTestQuestion('Le petit-déjeuner est-il inclus ?')">Petit-déjeuner</button>
            <button class="btn-secondary btn-sm" onclick="runTestQuestion('Je voudrais parler à un humain')">Escalade</button>
          </div>
          <div id="test-preview" class="test-preview"></div>
        </div>`;
      break;
    case 'activate':
      c.innerHTML = `
        <div class="ob-hero">
          <div class="ob-hero-icon">🚀</div>
          <h3>Pras à activer !</h3>
          <p>Votre employé IA <strong>${esc(state.onboardingData.empName || 'Sarah')}</strong> est configuré et prêt à travailler.</p>
          <div class="ob-summary">
            <div class="ob-summary-item"><span>🏨</span>${esc(state.onboardingData.hotelName || 'Hôtel')}</div>
            <div class="ob-summary-item"><span>👩‍💼</span>${esc(state.onboardingData.empName || 'Sarah')} — ${esc(state.onboardingData.empRole || 'Réceptionniste')}</div>
            <div class="ob-summary-item"><span>🛎️</span>${(state.onboardingData.services || []).length} services configurés</div>
            <div class="ob-summary-item"><span>📋</span>${(state.onboardingData.policies || []).length} politiques</div>
            <div class="ob-summary-item"><span>💡</span>${(state.onboardingData.kb || {}).length || 0} FAQ</div>
          </div>
          <button class="btn-primary btn-full" onclick="activateEmployee()">Activer ${esc(state.onboardingData.empName || 'Sarah')}</button>
        </div>`;
      break;
  }
}

async function obNext() {
  const step = ONBOARDING_STEPS[state.onboardingStep];
  saveOnboardingData(step.key);
  if (state.onboardingStep < ONBOARDING_STEPS.length - 1) {
    state.onboardingStep++;
    renderOnboardingStep();
  }
}

function obPrev() {
  const step = ONBOARDING_STEPS[state.onboardingStep];
  saveOnboardingData(step.key);
  if (state.onboardingStep > 0) {
    state.onboardingStep--;
    renderOnboardingStep();
  }
}

function saveOnboardingData(key) {
  switch (key) {
    case 'business_info':
      state.onboardingData.hotelName = $('#ob-hotel-name')?.value;
      state.onboardingData.city = $('#ob-hotel-city')?.value;
      state.onboardingData.phone = $('#ob-hotel-phone')?.value;
      state.onboardingData.email = $('#ob-hotel-email')?.value;
      state.onboardingData.address = $('#ob-hotel-address')?.value;
      state.onboardingData.checkIn = $('#ob-hotel-ci')?.value;
      state.onboardingData.checkOut = $('#ob-hotel-co')?.value;
      break;
    case 'employee_identity':
      state.onboardingData.empName = $('#ob-emp-name')?.value;
      state.onboardingData.empRole = $('#ob-emp-role')?.value;
      state.onboardingData.personality = $('#ob-emp-personality')?.value;
      state.onboardingData.emoji = $('#ob-emp-emoji')?.value;
      break;
    case 'escalation':
      state.onboardingData.escMessage = $('#ob-esc-msg')?.value;
      break;
  }
}

async function activateEmployee() {
  try {
    // Update hotel info
    await api(`/api/hotels/${state.hotelId}/config`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: state.onboardingData.hotelName,
        city: state.onboardingData.city,
        phone: state.onboardingData.phone,
        email: state.onboardingData.email,
        address: state.onboardingData.address,
        checkInTime: state.onboardingData.checkIn,
        checkOutTime: state.onboardingData.checkOut,
      }),
    });
    // Update employee profile
    await api(`/api/hotels/${state.hotelId}/employee`, {
      method: 'PUT',
      body: JSON.stringify({
        name: state.onboardingData.empName,
        role: state.onboardingData.empRole,
        personality: state.onboardingData.personality,
        avatar_emoji: state.onboardingData.emoji,
        status: 'active',
        onboarding_completed: 1,
      }),
    });
    // Add services
    for (const s of (state.onboardingData.services || [])) {
      if (s.name) await api(`/api/hotels/${state.hotelId}/services`, { method: 'POST', body: JSON.stringify(s) });
    }
    // Add policies
    for (const p of (state.onboardingData.policies || [])) {
      if (p.title) await api(`/api/hotels/${state.hotelId}/policies`, { method: 'POST', body: JSON.stringify({ policy_type: 'general', ...p }) });
    }
    // Add knowledge
    for (const k of (state.onboardingData.kb || [])) {
      if (k.question && k.answer) await api(`/api/hotels/${state.hotelId}/knowledge`, { method: 'POST', body: JSON.stringify({ category: 'faq', ...k }) });
    }
    closeOnboarding();
    showToast(`${state.onboardingData.empName} est maintenant actif !`, 'success');
    views.employee();
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
  }
}

async function runTestQuestion(text) {
  try {
    const d = await api(`/api/hotels/${state.hotelId}/test-employee`, { method: 'POST', body: JSON.stringify({ text }) });
    const preview = $('#test-preview');
    preview.innerHTML += `
      <div class="test-msg test-msg-user">${esc(text)}</div>
      <div class="test-msg test-msg-ai"><strong>${esc(state.onboardingData.empName || 'IA')}:</strong> ${esc(d.reply)}</div>
    `;
    preview.scrollTop = preview.scrollHeight;
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
  }
}

// ─── Employee Test Chat ────────────────────────────────────────────────────

function openTestEmployee() {
  $('#test-modal').classList.remove('hidden');
  $('#test-chat').innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-avatar">👩‍💼</div>
      <div>Je suis <strong>${esc(state.onboardingData.empName || 'Sarah')}</strong>, votre ${esc(state.onboardingData.empRole || 'réceptionniste')}. Comment puis-je vous aider ?</div>
    </div>
  `;
}

function closeTest() {
  $('#test-modal').classList.add('hidden');
}

async function sendTest() {
  const input = $('#test-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const chat = $('#test-chat');
  chat.innerHTML += `<div class="chat-msg chat-msg-user">${esc(text)}</div>`;
  chat.innerHTML += `<div class="chat-msg chat-msg-ai typing"><span></span><span></span><span></span></div>`;
  chat.scrollTop = chat.scrollHeight;
  try {
    const d = await api(`/api/hotels/${state.hotelId}/test-employee`, { method: 'POST', body: JSON.stringify({ text }) });
    chat.querySelector('.typing')?.remove();
    chat.innerHTML += `<div class="chat-msg chat-msg-ai">${esc(d.reply)}</div>`;
  } catch (err) {
    chat.querySelector('.typing')?.remove();
    chat.innerHTML += `<div class="chat-msg chat-msg-ai">Erreur: ${esc(err.message)}</div>`;
  }
  chat.scrollTop = chat.scrollHeight;
}

// ─── Employee View ─────────────────────────────────────────────────────────

async function loadEmployeeProfile() {
  const d = await api(`/api/hotels/${state.hotelId}/employee`);
  const p = d.profile;
  const checklist = d.checklist;
  if (!p) return null;
  return { p, checklist };
}

// ─── Views ─────────────────────────────────────────────────────────────────

const views = {

  async overview() {
    const d = await api(`/api/hotels/${state.hotelId}/overview`);
    const o = d.occupancy, r = d.revenue, k = d.kpis;
    $('#page-title').textContent = 'Accueil';
    $('#main').innerHTML = `
      <div class="ai-employee-card anim-slide">
        <div class="ai-employee-header">
          <div class="ai-avatar">👩‍💼</div>
          <div class="ai-employee-info">
            <h3>Sarah <span class="status-dot online"></span></h3>
            <div class="role">Réceptionniste IA · ${esc(d.hotel.name)}</div>
          </div>
          <div style="margin-left:auto"><span class="badge badge-ok">En ligne</span></div>
        </div>
        <div class="ai-employee-stats">
          <div class="ai-employee-stat"><div class="val">${k.conversations}</div><div class="lbl">Conversations</div></div>
          <div class="ai-employee-stat"><div class="val">${k.leadsNew}</div><div class="lbl">Nouveaux prospects</div></div>
          <div class="ai-employee-stat"><div class="val">${k.feedbackNew}</div><div class="lbl">Avis à traiter</div></div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${o.inHouse}</div><div class="stat-label">En maison</div></div>
        <div class="stat-card"><div class="stat-value">${o.arrivals}</div><div class="stat-label">Arrivées</div></div>
        <div class="stat-card"><div class="stat-value">${o.departures}</div><div class="stat-label">Départs</div></div>
        <div class="stat-card"><div class="stat-value">${o.occupancyPct}%</div><div class="stat-label">Occupation</div></div>
        <div class="stat-card"><div class="stat-value">${money(r.next7d)}</div><div class="stat-label">CA 7 jours</div></div>
        <div class="stat-card"><div class="stat-value">${k.rating == null ? '—' : k.rating.toFixed(1)}/5</div><div class="stat-label">Note</div></div>
      </div>
      <div class="card anim-fade">
        <div class="card-header"><div><div class="card-title">Activité récente</div><div class="card-subtitle">Dernières actions de Sarah</div></div><button class="btn-ghost btn-sm" onclick="refresh()">↻</button></div>
        <div class="activity-feed">${await renderActivity(d.hotel.id)}</div>
      </div>
      <div class="card anim-fade" style="animation-delay:100ms">
        <div class="card-header"><div class="card-title">Actions rapides</div></div>
        <div class="toolbar">
          <button class="btn-primary" onclick="openOnboarding()">⚙️ Configurer l'employé IA</button>
          <button class="btn-secondary" onclick="document.querySelector('[data-view=conversations]').click()">💬 Voir les conversations</button>
        </div>
      </div>
    `;
  },

  async employee() {
    $('#page-title').textContent = 'Mon Employé IA';
    const data = await loadEmployeeProfile();
    if (!data) {
      $('#main').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">👩‍💼</div>
            <h3>Aucun employé IA configuré</h3>
            <p>Configurez votre employé IA pour commencer à servir vos clients automatiquement.</p>
            <button class="btn-primary" onclick="openOnboarding()">Configurer maintenant</button>
          </div>
        </div>`;
      return;
    }
    const p = data.p, cl = data.checklist;
    const completedSteps = cl.filter(c => c.completed).length;
    const totalSteps = cl.length;
    const pct = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const statusLabel = p.status === 'active' ? 'En ligne' : p.status === 'paused' ? 'En pause' : 'Brouillon';
    const statusClass = p.status === 'active' ? 'online' : p.status === 'paused' ? 'paused' : 'offline';

    $('#main').innerHTML = `
      <div class="employee-profile anim-slide">
        <div class="employee-profile-header">
          <div class="employee-avatar">${esc(p.avatar_emoji)}</div>
          <div class="employee-profile-info">
            <h2>${esc(p.name)} <span class="status-dot ${statusClass}"></span></h2>
            <div class="employee-role">${esc(p.role)} · ${esc(statusLabel)}</div>
            <div class="employee-progress">
              <div class="employee-progress-bar"><div style="width:${pct}%"></div></div>
              <span class="muted" style="font-size:12px">${completedSteps}/${totalSteps} étapes</span>
            </div>
          </div>
        </div>
        <div class="employee-actions">
          <button class="btn-primary" onclick="openTestEmployee()">💬 Tester</button>
          <button class="btn-secondary" onclick="openOnboarding()">⚙️ Modifier</button>
          <button class="btn-ghost" onclick="toggleEmployeeStatus()">⏸️ ${p.status === 'active' ? 'Pause' : 'Activer'}</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">47</div><div class="stat-label">Conversations aujourd'hui</div></div>
        <div class="stat-card"><div class="stat-value">12</div><div class="stat-label">Leads capturés</div></div>
        <div class="stat-card"><div class="stat-value">3</div><div class="stat-label">Escalades</div></div>
        <div class="stat-card"><div class="stat-value">98%</div><div class="stat-label">Taux de réponse</div></div>
      </div>

      <div class="card anim-fade">
        <div class="card-header"><div class="card-title">Capacités</div><div class="card-subtitle">Ce que ${esc(p.name)} sait faire</div></div>
        <div class="capabilities-grid">
          <div class="capability"><span>📅</span><div class="capability-info"><strong>Réservations</strong><span class="muted">Disponibilités, tarifs, confirmation</span></div></div>
          <div class="capability"><span>💬</span><div class="capability-info"><strong>Conversations</strong><span class="muted">FR/EN, chaleureux</span></div></div>
          <div class="capability"><span>🎯</span><div class="capability-info"><strong>Prospects</strong><span class="muted">Capture, qualification</span></div></div>
          <div class="capability"><span>🤝</span><div class="capability-info"><strong>Escalade</strong><span class="muted">${p.escalation_trigger === 'guest_request' ? 'Sur demande client' : p.escalation_trigger}</span></div></div>
        </div>
      </div>

      <div class="card anim-fade">
        <div class="card-header"><div class="card-title">Progression de la configuration</div></div>
        <div class="checklist">
          ${cl.map(c => `
            <div class="checklist-item ${c.completed ? 'done' : ''}">
              <div class="checklist-icon">${c.completed ? '✓' : '○'}</div>
              <div class="checklist-label">${esc(c.step_name)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card anim-fade">
        <div class="card-header"><div class="card-title">Activité en temps réel</div></div>
        <div class="activity-feed">${await renderActivity(state.hotelId)}</div>
      </div>
    `;
  },

  async conversations() {
    $('#page-title').textContent = 'Conversations';
    const d = await api(`/api/hotels/${state.hotelId}/conversations`);
    if (!d.conversations.length) {
      $('#main').innerHTML = renderEmptyState('Aucune conversation', 'Quand un client parle avec votre employé IA, les conversations apparaîtront ici.', 'message');
      return;
    }
    $('#main').innerHTML = `
      <div class="page-header"><h2>Conversations</h2></div>
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
      <div class="page-header"><h2>Prospects</h2><span class="badge badge-accent">${d.leads.filter(l => l.status === 'new').length} nouveaux</span></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nom</th><th>Contact</th><th>Intention</th><th>Statut</th><th>Date</th><th></th></tr></thead>
        <tbody>
          ${d.leads.length ? d.leads.map(l => `
            <tr>
              <td><strong>${esc(l.name || '—')}</strong></td>
              <td>${esc(l.phone || l.email || '—')}</td>
              <td><span class="text-2">${esc(l.intent || '—')}</span></td>
              <td>${badge(l.status)}</td>
              <td class="muted">${toDate(l.created_at)}</td>
              <td><select onchange="api('/api/hotels/${state.hotelId}/leads/${l.id}',{method:'PATCH',body:JSON.stringify({status:this.value})}).then(()=>{showToast('Statut mis à jour','success');refresh()})" style="padding:4px 8px;font-size:12px">${['new','contacted','qualified','converted','lost'].map(s => `<option value="${s}" ${s===l.status?'selected':''}>${s}</option>`).join('')}</select></td>
            </tr>
          `).join('') : '<tr><td colspan="6"><div class="empty-state"><p>Aucun prospect</p></div></td></tr>'}
        </tbody>
      </table></div></div>
    `;
  },

  async bookings() {
    $('#page-title').textContent = 'Réservations';
    const d = await api(`/api/hotels/${state.hotelId}/reservations`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Réservations</h2></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='confirmed').length}</div><div class="stat-label">Confirmées</div></div>
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='requested').length}</div><div class="stat-label">En attente</div></div>
        <div class="stat-card"><div class="stat-value">${d.reservations.filter(r=>r.status==='cancelled').length}</div><div class="stat-label">Annulées</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Client</th><th>Arrivée</th><th>Départ</th><th>Personnes</th><th>Total</th><th>Statut</th></tr></thead>
        <tbody>
          ${d.reservations.length ? d.reservations.map(r => `
            <tr><td class="muted">#${r.id}</td><td>${esc(r.customer_id || '—')}</td><td>${toDate(r.check_in)}</td><td>${toDate(r.check_out)}</td><td>${r.guests}</td><td><strong>${money(r.total_amount)}</strong></td><td>${badge(r.status)}</td>
          `).join('') : '<tr><td colspan="7"><div class="empty-state"><p>Aucune réservation</p></div></td></tr>'}
        </tbody>
      </table></div></div>
    `;
  },

  async customers() {
    $('#page-title').textContent = 'Clients';
    const d = await api(`/api/hotels/${state.hotelId}/customers`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Clients</h2></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Langue</th><th>Source</th></tr></thead>
        <tbody>
          ${d.customers.length ? d.customers.map(c => `
            <tr><td><strong>${esc(c.name || 'Anonyme')}</strong></td><td>${esc(c.phone || '—')}</td><td class="muted">${esc(c.email || '—')}</td><td><span class="badge badge-muted">${esc(c.language || 'fr')}</span></td><td>${esc(c.source || '—')}</td>
          `).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Aucun client</p></div></td></tr>'}
        </tbody>
      </table></div></div>
    `;
  },

  async knowledge() {
    $('#page-title').textContent = 'Connaissances';
    const d = await api(`/api/hotels/${state.hotelId}/knowledge`);
    const byCat = {};
    for (const it of d.items) (byCat[it.category] ??= []).push(it);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Connaissances</h2></div>
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
          <div class="table-wrap"><table>
            <thead><tr><th>Question</th><th>Réponse</th><th>Mots-clés</th><th></th></tr></thead>
            <tbody>
              ${items.map(i => `
                <tr><td>${esc(i.question || '—')}</td><td>${esc(i.answer)}</td><td class="muted">${esc(i.keywords || '')}</td><td><button class="btn-ghost btn-sm" onclick="delKnowledge(${i.id})">✕</button></td>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `).join('')}
    `;
  },

  async services() {
    $('#page-title').textContent = 'Services';
    const d = await api(`/api/hotels/${state.hotelId}/services`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Services & Tarifs</h2></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Ajouter un service</div></div>
        <div class="form-grid">
          <div class="field"><label>Nom</label><input id="svc-name" placeholder="Petit-déjeuner" /></div>
          <div class="field"><label>Prix</label><input id="svc-price" type="number" placeholder="5000" /></div>
          <div class="field"><label>Catégorie</label><input id="svc-cat" placeholder="Restauration" /></div>
          <div class="field"><label>Unité</label><input id="svc-unit" value="par_personne" /></div>
        </div>
        <div style="margin-top:12px"><button class="btn-primary" onclick="addService()">Ajouter</button></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Services configurés</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Service</th><th>Prix</th><th>Catégorie</th><th></th></tr></thead>
          <tbody>
            ${d.services.length ? d.services.map(s => `
              <tr><td><strong>${esc(s.name)}</strong></td><td>${s.price ? money(s.price) : '—'}</td><td>${esc(s.category)}</td><td><button class="btn-ghost btn-sm" onclick="delService(${s.id})">✕</button></td>
            `).join('') : '<tr><td colspan="4"><div class="empty-state"><p>Aucun service</p></div></td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
  },

  async policies() {
    $('#page-title').textContent = 'Politiques';
    const d = await api(`/api/hotels/${state.hotelId}/policies`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Règles & Politiques</h2></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Ajouter une politique</div></div>
        <div class="form-grid">
          <div class="field"><label>Type</label><input id="pol-type" placeholder="Annulation" /></div>
          <div class="field"><label>Titre</label><input id="pol-title" placeholder="Politique d'annulation" /></div>
          <div class="field" style="grid-column:1/-1"><label>Contenu</label><textarea id="pol-content" rows="3" placeholder="Détails de la politique..."></textarea></div>
        </div>
        <div style="margin-top:12px"><button class="btn-primary" onclick="addPolicy()">Ajouter</button></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Politiques actives</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Type</th><th>Titre</th><th>Contenu</th><th></th></tr></thead>
          <tbody>
            ${d.policies.length ? d.policies.map(p => `
              <tr><td>${esc(p.policy_type)}</td><td><strong>${esc(p.title)}</strong></td><td class="muted">${esc(p.content.slice(0,80))}</td><td><button class="btn-ghost btn-sm" onclick="delPolicy(${p.id})">✕</button></td>
            `).join('') : '<tr><td colspan="4"><div class="empty-state"><p>Aucune politique</p></div></td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
  },

  async feedback() {
    $('#page-title').textContent = 'Avis';
    const d = await api(`/api/hotels/${state.hotelId}/feedback`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Avis clients</h2></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Note</th><th>Commentaire</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>
          ${d.feedback.length ? d.feedback.map(f => `
            <tr><td>#${f.customer_id || '—'}</td><td>${f.rating != null ? '★'.repeat(f.rating) + '<span class="muted">★</span>'.repeat(5-f.rating) : '—'}</td><td>${esc(f.comment || '—')}</td><td>${badge(f.status)}</td><td class="muted">${toDate(f.created_at)}</td>
          `).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Aucun avis</p></div></td></tr>'}
        </tbody>
      </table></div></div>
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
          <div class="field"><label>WhatsApp</label><input id="s-wa" value="${esc(h.whatsapp_phone)}" /></div>
          <div class="field"><label>Adresse</label><input id="s-address" value="${esc(h.address)}" /></div>
          <div class="field"><label>Ville</label><input id="s-city" value="${esc(h.city)}" /></div>
          <div class="field"><label>Devise</label><input id="s-currency" value="${esc(h.currency)}" /></div>
          <div class="field"><label>Check-in</label><input id="s-ci" value="${esc(h.check_in_time)}" /></div>
          <div class="field"><label>Check-out</label><input id="s-co" value="${esc(h.check_out_time)}" /></div>
        </div>
        <div style="margin-top:16px"><button class="btn-primary" onclick="saveSettings()">Enregistrer</button></div>
      </div>
    `;
  },

  async followups() {
    $('#page-title').textContent = 'Suivis';
    const d = await api(`/api/hotels/${state.hotelId}/followups`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Suivis automatisés</h2></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Tâche</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${d.followups.length ? d.followups.map(f => `
            <tr><td>${esc(f.task)}</td><td class="muted">${toDateTime(f.due_at)}</td><td>${badge(f.status)}</td><td>${f.status === 'pending' ? `<button class="btn-ghost btn-sm" onclick="doneFollowup(${f.id})">Terminer</button>` : ''}</td>
          `).join('') : '<tr><td colspan="4"><div class="empty-state"><p>Aucun suivi</p></div></td></tr>'}
        </tbody>
      </table></div></div>
    `;
  },

  async escalations() {
    $('#page-title').textContent = 'Escalades';
    const d = await api(`/api/hotels/${state.hotelId}/escalations`);
    $('#main').innerHTML = `
      <div class="page-header"><h2>Escalades humaines</h2></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Raison</th><th>Demandée par client</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${d.escalations.length ? d.escalations.map(e => `
            <tr><td class="muted">#${e.id}</td><td>${esc(e.reason)}</td><td>${e.requested_by_guest ? badge('Oui') : '—'}</td><td>${badge(e.status)}</td><td>${e.status === 'open' ? `<button class="btn-ghost btn-sm" onclick="handleEscalation(${e.id})">Traiter</button>` : ''}</td>
          `).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Aucune escalade</p></div></td></tr>'}
        </tbody>
      </table></div></div>
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
      <div class="card"><div class="card-header"><div class="card-title">Par source</div></div>
        <div class="table-wrap"><table><thead><tr><th>Source</th><th>Nombre</th></tr></thead><tbody>
          ${d.bySource.map(s => `<tr><td>${esc(s.source)}</td><td>${s.count}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    `;
  },
};

// ─── Activity Feed ─────────────────────────────────────────────────────────

async function renderActivity(hotelId) {
  try {
    const convs = await api(`/api/hotels/${hotelId}/conversations`);
    const recent = convs.conversations.slice(0, 8);
    if (!recent.length) return `<div class="empty-state"><p>Aucune activité récente</p><p class="muted">Votre employé IA attend des messages</p></div>`;
    return recent.map((c) => `
      <div class="activity-item anim-fade">
        <div class="activity-icon message">💬</div>
        <div class="activity-body">
          <div class="activity-title">Nouveau message ${c.channel === 'whatsapp' ? 'WhatsApp' : 'web'}</div>
          <div class="activity-meta">Conversation #${c.id} · ${esc(c.intent_last || 'greeting')} · ${timeAgo(c.last_message_at)}</div>
        </div>
        <span class="badge ${c.status === 'open' ? 'badge-accent' : c.status === 'escalated' ? 'badge-danger' : 'badge-muted'}">${esc(c.status)}</span>
      </div>
    `).join('');
  } catch {
    return '<p class="muted">Impossible de charger l\'activité</p>';
  }
}

// ─── Employee Status Toggle ────────────────────────────────────────────────

async function toggleEmployeeStatus() {
  const data = await loadEmployeeProfile();
  if (!data) return;
  const newStatus = data.p.status === 'active' ? 'paused' : 'active';
  await api(`/api/hotels/${state.hotelId}/employee`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
  showToast(newStatus === 'active' ? 'Employé IA activé' : 'Employé IA mis en pause', 'success');
  refresh();
}

// ─── Action Helpers ────────────────────────────────────────────────────────

async function addKnowledge() {
  const body = { category: $('#kb-cat').value, question: $('#kb-q').value, answer: $('#kb-a').value, keywords: $('#kb-kw').value };
  await api(`/api/hotels/${state.hotelId}/knowledge`, { method: 'POST', body: JSON.stringify(body) });
  showToast('Entrée ajoutée', 'success');
  refresh();
}

async function delKnowledge(id) {
  await api(`/api/hotels/${state.hotelId}/knowledge/${id}`, { method: 'DELETE' });
  showToast('Supprimé', 'info');
  refresh();
}

async function addService() {
  const body = { name: $('#svc-name').value, price: Number($('#svc-price').value) || null, category: $('#svc-cat').value, price_unit: $('#svc-unit').value };
  await api(`/api/hotels/${state.hotelId}/services`, { method: 'POST', body: JSON.stringify(body) });
  showToast('Service ajouté', 'success');
  refresh();
}

async function delService(id) {
  await api(`/api/hotels/${state.hotelId}/services/${id}`, { method: 'DELETE' });
  showToast('Supprimé', 'info');
  refresh();
}

async function addPolicy() {
  const body = { policy_type: $('#pol-type').value, title: $('#pol-title').value, content: $('#pol-content').value };
  await api(`/api/hotels/${state.hotelId}/policies`, { method: 'POST', body: JSON.stringify(body) });
  showToast('Politique ajoutée', 'success');
  refresh();
}

async function delPolicy(id) {
  await api(`/api/hotels/${state.hotelId}/policies/${id}`, { method: 'DELETE' });
  showToast('Supprimée', 'info');
  refresh();
}

async function saveSettings() {
  await api(`/api/hotels/${state.hotelId}/config`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: $('#s-name').value, email: $('#s-email').value, phone: $('#s-phone').value,
      whatsappPhone: $('#s-wa').value, address: $('#s-address').value, city: $('#s-city').value,
      currency: $('#s-currency').value, checkInTime: $('#s-ci').value, checkOutTime: $('#s-co').value,
    }),
  });
  showToast('Paramètres enregistrés', 'success');
}

async function doneFollowup(id) {
  await api(`/api/hotels/${state.hotelId}/followups/${id}`, { method: 'PATCH' });
  showToast('Suivi terminé', 'success');
  refresh();
}

async function handleEscalation(id) {
  await api(`/api/hotels/${state.hotelId}/escalations/${id}`, { method: 'PATCH' });
  showToast('Escalade traitée', 'success');
  refresh();
}

function openConversation(id) {
  showToast(`Conversation #${id}`, 'info');
}

function renderEmptyState(title, desc, icon) {
  return `<div class="empty-state anim-fade"><div class="empty-icon">${icon === 'message' ? '💬' : '📭'}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}

async function refresh() {
  try { await views[state.view](); }
  catch (err) { showToast(err.message, 'error'); }
}

// ─── Boot ──────────────────────────────────────────────────────────────────

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) });
    state.token = d.token; state.role = d.role; state.email = d.email;
    localStorage.setItem('aibos_token', d.token);
    localStorage.setItem('aibos_role', d.role);
    localStorage.setItem('aibos_email', d.email);
    if (d.hotelId) { state.hotelId = d.hotelId; localStorage.setItem('aibos_hotel', String(d.hotelId)); }
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

$('#menu-btn').addEventListener('click', () => {
  $('#sidebar').classList.toggle('mobile-open');
  $('#sidebar-overlay').classList.toggle('active');
});

$('#sidebar-overlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('mobile-open');
  $('#sidebar-overlay').classList.remove('active');
});

function attachNav() {
  $$$('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      $$$('[data-view]').forEach(b => b.classList.remove('active'));
      $$$('[data-view="' + btn.dataset.view + '"]').forEach(b => b.classList.add('active'));
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
  const h = state.hotels.find(h => h.id === state.hotelId);
  $('#sidebar-hotel').textContent = h ? h.name : '';
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
