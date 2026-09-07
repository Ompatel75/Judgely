const API_URL = window.location.origin + "/api";
let currentToken = null;
let currentUser = null;
let authMode = 'login'; // login or register
let selectedProblemId = null;
let currentProblemTitle = null;
let currentSubmissionId = null;
let pollInterval = null;

// Global AI Generated Problem Cache for Admin review
let currentAIGeneratedProblem = null;

// Persistent Floating AI Chat state
let floatingAIChatHistory = [];

// Markdown Renderer Helper
function renderMarkdown(text) {
    if (!text) return '';
    try {
        if (window.marked && typeof window.marked.parse === 'function') {
            return window.marked.parse(text);
        }
    } catch (e) {}
    // Fallback simple renderer if marked script is offline
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// --- UI Navigation & Auth ---

function switchAuthTab(mode) {
    authMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    
    document.getElementById('register-fields').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit-btn').textContent = mode === 'register' ? 'Register' : 'Login';
    document.getElementById('auth-error').textContent = '';
}

function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('welcome-msg').textContent = `Welcome, ${currentUser.username}!`;
    
    const navLinks = document.getElementById('nav-links');
    navLinks.innerHTML = `
        <button class="text-btn" onclick="showProblemsListNav()">Problems</button>
        <button class="text-btn" onclick="showProfileSection()">Profile</button>
        ${currentUser.is_admin ? '<button class="text-btn" onclick="scrollToAdminPanel()">Admin Panel</button>' : ''}
        <button class="text-btn" onclick="logout()">Logout</button>
    `;
    
    if (currentUser.is_admin) {
        document.getElementById('admin-badge').style.display = 'block';
        document.getElementById('admin-panel').style.display = 'block';
    } else {
        document.getElementById('admin-badge').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
    }

    // Show persistent floating AI FAB
    const fab = document.getElementById('floating-ai-fab');
    if (fab) fab.classList.remove('hidden');
    
    loadProblems();
}

function showProblemsListNav() {
    showDashboardSection();
    hideSubmitPanel();
}

function showDashboardSection() {
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
}

async function showProfileSection() {
    hideSubmitPanel();
    document.getElementById('dashboard-section').classList.add('hidden');
    const profileSec = document.getElementById('profile-section');
    profileSec.classList.remove('hidden');

    if (currentUser.is_admin) {
        const badge = document.getElementById('profile-admin-badge');
        if (badge) badge.style.display = 'block';
    }

    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('profile-email').textContent = currentUser.email;
    
    if (currentUser.created_at) {
        const d = new Date(currentUser.created_at);
        document.getElementById('profile-joined').textContent = `Member since ${d.toLocaleDateString()}`;
    }

    // Fetch Stats
    try {
        const statsRes = await fetch(`${API_URL}/users/profile`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('stat-solved').textContent = stats.solved_count;
            document.getElementById('stat-attempted').textContent = stats.attempted_count;
            document.getElementById('stat-total').textContent = stats.total_submissions;
        }
    } catch (e) {
        console.error("Failed to load profile stats", e);
    }

    // Fetch AI Chat History
    loadProfileChatHistory();
}

