/**
 * WebPulse Guardian 2.0 - Content Sentinel 
 * Injected into pages for autonomous telemetry.
 */

(function() {
  let lastHeapSize = 0;
  let heapGrowthSamples = [];
  let mutationCount = 0;
  
  // CPU Jitter Monitoring
  let lastFrameTime = performance.now();
  let jitterSamples = [];
  
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

  // --- UI Injection ---
  let shadowRoot;
  let modalVisible = false;

  function setupOverlay() {
    const host = document.createElement('div');
    host.id = 'webpulse-guardian-root';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    const styles = `
      :host { font-family: 'Inter', system-ui, sans-serif; }
      .pulse-trigger {
        position: fixed; bottom: 20px; right: 20px; width: 54px; height: 54px;
        background: rgba(15, 17, 21, 0.85); backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); z-index: 2147483647;
      }
      .pulse-inner { width: 14px; height: 14px; background: #38bdf8; border-radius: 50%; position: relative; }
      .pulse-inner::after {
        content: ''; position: absolute; width: 100%; height: 100%; border: 2px solid #38bdf8;
        border-radius: 50%; animation: pulse 2s infinite;
      }
      @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }

      .sentinel-modal {
        position: fixed; bottom: 90px; right: 20px; width: 340px;
        background: rgba(26, 29, 35, 0.9); backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
        padding: 24px; color: #fff; box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        display: none; opacity: 0; transform: translateY(20px); transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      }
      .sentinel-modal.visible { display: block; opacity: 1; transform: translateY(0); }
      
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .brand { font-size: 16px; font-weight: 800; }
      .brand span { color: #38bdf8; font-weight: 400; font-size: 13px; margin-left: 4px; }
      
      .badge { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
      .badge.low { background: rgba(43, 212, 125, 0.2); color: #2bd47d; }
      .badge.medium { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
      .badge.high { background: rgba(255, 92, 92, 0.2); color: #ff5c5c; }

      .radar-container { width: 100%; height: 180px; margin-bottom: 24px; display: flex; justify-content: center; position: relative; }
      .radar-label { font-size: 8px; fill: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; }

      .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stat-card { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
      .stat-card label { font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; display: block; }
      .stat-card .val { font-size: 15px; font-weight: 700; }
      
      .tracker-status { margin: 15px 0; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.03); font-size: 11px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.05); }
      
      .btn-action { width: 100%; background: #38bdf8; color: #000; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 12px; cursor: pointer; margin-top: 15px; transition: all 0.2s; }
      .btn-action:hover { background: #0ea5e9; transform: translateY(-1px); }
    `;

    const container = document.createElement('div');
    container.innerHTML = `
      <style>${styles}</style>
      <div id="trigger" class="pulse-trigger"><div class="pulse-inner"></div></div>
      <div id="modal" class="sentinel-modal">
        <div class="header">
          <div class="brand">WebPulse <strong>Guardian</strong><span>2.0</span></div>
          <div id="risk-level" class="badge">INIT...</div>
        </div>
        
        <div class="radar-container">
          <svg id="radar-chart" width="180" height="180" viewBox="0 0 100 100"></svg>
        </div>

        <div class="stats-grid">
          <div class="stat-card"><label>Memory</label><div id="val-mem" class="val">--</div></div>
          <div class="stat-card"><label>CPU Jitter</label><div id="val-cpu" class="val">--</div></div>
          <div class="stat-card"><label>DOM Nodes</label><div id="val-dom" class="val">--</div></div>
          <div class="stat-card"><label>Net Stream</label><div id="val-net" class="val">--</div></div>
        </div>
        
        <div class="tracker-status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span id="tracker-msg">Scanning trackers...</span>
        </div>
        
        <button id="btn-dashboard" class="btn-action">OPEN CONTROL CENTER</button>
      </div>
    `;

    shadowRoot.appendChild(container);

    shadowRoot.getElementById('trigger').addEventListener('click', () => {
      modalVisible = !modalVisible;
      shadowRoot.getElementById('modal').classList.toggle('visible', modalVisible);
    });

    shadowRoot.getElementById('btn-dashboard').addEventListener('click', (e) => {
      const btn = e.target;
      btn.innerText = "OPENING DASHBOARD...";
      if (!chrome.runtime || !chrome.runtime.id) {
          btn.innerText = "PLEASE REFRESH PAGE";
          btn.style.background = "#ff5c5c";
          return;
      }
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" }, (response) => {
          if (chrome.runtime.lastError) { btn.innerText = "RELOAD EXTENSION"; btn.style.background = "#ff5c5c"; }
          else { btn.innerText = "OPEN CONTROL CENTER"; }
      });
    });
  }

  function drawRadar(stats) {
    const svg = shadowRoot.getElementById('radar-chart');
    if (!svg) return;
    
    const points = [
      { x: 50, y: 50 - stats.cpu * 0.45 },
      { x: 50 + stats.ram * 0.42, y: 50 - stats.ram * 0.14 },
      { x: 50 + stats.dom * 0.26, y: 50 + stats.dom * 0.36 },
      { x: 50 - stats.net * 0.26, y: 50 + stats.net * 0.36 },
      { x: 50 - stats.sec * 0.42, y: 50 - stats.sec * 0.14 }
    ];
    
    const polyPath = points.map(p => `${p.x},${p.y}`).join(' ');
    
    svg.innerHTML = `
      <polygon points="50,5 93,36 76,86 24,86 7,36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
      <polygon points="50,27.5 71.5,43 63,68 37,68 28.5,43" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <polygon points="${polyPath}" fill="rgba(56, 189, 248, 0.4)" stroke="#38bdf8" stroke-width="1.5" stroke-linejoin="round"/>
      
      <text x="50" y="2" text-anchor="middle" class="radar-label">CPU</text>
      <text x="96" y="36" text-anchor="start" class="radar-label">RAM</text>
      <text x="78" y="94" text-anchor="middle" class="radar-label">DOM</text>
      <text x="22" y="94" text-anchor="middle" class="radar-label">NET</text>
      <text x="4" y="36" text-anchor="end" class="radar-label">SEC</text>
    `;
  }

  function updateUI(metrics) {
    if (!shadowRoot) return;
    
    const usedMB = Math.round((metrics.memory?.usedJSHeapSize || 0) / 1024 / 1024);
    shadowRoot.getElementById('val-mem').textContent = `${usedMB}MB`;
    shadowRoot.getElementById('val-cpu').textContent = `${metrics.cpuJitter.toFixed(1)}ms`;
    shadowRoot.getElementById('val-dom').textContent = metrics.domNodes;
    shadowRoot.getElementById('val-net').textContent = `${metrics.network.requestCount} res`;
    shadowRoot.getElementById('tracker-msg').textContent = `${metrics.trackersCount} Tracking signals detected`;
    
    const radarStats = {
      cpu: Math.min(100, metrics.cpuJitter * 2),
      ram: Math.min(100, (metrics.memory?.usedJSHeapSize || 0) / (300 * 1024 * 1024) * 100),
      dom: Math.min(100, metrics.domNodes / 5000 * 100),
      net: Math.min(100, metrics.network.requestCount * 2),
      sec: metrics.isHttps ? 20 : 100
    };
    
    drawRadar(radarStats);

    const badge = shadowRoot.getElementById('risk-level');
    let risk = (radarStats.cpu + radarStats.ram + radarStats.dom + radarStats.net + radarStats.sec) / 5;
    badge.className = 'badge';
    if (risk < 30) { badge.textContent = 'SECURE'; badge.classList.add('low'); }
    else if (risk < 60) { badge.textContent = 'MODERATE'; badge.classList.add('medium'); }
    else { badge.textContent = 'HIGH RISK'; badge.classList.add('high'); }
  }

  function collectMetrics() {
    const memory = window.performance && window.performance.memory ? {
      usedJSHeapSize: window.performance.memory.usedJSHeapSize,
      totalJSHeapSize: window.performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
    } : null;

    let heapGrowthRate = 0;
    if (memory) {
      if (lastHeapSize > 0) heapGrowthRate = (memory.usedJSHeapSize - lastHeapSize) / lastHeapSize;
      lastHeapSize = memory.usedJSHeapSize;
    }

    const jitter = jitterSamples.reduce((a,b) => a+b, 0) / jitterSamples.length;
    const cookies = document.cookie ? document.cookie.split(';').length : 0;
    
    const metrics = {
      memory,
      heapGrowthRate,
      cpuJitter: jitter,
      domNodes: document.getElementsByTagName('*').length,
      isHttps: window.location.protocol === 'https:',
      trackersCount: cookies,
      securityFlags: { evalDetected: false },
      network: { requestCount: window.performance.getEntriesByType('resource').length }
    };

    updateUI(metrics);
    return metrics;
  }

  function safeSendMessage(message) {
    if (chrome.runtime && chrome.runtime.id) {
       chrome.runtime.sendMessage(message, () => { if (chrome.runtime.lastError) {} });
    }
  }

  setInterval(() => { safeSendMessage({ type: "METRICS_UPDATE", data: collectMetrics() }); }, 3000);
  setupOverlay();
  safeSendMessage({ type: "METRICS_UPDATE", data: collectMetrics() });

})();
