/******/ (() => { // webpackBootstrap
/*!***********************************!*\
  !*** ./src/scripts/background.js ***!
  \***********************************/
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
    // FIXME: the current endpoint is a local Flask server running on port 5000, use actual endpoint in production
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
      // Send the successful data back to the content script
      console.log("Sending success response to content script.");
      sendResponse({ success: true, data: data });
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

/******/ })()
;
//# sourceMappingURL=background.js.map