async function loadProfileChatHistory() {
    const container = document.getElementById('profile-chat-history-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading chat history...</p>';

    try {
        const res = await fetch(`${API_URL}/ai/user/history`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) throw new Error("Failed to load chat history");

        const historyList = await res.json();
        if (!historyList || historyList.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No AI tutor chat history found yet. Submit code to start chatting with AI Tutor!</p>';
            return;
        }

        let html = '';
        historyList.forEach(item => {
            const dateStr = item.last_updated ? new Date(item.last_updated).toLocaleString() : '';
            const verdictBadgeClass = item.verdict === 'AC' ? 'ac-badge' : 'wa-badge';
            html += `
                <div class="history-card-item" onclick="openAITutorForSubmission(${item.submission_id})">
                    <div>
                        <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 0.5rem;">
                            <span>💡 ${item.problem_title}</span>
                            <span class="status-badge ${verdictBadgeClass}">${item.verdict}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                            ${item.message_count} message(s) • Last active: ${dateStr}
                        </div>
                    </div>
                    <button class="secondary-btn" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">Review Chat →</button>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<p style="color: var(--error); font-size: 0.9rem;">${err.message}</p>`;
    }
}

async function openAITutorForSubmission(subId) {
    currentSubmissionId = subId;
    await openAITutorModal();
}

function scrollToAdminPanel() {
    showDashboardSection();
    hideSubmitPanel();
    const panel = document.getElementById('admin-panel');
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth' });
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('nav-links').innerHTML = '';

    const fab = document.getElementById('floating-ai-fab');
    if (fab) fab.classList.add('hidden');
    const widget = document.getElementById('floating-ai-widget');
    if (widget) widget.classList.add('hidden');
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = "";

    try {
        if (authMode === 'register') {
            const email = document.getElementById('auth-email').value;
            const res = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            if (!res.ok) throw new Error((await res.json()).detail || "Registration failed");
            await loginRequest(username, password);
        } else {
            await loginRequest(username, password);
        }
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

async function loginRequest(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) throw new Error("Invalid username or password");
    
    const data = await res.json();
    currentToken = data.access_token;
    await fetchUserProfile();
}

async function fetchUserProfile() {
    const res = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
        currentUser = await res.json();
        showDashboard();
    }
}

// --- Problems Management ---

async function loadProblems() {
    const res = await fetch(`${API_URL}/problems/`);
    const problems = await res.json();
    
    let statuses = {};
    if (currentToken) {
        try {
            const statRes = await fetch(`${API_URL}/submissions/me/status`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (statRes.ok) {
                statuses = await statRes.json();
            }
        } catch (e) {}
    }
    
    const container = document.getElementById('problems-container');
    const badge = document.getElementById('problems-count-badge');
    if (badge) badge.textContent = `${problems.length} Problems Total`;
    
    container.innerHTML = '';
    
    if (problems.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem;">No problems available yet. Log in as Admin to create or generate problems.</p>';
        return;
    }
    
    problems.forEach(p => {
        const card = document.createElement('div');
        card.className = 'problem-card';
        
        let statusBadge = '';
        const v = statuses[p.id];
        if (v === 'AC') {
            statusBadge = '<span class="status-badge ac-badge">✓ Solved</span>';
        } else if (v && v !== 'PENDING' && v !== 'RUNNING') {
            statusBadge = '<span class="status-badge wa-badge">✗ Attempted</span>';
        }

        card.innerHTML = `
            <div>
                <h4 style="display:flex; align-items:center; gap:0.5rem;">
                    ${p.title}
                    ${statusBadge}
                </h4>
                <div class="tags-container">
                    ${p.tags ? p.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : ''}
                </div>
                <div class="meta" style="margin-top: 0.5rem;">
                    <span>⏳ ${p.time_limit}s</span>
                    <span>💾 ${p.memory_limit}MB</span>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                ${currentUser && currentUser.is_admin ? `<button class="solve-btn delete-btn" onclick="deleteProblem(${p.id})">Delete</button>` : ''}
                <button class="solve-btn" onclick='openSubmitPanel(${p.id}, ${JSON.stringify(p.title)}, ${JSON.stringify(p.description).replace(/'/g, "&#39;")})'>Solve</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function handleAddProblem(e) {
    e.preventDefault();
    const msgEl = document.getElementById('admin-msg');
    
    const problemData = {
        title: document.getElementById('prob-title').value,
        description: document.getElementById('prob-desc').value,
        time_limit: parseFloat(document.getElementById('prob-time').value),
        memory_limit: parseInt(document.getElementById('prob-mem').value),
        tags: document.getElementById('prob-tags').value || ""
    };
    
    try {
        const probRes = await fetch(`${API_URL}/problems/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(problemData)
        });
        
        if (!probRes.ok) throw new Error("Failed to create problem");
        const prob = await probRes.json();
        
        const tcData = {
            input_data: document.getElementById('prob-input').value,
            expected_output: document.getElementById('prob-expected').value,
            is_hidden: false
        };
        
        await fetch(`${API_URL}/problems/${prob.id}/testcases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(tcData)
        });
        
        msgEl.textContent = "Problem created successfully!";
        msgEl.style.color = "var(--accent)";
        e.target.reset();
        loadProblems();
        setTimeout(() => msgEl.textContent = "", 3000);
        
    } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = "var(--error)";
    }
}

async function deleteProblem(id) {
    if (!confirm("Are you sure you want to delete this problem?")) return;
    try {
        const res = await fetch(`${API_URL}/problems/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) throw new Error("Failed to delete problem");
        loadProblems();
    } catch (err) {
        alert(err.message);
    }
}

// --- Submit Workspace & Code Editor ---

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('code-editor');
    if (editor) {
        editor.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });
    }
});

