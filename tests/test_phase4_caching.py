import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, VerdictEnum
from app.core.security import create_access_token, get_password_hash
from app.core.redis import get_redis_client
from app.services.ai_cache import (
    normalize_code,
    compute_normalized_code_hash,
    build_hint_cache_key,
    get_cached_hint,
    set_cached_hint,
    acquire_inflight_lock,
    get_inflight_task,
    release_inflight_lock
)

def test_phase4_caching_and_stampede():
    client = TestClient(app)
    db = SessionLocal()

    # 1. Setup user
    u = db.query(User).filter(User.email == "user_phase4@test.com").first()
    if not u:
        u = User(username="user_phase4", email="user_phase4@test.com", hashed_password=get_password_hash("pass4"), is_admin=False)
        db.add(u)
        db.commit()
        db.refresh(u)

    # 2. Setup problem
    prob = db.query(Problem).filter(Problem.title == "Cache Problem Test").first()
    if not prob:
        prob = Problem(title="Cache Problem Test", description="Determine if array has duplicate elements.", time_limit=1.0, memory_limit=256)
        db.add(prob)
        db.commit()
        db.refresh(prob)

    code_variant_a = "int main() {\r\n    int x = 10;   \r\n    return 0;\r\n}\r\n"
    code_variant_b = "int main() {\n    int x = 10;\n    return 0;\n}"

    sub1 = Submission(user_id=u.id, problem_id=prob.id, code=code_variant_a, language="cpp", verdict=VerdictEnum.WA)
    sub2 = Submission(user_id=u.id, problem_id=prob.id, code=code_variant_b, language="cpp", verdict=VerdictEnum.WA)
    db.add_all([sub1, sub2])
    db.commit()
    db.refresh(sub1)
    db.refresh(sub2)

    u_id = u.id
    sub1_id = sub1.id
    sub2_id = sub2.id
    prob_id = prob.id
    db.close()

    token = create_access_token(u_id)
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Test 1: Code Normalization & Deterministic Cache Key Stability ---")
    norm_a = normalize_code(code_variant_a)
    norm_b = normalize_code(code_variant_b)
    print("Normalized A == Normalized B:", norm_a == norm_b)
    assert norm_a == norm_b

    key_a = build_hint_cache_key(prob_id, code_variant_a, "cpp", "WA", "concise_hint", "v1", "gemini-3.8-flash")
    key_b = build_hint_cache_key(prob_id, code_variant_b, "cpp", "WA", "concise_hint", "v1", "gemini-3.8-flash")
    print(f"Key A: {key_a}")
    print(f"Key B: {key_b}")
    print("Key A == Key B:", key_a == key_b)
    assert key_a == key_b, "Different whitespace/newlines must produce identical cache keys"

    # Verify prompt version invalidation
    key_v2 = build_hint_cache_key(prob_id, code_variant_a, "cpp", "WA", "concise_hint", "v2", "gemini-3.8-flash")
    assert key_a != key_v2, "Different prompt version must invalidate old cache key"
    print("PROMPT_VERSION change successfully invalidates cache key:", key_a != key_v2)

    print("\n--- Test 2: In-Flight Lock Stampede Protection ---")
    redis_client = get_redis_client()
    release_inflight_lock(key_a)
    assert acquire_inflight_lock(key_a, "task_master_123") is True
    # Second concurrent attempt must fail to acquire lock (stampede blocked)
    assert acquire_inflight_lock(key_a, "task_duplicate_456") is False
    assert get_inflight_task(key_a) == "task_master_123"
    print("Stampede in-flight lock acquired and duplicate blocked correctly.")
    release_inflight_lock(key_a)

    print("\n--- Test 3: Never Cache Failed / Error Responses ---")
    redis_client.delete(key_a)
    err_payload = {"what_went_wrong": "AI hint generation failed: 503 UNAVAILABLE", "hint_1": "none"}
    set_cached_hint(key_a, err_payload)
    assert get_cached_hint(key_a) is None, "Failed/error responses must never be cached"
    print("Verified: Error response was safely rejected from cache.")

    print("\n--- Test 4: Cache Miss followed by Instant Cache HIT ---")
    # Seed a valid hint into cache
    valid_hint = {
        "what_went_wrong": "The loop does not reset the visited array.",
        "hint_1": "Clear the data structure between test cases.",
        "hint_2": "Check variable scope.",
        "strong_hint": "Check lines 10-15.",
        "edge_case": "N=1",
        "where_to_look": "Inner loop",
        "concept": "State reset",
        "confidence": "High"
    }
    set_cached_hint(key_a, valid_hint, ttl=86400)
    assert get_cached_hint(key_a) is not None

    # Call endpoint for sub1 (which has code_variant_a)
    t0 = time.perf_counter()
    res1 = client.post(
        "/api/ai/hint",
        json={"submission_id": sub1_id, "help_level": "concise_hint"},
        headers=headers
    )
    lat1 = (time.perf_counter() - t0) * 1000
    print(f"Request sub1 (Cache HIT): status={res1.status_code}, latency={lat1:.2f}ms, resp={res1.json()}")
    assert res1.status_code == 202
    data1 = res1.json()
    assert data1["status"] == "done"
    assert "cached" in data1["message"].lower()

    # Call endpoint for sub2 (which has code_variant_b with different whitespace)
    t0 = time.perf_counter()
    res2 = client.post(
        "/api/ai/hint",
        json={"submission_id": sub2_id, "help_level": "concise_hint"},
        headers=headers
    )
    lat2 = (time.perf_counter() - t0) * 1000
    print(f"Request sub2 (Whitespace normalized Cache HIT): status={res2.status_code}, latency={lat2:.2f}ms, resp={res2.json()}")
    assert res2.status_code == 202
    data2 = res2.json()
    assert data2["status"] == "done"

    # Poll status for sub1 task
    poll_res = client.get(f"/api/ai/hint/{data1['task_id']}", headers=headers)
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    print("Poll Status for cached task:", poll_data["status"], "cached flag:", poll_data.get("cached"))
    assert poll_data["cached"] is True
    assert poll_data["result"]["what_went_wrong"] == valid_hint["what_went_wrong"]

    print("\n ALL PHASE 4 REDIS CACHING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_phase4_caching_and_stampede()

