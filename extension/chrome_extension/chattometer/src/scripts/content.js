import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

let badge = null; // Declare badge variable outside
const BADGE_ID = "chattometer-impact-badge"; // Unique ID for the badge

// FIXME: use different logic for different URL (different chat platforms)
async function findAndLogResponses() {
    // --- Try to find or create and insert the badge ---
    // Check if the badge already exists in the current DOM
    let existingBadge = document.getElementById(BADGE_ID);

    if (existingBadge) {
        badge = existingBadge; // Update global reference
    } else {
        // Badge doesn't exist, try to create it
        const bottomBox = document.querySelector("div#thread-bottom-container");
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
        } else {
            // If bottomBox isn't found yet, return and let MutationObserver/navigation listener try again
            console.log("Bottom box not found, cannot create badge yet.");
            return;
        }
    }
    // --- End badge finding/creation ---

    let responses = document.querySelectorAll("div.agent-turn");
    const modelElement = document.querySelector('button[data-testid="model-switcher-dropdown-button"] span');
    const modelName = modelElement ? modelElement.textContent.trim() : 'unknown'; // Get model name

    // FIXME: use different tokenizer for different models
    const enc = new Tiktoken(o200k_base);

    let textArray = [];
    let combinedText = '';
    let lastResponse = null;
    let nTokensCombinedText = 0;
    let nTokensLastResponse = 0;
    let impactData = null;

    if (responses.length > 0) {
        textArray = Array.from(responses).map(element => element.textContent || '');
        combinedText = textArray.join('');
        lastResponse = responses[responses.length - 1];
        nTokensCombinedText = enc.encode(combinedText).length;
        nTokensLastResponse  = enc.encode(lastResponse.textContent || '').length;

        // --- Call the backend ---
        // FIXME: Currently only combined impact is calculated. Also implement last response impact calculation
        if (nTokensCombinedText > 0 && modelName !== 'unknown') {
            try {
                // FIXME: the current endpoint is a local Flask server running on port 5000, use actual endpoint in production
                const response = await fetch('http://127.0.0.1:5000/calculate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        // FIXME: use different model names
                        model: "gpt-4o",
                        tokens: nTokensCombinedText
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                impactData = await response.json();
                console.log('Estimated Impact:', impactData);

            } catch (error) {
                console.error('Error fetching impact calculation:', error);
                if (badge) badge.textContent = 'Error calculating impact'; // Show error in badge
            }
        }
        // --- End backend call ---

        if (badge && impactData?.impacts?.energy_kWh?.min !== undefined && impactData?.impacts?.energy_kWh?.max !== undefined && impactData?.impacts?.gwp_kgCO2eq?.min !== undefined && impactData?.impacts?.gwp_kgCO2eq?.max !== undefined) { // Check if badge exists and data is valid
            const avgEnergy = (impactData.impacts.energy_kWh.min + impactData.impacts.energy_kWh.max) / 2;
            const avgGhg = (impactData.impacts.gwp_kgCO2eq.min + impactData.impacts.gwp_kgCO2eq.max) / 2;
            // Use innerHTML to add line breaks and display averages with units after the number
            badge.innerHTML = `Energy (Avg): ${avgEnergy.toFixed(4)} kWh<br>GHG (Avg): ${avgGhg.toFixed(4)} kgCO2eq`;
        } else if (badge && !impactData) { // Handle case where calculation is pending or failed
             if (badge.textContent !== 'Error calculating impact') { // Avoid overwriting error message
                badge.textContent = 'Calculating...';
             }
        } else if (badge) {
             badge.textContent = 'Impact data unavailable'; // Data structure unexpected
        }
    } else if (badge) {
        badge.textContent = ''; // Clear badge if no responses found
    }
}

// --- MutationObserver Setup ---

// Define the callback function that runs when mutations are observed
const callback = function(mutationsList, observer) {
        findAndLogResponses();
};

// Create the observer instance
const observer = new MutationObserver(callback);

// Function to find target elements and attach the observer
function setupObservers() {
    // Disconnect any previous observers to avoid duplicates on re-setup
    observer.disconnect();
    console.log("Attempting to set up specific observers...");

    let observedSomething = false;

    // Target 1: Response container (Specific: #thread > div:nth-child(1) > div:nth-child(2))
    const specificResponseContainer = document.querySelector("#thread > div:nth-child(1) > div:nth-child(2)");

    if (specificResponseContainer) {
        console.log("Observing specific response container:", specificResponseContainer);
        observer.observe(specificResponseContainer, { childList: true, subtree: true });
        observedSomething = true;
    } else {
        console.warn("Specific response container (#thread > div:nth-child(1) > div:nth-child(2)) not found. Falling back...");
        // Fallback: Try finding the common parent of agent turns
        const firstAgentTurn = document.querySelector("div.agent-turn");
        // Find the closest ancestor div that might contain all turns
        const genericResponseContainer = firstAgentTurn ? firstAgentTurn.closest('div[class*="react-scroll-to-bottom"] > div') || firstAgentTurn.parentElement : null;
        if (genericResponseContainer && genericResponseContainer !== document.body) {
            console.log("Observing generic response container:", genericResponseContainer);
            observer.observe(genericResponseContainer, { childList: true, subtree: true });
            observedSomething = true;
        } else {
            console.warn("Generic response container not found or is body. Observation might be broad.");
        }
    }

    // Target 2: Model switcher button
    const modelSwitcherButton = document.querySelector('button[data-testid="model-switcher-dropdown-button"]');
    if (modelSwitcherButton) {
        console.log("Observing model switcher button:", modelSwitcherButton);
        observer.observe(modelSwitcherButton, { childList: true, subtree: true, characterData: true });
        observedSomething = true;
    } else {
        console.warn("Model switcher button not found.");
    }

    // If no specific targets were found after fallbacks, observe the body as a last resort.
    if (!observedSomething) {
        console.warn("Could not find specific elements. Falling back to observing document body.");
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        console.log("Specific observers attached.");
    }
}

// --- Initial Execution and Event Listeners ---

// Re-run logic and observer setup on navigation events (useful for SPAs)
window.addEventListener('popstate', () => {
    console.log("popstate event triggered.");
    // Use setTimeout to allow the DOM to update after navigation
    setTimeout(() => {
        findAndLogResponses(); // Run main logic to update badge based on new page state
        setupObservers();    // Re-attach observers to potentially new elements
    }, 500);
});

// Initial execution: Wait a bit for the page to load, then run logic and set up observers
setTimeout(() => {
    console.log("Initial execution after delay.");
    findAndLogResponses();
    setupObservers();
}, 1500); // Increased delay slightly for potentially slower loading pages
