import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

let badge = null; // Declare badge variable outside
const BADGE_ID = "chattometer-impact-badge"; // Unique ID for the badge
let observer = null; // Keep observer instance accessible
let initializationTimer = null; // Timer for debouncing initialization

// --- Function to find or create the badge ---
function ensureBadgeExists() {
    // Check if the badge already exists in the current DOM
    let existingBadge = document.getElementById(BADGE_ID);
    if (existingBadge) {
        badge = existingBadge; // Update global reference
        return true; // Badge exists
    }

    // Badge doesn't exist, try to create it
    const bottomBox = document.querySelector("div#thread-bottom-container"); 
    if (bottomBox) {
        badge = document.createElement("div");
        badge.id = BADGE_ID; // Assign the unique ID
        bottomBox.insertAdjacentElement("beforebegin", badge); // Insert before the bottom box
        badge.classList.add("text-token-text-secondary", "text-xs", "font-semibold", "text-center");

        // Add styles for the badge
        badge.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; // Semi-transparent white background
        badge.style.backdropFilter = "blur(4px)"; // Apply blur effect
        badge.style.webkitBackdropFilter = "blur(4px)"; // For Safari compatibility
        badge.style.padding = "10px"; // Add padding for larger height
        badge.style.marginTop = "4px"; // Add some margin
        badge.style.marginBottom = "4px"; // Add some margin
        badge.style.display = "flex"; // Use flexbox for alignment
        badge.style.alignItems = "center"; // Center items vertically
        badge.style.justifyContent = "center"; // Center items horizontally
        badge.style.height = "150px"; // Increase height to fit the icon and text

        // Add a container for the text
        const textContainer = document.createElement("div");
        textContainer.id = `${BADGE_ID}-text`;
        textContainer.style.display = "flex";
        textContainer.style.flexDirection = "column";
        textContainer.style.justifyContent = "center";
        textContainer.style.alignItems = "center"; // Center text horizontally
        textContainer.style.textAlign = "center"; // Center text alignment

        // Add the image to the badge
        const icon = document.createElement("img");
        icon.src = chrome.runtime.getURL("assets/img/icons/1-128.png"); // Use chrome.runtime.getURL to get the correct path
        icon.alt = "Impact Icon";
        icon.style.width = "128px"; // Adjust the size of the icon
        icon.style.height = "128px";
        icon.style.marginLeft = "8px"; // Add spacing between the text and the icon
        icon.style.verticalAlign = "middle"; // Align the icon with the text

        // Wrap the text and icon in a container to center them together
        const contentWrapper = document.createElement("div");
        contentWrapper.style.display = "flex";
        contentWrapper.style.alignItems = "center"; // Center items vertically
        contentWrapper.style.justifyContent = "center"; // Center items horizontally
        contentWrapper.style.gap = "10px"; // Add spacing between text and icon

        // Append the text container and icon to the wrapper
        contentWrapper.appendChild(textContainer);
        contentWrapper.appendChild(icon);

        // Append the wrapper to the badge
        badge.appendChild(contentWrapper);

        console.log("Chattometer badge created with centered text and icon.");
        return true; // Badge created
    } else {
        // If bottomBox isn't found yet, return false
        console.log("Bottom box not found, cannot create badge yet.");
        badge = null; // Ensure badge reference is null if creation fails
        return false; // Badge could not be created
    }
}

