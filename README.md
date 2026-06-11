# validation-4 — Serverless To-Do Demo

A minimal serverless To-Do application built with React + AWS Lambda + API Gateway + DynamoDB, deployed via AWS SAM. This project validates the end-to-end serverless architecture before a larger development effort.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────────┐
│                    CloudFront CDN                                │
│              (S3 origin — React SPA)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API calls (VITE_API_URL)
┌─────────────────────────▼───────────────────────────────────────┐
│                  API Gateway (REST API)                          │
│  GET /tareas  POST /tareas  PUT /tareas/{id}/completar           │
│  DELETE /tareas/{id}                                            │
└──────┬──────────┬──────────────┬──────────────┬─────────────────┘
       │          │              │              │
┌──────▼──┐ ┌────▼────┐ ┌───────▼──┐ ┌────────▼──┐
│listTasks│ │createTask│ │completeTask│ │deleteTask │
│ Lambda  │ │ Lambda  │ │  Lambda   │ │  Lambda   │
└──────┬──┘ └────┬────┘ └───────┬──┘ └────────┬──┘
       └─────────┴──────────────┴─────────────┘
                          │
              ┌───────────▼───────────┐
              │   DynamoDB (TasksTable)│
              │   PK: id (String)      │
              └───────────────────────┘
```

## Prerequisites

- [Node.js 20.x](https://nodejs.org/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Docker](https://www.docker.com/) (required for SAM local)
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- An AWS account with permissions for Lambda, API Gateway, DynamoDB, S3, CloudFront, IAM

## Quick Start — Local Development

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd validation-4

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
# Copy example env file
cp .env.example .env

# Create frontend local env
echo 'VITE_API_URL=http://localhost:3000' > frontend/.env.local
```

### 3. Start local development servers

```bash
# Make run.sh executable (first time only)
chmod +x run.sh

# Start both SAM local API (port 3000) and Vite dev server (port 5173)
./run.sh
```

This will:
- Build the SAM application
- Start SAM local API at `http://localhost:3000`
- Start Vite dev server at `http://localhost:5173`

> **Note:** SAM local requires Docker to be running. The first invocation may be slow as Docker images are pulled.

### 4. Seed mock data (optional)

In a separate terminal, after the local API is running:

```bash
# Seed mock tasks into local DynamoDB
TASKS_TABLE=validation-4-tasks-local \
AWS_REGION=us-east-1 \
node scripts/seed-data.js
```

### 5. Test the API

```bash
# List all tasks
curl http://localhost:3000/tareas

# Create a task
curl -X POST http://localhost:3000/tareas \
  -H 'Content-Type: application/json' \
  -d '{"titulo": "Mi primera tarea"}'

# Mark task as complete (replace <id> with actual UUID)
curl -X PUT http://localhost:3000/tareas/<id>/completar

# Delete a task
curl -X DELETE http://localhost:3000/tareas/<id>
```

## Deployment to AWS

### 1. Deploy backend (SAM)

```bash
# Build and deploy
sam build --cached --parallel
sam deploy --guided
```

During guided deploy, you will be prompted for:
- **Stack Name**: `validation-4` (default)
- **AWS Region**: `us-east-1` (or your preferred region)
- **Stage Name**: `prod` (default)
- **Confirm changeset**: `Y`

After deployment, note the `ApiBaseUrl` output value.

### 2. Seed production data (optional)

```bash
# Get the table name from CloudFormation outputs
TABLE=$(aws cloudformation describe-stacks \
  --stack-name validation-4 \
  --query "Stacks[0].Outputs[?OutputKey=='TasksTableName'].OutputValue" \
  --output text)

TASKS_TABLE=$TABLE AWS_REGION=us-east-1 node scripts/seed-data.js
```

### 3. Deploy frontend

```bash
# Make deploy script executable (first time only)
chmod +x scripts/deploy-frontend.sh

# Build and deploy frontend to S3 + CloudFront
./scripts/deploy-frontend.sh prod
```

