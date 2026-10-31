from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Any
from app.api.dependencies import get_db, get_current_user
from app.db.models import Submission, User, Problem
from app.schemas.submission import SubmissionCreate, SubmissionResponse
from app.services.judge import judge_submission

router = APIRouter()

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
    
    if submission_in.language != "cpp":
        raise HTTPException(status_code=400, detail="Only cpp is supported currently")

    submission = Submission(
        user_id=current_user.id,
        problem_id=submission_in.problem_id,
        code=submission_in.code,
        language=submission_in.language
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    background_tasks.add_task(judge_submission, submission.id, db)
    
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
