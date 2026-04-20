/**
 * WebPulse Guardian 2.1.0 - Background Service Worker
 * Central Autonomous Intelligence Engine.
 * 
 * MEJORAS v2.1.0:
 * - CPU real del sistema via chrome.system.cpu
 * - RAM real del navegador via chrome.system.memory
 * - Alertas push via chrome.notifications
 * - Motor de recomendaciones inteligente
 * - Alarms periódicas para monitoreo continuo
 * - Conteo de pestañas activas/inactivas
 * - Gestión de umbrales configurables
 */

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
let tabMetrics    = new Map();   // tabId → datos de métricas de cada pestaña
let leakEngine    = new Map();   // tabId → { samples: [], lastGrowth: 0 }
let riskHistory   = new Map();   // tabId → [scores...]
let globalSensitivity = 1.0;

// Métricas del sistema (actualizadas por alarms)
let systemMetrics = {
  cpu: { usage: 0, cores: 0, lastSamples: [] },
  memory: { availableMB: 0, capacityMB: 0, usedPct: 0 },
  tabCount: { total: 0, active: 0, discarded: 0 },
  timestamp: 0
};

// ─────────────────────────────────────────────
// CIRCULAR BUFFER DE LOGS FORENSES
// ─────────────────────────────────────────────
const MAX_LOGS = 100;
let forensicLogs = [];

async function logEvent(type, message, severity = "info", tabId = null) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    severity,
    tabId
  };
  forensicLogs.unshift(event);
  if (forensicLogs.length > MAX_LOGS) forensicLogs.pop();
  chrome.storage.local.set({ forensicLogs });
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN Y UMBRALES
// ─────────────────────────────────────────────
const THRESHOLDS = {
  cpuUsageHigh: 80,       // % CPU del sistema
  memoryHighPct: 85,      // % RAM del sistema
  tabsExcess: 20,         // número de pestañas
  pageLoadSlow: 5000,     // ms tiempo de carga
  lcpSlow: 4000,          // ms LCP
  heapHighMB: 400,        // MB JS heap por pestaña
};

// Control de throttle para notificaciones (evitar spam)
const notifCooldown = new Map(); // key → timestamp última notificación
const NOTIF_COOLDOWN_MS = 60000; // 1 minuto entre notificaciones del mismo tipo

// ─────────────────────────────────────────────
// CARGA DE CONFIGURACIÓN INICIAL
// ─────────────────────────────────────────────
chrome.storage.local.get(['detectionSensitivity', 'notificationsEnabled', 'thresholds'], (res) => {
  if (res.detectionSensitivity) {
    if (res.detectionSensitivity === 'low') globalSensitivity = 0.7;
    else if (res.detectionSensitivity === 'high') globalSensitivity = 1.5;
    else globalSensitivity = 1.0;
  }
  if (res.thresholds) {
    Object.assign(THRESHOLDS, res.thresholds);
  }
});

// ─────────────────────────────────────────────
// INSTALACIÓN / ACTUALIZACIÓN
// ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  const reason = details.reason === "install" ? "Initialized" : "Reloaded";
  logEvent("SYSTEM", `Guardian Engine ${reason} — v2.1.0`, "success");

  // Inyectar content script en pestañas existentes
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.includes("chrome.google.com")) continue;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).catch(err => console.debug(`Skipped tab ${tab.id}: ${err.message}`));
  }

  // Configurar alarmas periódicas
  chrome.alarms.create("system-monitor", { periodInMinutes: 0.083 }); // ~5 segundos
  chrome.alarms.create("tab-audit", { periodInMinutes: 0.5 });        // 30 segundos

  // Valores por defecto en storage
  chrome.storage.local.set({
    notificationsEnabled: true,
    recommendations: [],
    systemMetrics
  });
});

// ─────────────────────────────────────────────
// ALARMAS PERIÓDICAS
// ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "system-monitor") {
    await updateSystemMetrics();
  }
  if (alarm.name === "tab-audit") {
    await runTabAudit();
  }
});

/**
 * Actualiza métricas reales de CPU y RAM del sistema
 */
