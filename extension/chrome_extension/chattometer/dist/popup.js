/******/ (() => { // webpackBootstrap
/*!****************************!*\
  !*** ./src/popup/popup.js ***!
  \****************************/
// Helper to render data into the popup
function renderPopup(data, req) {
  // Update date
  const dateEl = document.getElementById('popup-date');
  const dateStr = new Date(req.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  dateEl.textContent = dateStr;
  // Update tokens
  document.getElementById('popup-tokens').textContent = req.tokens;
  // Update energy
  const energyRange = data.impacts.energy_kWh;
  const avgEnergyWh = ((energyRange.min + energyRange.max) / 2) * 1000;
  document.getElementById('popup-energy').textContent = avgEnergyWh.toFixed(1) + ' Wh';
  // Update GHG
  const ghgRange = data.impacts.gwp_kgCO2eq;
  const avgGhgG = ((ghgRange.min + ghgRange.max) / 2) * 1000;
  document.getElementById('popup-ghg').textContent = avgGhgG.toFixed(1) + ' gCO2eq';
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastImpactData', 'lastRequest'], (result) => {
    if (result.lastImpactData && result.lastRequest) {
      renderPopup(result.lastImpactData, result.lastRequest);
    }
  });
});

// Update in real time if storage changes while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.lastImpactData || changes.lastRequest)) {
    chrome.storage.local.get(['lastImpactData', 'lastRequest'], (result) => {
      if (result.lastImpactData && result.lastRequest) {
        renderPopup(result.lastImpactData, result.lastRequest);
      }
    });
  }
});
/******/ })()
;
//# sourceMappingURL=popup.js.map