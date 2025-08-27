// AWS Lambda function for QuickCal (ES Module version)
// This function receives event data from the Chrome extension and processes it using Gemini API

import https from 'https';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(client);

// Your Gemini API key - store this as an environment variable in Lambda
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const REQUESTS_TABLE = process.env.REQUESTS_TABLE || 'quickcal-requests';

export const handler = async (event) => {
    // CORS headers for Chrome extension
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: ''
        };
    }

    // Analytics tracking - Log request details
    const requestId = event.requestContext?.requestId || 'unknown';
    const userAgent = event.headers?.['User-Agent'] || 'unknown';
    const sourceIP = event.requestContext?.identity?.sourceIp || 'unknown';
    const timestamp = new Date().toISOString();
    
    console.log('REQUEST_ANALYTICS', JSON.stringify({
        requestId: requestId,
        timestamp: timestamp,
        sourceIP: sourceIP,
        userAgent: userAgent,
        method: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        headers: {
            origin: event.headers?.origin || 'unknown',
            referer: event.headers?.referer || 'unknown',
            contentType: event.headers?.['content-type'] || 'unknown'
        }
    }));

    try {
        // Debug: Log the entire event
        console.log('Full event object:', JSON.stringify(event, null, 2));
        
        // Parse the request body - handle different event formats
        let requestBody;
        if (event.body) {
            // API Gateway format
            requestBody = JSON.parse(event.body);
        } else if (event.selectedText) {
            // Direct invocation format
            requestBody = event;
        } else {
            console.error('No body or selectedText found in event');
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ 
                    error: 'Invalid request format',
                    receivedEvent: event 
                })
            };
        }
        
        const { selectedText, currentDate, timezone, sourceUrl, userEmail, sessionId } = requestBody;

        // Validate required fields
        if (!selectedText) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: 'Missing selectedText' })
            };
        }

        // Create the prompt for Gemini
        const prompt = `
        I will give you some text that I want you to parse. The text should describe an event.
        Please provide a raw JSON response with the following fields:

        title: the title of the event.
        timestamp_start: a UTC timestamp of when the event starts in the format YYYYMMDDTHHMMSS. If no year is given, default to the upcoming instance of that date.
        timestamp_end: a UTC timestamp of when the event ends in the format YYYYMMDDTHHMMSS. (If not given, default to one hour after start.)
        location: the location of the event. 
        description: a short 2-3 sentence description of the event containing any pertinent information or links.
        
        missing: a list with any of the above fields (title, timestamp_start, timestamp_end, location, description) which are not described in the event.
        
        IMPORTANT: The user is in the ${timezone || 'UTC'} timezone. When parsing times mentioned in the text (like "3 PM", "2:30", "tomorrow at 5", etc.), interpret them as being in the user's timezone (${timezone || 'UTC'}) and then convert them to UTC for the timestamp fields.
        
        Please parse the following text: 
        Today's date is ${currentDate}. User timezone: ${timezone || 'UTC'}. ${selectedText}
        `;

        // Store request in DynamoDB
        const requestRecord = {
            requestId: requestId,
            timestamp: timestamp,
            userEmail: userEmail || 'anonymous',
            sessionId: sessionId || 'unknown',
            selectedText: selectedText,
            selectedTextLength: selectedText ? selectedText.length : 0,
            selectedTextWords: selectedText ? selectedText.split(' ').length : 0,
            currentDate: currentDate,
            timezone: timezone,
            sourceUrl: sourceUrl,
            sourceIP: sourceIP,
            userAgent: userAgent,
            status: 'processing',
            promptSent: prompt
        };

        try {
            await dynamoDb.send(new PutCommand({
                TableName: REQUESTS_TABLE,
                Item: requestRecord
            }));
            console.log('Request stored in database:', requestId);
        } catch (dbError) {
            console.error('Database storage failed:', dbError);
            // Continue processing even if DB storage fails
        }

        // Prepare request to Gemini API
        const geminiRequest = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        // Record time before calling Gemini
        const geminiStartTime = Date.now();

        // Log detailed timezone info for debugging
        console.log('TIMEZONE_DEBUG', JSON.stringify({
            requestId: requestId,
            timezone: timezone,
            currentDate: currentDate,
            selectedText: selectedText,
            promptLength: prompt.length
        }));

        // Call Gemini API
        const geminiResponse = await callGeminiAPI(geminiRequest);
        
        // Record time after calling Gemini
        const geminiEndTime = Date.now();
        const geminiResponseTimeMs = geminiEndTime - geminiStartTime;
        
        // Parse the response
        let responseText = geminiResponse.candidates[0].content.parts[0].text;
        console.log('Raw Gemini response:', responseText);
        
        // Clean up the response (remove markdown code block markers if present)
        const lines = responseText.split('\n');
        if (lines[0].includes('```')) {
            responseText = lines.slice(1, -1).join('\n');
        }
        
        // Parse JSON response
        const eventData = JSON.parse(responseText);
        
        // Update database record with success
        try {
            await dynamoDb.send(new PutCommand({
                TableName: REQUESTS_TABLE,
                Item: {
                    ...requestRecord,
                    status: 'success',
                    processingTimeMs: Date.now() - new Date(timestamp).getTime(),
                    geminiResponseTimeMs: geminiResponseTimeMs,
                    rawGeminiResponse: responseText,
                    cleanedGeminiResponse: responseText,
                    resultTitle: eventData.title,
                    resultLocation: eventData.location,
                    resultStartTime: eventData.timestamp_start,
                    resultEndTime: eventData.timestamp_end,
                    resultMissingFields: eventData.missing || [],
                    geminiResponseLength: responseText.length,
                    completedAt: new Date().toISOString()
                }
            }));
        } catch (dbError) {
            console.error('Database update failed:', dbError);
        }
        
        // Analytics tracking - Log successful processing
        console.log('USAGE_ANALYTICS', JSON.stringify({
            requestId: requestId,
            timestamp: timestamp,
            success: true,
            userEmail: userEmail || 'anonymous',
            selectedTextLength: selectedText.length,
            selectedTextWords: selectedText.split(' ').length,
            timezone: timezone || 'not-provided',
            sourceUrl: sourceUrl || 'not-provided',
            processingTimeMs: Date.now() - new Date(timestamp).getTime(),
            geminiResponseTimeMs: geminiResponseTimeMs,
            eventFields: {
                hasTitle: !!eventData.title,
                hasLocation: !!eventData.location,
                hasStartTime: !!eventData.timestamp_start,
                hasEndTime: !!eventData.timestamp_end,
                missingFields: eventData.missing || []
            },
            geminiResponseLength: responseText.length
        }));
        
        // Return the parsed event data
        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify(eventData)
        };

    } catch (error) {
        console.error('Lambda error:', error);
        
        // Update database record with error
        try {
            await dynamoDb.send(new PutCommand({
                TableName: REQUESTS_TABLE,
                Item: {
                    requestId: requestId,
                    timestamp: timestamp,
                    userEmail: requestBody?.userEmail || 'anonymous',
                    sessionId: requestBody?.sessionId || 'unknown',
                    status: 'error',
                    errorType: error.name || 'UnknownError',
                    errorMessage: error.message || 'Unknown error',
                    processingTimeMs: Date.now() - new Date(timestamp).getTime(),
                    completedAt: new Date().toISOString()
                }
            }));
        } catch (dbError) {
            console.error('Database error update failed:', dbError);
        }
        
        // Analytics tracking - Log errors
        console.log('ERROR_ANALYTICS', JSON.stringify({
            requestId: requestId,
            timestamp: timestamp,
            success: false,
            userEmail: requestBody?.userEmail || 'anonymous',
            errorType: error.name || 'UnknownError',
            errorMessage: error.message || 'Unknown error',
            errorStack: error.stack || 'No stack trace',
            processingTimeMs: Date.now() - new Date(timestamp).getTime()
        }));
        
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

// Helper function to call Gemini API
function callGeminiAPI(requestBody) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(requestBody);
        
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`Gemini API error: ${res.statusCode} - ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse Gemini response: ${parseError.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request error: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}