async function updateSystemMetrics() {
  try {
    // RAM del sistema
    const memInfo = await chrome.system.memory.getInfo();
    const capacityMB = Math.round(memInfo.capacity / 1024 / 1024);
    const availableMB = Math.round(memInfo.availableCapacity / 1024 / 1024);
    const usedMB = capacityMB - availableMB;
    const usedPct = Math.round((usedMB / capacityMB) * 100);

    // CPU del sistema (promedio de todos los núcleos)
    const cpuInfo = await chrome.system.cpu.getInfo();
    let totalUsage = 0;
    for (const proc of cpuInfo.processors) {
      const total = proc.usage.user + proc.usage.kernel + proc.usage.idle;
      const used = proc.usage.user + proc.usage.kernel;
      totalUsage += total > 0 ? (used / total) * 100 : 0;
    }
    const cpuUsage = Math.round(totalUsage / cpuInfo.processors.length);

    // Mantener historial de CPU (últimas 30 muestras para sparkline)
    systemMetrics.cpu.lastSamples.push(cpuUsage);
    if (systemMetrics.cpu.lastSamples.length > 30) systemMetrics.cpu.lastSamples.shift();

    systemMetrics.cpu.usage = cpuUsage;
    systemMetrics.cpu.cores = cpuInfo.numPhysicalProcessors || cpuInfo.processors.length;
    systemMetrics.memory = { availableMB, capacityMB, usedMB, usedPct };
    systemMetrics.timestamp = Date.now();

    // Persistir para el dashboard
    chrome.storage.local.set({ systemMetrics });

    // ── Alertas de sistema ──
    await checkSystemAlerts(cpuUsage, usedPct);

  } catch (err) {
    // chrome.system.cpu/memory no disponible en algunos contextos
    console.debug("System metrics unavailable:", err.message);
  }
}

/**
 * Auditoría periódica de pestañas (detecta exceso, inactividad, etc.)
 */
async function runTabAudit() {
  try {
    const allTabs = await chrome.tabs.query({});
    const activeTabs = allTabs.filter(t => t.active);
    const discardedTabs = allTabs.filter(t => t.discarded);

    systemMetrics.tabCount = {
      total: allTabs.length,
      active: activeTabs.length,
      discarded: discardedTabs.length
    };

    // Alerta por exceso de pestañas
    if (allTabs.length > THRESHOLDS.tabsExcess) {
      await sendThrottledNotification(
        "tabs-excess",
        "⚠️ Demasiadas Pestañas Abiertas",
        `Tienes ${allTabs.length} pestañas abiertas. Considera cerrar las que no uses para liberar memoria.`,
        "warning"
      );
    }

    // Generar recomendaciones
    const recs = await generateRecommendations(allTabs);
    chrome.storage.local.set({ recommendations: recs });

    logEvent("AUDIT", `Pestaña audit: ${allTabs.length} total, ${activeTabs.length} activas, ${discardedTabs.length} hibernadas`, "info");
  } catch (err) {
    console.debug("Tab audit error:", err.message);
  }
}

// ─────────────────────────────────────────────
// SISTEMA DE ALERTAS
// ─────────────────────────────────────────────
async function checkSystemAlerts(cpuUsage, memUsedPct) {
  if (cpuUsage > THRESHOLDS.cpuUsageHigh) {
    await sendThrottledNotification(
      "cpu-high",
      "🔥 CPU Alta Detectada",
      `El uso de CPU del sistema está en ${cpuUsage}%. Considera cerrar pestañas o apps pesadas.`,
      "danger"
    );
    logEvent("ALERT", `CPU del sistema al ${cpuUsage}%`, "danger");
  }

  if (memUsedPct > THRESHOLDS.memoryHighPct) {
    await sendThrottledNotification(
      "memory-high",
      "💾 Memoria RAM Crítica",
      `Tu sistema está usando ${memUsedPct}% de RAM. WebPulse recomienda cerrar pestañas inactivas.`,
      "danger"
    );
    logEvent("ALERT", `RAM del sistema al ${memUsedPct}%`, "danger");
  }
}

async function checkTabAlerts(tabId, analysis, url) {
  if (analysis.score >= 70) {
    let hostname = url;
    try { hostname = new URL(url).hostname; } catch {}

    await sendThrottledNotification(
      `tab-risk-${tabId}`,
      `⚡ Pestaña con Alto Riesgo`,
      `${hostname} tiene riesgo ${analysis.level} (${Math.round(analysis.score)}%). ${analysis.reasons[0] || ''}`,
      "warning"
    );
  }
}

async function sendThrottledNotification(key, title, message, severity) {
  const now = Date.now();
  const lastTime = notifCooldown.get(key) || 0;
  if (now - lastTime < NOTIF_COOLDOWN_MS) return;

  const enabled = await new Promise(r => chrome.storage.local.get(['notificationsEnabled'], d => r(d.notificationsEnabled !== false)));
  if (!enabled) return;

  notifCooldown.set(key, now);

  chrome.notifications.create(key, {
    type: "basic",
    iconUrl: "webpulse_icon_128_1776037802458.png",
    title,
    message,
    priority: severity === "danger" ? 2 : 1
  });
}

