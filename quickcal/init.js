// Initialize calendar preference selection
document.getElementById("google_calendar").addEventListener("click", async () => { update_cal("google_calendar"); });
document.getElementById("outlook_calendar").addEventListener("click", async () => { update_cal("outlook_calendar"); });
document.getElementById("apple_calendar").addEventListener("click", async () => { update_cal("apple_calendar"); });
document.getElementById("other_calendar").addEventListener("click", async () => { update_cal("other_calendar"); });

// Load saved calendar preference
chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
  const selectedPreference = calendar_preference ?? "google_calendar";
  document.getElementById(selectedPreference).checked = true;
});

window.onload = function() {
  chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
    const selectedPreference = calendar_preference ?? "google_calendar";
    document.getElementById(selectedPreference).click();
  });
};

function update_cal(calendar_preference) {
  chrome.storage.sync.set({"calendar_preference": calendar_preference}, () => {
    console.log("QuickCal: Set preference to " + calendar_preference);
  });
}