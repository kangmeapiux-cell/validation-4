# SPEC.md

## 1. TECHNOLOGY STACK

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18.2.0 |
| Frontend Build Tool | Vite | 5.2.0 |
| Frontend Language | JavaScript (JSX) | ES2022 |
| HTTP Client | axios | 1.6.8 |
| Backend Runtime | Node.js (AWS Lambda) | 20.x |
| Backend Language | JavaScript (CommonJS) | ES2022 |
| Infrastructure | AWS SAM (CloudFormation) | 1.115.0 |
| Database | AWS DynamoDB | (managed) |
| Static Hosting | AWS S3 | (managed) |
| CDN | AWS CloudFront | (managed) |
| API Layer | AWS API Gateway (HTTP API) | v2 |
| AWS SDK | @aws-sdk/client-dynamodb | 3.x |
| AWS SDK | @aws-sdk/lib-dynamodb | 3.x |
| UUID Generation | uuid | 9.0.0 |
| Local Dev | AWS SAM CLI | 1.115.0 |

---

## 2. DATA CONTRACTS

### DynamoDB Item Schema (stored fields)

```
Table Name: TasksTable
Partition Key: id (String)
```

### JavaScript Object — Task (used in Lambda responses and frontend state)

```js
// Shared shape — used verbatim in Lambda handlers and React components
{
  id: String,           // UUID v4, e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  titulo: String,       // Task title, required, non-empty
  completada: Boolean,  // false on creation, toggled by complete endpoint
  createdAt: String     // ISO 8601 timestamp, e.g. "2024-01-15T10:30:00.000Z"
}
```

### Frontend TypeScript-equivalent Interface (JSDoc for IDE support)

```js
/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} titulo
 * @property {boolean} completada
 * @property {string} createdAt
 */

/**
 * @typedef {Object} CreateTaskInput
 * @property {string} titulo
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {Task|Task[]|null} data
 * @property {string|null} error
 */
```

### DynamoDB Attribute Map (exact attribute names in PutItem/GetItem)

| JS Field | DynamoDB Attribute | DynamoDB Type |
|---|---|---|
| id | id | S |
| titulo | titulo | S |
| completada | completada | BOOL |
| createdAt | createdAt | S |

---

## 3. API ENDPOINTS

All endpoints are served under the API Gateway base URL. CORS is enabled for all origins (`*`) during demo phase.

### POST /tareas — Create Task

**Request Body:**
```json
{
  "titulo": "string (required, non-empty)"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "titulo": "Nueva tarea",
    "completada": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "error": null
}
```

**Response 400 (missing titulo):**
```json
{ "success": false, "data": null, "error": "titulo is required" }
```

---

### GET /tareas — List All Tasks

**Request Body:** none

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "titulo": "Nueva tarea",
      "completada": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "error": null
}
```

---

### PUT /tareas/{id}/completar — Mark Task as Complete

**Path Parameter:** `id` (string, UUID)

**Request Body:** none

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "titulo": "Nueva tarea",
    "completada": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "error": null
}
```

**Response 404:**
```json
{ "success": false, "data": null, "error": "Task not found" }
```

---

### DELETE /tareas/{id} — Delete Task

**Path Parameter:** `id` (string, UUID)

**Request Body:** none

**Response 200:**
```json
{ "success": true, "data": null, "error": null }
```

**Response 404:**
```json
{ "success": false, "data": null, "error": "Task not found" }
```

---

## 4. FILE STRUCTURE

