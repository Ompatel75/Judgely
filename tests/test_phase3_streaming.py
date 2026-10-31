import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, AITutorConversation, VerdictEnum
from app.core.security import create_access_token, get_password_hash

def test_phase3_streaming():
    client = TestClient(app)
    db = SessionLocal()

    # 1. Setup user 1
    u1 = db.query(User).filter(User.email == "user1_phase3@test.com").first()
    if not u1:
        u1 = User(username="user1_phase3", email="user1_phase3@test.com", hashed_password=get_password_hash("pass1"), is_admin=False)
        db.add(u1)
        db.commit()
        db.refresh(u1)

    # Setup user 2 (unauthorized)
    u2 = db.query(User).filter(User.email == "user2_phase3@test.com").first()
    if not u2:
        u2 = User(username="user2_phase3", email="user2_phase3@test.com", hashed_password=get_password_hash("pass2"), is_admin=False)
        db.add(u2)
        db.commit()
        db.refresh(u2)

    # Setup test problem
    prob = db.query(Problem).filter(Problem.title == "Streaming Test Problem").first()
    if not prob:
        prob = Problem(title="Streaming Test Problem", description="Find the sum of array elements.", time_limit=1.0, memory_limit=256)
        db.add(prob)
        db.commit()
        db.refresh(prob)

    # Setup test submission for user 1
    sub = Submission(user_id=u1.id, problem_id=prob.id, code="int main(){ int sum = 0; }", language="cpp", verdict=VerdictEnum.WA)
    db.add(sub)
    db.commit()
    db.refresh(sub)

    u1_id = u1.id
    u2_id = u2.id
    sub_id = sub.id
    db.close()

    token_u1 = create_access_token(u1_id)
    token_u2 = create_access_token(u2_id)

    print("\n--- Test 1: GET /api/ai/hint/stream/{submission_id} returns text/event-stream ---")
    headers = {"Authorization": f"Bearer {token_u1}"}
    
    tokens_received = []
    has_done_event = False
    full_streamed_text = ""

    with client.stream("GET", f"/api/ai/hint/stream/{sub_id}", headers=headers) as response:
        print("Response Status Code:", response.status_code)
        print("Content-Type:", response.headers.get("content-type"))
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("data: "):
                event_data = json.loads(line[6:])
                if "token" in event_data:
                    tokens_received.append(event_data["token"])
                elif event_data.get("done"):
                    has_done_event = True
                    full_streamed_text = event_data.get("full_text", "")

    print(f"Total tokens received: {len(tokens_received)}")
    print(f"Sample streamed snippet: {''.join(tokens_received)[:60]}...")
    print(f"Terminal Done event received: {has_done_event}")
    assert len(tokens_received) > 0, "Expected to receive streamed tokens"
    assert has_done_event, "Expected terminal done event"
    assert len(full_streamed_text) > 0, "Expected non-empty full text"

    print("\n--- Test 2: Check Conversation saved in DB ---")
    db = SessionLocal()
    convo = db.query(AITutorConversation).filter(AITutorConversation.submission_id == sub_id).first()
    assert convo is not None, "Expected conversation to be saved in DB"
    print("Saved conversation role:", convo.role)
    print("Saved conversation preview:", convo.content[:60], "...")
    db.close()

    print("\n--- Test 3: Ownership security check (user 2 cannot stream user 1's submission) ---")
    unauth_res = client.get(
        f"/api/ai/hint/stream/{sub_id}",
        headers={"Authorization": f"Bearer {token_u2}"}
    )
    print("Unauthorized stream status code:", unauth_res.status_code)
    assert unauth_res.status_code == 403, f"Expected 403 Forbidden, got {unauth_res.status_code}"
    print("Unauthorized rejection verified:", unauth_res.json())

    print("\n ALL PHASE 3 STREAMING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_phase3_streaming()

