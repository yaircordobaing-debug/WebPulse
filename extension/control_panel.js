/**
 * WebPulse Guardian 2.1.0 | Dashboard Intelligence Engine
 */

const TRANSLATIONS = {
    en: {
        nav_overview: "Overview", nav_live: "Live Monitor", nav_ext: "Extensions", nav_storage: "Storage",
        nav_settings: "Settings", nav_help: "Engine Help", nav_forensics: "Forensics",
        sidebar_autonomous: "Fully Autonomous", stat_sessions: "Active Sessions", stat_security: "Security Integrity",
        stat_anomalies: "Anomalies", stat_optimization: "Optimization", chart_tab_perf: "Tab Performance",
        chart_risk_radar: "Risk Radar", chart_global_ram: "Global RAM Usage", live_stream_title: "Live Monitoring Stream",
        btn_hibernate_all: "Hibernate All Inactive", settings_engine_title: "Engine Sensitivity Settings",
        settings_sensitivity_label: "Detection Sensitivity", 
        settings_sensitivity_desc: "Adjust how strictly the engine identifies security and performance risks.",
        sens_low: "Safe", sens_mid: "Standard", sens_high: "Aggressive", help_manual_title: "WebPulse Guardian Manual",
        chat_title: "Guardian Assistant", ram_used: "Browser RAM",
        modal_title_sessions: "Active Sessions Breakdown", modal_title_security: "Security Status",
        modal_title_anomalies: "Detected Anomalies", modal_title_optimization: "Optimization Metrics",
        empty_storage: "No storage entries found."
    },
    es: {
        nav_overview: "Vista General", nav_live: "Monitor en Vivo", nav_ext: "Extensiones", nav_storage: "Almacenamiento",
        nav_settings: "Configuración", nav_help: "Ayuda del Motor", nav_forensics: "Análisis Forense",
        sidebar_autonomous: "Totalmente Autónomo", stat_sessions: "Sesiones Activas", stat_security: "Integridad de Seguridad",
        stat_anomalies: "Anomalías", stat_optimization: "Optimización", chart_tab_perf: "Rendimiento de Pestañas",
        chart_risk_radar: "Radar de Riesgo", chart_global_ram: "Uso Global de RAM", live_stream_title: "Monitoreo en Vivo",
        btn_hibernate_all: "Hibernar inactivas", settings_engine_title: "Ajustes de Sensibilidad",
        settings_sensitivity_label: "Sensibilidad de Detección",
        settings_sensitivity_desc: "Ajusta con qué rigor el motor identifica riesgos.",
        sens_low: "Seguro", sens_mid: "Estándar", sens_high: "Agresivo", help_manual_title: "Manual de WebPulse Guardian",
        chat_title: "Asistente Guardian", ram_used: "RAM del Navegador",
        modal_title_sessions: "Desglose de Sesiones", modal_title_security: "Estado de Seguridad",
        modal_title_anomalies: "Anomalías Detectadas", modal_title_optimization: "Métricas de Optimización",
        empty_storage: "No se encontraron entradas de almacenamiento."
    }
};

const MANUAL_CONTENT = {
    en: `<h4>1. Objective</h4><p>Prevent leaks and threats.</p><h4>2. Risk Radar</h4><p>Expansion means risk.</p>`,
    es: `<h4>1. Objetivo</h4><p>Prevenir fugas y amenazas.</p><h4>2. Radar de Riesgo</h4><p>La expansión significa riesgo.</p>`
};