```
validation-4/
├── README.md                          # Project overview, setup, and deploy instructions
├── .gitignore                         # Ignores node_modules, .aws-sam, dist, .env
├── .env.example                       # Template for local environment variables
├── samconfig.toml                     # AWS SAM deploy configuration (stack name, region, S3 bucket)
├── template.yaml                      # AWS SAM CloudFormation template defining all AWS resources
├── run.sh                             # Local dev startup script: starts SAM local API + Vite dev server
│
├── backend/
│   ├── package.json                   # Node.js dependencies for all Lambda functions (shared)
│   ├── package-lock.json              # Locked dependency tree
│   └── src/
│       ├── handlers/
│       │   ├── createTask.js          # Lambda handler: POST /tareas — creates a task in DynamoDB
│       │   ├── listTasks.js           # Lambda handler: GET /tareas — scans all tasks from DynamoDB
│       │   ├── completeTask.js        # Lambda handler: PUT /tareas/{id}/completar — sets completada=true
│       │   └── deleteTask.js          # Lambda handler: DELETE /tareas/{id} — removes task from DynamoDB
│       └── lib/
│           ├── dynamoClient.js        # Instantiates and exports DynamoDB DocumentClient singleton
│           ├── response.js            # Exports buildResponse(statusCode, success, data, error) helper
│           └── constants.js           # Exports TABLE_NAME constant read from process.env.TASKS_TABLE
│
├── frontend/
│   ├── package.json                   # React + Vite + axios dependencies
│   ├── package-lock.json              # Locked dependency tree
│   ├── vite.config.js                 # Vite config with proxy to localhost:3000 for local dev
│   ├── index.html                     # HTML entry point, mounts React app at #root
│   ├── .env.local                     # Local-only env (gitignored): VITE_API_URL=http://localhost:3000
│   └── src/
│       ├── main.jsx                   # React entry point: renders <App /> into #root
│       ├── App.jsx                    # Root component: renders TaskForm and TaskList, holds page layout
│       ├── api/
│       │   └── tasksApi.js            # axios-based API client: exports createTask, listTasks, completeTask, deleteTask
│       ├── hooks/
│       │   └── useTasks.js            # Custom hook: exports { tasks, loading, error, createTask, completeTask, deleteTask, deletingId }
│       ├── components/
│       │   ├── TaskForm.jsx           # Form component: props { onSubmit, loading }
│       │   ├── TaskList.jsx           # List component: props { tasks, onComplete, onDelete, deletingId }
│       │   ├── TaskItem.jsx           # Single task row: props { task, onComplete, onDelete, isDeleting }
│       │   └── ErrorBanner.jsx        # Error display component: props { error }
│       └── styles/
│           └── App.css                # Global styles for layout, task list, form, and buttons
│
└── scripts/
    └── deploy-frontend.sh             # Script: builds frontend, syncs to S3, invalidates CloudFront cache
```

### PORT TABLE

| Service | Listening Port | Path |
|---|---|---|
| SAM Local API (Lambda) | 3000 | backend/ |
| Vite Dev Server | 5173 | frontend/ |

---

## 5. ENVIRONMENT VARIABLES

### Backend (Lambda — set via SAM template.yaml environment variables)

| Variable | Type | Description | Example Value |
|---|---|---|---|
| `TASKS_TABLE` | string | DynamoDB table name for tasks | `validation-4-tasks-dev` |
| `AWS_REGION` | string | AWS region (auto-injected by Lambda runtime) | `us-east-1` |

### Frontend (Vite — prefix `VITE_` required for browser exposure)

| Variable | Type | Description | Example Value |
|---|---|---|---|
| `VITE_API_URL` | string | Base URL of API Gateway (no trailing slash) | `https://abc123.execute-api.us-east-1.amazonaws.com/prod` |

### Local Development (.env.example at root)

```dotenv
# Backend (used by SAM local)
TASKS_TABLE=validation-4-tasks-local

# Frontend (copy to frontend/.env.local)
VITE_API_URL=http://localhost:3000
```

### SAM Deploy (samconfig.toml)

| Variable | Type | Description | Example Value |
|---|---|---|---|
| `stack_name` | string | CloudFormation stack name | `validation-4` |
| `s3_bucket` | string | SAM artifact S3 bucket | `validation-4-sam-artifacts` |
| `region` | string | AWS deployment region | `us-east-1` |
| `confirm_changeset` | bool | Auto-confirm SAM deploy | `false` |

---

## 6. IMPORT CONTRACTS

### Backend — `backend/src/lib/dynamoClient.js`
```js
// Exports:
const { docClient } = require('./dynamoClient');
// docClient: DynamoDBDocumentClient instance (singleton)
```

### Backend — `backend/src/lib/response.js`
```js
// Exports:
const { buildResponse } = require('./response');
// buildResponse(statusCode: number, success: boolean, data: any, error: string|null): Object
// Returns: { statusCode, headers: { 'Content-Type', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({success, data, error}) }
```

