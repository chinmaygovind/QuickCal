# AWS Lambda Deployment Guide for QuickCal

This guide explains how to deploy the Lambda function that will handle Gemini API calls for the QuickCal Chrome extension.

## Language Options

You can choose between two implementations:
- **Node.js** (`lambda-function.js`) - Lighter, faster cold starts
- **Python** (`lambda-function.py`) - More familiar for Python developers

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI configured
3. Gemini API key from Google AI Studio

## Option 1: Deploy via AWS Console

### Step 1: Create Lambda Function
1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `quickcal-event-processor`
5. Runtime: 
   - For Node.js: **Node.js 18.x or later**
   - For Python: **Python 3.9 or later**
6. Create function

### Step 2: Upload Code

#### For Node.js:
1. Copy the contents of `lambda-function.js`
2. Paste into the Lambda function editor
3. Click "Deploy"

#### For Python:
1. Copy the contents of `lambda-function.py`
2. Paste into the Lambda function editor
3. Make sure the handler is set to `lambda_function.lambda_handler`
4. Click "Deploy"

### Step 3: Set Environment Variables
1. Go to "Configuration" tab
2. Click "Environment variables"
3. Add key: `GEMINI_API_KEY`, value: your Gemini API key

### Step 4: Create API Gateway
1. Go to "Function overview"
2. Click "Add trigger"
3. Select "API Gateway"
4. Create new API: REST API
5. Security: Open (or implement your own authentication)
6. Click "Add"

### Step 5: Update Extension
1. Copy the API Gateway endpoint URL
2. Update `LAMBDA_ENDPOINT` in `quickcal.js` with your URL

## Option 2: Deploy via AWS CLI

### Step 1: Create deployment package

#### For Node.js:
```bash
# Create a directory for the Lambda function
mkdir quickcal-lambda
cd quickcal-lambda

# Copy the Lambda function code
cp ../lambda-function.js index.js

# Create deployment package
zip -r quickcal-lambda.zip index.js
```

#### For Python:
```bash
# Create a directory for the Lambda function
mkdir quickcal-lambda-python
cd quickcal-lambda-python

# Copy the Lambda function code
cp ../lambda-function.py lambda_function.py

# Create deployment package
zip -r quickcal-lambda-python.zip lambda_function.py
```

### Step 2: Create Lambda function

#### For Node.js:
```bash
aws lambda create-function \
  --function-name quickcal-event-processor \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR-ACCOUNT-ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://quickcal-lambda.zip
```

#### For Python:
```bash
aws lambda create-function \
  --function-name quickcal-event-processor \
  --runtime python3.9 \
  --role arn:aws:iam::YOUR-ACCOUNT-ID:role/lambda-execution-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://quickcal-lambda-python.zip
```

### Step 3: Set environment variable
```bash
aws lambda update-function-configuration \
  --function-name quickcal-event-processor \
  --environment Variables='{GEMINI_API_KEY=your-actual-api-key-here}'
```

### Step 4: Create API Gateway
```bash
# Create API
aws apigateway create-rest-api --name quickcal-api

# Create resource and method (see AWS documentation for detailed steps)
```

## Option 3: Deploy via Serverless Framework

### Step 1: Install Serverless
```bash
npm install -g serverless
```

### Step 2: Create serverless.yml

#### For Node.js:
```yaml
service: quickcal-lambda

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    GEMINI_API_KEY: ${env:GEMINI_API_KEY}

functions:
  processEvent:
    handler: lambda-function.handler
    events:
      - http:
          path: process-event
          method: post
          cors: true
```

#### For Python:
```yaml
service: quickcal-lambda-python

provider:
  name: aws
  runtime: python3.9
  region: us-east-1
  environment:
    GEMINI_API_KEY: ${env:GEMINI_API_KEY}

functions:
  processEvent:
    handler: lambda_function.lambda_handler
    events:
      - http:
          path: process-event
          method: post
          cors: true
```

### Step 3: Deploy
```bash
# Set environment variable
export GEMINI_API_KEY=your-actual-api-key-here

# Deploy
serverless deploy
```

## Python Dependencies

The Python version uses `urllib3` which is included in the AWS Lambda runtime by default. If you need additional dependencies, create a `requirements.txt` file:

```txt
urllib3>=1.26.0
```

Then package dependencies:
```bash
pip install -r requirements.txt -t .
zip -r lambda-deployment-package.zip .
```

## Performance Considerations

- **Node.js**: Faster cold starts, smaller memory footprint
- **Python**: Slightly slower cold starts but more familiar syntax for Python developers
- Both versions have similar runtime performance for this use case

## Security Considerations

1. **API Key Protection**: Store the Gemini API key as an environment variable, not in code
2. **Rate Limiting**: Consider implementing rate limiting to prevent abuse
3. **Authentication**: For production, implement proper authentication
4. **CORS**: The function includes CORS headers for Chrome extension compatibility

## Testing

Test your Lambda function with a sample request:

```json
{
  "selectedText": "Team meeting tomorrow at 2 PM in Conference Room A",
  "currentDate": "Friday, August 24, 2025",
  "timezone": "America/New_York",
  "sourceUrl": "https://example.com"
}
```

## Cost Estimation

- Lambda: ~$0.0000002 per request
- API Gateway: ~$0.0000035 per request
- Very minimal costs for typical usage

## Next Steps

1. Deploy the Lambda function using one of the methods above
2. Update the `LAMBDA_ENDPOINT` constant in `quickcal.js`
3. Test the Chrome extension
4. Consider implementing usage analytics and monitoring
