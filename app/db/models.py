from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class VerdictEnum(enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    AC = "AC"
    WA = "WA"
    TLE = "TLE"
    RE = "RE"
    CE = "CE"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submissions = relationship("Submission", back_populates="user")

class Problem(Base):
    __tablename__ = "problems"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    time_limit = Column(Float, nullable=False, default=1.0) # in seconds
    memory_limit = Column(Integer, nullable=False, default=256) # in MB
    tags = Column(String(255), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    test_cases = relationship("TestCase", back_populates="problem", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="problem")

class TestCase(Base):
    __tablename__ = "test_cases"
    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    input_data = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=True)

    problem = relationship("Problem", back_populates="test_cases")

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    code = Column(Text, nullable=False)
    language = Column(String(50), nullable=False, default="cpp")
    verdict = Column(SQLEnum(VerdictEnum), default=VerdictEnum.PENDING)
    execution_time = Column(Float, nullable=True) # in seconds
    memory_used = Column(Float, nullable=True) # in MB
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")
    complexity_analysis = relationship("AIComplexityAnalysis", back_populates="submission", uselist=False)

class AIComplexityAnalysis(Base):
    __tablename__ = "ai_complexity_analyses"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False)
    code_hash = Column(String(64), index=True, nullable=False)
    time_complexity = Column(String(100), nullable=False)
    space_complexity = Column(String(100), nullable=False)
    performance = Column(String(50), nullable=False)
    explanation = Column(Text, nullable=False)
    operations_breakdown = Column(Text, nullable=True) # JSON string
    optimizations = Column(Text, nullable=True) # JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("Submission", back_populates="complexity_analysis")

class AITutorConversation(Base):
    __tablename__ = "ai_tutor_conversations"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False) # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AIGeneralChatLog(Base):
    __tablename__ = "ai_general_chat_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=True)
    session_id = Column(String(64), index=True, nullable=False)
    role = Column(String(20), nullable=False) # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CodeReview(Base):
    __tablename__ = "code_reviews"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False)
    correctness = Column(String(50), nullable=False)
    time_complexity = Column(String(100), nullable=False)
    space_complexity = Column(String(100), nullable=False)
    code_quality = Column(Text, nullable=True)
    mnc_quality_standards = Column(Text, nullable=True) # MNC-level production guidelines
    potential_bugs = Column(Text, nullable=True)
    edge_cases = Column(Text, nullable=True)
    unnecessary_operations = Column(Text, nullable=True)
    optimizations = Column(Text, nullable=True)
    maintainability = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("Submission", backref="code_review")

class AIHint(Base):
    __tablename__ = "ai_hints"
    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"), unique=True, nullable=False)
    hint_1 = Column(Text, nullable=True)
    hint_2 = Column(Text, nullable=True)
    hint_3 = Column(Text, nullable=True)
    approach = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class HintUsage(Base):
    __tablename__ = "hint_usages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    hint_level = Column(Integer, nullable=False) # 1, 2, 3, 4(approach), 5(solution)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserTopicStatistic(Base):
    __tablename__ = "user_topic_statistics"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(100), nullable=False)
    difficulty = Column(String(50), nullable=False, default="Medium")
    accepted = Column(Integer, default=0)
    rejected = Column(Integer, default=0)
    total_attempts = Column(Integer, default=0)
    avg_time_taken = Column(Float, default=0.0)
    avg_runtime = Column(Float, default=0.0)
    avg_memory = Column(Float, default=0.0)
    hints_used = Column(Integer, default=0)

class PracticePlan(Base):
    __tablename__ = "practice_plans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_data = Column(Text, nullable=False) # JSON
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    status = Column(String(50), default="IN_PROGRESS") # IN_PROGRESS, COMPLETED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class InterviewMessage(Base):
    __tablename__ = "interview_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False) # "interviewer", "candidate"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), unique=True, nullable=False)
    problem_solving_score = Column(Integer, nullable=True)
    dsa_score = Column(Integer, nullable=True)
    complexity_score = Column(Integer, nullable=True)
    code_quality_score = Column(Integer, nullable=True)
    communication_score = Column(Integer, nullable=True)
    edge_case_score = Column(Integer, nullable=True)
    strengths = Column(Text, nullable=True) # JSON
    weaknesses = Column(Text, nullable=True) # JSON
    mistakes = Column(Text, nullable=True) # JSON
    recommended_topics = Column(Text, nullable=True) # JSON
    improvement_plan = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