### Backend — `backend/src/lib/constants.js`
```js
// Exports:
const { TABLE_NAME } = require('./constants');
// TABLE_NAME: string — value of process.env.TASKS_TABLE
```

### Backend — Handler imports pattern (all four handlers follow this pattern)
```js
const { docClient } = require('../lib/dynamoClient');
const { buildResponse } = require('../lib/response');
const { TABLE_NAME } = require('../lib/constants');
const { v4: uuidv4 } = require('uuid'); // only in createTask.js
```

### Frontend — `frontend/src/api/tasksApi.js`
```js
// Named exports:
import { createTask, listTasks, completeTask, deleteTask } from './api/tasksApi';
// createTask(titulo: string): Promise<Task>
// listTasks(): Promise<Task[]>
// completeTask(id: string): Promise<Task>
// deleteTask(id: string): Promise<void>
```

### Frontend — `frontend/src/hooks/useTasks.js`
```js
// Named export:
import { useTasks } from './hooks/useTasks';
// Returns: { tasks, loading, error, createTask, completeTask, deleteTask, deletingId }
// tasks: Task[]
// loading: boolean
// error: string | null
// createTask: (titulo: string) => Promise<void>
// completeTask: (id: string) => Promise<void>
// deleteTask: (id: string) => Promise<void>
// deletingId: string | null
```

---

## 7. FRONTEND STATE & COMPONENT CONTRACTS

### Custom Hook

```
useTasks() → {
  tasks: Task[],
  loading: boolean,
  error: string | null,
  createTask: (titulo: string) => Promise<void>,
  completeTask: (id: string) => Promise<void>,
  deleteTask: (id: string) => Promise<void>,
  deletingId: string | null
}
```

- `tasks`: array of Task objects, sorted by `createdAt` descending
- `loading`: true while any API call is in-flight (initial fetch or mutation)
- `error`: last error message string, null if no error
- `createTask`: calls `tasksApi.createTask`, then refreshes `tasks`
- `completeTask`: calls `tasksApi.completeTask`, then refreshes `tasks`
- `deleteTask`: sets `deletingId` to the target id, calls `tasksApi.deleteTask`, then refreshes `tasks`, then clears `deletingId`
- `deletingId`: id of the task currently being deleted, null otherwise

### Components

```
App
  props/inputs: none
  consumes: useTasks() — destructures { tasks, loading, error, createTask, completeTask, deleteTask, deletingId }

TaskForm
  props/inputs: {
    onSubmit: (titulo: string) => void,
    loading: boolean
  }
  internal state: titulo (string), controlled input

TaskList
  props/inputs: {
    tasks: Task[],
    onComplete: (id: string) => void,
    onDelete: (id: string) => void,
    deletingId: string | null
  }

TaskItem
  props/inputs: {
    task: Task,
    onComplete: (id: string) => void,
    onDelete: (id: string) => void,
    isDeleting: boolean
  }

ErrorBanner
  props/inputs: {
    error: string | null
  }
  renders: null when error is null, otherwise a <div> with error message
```

**CRITICAL naming rules:**
- The hook property is `createTask` — never `addTask`, `saveTask`, or `submitTask`
- The hook property is `completeTask` — never `toggleTask`, `markComplete`, or `updateTask`
- The hook property is `deleteTask` — never `removeTask` or `destroyTask`
- The prop passed to `TaskList` and `TaskItem` for completion is `onComplete` — never `onToggle`
- The prop passed to `TaskList` and `TaskItem` for deletion is `onDelete` — never `onRemove`

---

## 8. FILE EXTENSION CONVENTION

- **All frontend files use `.jsx` extension** — this is a JavaScript project, not TypeScript
- **All backend files use `.js` extension** (CommonJS, Node.js 20.x Lambda)
- **No `.tsx` or `.ts` files exist anywhere in this project**
- **Entry point:** `frontend/src/main.jsx` — referenced in `frontend/index.html` as `<script type="module" src="/src/main.jsx"></script>`
- **Vite config file:** `frontend/vite.config.js` (`.js`, not `.ts`)
- **All imports in frontend use named imports** from `.jsx` files without explicit extension (Vite resolves them)
- **All imports in backend use `require()`** (CommonJS) — no ES module `import` syntax in Lambda handlers