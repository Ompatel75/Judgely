import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Any, Optional

from app.api.dependencies import get_db, get_current_user
from app.db.models import (
    Submission, User, Problem, TestCase, VerdictEnum,
    AIComplexityAnalysis, AITutorConversation
)
from app.schemas.ai import (
    AITutorHintResponse,
    AIComplexityResponse,
    AIChatRequest,
    AIChatResponse,
    AIChatMessage,
    AIChatSummaryItem,
    GeneralAIChatRequest
)
from app.services.ai import (
    generate_tutor_hint,
    generate_tutor_chat_reply,
    generate_general_chat_reply,
    analyze_complexity,
    compute_code_hash,
    OperationBreakdownItem
)

router = APIRouter()

@router.get("/user/history", response_model=List[AIChatSummaryItem])
def get_user_ai_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Query distinct submission conversations for the user
    sub_ids = db.query(AITutorConversation.submission_id).filter(
        AITutorConversation.user_id == current_user.id
    ).group_by(AITutorConversation.submission_id).all()

    results = []
    for (s_id,) in sub_ids:
        submission = db.query(Submission).filter(Submission.id == s_id).first()
        if not submission:
            continue
        problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
        
        msg_count = db.query(func.count(AITutorConversation.id)).filter(
            AITutorConversation.submission_id == s_id
        ).scalar() or 0

        last_msg = db.query(AITutorConversation).filter(
            AITutorConversation.submission_id == s_id
        ).order_by(AITutorConversation.created_at.desc()).first()

        results.append(AIChatSummaryItem(
            submission_id=s_id,
            problem_id=submission.problem_id,
            problem_title=problem.title if problem else "Problem",
            verdict=submission.verdict.name if submission.verdict else "UNKNOWN",
            message_count=msg_count,
            last_updated=last_msg.created_at if last_msg else submission.created_at
        ))

    return results

@router.post("/general-chat", response_model=AIChatResponse)
def persistent_general_ai_chat(
    chat_in: GeneralAIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    problem_title = None
    problem_desc = None
    if chat_in.problem_id:
        problem = db.query(Problem).filter(Problem.id == chat_in.problem_id).first()
        if problem:
            problem_title = problem.title
            problem_desc = problem.description

    reply_text = generate_general_chat_reply(
        message=chat_in.message,
        problem_title=problem_title,
        problem_description=problem_desc,
        current_code=chat_in.current_code,
        history=chat_in.history or []
    )

    return AIChatResponse(reply=reply_text)

@router.post("/tutor/{submission_id}", response_model=AITutorHintResponse)
def get_ai_tutor_hint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view AI tutor for this submission")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Associated problem not found")

    verdict_str = submission.verdict.name if submission.verdict else "UNKNOWN"
    
    # Generate Socratic hint
    hint_response = generate_tutor_hint(
        problem_title=problem.title,
        problem_description=problem.description,
        user_code=submission.code,
        verdict=verdict_str
    )

    # Save initial system hint to conversation history if not already present
    existing_convo = db.query(AITutorConversation).filter(AITutorConversation.submission_id == submission_id).first()
    if not existing_convo:
        initial_summary = f"**Diagnosed Error:** {hint_response.what_went_wrong}\n\n**Hint 1:** {hint_response.hint_1}"
        db.add(AITutorConversation(
            submission_id=submission_id,
            user_id=current_user.id,
            role="assistant",
            content=initial_summary
        ))
        db.commit()

    return hint_response

@router.post("/tutor/{submission_id}/chat", response_model=AIChatResponse)
def ai_tutor_chat_turn(
    submission_id: int,
    chat_in: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()

    # Load existing history
    history_records = db.query(AITutorConversation).filter(
        AITutorConversation.submission_id == submission_id
    ).order_by(AITutorConversation.created_at.asc()).all()

    chat_history = [{"role": record.role, "content": record.content} for record in history_records]

    # Generate AI reply
    reply_text = generate_tutor_chat_reply(
        problem_title=problem.title if problem else "Problem",
        problem_description=problem.description if problem else "",
        user_code=submission.code,
        verdict=submission.verdict.name if submission.verdict else "FAILED",
        chat_history=chat_history,
        user_message=chat_in.message
    )

    # Record both user message and assistant reply in DB
    db.add(AITutorConversation(
        submission_id=submission_id,
        user_id=current_user.id,
        role="user",
        content=chat_in.message
    ))
    db.add(AITutorConversation(
        submission_id=submission_id,
        user_id=current_user.id,
        role="assistant",
        content=reply_text
    ))
    db.commit()

    return AIChatResponse(reply=reply_text)

@router.get("/tutor/{submission_id}/history", response_model=List[AIChatMessage])
def get_ai_tutor_history(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    records = db.query(AITutorConversation).filter(
        AITutorConversation.submission_id == submission_id
    ).order_by(AITutorConversation.created_at.asc()).all()

    return [AIChatMessage(role=r.role, content=r.content, created_at=r.created_at) for r in records]

@router.post("/complexity/{submission_id}", response_model=AIComplexityResponse)
def get_complexity_analysis(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check cache by submission_id
    cached = db.query(AIComplexityAnalysis).filter(AIComplexityAnalysis.submission_id == submission_id).first()
    if not cached:
        # Check cache by code_hash
        code_h = compute_code_hash(submission.code)
        cached = db.query(AIComplexityAnalysis).filter(AIComplexityAnalysis.code_hash == code_h).first()

    if cached:
        ops = json.loads(cached.operations_breakdown) if cached.operations_breakdown else []
        opts = json.loads(cached.optimizations) if cached.optimizations else []
        return AIComplexityResponse(
            time_complexity=cached.time_complexity,
            space_complexity=cached.space_complexity,
            performance=cached.performance,
            explanation=cached.explanation,
            operations_breakdown=[OperationBreakdownItem(**item) for item in ops],
            optimizations=opts
        )

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    
    # Run analysis via AI service
    result = analyze_complexity(
        user_code=submission.code,
        problem_description=problem.description if problem else ""
    )

    # Save to cache DB
    code_h = compute_code_hash(submission.code)
    db_analysis = AIComplexityAnalysis(
        submission_id=submission_id,
        code_hash=code_h,
        time_complexity=result.time_complexity,
        space_complexity=result.space_complexity,
        performance=result.performance,
        explanation=result.explanation,
        operations_breakdown=json.dumps([item.model_dump() for item in result.operations_breakdown]),
        optimizations=json.dumps(result.optimizations)
    )
    db.add(db_analysis)
    db.commit()

    return result