document.addEventListener('DOMContentLoaded', () => {
    let currentLang = 'en';
    let globalActiveSessions = [];
    let activeSection = 'overview';
    let cpuHistory = [];

    // --- Navigation Logic ---
    const navItems = document.querySelectorAll('.deck-nav li');
    const panes = document.querySelectorAll('section');
    const viewTitle = document.getElementById('view-title');

    function switchSection(sectionId) {
        activeSection = sectionId;
        navItems.forEach(n => {
            const isActive = n.getAttribute('data-section') === sectionId;
            n.classList.toggle('active', isActive);
            if (isActive) viewTitle.textContent = n.querySelector('span').textContent;
        });
        panes.forEach(p => p.classList.toggle('active-pane', p.id === `${sectionId}-section` || p.id === sectionId + "-section"));
        refreshData(sectionId);
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => switchSection(item.getAttribute('data-section')));
    });

    function refreshData(section) {
        switch(section) {
            case 'overview': updateOverview(); break;
            case 'tabs': updateTabs(); break;
            case 'extensions': updateExtensions(); break;
            case 'cookies': updateCookies(); break;
            case 'timeline': updateTimeline(); break;
        }
    }

    // --- Localization ---
    function setLanguage(lang) {
        currentLang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (TRANSLATIONS[lang][key]) el.innerText = TRANSLATIONS[lang][key];
        });
        const manual = document.getElementById('manual-container');
        if (manual) manual.innerHTML = MANUAL_CONTENT[lang];
        document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-lang') === lang));
    }

    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
    });

    // --- System Visualization ---
    function drawSparkline(canvasId, data, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        const step = w / (data.length - 1);
        for(let i=0; i<data.length; i++) {
            const x = i * step;
            const y = h - (data[i] / 100 * h);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Fill area
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fillStyle = color + '22';
        ctx.fill();
    }

    function updateRAMGauge(usedPct) {
        const circle = document.getElementById('ram-circle');
        const pctText = document.getElementById('ram-pct');
        if (!circle || !pctText) return;
        const offset = 283 - (usedPct / 100) * 283;
        circle.style.strokeDashoffset = offset;
        pctText.textContent = `${Math.round(usedPct)}%`;
        
        // Color update based on pressure
        if (usedPct > 85) circle.style.stroke = 'var(--danger)';
        else if (usedPct > 65) circle.style.stroke = 'var(--warning)';
        else circle.style.stroke = 'var(--primary)';
    }

    function drawRadar(svgId, stats) {
        const svg = document.getElementById(svgId);
        if (!svg) return;
        const axes = [
            { x: 50, y: 50 - stats.cpu * 0.45 },
            { x: 50 + stats.ram * 0.42, y: 50 - stats.ram * 0.14 },
            { x: 50 + stats.dom * 0.26, y: 50 + stats.dom * 0.36 },
            { x: 50 - stats.net * 0.26, y: 50 + stats.net * 0.36 },
            { x: 50 - stats.sec * 0.42, y: 50 - stats.sec * 0.14 }
        ];
        const path = axes.map(p => `${p.x},${p.y}`).join(' ');
        svg.innerHTML = `
            <polygon points="50,5 93,36 76,86 24,86 7,36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
            <polygon points="${path}" fill="rgba(94, 92, 230, 0.4)" stroke="#5e5ce6" stroke-width="1.5" stroke-linejoin="round"/>
            <text x="50" y="2" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.4)" font-weight="800">CPU</text>
            <text x="96" y="38" text-anchor="start" font-size="6" fill="rgba(255,255,255,0.4)" font-weight="800">RAM</text>
            <text x="78" y="94" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.4)" font-weight="800">DOM</text>
            <text x="22" y="94" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.4)" font-weight="800">NET</text>
            <text x="4" y="38" text-anchor="end" font-size="6" fill="rgba(255,255,255,0.4)" font-weight="800">SEC</text>
        `;
    }

    // --- Overview Updates ---
    function updateOverview() {
        chrome.runtime.sendMessage({ type: "GET_GLOBAL_STATUS" }, (response) => {
            if (!response) return;
            globalActiveSessions = response.sessions;
            const sys = response.systemMetrics;

            document.getElementById('total-tabs').textContent = sys.tabCount?.total || response.sessions.length;
            document.getElementById('total-risks').textContent = response.sessions.filter(s => s.analysis.score > 50).length;
            
            // Security Integrity Calculation
            const avgScore = response.sessions.length ? response.sessions.reduce((a, b) => a + (b.analysis?.score || 0), 0) / response.sessions.length : 0;
            document.getElementById('sec-integrity').textContent = `${Math.round(100 - avgScore)}%`;

            if (sys.memory) updateRAMGauge(sys.memory.usedPct);
            
            // Draw CPU Sparkline if data exists
            if (sys.cpu?.lastSamples) {
                // Ensure we have a canvas for CPU sparkline in overview
                let canvas = document.getElementById('cpu-sparkline');
                if (!canvas) {
                    const area = document.getElementById('main-chart');
                    if (area) {
                        area.insertAdjacentHTML('beforebegin', '<canvas id="cpu-sparkline" width="600" height="80" style="width:100%; height:80px; margin-bottom:20px;"></canvas>');
                    }
                }
                drawSparkline('cpu-sparkline', sys.cpu.lastSamples, '#5e5ce6');
            }

            // Radar
            const avgStats = { cpu: 0, ram: 0, dom: 0, net: 0, sec: 0 };
            response.sessions.forEach(s => {
                avgStats.cpu += (s.cpuJitter || 0);
                avgStats.ram += (s.memory?.usedJSHeapSize || 0);
                avgStats.dom += (s.domNodes || 0);
                avgStats.net += (s.network?.requestCount || 0);
                avgStats.sec += (s.analysis.score || 0);
            });
            const count = response.sessions.length || 1;
            drawRadar('global-radar', {
                cpu: Math.min(100, (avgStats.cpu/count) * 2),
                ram: Math.min(100, (avgStats.ram/count / (300*1024*1024)) * 100),
                dom: Math.min(100, (avgStats.dom/count / 5000) * 100),
                net: Math.min(100, (avgStats.net/count) * 1.5),
                sec: Math.min(100, avgStats.sec/count)
            });

            // Tab Summary List
            const summaryList = document.getElementById('tabs-summary-list');
            if (summaryList) {
                summaryList.innerHTML = '';
                [...response.sessions].sort((a,b) => (b.memory?.usedJSHeapSize||0) - (a.memory?.usedJSHeapSize||0)).slice(0,5).forEach(s => {
                    let host = 'Browser';
                    try { host = s.url && s.url.startsWith('http') ? new URL(s.url).hostname : (s.tabTitle || 'Internal Page'); } catch(e) {}
                    const usedMB = Math.round((s.memory?.usedJSHeapSize||0)/1024/1024);
                    const row = document.createElement('div'); 
                    row.className = 'summary-row';
                    row.innerHTML = `
                        <div class="summary-info"><strong>${host}</strong></div>
                        <div class="summary-bar"><div class="summary-fill" style="width:${Math.min(100, usedMB/5)}%"></div></div>
                        <div class="summary-val">${usedMB} MB</div>
                    `;
                    summaryList.appendChild(row);
                });
            }
            
            // Recommendations (if any)
            chrome.storage.local.get(['recommendations'], (res) => {
                const recs = res.recommendations || [];
                // We could add a recommendations section in Overview
                updateRecommendations(recs);
            });
        });
    }

    function updateRecommendations(recs) {
        // Find or create recommendations container
        let container = document.getElementById('recommendations-container');
        if (!container) {
            const overview = document.getElementById('overview-section');
            if (overview) {
                const section = document.createElement('div');
                section.innerHTML = `
                    <div class="card full-card" style="margin-top:24px;">
                        <div class="card-header"><h3>Recommended Actions</h3></div>
                        <div id="recommendations-container" class="recommendations-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;"></div>
                    </div>
                `;
                overview.appendChild(section);
                container = document.getElementById('recommendations-container');
            }
        }
        if (!container) return;
        
        container.innerHTML = recs.length ? '' : '<div class="empty-state">No critical optimizations needed right now.</div>';
        recs.forEach(r => {
            const div = document.createElement('div');
            div.className = 'rec-card';
            div.style = `background:rgba(255,255,255,0.02); padding:16px; border-radius:16px; border-left:4px solid ${r.priority === 'critical' ? 'var(--danger)' : 'var(--primary)'};`;
            div.innerHTML = `
                <div style="display:flex; gap:12px; align-items:start;">
                    <span style="font-size:20px;">${r.icon}</span>
                    <div>
                        <strong style="display:block; font-size:13px;">${r.title}</strong>
                        <p style="font-size:11px; color:var(--text-dim); margin-top:4px;">${r.description}</p>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // --- Live Monitor ---
    function updateTabs() {
        chrome.runtime.sendMessage({ type: "GET_GLOBAL_STATUS" }, (response) => {
            const list = document.getElementById('tabs-list'); 
            if (!list) return;
            list.innerHTML = '';
            if (!response) return;
            response.sessions.forEach(s => {
                let host = 'Browser';
                try { host = s.url && s.url.startsWith('http') ? new URL(s.url).hostname : (s.tabTitle || 'Internal Page'); } catch(e) {}
                
                // Determine display values for metrics
                let memDisplay = `${Math.round((s.memory?.usedJSHeapSize||0)/1024/1024)} MB`;
                let domDisplay = `${s.domNodes || 0} Nodes`;
                let statusLabel = `<span class="risk-tag tag-${s.analysis?.level || 'Low'}">${s.analysis?.level || 'Low'}</span>`;
                
                if (s.discarded) {
                    memDisplay = '<span class="status-label">HIBERNATED</span>';
                    domDisplay = '<span class="status-label">No process</span>';
                } else if (s.restricted) {
                    memDisplay = '<span class="status-label protected">PROTECTED</span>';
                    domDisplay = '<span class="status-label protected">System UI</span>';
                } else if (s.isFile) {
                    memDisplay = '<span class="status-label warning">LOCAL FILE</span>';
                    domDisplay = '<span class="status-label warning">Sandbox</span>';
                } else if (s.domNodes === 0) {
                    memDisplay = '<span class="status-label info">INITIALIZING</span>';
                    domDisplay = '<span class="status-label info">Waiting...</span>';
                }

                const item = document.createElement('div'); 
                item.className = 'list-item';
                item.innerHTML = `
                    <div class="item-info">
                        <div class="title">${host}</div>
                        <div class="subtitle">${s.url || 'Internal Browser Page'}</div>
                    </div>
                    <div>${statusLabel}</div>
                    <div class="item-data">
                        <strong>${memDisplay}</strong>
                        <p>${domDisplay}</p>
                    </div>
                    <div class="item-actions">
                        <button class="btn-zzz" data-id="${s.id}" title="Hibernate Tab" ${s.discarded ? 'disabled' : ''}><i data-lucide="${s.discarded ? 'cloud-off' : 'moon'}"></i></button>
                    </div>
                `;
                list.appendChild(item);
                item.querySelector('.btn-zzz').onclick = () => {
                    chrome.runtime.sendMessage({ type: "HIBERNATE_TAB", tabId: s.id }, updateTabs);
                };
            });
            lucide.createIcons();
        });
    }

    // --- Extensions Manager ---
    function updateExtensions() {
        chrome.runtime.sendMessage({ type: "GET_EXTENSIONS" }, (extensions) => {
            const grid = document.getElementById('extensions-list'); 
            if (!grid) return;
            grid.innerHTML = '';
            extensions.filter(e => e.type === 'extension').forEach(ext => {
                const icon = ext.icons ? ext.icons[ext.icons.length - 1].url : '';
                const card = document.createElement('div'); 
                card.className = 'ext-card';
                card.innerHTML = `
                    <div class="ext-header">
                        <img src="${icon}" class="ext-icon" onerror="this.src='webpulse_icon_128_1776037802458.png'">
                        <div class="ext-titles"><strong>${ext.name}</strong><p>${ext.version}</p></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:700; color:${ext.enabled ? 'var(--success)' : 'var(--text-dim)'}">${ext.enabled ? 'ACTIVE' : 'PAUSED'}</span>
                        <label class="switch">
                            <input type="checkbox" ${ext.enabled ? 'checked' : ''} data-id="${ext.id}">
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
                grid.appendChild(card);
                card.querySelector('input').onchange = (e) => {
                    chrome.runtime.sendMessage({ type: "TOGGLE_EXTENSION", id: ext.id, enabled: e.target.checked }, updateExtensions);
                };
            });
        });
    }

    // --- Storage / Cookies ---
    function updateCookies() {
        chrome.runtime.sendMessage({ type: "GET_COOKIES" }, (cookies) => {
            const list = document.getElementById('cookies-list'); 
            const searchInput = document.getElementById('cookie-search');
            if (!list) return;
            list.innerHTML = '';
            
            if (!cookies || cookies.length === 0) {
                list.innerHTML = `<div class="empty-state" data-i18n="empty_storage">${TRANSLATIONS[currentLang].empty_storage || "No storage entries found."}</div>`;
                return;
            }
            
            const filter = searchInput ? searchInput.value.toLowerCase() : '';
            
            const groups = cookies.reduce((acc, c) => {
                if (filter && !c.domain.toLowerCase().includes(filter)) return acc;
                acc[c.domain] = acc[c.domain] || [];
                acc[c.domain].push(c);
                return acc;
            }, {});
            
            const domains = Object.keys(groups);
            if (domains.length === 0) {
                list.innerHTML = `<div class="empty-state">No domains match your search.</div>`;
                return;
            }

            domains.slice(0, 25).forEach(domain => {
                const div = document.createElement('div'); 
                div.className = 'domain-group';
                div.innerHTML = `
                    <div class="domain-header">
                        <h4>${domain}</h4>
                        <div class="domain-actions">
                            <span style="font-size:11px; color:var(--text-dim); margin-right:12px;">${groups[domain].length} cookies</span>
                            <button class="btn-clean" data-domain="${domain}"><i data-lucide="trash-2"></i> Clean</button>
                        </div>
                    </div>
                `;
                list.appendChild(div);
                div.querySelector('.btn-clean').onclick = () => {
                    groups[domain].forEach(c => {
                        const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
                        chrome.runtime.sendMessage({ type: "REMOVE_COOKIE", url, name: c.name }, updateCookies);
                    });
                };
            });
            lucide.createIcons();
        });
    }

    // Add search listener for cookies
    const cookieSearch = document.getElementById('cookie-search');
    if (cookieSearch) {
        cookieSearch.addEventListener('input', () => updateCookies());
    }

    // --- Forensics Timeline ---
    function updateTimeline() {
        chrome.storage.local.get(['forensicLogs'], (d) => {
            const l = document.getElementById('timeline-list');
            if (!l) return;
            const logs = d.forensicLogs || [];
            l.innerHTML = logs.length ? '' : '<div class="empty-state">No events recorded.</div>';
            logs.forEach(log => {
                const div = document.createElement('div');
                div.className = `event-entry severity-${log.severity}`;
                div.innerHTML = `
                    <div class="event-icon-box"><i data-lucide="${log.type === 'MITIGATION' ? 'zap' : 'shield'}"></i></div>
                    <div class="event-data">
                        <div class="time">${new Date(log.timestamp).toLocaleTimeString()}</div>
                        <div class="msg">${log.message}</div>
                        <div class="type">${log.type}</div>
                    </div>
                `;
                l.appendChild(div);
            });
            lucide.createIcons();
        });
    }

    // --- Chat Assistant Logic ---
    const chatBubble = document.getElementById('chat-widget');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');
    const chatMsgs = document.getElementById('chat-msgs');

    if (chatBubble) {
        chatBubble.onclick = () => chatWindow.classList.toggle('hidden');
    }
    if (closeChat) {
        closeChat.onclick = () => chatWindow.classList.add('hidden');
    }

    document.querySelectorAll('.chat-q').forEach(btn => {
        btn.onclick = () => {
            const q = btn.innerText;
            addChatMessage('user', q);
            
            // Dynamic Response Logic
            setTimeout(() => {
                let reply = "I'm analyzing your browser data...";
                if (q.includes("Risk")) reply = "The Risk Radar visualizes 5 axes: CPU, RAM, DOM complexity, Network resources, and Security. A larger area means higher risk.";
                if (q.includes("hibernate")) reply = "You can hibernate tabs by clicking the moon icon in the Live Monitor. This frees up RAM while keeping the tab in your browser.";
                if (q.includes("safe")) reply = "WebPulse Guardian is 100% local. We monitor performance and security signals to protect your browsing experience without sending data to external servers.";
                addChatMessage('bot', reply);
            }, 600);
        };
    });

    function addChatMessage(role, text) {
        const div = document.createElement('div');
        div.className = role === 'user' ? 'user-msg' : 'bot-msg';
        div.innerText = text;
        chatMsgs.appendChild(div);
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }

    // --- Modal Logic ---
    const modal = document.getElementById('stat-modal');
    const closeModal = document.getElementById('close-modal');
    if (closeModal) {
        closeModal.onclick = () => modal.classList.add('hidden');
    }

    // --- Init ---
    setLanguage('en');
    switchSection('overview');
    setInterval(() => refreshData(activeSection), 3000);

    // Sensitivity Settings Logic
    document.querySelectorAll('.btn-sens').forEach(btn => {
        btn.onclick = () => {
            const level = btn.getAttribute('data-level');
            chrome.runtime.sendMessage({ type: "SET_SENSITIVITY", level }, () => {
                document.querySelectorAll('.btn-sens').forEach(b => b.classList.toggle('active', b === btn));
            });
        };
    });
});
