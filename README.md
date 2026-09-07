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

### AI Features & Chat (`/api/ai`)
- `POST /general-chat`: Persistent General AI Assistant chat turn
- `GET /general-chat/{session_id}/history`: Load saved General AI chat transcript
- `POST /tutor/{submission_id}`: Diagnoses error and returns initial Socratic hints
- `POST /tutor/{submission_id}/chat`: Socratic tutor chat turn for submission
- `GET /tutor/{submission_id}/history`: Load saved Socratic tutor chat history
- `POST /complexity/{submission_id}`: Compute time & space complexity analysis
- `POST /generate-problem`: Generate structured programming problem via LLM
- `POST /validate-testcases`: Run solution against test cases for AI generator
- `GET /user/history`: List all saved AI chat sessions for current user's profile

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
