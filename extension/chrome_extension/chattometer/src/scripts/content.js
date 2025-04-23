function findAndLogResponses() {
    const responses = document.querySelectorAll("div.agent-turn");
    // FIXME: Remove console.log in production code
    if (responses.length > 0) {
        console.log("Responses found:", responses);

        textArray = Array.from(responses).map(element => element.textContent || '');
        const combinedText = textArray.join('');
        console.log(combinedText);
        const lastResponse = responses[responses.length - 1];
        console.log(lastResponse);
    } else {
        console.log("Waiting for responses to appear...");
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