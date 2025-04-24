import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

const enc = new Tiktoken(o200k_base);

function findAndLogResponses() {
    let responses = document.querySelectorAll("div.agent-turn");

    if (responses.length > 0) {
        let textArray = Array.from(responses).map(element => element.textContent || '');
        let combinedText = textArray.join('');
        let lastResponse = responses[responses.length - 1];
        let nTokensCombinedText = enc.encode(combinedText).length;
        let nTokensLastResponse  = enc.encode(lastResponse).length;


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
