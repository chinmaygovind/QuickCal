// A generic onclick callback function.
chrome.contextMenus.onClicked.addListener(genericOnClick);

// A generic onclick callback function.
async function genericOnClick(info) {
    let selectedText = info.selectionText;

    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fullDate = today.toLocaleDateString('en-US', options);
    const dateTimeFormat = new Intl.DateTimeFormat().resolvedOptions();
    const timezone = dateTimeFormat.timeZone;

    let prompt = `
    I will give you some text that I want you to parse.
    Please provide a raw JSON response with the following fields:

    link: A calendar link containing the event details. Must include date, time in the user's local timezone. Use the user's timezone ${timezone} and add that as the "ctz" field of the link.
    Use the event's timezone if given, otherwise default to user's timezone. Also include a 1-2 sentence description of the event in the link.
    Include location if possible. If no event is identified, return "quickcal/missing_event.html".
    missing: If no event was found, provide a field called "missing" with a sentence explaining what details were missing about the event.
    Please parse the following text: 
    Today's date is ${fullDate}. Make sure to take daylight savings time into account when calculating the event time. ${selectedText}
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
            let link = response["link"];
            console.log(response);
            if (link.startsWith("http")) {
                console.log("Successfully grabbed calendar event.")
                chrome.tabs.create({ url: link });
            } else {
                console.log("Failed to extract calendar event.")
                let missing = response["missing"];
                chrome.tabs.create({ url: chrome.extension.getURL(`quickcal/missing_event.html?missing=${missing}`) });
            }
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
    let API_KEY = "AIzaSyD6F3cCRFrcHj4zdi5iXwAiRPQvnE0ctsc";
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

  