import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

function findAndLogResponses() {
    let responses = document.querySelectorAll("div.agent-turn");
    const model = document.querySelector('button[data-testid="model-switcher-dropdown-button"] span');

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
