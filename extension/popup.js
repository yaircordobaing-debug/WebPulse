/**
 * WebPulse Guardian Sentinel - Popup Logic v2.0.4
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI References
    const memVal = document.getElementById('mem-value');
    const memProgress = document.getElementById('mem-progress');
    const domVal = document.getElementById('dom-value');
    const domainText = document.getElementById('page-domain');
    const statusBadge = document.getElementById('status-badge');
    const dashboardBtn = document.getElementById('open-dashboard');

    if (!dashboardBtn) {
        console.error("Dashboard button not found in popup.html");
        return;
    }

    /**
     * Update UI with telemetry data
     */
    function updateTelemetry() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const activeTab = tabs[0];
            
            try {
                domainText.textContent = new URL(activeTab.url).hostname;
            } catch(e) {
                domainText.textContent = "WebPulse Browser";
            }

            chrome.runtime.sendMessage({ type: "GET_TAB_DATA", tabId: activeTab.id }, (data) => {
                if (chrome.runtime.lastError) {
                    console.debug("Background script unreachable yet...");
                    return;
                }

                if (data && data.analysis) {
                    const usedMB = Math.round((data.memory?.usedJSHeapSize || 0) / 1024 / 1024);
                    memVal.textContent = `${usedMB} MB`;
                    const memPct = Math.min(100, (usedMB / 600) * 100);
                    memProgress.style.width = `${memPct}%`;
                    domVal.textContent = data.domNodes.toLocaleString();

                    // Security & Network
                    const secScore = document.getElementById('security-score');
                    const netReq = document.getElementById('network-requests');
                    if (secScore) secScore.textContent = `${100 - Math.round(data.analysis.score / 2)}/100`;
                    if (netReq) netReq.textContent = `${data.network?.requestCount || 0} reqs`;

                    statusBadge.textContent = data.analysis.level === 'Low' ? 'SECURE' : data.analysis.level.toUpperCase();
                    statusBadge.className = `status-pill status-${data.analysis.level.toLowerCase()}`;
                } else {
                    memVal.textContent = "Analyzing...";
                }
            });
        });
    }

    // Event Listeners
    dashboardBtn.addEventListener('click', () => {
        dashboardBtn.style.opacity = "0.5";
        dashboardBtn.innerText = "OPENING...";
        
        chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" }, (response) => {
            if (chrome.runtime.lastError) {
                alert("Please refresh the page to wake up the Guardian Engine.");
                dashboardBtn.style.opacity = "1";
                dashboardBtn.innerText = "OPEN MASTER DASHBOARD";
            }
        });
    });

    // Initial and periodic updates
    updateTelemetry();
    setInterval(updateTelemetry, 2500);
});
