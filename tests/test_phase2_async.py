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

def test_phase2_async_flow():
    client = TestClient(app)
    db = SessionLocal()

    # 1. Setup user 1
    u1 = db.query(User).filter(User.email == "user1_phase2@test.com").first()
    if not u1:
        u1 = User(username="user1_phase2", email="user1_phase2@test.com", hashed_password=get_password_hash("pass1"), is_admin=False)
        db.add(u1)
        db.commit()
        db.refresh(u1)

    # Setup user 2 (attacker / unauthorized)
    u2 = db.query(User).filter(User.email == "user2_phase2@test.com").first()
    if not u2:
        u2 = User(username="user2_phase2", email="user2_phase2@test.com", hashed_password=get_password_hash("pass2"), is_admin=False)
        db.add(u2)
        db.commit()
        db.refresh(u2)

    # Setup test problem
    prob = db.query(Problem).filter(Problem.title == "Async Test Prob").first()
    if not prob:
        prob = Problem(title="Async Test Prob", description="Given N numbers, output their maximum.", time_limit=1.0, memory_limit=256)
        db.add(prob)
        db.commit()
        db.refresh(prob)

    # Setup test submission owned by user 1
    sub = Submission(user_id=u1.id, problem_id=prob.id, code="int main(){ int x; }", language="cpp", verdict=VerdictEnum.WA)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    u1_id = u1.id
    u2_id = u2.id
    sub_id = sub.id
    db.close()

    token_u1 = create_access_token(u1_id)
    token_u2 = create_access_token(u2_id)

    print("\n--- Test 1: POST /api/ai/hint enqueues task and returns 202 ---")
    t0 = time.perf_counter()
    res = client.post(
        "/api/ai/hint",
        json={"submission_id": sub_id, "help_level": "concise_hint"},
        headers={"Authorization": f"Bearer {token_u1}"}
    )
    elapsed = (time.perf_counter() - t0) * 1000
    print(f"Status Code: {res.status_code} (Elapsed: {elapsed:.2f}ms)")
    assert res.status_code == 202, f"Expected 202, got {res.status_code}: {res.text}"
    enqueued_data = res.json()
    task_id = enqueued_data["task_id"]
    print("Enqueued Response:", enqueued_data)
    assert task_id is not None
    assert enqueued_data["status"] == "pending"

    print("\n--- Test 2: Check Redis storage and TTL ---")
    redis_client = get_redis_client()
    task_key = f"ai_task:{task_id}"
    ttl = redis_client.ttl(task_key)
    print(f"Redis Key: {task_key}, TTL: {ttl} seconds")
    assert ttl > 0 or ttl == -1, f"Expected positive TTL, got {ttl}"

    print("\n--- Test 3: GET /api/ai/hint/{task_id} fetches status and result ---")
    poll_res = client.get(
        f"/api/ai/hint/{task_id}",
        headers={"Authorization": f"Bearer {token_u1}"}
    )
    print("Poll Status Code:", poll_res.status_code)
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    print("Poll Status:", poll_data.get("status"))
    assert poll_data.get("status") in ("pending", "running", "done")
    if poll_data.get("status") == "done":
        print("Result received:", poll_data.get("result", {}).get("what_went_wrong", "")[:50])

    print("\n--- Test 4: Ownership security check (user 2 cannot view user 1's task) ---")
    unauth_res = client.get(
        f"/api/ai/hint/{task_id}",
        headers={"Authorization": f"Bearer {token_u2}"}
    )
    print("Unauthorized Access Status Code:", unauth_res.status_code)
    assert unauth_res.status_code == 403, f"Expected 403 Forbidden, got {unauth_res.status_code}: {unauth_res.text}"
    print("Unauthorized rejection verified:", unauth_res.json())

    print("\n--- Test 5: Synchronous flag fallback (?sync=true) ---")
    sync_res = client.post(
        f"/api/ai/tutor/{sub_id}?sync=true",
        headers={"Authorization": f"Bearer {token_u1}"}
    )
    print("Sync Call Status Code:", sync_res.status_code)
    assert sync_res.status_code == 200, f"Expected 200, got {sync_res.status_code}"
    print("Sync Response concept:", sync_res.json().get("concept"))

    print("\n ALL PHASE 2 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_phase2_async_flow()