// ─────────────────────────────────────────────
// MOTOR DE ANÁLISIS DE RIESGO (MEJORADO)
// ─────────────────────────────────────────────
function analyzeRisk(metrics, tabId) {
  let score = 0;
  const reasons = [];

  // 1. RAM de la página (JS Heap)
  if (metrics.memory) {
    const usedMB = metrics.memory.usedJSHeapSize / 1024 / 1024;
    if (usedMB > THRESHOLDS.heapHighMB) { score += 30; reasons.push(`Heap elevado: ${Math.round(usedMB)}MB`); }

    // Detección predictiva de memory leak
    let engine = leakEngine.get(tabId) || { samples: [] };
    engine.samples.push(metrics.heapGrowthRate || 0);
    if (engine.samples.length > 8) engine.samples.shift();
    const avgGrowth = engine.samples.reduce((a, b) => a + b, 0) / (engine.samples.length || 1);
    if (avgGrowth > 0.04) {
      score += 35;
      reasons.push("Memory Leak Predictivo Detectado");
    }
    leakEngine.set(tabId, engine);
  }

  // 2. DOM Complexity
  if (metrics.domNodes > 5000) { score += 20; reasons.push(`DOM complejo: ${metrics.domNodes} nodos`); }
  else if (metrics.domNodes > 3000) { score += 10; }

  // 3. CPU Jitter (UI Thread Pressure)
  if (metrics.cpuJitter > 50) { score += 30; reasons.push("Bloqueo del hilo UI severo"); }
  else if (metrics.cpuJitter > 25) { score += 15; reasons.push("Presión de CPU moderada"); }

  // 4. Seguridad
  if (!metrics.isHttps) { score += 40; reasons.push("Conexión insegura (no HTTPS)"); }
  if (metrics.securityFlags?.evalDetected) { score += 35; reasons.push("Script inseguro (eval) detectado"); }
  if (metrics.trackersCount > 15) { score += 25; reasons.push(`Exceso de trackers: ${metrics.trackersCount}`); }
  else if (metrics.trackersCount > 7) { score += 10; }

  // 5. Web Vitals
  if (metrics.webVitals) {
    if (metrics.webVitals.lcp > THRESHOLDS.lcpSlow) { score += 20; reasons.push(`LCP lento: ${Math.round(metrics.webVitals.lcp)}ms`); }
    if (metrics.webVitals.fid > 300) { score += 15; reasons.push(`FID alto: ${Math.round(metrics.webVitals.fid)}ms`); }
    if (metrics.webVitals.cls > 0.25) { score += 10; reasons.push(`CLS inestable: ${metrics.webVitals.cls.toFixed(2)}`); }
  }

  // 6. Tiempo de carga de la página
  if (metrics.pageLoad?.domContentLoaded > THRESHOLDS.pageLoadSlow) {
    score += 15;
    reasons.push(`Carga lenta: ${Math.round(metrics.pageLoad.domContentLoaded)}ms`);
  }

  // 7. Número de recursos de red
  if (metrics.network?.requestCount > 200) { score += 10; reasons.push(`Red saturada: ${metrics.network.requestCount} recursos`); }

  // Aplicar multiplicador de sensibilidad
  score = Math.min(100, score * globalSensitivity);

  // Clasificación de riesgo
  let level = "Low";
  if (score >= 80) level = "Critical";
  else if (score >= 60) level = "High";
  else if (score >= 30) level = "Medium";

  // Guardar historial de riesgo
  let hist = riskHistory.get(tabId) || [];
  hist.push({ score: Math.round(score), ts: Date.now() });
  if (hist.length > 20) hist.shift();
  riskHistory.set(tabId, hist);

  return { score: Math.round(score), level, reasons };
}

