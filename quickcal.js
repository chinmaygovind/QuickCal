chrome.runtime.onStartup.addListener(() => {
    initializeExtension();
});
  
chrome.runtime.onInstalled.addListener(() => {
    initializeExtension();
});

let API_KEY = null;
async function initializeExtension() {
    chrome.storage.sync.get("apiKey", async ({ apiKey }) => {
      if (!apiKey) {
        console.log("No API key found. Please authenticate.");
        return; // Remain in unauthenticated state
      }
  
    console.log("API key is valid. Starting background service...");
    API_KEY = apiKey;
    });
  }

// A generic onclick callback function.
chrome.contextMenus.onClicked.addListener(genericOnClick);

// A generic onclick callback function.
async function genericOnClick(info) {
    if (API_KEY === null) {
        chrome.action.openPopup()
        console.log("Invalid API key.");
        return;
    }
    let selectedText = info.selectionText;

    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fullDate = today.toLocaleDateString('en-US', options);
    const dateTimeFormat = new Intl.DateTimeFormat().resolvedOptions();
    const timezone = dateTimeFormat.timeZone;

    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const currentURL = tab.url;
    const safeURL = encodeURIComponent(currentURL);

    let prompt = `
    I will give you some text that I want you to parse. The text should describe an event.
    Please provide a raw JSON response with the following fields:

    title: the title of the event.
    timestamp_start: a UTC timestamp of when the event starts in the format YYYYMMDDTHHMMSS. If no year is given, default to the upcoming instance of that date.
    timestamp_end: a UTC timestamp of when the event ends in the format YYYYMMDDTHHMMSS. (If not given, default to one hour after start.)
    location: the location of the event. 
    description: a short 2-3 sentence description of the event containing any pertinent information or links.
    
    missing: a list with any of the above fields (title, timestamp_start, timestamp_end, location, description) which are not described in the event.
    
    Please parse the following text: 
    Today's date is ${fullDate}. ${selectedText}
    `

    sendPromptToGemini(prompt, (error, data) => {
        if (error) {
          console.log(error);
        } else {
            let response = data.candidates[0].content.parts[0].text;
            console.log(response);
            const lines = response.split('\n');
            response = lines.slice(1, -1).join('\n');
            response = JSON.parse(response);
            // https://www.google.com/calendar/render?action=TEMPLATE&text=Your+Event+Name&dates=20140127T224000Z/20140320T221500Z&details=For+details,+link+here:+http://www.example.com&location=Waldorf+Astoria,+301+Park+Ave+,+New+York,+NY+10022&sf=true&output=xml
            let link = `https://www.google.com/calendar/render?action=TEMPLATE&text=${response['title']}&dates=${response['timestamp_start']}/${response['timestamp_end']}&details=${response['description']}&location=${response['location'] ?? ""}`
            chrome.tabs.create({ url: link });
        }
      });
}
chrome.runtime.onInstalled.addListener(function () {
    // Create item for the "selection" context type.
    chrome.contextMenus.create({
        title: "Add selection to calendar",
        contexts: ["selection"],
        id: "selection"
    });

});

/**
 * Sends a prompt to the Gemini API.
 * @param {string} prompt - The user input prompt.
 * @param {function} callback - A callback to handle the API response or errors.
 */
function sendPromptToGemini(prompt, callback) {
    let request_contents = {
        "contents": [{
            "parts":[{"text": prompt}]
        }]
    }
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request_contents),
        })
    .then((response) => {
        if (!response.ok) {
        throw new Error(`API error: ${response.status}, ${response.statusText}`);
        }
        return response.json();
    })
    .then((data) => callback(null, data))
    .catch((error) => callback(`Error: ${error.message}`));
}

  