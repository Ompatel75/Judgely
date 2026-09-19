from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.db.models import User, InterviewSession, InterviewMessage, InterviewEvaluation
from app.schemas.ai_advanced import InterviewStartRequest, InterviewChatRequest, InterviewChatResponse
from app.services.ai_advanced import generate_interview_chat_reply, evaluate_mock_interview

router = APIRouter()

@router.post("/start")
def start_interview(req: InterviewStartRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = InterviewSession(user_id=current_user.id, topic=req.topic, difficulty=req.difficulty)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "message": "Interview session started."}

@router.post("/{session_id}/chat", response_model=InterviewChatResponse)
def chat_interview(session_id: int, req: InterviewChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    user_msg = InterviewMessage(session_id=session_id, role="candidate", content=req.message)
    db.add(user_msg)
    
    # build transcript
    history = db.query(InterviewMessage).filter(InterviewMessage.session_id == session_id).order_by(InterviewMessage.created_at.asc()).all()
    transcript = "\n".join([f"{m.role}: {m.content}" for m in history] + [f"candidate: {req.message}"])
    
    reply = generate_interview_chat_reply(session.topic, session.difficulty, transcript)
    
    ai_msg = InterviewMessage(session_id=session_id, role="interviewer", content=reply)
    db.add(ai_msg)
    db.commit()
    
    return InterviewChatResponse(reply=reply)

@router.post("/{session_id}/evaluate")
def evaluate_interview(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id).first()
    history = db.query(InterviewMessage).filter(InterviewMessage.session_id == session_id).order_by(InterviewMessage.created_at.asc()).all()
    transcript = "\n".join([f"{m.role}: {m.content}" for m in history])
    
    eval_res = evaluate_mock_interview(transcript)
    
    evaluation = InterviewEvaluation(
        session_id=session_id,
        problem_solving_score=eval_res.problem_solving_score,
        dsa_score=eval_res.dsa_score,
        complexity_score=eval_res.complexity_score,
        code_quality_score=eval_res.code_quality_score,
        communication_score=eval_res.communication_score,
        edge_case_score=eval_res.edge_case_score,
        strengths=eval_res.strengths,
        weaknesses=eval_res.weaknesses,
        mistakes=eval_res.mistakes,
        recommended_topics=eval_res.recommended_topics,
        improvement_plan=eval_res.improvement_plan
    )
    db.add(evaluation)
    session.status = "COMPLETED"
    db.commit()
    
    return eval_res
