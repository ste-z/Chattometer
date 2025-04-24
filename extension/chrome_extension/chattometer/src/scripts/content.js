import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

let badge = null; // Declare badge variable outside
const BADGE_ID = "chattometer-impact-badge"; // Unique ID for the badge

// TODO: set class
// badge.classList.add("");

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
                const response = await fetch('http://127.0.0.1:5000/calculate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        // FIXME: use different model names
                        model: "gpt-4o",
                        tokens: nTokensCombinedText // Send tokens for the last response
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                impactData = await response.json();
                console.log('Estimated Impact:', impactData);
                // TODO: Display this data in the extension UI (e.g., popup or inject into page)

            } catch (error) {
                console.error('Error fetching impact calculation:', error);
            }
        }
        // --- End backend call ---

        if (badge && impactData?.impacts?.energy_kWh?.min !== undefined && impactData?.impacts?.energy_kWh?.max !== undefined && impactData?.impacts?.gwp_kgCO2eq?.min !== undefined && impactData?.impacts?.gwp_kgCO2eq?.max !== undefined) { // Check if badge exists and data is valid
            const avgEnergy = (impactData.impacts.energy_kWh.min + impactData.impacts.energy_kWh.max) / 2;
            const avgGhg = (impactData.impacts.gwp_kgCO2eq.min + impactData.impacts.gwp_kgCO2eq.max) / 2;
            badge.innerHTML = `⚡ Energy: ${avgEnergy.toFixed(4)} kWh<br>🏭 GHG Emissions: ${avgGhg.toFixed(4)} kgCO2eq`;
        } else if (badge) {
            badge.textContent = 'Calculating...';
        }
    } else if (badge) {
        badge.textContent = ''; // Clear badge if no responses found
    }
}

// Continuous re-execute when mutations are observed
const callback = function(mutationsList, observer) {
    findAndLogResponses();
};
const observer = new MutationObserver(callback);
observer.observe(document.body, { childList: true, subtree: true });

// Re-run on navigation events (useful for SPAs)
window.addEventListener('popstate', findAndLogResponses);

// Initial check in case the elements are already present at script execution
findAndLogResponses();
