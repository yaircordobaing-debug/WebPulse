/**
 * WebPulse Guardian 2.0 - Background Service Worker
 * Central Autonomous Intelligence Engine.
 */

// State management
let tabMetrics = new Map();
let riskHistory = new Map();
let leakEngine = new Map(); // tabId -> { samples: [], lastGrowth: 0 }
let globalSensitivity = 1.0; // Dynamic multiplier

// Load initial settings
chrome.storage.local.get(['detectionSensitivity'], (res) => {
    if (res.detectionSensitivity) {
        if (res.detectionSensitivity === 'low') globalSensitivity = 0.7;
        else if (res.detectionSensitivity === 'high') globalSensitivity = 1.5;
        else globalSensitivity = 1.0;
    }
});

// Event Log (Circular Buffer for Forensic Timeline)
const MAX_LOGS = 50;
let forensicLogs = [];

/**
 * Autonomous Logging
 */
async function logEvent(type, message, severity = "info", tabId = null) {
  const event = {
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type,
    message,
    severity,
    tabId
  };
  
  forensicLogs.unshift(event);
  if (forensicLogs.length > MAX_LOGS) forensicLogs.pop();
  
  // Persist to storage for the dashboard
  chrome.storage.local.set({ forensicLogs });
}

/**
 * Initial Injection Logic (No-Reload Requirement)
 * Injects content.js into all existing tabs upon installation or update.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  logEvent("SYSTEM", `Guardian Engine ${details.reason === "install" ? "Initialized" : "Reloaded"}`, "success");
  
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.includes("chrome.google.com")) continue;
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).catch(err => console.debug(`Skipped tab ${tab.id}: ${err.message}`));
  }
});

/**
 * Anomaly & Predictive Engine
 */
function analyzeRisk(metrics, tabId) {
  let score = 0;
  let reasons = [];

  // 1. RAM Axis & Leak Prediction
  if (metrics.memory) {
    const usedMB = metrics.memory.usedJSHeapSize / 1024 / 1024;
    if (usedMB > 500) { score += 30; reasons.push("High memory usage"); }
    
    // Predictive Growth Analysis
    let engine = leakEngine.get(tabId) || { samples: [] };
    engine.samples.push(metrics.heapGrowthRate);
    if (engine.samples.length > 5) engine.samples.shift();
    
    const avgGrowth = engine.samples.reduce((a, b) => a + b, 0) / engine.samples.length;
    if (avgGrowth > 0.05) {
      score += 40;
      reasons.push("PREDICTIVE: Potential memory leak detected");
    }
    leakEngine.set(tabId, engine);
  }

  // 2. DOM Axis (Complexity)
  if (metrics.domNodes > 5000) { score += 20; reasons.push("DOM Complexity Overload"); }

  // 3. CPU Axis (Jitter/Pressure)
  if (metrics.cpuJitter > 30) { score += 25; reasons.push("UI Jitter (CPU Pressure)"); }

  // 4. Security Axis
  if (!metrics.isHttps) { score += 40; reasons.push("Insecure (No HTTPS)"); }
  if (metrics.securityFlags.evalDetected) { score += 35; reasons.push("Unsafe Scripting (eval)"); }
  if (metrics.trackersCount > 10) { score += 20; reasons.push("Excessive Trackers"); }

  // Apply Sensitivity Multiplier
  score = Math.min(100, score * globalSensitivity);

  // Risk Classification
  let level = "Low";
  if (score >= 90) level = "Critical";
  else if (score >= 60) level = "High";
  else if (score >= 30) level = "Medium";

  return { score, level, reasons };
}

// Global Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "METRICS_UPDATE") {
    const tabId = sender.tab.id;
    const analysis = analyzeRisk(message.data, tabId);
    
    const fullData = {
      ...message.data,
      analysis,
      timestamp: Date.now(),
      url: sender.tab.url
    };

    tabMetrics.set(tabId, fullData);

    // Autonomous Mitigation (Hibernation)
    if (analysis.score >= 90) {
      logEvent("MITIGATION", `Tab ${tabId} hibernated due to critical risk (${Math.round(analysis.score)}%)`, "danger", tabId);
      chrome.tabs.discard(tabId);
    }
    sendResponse({ status: "ok" });
  }

  if (message.type === "SET_SENSITIVITY") {
    if (message.level === 'low') globalSensitivity = 0.7;
    else if (message.level === 'high') globalSensitivity = 1.5;
    else globalSensitivity = 1.0;
    chrome.storage.local.set({ detectionSensitivity: message.level });
    logEvent("SYSTEM", `Sensitivity updated to: ${message.level}`, "info");
    sendResponse({ success: true });
  }

  if (message.type === "GET_TAB_DATA") {
    sendResponse(tabMetrics.get(message.tabId) || null);
  }

  if (message.type === "GET_GLOBAL_STATUS") {
    sendResponse({
      sessions: Array.from(tabMetrics.entries()).map(([id, data]) => ({ id, ...data })),
      logs: forensicLogs
    });
  }

  // Dashboard APIs
  if (message.type === "GET_EXTENSIONS") chrome.management.getAll(sendResponse);
  if (message.type === "TOGGLE_EXTENSION") chrome.management.setEnabled(message.id, message.enabled, () => sendResponse({ success: true }));
  if (message.type === "GET_COOKIES") chrome.cookies.getAll({ domain: message.domain || undefined }, sendResponse);
  if (message.type === "REMOVE_COOKIE") chrome.cookies.remove({ url: message.url, name: message.name }, sendResponse);
  if (message.type === "OPEN_DASHBOARD") chrome.runtime.openOptionsPage();

  return true;
});

// Cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMetrics.delete(tabId);
  leakEngine.delete(tabId);
});
