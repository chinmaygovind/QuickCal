chrome.storage.sync.get("apiKey", async ({ apiKey }) => {
    if (!apiKey) {
      console.log("No API key found. Please authenticate.");
      return; // Remain in unauthenticated state
    } else {
      document.getElementById("container").innerHTML = 
      `
      <h1>QuickCal<\h1>
      <h4 style='color:green'>Your API Key is valid! Enjoy using QuickCal. Highlight some text to begin!<\h4>
      <h3>Choose your Calendar Format<\h3>
      <label for="google_calendar">
      <input type="radio" id="google_calendar" name="calendar_format" value="google_calendar">
      Google Calendar
      </label><br><br>
      <label for="outlook_calendar">
      <input type="radio" id="outlook_calendar" name="calendar_format" value="outlook_calendar">
      Microsoft Outlook Calendar
      </label><br><br>
      <label for="apple_calendar">
      <input type="radio" id="apple_calendar" name="calendar_format" value="apple_calendar">
      Apple Calendar
      </label><br><br>
      <label for="other_calendar">
      <input type="radio" id="other_calendar" name="calendar_format" value="other_calendar">
      Other Calendar
      </label><br><br>
      `;
      document.getElementById("google_calendar").addEventListener("click", async () => { update_cal("google_calendar"); });
      document.getElementById("outlook_calendar").addEventListener("click", async () => { update_cal("outlook_calendar"); });
      document.getElementById("apple_calendar").addEventListener("click", async () => { update_cal("apple_calendar"); });
      document.getElementById("other_calendar").addEventListener("click", async () => { update_cal("other_calendar"); });
      chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
        document.getElementById(calendar_preference ?? "google_calendar").clicked = true;
      });
    }
});

window.onload = function() {
  chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
    document.getElementById(calendar_preference ?? "google_calendar").click();
    // console.log(`Updated clicked radio button on popup at ${new Date().toISOString()} to select ${calendar_preference ?? "google_calendar"}`);
    // console.log(document.getElementById(calendar_preference ?? "google_calendar"));
  });
};

function update_cal(calendar_preference) {
  chrome.storage.sync.set({"calendar_preference": calendar_preference}, () => {
    console.log("QuickCal: Set preference to " + calendar_preference);
  });
}