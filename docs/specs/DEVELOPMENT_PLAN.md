# DEVELOPMENT PLAN: validation-4

## 1. ARCHITECTURE OVERVIEW

**Stack:** React 18 (Vite) + AWS Lambda (Node.js 20) + API Gateway HTTP API + DynamoDB + S3 + CloudFront, orchestrated via AWS SAM.

**Components:**
- **Frontend SPA:** React app built with Vite, served from S3 via CloudFront. Components: `TaskForm`, `TaskList`, `TaskItem`, `ErrorBanner`. State managed via `useTasks` hook. API calls via `tasksApi.js` (axios).
- **Backend Lambdas (4):** `createTask`, `listTasks`, `completeTask`, `deleteTask` — each a standalone CommonJS handler using `@aws-sdk/lib-dynamodb`.
- **Shared Lambda Lib:** `dynamoClient.js`, `response.js`, `constants.js` — imported by all handlers.
- **DynamoDB Table:** `TasksTable`, partition key `id` (String), attributes: `titulo`, `completada`, `createdAt`.
- **Infrastructure:** `template.yaml` (SAM) defines all AWS resources. `samconfig.toml` for deploy config. `deploy-frontend.sh` for S3 sync + CloudFront invalidation.

**Folder structure follows §4 exactly** — no additional files outside the declared spec.

---

## 2. ACCEPTANCE CRITERIA

1. `POST /tareas` with `{"titulo":"Test"}` returns HTTP 201 with `{success:true, data:{id,titulo,completada:false,createdAt}, error:null}`; `POST /tareas` with empty body returns HTTP 400 `{success:false, data:null, error:"titulo is required"}`.
2. `GET /tareas` returns HTTP 200 with array of all tasks; `PUT /tareas/{id}/completar` sets `completada:true` and returns updated task; `DELETE /tareas/{id}` returns `{success:true,data:null,error:null}`; both return 404 for unknown IDs.
3. Frontend loads at `http://localhost:5173`, displays tasks fetched from API, allows creating a task (appears in list without reload), marking complete (visual strikethrough), and deleting — all persisted via API calls.

---

## TEAM SCOPE

- **role-tl** (technical_lead): Item 1 — Foundation
- **role-be** (backend_developer): Item 2 — Lambda Handlers
- **role-fe** (frontend_developer): Item 3 — Frontend SPA
- **role-devops** (devops_support): Item 4 — Infrastructure & Deployment

---

## 3. EXECUTABLE ITEMS

---

### ITEM 1: Foundation — Backend shared lib, constants, DynamoDB client, response builder

**Goal:** Create ALL shared backend library code that the four Lambda handlers will import: `dynamoClient.js` (DynamoDB DocumentClient singleton), `response.js` (`buildResponse` helper with CORS headers), `constants.js` (`TABLE_NAME` from env), and `backend/package.json` with all Lambda dependencies (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `uuid`).

**Files to create:**
- `backend/package.json` (create) — Node.js 20 CommonJS package; dependencies: `@aws-sdk/client-dynamodb@^3.0.0`, `@aws-sdk/lib-dynamodb@^3.0.0`, `uuid@9.0.0`; no devDependencies needed for Lambda
- `backend/src/lib/dynamoClient.js` (create) — instantiates `DynamoDBClient` and wraps with `DynamoDBDocumentClient`; exports `{ docClient }` as singleton; reads region from `AWS_REGION` env (defaults to `us-east-1` for local SAM compatibility)
- `backend/src/lib/response.js` (create) — exports `buildResponse(statusCode, success, data, error)` returning `{ statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' }, body: JSON.stringify({ success, data, error }) }`
- `backend/src/lib/constants.js` (create) — exports `TABLE_NAME = process.env.TASKS_TABLE`; throws `Error('TASKS_TABLE environment variable is not set')` on startup if undefined

**Dependencies:** None

**Validation:** `cd backend && npm install` completes without errors; `node -e "const {docClient}=require('./src/lib/dynamoClient'); console.log(docClient ? 'OK' : 'FAIL')"` prints `OK`; `node -e "const {buildResponse}=require('./src/lib/response'); const r=buildResponse(200,true,[],null); console.log(JSON.parse(r.body).success)"` prints `true`.

**Role:** role-tl (technical_lead)

---

### ITEM 2: Backend — Lambda handlers: createTask, listTasks, completeTask, deleteTask

