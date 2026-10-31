import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
import statistics
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, AITutorConversation, VerdictEnum
from app.core.security import create_access_token

def run_benchmark(n_samples: int = 5):
    print(f"=== Starting Phase 0 Baseline Measurement (N={n_samples}) ===")
    db = SessionLocal()
    
    # 1. Setup test user
    test_email = "baseline_user@judgely.com"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        from app.core.security import get_password_hash
        user = User(
            username="baseline_user",
            email=test_email,
            hashed_password=get_password_hash("testpass123"),
            is_admin=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Setup test problem
    problem = db.query(Problem).filter(Problem.title == "Two Sum Buggy").first()
    if not problem:
        problem = Problem(
            title="Two Sum Buggy",
            description="Given an array of integers nums and an integer target, return indices of two numbers that add up to target.",
            time_limit=1.0,
            memory_limit=256
        )
        db.add(problem)
        db.commit()
        db.refresh(problem)

    # 3. Setup test submission with a bug
    buggy_code = """#include <iostream>
#include <vector>
using namespace std;
int main() {
    int n, target;
    cin >> n >> target;
    vector<int> a(n);
    for(int i = 0; i < n; i++) cin >> a[i];
    for(int i = 0; i < n; i++) {
        for(int j = 0; j < n; j++) {
            if(a[i] + a[j] == target) {
                cout << i << " " << j << endl;
                return 0;
            }
        }
    }
    return 0;
}
"""
    submission = db.query(Submission).filter(
        Submission.user_id == user.id,
        Submission.problem_id == problem.id
    ).first()
    if not submission:
        submission = Submission(
            user_id=user.id,
            problem_id=problem.id,
            code=buggy_code,
            language="cpp",
            verdict=VerdictEnum.WA
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
    
    token = create_access_token(user.id)
    headers = {
        "Authorization": f"Bearer {token}",
    }

    client = TestClient(app)
    latencies = []

    for i in range(1, n_samples + 1):
        # Clear existing tutor conversation for this submission so it exercises full pipeline (DB + Prompt + Gemini)
        db.query(AITutorConversation).filter(AITutorConversation.submission_id == submission.id).delete()
        db.commit()

        req_id = f"baseline-{uuid.uuid4().hex[:6]}"
        headers["X-Request-ID"] = req_id
        
        t0 = time.perf_counter()
        response = client.post(f"/api/ai/tutor/{submission.id}", headers=headers)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        
        if response.status_code == 200:
            data = response.json()
            latencies.append(elapsed_ms)
            print(f"Request {i}/{n_samples} [{req_id}]: status={response.status_code}, latency={elapsed_ms:.2f}ms, error_diag={data.get('what_went_wrong', '')[:40]}...")
        else:
            print(f"Request {i}/{n_samples} [{req_id}]: FAILED with status {response.status_code}, body={response.text}")
        
        # Sleep briefly between calls to respect Gemini free-tier rate limits
        if i < n_samples:
            time.sleep(2)

    db.close()

    if latencies:
        latencies_sorted = sorted(latencies)
        def percentile(data, p):
            k = (len(data) - 1) * p
            f = int(k)
            c = f + 1
            if c < len(data):
                return data[f] + (data[c] - data[f]) * (k - f)
            return data[f]

        p50 = percentile(latencies_sorted, 0.50)
        p95 = percentile(latencies_sorted, 0.95)
        mean_lat = statistics.mean(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)

        print("\n" + "="*45)
        print("BASELINE PERFORMANCE METRICS (Phase 0)")
        print("="*45)
        print(f"Samples:      {len(latencies)} successful requests")
        print(f"p50 Latency:  {p50:.2f} ms")
        print(f"p95 Latency:  {p95:.2f} ms")
        print(f"Mean Latency: {mean_lat:.2f} ms")
        print(f"Min Latency:  {min_lat:.2f} ms")
        print(f"Max Latency:  {max_lat:.2f} ms")
        print("="*45 + "\n")
        return {
            "p50": p50,
            "p95": p95,
            "mean": mean_lat,
            "min": min_lat,
            "max": max_lat,
            "samples": latencies
        }
    else:
        print("No successful sample requests collected.")
        return None

if __name__ == "__main__":
    run_benchmark(5)
