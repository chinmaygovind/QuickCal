chrome.storage.sync.get("apiKey", async ({ apiKey }) => {
    if (!apiKey) {
      console.log("No API key found. Please authenticate.");
      return; // Remain in unauthenticated state
    } else {
      document.getElementById("container").innerHTML = 
      `
      <h1>QuickCal<\h1>
      <h4>Your API Key is valid! Enjoy using QuickCal<\h4>
      <h4>Your API Key: ${apiKey}<\h4>
      `;
    }
});