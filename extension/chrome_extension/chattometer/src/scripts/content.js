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
    const bottomBox = document.querySelector("div#thread-bottom-container"); // Specific to some UIs like Gemini
    // TODO: Add selectors for other platforms (ChatGPT, Claude, etc.)
    if (bottomBox) {
        badge = document.createElement("div");
        badge.id = BADGE_ID; // Assign the unique ID
        bottomBox.insertAdjacentElement("beforebegin", badge); // Insert before the bottom box
        badge.classList.add("text-token-text-secondary", "text-xs", "font-semibold", "text-center");
        // Add styles for blurred background
        badge.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; // Semi-transparent white background
        badge.style.backdropFilter = "blur(4px)"; // Apply blur effect
        badge.style.webkitBackdropFilter = "blur(4px)"; // For Safari compatibility
        badge.style.padding = "2px 8px"; // Add some padding
        badge.style.marginTop = "4px"; // Add some margin
        badge.style.marginBottom = "4px"; // Add some margin
        console.log("Chattometer badge created.");
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
    // --- Try to find or create and insert the badge ---
    if (!ensureBadgeExists()) {
        // If badge couldn't be found or created (e.g., anchor element not ready), stop here.
        // The MutationObserver or next initialization attempt will try again.
        return;
    }
    // --- End badge finding/creation ---

    // Ensure badge reference is up-to-date (might have been recreated)
    badge = document.getElementById(BADGE_ID);
    if (!badge) {
        console.error("Badge element lost unexpectedly after creation check.");
        return;
    }

    let responses = document.querySelectorAll("div.agent-turn"); // Example selector, adjust per platform
    // TODO: Add selectors for other platforms
    const modelElement = document.querySelector('button[data-testid="model-switcher-dropdown-button"] span'); // Example selector
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

        // --- Send message to background script ---
        // FIXME: Currently only combined impact is calculated. Also implement last response impact calculation
        if (nTokensCombinedText > 0 && modelName !== 'unknown') {
            // Avoid showing "Calculating..." if an error is already displayed
            if (badge && !badge.textContent.startsWith('Error')) {
                badge.textContent = 'Calculating...';
            }
            chrome.runtime.sendMessage(
                {
                    action: "calculateImpact",
                    modelName: modelName, // Send model name
                    tokens: nTokensCombinedText
                },
                (response) => {
                    // Re-fetch the badge element inside the callback, as it might have changed
                    const currentBadge = document.getElementById(BADGE_ID);
                    if (!currentBadge) return; // Badge disappeared

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
                        console.error('Error fetching impact calculation (from background):', response ? response.error : 'Unknown error');
                        currentBadge.textContent = 'Error calculating impact'; // Show error in badge
                    }
                }
            );
        } else if (badge) {
            // If no tokens or unknown model, clear or set default text
            if (!badge.textContent.startsWith('Error')) { // Don't clear error messages
                badge.textContent = ''; // Or 'Enter text to calculate'
            }
        }
        // --- End message sending ---
    } else if (badge) {
        if (!badge.textContent.startsWith('Error')) { // Don't clear error messages
            badge.textContent = ''; // Clear badge if no responses found
        }
    }
}

// --- Function to update the badge ---
function updateBadge(impactData) {
    // Re-check if badge exists in the DOM, as it might have been removed/recreated
    const currentBadge = document.getElementById(BADGE_ID);
    if (!currentBadge) {
        console.log("Badge not found when trying to update.");
        return; // Exit if badge doesn't exist anymore
    }

    if (impactData?.impacts?.energy_kWh?.min !== undefined && impactData?.impacts?.energy_kWh?.max !== undefined && impactData?.impacts?.gwp_kgCO2eq?.min !== undefined && impactData?.impacts?.gwp_kgCO2eq?.max !== undefined) {
        const avgEnergy = (impactData.impacts.energy_kWh.min + impactData.impacts.energy_kWh.max) / 2;
        const avgGhg = (impactData.impacts.gwp_kgCO2eq.min + impactData.impacts.gwp_kgCO2eq.max) / 2;
        // Use innerHTML carefully, ensure data is sanitized if it came from external source
        currentBadge.innerHTML = `Energy: ${avgEnergy.toFixed(4)} kWh<br>GHG: ${avgGhg.toFixed(4)} kgCO2eq`;
    } else {
        // Handle cases where data structure is unexpected or calculation failed previously
        if (!currentBadge.textContent.startsWith('Error')) { // Avoid overwriting specific error messages
            currentBadge.textContent = 'Impact data unavailable';
        }
    }
}

// --- MutationObserver Setup ---

// Define the callback function that runs when mutations are observed
const mutationCallback = function(mutationsList, obs) {
    // Check if the badge anchor still exists before running calculations
    const bottomBox = document.querySelector("div#thread-bottom-container"); // Re-check anchor
    if (bottomBox) {
        findAndLogResponses(); // Run the main logic if the anchor is present
    } else {
        // If the anchor disappeared (e.g., navigating away), disconnect observer
        console.log("Badge anchor lost, disconnecting observer.");
        obs.disconnect();
        // Optionally, try re-initializing after a delay in case it's a temporary removal
        // scheduleInitialization(1000);
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

    // Target 1: Response container (Specific: #thread > div:nth-child(1) > div:nth-child(2)) - Example for Gemini
    // TODO: Add selectors for other platforms
    const specificResponseContainer = document.querySelector("#thread > div:nth-child(1) > div:nth-child(2)");

    if (specificResponseContainer) {
        console.log("Observing specific response container:", specificResponseContainer);
        observer.observe(specificResponseContainer, { childList: true, subtree: true });
        observedSomething = true;
    } else {
        console.warn("Specific response container (#thread > div:nth-child(1) > div:nth-child(2)) not found. Observation might be less targeted.");
        // Fallback: Observe a broader container if specific one isn't found, or rely on body observation later
        const genericResponseContainer = document.querySelector('div[class*="react-scroll-to-bottom"] > div'); // Common in ChatGPT
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
    // 1. Ensure the badge exists or can be created
    if (ensureBadgeExists()) {
        // 2. Run the calculation logic immediately if badge is ready
        findAndLogResponses();
        // 3. Set up observers to watch for changes
        setupObservers();
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

// --- Initial Load ---

// Use DOMContentLoaded for potentially faster initial load than window.load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleInitialization(1000)); // Add slight delay even on DOMContentLoaded
} else {
    // If DOMContentLoaded has already fired
    scheduleInitialization(1500); // Use the original longer delay if loaded later
}

console.log("Chattometer content script loaded.");
