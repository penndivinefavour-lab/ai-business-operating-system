/**
 * AI Business Operating System — Owner Dashboard Application
 * 
 * Handles the authenticated owner experience:
 * - Business workspace with onboarding flow
 * - Employee profile and configuration
 * - Services, policies, knowledge management
 * - Conversations and activity views
 * - Customer widget preview/install
 */

// ─── State ─────────────────────────────────────────────────────────────────

const state = {
  token: localStorage.getItem('auth_token') || null,
  account: JSON.parse(localStorage.getItem('account') || 'null'),
  currentBusiness: null,
  businesses: [],
  employee: null,
  checklist: [],
  services: [],
  policies: [],
  knowledge: [],
  conversations: [],
  activity: [],
  hotels: [], // legacy hotels for this business
};

// ─── API Client ────────────────────────────────────────────────────────────

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  
  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json();
  
  if (res.status === 401) {
    logout();
    throw new Error('Session expired. Please sign in again.');
  }
  
  if (!data.ok && res.status >= 400) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// ─── Authentication ────────────────────────────────────────────────────────

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('account');
  window.location.href = '/?logout=1';
}

async function checkAuth() {
  if (!state.token) {
    window.location.href = '/';
    return false;
  }
  
  try {
    const data = await api('/api/me');
    state.account = data.session;
    state.businesses = data.businesses || [];
    
    // Auto-select first business if none selected
    if (!state.currentBusiness && data.currentBusiness) {
      state.currentBusiness = data.currentBusiness;
    } else if (!state.currentBusiness && state.businesses.length > 0) {
      state.currentBusiness = state.businesses[0];
    }
    
    return true;
  } catch (err) {
    logout();
    return false;
  }
}

async function switchBusiness(businessId) {
  try {
    const data = await api('/api/me/business', {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    });
    state.token = data.token;
    localStorage.setItem('auth_token', state.token);
    state.currentBusiness = data.business;
    await loadDashboardData();
    render();
  } catch (err) {
    alert('Failed to switch business: ' + err.message);
  }
}

// ─── Data Loading ──────────────────────────────────────────────────────────

