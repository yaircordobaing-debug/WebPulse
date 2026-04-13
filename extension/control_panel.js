/**
 * WebPulse Guardian 2.0.6 | Dashboard Stability & Intuition Engine
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
        modal_title_anomalies: "Detected Anomalies", modal_title_optimization: "Optimization Metrics"
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
        modal_title_anomalies: "Anomalías Detectadas", modal_title_optimization: "Métricas de Optimización"
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

    // --- Navigation Logic (RESTORATION) ---
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
        panes.forEach(p => p.classList.toggle('active-pane', p.id === `${sectionId}-section`));
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
        document.getElementById('manual-container').innerHTML = MANUAL_CONTENT[lang];
        document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-lang') === lang));
    }

    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
    });

    // --- Radar logic (RESTORATION) ---
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
            <text x="50" y="-3" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">CPU</text>
            <text x="100" y="38" text-anchor="start" font-size="7" fill="rgba(255,255,255,0.5)">RAM</text>
            <text x="80" y="96" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">DOM</text>
            <text x="20" y="96" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">NET</text>
            <text x="0" y="38" text-anchor="end" font-size="7" fill="rgba(255,255,255,0.5)">SEC</text>
        `;
    }

    // --- RAM Gauge Update ---
    function updateRAMGauge(mbUsed) {
        const pct = Math.min(100, (mbUsed / 4096) * 100);
        const circle = document.getElementById('ram-circle');
        const pctText = document.getElementById('ram-pct');
        if (!circle) return;
        const offset = 283 - (pct / 100) * 283;
        circle.style.strokeDashoffset = offset;
        pctText.textContent = `${pct.toFixed(1)}%`;
    }

    // --- Modal Intuition (POLISH) ---
    const modal = document.getElementById('stat-modal');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const closeModal = document.getElementById('close-modal');

    window.onclick = (event) => { if (event.target == modal) modal.classList.add('hidden'); };
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));

    document.querySelectorAll('.drill-down').forEach(box => {
        box.addEventListener('click', () => {
            const type = box.getAttribute('data-type');
            showDrillDown(type);
        });
    });

    function showDrillDown(type) {
        modalTitle.textContent = TRANSLATIONS[currentLang][`modal_title_${type}`];
        modalBody.innerHTML = '';
        modal.classList.remove('hidden');
        if (type === 'anomalies') {
            const anomalies = globalActiveSessions.filter(s => s.analysis.reasons.length > 0);
            if (!anomalies.length) modalBody.innerHTML = '<div class="empty-state">No anomalies detected.</div>';
            else anomalies.forEach(s => {
                s.analysis.reasons.forEach(reason => {
                    const div = document.createElement('div');
                    div.className = 'drill-item';
                    div.innerHTML = `<span class="label">${new URL(s.url).hostname}</span><span class="val risk-tag tag-${s.analysis.level}">${reason}</span>`;
                    modalBody.appendChild(div);
                });
            });
        } else if (type === 'sessions') {
            globalActiveSessions.forEach(s => {
                const div = document.createElement('div');
                div.className = 'drill-item';
                div.innerHTML = `<span class="label">${new URL(s.url).hostname}</span><span class="val">${Math.round(s.memory.usedJSHeapSize/1024/1024)} MB</span>`;
                modalBody.appendChild(div);
            });
        }
    }

    // --- Data Refresh Loops ---
    function updateOverview() {
        chrome.runtime.sendMessage({ type: "GET_GLOBAL_STATUS" }, (response) => {
            if (!response) return;
            globalActiveSessions = response.sessions;
            document.getElementById('total-tabs').textContent = response.sessions.length;
            document.getElementById('total-risks').textContent = response.sessions.filter(s => s.analysis.score > 50).length;

            let totalMem = 0;
            const avgStats = { cpu: 0, ram: 0, dom: 0, net: 0, sec: 0 };
            response.sessions.forEach(s => {
                totalMem += (s.memory?.usedJSHeapSize || 0);
                avgStats.cpu += (s.cpuJitter || 0);
                avgStats.dom += s.domNodes;
                avgStats.net += (s.network?.requestCount || 0);
                avgStats.sec += (s.analysis.score || 0);
            });
            const count = response.sessions.length || 1;
            updateRAMGauge(totalMem / 1024 / 1024);
            drawRadar('global-radar', {
                cpu: Math.min(100, (avgStats.cpu/count) * 2),
                ram: Math.min(100, (totalMem/count / (300*1024*1024)) * 100),
                dom: Math.min(100, (avgStats.dom/count / 5000) * 100),
                net: Math.min(100, (avgStats.net/count) * 1.5),
                sec: Math.min(100, avgStats.sec/count)
            });

            const summaryList = document.getElementById('tabs-summary-list');
            summaryList.innerHTML = '';
            [...response.sessions].sort((a,b) => (b.memory?.usedJSHeapSize||0) - (a.memory?.usedJSHeapSize||0)).slice(0,5).forEach(s => {
                const row = document.createElement('div'); row.className = 'summary-row';
                row.innerHTML = `<div class="summary-info"><strong>${new URL(s.url).hostname}</strong></div><div class="summary-bar"><div class="summary-fill" style="width:${Math.min(100, (s.memory?.usedJSHeapSize||0)/500/1024/1024*100)}%"></div></div><div class="summary-val">${Math.round(s.memory?.usedJSHeapSize/1024/1024)} MB</div>`;
                summaryList.appendChild(row);
            });
            lucide.createIcons();
        });
    }

    function updateTabs() {
        chrome.runtime.sendMessage({ type: "GET_GLOBAL_STATUS" }, (response) => {
            const list = document.getElementById('tabs-list'); list.innerHTML = '';
            if (!response) return;
            response.sessions.forEach(s => {
                const item = document.createElement('div'); item.className = 'list-item';
                item.innerHTML = `
                    <div class="item-info"><div class="title">${new URL(s.url).hostname}</div><div class="subtitle">${s.url}</div></div>
                    <div><span class="risk-tag tag-${s.analysis.level}">${s.analysis.level}</span></div>
                    <div class="item-data"><strong>${Math.round(s.memory.usedJSHeapSize/1024/1024)} MB</strong><p>${s.domNodes} Nodes</p></div>
                    <div class="item-actions"><button class="btn-zzz" data-id="${s.id}"><i data-lucide="moon"></i></button></div>
                `;
                list.appendChild(item);
                item.querySelector('.btn-zzz').onclick = () => chrome.tabs.discard(s.id, updateTabs);
            });
            lucide.createIcons();
        });
    }

    function updateExtensions() {
        chrome.runtime.sendMessage({ type: "GET_EXTENSIONS" }, (extensions) => {
            const grid = document.getElementById('extensions-list'); grid.innerHTML = '';
            extensions.filter(e => e.type === 'extension').forEach(ext => {
                const card = document.createElement('div'); card.className = 'ext-card';
                card.innerHTML = `
                    <div class="ext-header"><img src="${ext.icons?.[ext.icons.length-1]?.url||''}" class="ext-icon"><div class="ext-titles"><strong>${ext.name}</strong><p>${ext.version}</p></div></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:11px; font-weight:700; color:${ext.enabled?'var(--success)':'var(--text-dim)'}">${ext.enabled?'ACTIVE':'PAUSED'}</span>
                    <label class="switch"><input type="checkbox" ${ext.enabled?'checked':''} data-id="${ext.id}"><span class="slider"></span></label></div>
                `;
                grid.appendChild(card);
                card.querySelector('input').onchange = (e) => chrome.runtime.sendMessage({ type: "TOGGLE_EXTENSION", id: ext.id, enabled: e.target.checked }, updateExtensions);
            });
        });
    }

    function updateCookies() {
        chrome.runtime.sendMessage({ type: "GET_COOKIES" }, (cookies) => {
            const list = document.getElementById('cookies-list'); list.innerHTML = '';
            if (!cookies) return;
            const groups = cookies.reduce((acc, c) => { acc[c.domain] = acc[c.domain] || []; acc[c.domain].push(c); return acc; }, {});
            Object.keys(groups).slice(0, 15).forEach(d => {
                const div = document.createElement('div'); div.className = 'domain-group';
                div.innerHTML = `<div class="domain-header"><h4>${d}</h4><button class="btn-clean" onclick="chrome.runtime.sendMessage({type:'REMOVE_COOKIE', domain:'${d}'})"><i data-lucide="trash-2"></i> Clean</button></div>`;
                list.appendChild(div);
            });
            lucide.createIcons();
        });
    }

    function updateTimeline() {
        chrome.storage.local.get(['forensicLogs'], (d) => {
            const l = document.getElementById('timeline-list');
            l.innerHTML = (d.forensicLogs || []).map(log => `<div class="event-entry"><div class="event-icon-box"><i data-lucide="shield"></i></div><div class="event-data"><div class="time">${new Date(log.timestamp).toLocaleTimeString()}</div><div class="msg">${log.message}</div></div></div>`).join('');
            lucide.createIcons();
        });
    }

    // --- Init ---
    setLanguage('en');
    updateOverview();
    setInterval(() => refreshData(activeSection), 3000);
});