function openSubmitPanel(id, title, desc) {
    selectedProblemId = id;
    currentProblemTitle = title;
    currentSubmissionId = null;
    document.querySelector('.problems-list').classList.add('hidden');
    if (document.getElementById('admin-panel')) document.getElementById('admin-panel').classList.add('hidden');
    
    const panel = document.getElementById('submit-panel');
    panel.classList.remove('hidden');
    document.getElementById('submit-prob-title').textContent = title;
    document.getElementById('submit-prob-desc').innerHTML = renderMarkdown(desc);
    
    // Update floating AI context badge
    const badge = document.getElementById('floating-ai-context');
    if (badge) badge.textContent = title;

    // Reset verdict & AI triggers
    document.getElementById('verdict-display').classList.add('hidden');
    document.getElementById('ai-tutor-btn').classList.add('hidden');
    document.getElementById('ai-complexity-btn').classList.add('hidden');
    document.getElementById('complexity-card-container').classList.add('hidden');
    document.getElementById('submit-btn').disabled = false;
    if (pollInterval) clearInterval(pollInterval);
}

function hideSubmitPanel() {
    selectedProblemId = null;
    currentProblemTitle = null;
    currentSubmissionId = null;
    document.getElementById('submit-panel').classList.add('hidden');
    document.querySelector('.problems-list').classList.remove('hidden');
    if (currentUser && currentUser.is_admin) document.getElementById('admin-panel').classList.remove('hidden');
    if (pollInterval) clearInterval(pollInterval);

    // Reset floating AI context badge
    const badge = document.getElementById('floating-ai-context');
    if (badge) badge.textContent = "General AI";
}

