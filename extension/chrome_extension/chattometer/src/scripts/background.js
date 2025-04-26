// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "calculateImpact") {
    // --- Log request received ---
    console.log("Background script received 'calculateImpact' request:", JSON.stringify(request, null, 2));

    const requestBody = {
        // FIXME: use different model names based on request.modelName if needed
        model: "gpt-4o",
        tokens: request.tokens
    };

    // --- Log request body being sent to backend ---
    console.log("Sending request to backend:", JSON.stringify(requestBody, null, 2));


    // Perform the fetch request
    fetch('https://chattometer.onrender.com/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    .then(response => {
      if (!response.ok) {
        // If response is not ok, create an error object to send back
        return response.text().then(text => {
          // --- Log backend error response ---
          console.error(`Backend responded with error: ${response.status}`, text);
          throw new Error(`Backend Error: ${response.status} - ${text}`); // More informative error
        });
      }
      return response.json(); // Parse JSON if response is ok
    })
    .then(data => {
      // --- Log successful data from backend ---
      console.log("Received successful data from backend:", JSON.stringify(data, null, 2));
      // --- Compute average impacts for cumulative tracking ---
      const avgEnergyWh = ((data.impacts.energy_kWh.min + data.impacts.energy_kWh.max) / 2) * 1000;
      const avgGhgG = ((data.impacts.gwp_kgCO2eq.min + data.impacts.gwp_kgCO2eq.max) / 2) * 1000;
      // Update cumulative impacts only for new tokens since last processed count
      chrome.storage.local.get(['cumulativeRequests', 'processedTokens'], (result) => {
        const cum = result.cumulativeRequests || {};
        const tokensMap = result.processedTokens || {};
        // Create a consistent key by using origin + pathname (ignore search/hash)
        const urlObj = new URL(request.url);
        const chatKey = `${urlObj.origin}${urlObj.pathname}`;  
        // Initialize cumulative entry with tokens and timestamp
        if (!cum[chatKey]) {
          cum[chatKey] = {
            energyWh: 0,
            ghgG: 0,
            tokens: 0,
            timestamp: new Date(request.timestamp).toISOString()
          };
        }
        const lastTokens = tokensMap[chatKey] || 0;
        const newTokens = request.tokens;
        const deltaTokens = newTokens - lastTokens;
        if (deltaTokens > 0) {
          const energyPerToken = avgEnergyWh / newTokens;
          const ghgPerToken = avgGhgG / newTokens;
          cum[chatKey].energyWh += energyPerToken * deltaTokens;
          cum[chatKey].ghgG += ghgPerToken * deltaTokens;
          // Update cumulative tokens
          cum[chatKey].tokens = newTokens;
          tokensMap[chatKey] = newTokens;
        }
        chrome.storage.local.set({ cumulativeRequests: cum, processedTokens: tokensMap });
      });

      // Store impact data and request info for popup
      chrome.storage.local.get(['lastImpactDataMap', 'lastRequestMap'], (maps) => {
        const impactMap = maps.lastImpactDataMap || {};
        const reqMap = maps.lastRequestMap || {};
        const urlObj = new URL(request.url);
        const chatKey = `${urlObj.origin}${urlObj.pathname}`;
        // Update maps for this chat
        impactMap[chatKey] = data;
        reqMap[chatKey] = { model: request.modelName, tokens: request.tokens, timestamp: request.timestamp, url: request.url };
        // Persist maps
        chrome.storage.local.set({ lastImpactDataMap: impactMap, lastRequestMap: reqMap }, () => {
          console.log('Saved impact data map and request map to storage');
          sendResponse({ success: true, data: data });
        });
      });
    })
    .catch(error => {
      // --- Log fetch/processing error ---
      console.error('Error during fetch or processing in background:', error);
      // Send an error object back to the content script
      console.log("Sending error response to content script.");
      sendResponse({ success: false, error: error.message });
    });

    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

console.log("Chattometer background script loaded");

// Listen for SPA navigation events and notify content scripts to reinitialize
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { action: 'reinitializeChattometer' }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Error sending reinit message to content script:', chrome.runtime.lastError.message);
    }
  });
});
