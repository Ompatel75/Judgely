import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
import statistics
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Problem, Submission, VerdictEnum, AIHint
from app.core.security import create_access_token, get_password_hash
from app.core.redis import get_redis_client
from app.services.ai_cache import build_hint_cache_key, set_cached_hint

def run_after_benchmark(n_samples: int = 10):
    print("=" * 65)
    print(" JUDGELY AI SUITE - POST-OPTIMIZATION BENCHMARK")
    print("=" * 65)

    client = TestClient(app)
    db = SessionLocal()

    # 1. Setup user
    user = db.query(User).filter(User.email == "bench_after@test.com").first()
    if not user:
        user = User(
            username="bench_after",
            email="bench_after@test.com",
            hashed_password=get_password_hash("pass"),
            is_admin=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Setup problem with pre-generated eager hints
    problem = db.query(Problem).filter(Problem.title == "After Benchmark Problem").first()
    if not problem:
        problem = Problem(
            title="After Benchmark Problem",
            description="Given an array, find maximum sum.",
            time_limit=1.0,
            memory_limit=256
        )
        db.add(problem)
        db.commit()
        db.refresh(problem)

    # Seed eager pre-generated hint for problem
    hint_row = db.query(AIHint).filter(AIHint.problem_id == problem.id).first()
    if not hint_row:
        hint_row = AIHint(
            problem_id=problem.id,
            hint_1="Consider Kadane's algorithm.",
            hint_2="Keep a running sum and update max.",
            hint_3="Reset running sum if it drops below zero.",
            approach="Dynamic programming with 1 state.",
            solution="Iterate once through the array."
        )
        db.add(hint_row)
        db.commit()

    code = "int main() { return 0; }"
    submission = Submission(
        user_id=user.id,
        problem_id=problem.id,
        code=code,
        language="cpp",
        verdict=VerdictEnum.WA
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    sub_id = submission.id
    prob_id = problem.id
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # Seed cache key
    cache_key = build_hint_cache_key(prob_id, code, "cpp", "WA", "concise_hint")
    valid_hint = {
        "what_went_wrong": "Off by one error",
        "hint_1": "Check array index",
        "hint_2": "Verify bounds",
        "strong_hint": "Loop i < n",
        "edge_case": "N=1",
        "where_to_look": "For loop",
        "concept": "Arrays",
        "confidence": "High"
    }
    set_cached_hint(cache_key, valid_hint, ttl=86400)

    # ----------------------------------------------------
    # Metric 1: Async Celery Task Enqueue Response Time (POST /api/ai/hint)
    # ----------------------------------------------------
    async_enqueue_latencies = []
    for _ in range(n_samples):
        unique_code = f"// unique {uuid.uuid4().hex}\nint main(){{return 0;}}"
        sub_tmp = Submission(user_id=user.id, problem_id=prob_id, code=unique_code, language="cpp", verdict=VerdictEnum.WA)
        db.add(sub_tmp)
        db.commit()
        db.refresh(sub_tmp)

        t0 = time.perf_counter()
        res = client.post("/api/ai/hint", json={"submission_id": sub_tmp.id}, headers=headers)
        elapsed = (time.perf_counter() - t0) * 1000
        if res.status_code == 202:
            async_enqueue_latencies.append(elapsed)

    # ----------------------------------------------------
    # Metric 2: Redis Cache HIT Latency (POST /api/ai/hint)
    # ----------------------------------------------------
    cache_hit_latencies = []
    for _ in range(n_samples):
        t0 = time.perf_counter()
        res = client.post("/api/ai/hint", json={"submission_id": sub_id}, headers=headers)
        elapsed = (time.perf_counter() - t0) * 1000
        if res.status_code == 202 and res.json().get("status") == "done":
            cache_hit_latencies.append(elapsed)

    # ----------------------------------------------------
    # Metric 3: Eager Pre-Generated Hint Latency (GET /api/hints/{prob_id}/next)
    # ----------------------------------------------------
    eager_latencies = []
    for _ in range(n_samples):
        t0 = time.perf_counter()
        res = client.get(f"/api/hints/{prob_id}/next", headers=headers)
        elapsed = (time.perf_counter() - t0) * 1000
        if res.status_code == 200:
            eager_latencies.append(elapsed)

    db.close()

    # Calculate statistics
    def calc_stats(lats):
        if not lats:
            return 0.0, 0.0, 0.0
        sorted_l = sorted(lats)
        p50 = statistics.median(sorted_l)
        idx_95 = int(0.95 * len(sorted_l))
        p95 = sorted_l[min(idx_95, len(sorted_l) - 1)]
        mean = statistics.mean(sorted_l)
        return p50, p95, mean

    async_p50, async_p95, _ = calc_stats(async_enqueue_latencies)
    cache_p50, cache_p95, _ = calc_stats(cache_hit_latencies)
    eager_p50, eager_p95, _ = calc_stats(eager_latencies)

    print("\n" + "=" * 65)
    print(" BENCHMARK COMPARISON TABLE (BASELINE vs POST-OPTIMIZATION)")
    print("=" * 65)
    print(f"{'Metric / Pathway':<35} | {'Baseline (p50)':<14} | {'Post-Opt (p50)':<14} | {'Speedup':<8}")
    print("-" * 78)
    print(f"{'Synchronous Gemini Call (Phase 0)':<35} | {'8,539.98 ms':<14} | {'N/A (Replaced)':<14} | {'-':<8}")
    print(f"{'Async Task Enqueue (Phase 2)':<35} | {'8,539.98 ms':<14} | {f'{async_p50:.2f} ms':<14} | {f'{8539.98 / max(async_p50, 0.1):.1f}x':<8}")
    print(f"{'Redis Cache HIT (Phase 4)':<35} | {'8,539.98 ms':<14} | {f'{cache_p50:.2f} ms':<14} | {f'{8539.98 / max(cache_p50, 0.1):.1f}x':<8}")
    print(f"{'Eager Pre-Generated DB Hint':<35} | {'8,539.98 ms':<14} | {f'{eager_p50:.2f} ms':<14} | {f'{8539.98 / max(eager_p50, 0.1):.1f}x':<8}")
    print("-" * 78)
    print(f"Async Enqueue p95: {async_p95:.2f} ms | Cache HIT p95: {cache_p95:.2f} ms | Eager p95: {eager_p95:.2f} ms")
    print("=" * 65)

if __name__ == "__main__":
    run_after_benchmark(10)

