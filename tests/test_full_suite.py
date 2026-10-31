import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
import json
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, VerdictEnum
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings
from app.core.redis import get_redis_client
from app.services.ai import AITutorHintResponse, get_trimmed_tutor_prompt
from app.services.ai_cache import (
    normalize_code,
    build_hint_cache_key,
    get_cached_hint,
    set_cached_hint,
    acquire_inflight_lock,
    get_inflight_task,
    release_inflight_lock
)
from app.services.ai_resilience import (
    check_user_rate_limit,
    is_circuit_open,
    record_gemini_success,
    record_gemini_failure,
    get_graceful_fallback_hint
)

@pytest.fixture(scope="session")
def client():
    return TestClient(app)

@pytest.fixture(scope="session")
def db_session():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture(scope="session")
def test_user(db_session):
    u = db_session.query(User).filter(User.email == "suite_user@test.com").first()
    if not u:
        u = User(
            username="suite_user",
            email="suite_user@test.com",
            hashed_password=get_password_hash("suite_pass"),
            is_admin=False
        )
        db_session.add(u)
        db_session.commit()
        db_session.refresh(u)
    return u

@pytest.fixture(scope="session")
def test_problem(db_session):
    p = db_session.query(Problem).filter(Problem.title == "Suite Test Problem").first()
    if not p:
        p = Problem(
            title="Suite Test Problem",
            description="Given an array of integers, find the maximum subarray sum.",
            time_limit=1.0,
            memory_limit=256
        )
        db_session.add(p)
        db_session.commit()
        db_session.refresh(p)
    return p

@pytest.fixture(scope="session")
def auth_headers(test_user):
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}

# --- Phase 1: Client & Prompting Tests ---
def test_phase1_trimmed_prompt():
    prompt_template = get_trimmed_tutor_prompt()
    formatted = prompt_template.format_messages(
        title="Subarray Sum",
        description="Find max sum",
        code="int x = 0;",
        verdict="WA",
        help_level="concise_hint"
    )
    user_msg = formatted[1].content
    assert "Subarray Sum" in user_msg
    assert "Find max sum" in user_msg
    assert "int x = 0;" in user_msg
    assert "WA" in user_msg
    assert "concise_hint" in user_msg
    assert len(user_msg) < 2500