async function handleSubmitCode(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const code = document.getElementById('code-editor').value;
    const vDisplay = document.getElementById('verdict-display');
    const vStatus = document.getElementById('verdict-status');
    const vTime = document.getElementById('verdict-time');
    
    btn.disabled = true;
    vDisplay.classList.remove('hidden');
    document.getElementById('ai-tutor-btn').classList.add('hidden');
    document.getElementById('ai-complexity-btn').classList.add('hidden');
    document.getElementById('complexity-card-container').classList.add('hidden');
    vStatus.textContent = "SUBMITTING...";
    vStatus.className = "verdict-pending";
    vTime.textContent = "";
    
    try {
        const res = await fetch(`${API_URL}/submissions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                problem_id: selectedProblemId,
                language: "cpp",
                code: code
            })
        });
        
        if (!res.ok) throw new Error("Submission failed");
        
        const subData = await res.json();
        currentSubmissionId = subData.id;
        
        pollVerdict(subData.id);
        
    } catch (err) {
        vStatus.textContent = "ERROR";
        vStatus.className = "verdict-re";
        btn.disabled = false;
    }
}

function pollVerdict(subId) {
    const btn = document.getElementById('submit-btn');
    const vStatus = document.getElementById('verdict-status');
    const vTime = document.getElementById('verdict-time');
    
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/submissions/${subId}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            
            if (!res.ok) return;
            const data = await res.json();
            
            vStatus.textContent = data.verdict;
            
            if (data.verdict !== "PENDING" && data.verdict !== "RUNNING") {
                clearInterval(pollInterval);
                btn.disabled = false;
                
                if (data.verdict === "AC") {
                    vStatus.className = 'verdict-ac';
                    document.getElementById('ai-complexity-btn').classList.remove('hidden');
                } else {
                    if (data.verdict === "WA") vStatus.className = 'verdict-wa';
                    else if (data.verdict === "TLE") vStatus.className = 'verdict-tle';
                    else vStatus.className = 'verdict-re';
                    
                    document.getElementById('ai-tutor-btn').classList.remove('hidden');
                }
                
                if (data.execution_time) {
                    vTime.textContent = `Time: ${data.execution_time.toFixed(3)}s`;
                }
            } else {
                vStatus.className = 'verdict-running';
            }
            
        } catch (err) {
            console.error("Polling error", err);
        }
    }, 1000);
}

// --- Feature 1: Socratic AI Tutor Modal & Chat ---

async function openAITutorModal() {
    if (!currentSubmissionId) return;
    const drawer = document.getElementById('ai-tutor-drawer');
    drawer.classList.remove('hidden');
    
    document.getElementById('tutor-loading').classList.remove('hidden');
    document.getElementById('tutor-content').classList.add('hidden');
    
    try {
        const res = await fetch(`${API_URL}/ai/tutor/${currentSubmissionId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) throw new Error("Failed to load AI Tutor hints");
        
        const data = await res.json();
        
        document.getElementById('tutor-wrong-text').innerHTML = renderMarkdown(data.what_went_wrong);
        document.getElementById('hint-1-text').innerHTML = renderMarkdown(data.hint_1);
        
        // Setup progressive hints
        const h2Container = document.getElementById('hint-2-container');
        h2Container.className = 'hint-step locked';
        h2Container.innerHTML = `
            <button class="secondary-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="unlockHint(2, ${JSON.stringify(data.hint_2).replace(/"/g, '&quot;')})">Unlock Hint 2</button>
            <div id="hint-2-text" class="hidden" style="font-size: 0.9rem; margin-top: 0.3rem; margin-bottom: 0;"></div>
        `;
        
        const h3Container = document.getElementById('hint-3-container');
        h3Container.className = 'hint-step locked';
        h3Container.innerHTML = `
            <button class="secondary-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="unlockHint(3, ${JSON.stringify(data.strong_hint).replace(/"/g, '&quot;')})">Unlock Strong Hint</button>
            <div id="hint-3-text" class="hidden" style="font-size: 0.9rem; margin-top: 0.3rem; margin-bottom: 0;"></div>
        `;
        
        document.getElementById('tutor-edge-case').innerHTML = renderMarkdown(data.edge_case || "Check N=1 or Maximum constraint boundaries.");
        document.getElementById('tutor-where').innerHTML = renderMarkdown(data.where_to_look || "Main logic loop");
        document.getElementById('tutor-concept').innerHTML = renderMarkdown(data.concept || "Algorithms & Data Structures");
        
        document.getElementById('tutor-loading').classList.add('hidden');
        document.getElementById('tutor-content').classList.remove('hidden');
        
        loadTutorChatHistory();
        
    } catch (err) {
        document.getElementById('tutor-loading').innerHTML = `<p style="color:var(--error)">${err.message}</p>`;
    }
}

function unlockHint(stepNum, text) {
    if (stepNum === 2) {
        const container = document.getElementById('hint-2-container');
        container.className = 'hint-step';
        container.innerHTML = `
            <strong style="color: #a5f3fc; font-size: 0.85rem;">Hint 2 (Logic Focus):</strong>
            <div style="font-size: 0.9rem; margin-top: 0.3rem; margin-bottom: 0;">${renderMarkdown(text)}</div>
        `;
    } else if (stepNum === 3) {
        const container = document.getElementById('hint-3-container');
        container.className = 'hint-step';
        container.innerHTML = `
            <strong style="color: #fef08a; font-size: 0.85rem;">Strong Hint:</strong>
            <div style="font-size: 0.9rem; margin-top: 0.3rem; margin-bottom: 0;">${renderMarkdown(text)}</div>
        `;
    }
}

function closeAITutorModal() {
    document.getElementById('ai-tutor-drawer').classList.add('hidden');
}

async function loadTutorChatHistory() {
    if (!currentSubmissionId) return;
    const msgContainer = document.getElementById('chat-messages');
    msgContainer.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/ai/tutor/${currentSubmissionId}/history`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) {
            const msgs = await res.json();
            msgs.forEach(m => {
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${m.role}`;
                bubble.innerHTML = renderMarkdown(m.content);
                msgContainer.appendChild(bubble);
            });
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    } catch (e) {}
}

