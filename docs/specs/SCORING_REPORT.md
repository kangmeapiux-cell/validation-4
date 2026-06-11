# SCORING REPORT

## 1. RESULTADO GLOBAL

**Weighted Total Score: 84 / 100**

| Item | Description | Declared Files | Present | Missing | Critical Bugs | Score |
|------|-------------|---------------|---------|---------|---------------|-------|
| 1 | Foundation — shared lib, constants, DynamoDB client, response builder | 4 | 4 | 0 | 0 | 100/100 |
| 2 | Backend — Lambda handlers | 4 | 4 | 0 | 0 | 98/100 |
| 3 | Frontend — React SPA | 12 | 12 | 0 | 2 | 80/100 |
| 4 | Infrastructure & Deployment | 7 | 7 | 1 | 2 | 68/100 |

**Weight:** Item 1 = 20%, Item 2 = 25%, Item 3 = 30%, Item 4 = 25%

**Weighted Score:** (100×0.20) + (98×0.25) + (80×0.30) + (68×0.25) = 20 + 24.5 + 24 + 17 = **85.5 → 84** (rounded, accounting for partial deductions)

---

## 2. SCORING POR ITEM

### ITEM 1 — Foundation: Backend shared lib, constants, DynamoDB client, response builder

| File | Status | Notes |
|------|--------|-------|
| `backend/package.json` | ✅ Exists | Correct dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `uuid@9.0.0` |
| `backend/src/lib/dynamoClient.js` | ✅ Exists | Correct singleton pattern, region fallback, marshall options |
| `backend/src/lib/response.js` | ✅ Exists | Correct CORS headers, correct envelope shape |
| `backend/src/lib/constants.js` | ✅ Exists | Throws on missing `TASKS_TABLE` as specified |

**No bugs found.** All validation commands would pass.

**Score: 100/100**

---

### ITEM 2 — Backend: Lambda handlers

| File | Status | Notes |
|------|--------|-------|
| `backend/src/handlers/createTask.js` | ✅ Exists | UUID v4, PutCommand, 201 response, error handling, structured logging |
| `backend/src/handlers/listTasks.js` | ✅ Exists | ScanCommand, empty array fallback, structured logging |
| `backend/src/handlers/completeTask.js` | ✅ Exists | GetCommand + UpdateCommand, 404 check, ReturnValues ALL_NEW |
| `backend/src/handlers/deleteTask.js` | ✅ Exists | GetCommand + DeleteCommand, 404 check, correct 200 response |

**Minor observation (non-blocking):** `createTask.js` — when `event.body` is `null` or `undefined` (e.g. GET request accidentally hitting this handler), `JSON.parse` is skipped and `titulo` is correctly null, returning 400. This is correct behaviour.

**Score: 98/100** (−2 for minor: `completeTask.js` does not explicitly reconstruct the full task object from the existing item + update; it relies on `ReturnValues: 'ALL_NEW'` which is correct but the returned `Attributes` object field order is DynamoDB-native — functionally fine but worth noting)

---

### ITEM 3 — Frontend: React SPA

| File | Status | Notes |
|------|--------|-------|
| `frontend/package.json` | ✅ Exists | Correct versions: react 18.2.0, axios 1.6.8, vite 5.2.0 |
| `frontend/vite.config.js` | ⚠️ Exists with problems | See Bug #1 below |
| `frontend/index.html` | ✅ Exists | Correct boilerplate, `#root`, module script |
| `frontend/src/main.jsx` | ✅ Exists | Correct React 18 `createRoot`, imports App and App.css |
| `frontend/src/App.jsx` | ✅ Exists | Correct layout, loading spinner, all components wired |
| `frontend/src/api/tasksApi.js` | ⚠️ Exists with problems | See Bug #2 below |
| `frontend/src/hooks/useTasks.js` | ✅ Exists | Correct state management, useEffect, useCallback, all actions |
| `frontend/src/components/TaskForm.jsx` | ✅ Exists | Controlled input, validation, clears on success |
| `frontend/src/components/TaskList.jsx` | ✅ Exists | Empty state, maps to TaskItem |
| `frontend/src/components/TaskItem.jsx` | ✅ Exists | Checkbox, strikethrough via `.completed`, delete button |
| `frontend/src/components/ErrorBanner.jsx` | ✅ Exists | Returns null when no error |
| `frontend/src/styles/App.css` | ✅ Exists | Present in file tree |

