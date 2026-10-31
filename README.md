# 🏛️ Judgely — AI-Powered Online Judge & Learning Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-12100E?style=for-the-badge&logo=chainlink&logoColor=white)](https://www.langchain.com/)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![SQLite/PostgreSQL](https://img.shields.io/badge/Database-SQLAlchemy-blue?style=for-the-badge)](https://www.sqlalchemy.org/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

**Judgely (MOJ)** is a full-featured competitive programming platform upgraded with a complete **LangChain & Google Gemini AI Engine**. Beyond standard automated code execution and sandboxing, Judgely provides an intelligent, interactive Socratic AI tutor, automated complexity analysis, structured problem generation, persistent profile chat history, and an expandable AI code inspector.

---

## ✨ Key Features & AI Suite

### 🤖 1. Socratic AI Tutor & Interactive Debugger
- **Automated Bug Diagnosis**: Automatically diagnoses compilation errors (`CE`), runtime errors (`RE`), wrong answers (`WA`), or time limit exceeded (`TLE`) errors upon submission.
- **Progressive Hint Delivery**: Reveals multi-step hints incrementally without giving away full solutions immediately.
- **Conversational Chat**: Interactive follow-up Q&A directly on any problem submission.

### ⚡ 2. AI Complexity & Optimization Analyzer
- **Time & Space Complexity**: Computes $O(N \log N)$ time and $O(N)$ space bounds directly from submitted C++ code.
- **Operation Breakdown**: Itemizes loop costs, recursion depth, and data structure overhead.
- **Performance Rating**: Displays performance badges (*Optimal*, *Moderate*, *Suboptimal*) with actionable optimization tips.

### 🪄 3. AI Problem & Testcase Generator
- **LLM Structured Output**: Generates contest-ready programming problems with markdown problem statements, input/output specifications, sample testcases, and a reference C++ solution.
- **Automated Solution Validation**: Includes a live testcase validator that compiles the reference solution and checks generated test cases against actual execution output before saving to the database.

### 💬 4. Persistent Floating AI Assistant & Chat History
- **Floating AI Widget**: Persistent chat bubble available across all pages for syntax queries, algorithm advice, and problem help.
- **Expanded AI Code Inspector**: Includes a **Maximize Toggle (`⛶`)** expanding the chatbot to **820px × 80vh** and a dedicated **`🔍 Expand Code`** popup modal (**920px × 85vh**) with line numbers, copy code, and direct load-to-editor capabilities.
- **Profile Chat History & Review**: Automatically saves all General AI and Socratic Tutor conversations to SQLite/PostgreSQL. Past chats can be reviewed from the Profile section without re-generating new LLM responses.

### 🔒 5. Safe Sandboxing & Asynchronous Judging
- **Docker Sandboxing**: Compiles and executes C++ submissions inside isolated Docker containers with memory and execution time limits.
- **Compiler Fallback**: Seamless local `g++` fallback mode when running in containerless serverless environments.
- **Asynchronous Processing**: Immediate submission response with asynchronous background status polling (`AC`, `WA`, `TLE`, `RE`, `CE`).

---