async function sendTutorChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !currentSubmissionId) return;

    const msgContainer = document.getElementById('chat-messages');
    
    // Append user bubble
    const uBubble = document.createElement('div');
    uBubble.className = 'chat-bubble user';
    uBubble.textContent = msg;
    msgContainer.appendChild(uBubble);
    input.value = '';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Append loading bubble
    const aBubble = document.createElement('div');
    aBubble.className = 'chat-bubble assistant';
    aBubble.textContent = "AI is thinking...";
    msgContainer.appendChild(aBubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
        const res = await fetch(`${API_URL}/ai/tutor/${currentSubmissionId}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ message: msg })
        });
        
        if (!res.ok) throw new Error("Failed to get AI reply");
        const data = await res.json();
        aBubble.innerHTML = renderMarkdown(data.reply);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        
    } catch (err) {
        aBubble.textContent = `Error: ${err.message}`;
    }
}

// --- Feature: Persistent Floating AI Assistant Widget ---

function toggleFloatingAIWidget() {
    const widget = document.getElementById('floating-ai-widget');
    if (widget) {
        widget.classList.toggle('hidden');
    }
}

function handleFloatingAIPress(e) {
    if (e.key === 'Enter') {
        sendFloatingAIMessage();
    }
}

async function sendFloatingAIMessage() {
    const input = document.getElementById('floating-ai-input');
    const message = input.value.trim();
    if (!message) return;

    const body = document.getElementById('floating-ai-body');

    // Append User Message
    const uMsg = document.createElement('div');
    uMsg.className = 'floating-ai-msg user';
    uMsg.textContent = message;
    body.appendChild(uMsg);
    input.value = '';
    body.scrollTop = body.scrollHeight;

    // Push to history
    floatingAIChatHistory.push({ role: 'user', content: message });

    // Append Loading Assistant Bubble
    const aMsg = document.createElement('div');
    aMsg.className = 'floating-ai-msg assistant';
    aMsg.textContent = 'Thinking...';
    body.appendChild(aMsg);
    body.scrollTop = body.scrollHeight;

    const editorEl = document.getElementById('code-editor');
    const currentCode = editorEl ? editorEl.value : "";

    try {
        const res = await fetch(`${API_URL}/ai/general-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                message: message,
                problem_id: selectedProblemId,
                current_code: currentCode,
                history: floatingAIChatHistory.slice(-6)
            })
        });

        if (!res.ok) throw new Error("Failed to contact AI Assistant");
        const data = await res.json();

        aMsg.innerHTML = renderMarkdown(data.reply);
        floatingAIChatHistory.push({ role: 'assistant', content: data.reply });
        body.scrollTop = body.scrollHeight;

    } catch (err) {
        aMsg.textContent = `Error: ${err.message}`;
    }
}

// --- Feature 2: Time & Space Complexity Analyzer ---

