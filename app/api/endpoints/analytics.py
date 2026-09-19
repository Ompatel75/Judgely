from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.db.models import User, UserTopicStatistic, PracticePlan
from app.services.ai_advanced import generate_practice_plan
import json

router = APIRouter()

def get_dynamic_topic_stats(db: Session, user_id: int):
    from app.db.models import Submission, Problem
    submissions = db.query(Submission).filter(Submission.user_id == user_id).all()
    
    topic_data = {}
    for sub in submissions:
        if not sub.problem:
            continue
        tags = [t.strip() for t in sub.problem.tags.split(",") if t.strip()]
        if not tags:
            tags = ["General"]
            
        for tag in tags:
            if tag not in topic_data:
                topic_data[tag] = {"accepted": 0, "rejected": 0, "total_attempts": 0, "difficulty": "Medium"}
            topic_data[tag]["total_attempts"] += 1
            if sub.verdict and sub.verdict.name == "AC":
                topic_data[tag]["accepted"] += 1
            elif sub.verdict and sub.verdict.name in ["WA", "TLE", "RE", "CE"]:
                topic_data[tag]["rejected"] += 1
    return topic_data

@router.get("/me")
def get_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic_data = get_dynamic_topic_stats(db, current_user.id)
    strong = []
    weak = []
    response_stats = []
    for topic, stats in topic_data.items():
        accuracy = stats["accepted"] / stats["total_attempts"] if stats["total_attempts"] > 0 else 0
        if accuracy >= 0.7: strong.append(topic)
        elif accuracy <= 0.4 and stats["total_attempts"] >= 2: weak.append(topic)
        response_stats.append({
            "topic": topic,
            "difficulty": stats["difficulty"],
            "accepted": stats["accepted"],
            "rejected": stats["rejected"],
            "total_attempts": stats["total_attempts"]
        })
    return {"strong_topics": strong, "weak_topics": weak, "topic_stats": response_stats}

@router.post("/practice-plan")
def create_practice_plan(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic_data = get_dynamic_topic_stats(db, current_user.id)
    stats_list = []
    for topic, stats in topic_data.items():
        accuracy = stats["accepted"] / stats["total_attempts"] if stats["total_attempts"] > 0 else 0
        stats_list.append({"topic": topic, "accuracy": accuracy})
        
    plan = generate_practice_plan(json.dumps(stats_list))
    
    new_plan = PracticePlan(user_id=current_user.id, plan_data=plan)
    db.add(new_plan)
    db.commit()
    return {"plan_data": plan}

@router.get("/practice-plan")
def get_practice_plan(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = db.query(PracticePlan).filter(PracticePlan.user_id == current_user.id).order_by(PracticePlan.created_at.desc()).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No active practice plan")
    return {"plan_data": plan.plan_data}
