import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";


// FIXME: use different logic for different URL (different chat platforms)
async function findAndLogResponses() { 
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

    if (responses.length > 0) {
        textArray = Array.from(responses).map(element => element.textContent || '');
        combinedText = textArray.join('');
        lastResponse = responses[responses.length - 1];
        nTokensCombinedText = enc.encode(combinedText).length;
        nTokensLastResponse  = enc.encode(lastResponse.textContent || '').length;

        // --- Call the backend ---
        if (nTokensLastResponse > 0 && modelName !== 'unknown') {
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

                const impactData = await response.json();
                console.log('Estimated Impact:', impactData);
                // TODO: Display this data in the extension UI (e.g., popup or inject into page)

            } catch (error) {
                console.error('Error fetching impact calculation:', error);
            }
        }
        // --- End backend call ---
    }
}
  
// Continuous re-execute when mutations are observed
const callback = function(mutationsList, observer) {
    findAndLogResponses();
};
const observer = new MutationObserver(callback);
observer.observe(document.body, { childList: true, subtree: true });

// Initial check in case the elements are already present at script execution
findAndLogResponses();

// Disconnecting the observer after a timeout
//   setTimeout(() => {
//      observer.disconnect();
//      console.log("Observer stopped waiting.");
//   }, 15000); // Stop after 15 seconds