// ─────────────────────────────────────────────
// MOTOR DE RECOMENDACIONES
// ─────────────────────────────────────────────
async function generateRecommendations(allTabs) {
  const recs = [];
  const sessions = Array.from(tabMetrics.values());

  // Recomendación 1: Demasiadas pestañas
  if (allTabs.length > 15) {
    recs.push({
      id: "too-many-tabs",
      icon: "📑",
      priority: "high",
      title: "Reduce el número de pestañas",
      description: `Tienes ${allTabs.length} pestañas. Cada pestaña consume ~50-200MB de RAM. Cierra las que no estés usando.`,
      action: "hibernate_inactive"
    });
  }

  // Recomendación 2: Páginas con mucha memoria
  const heavyPages = sessions.filter(s => s.memory && s.memory.usedJSHeapSize > 300 * 1024 * 1024);
  if (heavyPages.length > 0) {
    const heaviest = heavyPages.sort((a, b) => b.memory.usedJSHeapSize - a.memory.usedJSHeapSize)[0];
    let host = heaviest.url || "desconocido";
    try { host = new URL(heaviest.url).hostname; } catch {}
    recs.push({
      id: "heavy-page",
      icon: "💾",
      priority: "high",
      title: "Página con alto consumo de memoria",
      description: `${host} está usando ${Math.round(heaviest.memory.usedJSHeapSize/1024/1024)}MB de JS heap. Considera recargar o cerrar.`,
      action: "reload_heavy"
    });
  }

  // Recomendación 3: Páginas con memory leak
  for (const [tabId, engine] of leakEngine.entries()) {
    if (engine.samples.length >= 5) {
      const avg = engine.samples.reduce((a, b) => a + b, 0) / engine.samples.length;
      if (avg > 0.03) {
        const data = tabMetrics.get(tabId);
        let host = "Pestaña #" + tabId;
        try { host = new URL(data.url).hostname; } catch {}
        recs.push({
          id: `leak-${tabId}`,
          icon: "🔴",
          priority: "critical",
          title: "Posible memory leak detectado",
          description: `${host} muestra un crecimiento continuo de memoria. Recarga la pestaña para liberar recursos.`,
          action: "reload_tab",
          tabId
        });
      }
    }
  }

  // Recomendación 4: CPU alta del sistema
  if (systemMetrics.cpu.usage > 70) {
    recs.push({
      id: "system-cpu-high",
      icon: "🔥",
      priority: "medium",
      title: "CPU del sistema elevada",
      description: `Tu CPU está al ${systemMetrics.cpu.usage}%. Suspender pestañas inactivas puede liberar recursos.`,
      action: "hibernate_inactive"
    });
  }

  // Recomendación 5: Páginas HTTP inseguras
  const insecurePages = sessions.filter(s => s.isHttps === false);
  if (insecurePages.length > 0) {
    recs.push({
      id: "insecure-pages",
      icon: "🔓",
      priority: "medium",
      title: `${insecurePages.length} página(s) inseguras`,
      description: "Estás visitando páginas sin HTTPS. Tus datos pueden estar expuestos. Verifica si hay versión HTTPS disponible.",
      action: "none"
    });
  }

  // Recomendación 6: LCP lento
  const slowLCP = sessions.filter(s => s.webVitals && s.webVitals.lcp > 4000);
  if (slowLCP.length > 0) {
    recs.push({
      id: "slow-lcp",
      icon: "⏱️",
      priority: "low",
      title: "Web Vitals bajos detectados",
      description: `${slowLCP.length} páginas tienen un LCP lento (>4s). Puede indicar imágenes grandes o scripts bloqueantes.`,
      action: "none"
    });
  }

  return recs.slice(0, 8); // máximo 8 recomendaciones
}

function isRestrictedUrl(url) {
  if (!url) return true;
  if (url.startsWith('chrome://')) return true;
  if (url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('edge://')) return true;
  if (url.startsWith('about:')) return true;
  if (url.includes('chrome.google.com/webstore')) return true;
  return false;
}