**Goal:** Implement all four Lambda handler functions as CommonJS modules. `createTask.js`: validates `titulo`, generates UUID v4, writes item to DynamoDB with `completada:false` and ISO timestamp, returns 201. `listTasks.js`: scans full table, returns 200 with array. `completeTask.js`: gets item by `id`, returns 404 if missing, updates `completada:true` via `UpdateCommand`, returns 200 with updated task. `deleteTask.js`: gets item by `id`, returns 404 if missing, deletes via `DeleteCommand`, returns 200 `{success:true,data:null,error:null}`. All handlers use structured console.log (JSON) for logging and never expose stack traces in responses.

**Files to create:**
- `backend/src/handlers/createTask.js` (create) — `exports.handler = async (event) => {...}`; parses `JSON.parse(event.body)`; validates `titulo` non-empty string (400 if missing/empty); generates `id = uuidv4()`, `createdAt = new Date().toISOString()`, `completada = false`; calls `PutCommand` on `TABLE_NAME`; returns `buildResponse(201, true, {id,titulo,completada,createdAt}, null)`; catches errors and returns `buildResponse(500, false, null, 'Internal server error')`; logs `{level:'INFO', handler:'createTask', taskId:id}` on success
- `backend/src/handlers/listTasks.js` (create) — `exports.handler = async (event) => {...}`; calls `ScanCommand` on `TABLE_NAME`; maps `Items` to task objects; returns `buildResponse(200, true, items, null)`; handles empty table (returns `[]`); catches errors and returns `buildResponse(500, false, null, 'Internal server error')`; logs `{level:'INFO', handler:'listTasks', count:items.length}`
- `backend/src/handlers/completeTask.js` (create) — `exports.handler = async (event) => {...}`; extracts `id` from `event.pathParameters.id`; calls `GetCommand` to check existence; returns `buildResponse(404, false, null, 'Task not found')` if item missing; calls `UpdateCommand` with `SET completada = :val` expression; returns `buildResponse(200, true, updatedTask, null)`; logs `{level:'INFO', handler:'completeTask', taskId:id}`
- `backend/src/handlers/deleteTask.js` (create) — `exports.handler = async (event) => {...}`; extracts `id` from `event.pathParameters.id`; calls `GetCommand` to verify existence; returns `buildResponse(404, false, null, 'Task not found')` if missing; calls `DeleteCommand`; returns `buildResponse(200, true, null, null)`; logs `{level:'INFO', handler:'deleteTask', taskId:id}`

**Dependencies:** Item 1

**Validation:** `cd backend && sam local start-api --port 3000` (requires `template.yaml` from Item 4); alternatively validate imports: `node -e "const h=require('./src/handlers/createTask'); console.log(typeof h.handler)"` prints `function` for all four handlers.

**Role:** role-be (backend_developer)

---

### ITEM 3: Frontend — React SPA (tasksApi, useTasks hook, components, styles)

**Goal:** Implement the complete React frontend: `tasksApi.js` (axios client with `createTask`, `listTasks`, `completeTask`, `deleteTask` functions targeting `VITE_API_URL`), `useTasks.js` hook (manages `tasks`, `loading`, `error`, `deletingId` state; exposes `createTask`, `completeTask`, `deleteTask` actions), and all four components (`TaskForm`, `TaskList`, `TaskItem`, `ErrorBanner`) plus entry points (`main.jsx`, `App.jsx`), Vite config with proxy, and global CSS.

