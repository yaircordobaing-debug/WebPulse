/**
 * WebPulse Guardian 2.1.0 — Popup Script
 */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  function setVitalChip(chipId, valId, value, low, high, fmt) {
    const chip = $(chipId);
    const el = $(valId);
    if (!chip || !el) return;
    el.textContent = value > 0 ? fmt(value) : '--';
    chip.className = 'vital-chip ' +
      (value === 0 ? '' : value < low ? 'good' : value < high ? 'warn' : 'bad');
  }

  function setBar(barId, pct, dangerAt) {
    const bar = $(barId);
    if (!bar) return;
    bar.style.width = Math.min(100, pct) + '%';
    bar.style.background = pct > dangerAt ? '#ff5c5c' : pct > dangerAt * 0.7 ? '#f59e0b' : 'var(--primary)';
  }

  function updateSystemMetrics() {
    chrome.runtime.sendMessage({ type: 'GET_SYSTEM_METRICS' }, (sys) => {
      if (chrome.runtime.lastError || !sys) return;

      // CPU del sistema
      const cpuPct = sys.cpu?.usage ?? 0;
      if ($('sys-cpu')) $('sys-cpu').textContent = cpuPct + '%';
      setBar('bar-cpu', cpuPct, 80);

      // RAM del sistema
      const ramPct = sys.memory?.usedPct ?? 0;
      if ($('sys-ram')) $('sys-ram').textContent = ramPct + '%';
      setBar('bar-ram', ramPct, 85);

      // Pestañas
      const tc = sys.tabCount;
      if ($('tab-count-label') && tc) {
        $('tab-count-label').textContent = `${tc.total} pestañas · ${tc.discarded} hibernadas`;
      }
    });
  }

  function updatePageMetrics() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tab = tabs[0];

      try {
        $('page-domain').textContent = new URL(tab.url).hostname;
      } catch {
        $('page-domain').textContent = 'WebPulse Browser';
      }

      chrome.runtime.sendMessage({ type: 'GET_TAB_DATA', tabId: tab.id }, (data) => {
        if (chrome.runtime.lastError || !data) {
          if ($('mem-value')) $('mem-value').textContent = 'Analizando...';
          return;
        }

        // Memoria JS
        const usedMB = Math.round((data.memory?.usedJSHeapSize || 0) / 1024 / 1024);
        const limitMB = Math.round((data.memory?.jsHeapSizeLimit || 0) / 1024 / 1024);
        if ($('mem-value')) $('mem-value').textContent = `${usedMB} MB`;
        setBar('mem-progress', limitMB ? (usedMB / limitMB * 100) : (usedMB / 600 * 100), 70);

        // Jitter
        const jitter = data.cpuJitter ?? 0;
        if ($('jitter-value')) $('jitter-value').textContent = `${jitter.toFixed(1)}ms`;
        if ($('jitter-status')) {
          $('jitter-status').textContent = jitter < 16 ? '✓ Fluido' : jitter < 33 ? '⚠ Moderado' : '✗ Lento';
          $('jitter-status').style.color = jitter < 16 ? 'var(--secure)' : jitter < 33 ? 'var(--warning)' : 'var(--danger)';
        }

        // DOM
        if ($('dom-value')) $('dom-value').textContent = (data.domNodes || 0).toLocaleString();

        // Red
        const reqs = data.network?.requestCount ?? 0;
        if ($('network-requests')) $('network-requests').textContent = `${reqs} recursos`;

        // Security Score
        if ($('security-score') && data.analysis) {
          const sec = Math.max(0, 100 - Math.round(data.analysis.score));
          $('security-score').textContent = `${sec}/100`;
          $('security-score').style.color = sec > 70 ? 'var(--secure)' : sec > 40 ? 'var(--warning)' : 'var(--danger)';
        }

        // Status badge
        const badge = $('status-badge');
        if (badge && data.analysis) {
          const lvl = data.analysis.level;
          const labels = { Low: 'SEGURO', Medium: 'MODERADO', High: 'RIESGO', Critical: 'CRÍTICO' };
          const classes = { Low: 'status-secure', Medium: 'status-warn', High: 'status-high', Critical: 'status-high' };
          badge.textContent = labels[lvl] || lvl;
          badge.className = 'status-pill ' + (classes[lvl] || 'status-init');
        }

        // Web Vitals
        const wv = data.webVitals || {};
        setVitalChip('chip-lcp', 'lcp-val', wv.lcp || 0, 2500, 4000, v => `${(v/1000).toFixed(1)}s`);
        setVitalChip('chip-fid', 'fid-val', wv.fid || 0, 100, 300, v => `${Math.round(v)}ms`);
        setVitalChip('chip-cls', 'cls-val', wv.cls || 0, 0.1, 0.25, v => v.toFixed(2));

        const pl = data.pageLoad;
        if (pl && $('load-val')) {
          const loadMs = pl.domContentLoaded || pl.fullLoad || 0;
          $('load-val').textContent = loadMs > 0 ? `${(loadMs/1000).toFixed(1)}s` : '--';
          const chipLoad = $('chip-load');
          if (chipLoad) chipLoad.className = 'vital-chip ' + (loadMs < 2000 ? 'good' : loadMs < 5000 ? 'warn' : 'bad');
        }
      });
    });
  }

  // Event listeners
  $('open-dashboard')?.addEventListener('click', () => {
    const btn = $('open-dashboard');
    btn.style.opacity = '0.6';
    btn.textContent = 'ABRIENDO...';
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }, () => {
      if (chrome.runtime.lastError) {
        btn.textContent = 'RECARGA LA PÁGINA';
        btn.style.opacity = '1';
      }
    });
  });

  // Actualizar en ciclo
  updateSystemMetrics();
  updatePageMetrics();
  const sysInterval = setInterval(updateSystemMetrics, 2000);
  const pageInterval = setInterval(updatePageMetrics, 2500);

  window.addEventListener('unload', () => {
    clearInterval(sysInterval);
    clearInterval(pageInterval);
  });
});