// FIXME: use different logic for different URL (different chat platforms)
async function findAndLogResponses() {
    console.log("findAndLogResponses triggered."); // Log function start
    // --- Try to find or create and insert the badge ---
    if (!ensureBadgeExists()) {
        console.log("Badge anchor not found in findAndLogResponses, exiting.");
        return;
    }
    // --- End badge finding/creation ---

    // Ensure badge reference is up-to-date (might have been recreated)
    badge = document.getElementById(BADGE_ID);
    if (!badge) {
        console.error("Badge element lost unexpectedly after creation check.");
        return;
    }

    let responses = document.querySelectorAll("div.agent-turn"); // TODO: adjust per platform
        // TODO: Add selectors for other platforms
    const modelElement = document.querySelector('button[data-testid="model-switcher-dropdown-button"] span'); // TODO
    // TODO: Add selectors for other platforms
    const modelName = modelElement ? modelElement.textContent.trim() : 'unknown'; // Get model name

    // FIXME: use different tokenizer for different models
    const enc = new Tiktoken(o200k_base);

    let textArray = [];
    let combinedText = '';
    let lastResponse = null;
    let nTokensCombinedText = 0;
    let nTokensLastResponse = 0;

    if (responses.length > 0) {
        textArray = Array.from(responses).map(element => element.textContent || '');
        combinedText = textArray.join('');
        lastResponse = responses[responses.length - 1];
        nTokensCombinedText = enc.encode(combinedText).length;
        nTokensLastResponse = enc.encode(lastResponse.textContent || '').length;

        // --- Log before sending ---
        console.log(`Preparing to send to background: model='${modelName}', tokens=${nTokensCombinedText}, responses found=${responses.length}`);

        // --- Send message to background script ---
        const urlObj = new URL(window.location.href);
        const chatKey = `${urlObj.origin}${urlObj.pathname}`;
        chrome.storage.local.get(['processedTokens', 'lastImpactDataMap', 'lastRequestMap'], (result) => {
            const tokensMapStored = result.processedTokens || {};
            const impactMap = result.lastImpactDataMap || {};
            const reqMap = result.lastRequestMap || {};
            const lastData = impactMap[chatKey];
            const lastReq = reqMap[chatKey];
            // Seed processedTokens for this chatKey from lastRequest if missing
            if (!(chatKey in tokensMapStored) && lastReq && (() => {
                try {
                    const prev = new URL(lastReq.url);
                    return `${prev.origin}${prev.pathname}` === chatKey;
                } catch { return false; }
            })()) {
                tokensMapStored[chatKey] = lastReq.tokens;
                // Persist initial processedTokens map to storage
                chrome.storage.local.set({ processedTokens: tokensMapStored });
            }
            const lastProcessedTokens = tokensMapStored[chatKey] || 0;
            if (nTokensCombinedText <= lastProcessedTokens) {
                console.log("No new tokens since last processed. Rendering cached impact data.");
                // Only render if the cached data corresponds to this chat
                if (lastReq) {
                    try {
                        const prevUrl = new URL(lastReq.url);
                        const prevKey = `${prevUrl.origin}${prevUrl.pathname}`;
                        if (prevKey === chatKey && lastData) {
                            updateBadge(lastData);
                        } else if (badge) {
                            badge.textContent = '';
                        }
                    } catch {
                        if (badge) badge.textContent = '';
                    }
                } else if (badge) {
                    badge.textContent = '';
                }
                return;
            }
            // New tokens: show calculating and send request
            if (badge) badge.textContent = 'Calculating...';
            const requestTimestamp = Date.now();
            chrome.runtime.sendMessage(
                {
                    action: "calculateImpact",
                    modelName: modelName,
                    tokens: nTokensCombinedText,
                    url: window.location.href,
                    timestamp: requestTimestamp
                },
                (response) => {
                    // --- Log response received ---
                    console.log("Received response from background:", JSON.stringify(response, null, 2));

                    // Re-fetch the badge element inside the callback, as it might have changed
                    const currentBadge = document.getElementById(BADGE_ID);
                    if (!currentBadge) {
                        console.log("Badge disappeared before update could happen.");
                        return; // Badge disappeared
                    }

                    // This callback runs when the background script sends a response
                    if (chrome.runtime.lastError) {
                        // Handle potential errors during message sending itself
                        console.error("Error sending message:", chrome.runtime.lastError.message);
                        currentBadge.textContent = 'Error contacting background';
                        return;
                    }

                    if (response && response.success) {
                        const impactData = response.data;
                        console.log('Estimated Impact (from background):', impactData);
                        // Update badge with received data
                        updateBadge(impactData); // Pass currentBadge reference if needed, or let updateBadge find it
                    } else {
                        // Handle errors reported by the background script
                        const errorMsg = response ? response.error : 'Unknown error';
                        console.error('Error fetching impact calculation (from background):', errorMsg);
                        currentBadge.textContent = `Error: ${errorMsg}`; // Show specific error in badge
                    }
                }
            );
        });
        // --- End message sending ---
    } else if (badge) {
        console.log("No responses found (responses.length === 0). Clearing badge.");
        if (!badge.textContent.startsWith('Error')) { // Don't clear error messages
            badge.textContent = ''; // Clear badge if no responses found
        }
    }
}