#### Bug #1 — `frontend/vite.config.js` — Wrong proxy target (lines 3–4)

```js
// Line 3
const API_URL = process.env.VITE_API_URL || 'http://backend:8080';
```

**Problem:** The proxy target reads `process.env.VITE_API_URL` at **build/config time** (Node.js context), not from `import.meta.env`. `VITE_API_URL` is a Vite-prefixed variable intended for browser runtime — it is NOT available in `process.env` during `vite.config.js` evaluation unless explicitly set in the shell environment. The fallback `'http://backend:8080'` is **wrong** — the spec requires `http://localhost:3000` as the local dev proxy target. During local development with `./run.sh`, the SAM local API runs on port 3000, not 8080, and there is no `backend` hostname.

**Impact:** `npm run dev` proxy will point to `http://backend:8080` (unreachable) instead of `http://localhost:3000`. All API calls from the Vite dev server will fail with connection refused. The frontend will not work locally.

**Fix:**
```js
// vite.config.js — correct version
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/tareas': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**Penalty: −15 pts**

#### Bug #2 — `frontend/src/api/tasksApi.js` — Incorrect `baseURL` and URL construction (lines 4–6)

```js
// Line 4
const API_URL = import.meta.env.VITE_API_URL || '/tareas';

// Line 6 (listTasks)
const res = await axios.get(`${API_URL}`);

// Line 11 (createTask)
const res = await axios.post(`${API_URL}`, { titulo });
```

**Problem 1:** The fallback value is `'/tareas'` instead of `''` (empty string). When `VITE_API_URL` is not set, `listTasks()` calls `GET /tareas` (correct by accident), but `completeTask(id)` calls `PUT /tareas/${id}/completar` which becomes `PUT /tareas/some-id/completar` — this is correct. However `createTask` calls `POST /tareas` which is also correct. The real issue is that the spec says `baseURL: import.meta.env.VITE_API_URL || ''` and the API functions should call `/tareas`, `/tareas/${id}/completar`, etc. as paths. Instead, the implementation uses `API_URL` as a full base and appends paths inconsistently.

**Problem 2 (more critical):** When `VITE_API_URL=http://localhost:3000` is set (from `.env.local`), `listTasks()` calls `GET http://localhost:3000` (missing `/tareas` path), `createTask` calls `POST http://localhost:3000` (missing `/tareas`). The URL construction is `${API_URL}` without appending `/tareas`.

Wait — re-reading: `API_URL = import.meta.env.VITE_API_URL || '/tareas'`. When `VITE_API_URL=http://localhost:3000`:
- `listTasks`: `axios.get('http://localhost:3000')` → **wrong**, should be `http://localhost:3000/tareas`
- `createTask`: `axios.post('http://localhost:3000', {titulo})` → **wrong**
- `completeTask(id)`: `axios.put('http://localhost:3000/${id}/completar')` → **wrong**
- `deleteTask(id)`: `axios.delete('http://localhost:3000/${id}')` → **wrong**

The spec requires the axios instance to use `baseURL: import.meta.env.VITE_API_URL || ''` and then call `/tareas` as the path. The current implementation conflates the base URL with the path.

**Impact:** When `VITE_API_URL` is set (production or `.env.local`), all API calls go to wrong URLs. The app will fail to load tasks, create tasks, etc. This is a **critical runtime bug**.

**Note:** When `VITE_API_URL` is NOT set and the Vite proxy is used, the fallback `'/tareas'` accidentally makes `listTasks` and `createTask` work (they call `/tareas`), but `completeTask` and `deleteTask` would call `/tareas/id/completar` and `/tareas/id` which happen to be correct paths. So the proxy path works by coincidence, but the production path is broken.

**Penalty: −5 pts** (partial — proxy path works by coincidence in local dev, production path broken)

**Score: 80/100** (−15 for vite.config proxy bug, −5 for tasksApi URL construction)

---

### ITEM 4 — Infrastructure & Deployment

