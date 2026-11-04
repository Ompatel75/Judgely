from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Any
from app.api.dependencies import get_db, get_current_user
from app.db.models import Submission, User, Problem
from app.schemas.submission import (
    SubmissionCreate,
    SubmissionResponse,
    CodeRunRequest,
    CodeRunResponse,
)
from app.services.judge import judge_submission, run_code

router = APIRouter()

@router.post("/run", response_model=CodeRunResponse)
def run_code_sample(
    run_req: CodeRunRequest,
    db: Session = Depends(get_db)
) -> Any:
    """Lightweight test runner to execute code against sample or custom test cases without permanent database persistence."""
    cases = []
    # If custom stdin input is provided
    if run_req.custom_input is not None and run_req.custom_input != "":
        cases.append({"input": run_req.custom_input, "expected": ""})
    elif run_req.test_cases and len(run_req.test_cases) > 0:
        for tc in run_req.test_cases:
            cases.append({"input": tc.input, "expected": tc.expected or ""})
    elif run_req.problem_id:
        problem = db.query(Problem).filter(Problem.id == run_req.problem_id).first()
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found")
        
        sample_cases = [tc for tc in problem.test_cases if not tc.is_hidden]
        if not sample_cases and problem.test_cases:
            sample_cases = problem.test_cases[:3]

        for tc in sample_cases:
            cases.append({"input": tc.input_data, "expected": tc.expected_output})

    if not cases:
        cases = [{"input": "", "expected": ""}]

    time_limit = 2.0
    if run_req.problem_id:
        p = db.query(Problem).filter(Problem.id == run_req.problem_id).first()
        if p and p.time_limit:
            time_limit = float(p.time_limit)

    return run_code(
        code=run_req.code,
        language=run_req.language,
        test_cases=cases,
        time_limit=time_limit
    )

@router.post("/", response_model=SubmissionResponse)
def submit_code(
    *,
    db: Session = Depends(get_db),
    submission_in: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks
) -> Any:
    problem = db.query(Problem).filter(Problem.id == submission_in.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    lang = (submission_in.language or "").lower()
    if lang not in ["cpp", "c++", "python", "python3", "py"]:
        raise HTTPException(status_code=400, detail="Only C++ and Python are supported currently")

    submission = Submission(
        user_id=current_user.id,
        problem_id=submission_in.problem_id,
        code=submission_in.code,
        language="python" if lang in ["python", "python3", "py"] else "cpp"
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    # Run judge_submission in background without holding closed request-scoped session
    background_tasks.add_task(judge_submission, submission.id)
    
    return submission

@router.get("/", response_model=List[SubmissionResponse])
def read_submissions(
    skip: int = 0,
    limit: int = 100,
    all_users: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(Submission)
    if not (current_user.is_admin and all_users):
        query = query.filter(Submission.user_id == current_user.id)
    submissions = query.order_by(Submission.id.desc()).offset(skip).limit(limit).all()
    return submissions

@router.get("/me/status")
def get_my_submission_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submissions = db.query(Submission).filter(Submission.user_id == current_user.id).all()
    status_map = {}
    for sub in submissions:
        pid = sub.problem_id
        v = sub.verdict.name if sub.verdict else "PENDING"
        if pid not in status_map:
            status_map[pid] = v
        else:
            if status_map[pid] == "AC":
                continue
            elif v == "AC":
                status_map[pid] = "AC"
            elif v in ["WA", "TLE", "RE", "CE"]:
                status_map[pid] = v
    return status_map

@router.get("/{submission_id}", response_model=SubmissionResponse)
def read_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this submission")
    return submission