// --- Function to update the badge ---
function updateBadge(impactData) {
    // --- Log data received by updateBadge ---
    console.log("updateBadge received data:", JSON.stringify(impactData, null, 2));

    // Re-check if badge exists in the DOM, as it might have been removed/recreated
    const currentBadge = document.getElementById(BADGE_ID);
    if (!currentBadge) {
        console.log("Badge not found when trying to update.");
        return; // Exit if badge doesn't exist anymore
    }

    const textContainer = document.getElementById(`${BADGE_ID}-text`);
    if (!textContainer) {
        console.log("Text container not found in badge.");
        return; // Exit if text container doesn't exist
    }

    if (impactData?.impacts?.energy_kWh?.min !== undefined && impactData?.impacts?.energy_kWh?.max !== undefined && impactData?.impacts?.gwp_kgCO2eq?.min !== undefined && impactData?.impacts?.gwp_kgCO2eq?.max !== undefined) {
        const avgEnergy = 1000 * (impactData.impacts.energy_kWh.min + impactData.impacts.energy_kWh.max) / 2;
        const avgGhg = 1000 * (impactData.impacts.gwp_kgCO2eq.min + impactData.impacts.gwp_kgCO2eq.max) / 2;
        const badgeText = `Energy: ${avgEnergy.toFixed(1)} Wh<br>GHG: ${avgGhg.toFixed(1)} gCO2eq`;
        console.log("Setting badge text:", badgeText);
        // Use innerHTML carefully, ensure data is sanitized if it came from external source
        textContainer.innerHTML = badgeText;
    } else {
        // Handle cases where data structure is unexpected or calculation failed previously
        console.log("Impact data structure invalid or missing. Setting badge text to 'Impact data unavailable'.");
        textContainer.textContent = 'Impact data unavailable';
    }
}

// --- MutationObserver Setup ---

// Define the callback function that runs when mutations are observed
const mutationCallback = function(mutationsList, obs) {
    console.log("MutationObserver callback triggered."); // Log observer trigger
    // Check if the badge anchor still exists before running calculations
    const bottomBox = document.querySelector("div#thread-bottom-container"); // Re-check anchor
        if (bottomBox) {
        // --- Add a small delay to allow DOM to settle ---
        setTimeout(() => {
            // Re-check anchor inside timeout in case it disappeared during the delay
            const currentBottomBox = document.querySelector("div#thread-bottom-container");
                        if (!currentBottomBox) {
                console.log("Anchor disappeared during mutation callback delay.");
                return;
            }

            console.log("Checking for responses after short delay...");
            const responsesExist = document.querySelector("div.agent-turn");
            if (responsesExist) {
                console.log("Anchor and responses exist after delay, calling findAndLogResponses.");
                findAndLogResponses(); // Run the main logic only if responses are also present
            } else {
                console.log("Anchor exists, but no responses found after delay. Waiting for next mutation.");
                // Optionally, clear the badge if no responses are found after the delay
                const currentBadge = document.getElementById(BADGE_ID);
                if (currentBadge && !currentBadge.textContent.startsWith('Error') && !currentBadge.textContent.startsWith('Calculating')) {
                    currentBadge.textContent = '';
                }
            }
        }, 300); // Increased delay to 300 milliseconds

    } else {
        // If the anchor disappeared (e.g., navigating away), disconnect observer
        console.log("Badge anchor lost, disconnecting observer.");
        if (observer) observer.disconnect(); // Ensure observer is disconnected
        badge = null; // Clear badge reference
    }
};

// Function to find target elements and attach the observer
function setupObservers() {
    // Disconnect any previous observers to avoid duplicates
    if (observer) {
        observer.disconnect();
        console.log("Disconnected previous observer.");
    } else {
        // Create the observer instance if it doesn't exist
        observer = new MutationObserver(mutationCallback);
    }

    console.log("Attempting to set up specific observers...");

    let observedSomething = false;

    // Target 1: Response container 
    // TODO: Add selectors for other platforms
    const specificResponseContainer = document.querySelector("#thread > div:nth-child(1) > div:nth-child(2)");

    if (specificResponseContainer) {
        console.log("Observing specific response container:", specificResponseContainer);
        observer.observe(specificResponseContainer, { childList: true, subtree: true });
        observedSomething = true;
    } else {
        console.warn("Specific response container (#thread > div:nth-child(1) > div:nth-child(2)) not found. Observation might be less targeted.");
        // Fallback: Observe a broader container if specific one isn't found, or rely on body observation later
        const genericResponseContainer = document.querySelector('div[class*="react-scroll-to-bottom"] > div'); 
        if (genericResponseContainer && genericResponseContainer !== document.body) {
            console.log("Observing generic response container:", genericResponseContainer);
            observer.observe(genericResponseContainer, { childList: true, subtree: true });
            observedSomething = true;
        }
    }

    // Target 2: Model switcher button (Example selector)
    // TODO: Add selectors for other platforms
    const modelSwitcherButton = document.querySelector('button[data-testid="model-switcher-dropdown-button"]');
    if (modelSwitcherButton) {
        console.log("Observing model switcher button:", modelSwitcherButton);
        // Observe changes to the button's text content (subtree and characterData)
        observer.observe(modelSwitcherButton, { childList: true, subtree: true, characterData: true });
        // Note: Observing the button itself might not be necessary if observing the response container catches model changes indirectly.
        // Keep it if model changes *without* new responses need immediate recalculation.
        observedSomething = true; // Count this even if container was also observed
    } else {
        console.warn("Model switcher button not found.");
    }

    // If no specific targets were found, observe the body as a last resort.
    // This is less efficient but provides broader coverage.
    if (!observedSomething) {
        console.warn("Could not find specific elements. Falling back to observing document body.");
        // Ensure we don't observe the body if we already observed something more specific
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        console.log("Specific observers attached.");
    }
}