async function fetchComplexityAnalysis() {
    if (!currentSubmissionId) return;
    const cardContainer = document.getElementById('complexity-card-container');
    cardContainer.classList.remove('hidden');
    cardContainer.innerHTML = '<p style="color:var(--primary); font-size:0.9rem;">⚡ Analyzing Time & Space Complexity...</p>';

    try {
        const res = await fetch(`${API_URL}/ai/complexity/${currentSubmissionId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch complexity analysis");
        const data = await res.json();

        let opsHtml = '';
        if (data.operations_breakdown && data.operations_breakdown.length > 0) {
            opsHtml = `
                <table class="ops-table" style="width:100%; margin-top:0.8rem; font-size:0.85rem; border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:left; border-bottom:1px solid rgba(255,255,255,0.1);">
                            <th style="padding:0.4rem;">Operation</th>
                            <th style="padding:0.4rem;">Complexity</th>
                            <th style="padding:0.4rem;">Line / Location</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.operations_breakdown.forEach(op => {
                opsHtml += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:0.4rem;"><code>${op.operation}</code></td>
                        <td style="padding:0.4rem; color:#38bdf8;">${op.complexity}</td>
                        <td style="padding:0.4rem; color:var(--text-muted);">${op.line_reference || '-'}</td>
                    </tr>
                `;
            });
            opsHtml += '</tbody></table>';
        }

        let optsHtml = '';
        if (data.optimizations && data.optimizations.length > 0) {
            optsHtml = '<ul style="margin-top:0.6rem; padding-left:1.2rem; font-size:0.88rem; color:#e2e8f0;">';
            data.optimizations.forEach(opt => {
                optsHtml += `<li style="margin-bottom:0.3rem;">${opt}</li>`;
            });
            optsHtml += '</ul>';
        }

        cardContainer.innerHTML = `
            <div class="complexity-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                    <span style="font-weight:700; font-size:1rem; color:#a5f3fc;">⚡ Complexity Breakdown</span>
                    <span class="status-badge ac-badge">${data.performance}</span>
                </div>
                
                <div class="complexity-badge-row">
                    <span class="comp-badge">⏱️ Time: ${data.time_complexity}</span>
                    <span class="comp-badge">💾 Space: ${data.space_complexity}</span>
                </div>
                
                <div style="font-size:0.9rem; color:#cbd5e1; line-height:1.5; margin-top:0.8rem;">
                    ${renderMarkdown(data.explanation)}
                </div>

                ${opsHtml}
                
                ${optsHtml ? `<h5 style="color:#fef08a; margin-top:1rem; margin-bottom:0.3rem;">🚀 Key Optimizations</h5>${optsHtml}` : ''}
            </div>
        `;

    } catch (err) {
        cardContainer.innerHTML = `<p style="color:var(--error); font-size:0.88rem;">${err.message}</p>`;
    }
}

// --- Feature 3: Admin AI Problem & Test Case Generator ---

function toggleAIProblemModal() {
    const modal = document.getElementById('ai-generator-modal');
    modal.classList.toggle('hidden');
}

async function runAIProblemGenerator() {
    const topic = document.getElementById('gen-topic').value.trim();
    const difficulty = document.getElementById('gen-difficulty').value;
    const tags = document.getElementById('gen-tags').value.trim();
    const instructions = document.getElementById('gen-instructions').value.trim();

    if (!topic) {
        alert("Please enter a Topic or Algorithm name (e.g. Binary Search).");
        return;
    }

    const reviewWorkspace = document.getElementById('gen-review-workspace');
    reviewWorkspace.classList.remove('hidden');
    reviewWorkspace.innerHTML = '<p style="color:var(--primary); text-align:center; padding:2rem;">🪄 LangChain & Gemini are crafting your competitive programming problem and test cases...</p>';

    try {
        const res = await fetch(`${API_URL}/problems/generate-ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ topic, difficulty, tags, instructions })
        });

        if (!res.ok) throw new Error("AI Problem generation failed");
        const probData = await res.json();
        currentAIGeneratedProblem = probData;

        renderAIProblemReview(probData);

    } catch (err) {
        reviewWorkspace.innerHTML = `<p style="color:var(--error); text-align:center;">${err.message}</p>`;
    }
}

function renderAIProblemReview(prob) {
    const reviewWorkspace = document.getElementById('gen-review-workspace');
    
    let tcHtml = '';
    prob.test_cases.forEach((tc, i) => {
        tcHtml += `
            <div class="test-review-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                    <span style="font-weight:700; font-size:0.85rem; color:#a5f3fc;">
                        ${tc.description || (tc.is_hidden ? `Hidden Test ${i+1}` : `Sample Test ${i+1}`)}
                    </span>
                    <span class="status-badge ${tc.is_hidden ? 'wa-badge' : 'ac-badge'}">
                        ${tc.is_hidden ? 'Hidden' : 'Sample'}
                    </span>
                </div>
                <label style="font-size:0.75rem;">INPUT</label>
                <pre style="background:#000; padding:0.5rem; border-radius:6px; font-size:0.8rem;">${tc.input_data}</pre>
                <label style="font-size:0.75rem; margin-top:0.4rem;">EXPECTED OUTPUT</label>
                <pre style="background:#000; padding:0.5rem; border-radius:6px; font-size:0.8rem;">${tc.expected_output}</pre>
            </div>
        `;
    });

    reviewWorkspace.innerHTML = `
        <h3 style="font-size: 1.2rem; color: #a5f3fc; margin-bottom: 1rem;">Review Generated Problem</h3>
        
        <label>Title</label>
        <input type="text" id="gen-out-title" value="${prob.title.replace(/"/g, '&quot;')}">
        
        <label>Description (Markdown)</label>
        <textarea id="gen-out-desc" style="min-height: 180px;">${prob.description}</textarea>
        
        <div class="row">
            <div>
                <label>Time Limit (s)</label>
                <input type="number" id="gen-out-time" step="0.1" value="${prob.time_limit}">
            </div>
            <div>
                <label>Memory Limit (MB)</label>
                <input type="number" id="gen-out-mem" value="${prob.memory_limit}">
            </div>
        </div>

        <label>Tags</label>
        <input type="text" id="gen-out-tags" value="${prob.tags || ''}">

        <h4 style="color: #a5f3fc; margin-top: 1.2rem; margin-bottom: 0.8rem;">Generated Test Cases (${prob.test_cases.length})</h4>
        <div>${tcHtml}</div>

        <!-- Validation Workspace -->
        <div class="tutor-section" style="margin-top: 1.5rem;">
            <h4 style="color: #fef08a;">⚠️ Validate Testcases against C++ Reference Solution</h4>
            <p style="font-size: 0.85rem; margin-bottom: 0.8rem; color:var(--text-muted);">
                Paste your C++ solution below. The system will compile it and execute it against AI input data to verify correctness.
            </p>
            <textarea id="gen-ref-code" class="code-editor" style="min-height: 160px;" placeholder="// Paste reference C++ solution here..."></textarea>
            <button class="secondary-btn" style="margin-top: 0.8rem;" onclick="validateGeneratedTests()">🧪 Validate Testcases with C++ Binary</button>
            <div id="validation-results-box" style="margin-top: 1rem;"></div>
        </div>

        <button class="primary-btn" style="margin-top: 1.5rem;" onclick="saveGeneratedProblemToDB()">💾 Save Problem to Judgely</button>
    `;
}

