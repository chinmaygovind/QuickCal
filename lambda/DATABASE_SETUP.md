# Database Setup Instructions

## 1. Create DynamoDB Table

### Using AWS CLI:
```bash
aws dynamodb create-table \
    --cli-input-json file://create-dynamodb-table.json \
    --region us-east-1
```

### Using AWS Console:
1. Go to DynamoDB Console
2. Click "Create table"
3. Table name: `quickcal-requests`
4. Partition key: `requestId` (String)
5. Click "Create table"
6. After creation, go to "Indexes" tab
7. Create Global Secondary Index:
   - Index name: `UserEmailIndex`
   - Partition key: `userEmail` (String)
   - Sort key: `timestamp` (String)

## 2. Update Lambda Function

### Environment Variables:
Add these to your Lambda function:
- `REQUESTS_TABLE` = `quickcal-requests`
- `AWS_REGION` = `us-east-1` (or your region)
- `GEMINI_API_KEY` = (your existing Gemini API key)

### IAM Permissions:
Your Lambda execution role needs these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:*:table/quickcal-requests",
                "arn:aws:dynamodb:us-east-1:*:table/quickcal-requests/index/*"
            ]
        }
    ]
}
```

### Lambda Dependencies:
The function now uses AWS SDK v3. Make sure to deploy with:
```bash
# Package the function with dependencies
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
zip -r lambda-function.zip . -x "node_modules/.bin/*"
```

## 3. Data Structure

Each request will store:
- `requestId` (Primary Key)
- `timestamp`
- `userEmail`
- `sessionId`
- `selectedText` and metadata
- `sourceUrl`, `timezone`
- `sourceIP`, `userAgent`
- `status` (processing/success/error)
- `processingTimeMs`
- `resultTitle`, `resultLocation`, etc.
- `errorMessage` (if failed)

## 4. Query Examples

### Get all requests for a user:
```bash
aws dynamodb query \
    --table-name quickcal-requests \
    --index-name UserEmailIndex \
    --key-condition-expression "userEmail = :email" \
    --expression-attribute-values '{":email":{"S":"user@example.com"}}'
```

### Get usage statistics:
```bash
aws dynamodb scan \
    --table-name quickcal-requests \
    --filter-expression "attribute_exists(#status)" \
    --expression-attribute-names '{"#status":"status"}' \
    --select COUNT
```

## 5. Privacy Compliance

⚠️ **Important Legal Requirements:**

1. **Update Privacy Policy** - Disclose email collection
2. **User Consent** - Add opt-in mechanism
3. **Data Retention** - Set deletion policy
4. **Access Rights** - Allow users to view/delete their data
5. **Chrome Web Store** - Update extension description

## 6. Chrome Extension Updates

The extension now:
- Requests `identity` and `identity.email` permissions
- Sends user email with each request
- Generates session IDs for tracking
- **Requires user to be signed into Chrome**

Users will see a permission prompt when installing/updating.