## 🛠️ Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **AI & LLM Orchestration**: [LangChain](https://www.langchain.com/) & [Google Gemini AI API](https://ai.google.dev/) (`langchain-google-genai`, `google-genai`)
- **Database & ORM**: [SQLAlchemy](https://www.sqlalchemy.org/) (SQLite / PostgreSQL)
- **Sandboxing & Judging**: [Docker Engine (Docker SDK)](https://docker-py.readthedocs.io/) & Host GCC Fallback Engine
- **Authentication**: JWT (OAuth2 Password Bearer flow with bcrypt password hashing)
- **Frontend**: Vanilla HTML5, Modern Glassmorphism CSS3, JavaScript (Single Page Architecture), `Marked.js` Markdown Renderer

---

## 📁 Project Structure

```text
moj-backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py      # Database session and JWT auth injection
│   │   └── endpoints/           # API Routers
│   │       ├── ai.py            # AI Tutor, Complexity, Generator & Chat endpoints
│   │       ├── problems.py      # Problem CRUD & testcase endpoints
│   │       ├── submissions.py   # Submission & async judging endpoints
│   │       └── users.py         # Registration, Auth, & Profile endpoints
│   ├── core/
│   │   ├── config.py            # Settings & environment variables
│   │   └── security.py          # Hashing and JWT token logic
│   ├── db/
│   │   ├── database.py          # SQLAlchemy engine & session setup
│   │   └── models.py            # DB Schemas (User, Problem, Submission, AIChat, etc.)
│   ├── schemas/                 # Pydantic schemas for requests & responses
│   │   ├── ai.py
│   │   ├── problem.py
│   │   ├── submission.py
│   │   └── user.py
│   ├── services/
│   │   ├── ai.py                # LangChain & Gemini LLM service logic
│   │   └── judge.py             # Docker-based compiling & judging engine
│   └── main.py                  # FastAPI entry point & static file routing
├── static/                      # SPA Frontend Client
│   ├── index.html               # Main Dashboard, Modals & Code Inspectors
│   ├── style.css                # Glassmorphism Design System & Theme
│   └── script.js                # Frontend Controller, Auth & AI Chat handlers
├── .env                         # API keys & configuration
├── requirements.txt             # Python dependencies
└── README.md                    # Project documentation
```

---

## 🛣️ API Endpoints Summary

### Authentication & Profile (`/api/users`)
- `POST /register`: Register a new user
- `POST /login`: Log in and retrieve JWT Bearer token
- `GET /me`: Get current authenticated user details
- `GET /profile`: Get user statistics (solved count, attempted count, total submissions)

### AI Features & Performance Suite (`/api/ai` & `/api/hints`)
- `POST /api/ai/hint`: Enqueues an async AI hint generation task (`HTTP 202 Accepted` with `task_id`, `estimated_wait_seconds`).
- `GET /api/ai/hint/{task_id}`: Polls task status (`pending`, `running`, `done`, `failed`), returns cached or generated hint with ownership verification.
- `GET /api/ai/hint/stream/{submission_id}`: Real-time Server-Sent Events (`text/event-stream`) streaming tokens as they arrive from Gemini with client disconnect detection.
- `GET /api/hints/{problem_id}/next`: Ultra-low latency eager hints pre-generated on problem creation, served directly from DB (<10ms).
- `POST /api/ai/tutor/{submission_id}`: Hybrid endpoint returning 202 async task or synchronous result with `?sync=true`.
- `POST /api/ai/tutor/{submission_id}/chat`: Socratic tutor chat turn for submission.
- `GET /api/ai/tutor/{submission_id}/history`: Load saved Socratic tutor chat history.
- `POST /api/ai/complexity/{submission_id}`: Compute time & space complexity analysis.
- `POST /api/ai/general-chat`: Persistent General AI Assistant chat turn.
- `GET /api/ai/general-chat/{session_id}/history`: Load saved General AI chat transcript.
- `GET /api/ai/user/history`: List all saved AI chat sessions for current user's profile.
- `GET /health`: Health and readiness check verifying DB connection (`SELECT 1`), Redis connection (`PING`), and active AI model.

### Problems (`/api/problems`)
- `GET /`: List all programming problems
- `POST /`: Create a new problem *(Admin only)*
- `GET /{problem_id}`: Get details of a single problem
- `POST /{problem_id}/testcases`: Add test case *(Admin only)*
- `DELETE /{problem_id}`: Delete a problem *(Admin only)*

### Submissions & Judging (`/api/submissions`)
- `POST /`: Submit C++ solution code for evaluation
- `GET /`: View all submissions
- `GET /me/status`: Fetch user submission verdict status summary
- `GET /{submission_id}`: Retrieve details of a specific submission

---

## ⚡ Quick Start & Running Locally

1. **Clone & Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment (`.env`)**:
   ```env
   SECRET_KEY=your_secret_jwt_key
   GEMINI_API_KEY=your_google_gemini_api_key
   DATABASE_URL=sqlite:///./moj.db
   ```

3. **Start Dev Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **Access Dashboard**:
   Open **`http://127.0.0.1:8000/static/index.html`** in your browser!

---

## ⚡ Performance Optimization & Free-Tier Resilience Architecture

Judgely utilizes a **Hybrid AI Architecture** engineered specifically to minimize perceived latency while staying strictly within Google Gemini free-tier quotas (5–15 RPM, 20 RPD on Flash).

### 🚀 Optimization Pillars

1. **Hybrid Execution**:
   - **Interactive Web Sessions**: Streamed tokens via Server-Sent Events (`GET /api/ai/hint/stream/{submission_id}`), minimizing Time to First Token (TTFT).
   - **Background / Headless Requests**: Celery worker queue with Redis result backend returning `HTTP 202 Accepted` and enabling non-blocking polling.
2. **Deterministic Redis Caching & Stampede Protection**:
   - Cache keys hash `(problem_id, normalized_code_hash, language, verdict, help_level, prompt_version, model_name)`.
   - Code normalization strips line-trailing whitespace and CRLF line endings.
   - Cache hits return in **< 1 ms** with `cached=true`.
   - In-flight distributed locks attach duplicate concurrent requests to the active generator, preventing cache stampedes.
3. **Eager Hint Pre-Generation**:
   - Hints and solution approaches are pre-generated during contest problem generation and stored in the database.
   - `GET /api/hints/{problem_id}/next` responds in **~8 ms** with zero external API calls.
4. **Free-Tier Rate Limiting & Circuit Breaker**:
   - Per-user rate limits (5 RPM, 50 RPD) return `HTTP 429 Too Many Requests` with a standard `Retry-After: <seconds>` header.
   - Global cluster-wide worker limiter prevents total calls from exceeding free-tier RPM limits.
   - Circuit breaker trips after 3 consecutive upstream failures, activating a 60-second cooldown with structured, friendly fallback hints.

### 📊 Before vs. After Benchmark Comparison

| Metric / Pathway | Baseline (Phase 0) | Post-Optimization (Phase 8) | Performance Gain |
| :--- | :--- | :--- | :--- |
| **Synchronous Gemini Call** | 8,539.98 ms | *Replaced by Async / Stream* | — |
| **Async Task Enqueue (`POST /api/ai/hint`)** | 8,539.98 ms | **410.88 ms** | **20.8x faster** |
| **Redis Cache HIT (`POST /api/ai/hint`)** | 8,539.98 ms | **0.00 ms (< 1 ms)** | **> 8,500x faster** |
| **Eager Pre-Generated DB Hint (`/hints/next`)** | 8,539.98 ms | **8.36 ms** | **1,021x faster** |

---

## 🐳 Docker Compose & Render Deployment

### Running with Docker Compose Locally
```bash
# Start PostgreSQL, Redis, FastAPI Web App, and Celery Worker
docker-compose up -d --build

# Inspect running services
docker-compose ps

# View Celery worker logs
docker-compose logs -f worker
```

### Deploying to Render
1. **Web Service**: Create a Docker Web Service pointing to `Dockerfile`, set the start command to `uvicorn app.main:app --host 0.0.0.0 --port 8000`, and set health check path to `/health`.
2. **Managed Redis**: Add a Render Redis instance and set `REDIS_URL` in environment variables.
3. **Background Worker**: Create a Background Worker service on Render running `celery -A app.core.celery_app.celery_app worker --loglevel=info --concurrency=2`.
4. **Environment Variables**: Configure `GEMINI_API_KEY`, `AI_MODEL=gemini-3.8-flash`, `SECRET_KEY`, and database connection strings.