// ─────────────────────────────────────────────
// MANEJADOR GLOBAL DE MENSAJES
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Actualización de métricas desde content script
  if (message.type === "METRICS_UPDATE") {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ status: "error" }); return true; }

    const analysis = analyzeRisk(message.data, tabId);
    const fullData = {
      ...message.data,
      analysis,
      timestamp: Date.now(),
      tabId,
      url: sender.tab.url,
      tabTitle: sender.tab.title
    };

    tabMetrics.set(tabId, fullData);

    // Alertas por pestaña (throttled)
    checkTabAlerts(tabId, analysis, sender.tab.url).catch(() => {});

    // Hibernación: SOLO notificar, no auto-discard
    if (analysis.score >= 90) {
      logEvent("WARNING", `Tab ${tabId} (${sender.tab.url}) alcanzó riesgo crítico: ${analysis.score}%`, "danger", tabId);
    }

    sendResponse({ status: "ok", analysis });
  }

  // Cambio de sensibilidad
  if (message.type === "SET_SENSITIVITY") {
    if (message.level === 'low') globalSensitivity = 0.7;
    else if (message.level === 'high') globalSensitivity = 1.5;
    else globalSensitivity = 1.0;
    chrome.storage.local.set({ detectionSensitivity: message.level });
    logEvent("SYSTEM", `Sensibilidad actualizada a: ${message.level}`, "info");
    sendResponse({ success: true });
  }

  // APIs de consulta
  if (message.type === "GET_TAB_DATA") {
    sendResponse(tabMetrics.get(message.tabId) || null);
  }

  if (message.type === "GET_GLOBAL_STATUS") {
    chrome.tabs.query({}, (tabs) => {
      const sessions = tabs.map(tab => {
        const metrics = tabMetrics.get(tab.id);
        const restricted = isRestrictedUrl(tab.url);
        const isFile = tab.url?.startsWith('file://');

        if (metrics) {
          return { id: tab.id, ...metrics, tabTitle: tab.title, url: tab.url, discarded: tab.discarded, restricted, isFile };
        } else {
          // Si no hay métricas y no es restringida, intentamos re-inyectar silenciosamente
          if (!restricted && !tab.discarded && tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"]
            }).catch(() => {});
          }

          return {
            id: tab.id,
            url: tab.url,
            tabTitle: tab.title,
            discarded: tab.discarded,
            restricted,
            isFile,
            timestamp: Date.now(),
            domNodes: 0,
            cpuJitter: 0,
            isHttps: tab.url?.startsWith('https:'),
            trackersCount: 0,
            network: { requestCount: 0 },
            analysis: { score: 0, level: "Low", reasons: restricted ? ["System Protected"] : isFile ? ["Local File"] : ["Pending Analysis..."] }
          };
        }
      });
      
      sendResponse({
        sessions: sessions,
        logs: forensicLogs,
        systemMetrics,
        recommendations: [] 
      });
    });
    return true; // async
  }

  if (message.type === "GET_SYSTEM_METRICS") {
    sendResponse(systemMetrics);
  }

  if (message.type === "GET_RISK_HISTORY") {
    sendResponse(Array.from(riskHistory.entries()).map(([id, hist]) => ({ id, history: hist })));
  }

  // Acciones de pestañas
  if (message.type === "HIBERNATE_TAB") {
    chrome.tabs.discard(message.tabId, () => {
      logEvent("MITIGATION", `Pestaña ${message.tabId} hibernada manualmente`, "success", message.tabId);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "HIBERNATE_ALL_INACTIVE") {
    chrome.tabs.query({ active: false }, (tabs) => {
      let count = 0;
      for (const tab of tabs) {
        if (!tab.discarded && tab.url?.startsWith("http")) {
          chrome.tabs.discard(tab.id);
          count++;
        }
      }
      logEvent("MITIGATION", `${count} pestañas inactivas hibernadas`, "success");
      sendResponse({ count });
    });
    return true;
  }

  // Dashboard APIs
  if (message.type === "GET_EXTENSIONS") {
    chrome.management.getAll(sendResponse);
    return true;
  }

  if (message.type === "TOGGLE_EXTENSION") {
    chrome.management.setEnabled(message.id, message.enabled, () => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "GET_COOKIES") {
    chrome.cookies.getAll({ domain: message.domain || undefined }, sendResponse);
    return true;
  }

  if (message.type === "REMOVE_COOKIE") {
    chrome.cookies.remove({ url: message.url, name: message.name }, sendResponse);
    return true;
  }

  if (message.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }

  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.local.set(message.settings, () => {
      if (message.settings.thresholds) Object.assign(THRESHOLDS, message.settings.thresholds);
      if (message.settings.detectionSensitivity) {
        const s = message.settings.detectionSensitivity;
        globalSensitivity = s === 'low' ? 0.7 : s === 'high' ? 1.5 : 1.0;
      }
      logEvent("SYSTEM", "Configuración guardada", "success");
      sendResponse({ success: true });
    });
    return true;
  }

  return true; // mantener canal abierto para async
});

// ─────────────────────────────────────────────
// LIMPIEZA DE PESTAÑAS CERRADAS
// ─────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMetrics.delete(tabId);
  leakEngine.delete(tabId);
  riskHistory.delete(tabId);
  logEvent("SYSTEM", `Pestaña ${tabId} cerrada y datos limpiados`, "info", tabId);
});

// Escuchar cambios en tabs para actualizar conteo
chrome.tabs.onCreated.addListener(() => {
  chrome.tabs.query({}, tabs => {
    systemMetrics.tabCount.total = tabs.length;
    systemMetrics.tabCount.active = tabs.filter(t => t.active).length;
    systemMetrics.tabCount.discarded = tabs.filter(t => t.discarded).length;
  });
});
