from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class CodeReviewSchema(BaseModel):
    correctness: str
    time_complexity: str
    space_complexity: str
    code_quality: Optional[str] = None
    mnc_quality_standards: Optional[str] = None
    potential_bugs: Optional[str] = None
    edge_cases: Optional[str] = None
    unnecessary_operations: Optional[str] = None
    optimizations: Optional[str] = None
    maintainability: Optional[str] = None

class HintUsageRequest(BaseModel):
    hint_level: int

class HintResponse(BaseModel):
    hint_level: int
    content: str

class TopicStatResponse(BaseModel):
    topic: str
    difficulty: str
    accepted: int
    rejected: int
    total_attempts: int

class AnalyticsDashboardResponse(BaseModel):
    strong_topics: List[str]
    weak_topics: List[str]
    topic_stats: List[TopicStatResponse]

class PracticePlanRequest(BaseModel):
    focus_areas: Optional[List[str]] = None

class PracticePlanResponse(BaseModel):
    plan_data: str

class InterviewStartRequest(BaseModel):
    topic: str
    difficulty: str

class InterviewChatRequest(BaseModel):
    message: str

class InterviewChatResponse(BaseModel):
    reply: str

class InterviewEvaluationResponse(BaseModel):
    problem_solving_score: int
    dsa_score: int
    complexity_score: int
    code_quality_score: int
    communication_score: int
    edge_case_score: int
    strengths: str
    weaknesses: str
    mistakes: str
    recommended_topics: str
    improvement_plan: str