// --- Initialization Logic ---

function initializeChattometer() {
    console.log("Initializing Chattometer...");
    // Ensure the badge exists or can be created
    if (ensureBadgeExists()) {
        // Immediately render cached impact data if available
        const urlObjInit = new URL(window.location.href);
        const initChatKey = `${urlObjInit.origin}${urlObjInit.pathname}`;
        chrome.storage.local.get(['lastImpactDataMap', 'lastRequestMap'], (initResult) => {
            const impactMapInit = initResult.lastImpactDataMap || {};
            const reqMapInit = initResult.lastRequestMap || {};
            const lastDataInit = impactMapInit[initChatKey];
            const lastReqInit = reqMapInit[initChatKey];
            if (lastDataInit && lastReqInit) {
                try {
                    const prevInit = new URL(lastReqInit.url);
                    if (`${prevInit.origin}${prevInit.pathname}` === initChatKey) {
                        updateBadge(lastDataInit);
                    }
                } catch {}
            }
            // Proceed with normal logic
            findAndLogResponses();
            setupObservers();
        });
    } else {
        // If badge couldn't be created (anchor not found), schedule another attempt
        console.log("Badge anchor not found. Retrying initialization soon...");
        scheduleInitialization(1000); // Try again in 1 second
    }
}

// Debounced initialization function
function scheduleInitialization(delay = 500) {
    clearTimeout(initializationTimer); // Clear any existing timer
    initializationTimer = setTimeout(initializeChattometer, delay);
}

// --- Event Listeners for Navigation ---

// Listen for standard navigation events
window.addEventListener('popstate', () => {
    console.log("popstate event triggered.");
    scheduleInitialization();
});
window.addEventListener('hashchange', () => {
    console.log("hashchange event triggered.");
    scheduleInitialization();
});

// Wrap history API methods to detect SPA navigation
const originalPushState = history.pushState;
history.pushState = function() {
    const result = originalPushState.apply(this, arguments);
    window.dispatchEvent(new Event('pushstate')); // Dispatch custom event
    window.dispatchEvent(new Event('locationchange')); // Generic event
    return result;
};

const originalReplaceState = history.replaceState;
history.replaceState = function() {
    const result = originalReplaceState.apply(this, arguments);
    window.dispatchEvent(new Event('replacestate')); // Dispatch custom event
    window.dispatchEvent(new Event('locationchange')); // Generic event
    return result;
};

// Listen for our custom navigation events
window.addEventListener('pushstate', () => {
    console.log("pushstate intercepted.");
    scheduleInitialization();
});
window.addEventListener('replacestate', () => {
    console.log("replacestate intercepted.");
    scheduleInitialization();
});

// Listen for generic SPA navigation event
window.addEventListener('locationchange', () => {
    console.log("locationchange intercepted.");
    scheduleInitialization();
});

// --- Initial Load ---

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleInitialization(1000)); // Add slight delay even on DOMContentLoaded
} else {
    // If DOMContentLoaded has already fired
    scheduleInitialization(1500);
}

console.log("Chattometer content script loaded.");

// Listen for reinitialization requests from background script
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reinitializeChattometer') {
      console.log('Received reinit message. Reinitializing Chattometer...');
      scheduleInitialization();
    }
  });
}

// Export functions for unit testing
export { ensureBadgeExists, updateBadge };