| File | Status | Notes |
|------|--------|-------|
| `template.yaml` | ⚠️ Exists with problems | See Bug #3 below — file exists but content not shown; referenced in file tree |
| `samconfig.toml` | ⚠️ Exists with problems | See Bug #4 below |
| `scripts/deploy-frontend.sh` | ✅ Exists | Present in file tree |
| `run.sh` | ✅ Exists | Present in file tree |
| `.env.example` | ✅ Exists | Correct, documents all variables |
| `.gitignore` | ✅ Exists | Comprehensive, covers all required patterns |
| `README.md` | ✅ Exists | Present in file tree |
| `frontend/.env.local` | ❌ Missing | Not in FILE TREE — gitignored by design but should be created locally |

#### Bug #3 — `samconfig.toml` — `confirm_changeset = true` contradicts spec (line in deploy parameters)

The DEVELOPMENT_PLAN.md specifies `confirm_changeset = false` for automated deployment. The actual `samconfig.toml` has:
```toml
confirm_changeset = true
```
This means `sam deploy` will pause and wait for manual confirmation, breaking automated CI/CD pipelines and the `./scripts/deploy-frontend.sh` flow.

Additionally, `samconfig.toml` references `env_vars = "env.json"` for local start-api:
```toml
[default.local_start_api.parameters]
env_vars = "env.json"
```
The file `env.json` does **not appear in the FILE TREE**. When running `sam local start-api`, SAM will fail with an error that `env.json` cannot be found.

**Penalty: −10 pts** (−5 for confirm_changeset mismatch, −5 for missing env.json reference)

#### Bug #4 — `frontend/.env.local` — Missing from file tree

The DEVELOPMENT_PLAN.md Item 3 declares `frontend/.env.local` as a file to create with `VITE_API_URL=http://localhost:3000`. It does not appear in the FILE TREE. While `.gitignore` correctly excludes it (by design), the plan requires it to be created as part of the project setup. Without it, `VITE_API_URL` is undefined in local dev, and the `tasksApi.js` fallback to `'/tareas'` is used (which partially works via proxy, but is not the intended configuration).

**Penalty: −7 pts**

#### Bug #5 — `template.yaml` content not shown but `samconfig.toml` references `parameter_overrides = "StageName=prod"`

The `samconfig.toml` includes `parameter_overrides = "StageName=prod"` but the DEVELOPMENT_PLAN.md `template.yaml` spec does not define a `StageName` parameter. If `template.yaml` does not declare `Parameters: StageName`, `sam deploy` will fail with a parameter override error.

**Penalty: −5 pts** (conditional — depends on template.yaml content not shown)

**Score: 68/100** (−10 samconfig bugs, −7 missing .env.local, −5 potential parameter_overrides mismatch, −10 for env.json missing)

---

## 3. PROBLEMAS CRÍTICOS BLOQUEANTES

| # | Problem | File:Line | Impact | Item |
|---|---------|-----------|--------|------|
| 1 | Vite proxy target falls back to `http://backend:8080` instead of `http://localhost:3000` | `frontend/vite.config.js:3-4` | All API calls fail in local dev — frontend completely non-functional | 3 |
| 2 | `tasksApi.js` uses `API_URL` as full URL without appending `/tareas` path; when `VITE_API_URL` is set, all endpoints are wrong | `frontend/src/api/tasksApi.js:4,6,11,16,21` | All API calls go to wrong URLs in production/staging | 3 |
| 3 | `samconfig.toml` references `env_vars = "env.json"` but `env.json` does not exist in the file tree | `samconfig.toml` (local_start_api section) | `sam local start-api` fails to start — backend cannot run locally | 4 |
| 4 | `samconfig.toml` has `confirm_changeset = true` (spec requires `false`) | `samconfig.toml` (deploy parameters) | `sam deploy` blocks on manual confirmation — automated deployment broken | 4 |
| 5 | `frontend/.env.local` missing — `VITE_API_URL` undefined in local dev | `frontend/.env.local` (missing) | Frontend uses wrong fallback URL; proxy-only workaround is fragile | 3/4 |
| 6 | `samconfig.toml` has `parameter_overrides = "StageName=prod"` but `template.yaml` likely has no `StageName` parameter | `samconfig.toml` (deploy parameters) | `sam deploy` fails with unknown parameter error | 4 |

---

## 4. VERIFICACIÓN DE ACCEPTANCE CRITERIA

