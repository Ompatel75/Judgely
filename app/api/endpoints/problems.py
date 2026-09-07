import tempfile
import os
import subprocess
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any
from app.api.dependencies import get_db, get_current_admin_user
from app.db.models import Problem, TestCase
from app.schemas.problem import ProblemCreate, ProblemResponse, TestCaseCreate, TestCaseResponse
from app.schemas.ai import (
    AIProblemGenerateRequest,
    AIGeneratedProblemSchema,
    TestValidationRequest,
    TestValidationResponse,
    TestValidationResultItem
)
from app.services.ai import generate_problem_with_ai

router = APIRouter()

@router.get("/", response_model=List[ProblemResponse])
def read_problems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> Any:
    problems = db.query(Problem).offset(skip).limit(limit).all()
    return problems

@router.post("/", response_model=ProblemResponse)
def create_problem(
    *,
    db: Session = Depends(get_db),
    problem_in: ProblemCreate,
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = Problem(**problem_in.model_dump())
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem

@router.post("/generate-ai", response_model=AIGeneratedProblemSchema)
def generate_ai_problem(
    req: AIProblemGenerateRequest,
    current_user = Depends(get_current_admin_user)
) -> Any:
    try:
        result = generate_problem_with_ai(
            topic=req.topic,
            difficulty=req.difficulty,
            tags=req.tags or "",
            instructions=req.instructions or ""
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate problem: {str(e)}")

@router.post("/validate-tests", response_model=TestValidationResponse)
def validate_ai_test_cases(
    req: TestValidationRequest,
    current_user = Depends(get_current_admin_user)
) -> Any:
    if not req.cpp_solution.strip():
        raise HTTPException(status_code=400, detail="Reference C++ solution is required for validation")

    results = []
    matched_count = 0
    mismatched_count = 0

    with tempfile.TemporaryDirectory() as temp_dir:
        code_path = os.path.join(temp_dir, "solution.cpp")
        with open(code_path, "w") as f:
            f.write(req.cpp_solution)

        executable_name = "solution.exe" if os.name == "nt" else "solution"
        executable_path = os.path.join(temp_dir, executable_name)

        # Compile reference solution
        try:
            res = subprocess.run(
                ["g++", "-O2", "solution.cpp", "-o", executable_name],
                cwd=temp_dir,
                capture_output=True,
                timeout=30
            )
            if res.returncode != 0:
                err_msg = res.stderr.decode("utf-8", errors="ignore")
                raise HTTPException(status_code=400, detail=f"Reference solution compilation error: {err_msg}")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=400, detail="Reference solution compilation timed out")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Compiler execution error: {str(e)}")

        for idx, tc in enumerate(req.test_cases):
            input_str = tc.get("input_data", "")
            expected_str = tc.get("expected_output", "").strip()

            input_file = os.path.join(temp_dir, f"in_{idx}.txt")
            output_file = os.path.join(temp_dir, f"out_{idx}.txt")

            with open(input_file, "w") as f:
                f.write(input_str)

            actual_str = ""
            status_val = "MISMATCH"

            try:
                with open(input_file, "r") as infile, open(output_file, "w") as outfile:
                    proc = subprocess.run(
                        [executable_path],
                        stdin=infile,
                        stdout=outfile,
                        stderr=subprocess.PIPE,
                        timeout=3.0,
                        cwd=temp_dir
                    )
                if proc.returncode == 0 and os.path.exists(output_file):
                    with open(output_file, "r") as f:
                        actual_str = f.read().strip()

                    if actual_str == expected_str:
                        status_val = "MATCH"
                        matched_count += 1
                    else:
                        mismatched_count += 1
                else:
                    actual_str = "RUNTIME ERROR"
                    mismatched_count += 1
            except subprocess.TimeoutExpired:
                actual_str = "TIME LIMIT EXCEEDED"
                mismatched_count += 1
            except Exception as e:
                actual_str = f"ERROR: {str(e)}"
                mismatched_count += 1

            results.append(TestValidationResultItem(
                index=idx + 1,
                input_data=input_str,
                expected_output=expected_str,
                actual_output=actual_str,
                status=status_val
            ))

    return TestValidationResponse(
        total=len(req.test_cases),
        matched=matched_count,
        mismatched=mismatched_count,
        results=results
    )

@router.get("/{problem_id}", response_model=ProblemResponse)
def read_problem(problem_id: int, db: Session = Depends(get_db)) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

@router.post("/{problem_id}/testcases", response_model=TestCaseResponse)
def create_testcase_for_problem(
    problem_id: int,
    testcase_in: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    testcase = TestCase(**testcase_in.model_dump(), problem_id=problem_id)
    db.add(testcase)
    db.commit()
    db.refresh(testcase)
    return testcase

@router.delete("/{problem_id}")
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    db.query(TestCase).filter(TestCase.problem_id == problem_id).delete()
    from app.db.models import Submission
    db.query(Submission).filter(Submission.problem_id == problem_id).delete()
    
    db.delete(problem)
    db.commit()
    return {"message": "Problem deleted successfully"}