async function validateGeneratedTests() {
    if (!currentAIGeneratedProblem) return;
    const refCode = document.getElementById('gen-ref-code').value.trim();
    if (!refCode) {
        alert("Please paste your reference C++ solution code to validate.");
        return;
    }

    const box = document.getElementById('validation-results-box');
    box.innerHTML = '<p style="color:var(--primary); font-size:0.85rem;">Compiling solution and validating testcases...</p>';

    try {
        const res = await fetch(`${API_URL}/problems/validate-tests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                cpp_solution: refCode,
                test_cases: currentAIGeneratedProblem.test_cases
            })
        });

        if (!res.ok) throw new Error((await res.json()).detail || "Validation failed");
        const valRes = await res.json();

        let valHtml = `
            <div style="background:rgba(0,0,0,0.4); padding:1rem; border-radius:8px; border:1px solid var(--glass-border);">
                <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.6rem;">
                    Validation Results: <span style="color:#34d399;">${valRes.matched} Matched</span> / <span style="color:#f87171;">${valRes.mismatched} Mismatched</span>
                </div>
        `;

        valRes.results.forEach(r => {
            const badgeClass = r.status === 'MATCH' ? 'badge-match' : 'badge-mismatch';
            valHtml += `
                <div style="font-size:0.8rem; margin-bottom:0.5rem; padding:0.4rem; background:rgba(255,255,255,0.02); border-radius:6px;">
                    <span class="${badgeClass}">${r.status}</span> Test #${r.index}
                    ${r.status !== 'MATCH' ? `<div style="color:#f87171; margin-top:0.2rem;">Actual: ${r.actual_output} | Expected: ${r.expected_output}</div>` : ''}
                </div>
            `;
        });

        valHtml += '</div>';
        box.innerHTML = valHtml;

    } catch (err) {
        box.innerHTML = `<p style="color:var(--error); font-size:0.85rem;">Validation Error: ${err.message}</p>`;
    }
}

async function saveGeneratedProblemToDB() {
    if (!currentAIGeneratedProblem) return;

    const title = document.getElementById('gen-out-title').value;
    const description = document.getElementById('gen-out-desc').value;
    const time_limit = parseFloat(document.getElementById('gen-out-time').value);
    const memory_limit = parseInt(document.getElementById('gen-out-mem').value);
    const tags = document.getElementById('gen-out-tags').value;

    try {
        const probRes = await fetch(`${API_URL}/problems/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ title, description, time_limit, memory_limit, tags })
        });

        if (!probRes.ok) throw new Error("Failed to save problem");
        const prob = await probRes.json();

        // Save all testcases
        for (const tc of currentAIGeneratedProblem.test_cases) {
            await fetch(`${API_URL}/problems/${prob.id}/testcases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                    input_data: tc.input_data,
                    expected_output: tc.expected_output,
                    is_hidden: tc.is_hidden
                })
            });
        }

        alert("AI Problem and Testcases successfully saved to Judgely database!");
        toggleAIProblemModal();
        loadProblems();

    } catch (err) {
        alert("Error saving problem: " + err.message);
    }
}