**Files to create:**
- `frontend/package.json` (create) — dependencies: `react@18.2.0`, `react-dom@18.2.0`, `axios@1.6.8`; devDependencies: `vite@5.2.0`, `@vitejs/plugin-react`; scripts: `dev`, `build`, `preview`
- `frontend/vite.config.js` (create) — `import { defineConfig } from 'vite'`; `import react from '@vitejs/plugin-react'`; server proxy: `'/tareas': { target: 'http://localhost:3000', changeOrigin: true }` for local dev; exports `defineConfig({ plugins:[react()], server:{ port:5173, proxy:{...} } })`
- `frontend/index.html` (create) — HTML5 boilerplate; `<div id="root"></div>`; `<script type="module" src="/src/main.jsx"></script>`; title: `validation-4 — To-Do`
- `frontend/src/main.jsx` (create) — `import React from 'react'`; `import ReactDOM from 'react-dom/client'`; `import App from './App'`; `import './styles/App.css'`; `ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`
- `frontend/src/App.jsx` (create) — imports `useTasks` hook, `TaskForm`, `TaskList`, `ErrorBanner`; renders page layout with header `<h1>Lista de Tareas</h1>`, `<ErrorBanner error={error} />`, `<TaskForm onSubmit={createTask} loading={loading} />`, `<TaskList tasks={tasks} onComplete={completeTask} onDelete={deleteTask} deletingId={deletingId} />`; shows loading spinner when `loading && tasks.length === 0`
- `frontend/src/api/tasksApi.js` (create) — creates axios instance with `baseURL: import.meta.env.VITE_API_URL || ''`; exports `createTask(titulo)` → `POST /tareas` returns `response.data.data`; `listTasks()` → `GET /tareas` returns `response.data.data`; `completeTask(id)` → `PUT /tareas/${id}/completar` returns `response.data.data`; `deleteTask(id)` → `DELETE /tareas/${id}` returns void; all functions throw with `error.response?.data?.error || error.message` on failure
- `frontend/src/hooks/useTasks.js` (create) — `export function useTasks()`; state: `tasks` (array), `loading` (bool), `error` (string|null), `deletingId` (string|null); `useEffect` calls `listTasks()` on mount; `createTask(titulo)`: validates non-empty, sets loading, calls API, prepends new task to state, clears error; `completeTask(id)`: calls API, updates task in state array; `deleteTask(id)`: sets `deletingId=id`, calls API, removes from state, clears `deletingId`; all catch blocks set `error` string; returns `{ tasks, loading, error, createTask, completeTask, deleteTask, deletingId }`
- `frontend/src/components/TaskForm.jsx` (create) — props `{ onSubmit, loading }`; controlled input for `titulo`; local `inputError` state for empty-field validation; on submit: validates non-empty, calls `onSubmit(titulo)`, clears input on success; renders `<form>`, `<input>`, `<button disabled={loading}>Agregar</button>`, inline error message
- `frontend/src/components/TaskList.jsx` (create) — props `{ tasks, onComplete, onDelete, deletingId }`; renders `<ul>`; maps tasks to `<TaskItem key={task.id} task={task} onComplete={onComplete} onDelete={onDelete} isDeleting={deletingId === task.id} />`; shows `<p>No hay tareas.</p>` when array is empty
- `frontend/src/components/TaskItem.jsx` (create) — props `{ task, onComplete, onDelete, isDeleting }`; renders task row with checkbox (`checked={task.completada}`, `onChange={() => onComplete(task.id)}`, disabled if already complete), `<span>` with title (CSS class `completed` when `task.completada` for strikethrough), delete `<button>` (disabled when `isDeleting`, shows `Eliminando...` text while deleting)
- `frontend/src/components/ErrorBanner.jsx` (create) — props `{ error }`; returns `null` when `!error`; renders `<div className="error-banner">` with error message string
- `frontend/src/styles/App.css` (create) — global styles: CSS reset basics, centered layout (`max-width:600px`, `margin:0 auto`), form styles (flex row, input grows), task list styles (`list-style:none`, `padding:0`), task item styles (flex row, space-between), `.completed` class (`text-decoration:line-through`, `color:#999`), `.error-banner` (red background, white text, padding), button styles, loading state styles
- `frontend/.env.local` (create) — `VITE_API_URL=http://localhost:3000`

**Dependencies:** Item 1

**Validation:** `cd frontend && npm install && npm run build` completes without errors; `npm run dev` starts at `http://localhost:5173`; browser shows task list UI with form and empty state message.

**Role:** role-fe (frontend_developer)

---

### ITEM 4: Infrastructure & Deployment — SAM template, samconfig, seed script, deploy scripts, README

**Goal:** Create all infrastructure-as-code and deployment artifacts: `template.yaml` (SAM CloudFormation defining DynamoDB table, 4 Lambda functions, API Gateway HTTP API with CORS, S3 bucket, CloudFront distribution, IAM roles with least-privilege), `samconfig.toml` (deploy defaults), `scripts/deploy-frontend.sh` (build + S3 sync + CloudFront invalidation), `run.sh` (local dev startup), `.env.example`, `.gitignore`, `README.md`.

