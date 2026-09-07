from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from app.services.ai import (
    AITutorHintResponse,
    AIComplexityResponse,
    AIGeneratedProblemSchema,
    OperationBreakdownItem
)

class UserProfileStats(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime
    solved_count: int
    attempted_count: int
    total_submissions: int

class AIChatSummaryItem(BaseModel):
    submission_id: int
    problem_id: int
    problem_title: str
    verdict: str
    message_count: int
    last_updated: datetime

class GeneralAIChatRequest(BaseModel):
    message: str
    problem_id: Optional[int] = None
    current_code: Optional[str] = None
    history: Optional[List[dict]] = []

class AIChatMessage(BaseModel):
    role: str
    content: str
    created_at: Optional[datetime] = None

class AIChatRequest(BaseModel):
    message: str

class AIChatResponse(BaseModel):
    reply: str

class AIProblemGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    tags: Optional[str] = ""
    instructions: Optional[str] = ""

class TestValidationRequest(BaseModel):
    problem_id: Optional[int] = None
    cpp_solution: str
    test_cases: List[dict] # list of {"input_data": "...", "expected_output": "..."}

class TestValidationResultItem(BaseModel):
    index: int
    input_data: str
    expected_output: str
    actual_output: str
    status: str # "MATCH" or "MISMATCH" or "ERROR"

class TestValidationResponse(BaseModel):
    total: int
    matched: int
    mismatched: int
    results: List[TestValidationResultItem]