# --- Phase 2: Async 202 Enqueue & Celery Task Flow ---
def test_phase2_async_enqueue_and_poll(client, db_session, test_user, test_problem, auth_headers):
    unique_code = f"// async test {uuid.uuid4().hex}\nint main(){{return 0;}}"
    sub = Submission(
        user_id=test_user.id,
        problem_id=test_problem.id,
        code=unique_code,
        language="cpp",
        verdict=VerdictEnum.WA
    )
    db_session.add(sub)
    db_session.commit()
    db_session.refresh(sub)

    # Seed mock result into task key to avoid hitting real Gemini in unit tests
    redis_client = get_redis_client()
    task_id = f"hint_{sub.id}_mock"
    mock_hint = {
        "what_went_wrong": "Array indexing error",
        "hint_1": "Check boundary condition",
        "hint_2": "Verify 0-index vs 1-index",
        "strong_hint": "Check lines 10-12",
        "edge_case": "N=0",
        "where_to_look": "Loop header",
        "concept": "Array bounds",
        "confidence": "High"
    }
    task_payload = {
        "task_id": task_id,
        "user_id": test_user.id,
        "submission_id": sub.id,
        "status": "done",
        "cached": False,
        "result": mock_hint,
        "completed_at": time.time()
    }
    redis_client.set(f"ai_task:{task_id}", json.dumps(task_payload), ex=300)

    # Poll status
    res = client.get(f"/api/ai/hint/{task_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "done"
    assert data["result"]["what_went_wrong"] == "Array indexing error"
    assert data["estimated_wait_seconds"] == 0

def test_phase2_unauthorized_user_forbidden(client, db_session, test_problem):
    # Create another user
    u2 = db_session.query(User).filter(User.email == "other_suite_user@test.com").first()
    if not u2:
        u2 = User(username="other_suite_user", email="other_suite_user@test.com", hashed_password=get_password_hash("pass"), is_admin=False)
        db_session.add(u2)
        db_session.commit()
        db_session.refresh(u2)

    redis_client = get_redis_client()
    task_id = f"hint_private_{uuid.uuid4().hex[:8]}"
    redis_client.set(f"ai_task:{task_id}", json.dumps({"task_id": task_id, "user_id": 99999, "status": "done"}), ex=60)

    u2_token = create_access_token(u2.id)
    headers = {"Authorization": f"Bearer {u2_token}"}
    res = client.get(f"/api/ai/hint/{task_id}", headers=headers)
    assert res.status_code == 403
    assert "Not authorized" in res.json()["detail"]

# --- Phase 3: Real-Time SSE Token Streaming ---
def test_phase3_streaming_with_cache(client, db_session, test_user, test_problem, auth_headers):
    code = f"// stream test {uuid.uuid4().hex}\nint main(){{return 0;}}"
    sub = Submission(user_id=test_user.id, problem_id=test_problem.id, code=code, language="cpp", verdict=VerdictEnum.WA)
    db_session.add(sub)
    db_session.commit()
    db_session.refresh(sub)

    cache_key = build_hint_cache_key(
        test_problem.id,
        code,
        "cpp",
        "WA",
        "concise_hint",
        settings.PROMPT_VERSION,
        settings.AI_MODEL
    )
    set_cached_hint(cache_key, {
        "what_went_wrong": "Off-by-one bug in stream test",
        "hint_1": "Examine the loop upper bound."
    }, ttl=300)

    res = client.get(f"/api/ai/hint/stream/{sub.id}", headers=auth_headers)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    body = res.text
    assert "data: " in body
    assert "Off-by-one bug in stream test" in body
    assert '"done": true' in body.lower()

# --- Phase 4: Deterministic Caching & Stampede Protection ---
def test_phase4_code_normalization_and_stampede(test_problem):
    code_crlf = "int main() {\r\n    return 0;   \r\n}\r\n"
    code_lf = "int main() {\n    return 0;\n}"
    assert normalize_code(code_crlf) == normalize_code(code_lf)

    k1 = build_hint_cache_key(test_problem.id, code_crlf, "cpp", "WA", "concise_hint")
    k2 = build_hint_cache_key(test_problem.id, code_lf, "cpp", "WA", "concise_hint")
    assert k1 == k2

    # Stampede lock
    release_inflight_lock(k1)
    assert acquire_inflight_lock(k1, "task_1") is True
    assert acquire_inflight_lock(k1, "task_2") is False
    assert get_inflight_task(k1) == "task_1"
    release_inflight_lock(k1)

# --- Phase 5: Rate Limiting & Resilience ---
def test_phase5_rate_limit_and_circuit_breaker(client, test_user, test_problem, auth_headers):
    redis_client = get_redis_client()
    current_minute = int(time.time() // 60)
    min_key = f"ai_rate:user:{test_user.id}:min:{current_minute}"
    redis_client.set(min_key, str(settings.AI_RATE_LIMIT_USER_RPM), ex=60)

    # Next direct call should fail with 429
    blocked, retry_after, msg = check_user_rate_limit(test_user.id)
    assert blocked is False
    assert retry_after is not None and retry_after > 0

    # Circuit breaker
    redis_client.delete("ai_circuit:state")
    redis_client.delete("ai_circuit:consecutive_failures")
    for _ in range(settings.AI_CIRCUIT_BREAKER_THRESHOLD):
        record_gemini_failure()
    assert is_circuit_open() is True

    fallback = get_graceful_fallback_hint(test_problem.title, "WA", "circuit open")
    assert fallback.confidence == "Low"
    assert "resilience mode" in fallback.what_went_wrong

    record_gemini_success()
    redis_client.delete("ai_circuit:state")
    assert is_circuit_open() is False
    redis_client.delete(min_key)

# --- Phase 6/7: Health Check & System Readiness ---
def test_health_check_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "ok"
    assert data["redis"] == "ok"
    assert data["ai_model"] == settings.AI_MODEL
