/**
 * WebPulse Guardian 2.1.0 - Content Sentinel
 * Captura Web Vitals, Navigation Timing, métricas de página en tiempo real.
 */
(function () {
  'use strict';
  if (window.__wpg_injected) return;
  window.__wpg_injected = true;

  // ── Estado interno ──
  let lastHeapSize = 0;
  let jitterSamples = [];
  let lastFrameTime = performance.now();
  let metricHistory = [];           // últimos 30 puntos para sparklines
  let shadowRoot = null;
  let modalVisible = false;

  // Web Vitals acumulados
  const vitals = { lcp: 0, fid: 0, cls: 0, ttfb: 0, fcp: 0 };

  // ── CPU Jitter via rAF ──
  function monitorJitter() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    const jitter = Math.max(0, delta - 16.67);
    jitterSamples.push(jitter);
    if (jitterSamples.length > 60) jitterSamples.shift();
    lastFrameTime = now;
    requestAnimationFrame(monitorJitter);
  }
  requestAnimationFrame(monitorJitter);

  // ── Web Vitals via PerformanceObserver ──
  function initWebVitals() {
    // LCP
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // FID
    try {
      new PerformanceObserver((list) => {
        const e = list.getEntries()[0];
        if (e) vitals.fid = e.processingStart - e.startTime;
      }).observe({ type: 'first-input', buffered: true });
    } catch {}

    // CLS
    try {
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        vitals.cls = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    // FCP + TTFB via Navigation Timing
    if (performance.getEntriesByType) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        vitals.ttfb = Math.round(nav.responseStart - nav.requestStart);
        vitals.fcp = Math.round(nav.domContentLoadedEventEnd - nav.fetchStart);
      }
    }
  }
  initWebVitals();

  // ── Tracker / 3rd-party detection ──
  function detectTrackers() {
    const hostname = location.hostname;
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const thirdParty = scripts.filter(s => {
      try { return new URL(s.src).hostname !== hostname; } catch { return false; }
    });
    const cookieCount = document.cookie ? document.cookie.split(';').length : 0;
    return thirdParty.length + cookieCount;
  }

  // ── Navigation Timing ──
  function getPageLoad() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
      fullLoad: Math.round(nav.loadEventEnd - nav.fetchStart),
      redirectCount: nav.redirectCount
    };
  }

  // ── Colectar métricas ──
  function collectMetrics() {
    const memory = window.performance?.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : null;

    let heapGrowthRate = 0;
    if (memory) {
      if (lastHeapSize > 0) heapGrowthRate = (memory.usedJSHeapSize - lastHeapSize) / lastHeapSize;
      lastHeapSize = memory.usedJSHeapSize;
    }

    const jitter = jitterSamples.length ? jitterSamples.reduce((a, b) => a + b, 0) / jitterSamples.length : 0;
    const resourceEntries = performance.getEntriesByType('resource');

    const metrics = {
      memory,
      heapGrowthRate,
      cpuJitter: Math.round(jitter * 10) / 10,
      domNodes: document.getElementsByTagName('*').length,
      isHttps: location.protocol === 'https:',
      trackersCount: detectTrackers(),
      securityFlags: { evalDetected: false },
      network: {
        requestCount: resourceEntries.length,
        transferSize: resourceEntries.reduce((a, e) => a + (e.transferSize || 0), 0)
      },
      webVitals: { ...vitals },
      pageLoad: getPageLoad(),
      url: location.href
    };

    // Guardar historial para sparklines
    const point = { ts: Date.now(), mem: Math.round((memory?.usedJSHeapSize || 0) / 1024 / 1024), cpu: Math.round(jitter) };
    metricHistory.push(point);
    if (metricHistory.length > 30) metricHistory.shift();
    metrics.history = metricHistory;

    updateUI(metrics);
    return metrics;
  }

  // ── UI: Sentinel Overlay ──
  function setupOverlay() {
    if (document.getElementById('webpulse-guardian-root')) return;
    const host = document.createElement('div');
    host.id = 'webpulse-guardian-root';
    Object.assign(host.style, { position: 'fixed', zIndex: '2147483647', top: '0', left: '0', pointerEvents: 'none' });
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    const styles = `
      :host { font-family: 'Inter', system-ui, sans-serif; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .pulse-trigger {
        position: fixed; bottom: 24px; right: 24px; width: 52px; height: 52px;
        background: rgba(10,12,20,0.92); backdrop-filter: blur(16px);
        border: 1px solid rgba(94,92,230,0.5); border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 0 rgba(94,92,230,0.4);
        transition: all 0.3s; pointer-events: all;
        animation: orb-pulse 3s ease-in-out infinite;
      }
      .pulse-trigger:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(94,92,230,0.4); }
      @keyframes orb-pulse {
        0%,100% { box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 0 rgba(94,92,230,0.3); }
        50% { box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 8px rgba(94,92,230,0); }
      }
      .orb { width: 16px; height: 16px; background: linear-gradient(135deg, #5e5ce6, #38bdf8); border-radius: 50%; }

      .sentinel-modal {
        position: fixed; bottom: 88px; right: 24px; width: 340px;
        background: rgba(13,15,22,0.95); backdrop-filter: blur(24px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
        padding: 0; color: #fff; box-shadow: 0 32px 80px rgba(0,0,0,0.7);
        display: none; opacity: 0; transform: translateY(16px) scale(0.97);
        transition: all 0.35s cubic-bezier(0.23, 1, 0.32, 1);
        pointer-events: all; overflow: hidden;
      }
      .sentinel-modal.visible { display: block; opacity: 1; transform: translateY(0) scale(1); }

      .modal-header {
        padding: 18px 20px 14px; display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
      }
      .brand { font-size: 14px; font-weight: 800; letter-spacing: -0.3px; }
      .brand .v { color: #5e5ce6; font-weight: 400; font-size: 11px; margin-left: 3px; }
      .badge { font-size: 9px; font-weight: 800; padding: 4px 9px; border-radius: 6px; letter-spacing: 0.05em; }
      .badge.low  { background: rgba(43,212,125,0.15); color: #2bd47d; border: 1px solid rgba(43,212,125,0.3); }
      .badge.med  { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
      .badge.high { background: rgba(255,92,92,0.15);  color: #ff5c5c; border: 1px solid rgba(255,92,92,0.3); }
      .badge.init { background: rgba(94,92,230,0.15);  color: #5e5ce6; border: 1px solid rgba(94,92,230,0.3); }

      .modal-body { padding: 16px 20px 20px; }

      .radar-wrap { display: flex; justify-content: center; margin-bottom: 16px; }

      .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
      .stat-card {
        background: rgba(255,255,255,0.04); padding: 11px 13px; border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .stat-card label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 3px; }
      .stat-card .val { font-size: 16px; font-weight: 800; }
      .stat-card .sub { font-size: 9px; color: #64748b; margin-top: 1px; }

      .vitals-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 12px; }
      .vital-chip {
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px; padding: 8px 10px; text-align: center;
      }
      .vital-chip label { font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; }
      .vital-chip .v { font-size: 13px; font-weight: 800; }
      .vital-chip.good .v { color: #2bd47d; }
      .vital-chip.warn .v { color: #f59e0b; }
      .vital-chip.bad  .v { color: #ff5c5c; }

      .tracker-row {
        display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
        font-size: 11px; margin-bottom: 12px; color: #94a3b8;
      }
      .tracker-row svg { flex-shrink: 0; }

      .btn-dashboard {
        width: 100%; background: linear-gradient(135deg, #5e5ce6, #4f4dd4); color: #fff;
        border: none; padding: 11px; border-radius: 12px; font-weight: 800; font-size: 11px;
        cursor: pointer; transition: all 0.2s; letter-spacing: 0.03em;
      }
      .btn-dashboard:hover { transform: translateY(-1px); filter: brightness(1.1); box-shadow: 0 8px 20px rgba(94,92,230,0.4); }
    `;

    const container = document.createElement('div');
    container.innerHTML = `
      <style>${styles}</style>
      <div id="trigger" class="pulse-trigger"><div class="orb"></div></div>
      <div id="modal" class="sentinel-modal">
        <div class="modal-header">
          <div class="brand">WebPulse <strong>Guardian</strong><span class="v">2.1</span></div>
          <div id="risk-badge" class="badge init">ANALIZANDO</div>
        </div>
        <div class="modal-body">
          <div class="radar-wrap">
            <svg id="radar-svg" width="160" height="160" viewBox="0 0 100 100"></svg>
          </div>
          <div class="stats-grid">
            <div class="stat-card"><label>Memory</label><div id="v-mem" class="val">--</div><div class="sub" id="v-mem-sub"></div></div>
            <div class="stat-card"><label>CPU Jitter</label><div id="v-cpu" class="val">--</div><div class="sub">UI Thread</div></div>
            <div class="stat-card"><label>DOM Nodes</label><div id="v-dom" class="val">--</div><div class="sub" id="v-dom-sub"></div></div>
            <div class="stat-card"><label>Recursos Net</label><div id="v-net" class="val">--</div><div class="sub" id="v-net-sub"></div></div>
          </div>
          <div class="vitals-row">
            <div class="vital-chip" id="chip-lcp"><label>LCP</label><div class="v" id="v-lcp">--</div></div>
            <div class="vital-chip" id="chip-fid"><label>FID</label><div class="v" id="v-fid">--</div></div>
            <div class="vital-chip" id="chip-cls"><label>CLS</label><div class="v" id="v-cls">--</div></div>
          </div>
          <div class="tracker-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5e5ce6" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span id="v-trackers">Detectando trackers...</span>
          </div>
          <button id="btn-dash" class="btn-dashboard">ABRIR PANEL DE CONTROL</button>
        </div>
      </div>
    `;
    shadowRoot.appendChild(container);

    shadowRoot.getElementById('trigger').addEventListener('click', () => {
      modalVisible = !modalVisible;
      shadowRoot.getElementById('modal').classList.toggle('visible', modalVisible);
    });

    shadowRoot.getElementById('btn-dash').addEventListener('click', (e) => {
      const btn = e.target;
      btn.textContent = 'ABRIENDO...';
      if (!chrome.runtime?.id) { btn.textContent = 'RECARGA LA PÁGINA'; btn.style.background = '#ff5c5c'; return; }
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }, () => {
        if (chrome.runtime.lastError) { btn.textContent = 'RECARGA LA EXTENSIÓN'; btn.style.background = '#ff5c5c'; }
        else { btn.textContent = 'ABRIR PANEL DE CONTROL'; }
      });
    });
  }

  function drawRadar(s) {
    const svg = shadowRoot?.getElementById('radar-svg');
    if (!svg) return;
    const pts = [
      { x: 50, y: 50 - s.cpu * 0.43 },
      { x: 50 + s.ram * 0.40, y: 50 - s.ram * 0.13 },
      { x: 50 + s.dom * 0.25, y: 50 + s.dom * 0.35 },
      { x: 50 - s.net * 0.25, y: 50 + s.net * 0.35 },
      { x: 50 - s.sec * 0.40, y: 50 - s.sec * 0.13 }
    ];
    const path = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    svg.innerHTML = `
      <polygon points="50,5 93,36 76,86 24,86 7,36" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
      <polygon points="50,27 71,43 63,68 37,68 29,43" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <line x1="50" y1="5" x2="50" y2="86" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
      <line x1="7" y1="36" x2="93" y2="36" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
      <polygon points="${path}" fill="rgba(94,92,230,0.3)" stroke="#5e5ce6" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="50" y="2" text-anchor="middle" font-size="6.5" fill="rgba(255,255,255,0.5)" font-weight="700">CPU</text>
      <text x="97" y="38" text-anchor="start" font-size="6.5" fill="rgba(255,255,255,0.5)" font-weight="700">RAM</text>
      <text x="78" y="95" text-anchor="middle" font-size="6.5" fill="rgba(255,255,255,0.5)" font-weight="700">DOM</text>
      <text x="22" y="95" text-anchor="middle" font-size="6.5" fill="rgba(255,255,255,0.5)" font-weight="700">NET</text>
      <text x="3" y="38" text-anchor="end" font-size="6.5" fill="rgba(255,255,255,0.5)" font-weight="700">SEC</text>
    `;
  }

  function colorVal(val, low, high) {
    if (val < low) return '#2bd47d';
    if (val < high) return '#f59e0b';
    return '#ff5c5c';
  }

  function updateUI(m) {
    if (!shadowRoot) return;
    const usedMB = Math.round((m.memory?.usedJSHeapSize || 0) / 1024 / 1024);
    const limitMB = Math.round((m.memory?.jsHeapSizeLimit || 0) / 1024 / 1024);

    const set = (id, txt) => { const el = shadowRoot.getElementById(id); if (el) el.textContent = txt; };
    const style = (id, css) => { const el = shadowRoot.getElementById(id); if (el) Object.assign(el.style, css); };

    set('v-mem', `${usedMB}MB`);
    set('v-mem-sub', limitMB ? `Límite: ${limitMB}MB` : '');
    style('v-mem', { color: colorVal(usedMB, 200, 400) });

    set('v-cpu', `${m.cpuJitter.toFixed(1)}ms`);
    style('v-cpu', { color: colorVal(m.cpuJitter, 16, 50) });

    set('v-dom', m.domNodes.toLocaleString());
    set('v-dom-sub', m.domNodes > 5000 ? '⚠ Complejo' : 'Normal');
    style('v-dom', { color: colorVal(m.domNodes, 2000, 5000) });

    set('v-net', `${m.network.requestCount}`);
    const netKB = Math.round(m.network.transferSize / 1024);
    set('v-net-sub', `${netKB > 1000 ? (netKB/1000).toFixed(1)+'MB' : netKB+'KB'} transferidos`);

    set('v-trackers', `${m.trackersCount} señales de tracking detectadas`);

    // Web Vitals
    const lcp = m.webVitals.lcp;
    const lcpTxt = lcp > 0 ? `${(lcp/1000).toFixed(1)}s` : '--';
    set('v-lcp', lcpTxt);
    const chipLcp = shadowRoot.getElementById('chip-lcp');
    if (chipLcp) chipLcp.className = 'vital-chip ' + (lcp === 0 ? '' : lcp < 2500 ? 'good' : lcp < 4000 ? 'warn' : 'bad');

    const fid = m.webVitals.fid;
    set('v-fid', fid > 0 ? `${Math.round(fid)}ms` : '--');
    const chipFid = shadowRoot.getElementById('chip-fid');
    if (chipFid) chipFid.className = 'vital-chip ' + (fid === 0 ? '' : fid < 100 ? 'good' : fid < 300 ? 'warn' : 'bad');

    const cls = m.webVitals.cls;
    set('v-cls', cls > 0 ? cls.toFixed(3) : '--');
    const chipCls = shadowRoot.getElementById('chip-cls');
    if (chipCls) chipCls.className = 'vital-chip ' + (cls === 0 ? '' : cls < 0.1 ? 'good' : cls < 0.25 ? 'warn' : 'bad');

    // Radar
    const radarStats = {
      cpu: Math.min(100, m.cpuJitter * 2),
      ram: Math.min(100, (m.memory?.usedJSHeapSize || 0) / (400 * 1024 * 1024) * 100),
      dom: Math.min(100, m.domNodes / 5000 * 100),
      net: Math.min(100, m.network.requestCount / 2),
      sec: m.isHttps ? (m.trackersCount > 10 ? 50 : 20) : 100
    };
    drawRadar(radarStats);

    // Badge de riesgo
    const riskScore = (radarStats.cpu + radarStats.ram + radarStats.dom + radarStats.net + radarStats.sec) / 5;
    const badge = shadowRoot.getElementById('risk-badge');
    if (badge) {
      if (riskScore < 25)      { badge.textContent = 'SEGURO';     badge.className = 'badge low'; }
      else if (riskScore < 55) { badge.textContent = 'MODERADO';   badge.className = 'badge med'; }
      else                     { badge.textContent = 'ALTO RIESGO'; badge.className = 'badge high'; }
    }
  }

  function safeSend(message) {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(message, () => { chrome.runtime.lastError; });
    }
  }

  // ── Inicializar ──
  if (document.body) {
    setupOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', setupOverlay);
  }

  const initialMetrics = collectMetrics();
  safeSend({ type: 'METRICS_UPDATE', data: initialMetrics });

  setInterval(() => {
    const m = collectMetrics();
    safeSend({ type: 'METRICS_UPDATE', data: m });
  }, 4000);

})();