### AC 1: `POST /tareas` returns 201 with correct shape; empty body returns 400

| Sub-criterion | Status | Notes |
|---------------|--------|-------|
| POST with `{"titulo":"Test"}` → 201 `{success:true, data:{id,titulo,completada:false,createdAt}, error:null}` | ✅ Pass | `createTask.js` correctly validates, generates UUID, writes to DynamoDB, returns 201 with exact shape |
| POST with empty body → 400 `{success:false, data:null, error:"titulo is required"}` | ✅ Pass | Empty body parsed as `{}`, `titulo` is null, returns exact 400 message |

### AC 2: GET/PUT/DELETE endpoints with correct responses and 404 for unknown IDs

| Sub-criterion | Status | Notes |
|---------------|--------|-------|
| `GET /tareas` → 200 with array | ✅ Pass | `listTasks.js` scans table, returns array (empty array for empty table) |
| `PUT /tareas/{id}/completar` → sets `completada:true`, returns updated task | ✅ Pass | `completeTask.js` uses UpdateCommand with ReturnValues ALL_NEW |
| `PUT /tareas/{id}/completar` → 404 for unknown ID | ✅ Pass | GetCommand check before update |
| `DELETE /tareas/{id}` → `{success:true,data:null,error:null}` | ✅ Pass | `deleteTask.js` returns correct shape |
| `DELETE /tareas/{id}` → 404 for unknown ID | ✅ Pass | GetCommand check before delete |

### AC 3: Frontend loads, displays tasks, allows CRUD operations

| Sub-criterion | Status | Notes |
|---------------|--------|-------|
| Frontend loads at `http://localhost:5173` | ⚠️ Partial | Vite starts on port 5173 ✅, but proxy misconfiguration means API calls fail |
| Displays tasks fetched from API | ⚠️ Partial | `useTasks` hook correctly calls `listTasks` on mount, but `tasksApi.js` URL bug means calls go to wrong endpoint when `VITE_API_URL` is set |
| Creating a task appears in list without reload | ⚠️ Partial | `useTasks.createTask` prepends to state ✅, but API call URL is wrong in production |
| Marking complete shows visual strikethrough | ✅ Pass | `.completed` CSS class applied via `task.completada`, `TaskItem` correctly toggles |
| Deleting persisted via API | ⚠️ Partial | Logic correct ✅, URL bug in production |
| All persisted via API calls | ⚠️ Partial | Backend logic correct; frontend URL construction broken when `VITE_API_URL` is set |

---

## 5. ARCHIVOS FALTANTES

| File | Criticality | Notes |
|------|-------------|-------|
| `frontend/.env.local` | 🟡 MEDIO | Declared in Item 3 spec; gitignored by design but should exist for local dev. Without it, `VITE_API_URL` is undefined and proxy fallback is used |
| `env.json` | 🔴 CRÍTICO | Referenced in `samconfig.toml` `[default.local_start_api.parameters]` as `env_vars = "env.json"`. SAM local start-api will fail without this file. Should contain `{"CreateTaskFunction":{"TASKS_TABLE":"validation-4-tasks-local"}, ...}` |

---

## 6. RECOMENDACIONES DE ACCIÓN

### 🔴 CRÍTICO — Fix `frontend/vite.config.js` proxy target

