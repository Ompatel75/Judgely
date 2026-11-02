from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine, Base, SessionLocal
from app.core.redis import get_redis_client
from app.api.endpoints import users, problems, submissions, ai, reviews, hints, analytics, interview
from app.services.ai import init_ai_client
import os

# Create database tables
Base.metadata.create_all(bind=engine)

def auto_migrate_schema():
    """Ensure any newly added columns exist in existing PostgreSQL/SQLite databases."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE problems ADD COLUMN difficulty VARCHAR(20) DEFAULT 'Medium'"))
            conn.commit()
        except Exception:
            # Column already exists or table not ready yet
            pass

auto_migrate_schema()

app = FastAPI(title=settings.PROJECT_NAME)

@app.on_event("startup")
def startup_event():
    init_ai_client()

@app.get("/health", tags=["system"])
def health_check():
    """Health and readiness check for Render, Docker, and monitoring."""
    health_status = {
        "status": "healthy",
        "database": "unknown",
        "redis": "unknown",
        "ai_model": settings.AI_MODEL
    }

    # 1. DB check
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["database"] = "ok"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"

    # 2. Redis check
    try:
        r = get_redis_client()
        r.ping()
        health_status["redis"] = "ok"
    except Exception as e:
        health_status["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"

    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=health_status)

# Configure CORS explicitly with Vercel origins
# Never combine allow_origins=["*"] with allow_credentials=True
configured_origins = [orig.strip() for orig in settings.CORS_ORIGINS.split(",") if orig.strip()]
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://judgely.vercel.app",
    "https://judgely-two.vercel.app",
]
allowed_origins = list(set(default_origins + configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(problems.router, prefix="/api/problems", tags=["problems"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(hints.router, prefix="/api/hints", tags=["hints"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return {"message": "Welcome to Judgely API"}
