/******/ (() => { // webpackBootstrap
/*!***********************************!*\
  !*** ./src/scripts/background.js ***!
  \***********************************/

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "calculateImpact") {
    // Perform the fetch request
    // FIXME: the current endpoint is a local Flask server running on port 5000, use actual endpoint in production
    fetch('http://127.0.0.1:5000/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // FIXME: use different model names based on request.modelName if needed
        model: "gpt-4o", // Or use request.modelName if backend supports it
        tokens: request.tokens
      }),
    })
    .then(response => {
      if (!response.ok) {
        // If response is not ok, create an error object to send back
        return response.text().then(text => {
          throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
        });
      }
      return response.json(); // Parse JSON if response is ok
    })
    .then(data => {
      // Send the successful data back to the content script
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error('Error fetching impact calculation in background:', error);
      // Send an error object back to the content script
      sendResponse({ success: false, error: error.message });
    });

    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

console.log("Chattometer background script loaded.");

/******/ })()
;
//# sourceMappingURL=background.js.map