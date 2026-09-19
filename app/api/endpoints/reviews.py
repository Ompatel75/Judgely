from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.db.models import User, Submission, CodeReview, Problem
from app.services.ai_advanced import generate_code_review
from app.schemas.ai_advanced import CodeReviewSchema

router = APIRouter()

@router.post("/{submission_id}", response_model=CodeReviewSchema)
def create_code_review(submission_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    submission = db.query(Submission).filter(Submission.id == submission_id, Submission.user_id == current_user.id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    existing_review = db.query(CodeReview).filter(CodeReview.submission_id == submission_id).first()
    if existing_review:
        return CodeReviewSchema(
            correctness=existing_review.correctness,
            time_complexity=existing_review.time_complexity,
            space_complexity=existing_review.space_complexity,
            code_quality=existing_review.code_quality,
            mnc_quality_standards=existing_review.mnc_quality_standards,
            potential_bugs=existing_review.potential_bugs,
            edge_cases=existing_review.edge_cases,
            unnecessary_operations=existing_review.unnecessary_operations,
            optimizations=existing_review.optimizations,
            maintainability=existing_review.maintainability
        )

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    
    review_data = generate_code_review(problem.title, problem.description, submission.code)
    
    new_review = CodeReview(
        submission_id=submission_id,
        correctness=review_data.correctness,
        time_complexity=review_data.time_complexity,
        space_complexity=review_data.space_complexity,
        code_quality=review_data.code_quality,
        mnc_quality_standards=review_data.mnc_quality_standards,
        potential_bugs=review_data.potential_bugs,
        edge_cases=review_data.edge_cases,
        unnecessary_operations=review_data.unnecessary_operations,
        optimizations=review_data.optimizations,
        maintainability=review_data.maintainability
    )
    db.add(new_review)
    db.commit()
    return review_data