The script will:
1. Fetch API URL and S3/CloudFront details from CloudFormation outputs
2. Build the React app with the correct `VITE_API_URL`
3. Sync build artifacts to S3
4. Invalidate CloudFront cache
5. Print the CloudFront URL

## Project Structure

```
validation-4/
├── README.md                    # This file
├── .gitignore                   # Git ignore rules
├── .env.example                 # Environment variable template
├── samconfig.toml               # SAM deploy configuration
├── template.yaml                # SAM CloudFormation template
├── run.sh                       # Local dev startup script
├── env.json                     # SAM local env vars (gitignored)
├── backend/
│   ├── package.json
│   └── src/
│       ├── handlers/
│       │   ├── createTask.js    # POST /tareas
│       │   ├── listTasks.js     # GET /tareas
│       │   ├── completeTask.js  # PUT /tareas/{id}/completar
│       │   └── deleteTask.js    # DELETE /tareas/{id}
│       └── lib/
│           ├── dynamoClient.js  # DynamoDB DocumentClient singleton
│           ├── response.js      # Standardized response builder
│           └── constants.js     # Environment variable constants
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/tasksApi.js
│       ├── hooks/useTasks.js
│       ├── components/
│       │   ├── TaskForm.jsx
│       │   ├── TaskList.jsx
│       │   ├── TaskItem.jsx
│       │   └── ErrorBanner.jsx
│       └── styles/App.css
└── scripts/
    ├── deploy-frontend.sh       # Frontend build + S3 sync + CF invalidation
    └── seed-data.js             # Populate DynamoDB with mock tasks
```

## API Reference

| Method | Path | Description | Status Codes |
|--------|------|-------------|-------------|
| `GET` | `/tareas` | List all tasks | 200 |
| `POST` | `/tareas` | Create a task | 201, 400 |
| `PUT` | `/tareas/{id}/completar` | Mark task complete | 200, 404 |
| `DELETE` | `/tareas/{id}` | Delete a task | 200, 404 |

### Task Schema

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "titulo": "Comprar leche",
  "completada": false,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Environment Variables

### Backend (Lambda)

| Variable | Description | Example |
|----------|-------------|--------|
| `TASKS_TABLE` | DynamoDB table name | `validation-4-tasks-prod` |
| `AWS_REGION` | AWS region (auto-injected) | `us-east-1` |

### Frontend (Vite)

| Variable | Description | Example |
|----------|-------------|--------|
| `VITE_API_URL` | API Gateway base URL | `https://abc123.execute-api.us-east-1.amazonaws.com/prod` |

## Cost Estimate

This demo runs almost entirely within the AWS Free Tier:

- **Lambda**: 1M free requests/month + 400,000 GB-seconds compute
- **API Gateway**: 1M REST API calls/month (first 12 months)
- **DynamoDB**: 25 GB storage + 25 WCU + 25 RCU (always free)
- **S3**: 5 GB storage + 20,000 GET requests (first 12 months)
- **CloudFront**: 1 TB data transfer + 10M requests/month (first 12 months)

Expected cost for demo usage: **$0.00/month**

## Troubleshooting

### SAM local fails to start
- Ensure Docker is running: `docker info`
- Check port 3000 is not in use: `lsof -i :3000`
- Rebuild: `sam build --cached --parallel`

### CORS errors in browser
- Verify `VITE_API_URL` in `frontend/.env.local` matches the running API
- For local dev, the Vite proxy in `vite.config.js` handles `/tareas` routes

### DynamoDB connection errors (local)
- SAM local uses in-memory Lambda containers; DynamoDB calls go to AWS by default
- For fully local DynamoDB, use [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) and set `AWS_ENDPOINT_URL=http://localhost:8000`

### CloudFormation deploy fails
- Ensure AWS credentials are configured: `aws sts get-caller-identity`
- Check IAM permissions for Lambda, API Gateway, DynamoDB, S3, CloudFront, IAM
- Review CloudFormation events: `aws cloudformation describe-stack-events --stack-name validation-4`

## License

MIT — for demo purposes only. No authentication or security hardening applied.
