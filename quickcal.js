
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
            chrome.action.openPopup();
            console.log("No API key found. Please authenticate.");
            return; // Remain in unauthenticated state
        }

        console.log(`API key loaded. Starting background service...`);
        console.log(`API Key: ${apiKey}`);
        API_KEY = apiKey;
    });
}

// A generic onclick callback function.
chrome.contextMenus.onClicked.addListener(genericOnClick);

// A generic onclick callback function.
async function genericOnClick(info) {
    if (API_KEY === null) {
        initializeExtension();
        return;
    }
    let selectedText = info.selectionText;

    // Show Chrome notification for processing
    chrome.notifications.create('quickcal-processing', {
        type: 'basic',
        iconUrl: 'images/quickcal.png',
        title: 'QuickCal',
        message: 'Processing selection...'
    });

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
        // Clear visual indicator when done
        chrome.action.setBadgeText({ text: '' });
        // Clear notification when done
        chrome.notifications.clear('quickcal-processing');
        if (error) {
          console.log(error);
        } else {
            let response = data.candidates[0].content.parts[0].text;
            console.log(response);
            const lines = response.split('\n');
            response = lines.slice(1, -1).join('\n');
            response = JSON.parse(response);
            response['title'] ??= "PLACEHOLDER TITLE"; // ??= is my new favorite operator
            response['description'] ??= selectedText;
            response['location'] ??= "";
            chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
                let format = calendar_preference ?? "google_calendar";
                if (format === "google_calendar") {
                    let link = `https://www.google.com/calendar/render?action=TEMPLATE&text=${response['title']}&dates=${response['timestamp_start']}/${response['timestamp_end']}&details=${response['description']}&location=${response['location']}`
                    chrome.tabs.create({ url: link });
                } else if (format === "outlook_calendar") {
                    let start_time = response['timestamp_start'].substring(0, 4) + "-" 
                        + response['timestamp_start'].substring(4, 6) + "-"
                        + response['timestamp_start'].substring(6, 11) + ":"
                        + response['timestamp_start'].substring(11, 13) + ":"
                        + response['timestamp_start'].substring(13);
                    let end_time = response['timestamp_end'].substring(0, 4) + "-" 
                        + response['timestamp_end'].substring(4, 6) + "-"
                        + response['timestamp_end'].substring(6, 11) + ":"
                        + response['timestamp_end'].substring(11, 13) + ":"
                        + response['timestamp_end'].substring(13);
                    let link = `https://outlook.live.com/calendar/0/deeplink/compose?allday=false&subject=${response['title']}&body=${response['description']}&startdt=${start_time}&enddt=${end_time}&location=${response['location']}&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent`
                    chrome.tabs.create({ url: link });
                } else if (format === "apple_calendar" || format === "other_calendar") {
                    let timestamp = new Date().toISOString().replaceAll("-","").replaceAll(":","").replaceAll("Z","");
                    let icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//QuickCal//NONSGML v1.0//EN
BEGIN:VEVENT
UID:quickcal-${timestamp}
SUMMARY:${response['title']}
DESCRIPTION:${response['description']}
DTSTART:${response['timestamp_start']}
DTEND:${response['timestamp_end']}
DTSTAMP:${timestamp}
LOCATION:${response['location']}
GEO:37.5739497;-85.7399606
END:VEVENT
END:VCALENDAR`;
                    console.log("Downloading ics: ");
                    console.log(icsContent);
                    const link = "data:text/calendar," + icsContent;
                    chrome.tabs.create({ url: link });
                }
            });
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
    };
    fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": API_KEY
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

  