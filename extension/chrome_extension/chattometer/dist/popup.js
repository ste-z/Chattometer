/******/ (() => { // webpackBootstrap
/*!****************************!*\
  !*** ./src/popup/popup.js ***!
  \****************************/
// Helper to clear popup fields when chat has no data
function clearPopup() {
  document.getElementById('equiv-bulb-minutes').textContent = '--';
  document.getElementById('equiv-laptop-hours').textContent = '--';
}

// Log when popup script is loaded
console.log('popup.js loaded');

// Initialization function for popup data
function initPopup() {
  console.log('popup.js: initPopup called');

  // ← always update cumulative display, even if we're not on a chat page
  chrome.storage.local.get(['cumulativeRequests'], (res) => {
    const cum = res.cumulativeRequests || {};
    updateCumulative(cum);
  });

  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        clearPopup();
        return;
      }
      const urlObj = new URL(tab.url);
      const chatKey = `${urlObj.origin}${urlObj.pathname}`;

      // only fetch & render chat‐specific data here
      chrome.storage.local.get(['lastImpactDataMap', 'lastRequestMap'], (result) => {
        const impactMap = result.lastImpactDataMap || {};
        const reqMap    = result.lastRequestMap    || {};
        const data = impactMap[chatKey];
        const req  = reqMap[chatKey];

        if (data && req) {
          renderPopup(data, req);
        } else {
          clearPopup();
        }
      });
    });
  } catch (e) {
    console.error('Error querying tabs in initPopup:', e);
    clearPopup();
  }
}

// Invoke initPopup based on document ready state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}

// Update in real time if storage changes while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    // If cumulativeRequests changed, update cumulative immediately
    if (changes.cumulativeRequests) {
      const cum = changes.cumulativeRequests.newValue || {};
      updateCumulative(cum);
    }
    if (changes.lastImpactDataMap || changes.lastRequestMap) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) {
          return;
        }
        const urlObj = new URL(tab.url);
        const chatKey = `${urlObj.origin}${urlObj.pathname}`;
        chrome.storage.local.get(['lastImpactDataMap', 'lastRequestMap', 'cumulativeRequests'], (result) => {
          const impactMap = result.lastImpactDataMap || {};
          const reqMap = result.lastRequestMap || {};
          const cum = result.cumulativeRequests || {};
          const data = impactMap[chatKey];
          const req = reqMap[chatKey];
          if (data && req) {
            renderPopup(data, req);
          } else {
            clearPopup();
          }
          updateCumulative(cum);
        });
      });
    }
  }
});

// Function to update cumulative impacts display
function updateCumulative(cumMap) {
  console.log('popup.js: updateCumulative called with', cumMap);
  let totalEnergy = 0;
  let totalGhg = 0;
  let totalTokens = 0;
  let sinceTimestamp = Infinity;
  Object.values(cumMap).forEach(val => {
    totalEnergy += val.energyWh;
    totalGhg += val.ghgG;
    if (val.tokens) totalTokens += val.tokens;
    if (val.timestamp && Date.parse(val.timestamp) < sinceTimestamp) sinceTimestamp = Date.parse(val.timestamp);
  });
  const sinceDateStr = isFinite(sinceTimestamp)
    ? new Date(sinceTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const cumDateEl = document.getElementById('popup-cum-date');
  if (cumDateEl) cumDateEl.textContent = `Cumulative impacts since ${sinceDateStr}`;
  const cumTokensEl = document.getElementById('popup-cum-tokens');
  if (cumTokensEl) cumTokensEl.textContent = totalTokens.toString();
  const cumEnergyEl = document.getElementById('popup-cum-energy');
  const cumGhgEl = document.getElementById('popup-cum-ghg');
  if (cumEnergyEl) cumEnergyEl.textContent = totalEnergy.toFixed(1) + ' Wh';
  if (cumGhgEl) cumGhgEl.textContent = totalGhg.toFixed(1) + ' gCO2eq';
  // Update cumulative equivalents: bulb minutes and laptop hours based on total energy in Wh
  const eqBulbEl = document.getElementById('equiv-bulb-minutes');
  const eqLaptopEl = document.getElementById('equiv-laptop-hours');
  if (eqBulbEl) {
    const bulbMin = totalEnergy * 6; // 1 Wh corresponds to 6 minutes at 10W
    eqBulbEl.textContent = bulbMin.toFixed(0);
  }
  if (eqLaptopEl) {
    const lapHours = totalEnergy / 35; // average laptop uses 35 Wh per hour
    eqLaptopEl.textContent = lapHours.toFixed(1);
  }
}
/******/ })()
;
//# sourceMappingURL=popup.js.map