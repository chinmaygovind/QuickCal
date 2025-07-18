document.getElementById("submitKey").addEventListener("click", async () => {
    const apiKey = document.getElementById("apiKey").value.trim();
    const statusMessage = document.getElementById("statusMessage");
  
    if (!apiKey) {
      statusMessage.textContent = "Please enter an API key.";
      return;
    }
    // Show checking message
    statusMessage.textContent = 'Checking API Key...';
  
    try {
       validateApiKey(apiKey);
    } catch (error) {
      statusMessage.textContent = "Error validating API key. Try again.";
      console.error(error);
    }
  });
  
  // Function to validate the API key
function validateApiKey(apiKey) {
    let request_contents = {
        "contents": [{
            "parts":[{"text": "ping"}]
        }]
    }
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request_contents),
        })
    .then((response) => {
        console.log(response);
        console.log(`Response OK: ${response.ok}`)
        statusMessage.textContent = `Response OK: ${response.ok}`;
        if (response.ok) {
            statusMessage.style.color = "green";
            statusMessage.textContent = `API Key is valid! Enjoy using QuickCal`;
            setTimeout(() => {
                chrome.storage.sync.set({ apiKey }, () => {
                    statusMessage.style.color = "green";
                    statusMessage.textContent = "API Key saved successfully! Reloading...";
                    // Confirm the key is set visually
                    chrome.storage.sync.get('apiKey', (result) => {
                        setTimeout(() => {
                            chrome.runtime.reload();
                        }, 1000);
                    });
                });
            }, 1000);
            

        } else {
            statusMessage.textContent = `Invalid API Key. Try again.`;
        }
    })
    .catch((error) => {
        statusMessage.textContent = `Error validating API Key. Try again.`;
        
    });
  }

