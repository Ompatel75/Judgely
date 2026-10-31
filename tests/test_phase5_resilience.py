import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, VerdictEnum
from app.core.security import create_access_token, get_password_hash
from app.core.redis import get_redis_client
from app.core.config import settings
from app.services.ai_resilience import (
    check_user_rate_limit,
    check_and_apply_global_rpm_limit,
    is_circuit_open,
    record_gemini_success,
    record_gemini_failure,
    get_graceful_fallback_hint
)

def test_phase5_resilience():
    client = TestClient(app)
    db = SessionLocal()
    redis_client = get_redis_client()

    # 1. Setup user
    u = db.query(User).filter(User.email == "resilience_user@test.com").first()
    if not u:
        u = User(username="resilience_user", email="resilience_user@test.com", hashed_password=get_password_hash("pass5"), is_admin=False)
        db.add(u)
        db.commit()
        db.refresh(u)

    # 2. Setup problem
    prob = db.query(Problem).filter(Problem.title == "Resilience Test Problem").first()
    if not prob:
        prob = Problem(title="Resilience Test Problem", description="Test resilience features.", time_limit=1.0, memory_limit=256)
        db.add(prob)
        db.commit()
        db.refresh(prob)

    u_id = u.id
    prob_id = prob.id
    token = create_access_token(u_id)
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Test 1: User Minute Rate Limiter (RPM) ---")
    # Clear user rate limit keys
    current_minute = int(time.time() // 60)
    minute_key = f"ai_rate:user:{u_id}:min:{current_minute}"
    redis_client.delete(minute_key)

    # Make exactly settings.AI_RATE_LIMIT_USER_RPM calls allowed
    limit = settings.AI_RATE_LIMIT_USER_RPM
    print(f"Testing user RPM limit = {limit}")
    for i in range(limit):
        allowed, retry_after, msg = check_user_rate_limit(u_id)
        assert allowed is True, f"Request {i+1} should be allowed"

    # Next call must be blocked with 429 Retry-After
    blocked, retry_after, msg = check_user_rate_limit(u_id)
    print(f"Call {limit+1}: allowed={blocked}, retry_after={retry_after}s, msg={msg}")
    assert blocked is False
    assert retry_after is not None and retry_after > 0
    assert "Rate limit exceeded" in msg

    # Reset minute key
    redis_client.delete(minute_key)

    print("\n--- Test 2: Circuit Breaker State Machine & Graceful Fallback ---")
    # Reset circuit breaker
    redis_client.delete("ai_circuit:state")
    redis_client.delete("ai_circuit:consecutive_failures")
    assert is_circuit_open() is False

    # Record consecutive failures up to threshold
    threshold = settings.AI_CIRCUIT_BREAKER_THRESHOLD
    print(f"Simulating {threshold} consecutive failures to trip circuit breaker (threshold={threshold})")
    for _ in range(threshold - 1):
        record_gemini_failure()
        assert is_circuit_open() is False

    # Final failure trips the circuit
    record_gemini_failure()
    assert is_circuit_open() is True
    print("Circuit breaker successfully tripped (state=open)!")

    # Verify graceful fallback hint content
    fallback = get_graceful_fallback_hint("Test Problem", "TLE", "temporary service cooldown")
    assert fallback.confidence == "Low"
    assert "resilience mode" in fallback.what_went_wrong
    assert "loop boundaries" in fallback.hint_1
    print("Graceful fallback hint produced successfully:", fallback.what_went_wrong)

    # Success resets circuit
    record_gemini_success()
    redis_client.delete("ai_circuit:state")
    assert is_circuit_open() is False
    print("Circuit breaker successfully reset after record_gemini_success().")

    print("\n--- Test 3: Global Worker RPM Limiter Tracking ---")
    current_minute = int(time.time() // 60)
    global_key = f"ai_global_rpm:{current_minute}"
    redis_client.delete(global_key)

    # Apply 1 check
    delay = check_and_apply_global_rpm_limit()
    assert delay == 0
    val = int(redis_client.get(global_key))
    assert val == 1
    print(f"Global RPM counter initialized and incremented correctly: {val}")

    print("\n--- Test 4: End-to-End API 429 Rejection & Retry-After Header ---")
    # Create submission with unique code so it doesn't hit cache
    unique_code = f"// unique code {uuid.uuid4().hex}\nint main(){{return 0;}}"
    sub = Submission(user_id=u_id, problem_id=prob_id, code=unique_code, language="cpp", verdict=VerdictEnum.WA)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    sub_id = sub.id
    db.close()

    # Pre-fill user minute quota in Redis so next API call immediately triggers 429
    redis_client.set(minute_key, str(settings.AI_RATE_LIMIT_USER_RPM), ex=60)

    # Test POST /api/ai/hint
    res = client.post(
        "/api/ai/hint",
        json={"submission_id": sub_id, "help_level": "concise_hint"},
        headers=headers
    )
    print(f"POST /api/ai/hint under rate-limit: status={res.status_code}, headers={res.headers.get('Retry-After')}")
    assert res.status_code == 429
    assert "Retry-After" in res.headers
    assert int(res.headers["Retry-After"]) > 0
    assert "Rate limit exceeded" in res.json()["detail"]

    # Test GET /api/ai/hint/stream
    res_stream = client.get(
        f"/api/ai/hint/stream/{sub_id}",
        headers=headers
    )
    print(f"GET /api/ai/hint/stream under rate-limit: status={res_stream.status_code}, headers={res_stream.headers.get('Retry-After')}")
    assert res_stream.status_code == 429
    assert "Retry-After" in res_stream.headers

    # Cleanup
    redis_client.delete(minute_key)
    print("\n ALL PHASE 5 RATE LIMITING & RESILIENCE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_phase5_resilience()