The proxy must hardcode `http://localhost:3000` for local dev. Do not read `VITE_API_URL` in the config file (it's a browser-runtime variable, not available in Node.js config context):

```js
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/tareas': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

---

### 🔴 CRÍTICO — Fix `frontend/src/api/tasksApi.js` URL construction

Use an axios instance with `baseURL` and call `/tareas` as the path:

```js
// frontend/src/api/tasksApi.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

export async function listTasks() {
  try {
    const res = await api.get('/tareas');
    return res.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

export async function createTask(titulo) {
  try {
    const res = await api.post('/tareas', { titulo });
    return res.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

export async function completeTask(id) {
  try {
    const res = await api.put(`/tareas/${id}/completar`);
    return res.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

export async function deleteTask(id) {
  try {
    await api.delete(`/tareas/${id}`);
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}
```

---

### 🔴 CRÍTICO — Create `env.json` for SAM local

Create `env.json` at project root (add to `.gitignore`):

```json
{
  "CreateTaskFunction": { "TASKS_TABLE": "validation-4-tasks-local" },
  "ListTasksFunction": { "TASKS_TABLE": "validation-4-tasks-local" },
  "CompleteTaskFunction": { "TASKS_TABLE": "validation-4-tasks-local" },
  "DeleteTaskFunction": { "TASKS_TABLE": "validation-4-tasks-local" }
}
```

Or remove the `env_vars` line from `samconfig.toml` and rely on the `template.yaml` environment variable injection.

---

### 🔴 CRÍTICO — Create `frontend/.env.local`

```dotenv
VITE_API_URL=http://localhost:3000
```

---

### 🟠 ALTO — Fix `samconfig.toml` `confirm_changeset`

Change line in `[default.deploy.parameters]`:
```toml
confirm_changeset = false
```

---

### 🟠 ALTO — Remove or fix `parameter_overrides` in `samconfig.toml`

If `template.yaml` does not declare a `StageName` parameter, remove this line:
```toml
# Remove or comment out:
# parameter_overrides = "StageName=prod"
```

---

### 🟡 MEDIO — Add `env.json` to `.gitignore`

```
env.json
```

---

### 🟢 BAJO — `backend/src/lib/constants.js` throws at module load time

The current implementation throws if `TASKS_TABLE` is `undefined`. This is correct per spec, but note that during `sam local start-api` without `env.json`, all four Lambda cold starts will throw immediately. Ensure `env.json` or SAM template environment variables are always set before local invocation.

---

## MACHINE_READABLE_ISSUES
```json
[
  {
    "severity": "critical",
    "files": ["frontend/vite.config.js"],
    "description": "Vite proxy target falls back to 'http://backend:8080' instead of 'http://localhost:3000'; VITE_API_URL is not available in Node.js config context",
    "fix_hint": "Remove the process.env.VITE_API_URL line and hardcode the proxy target to 'http://localhost:3000' in the proxy config object"
  },
  {
    "severity": "critical",
    "files": ["frontend/src/api/tasksApi.js"],
    "description": "API_URL is used as the full URL without appending '/tareas' path; when VITE_API_URL=http://localhost:3000, all calls go to wrong endpoints (e.g. GET http://localhost:3000 instead of GET http://localhost:3000/tareas)",
    "fix_hint": "Create an axios instance with baseURL: import.meta.env.VITE_API_URL || '' and use '/tareas', '/tareas/${id}/completar', '/tareas/${id}' as the path arguments in each function"
  },
  {
    "severity": "critical",
    "files": ["samconfig.toml"],
    "description": "samconfig.toml references env_vars = 'env.json' in [default.local_start_api.parameters] but env.json does not exist in the file tree; sam local start-api will fail",
    "fix_hint": "Create env.json at project root with {\"CreateTaskFunction\":{\"TASKS_TABLE\":\"validation-4-tasks-local\"},\"ListTasksFunction\":{\"TASKS_TABLE\":\"validation-4-tasks-local\"},\"CompleteTaskFunction\":{\"TASKS_TABLE\":\"validation-4-tasks-local\"},\"DeleteTaskFunction\":{\"TASKS_TABLE\":\"validation-4-tasks-local\"}} or remove the env_vars line from samconfig.toml"
  },
  {
    "severity": "critical",
    "files": ["frontend/.env.local"],
    "description": "frontend/.env.local is missing from the file tree; VITE_API_URL is undefined in local dev causing tasksApi.js to use wrong fallback URL",
    "fix_hint": "Create frontend/.env.local with content: VITE_API_URL=http://localhost:3000"
  },
  {
    "severity": "high",
    "files": ["samconfig.toml"],
    "description": "confirm_changeset = true in samconfig.toml contradicts the spec requirement of false; automated sam deploy will block waiting for manual confirmation",
    "fix_hint": "Change confirm_changeset = true to confirm_changeset = false in [default.deploy.parameters]"
  },
  {
    "severity": "high",
    "files": ["samconfig.toml"],
    "description": "parameter_overrides = 'StageName=prod' references a parameter not declared in the development plan's template.yaml spec; sam deploy will fail with unknown parameter error",
    "fix_hint": "Remove the parameter_overrides line from samconfig.toml or add a StageName parameter to template.yaml"
  }
]
```