async function loadDashboardData() {
  if (!state.currentBusiness) return;
  
  try {
    // Load hotels for this business (legacy compat)
    const hotelsRes = await api('/api/hotels');
    state.hotels = hotelsRes.hotels || [];
    
    // Find matching hotel for this business
    const businessSlug = state.currentBusiness.slug;
    let hotel = state.hotels.find(h => h.slug.includes(businessSlug));
    if (!hotel && state.hotels.length > 0) hotel = state.hotels[0];
    
    if (hotel) {
      // Load employee + checklist
      const empRes = await api(`/api/hotels/${hotel.id}/employee`);
      state.employee = empRes.profile;
      state.checklist = empRes.checklist || [];
      
      // Load services
      const svcRes = await api(`/api/hotels/${hotel.id}/services`);
      state.services = svcRes.services || [];
      
      // Load policies
      const polRes = await api(`/api/hotels/${hotel.id}/policies`);
      state.policies = polRes.policies || [];
      
      // Load knowledge
      const kbRes = await api(`/api/hotels/${hotel.id}/knowledge`);
      state.knowledge = kbRes.items || [];
      
      // Load conversations
      const convRes = await api(`/api/hotels/${hotel.id}/conversations`);
      state.conversations = convRes.conversations || [];
      
      // Load activity (audit log)
      const auditRes = await api(`/api/hotels/${hotel.id}/audit`);
      state.activity = auditRes.entries || [];
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// ─── Views ─────────────────────────────────────────────────────────────────

let currentView = 'home';

function render() {
  const app = document.getElementById('app');
  
  if (!state.currentBusiness) {
    app.innerHTML = renderWelcome();
    attachWelcomeListeners();
    return;
  }
  
  app.innerHTML = `
    <div class="layout">
      ${renderSidebar()}
      <main class="main">
        ${renderHeader()}
        <div class="content">
          ${renderCurrentView()}
        </div>
      </main>
    </div>
  `;
  attachListeners();
}

function renderWelcome() {
  return `
    <div class="welcome-screen">
      <h1>Welcome, ${state.account?.name || 'Owner'}!</h1>
      <p>You don't have any businesses yet. Let's create your first one.</p>
      <button class="btn btn-primary" onclick="showCreateBusiness()">+ Create Your Business</button>
    </div>
  `;
}

function renderSidebar() {
  const isOnboardingComplete = state.checklist.length > 0 && state.checklist.every(s => s.completed);
  
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>${state.currentBusiness.name}</h2>
        <span class="badge ${isOnboardingComplete ? 'badge-success' : 'badge-warning'}">
          ${isOnboardingComplete ? 'Active' : 'Setup'}
        </span>
      </div>
      <nav class="sidebar-nav">
        <a class="${currentView === 'home' ? 'active' : ''}" onclick="navigate('home')">📊 Home</a>
        <a class="${currentView === 'employee' ? 'active' : ''}" onclick="navigate('employee')">🤖 AI Employee</a>
        <a class="${currentView === 'services' ? 'active' : ''}" onclick="navigate('services')">🛎️ Services</a>
        <a class="${currentView === 'policies' ? 'active' : ''}" onclick="navigate('policies')">📋 Policies</a>
        <a class="${currentView === 'knowledge' ? 'active' : ''}" onclick="navigate('knowledge')">📚 Knowledge</a>
        <a class="${currentView === 'conversations' ? 'active' : ''}" onclick="navigate('conversations')">💬 Conversations</a>
        <a class="${currentView === 'widget' ? 'active' : ''}" onclick="navigate('widget')">💻 Chat Widget</a>
        <a class="${currentView === 'settings' ? 'active' : ''}" onclick="navigate('settings')">⚙️ Settings</a>
      </nav>
      <div class="sidebar-footer">
        <button class="btn btn-secondary btn-sm" onclick="logout()">Sign Out</button>
      </div>
    </aside>
  `;
}

function renderHeader() {
  return `
    <header class="header">
      <h1>${getViewTitle()}</h1>
      <div class="header-actions">
        ${state.businesses.length > 1 ? `
          <select onchange="switchBusiness(this.value)" class="form-select">
            ${state.businesses.map(b => `
              <option value="${b.id}" ${b.id === state.currentBusiness?.id ? 'selected' : ''}>${b.name}</option>
            `).join('')}
          </select>
        ` : ''}
      </div>
    </header>
  `;
}

function getViewTitle() {
  const titles = {
    home: 'Dashboard',
    employee: 'AI Employee',
    services: 'Services',
    policies: 'Policies',
    knowledge: 'Knowledge Base',
    conversations: 'Conversations',
    widget: 'Chat Widget',
    settings: 'Settings',
  };
  return titles[currentView] || 'Dashboard';
}

function renderCurrentView() {
  switch (currentView) {
    case 'employee': return renderEmployeeView();
    case 'services': return renderServicesView();
    case 'policies': return renderPoliciesView();
    case 'knowledge': return renderKnowledgeView();
    case 'conversations': return renderConversationsView();
    case 'widget': return renderWidgetView();
    case 'settings': return renderSettingsView();
    default: return renderHomeView();
  }
}

function renderHomeView() {
  const onboardingProgress = state.checklist.length > 0 
    ? Math.round((state.checklist.filter(s => s.completed).length / state.checklist.length) * 100)
    : 0;
  
  const pendingConv = state.conversations.filter(c => c.status === 'open').length;
  const recentActivity = state.activity.slice(0, 5);
  
  return `
    <div class="grid">
      <div class="card">
        <h3>Onboarding Progress</h3>
        <div class="progress-bar"><div class="progress-fill" style="width: ${onboardingProgress}%"></div></div>
        <p>${onboardingProgress}% complete</p>
        ${onboardingProgress < 100 ? '<button class="btn btn-primary btn-sm" onclick="navigate(\'employee\')">Continue Setup</button>' : '<span class="badge badge-success">Complete!</span>'}
      </div>
      <div class="card">
        <h3>Open Conversations</h3>
        <p class="big-number">${pendingConv}</p>
        <button class="btn btn-secondary btn-sm" onclick="navigate('conversations')">View All</button>
      </div>
      <div class="card">
        <h3>AI Employee</h3>
        <p>${state.employee?.name || 'Not configured'} — ${state.employee?.status || 'draft'}</p>
        <button class="btn btn-secondary btn-sm" onclick="navigate('employee\')">Configure</button>
      </div>
    </div>
    <div class="card">
      <h3>Recent Activity</h3>
      ${recentActivity.length > 0 ? `
        <ul class="activity-list">
          ${recentActivity.map(a => `
            <li><span class="activity-time">${formatTimeAgo(a.created_at)}</span> ${a.action} (${a.entity})</li>
          `).join('')}
        </ul>
      ` : '<p>No recent activity.</p>'}
    </div>
  `;
}

function renderEmployeeView() {
  const emp = state.employee || { name: '', role: '', status: 'draft' };
  
  return `
    <div class="card">
      <div class="employee-profile">
        <div class="employee-avatar">${emp.avatar_emoji || '🤖'}</div>
        <div class="employee-info">
          <h2>${emp.name || 'Your AI Employee'}</h2>
          <p>${emp.role || 'Receptionist'} — <span class="badge badge-${emp.status === 'active' ? 'success' : 'warning'}">${emp.status || 'draft'}</span></p>
        </div>
      </div>
      
      <form onsubmit="saveEmployee(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Employee Name</label>
            <input type="text" id="empName" value="${esc(emp.name)}" placeholder="e.g., Sarah" required />
          </div>
          <div class="form-group">
            <label>Role</label>
            <input type="text" id="empRole" value="${esc(emp.role)}" placeholder="e.g., Receptionist" required />
          </div>
        </div>
        <div class="form-group">
          <label>Welcome Message</label>
          <textarea id="empWelcome" rows="2" placeholder="How your employee greets customers...">${esc(emp.welcome_message || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Personality</label>
            <select id="empPersonality">
              <option value="professional_friendly" ${emp.personality === 'professional_friendly' ? 'selected' : ''}>Professional & Friendly</option>
              <option value="warm_helpful" ${emp.personality === 'warm_helpful' ? 'selected' : ''}>Warm & Helpful</option>
              <option value="formal_polite" ${emp.personality === 'formal_polite' ? 'selected' : ''}>Formal & Polite</option>
              <option value="casual_friendly" ${emp.personality === 'casual_friendly' ? 'selected' : ''}>Casual & Friendly</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="empStatus">
              <option value="draft" ${emp.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="active" ${emp.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="paused" ${emp.status === 'paused' ? 'selected' : ''}>Paused</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Save Employee</button>
      </form>
    </div>
    
    <div class="card">
      <h3>Test Your Employee</h3>
      <div class="test-chat" id="testChat">
        <div class="test-chat-messages" id="testMessages"></div>
        <form onsubmit="sendTestMessage(event)" class="test-chat-input">
          <input type="text" id="testInput" placeholder="Type a customer question..." required />
          <button type="submit" class="btn btn-primary btn-sm">Send</button>
        </form>
      </div>
    </div>
  `;
}

function renderServicesView() {
  return `
    <div class="card">
      <div class="card-header">
        <h3>Services</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddService()">+ Add Service</button>
      </div>
      <div id="servicesList">
        ${state.services.length > 0 ? state.services.map(s => `
          <div class="list-item">
            <div>
              <strong>${esc(s.name)}</strong>
              ${s.price ? `<span class="price">${s.price} FCFA</span>` : ''}
              <p>${esc(s.description || '')}</p>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">Delete</button>
          </div>
        `).join('') : '<p>No services yet. Add your first one!</p>'}
      </div>
    </div>
  `;
}

function renderPoliciesView() {
  return `
    <div class="card">
      <div class="card-header">
        <h3>Policies</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddPolicy()">+ Add Policy</button>
      </div>
      <div id="policiesList">
        ${state.policies.length > 0 ? state.policies.map(p => `
          <div class="list-item">
            <div>
              <strong>${esc(p.title)}</strong>
              <span class="badge">${esc(p.policy_type)}</span>
              <p>${esc(p.content)}</p>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deletePolicy(${p.id})">Delete</button>
          </div>
        `).join('') : '<p>No policies yet. Add cancellation, pet, or other policies.</p>'}
      </div>
    </div>
  `;
}

function renderKnowledgeView() {
  return `
    <div class="card">
      <div class="card-header">
        <h3>Knowledge Base (FAQs)</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddKnowledge()">+ Add FAQ</button>
      </div>
      <div id="knowledgeList">
        ${state.knowledge.length > 0 ? state.knowledge.map(k => `
          <div class="list-item">
            <div>
              <strong>Q: ${esc(k.question)}</strong>
              <p>A: ${esc(k.answer)}</p>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteKnowledge(${k.id})">Delete</button>
          </div>
        `).join('') : '<p>No FAQs yet. Add common questions and answers.</p>'}
      </div>
    </div>
  `;
}

function renderConversationsView() {
  return `
    <div class="card">
      <h3>Customer Conversations</h3>
      ${state.conversations.length > 0 ? `
        <div class="conversation-list">
          ${state.conversations.map(c => `
            <div class="conversation-item" onclick="viewConversation(${c.id})">
              <div class="conv-header">
                <span class="conv-id">#${c.id}</span>
                <span class="badge badge-${c.status === 'open' ? 'warning' : c.status === 'escalated' ? 'danger' : 'success'}">${c.status}</span>
              </div>
              <p class="conv-last">${esc(c.intent_last || 'No messages')}</p>
              <span class="conv-time">${formatTimeAgo(c.last_message_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p>No conversations yet. Once customers start chatting, they\'ll appear here.</p>'}
    </div>
  `;
}

function renderWidgetView() {
  const businessSlug = state.currentBusiness?.slug || 'demo';
  const embedCode = `<script src="https://your-domain.com/widget.js" data-business="${businessSlug}" async></script>`;
  
  return `
    <div class="card">
      <h3>Customer Chat Widget</h3>
      <p>Add this snippet to your website to enable customer conversations with your AI employee.</p>
      
      <div class="form-group">
        <label>Embed Code</label>
        <textarea readonly rows="3" class="code-block">${esc(embedCode)}</textarea>
        <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${esc(embedCode)}')">Copy Code</button>
      </div>
      
      <h4>Preview</h4>
      <iframe src="/widget.html?business=${businessSlug}" width="380" height="500" style="border: 1px solid var(--border); border-radius: var(--radius);"></iframe>
    </div>
  `;
}

function renderSettingsView() {
  return `
    <div class="card">
      <h3>Business Settings</h3>
      <form onsubmit="saveSettings(event)">
        <div class="form-group">
          <label>Business Name</label>
          <input type="text" id="bizName" value="${esc(state.currentBusiness?.name || '')}" required />
        </div>
        <div class="form-group">
          <label>City</label>
          <input type="text" id="bizCity" value="${esc(state.currentBusiness?.city || '')}" />
        </div>
        <div class="form-group">
          <label>Country</label>
          <input type="text" id="bizCountry" value="${esc(state.currentBusiness?.country || 'Cameroon')}" />
        </div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    </div>
  `;
}

// ─── Actions ───────────────────────────────────────────────────────────────

async function saveEmployee(e) {
  e.preventDefault();
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  if (!hotel) return alert('No hotel found for this business.');
  
  const data = {
    name: document.getElementById('empName').value,
    role: document.getElementById('empRole').value,
    welcome_message: document.getElementById('empWelcome').value,
    personality: document.getElementById('empPersonality').value,
    status: document.getElementById('empStatus').value,
  };
  
  try {
    await api(`/api/hotels/${hotel.id}/employee`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    alert('Employee saved!');
    await loadDashboardData();
    render();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function sendTestMessage(e) {
  e.preventDefault();
  const input = document.getElementById('testInput');
  const text = input.value.trim();
  if (!text) return;
  
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  if (!hotel) return alert('No hotel found.');
  
  // Add user message to chat
  addTestMessage('You', text);
  input.value = '';
  
  try {
    const res = await api(`/api/hotels/${hotel.id}/test-employee`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    
    setTimeout(() => {
      addTestMessage(state.employee?.name || 'AI', res.reply);
    }, 500);
  } catch (err) {
    addTestMessage('System', 'Error: ' + err.message);
  }
}

function addTestMessage(sender, text) {
  const container = document.getElementById('testMessages');
  if (!container) return;
  container.innerHTML += `
    <div class="chat-message ${sender === 'You' ? 'chat-you' : 'chat-ai'}">
      <strong>${esc(sender)}:</strong> ${esc(text)}
    </div>
  `;
  container.scrollTop = container.scrollHeight;
}

function showAddService() {
  const name = prompt('Service name:');
  if (!name) return;
  const price = prompt('Price (FCFA, leave blank if N/A):');
  const description = prompt('Description (optional):');
  
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  api(`/api/hotels/${hotel.id}/services`, {
    method: 'POST',
    body: JSON.stringify({ name, price: price ? Number(price) : null, description }),
  }).then(() => loadDashboardData().then(render));
}

async function deleteService(id) {
  if (!confirm('Delete this service?')) return;
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  await api(`/api/hotels/${hotel.id}/services/${id}`, { method: 'DELETE' });
  await loadDashboardData();
  render();
}

function showAddPolicy() {
  const title = prompt('Policy title:');
  if (!title) return;
  const type = prompt('Policy type (cancellation, pets, payment, etc.):');
  const content = prompt('Policy content:');
  if (!content) return;
  
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  api(`/api/hotels/${hotel.id}/policies`, {
    method: 'POST',
    body: JSON.stringify({ title, policy_type: type, content }),
  }).then(() => loadDashboardData().then(render));
}

async function deletePolicy(id) {
  if (!confirm('Delete this policy?')) return;
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  await api(`/api/hotels/${hotel.id}/policies/${id}`, { method: 'DELETE' });
  await loadDashboardData();
  render();
}

function showAddKnowledge() {
  const question = prompt('Question:');
  if (!question) return;
  const answer = prompt('Answer:');
  if (!answer) return;
  
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  api(`/api/hotels/${hotel.id}/knowledge`, {
    method: 'POST',
    body: JSON.stringify({ question, answer }),
  }).then(() => loadDashboardData().then(render));
}

async function deleteKnowledge(id) {
  if (!confirm('Delete this item?')) return;
  const hotel = state.hotels.find(h => h.slug.includes(state.currentBusiness?.slug)) || state.hotels[0];
  await api(`/api/hotels/${hotel.id}/knowledge/${id}`, { method: 'DELETE' });
  await loadDashboardData();
  render();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => alert('Copied!'));
}

function formatTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function navigate(view) {
  currentView = view;
  render();
}

function attachListeners() {
  // General listener attachment
}

function attachWelcomeListeners() {
  // Welcome screen listeners
}

function showCreateBusiness() {
  const name = prompt('Business name:');
  if (!name) return;
  
  api('/api/businesses', {
    method: 'POST',
    body: JSON.stringify({ name, businessType: 'hotel' }),
  }).then(data => {
    state.currentBusiness = data.business;
    localStorage.setItem('current_business', JSON.stringify(data.business));
    window.location.reload();
  }).catch(err => alert(err.message));
}

function viewConversation(id) {
  // TODO: Show conversation detail modal
  alert('Conversation #' + id);
}

function saveSettings(e) {
  e.preventDefault();
  alert('Settings saved! (Feature pending implementation)');
}

// ─── Initialization ────────────────────────────────────────────────────────

async function init() {
  const authenticated = await checkAuth();
  if (!authenticated) return;
  
  if (state.currentBusiness) {
    await loadDashboardData();
  }
  
  render();
}

init();
