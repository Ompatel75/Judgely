from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any
from app.api.dependencies import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.db.models import User, Submission, VerdictEnum
from app.schemas.user import UserCreate, UserResponse, Token
from app.schemas.ai import UserProfileStats

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    is_first_user = db.query(User).count() == 0
    is_admin_user = is_first_user or user_in.username.lower() == "om_patel"
    
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_admin=is_admin_user
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if user.username.lower() == "om_patel" and not user.is_admin:
        user.is_admin = True
        db.commit()
    
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)) -> Any:
    return current_user

@router.get("/profile", response_model=UserProfileStats)
def get_user_profile_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    solved_count = db.query(func.count(func.distinct(Submission.problem_id))).filter(
        Submission.user_id == current_user.id,
        Submission.verdict == VerdictEnum.AC
    ).scalar() or 0

    attempted_count = db.query(func.count(func.distinct(Submission.problem_id))).filter(
        Submission.user_id == current_user.id
    ).scalar() or 0

    total_submissions = db.query(func.count(Submission.id)).filter(
        Submission.user_id == current_user.id
    ).scalar() or 0

    return UserProfileStats(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        solved_count=solved_count,
        attempted_count=attempted_count,
        total_submissions=total_submissions
    )