**Files to create:**
- `template.yaml` (create) — SAM template `Transform: AWS::Serverless-2016-10-31`; `Globals.Function`: `Runtime: nodejs20.x`, `Environment.Variables.TASKS_TABLE: !Ref TasksTable`, `Timeout: 30`; **Resources**: `TasksTable` (`AWS::DynamoDB::Table`, `BillingMode: PAY_PER_REQUEST`, `AttributeDefinitions: [{id, S}]`, `KeySchema: [{id, HASH}]`); `TasksApi` (`AWS::Serverless::HttpApi`, CORS `AllowOrigins:['*']`, `AllowMethods:['GET','POST','PUT','DELETE','OPTIONS']`, `AllowHeaders:['Content-Type']`); `CreateTaskFunction` (`AWS::Serverless::Function`, `Handler: src/handlers/createTask.handler`, `CodeUri: backend/`, `Events.CreateTask: {Type:HttpApi, Properties:{Path:/tareas,Method:post,ApiId:!Ref TasksApi}}`); `ListTasksFunction` (GET /tareas); `CompleteTaskFunction` (PUT /tareas/{id}/completar); `DeleteTaskFunction` (DELETE /tareas/{id}); each function has `Policies: [DynamoDBCrudPolicy: {TableName: !Ref TasksTable}]`; `FrontendBucket` (`AWS::S3::Bucket`, `WebsiteConfiguration`, `PublicAccessBlockConfiguration` all false for demo); `FrontendBucketPolicy` (`AWS::S3::BucketPolicy`, allows `s3:GetObject` to `*`); `CloudFrontDistribution` (`AWS::CloudFront::Distribution`, origin = S3 website endpoint, `DefaultRootObject: index.html`, `CustomErrorResponses: [{ErrorCode:404,ResponseCode:200,ResponsePagePath:/index.html}]`); **Outputs**: `ApiUrl` (`!Sub 'https://${TasksApi}.execute-api.${AWS::Region}.amazonaws.com'`), `CloudFrontUrl`, `FrontendBucketName`
- `samconfig.toml` (create) — `[default.deploy.parameters]`: `stack_name = "validation-4"`, `s3_bucket = "validation-4-sam-artifacts"`, `region = "us-east-1"`, `confirm_changeset = false`, `resolve_s3 = true`, `capabilities = "CAPABILITY_IAM"`
- `scripts/deploy-frontend.sh` (create) — bash script: `set -e`; gets `BUCKET_NAME` and `DISTRIBUTION_ID` from `sam list stack-outputs`; runs `cd frontend && npm run build`; runs `aws s3 sync dist/ s3://$BUCKET_NAME --delete`; runs `aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"`; prints `Frontend deployed to CloudFront`
- `run.sh` (create) — bash script: `set -e`; checks `sam` and `node` are installed; starts `sam local start-api --port 3000 --warm-containers EAGER` in background (from project root, `--template template.yaml`); starts `cd frontend && npm run dev` in background; prints `Backend API: http://localhost:3000`; prints `Frontend: http://localhost:5173`; prints `Press Ctrl+C to stop`; traps `SIGINT` to kill both background processes
- `.env.example` (create) — documents all variables: `# Backend (used by SAM local)\nTASKS_TABLE=validation-4-tasks-local\n\n# Frontend (copy to frontend/.env.local)\nVITE_API_URL=http://localhost:3000`
- `.gitignore` (create) — `node_modules/`, `.aws-sam/`, `dist/`, `.env`, `frontend/.env.local`, `*.log`, `samconfig.toml.bak`
- `README.md` (create) — sections: **Prerequisites** (Node 20, AWS SAM CLI 1.115, AWS CLI configured, AWS account); **Local Development** (`git clone`, `cd backend && npm install`, `cd frontend && npm install`, `./run.sh`, open `http://localhost:5173`); **Deploy to AWS** (`sam build`, `sam deploy`, `./scripts/deploy-frontend.sh`, update `VITE_API_URL` in frontend build); **API Endpoints** (table of all 4 endpoints with method, path, description); **Architecture** (brief description of Lambda + DynamoDB + S3 + CloudFront); **Seed Data** (instructions to run seed script)

**Dependencies:** Items 1, 2, 3

**Validation:** `sam validate --template template.yaml` returns `template.yaml is a valid SAM Template`; `./run.sh` starts both servers without errors; `curl http://localhost:3000/tareas` returns `{"success":true,"data":[],"error":null}`; frontend at `http://localhost:5173` loads and displays the task list UI.

**Role:** role-devops (devops_support)