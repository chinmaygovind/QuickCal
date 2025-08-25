
chrome.runtime.onStartup.addListener(() => {
    initializeExtension();
});
  
chrome.runtime.onInstalled.addListener(() => {
    initializeExtension();
});

// AWS Lambda endpoint URL - replace with your actual endpoint
const LAMBDA_ENDPOINT = "https://zvm5r0eaxe.execute-api.us-east-1.amazonaws.com/default/quickcal-event-processor";

// Generate unique session ID for tracking
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function initializeExtension() {
    console.log("QuickCal extension initialized and ready to use!");
    // No API key setup needed - Lambda handles the Gemini API calls
}

// A generic onclick callback function.
chrome.contextMenus.onClicked.addListener(genericOnClick);

// A generic onclick callback function.
async function genericOnClick(info) {
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

    // Get user email (if available from Chrome)
    let userEmail = 'anonymous';
    try {
        // Try to get user email from Chrome identity
        if (chrome.identity && chrome.identity.getProfileUserInfo) {
            const userInfo = await new Promise((resolve) => {
                chrome.identity.getProfileUserInfo({accountStatus: 'ANY'}, resolve);
            });
            if (userInfo.email) {
                userEmail = userInfo.email;
            }
        }
    } catch (e) {
        console.log('Could not get user email:', e);
    }

    // Send data to AWS Lambda instead of directly to Gemini
    const requestPayload = {
        selectedText: selectedText,
        currentDate: fullDate,
        timezone: timezone,
        sourceUrl: currentURL,
        userEmail: userEmail,
        sessionId: generateSessionId()
    };

    sendToLambda(requestPayload, (error, response) => {
        // Clear visual indicator when done
        chrome.action.setBadgeText({ text: '' });
        // Clear notification when done
        chrome.notifications.clear('quickcal-processing');
        
        if (error) {
            console.error('Lambda error:', error);
            chrome.notifications.create('quickcal-error', {
                type: 'basic',
                iconUrl: 'images/quickcal.png',
                title: 'QuickCal Error',
                message: 'Failed to process event. Please try again.'
            });
            return;
        }

        // Process the response from Lambda
        let eventData = response;
        eventData['title'] ??= "PLACEHOLDER TITLE";
        eventData['description'] ??= selectedText;
        eventData['location'] ??= "";
        
        chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
            let format = calendar_preference ?? "google_calendar";
            if (format === "google_calendar") {
                let link = `https://www.google.com/calendar/render?action=TEMPLATE&text=${eventData['title']}&dates=${eventData['timestamp_start']}/${eventData['timestamp_end']}&details=${eventData['description']}&location=${eventData['location']}`
                chrome.tabs.create({ url: link });
            } else if (format === "outlook_calendar") {
                let start_time = eventData['timestamp_start'].substring(0, 4) + "-" 
                    + eventData['timestamp_start'].substring(4, 6) + "-"
                    + eventData['timestamp_start'].substring(6, 11) + ":"
                    + eventData['timestamp_start'].substring(11, 13) + ":"
                    + eventData['timestamp_start'].substring(13);
                let end_time = eventData['timestamp_end'].substring(0, 4) + "-" 
                    + eventData['timestamp_end'].substring(4, 6) + "-"
                    + eventData['timestamp_end'].substring(6, 11) + ":"
                    + eventData['timestamp_end'].substring(11, 13) + ":"
                    + eventData['timestamp_end'].substring(13);
                let link = `https://outlook.live.com/calendar/0/deeplink/compose?allday=false&subject=${eventData['title']}&body=${eventData['description']}&startdt=${start_time}&enddt=${end_time}&location=${eventData['location']}&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent`
                chrome.tabs.create({ url: link });
            } else if (format === "apple_calendar" || format === "other_calendar") {
                let timestamp = new Date().toISOString().replaceAll("-","").replaceAll(":","").replaceAll("Z","");
                let icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//QuickCal//NONSGML v1.0//EN
BEGIN:VEVENT
UID:quickcal-${timestamp}
SUMMARY:${eventData['title']}
DESCRIPTION:${eventData['description']}
DTSTART:${eventData['timestamp_start']}
DTEND:${eventData['timestamp_end']}
DTSTAMP:${timestamp}
LOCATION:${eventData['location']}
GEO:37.5739497;-85.7399606
END:VEVENT
END:VCALENDAR`;
                console.log("Downloading ics: ");
                console.log(icsContent);
                const link = "data:text/calendar," + icsContent;
                chrome.tabs.create({ url: link });
            }
        });
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
 * Sends event data to AWS Lambda function for processing.
 * @param {object} payload - The event data to send to Lambda.
 * @param {function} callback - A callback to handle the Lambda response or errors.
 */
function sendToLambda(payload, callback) {
    fetch(LAMBDA_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })
    .then((response) => {
        if (!response.ok) {
            throw new Error(`Lambda error: ${response.status}, ${response.statusText}`);
        }
        return response.json();
    })
    .then((data) => callback(null, data))
    .catch((error) => callback(`Error: ${error.message}`));
}

  