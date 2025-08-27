
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

    // Record start time for processing duration
    const processingStartTime = Date.now();

    // Get current tab for visual indicator and URL
    const [activeTab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    
    // Create a floating notification on the page
    chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
            // Create floating indicator with progress bar
            const indicator = document.createElement('div');
            indicator.id = 'quickcal-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4285f4;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 12px;
            `;
            
            // Create circular progress bar
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                width: 20px;
                height: 20px;
                position: relative;
            `;
            
            const progressSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            progressSvg.style.cssText = `
                width: 20px;
                height: 20px;
                transform: rotate(-90deg);
            `;
            progressSvg.setAttribute('viewBox', '0 0 20 20');
            
            // Background circle
            const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            backgroundCircle.setAttribute('cx', '10');
            backgroundCircle.setAttribute('cy', '10');
            backgroundCircle.setAttribute('r', '8');
            backgroundCircle.setAttribute('fill', 'none');
            backgroundCircle.setAttribute('stroke', 'rgba(255,255,255,0.3)');
            backgroundCircle.setAttribute('stroke-width', '2');
            
            // Progress circle
            const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            progressCircle.setAttribute('cx', '10');
            progressCircle.setAttribute('cy', '10');
            progressCircle.setAttribute('r', '8');
            progressCircle.setAttribute('fill', 'none');
            progressCircle.setAttribute('stroke', 'white');
            progressCircle.setAttribute('stroke-width', '2');
            progressCircle.setAttribute('stroke-linecap', 'round');
            const circumference = 2 * Math.PI * 8;
            progressCircle.setAttribute('stroke-dasharray', circumference);
            progressCircle.setAttribute('stroke-dashoffset', circumference);
            progressCircle.style.transition = 'stroke-dashoffset 7s linear';
            
            progressSvg.appendChild(backgroundCircle);
            progressSvg.appendChild(progressCircle);
            progressContainer.appendChild(progressSvg);
            
            // Text content
            const textContent = document.createElement('span');
            textContent.textContent = '🗓️ QuickCal processing...';
            
            indicator.appendChild(progressContainer);
            indicator.appendChild(textContent);
            document.body.appendChild(indicator);
            
            // Animate in
            setTimeout(() => {
                indicator.style.opacity = '1';
                indicator.style.transform = 'translateY(0)';
                // Start progress animation
                progressCircle.style.strokeDashoffset = '0';
            }, 10);
        }
    });
    
    console.log('QuickCal: Started processing selection');

    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fullDate = today.toLocaleDateString('en-US', options);
    const dateTimeFormat = new Intl.DateTimeFormat().resolvedOptions();
    const timezone = dateTimeFormat.timeZone;

    const currentURL = activeTab.url;
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
        // Calculate processing time
        const processingEndTime = Date.now();
        const processingTimeSeconds = ((processingEndTime - processingStartTime) / 1000).toFixed(2);
        
        if (error) {
            console.error('Lambda error:', error);
            
            // Update indicator to show error
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: (processingTime) => {
                    const indicator = document.getElementById('quickcal-indicator');
                    if (indicator) {
                        indicator.style.background = '#d93025';
                        
                        // Update text content
                        const textSpan = indicator.querySelector('span');
                        if (textSpan) {
                            textSpan.textContent = '❌ QuickCal failed';
                        }
                        
                        // Hide progress bar
                        const progressContainer = indicator.querySelector('div');
                        if (progressContainer) {
                            progressContainer.style.display = 'none';
                        }
                        
                        // Remove after 3 seconds
                        setTimeout(() => {
                            indicator.style.opacity = '0';
                            indicator.style.transform = 'translateY(-10px)';
                            setTimeout(() => {
                                if (indicator.parentNode) {
                                    indicator.parentNode.removeChild(indicator);
                                }
                            }, 300);
                        }, 3000);
                    }
                },
                args: [processingTimeSeconds]
            });
            
            return;
        }

        // Update indicator to show success
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (processingTime) => {
                const indicator = document.getElementById('quickcal-indicator');
                if (indicator) {
                    indicator.style.background = '#137333';
                    
                    // Update text content
                    const textSpan = indicator.querySelector('span');
                    if (textSpan) {
                        textSpan.textContent = `✅ Event processed in ${processingTime}s`;
                    }
                    
                    // Replace progress bar with checkmark
                    const progressContainer = indicator.querySelector('div');
                    if (progressContainer) {
                        progressContainer.innerHTML = `
                            <svg width="20" height="20" viewBox="0 0 20 20" style="fill: white;">
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                            </svg>
                        `;
                    }
                    
                    // Remove after 2 seconds
                    setTimeout(() => {
                        indicator.style.opacity = '0';
                        indicator.style.transform = 'translateY(-10px)';
                        setTimeout(() => {
                            if (indicator.parentNode) {
                                indicator.parentNode.removeChild(indicator);
                            }
                        }, 300);
                    }, 2000);
                }
            },
            args: [processingTimeSeconds]
        });
        
        console.log(`QuickCal: Successfully processed in ${processingTimeSeconds} seconds`);

        // Process the response from Lambda
        let eventData = response;
        eventData['title'] ??= "PLACEHOLDER TITLE";
        
        // Enhance description with QuickCal attribution and processing time
        let originalDescription = eventData['description'] || selectedText;
        eventData['description'] = `${originalDescription}  Added by QuickCal in ${processingTimeSeconds} seconds.`;
        
        eventData['location'] ??= "";
        
        chrome.storage.sync.get("calendar_preference", async ({ calendar_preference }) => {
            let format = calendar_preference ?? "google_calendar";
            if (format === "google_calendar") {
                // Google Calendar expects timestamps in a specific format
                // The timestamps from Lambda are in UTC, but Google Calendar might interpret them as local time
                // Let's add 'Z' suffix to explicitly indicate UTC, or convert back to local time
                
                // Option 1: Add Z suffix to indicate UTC
                let startTime = eventData['timestamp_start'] + 'Z';
                let endTime = eventData['timestamp_end'] + 'Z';
                let link = `https://www.google.com/calendar/render?action=TEMPLATE&text=${eventData['title']}&dates=${startTime}/${endTime}&details=${eventData['description']}&location=${eventData['location']}`
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

  